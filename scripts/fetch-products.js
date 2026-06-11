import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import {
  asNumber,
  fetchJson,
  parseSizeGrams,
  productHandle,
  userAgent,
  variantMatchesSize,
} from "./product-utils.js";
import { syncPriceHistory } from "./supabase-history.js";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataPath = join(root, "data", "products.json");
const tempPath = join(root, "data", "products.json.tmp");
const refreshConcurrency = Number(process.env.FETCH_CONCURRENCY ?? 2);

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function flattenJsonLd(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value !== "object") return [];
  const graph = value["@graph"] ? flattenJsonLd(value["@graph"]) : [];
  return [value, ...graph];
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      blocks.push(...flattenJsonLd(JSON.parse(match[1].trim())));
    } catch {
      // Retailers sometimes emit malformed JSON-LD. Ignore and use other signals.
    }
  }
  return blocks;
}

function firstOffer(product) {
  const offers = product?.offers;
  if (Array.isArray(offers)) return offers[0];
  return offers ?? null;
}

function productFromJsonLd(html) {
  const product = parseJsonLdBlocks(html).find((item) => {
    const type = item["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });

  if (!product) return {};
  const offer = firstOffer(product);
  return {
    product: typeof product.name === "string" ? product.name : null,
    price: asNumber(offer?.price ?? offer?.lowPrice ?? offer?.highPrice),
    rating: asNumber(product.aggregateRating?.ratingValue),
    reviewCount: asNumber(
      product.aggregateRating?.reviewCount ?? product.aggregateRating?.ratingCount,
    ),
    productImage: Array.isArray(product.image) ? product.image[0] : product.image,
    availability: firstOffer(product)?.availability ?? null,
  };
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  return html.match(pattern)?.[1]?.trim() ?? null;
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const shopifyRetailers = new Map([
  ["Sportsfuel", "https://www.sportsfuel.co.nz"],
  ["Supplements.co.nz", "https://www.supplements.co.nz"],
  ["Musashi NZ", "https://nz.musashi.com"],
  ["NZ Muscle", "https://www.nzmuscle.co.nz"],
]);

function shopifyPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return null;
  if (Number.isInteger(price) && !String(value).includes(".")) return price / 100;
  return price;
}

async function fetchShopifyProduct(product, baseUrl) {
  const handle = productHandle(product.source);
  if (!handle) throw new Error("missing Shopify product handle");
  const shopifyProduct = await fetchJson(`${baseUrl}/products/${handle}.js`);
  const variant =
    shopifyProduct.variants?.find((item) => variantMatchesSize(item, product.sizeGrams)) ??
    shopifyProduct.variants?.[0];
  if (!variant) throw new Error("missing Shopify variant");
  const available = shopifyProduct.available !== false && variant.available !== false;

  return {
    ...product,
    product: shopifyProduct.title ?? product.product,
    productImage: variant.featured_image?.src ?? variant.featured_image ?? product.productImage,
    sizeGrams: parseSizeGrams([variant.title, shopifyProduct.title].join(" "), product.sizeGrams),
    price: shopifyPrice(variant.price) ?? product.price,
    available,
    fetchStatus: available ? "live" : "unavailable",
    fetchError: available ? null : "product is marked unavailable by retailer",
    updatedAt: new Date().toISOString(),
  };
}

async function fetchProductPage(source, attempt = 1) {
  const response = await fetch(source, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (response.status === 429 && attempt < 3) {
    await wait(1500 * attempt);
    return fetchProductPage(source, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function validatedPrice(candidate, fallbackPrice) {
  if (!candidate) return fallbackPrice;
  if (!fallbackPrice) return candidate;
  const tooLow = candidate < fallbackPrice * 0.35;
  const tooHigh = candidate > fallbackPrice * 2.5;
  if (tooLow || tooHigh) return fallbackPrice;
  return candidate;
}

function extractProductData(html, fallback) {
  const jsonLd = productFromJsonLd(html);
  const title = decodeHtml(jsonLd.product ?? metaContent(html, "og:title") ?? fallback.product);
  const productImage = jsonLd.productImage ?? metaContent(html, "og:image") ?? fallback.productImage;
  const scrapedPrice =
    jsonLd.price ??
    asNumber(metaContent(html, "product:price:amount")) ??
    asNumber(html.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/i)?.[1]) ??
    null;
  const price = validatedPrice(scrapedPrice, fallback.price);
  const priceRejected = scrapedPrice && price === fallback.price && scrapedPrice !== fallback.price;
  const unavailable = /(?:OutOfStock|Discontinued|SoldOut|Sold Out)/i.test(
    `${jsonLd.availability ?? ""} ${html.match(/availability["']?\s*:\s*["']?([^"',}<]+)/i)?.[1] ?? ""}`,
  );

  return {
    ...fallback,
    product: title,
    productImage,
    sizeGrams: parseSizeGrams(title, fallback.sizeGrams),
    price,
    rating: jsonLd.rating ?? fallback.rating,
    reviewCount: jsonLd.reviewCount ?? fallback.reviewCount,
    available: !unavailable,
    fetchStatus: unavailable ? "unavailable" : priceRejected ? "stale" : "live",
    fetchError: unavailable
      ? "product is marked unavailable by retailer"
      : priceRejected
        ? `rejected implausible scraped price ${scrapedPrice}`
        : null,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchOne(product) {
  try {
    if (shopifyRetailers.has(product.retailer)) {
      return await fetchShopifyProduct(product, shopifyRetailers.get(product.retailer));
    }

    const html = await fetchProductPage(product.source);
    return extractProductData(html, product);
  } catch (error) {
    return {
      ...product,
      fetchStatus: "stale",
      fetchError: error.message,
      updatedAt: product.updatedAt ?? null,
    };
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function refreshProducts(options = {}) {
  const writeCache = options.writeCache ?? process.env.VERCEL !== "1";
  const current = options.products
    ? { products: options.products }
    : JSON.parse(await readFile(dataPath, "utf8"));
  const products = await mapWithConcurrency(current.products, refreshConcurrency, fetchOne);
  const refreshedAt = new Date().toISOString();
  const payload = {
    ...current,
    refreshedAt,
    refreshMode: "http-fetch",
    products,
  };
  if (writeCache) {
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
    await rename(tempPath, dataPath);
  }
  let supabase;
  try {
    supabase = await syncPriceHistory(products, refreshedAt);
  } catch (error) {
    supabase = {
      enabled: true,
      products: 0,
      historyRows: 0,
      error: error.message,
    };
  }
  return {
    total: products.length,
    live: products.filter((product) => product.fetchStatus === "live").length,
    products,
    supabase,
  };
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  const result = await refreshProducts();
  const history = result.supabase.enabled
    ? result.supabase.error
      ? `; Supabase write failed: ${result.supabase.error}`
      : `; wrote ${result.supabase.historyRows} price history rows and ${result.supabase.availabilityRows ?? 0} availability rows to Supabase`
    : "; Supabase disabled";
  console.log(`Refreshed ${result.live}/${result.total} products${history}`);
}
