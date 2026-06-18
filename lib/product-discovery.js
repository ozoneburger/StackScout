import { asNumber, canonicalUrl, fetchJson, parseSizeGrams, userAgent } from "../scripts/product-utils.js";
import { syncProducts } from "../scripts/supabase-history.js";
import { discoveryConfigs as defaultDiscoveryConfigs } from "../scripts/retailer-config.js";

const creatineRejectPattern =
  /\b(caps|capsule|capsules|caplet|chewable|chewables|gumm(?:y|ies)|pre[-\s]?workout|blend|matrix|hcl|magnesium|plus|mass gainer|protein|whey|shaker|bundle|stack|sample|bar|bars|tablet|tablets|hydration|electrolyte|electrolytes)\b/i;
const proteinPowderRejectPattern =
  /\b(bar|bars|cookie|cookies|brownie|brownies|drink|ready[-\s]?to[-\s]?drink|rtd|collagen|vegan|plant|pea|rice|soy|mass gainer|gainer|creatine|pre[-\s]?workout|bcaa|eaa|amino|bundle|sample|shaker)\b/i;
const wheyProteinRejectPattern =
  /\b(isolate|vegan|plant|pea|rice|soy|bar|bars|cookie|cookies|brownie|brownies|drink|ready[-\s]?to[-\s]?drink|rtd|collagen|mass gainer|gainer|creatine|pre[-\s]?workout|bcaa|eaa|amino|bundle|sample|shaker)\b/i;
const plantProteinRejectPattern =
  /\b(whey|isolate|bar|bars|cookie|cookies|brownie|brownies|drink|ready[-\s]?to[-\s]?drink|rtd|collagen|mass gainer|gainer|creatine|pre[-\s]?workout|bcaa|eaa|amino|bundle|sample|shaker)\b/i;
const proteinBarRejectPattern =
  /\b(powder|whey powder|protein powder|isolate powder|mass gainer|gainer|drink|ready[-\s]?to[-\s]?drink|rtd|collagen|creatine|pre[-\s]?workout|bcaa|eaa|amino|bundle|sample|shaker)\b/i;
const preWorkoutRejectPattern =
  /\b(non[-\s]?stim|stim[-\s]?free|stimulant[-\s]?free|caffeine[-\s]?free|zero caffeine|bar|bars|protein|whey|isolate|creatine monohydrate|caps|capsule|capsules|gumm(?:y|ies)|bundle|sample|shaker|hydration|electrolyte|electrolytes)\b/i;
const nonStimPreWorkoutRejectPattern =
  /\b(bar|bars|protein|whey|isolate|creatine monohydrate|caps|capsule|capsules|gumm(?:y|ies)|bundle|sample|shaker|hydration|electrolyte|electrolytes)\b/i;
const electrolyteRejectPattern =
  /\b(pre[-\s]?workout|protein|whey|isolate|creatine|mass gainer|gainer|bcaa|eaa|amino|bundle|sample|shaker)\b/i;

const categoryRules = {
  creatine: {
    minSizeGrams: 50,
    include: [/creatine/i, /monohydrate/i],
    reject: creatineRejectPattern,
  },
  whey_protein: {
    minSizeGrams: 300,
    include: [/whey/i],
    reject: wheyProteinRejectPattern,
  },
  protein_isolate: {
    minSizeGrams: 300,
    include: [/isolate/i],
    includeAny: [/protein/i, /whey/i],
    reject: proteinPowderRejectPattern,
  },
  plant_based_protein: {
    minSizeGrams: 300,
    includeAny: [/plant[-\s]?based/i, /vegan/i, /pea/i, /rice/i, /soy/i],
    include: [/protein/i],
    reject: plantProteinRejectPattern,
  },
  mass_gainer: {
    minSizeGrams: 500,
    includeAny: [/mass gainer/i, /weight gainer/i, /\bgainer\b/i],
    reject: /\b(bar|bars|cookie|cookies|brownie|brownies|drink|ready[-\s]?to[-\s]?drink|rtd|creatine|pre[-\s]?workout|bcaa|eaa|amino|bundle|sample|shaker)\b/i,
  },
  protein_bars: {
    minSizeGrams: 30,
    includeAny: [/\bbar\b/i, /\bbars\b/i, /cookie/i, /brownie/i],
    include: [/protein/i],
    reject: proteinBarRejectPattern,
  },
  pre_workout: {
    minSizeGrams: 100,
    includeAny: [/pre[-\s]?workout/i, /pre workout/i],
    reject: preWorkoutRejectPattern,
  },
  non_stim_pre_workout: {
    minSizeGrams: 100,
    includeAny: [/non[-\s]?stim/i, /stim[-\s]?free/i, /stimulant[-\s]?free/i, /caffeine[-\s]?free/i, /zero caffeine/i],
    include: [/pre[-\s]?workout/i],
    reject: nonStimPreWorkoutRejectPattern,
  },
  electrolytes: {
    minSizeGrams: 20,
    includeAny: [/electrolyte/i, /hydration/i],
    reject: electrolyteRejectPattern,
  },
};

const categoryLabels = {
  creatine: "creatine",
  whey_protein: "whey protein",
  protein_isolate: "protein isolate",
  plant_based_protein: "plant-based protein",
  mass_gainer: "mass gainer",
  protein_bars: "protein bars",
  pre_workout: "pre-workout",
  non_stim_pre_workout: "non-stim pre-workout",
  electrolytes: "electrolytes",
};

const categorySpecificity = {
  creatine: 1,
  whey_protein: 2,
  pre_workout: 2,
  electrolytes: 2,
  plant_based_protein: 3,
  mass_gainer: 3,
  protein_bars: 3,
  protein_isolate: 4,
  non_stim_pre_workout: 4,
};

function categoryLabel(category) {
  return categoryLabels[category] ?? "creatine";
}

function htmlToText(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(decodeHtml(value), baseUrl).href;
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function favicon(baseUrl) {
  try {
    const host = new URL(baseUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return null;
  }
}

function retailerDefaults(products, config) {
  const existing = products.find((product) => product.retailer === config.retailer);
  if (!existing) {
    return {
      image: favicon(config.baseUrl),
      shipping: config.shipping ?? {
        cost: null,
        freeThreshold: null,
        note: "Shipping estimate needs confirmation.",
      },
      pickup: "Check retailer for pickup or store availability.",
      stores: [],
      deliveryAvailable: true,
      pickupAvailable: false,
    };
  }
  return {
    image: existing.image,
    shipping: existing.shipping ?? config.shipping,
    pickup: existing.pickup,
    stores: existing.stores ?? [],
    deliveryAvailable: existing.deliveryAvailable,
    pickupAvailable: existing.pickupAvailable,
  };
}

function imageFromShopify(product, variant) {
  const variantImageId = variant?.image_id ?? variant?.featured_image?.id;
  const variantImage = product.images?.find((image) => image.id === variantImageId);
  return (
    variant?.featured_image?.src ??
    variant?.featured_image ??
    variantImage?.src ??
    product.image?.src ??
    product.images?.[0]?.src ??
    null
  );
}

function imageFromShopifySearch(product) {
  return (
    product.featured_image?.url ??
    product.featured_image?.src ??
    product.image ??
    null
  );
}

function shopifyDiscoveryPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return null;
  if (Number.isInteger(price) && !String(value).includes(".")) return price / 100;
  return price;
}

function bestVariant(product) {
  const variants = product.variants ?? [];
  const usable = variants
    .filter((variant) => variant.available !== false && product.available !== false)
    .map((variant) => {
      const sizeGrams = parseSizeGrams([variant.title, variant.option1, product.title].join(" "), null);
      const price = shopifyDiscoveryPrice(variant.price);
      return { variant, sizeGrams, price };
    })
    .filter((item) => item.sizeGrams && item.price);

  if (!usable.length) return null;
  return usable.sort((a, b) => b.sizeGrams - a.sizeGrams || a.price - b.price)[0];
}

function matchesCategory(text, category) {
  const rule = categoryRules[category] ?? categoryRules.creatine;
  if (rule.include?.some((pattern) => !pattern.test(text))) return false;
  if (rule.includeAny?.length && !rule.includeAny.some((pattern) => pattern.test(text))) return false;
  if (rule.reject?.test(text)) return false;
  return true;
}

function inferCategory(product) {
  const text = `${product.product ?? ""} ${product.body ?? ""}`.toLowerCase();
  for (const category of [
    "non_stim_pre_workout",
    "protein_isolate",
    "plant_based_protein",
    "mass_gainer",
    "protein_bars",
    "electrolytes",
    "whey_protein",
    "pre_workout",
    "creatine",
  ]) {
    if (matchesCategory(text, category)) return category;
  }
  return product.category === "protein" ? "whey_protein" : product.category ?? "creatine";
}

function normalizedCategory(product) {
  if (product.category === "pre_workout" && inferCategory(product) === "non_stim_pre_workout") {
    return "non_stim_pre_workout";
  }
  if (product.category === "protein") return inferCategory(product);
  return product.category ?? "creatine";
}

function moreSpecificCategory(left, right) {
  const leftScore = categorySpecificity[left] ?? 0;
  const rightScore = categorySpecificity[right] ?? 0;
  return leftScore >= rightScore ? left : right;
}

function isComparableProduct(product, variantMatch, category) {
  const text = `${product.title} ${product.product_type ?? ""} ${product.tags ?? ""} ${htmlToText(
    product.body_html,
  )}`.toLowerCase();
  const rule = categoryRules[category] ?? categoryRules.creatine;
  if (!matchesCategory(text, category)) return false;
  if (!variantMatch?.sizeGrams || variantMatch.sizeGrams < rule.minSizeGrams) return false;
  if (!variantMatch?.price) return false;
  return true;
}

function isComparableCandidate(candidate, category) {
  const text = `${candidate.product ?? ""} ${candidate.body ?? ""}`.toLowerCase();
  const rule = categoryRules[category] ?? categoryRules.creatine;
  if (!matchesCategory(text, category)) return false;
  if (!candidate.sizeGrams || candidate.sizeGrams < rule.minSizeGrams) return false;
  if (!candidate.price) return false;
  return true;
}

function displayTitle(vendor, title) {
  const cleanTitle = decodeHtml(title);
  const cleanVendor = decodeHtml(vendor);
  if (!cleanVendor || cleanTitle.toLowerCase().includes(cleanVendor.toLowerCase())) return cleanTitle;
  return `${cleanVendor} ${cleanTitle}`;
}

function discoveredProduct(config, defaults, candidate, confidence) {
  const candidateCategory = inferCategory({ ...candidate, category: config.category });
  return {
    retailer: config.retailer,
    ...defaults,
    product: candidate.product,
    category: moreSpecificCategory(candidateCategory, config.category ?? "creatine"),
    productImage: candidate.productImage ?? null,
    sizeGrams: candidate.sizeGrams,
    price: candidate.price,
    rating: null,
    reviewCount: null,
    source: canonicalUrl(candidate.source),
    confidence,
    fetchStatus: "discovered",
    discoverySource: config.adapter,
    available: true,
    fetchError: null,
    updatedAt: null,
  };
}

async function discoverShopifyProducts(config, currentProducts) {
  const payload = await fetchJson(config.discoveryUrl);
  const defaults = retailerDefaults(currentProducts, config);
  const discovered = [];

  for (const product of payload.products ?? []) {
    if (discovered.length >= config.maxCandidates) break;
    const variantMatch = bestVariant(product);
    if (!isComparableProduct(product, variantMatch, config.category)) continue;

    const source = canonicalUrl(`${config.baseUrl}/products/${product.handle}`);
    discovered.push(
      discoveredProduct(
        config,
        defaults,
        {
          product: product.title,
          productImage: imageFromShopify(product, variantMatch.variant),
          sizeGrams: variantMatch.sizeGrams,
          price: variantMatch.price,
          source,
        },
        `Discovered from retailer ${categoryLabel(config.category)} product collection.`,
      ),
    );
  }

  return discovered;
}

async function discoverShopifySearchSuggest(config, currentProducts) {
  const payload = await fetchJson(config.discoveryUrl);
  const defaults = retailerDefaults(currentProducts, config);
  const discovered = [];

  for (const product of payload.resources?.results?.products ?? []) {
    if (discovered.length >= config.maxCandidates) break;
    if (product.available === false) continue;

    const source = absoluteUrl(product.url ?? `/products/${product.handle}`, config.baseUrl);
    const title = displayTitle(product.vendor, product.title);
    const body = htmlToText(product.body);
    const initialText = `${title} ${body}`.toLowerCase();
    if (!source || !matchesCategory(initialText, config.category)) continue;

    let enrichedProduct = null;
    try {
      if (product.handle) enrichedProduct = await fetchJson(`${config.baseUrl}/products/${product.handle}.js`);
    } catch {
      // Search result data is still usable when product JSON is unavailable.
    }

    const variantMatch = enrichedProduct ? bestVariant(enrichedProduct) : null;
    const enrichedTitle = enrichedProduct?.title
      ? displayTitle(product.vendor, enrichedProduct.title)
      : title;
    const enrichedBody = htmlToText(enrichedProduct?.description ?? enrichedProduct?.body_html ?? body);
    const candidate = {
      product: enrichedTitle,
      productImage: imageFromShopify(enrichedProduct ?? {}, variantMatch?.variant) ?? imageFromShopifySearch(product),
      sizeGrams:
        variantMatch?.sizeGrams ??
        parseSizeGrams(
          [
            enrichedTitle,
            product.featured_image?.alt,
            product.image,
            product.handle,
            enrichedProduct?.featured_image,
            enrichedProduct?.images?.[0],
          ]
            .filter(Boolean)
            .join(" "),
          null,
        ),
      price:
        variantMatch?.price ??
        asNumber(product.price_min ?? product.price),
      source,
      body: enrichedBody || body,
    };

    if (!isComparableCandidate(candidate, config.category)) continue;
    discovered.push(
      discoveredProduct(config, defaults, candidate, `Discovered from retailer ${categoryLabel(config.category)} product search.`),
    );
  }

  return discovered;
}

function attributesByName(item) {
  return Object.fromEntries(
    (item.attribute ?? []).map((attribute) => [
      attribute.name,
      Array.isArray(attribute.value)
        ? attribute.value.map((value) => value.value ?? value["non-ml"]).filter(Boolean).join(" ")
        : attribute.value,
    ]),
  );
}

async function discoverChemistWarehouseSearch(config, currentProducts) {
  const payload = await fetchJson(config.discoveryUrl);
  const defaults = retailerDefaults(currentProducts, config);
  const discovered = [];
  const items = payload.universes?.universe?.[0]?.["items-section"]?.items?.item ?? [];

  for (const item of items) {
    if (discovered.length >= config.maxCandidates) break;
    const attrs = attributesByName(item);
    const title = decodeHtml(attrs.name);
    const candidate = {
      product: title,
      productImage: attrs._thumburl ?? null,
      sizeGrams: parseSizeGrams(title, null),
      price: asNumber(attrs.price_cw_nz),
      rating: asNumber(attrs.bv_star_rating),
      reviewCount: asNumber(attrs.bv_total_votes),
      source: attrs.producturl,
      body: title,
    };

    if (!candidate.source || !isComparableCandidate(candidate, config.category)) continue;
    discovered.push({
      ...discoveredProduct(config, defaults, candidate, `Discovered from Chemist Warehouse ${categoryLabel(config.category)} search API.`),
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
    });
  }

  return discovered;
}

function parseXplosivProducts(html, config) {
  return html
    .split(/<li[^>]+class=["'][^"']*product-item[^"']*["'][^>]*>/i)
    .slice(1)
    .map((block) => {
      const source = absoluteUrl(block.match(/<a[^>]+href=["']([^"']+\.html[^"']*)["'][^>]*>/i)?.[1], config.baseUrl);
      const productImageTag =
        block.match(/<img[^>]+class=["'][^"']*product-image-photo[^"']*["'][^>]*>/i)?.[0] ?? "";
      const image = absoluteUrl(productImageTag.match(/\ssrc=["']([^"']+)["']/i)?.[1], config.baseUrl);
      const alt = decodeHtml(productImageTag.match(/\salt=["']([^"']+)["']/i)?.[1]);
      const title = decodeHtml(
        alt ||
          block.match(/<a[^>]+class=["'][^"']*product-item-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
      );
      const body = htmlToText(block);
      const price = asNumber(block.match(/<span[^>]+class=["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d,.]+)/i)?.[1]);
      return {
        product: title,
        productImage: image,
        sizeGrams: parseSizeGrams(`${title} ${body}`, null),
        price,
        source,
        body,
      };
    })
    .filter((candidate) => candidate.source);
}

function parseSprintFitProducts(html, config) {
  return html
    .split(/<div[^>]+class=["']product["'][^>]+data-ga-index[^>]*>/i)
    .slice(1)
    .map((block) => {
      const brand = decodeHtml(block.match(/data-ga-item-brand=["']([^"']+)["']/i)?.[1]);
      const name = decodeHtml(block.match(/data-ga-item-name=["']([^"']+)["']/i)?.[1]);
      const href = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
      const source = absoluteUrl(href, config.baseUrl);
      const image = absoluteUrl(block.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1], config.baseUrl);
      const alt = decodeHtml(block.match(/<img[^>]+alt=["']([^"']+)["'][^>]*>/i)?.[1]);
      const title = alt || [brand, name].filter(Boolean).join(" ");
      const body = htmlToText(block);
      const price = asNumber(block.match(/data-ga-item-price=["']([^"']+)["']/i)?.[1]);
      return {
        product: title,
        productImage: image,
        sizeGrams: parseSizeGrams(`${title} ${body}`, null),
        price,
        source,
        body,
      };
    })
    .filter((candidate) => candidate.source);
}

function parseNzProteinProducts(html, config) {
  return html
    .split(/<div[^>]+class=["'][^"']*product-wrap[^"']*["'][^>]*>/i)
    .slice(1)
    .map((block) => {
      const href = block.match(/<a[^>]+href=["']([^"']*\/product\/[^"']+)["'][^>]*>/i)?.[1];
      const source = absoluteUrl(href, config.baseUrl);
      const image = absoluteUrl(block.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1], config.baseUrl);
      const alt = decodeHtml(block.match(/<img[^>]+alt=["']([^"']+)["'][^>]*>/i)?.[1]);
      const title = decodeHtml(
        block.match(/<h3[^>]*data-mh=["']product-title["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? alt,
      );
      const body = htmlToText(block);
      const priceBlock = block.match(/<div[^>]+class=["'][^"']*product-price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
      const price = asNumber(priceBlock);
      return {
        product: title,
        productImage: image,
        sizeGrams: parseSizeGrams(`${title} ${alt} ${body}`, null),
        price,
        source,
        body: `${alt} ${body}`,
      };
    })
    .filter((candidate) => candidate.source);
}

async function discoverGenericHtmlProducts(config, currentProducts) {
  const html = await fetchHtml(config.discoveryUrl);
  const defaults = retailerDefaults(currentProducts, config);
  const parser =
    config.retailer === "Xplosiv Supplements"
      ? parseXplosivProducts
      : config.retailer === "Sprint Fit"
        ? parseSprintFitProducts
        : config.retailer === "NZ Protein"
          ? parseNzProteinProducts
          : () => [];

  const discovered = [];
  for (const candidate of parser(html, config)) {
    if (discovered.length >= config.maxCandidates) break;
    if (!isComparableCandidate(candidate, config.category)) continue;
    discovered.push(
      discoveredProduct(config, defaults, candidate, `Discovered from retailer ${categoryLabel(config.category)} category page.`),
    );
  }
  return discovered;
}

async function discoverFromConfig(config, currentProducts) {
  if (config.adapter === "shopifyCollection" || config.adapter === "shopifyAllProducts") {
    return discoverShopifyProducts(config, currentProducts);
  }
  if (config.adapter === "shopifySearchSuggest") {
    return discoverShopifySearchSuggest(config, currentProducts);
  }
  if (config.adapter === "chemistWarehouseSearch") {
    return discoverChemistWarehouseSearch(config, currentProducts);
  }
  if (config.adapter === "genericHtml") {
    return discoverGenericHtmlProducts(config, currentProducts);
  }
  return [];
}

function mergeProducts(currentProducts, discoveredProducts) {
  const byUrl = new Map(
    currentProducts.map((product) => [
      canonicalUrl(product.source),
      {
        ...product,
        category: normalizedCategory(product),
        source: canonicalUrl(product.source),
      },
    ]),
  );
  let added = 0;
  let existing = 0;

  for (const product of discoveredProducts) {
    const source = canonicalUrl(product.source);
    if (byUrl.has(source)) {
      const current = byUrl.get(source);
      byUrl.set(source, {
        ...current,
        category: moreSpecificCategory(product.category, current.category),
        productImage: current.productImage ?? product.productImage,
        confidence: current.confidence ?? product.confidence,
      });
      existing += 1;
      continue;
    }
    byUrl.set(source, { ...product, source });
    added += 1;
  }

  return { products: [...byUrl.values()], added, existing };
}

export async function discoverProducts(options = {}) {
  if (!Array.isArray(options.products)) {
    throw new Error("discoverProducts requires a products array");
  }
  const discoveryConfigs = options.discoveryConfigs ?? defaultDiscoveryConfigs;
  const discoveredByRetailer = [];
  const allDiscovered = [];
  const configuredRetailers = new Set(discoveryConfigs.map((config) => config.retailer));

  for (const config of discoveryConfigs) {
    try {
      const products = await discoverFromConfig(config, options.products);
      discoveredByRetailer.push({ retailer: config.retailer, count: products.length });
      allDiscovered.push(...products);
    } catch (error) {
      discoveredByRetailer.push({ retailer: config.retailer, count: 0, error: error.message });
    }
    await sleep(200);
  }

  const retainedProducts = options.products.filter(
    (product) => !(product.fetchStatus === "discovered" && configuredRetailers.has(product.retailer)),
  );
  const merged = mergeProducts(retainedProducts, allDiscovered);
  const discoveryRefreshedAt = new Date().toISOString();

  let supabase;
  try {
    supabase = await syncProducts(merged.products);
  } catch (error) {
    supabase = {
      enabled: true,
      products: 0,
      error: error.message,
    };
  }

  return {
    total: merged.products.length,
    added: merged.added,
    existing: merged.existing,
    discoveryRefreshedAt,
    products: merged.products,
    retailers: discoveredByRetailer,
    supabase,
  };
}
