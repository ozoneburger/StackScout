import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnv } from "../scripts/env.js";
import { recordAnalyticsEvent, recordOutboundClick } from "../scripts/supabase-events.js";
import { recordFeedback } from "../scripts/supabase-feedback.js";
import { supabaseRequest } from "../scripts/supabase-history.js";
import { readProductsFromSupabase } from "../scripts/supabase-products.js";
import { readAnalyticsStats } from "../scripts/supabase-stats.js";

loadEnv();

const root = process.cwd();
const productsCachePath = join(root, "data", "products.json");
const rateLimits = new Map();
let packageVersion = null;
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

export const securityHeaders = {
  "Content-Security-Policy":
    `default-src 'self'; img-src 'self' https: http: data:; connect-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function env() {
  return {
    adminToken: process.env.ADMIN_TOKEN ?? null,
    cronSecret: process.env.CRON_SECRET ?? null,
    refreshMs: Number(process.env.REFRESH_MS ?? 24 * 60 * 60 * 1000),
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "") ?? null,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? null,
    isVercel: process.env.VERCEL === "1",
  };
}

function refreshAge(refreshedAt) {
  if (!refreshedAt) return null;
  const timestamp = Date.parse(refreshedAt);
  if (Number.isNaN(timestamp)) return null;
  return Date.now() - timestamp;
}

async function latestRefreshRun(status = null) {
  const statusFilter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  const rows = await supabaseRequest(
    `/refresh_runs?select=id,reason,status,started_at,finished_at,discovered_count,total_products,live_products,history_rows,availability_rows,supabase_enabled,error_message,metadata${statusFilter}&order=started_at.desc&limit=1`,
    { method: "GET" },
  );
  return rows?.[0] ?? null;
}

async function refreshOperationsPayload() {
  const configured = Boolean(env().cronSecret);
  try {
    const [latest, latestSuccess] = await Promise.all([latestRefreshRun(), latestRefreshRun("success")]);
    const lastSuccessFinishedAt = latestSuccess?.finished_at ?? null;
    const lastSuccessAgeMs = refreshAge(lastSuccessFinishedAt);
    return {
      scheduler: "vercel-cron",
      cronSecretConfigured: configured,
      staleAfterMs: env().refreshMs,
      stale: lastSuccessAgeMs === null ? null : lastSuccessAgeMs > env().refreshMs,
      lastRun: latest,
      lastSuccess: latestSuccess,
      lastSuccessAgeMs,
      source: latest || latestSuccess ? "supabase" : "none",
      error: null,
    };
  } catch (error) {
    return {
      scheduler: "vercel-cron",
      cronSecretConfigured: configured,
      staleAfterMs: env().refreshMs,
      stale: null,
      lastRun: null,
      lastSuccess: null,
      lastSuccessAgeMs: null,
      source: "unavailable",
      error: error.message,
    };
  }
}

export function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...securityHeaders,
    },
  });
}

export function emptyResponse(status = 204) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...securityHeaders,
    },
  });
}

export function htmlResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...securityHeaders,
      ...headers,
    },
  });
}

function parseCookieHeader(header) {
  return Object.fromEntries(
    String(header ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

export function requestToken(request, url) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return (
    request.headers.get("x-admin-token") ??
    url.searchParams.get("admin_token") ??
    parseCookieHeader(request.headers.get("cookie")).stackscout_admin ??
    null
  );
}

export function isAdminRequest(request, url) {
  const { adminToken, isVercel } = env();
  if (!adminToken) return !isVercel;
  return requestToken(request, url) === adminToken;
}

export function isAdminContext({ queryToken, cookieToken, headerToken } = {}) {
  const { adminToken, isVercel } = env();
  if (!adminToken) return !isVercel;
  return queryToken === adminToken || cookieToken === adminToken || headerToken === adminToken;
}

export function adminCookieHeader(request) {
  const { adminToken } = env();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure = forwardedProto === "https" || env().isVercel ? "; Secure" : "";
  return `stackscout_admin=${encodeURIComponent(adminToken ?? "")}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

export function forbiddenJson() {
  return jsonResponse({ error: "Admin token required" }, 401);
}

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded?.trim()) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimitId(request) {
  return createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 24);
}

function upstashEnabled() {
  const { upstashRedisUrl, upstashRedisToken } = env();
  return Boolean(upstashRedisUrl && upstashRedisToken);
}

export function requireProductionRateLimitBackend() {
  if (!env().isVercel || upstashEnabled()) return null;
  return jsonResponse(
    {
      error: "Production rate limiting is not configured",
      requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    },
    503,
  );
}

async function upstashPipeline(commands) {
  const { upstashRedisUrl, upstashRedisToken } = env();
  const response = await fetch(`${upstashRedisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashRedisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash ${response.status}: ${text}`);
  }

  const result = await response.json();
  if (!Array.isArray(result)) throw new Error("Unexpected Upstash pipeline response");
  return result;
}

async function redisRateLimit(id, key, { max, windowMs }) {
  const redisKey = `rate:${key}:${id}`;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const rows = await upstashPipeline([
    ["INCR", redisKey],
    ["TTL", redisKey],
  ]);
  const count = Number(rows[0]?.result);
  if (!Number.isFinite(count)) throw new Error(rows[0]?.error ?? "Upstash INCR failed");
  const ttl = Number(rows[1]?.result);
  if (count === 1 || ttl < 0) {
    await upstashPipeline([["EXPIRE", redisKey, ttlSeconds]]);
  }
  return count <= max;
}

function memoryRateLimit(id, key, { max, windowMs }) {
  const now = Date.now();
  const rateKey = `${key}:${id}`;
  const current = rateLimits.get(rateKey);
  if (!current || current.resetAt <= now) {
    rateLimits.set(rateKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= max;
}

async function rateLimit(request, key, options) {
  const id = rateLimitId(request);
  if (upstashEnabled()) {
    try {
      return await redisRateLimit(id, key, options);
    } catch (error) {
      console.warn(`Upstash rate limit unavailable; using memory fallback: ${error.message}`);
    }
  }
  return memoryRateLimit(id, key, options);
}

async function rateLimitAny(request, rules) {
  for (const rule of rules) {
    if (!(await rateLimit(request, rule.key, rule))) return false;
  }
  return true;
}

async function readProductsCache() {
  return JSON.parse(await readFile(productsCachePath, "utf8"));
}

async function readPackageVersion() {
  if (packageVersion) return packageVersion;
  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    packageVersion = packageJson.version ?? "0.0.0";
  } catch {
    packageVersion = "0.0.0";
  }
  return packageVersion;
}

export async function readProductDataset() {
  try {
    const supabase = await readProductsFromSupabase();
    if (supabase) {
      return {
        source: "supabase",
        refreshedAt: supabase.refreshedAt,
        discoveryRefreshedAt: null,
        products: supabase.products,
      };
    }
  } catch (error) {
    console.warn(`Supabase product read failed; falling back to cache: ${error.message}`);
  }

  const cache = await readProductsCache();
  return {
    source: "cache",
    refreshedAt: cache.refreshedAt ?? null,
    discoveryRefreshedAt: cache.discoveryRefreshedAt ?? null,
    products: cache.products ?? [],
  };
}

export function isAvailable(product) {
  return product.available !== false && product.fetchStatus !== "unavailable";
}

export function estimatedShipping(product) {
  if (!product.deliveryAvailable) return null;
  if (!product.shipping) return null;
  if (product.shipping.freeThreshold !== null && product.price >= product.shipping.freeThreshold) return 0;
  return Number.isFinite(product.shipping.cost) ? product.shipping.cost : null;
}

export function estimatedTotal(product) {
  const shipping = estimatedShipping(product);
  return shipping === null ? product.price : product.price + shipping;
}

export function pricePer100g(product) {
  return (estimatedTotal(product) / product.sizeGrams) * 100;
}

export function normalizedCategory(product) {
  const category = product.category ?? "creatine";
  const text = `${product.product ?? ""}`.toLowerCase();
  if (
    category === "pre_workout" &&
    /\b(non[-\s]?stim|stim[-\s]?free|stimulant[-\s]?free|caffeine[-\s]?free|zero caffeine)\b/.test(text)
  ) {
    return "non_stim_pre_workout";
  }
  if (category !== "protein") return category;

  if (/\b(non[-\s]?stim|stim[-\s]?free|stimulant[-\s]?free|caffeine[-\s]?free)\b/.test(text)) {
    return "non_stim_pre_workout";
  }
  if (/\b(isolate|iso[-\s]?100)\b/.test(text)) return "protein_isolate";
  if (/\b(vegan|plant[-\s]?based|plant protein|pea|rice|soy)\b/.test(text)) {
    return "plant_based_protein";
  }
  if (/\b(mass gainer|weight gainer|\bgainer\b)\b/.test(text)) return "mass_gainer";
  if (/\b(bar|bars|cookie|cookies|brownie|brownies)\b/.test(text)) return "protein_bars";
  return "whey_protein";
}

function normalizedRequestedCategory(category) {
  if (category === "protein") return "whey_protein";
  return category;
}

function shippingConfidence(product) {
  if (!product.deliveryAvailable) return "none";
  return estimatedShipping(product) === null ? "unknown" : "estimated";
}

function rankingWarning(product) {
  if (!isAvailable(product)) return "Product is unavailable.";
  if (product.fetchStatus === "stale") return "Using stale saved data.";
  if (product.fetchStatus === "discovered") return "Discovered product has not been live-checked yet.";
  if (shippingConfidence(product) === "unknown") return "Shipping is unknown, so this product cannot win value ranking.";
  if (!product.price || !product.sizeGrams) return "Price or pack size is missing.";
  return null;
}

function rankingGroup(product) {
  return rankingWarning(product) === null ? 0 : 1;
}

function shippingGroup(product) {
  return shippingConfidence(product) === "unknown" ? 1 : 0;
}

function valueTieBreak(a, b) {
  return (
    rankingGroup(a) - rankingGroup(b) ||
    pricePer100g(a) - pricePer100g(b) ||
    estimatedTotal(a) - estimatedTotal(b) ||
    b.sizeGrams - a.sizeGrams ||
    new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0)
  );
}

export function publicProduct(product) {
  const shipping = estimatedShipping(product);
  const deliveredTotal = estimatedTotal(product);
  const value = pricePer100g(product);
  const warning = rankingWarning(product);

  return {
    category: normalizedCategory(product),
    retailer: product.retailer,
    image: product.image,
    product: product.product,
    productImage: product.productImage ?? null,
    sizeGrams: product.sizeGrams,
    price: product.price,
    rating: product.rating,
    reviewCount: product.reviewCount,
    shipping: product.shipping,
    deliveryAvailable: product.deliveryAvailable,
    source: product.source,
    fetchStatus: product.fetchStatus,
    fetchError: product.fetchError,
    confidence: product.confidence,
    updatedAt: product.updatedAt,
    available: isAvailable(product),
    estimatedShipping: shipping,
    deliveredTotal,
    pricePer100g: value,
    shippingConfidence: shippingConfidence(product),
    rankingEligible: warning === null,
    rankingWarning: warning,
  };
}

export function sortProducts(products, sort) {
  return [...products].sort((a, b) => {
    switch (sort) {
      case "total-desc":
        return shippingGroup(a) - shippingGroup(b) || estimatedTotal(b) - estimatedTotal(a);
      case "total-asc":
        return shippingGroup(a) - shippingGroup(b) || estimatedTotal(a) - estimatedTotal(b);
      case "price-desc":
        return b.price - a.price;
      case "price-asc":
        return a.price - b.price;
      case "size-desc":
        return b.sizeGrams - a.sizeGrams;
      case "size-asc":
        return a.sizeGrams - b.sizeGrams;
      case "value-desc":
        return (
          rankingGroup(a) - rankingGroup(b) ||
          pricePer100g(b) - pricePer100g(a) ||
          estimatedTotal(a) - estimatedTotal(b) ||
          b.sizeGrams - a.sizeGrams ||
          new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0)
        );
      case "value":
      default:
        return valueTieBreak(a, b);
    }
  });
}

export async function productsPayload(url) {
  const dataset = await readProductDataset();
  const includeUnavailable = url.searchParams.get("includeUnavailable") === "true";
  const category = normalizedRequestedCategory(url.searchParams.get("category"));
  const sort = url.searchParams.get("sort") ?? "value";
  const allProducts = dataset.products ?? [];
  const categoryProducts = category
    ? allProducts.filter((product) => normalizedCategory(product) === category)
    : allProducts;
  const filteredProducts = includeUnavailable ? categoryProducts : categoryProducts.filter(isAvailable);
  const products = sortProducts(filteredProducts, sort).map(publicProduct);
  const byCategory = allProducts.reduce((counts, product) => {
    const key = normalizedCategory(product);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return {
    source: dataset.source,
    refreshedAt: dataset.refreshedAt ?? null,
    discoveryRefreshedAt: dataset.discoveryRefreshedAt ?? null,
    category: category ?? null,
    products,
    counts: {
      total: allProducts.length,
      categoryTotal: categoryProducts.length,
      returned: products.length,
      available: categoryProducts.filter(isAvailable).length,
      unavailable: categoryProducts.filter((product) => !isAvailable(product)).length,
      byCategory,
    },
  };
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function productForSourceUrl(sourceUrl) {
  const source = canonicalUrl(sourceUrl);
  if (!source) return null;

  try {
    const cache = await readProductsCache();
    const cachedProduct = (cache.products ?? []).find((product) => canonicalUrl(product.source) === source);
    if (cachedProduct) return cachedProduct;
  } catch {
    // Continue to the active dataset below.
  }

  const dataset = await readProductDataset();
  return (dataset.products ?? []).find((product) => canonicalUrl(product.source) === source) ?? null;
}

async function emptyPriceHistoryPayload(sourceUrl) {
  const product = await productForSourceUrl(sourceUrl);
  if (!product) return { status: 404, payload: { error: "Product not found", points: [] } };

  return {
    status: 200,
    payload: {
      product: {
        sourceUrl: product.source,
        product: product.product,
        retailer: product.retailer,
        category: product.category ?? "creatine",
      },
      points: [],
    },
  };
}

export async function priceHistoryPayload(url) {
  const sourceUrl = url.searchParams.get("sourceUrl");
  if (!sourceUrl) return { status: 400, payload: { error: "Missing sourceUrl" } };

  let products = [];
  try {
    products =
      (await supabaseRequest(
        `/products?select=id,source_url,product_name,retailer,category&source_url=eq.${encodeURIComponent(
          sourceUrl,
        )}&limit=1`,
        { method: "GET" },
      )) ?? [];
  } catch (error) {
    console.warn(`Supabase price history product lookup failed: ${error.message}`);
    return emptyPriceHistoryPayload(sourceUrl);
  }

  const product = products[0];
  if (!product) return emptyPriceHistoryPayload(sourceUrl);

  const rows =
    (await supabaseRequest(
      `/price_history?select=observed_at,item_price,price_per_100g&product_id=eq.${product.id}&order=observed_at.asc&limit=240`,
      { method: "GET" },
    )) ?? [];

  return {
    status: 200,
    payload: {
      product: {
        sourceUrl: product.source_url,
        product: product.product_name,
        retailer: product.retailer,
        category: product.category,
      },
      points: rows.map((row) => ({
        observedAt: row.observed_at,
        itemPrice: Number(row.item_price),
        pricePer100g: Number(row.price_per_100g),
      })),
    },
  };
}

export async function statusPayload() {
  const dataset = await readProductDataset();
  const refresh = await refreshOperationsPayload();
  const products = dataset.products ?? [];
  const available = products.filter(isAvailable).length;
  const unavailable = products.length - available;
  const statusCounts = products.reduce((counts, product) => {
    const status = product.fetchStatus ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const categoryCounts = products.reduce((counts, product) => {
    const category = product.category ?? "creatine";
    const current = counts[category] ?? { total: 0, available: 0, unavailable: 0 };
    current.total += 1;
    if (isAvailable(product)) current.available += 1;
    else current.unavailable += 1;
    counts[category] = current;
    return counts;
  }, {});

  return {
    source: dataset.source,
    refreshedAt: dataset.refreshedAt ?? null,
    discoveryRefreshedAt: dataset.discoveryRefreshedAt ?? null,
    refreshIntervalMs: env().refreshMs,
    products: {
      total: products.length,
      available,
      unavailable,
      byFetchStatus: statusCounts,
      byCategory: categoryCounts,
    },
    lastRefresh: globalThis.__stackscoutLastRefreshSummary ?? null,
    refresh,
  };
}

export async function healthPayload() {
  const refresh = await refreshOperationsPayload();
  return {
    ok: true,
    service: "stackscout",
    version: await readPackageVersion(),
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    runtime: env().isVercel ? "vercel" : "node",
    rateLimitBackend: upstashEnabled() ? "upstash" : "memory",
    adminAuthConfigured: Boolean(env().adminToken),
    cronConfigured: Boolean(env().cronSecret),
    refresh: {
      scheduler: refresh.scheduler,
      stale: refresh.stale,
      staleAfterMs: refresh.staleAfterMs,
      lastSuccessFinishedAt: refresh.lastSuccess?.finished_at ?? null,
      lastSuccessAgeMs: refresh.lastSuccessAgeMs,
      source: refresh.source,
      error: refresh.error,
    },
  };
}

export async function outboundClickResponse(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const missingBackend = requireProductionRateLimitBackend();
  if (missingBackend) return missingBackend;
  const allowed = await rateLimitAny(request, [
    { key: "outbound-click:min", max: 120, windowMs: 60_000 },
    { key: "outbound-click:hour", max: 500, windowMs: 60 * 60_000 },
  ]);
  if (!allowed) return jsonResponse({ error: "Too many events" }, 429);

  const payload = await request.json();
  const product = await productForSourceUrl(payload.sourceUrl);
  if (!product) return jsonResponse({ recorded: false, reason: "unknown_product" }, 202);

  try {
    const result = await recordOutboundClick(payload, product, { ipHash: rateLimitId(request) });
    if (!result.recorded) {
      return jsonResponse({ recorded: false, reason: result.reason ?? "disabled" }, 202);
    }
    return emptyResponse(204);
  } catch (error) {
    console.warn(`Outbound click tracking failed: ${error.message}`);
    return jsonResponse({ recorded: false, reason: "tracking_unavailable" }, 202);
  }
}

export async function analyticsEventResponse(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const missingBackend = requireProductionRateLimitBackend();
  if (missingBackend) return missingBackend;
  const allowed = await rateLimitAny(request, [
    { key: "analytics:min", max: 240, windowMs: 60_000 },
    { key: "analytics:hour", max: 2_000, windowMs: 60 * 60_000 },
  ]);
  if (!allowed) return jsonResponse({ error: "Too many analytics events" }, 429);

  try {
    const result = await recordAnalyticsEvent(await request.json(), { ipHash: rateLimitId(request) });
    if (!result.recorded) {
      return jsonResponse({ recorded: false, reason: result.reason ?? "disabled" }, 202);
    }
    return emptyResponse(204);
  } catch (error) {
    console.warn(`Analytics event tracking failed: ${error.message}`);
    return jsonResponse({ recorded: false, reason: "tracking_unavailable" }, 202);
  }
}

export async function feedbackResponse(request) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const missingBackend = requireProductionRateLimitBackend();
  if (missingBackend) return missingBackend;
  const allowed = await rateLimitAny(request, [
    { key: "feedback:10min", max: 3, windowMs: 10 * 60_000 },
    { key: "feedback:day", max: 20, windowMs: 24 * 60 * 60_000 },
  ]);
  if (!allowed) return jsonResponse({ error: "Too many feedback reports" }, 429);

  try {
    const result = await recordFeedback(await request.json());
    if (!result.recorded) {
      return jsonResponse({ recorded: false, reason: result.reason ?? "invalid_feedback" }, 400);
    }
    return jsonResponse({ recorded: true }, 201);
  } catch (error) {
    console.warn(`Feedback recording failed: ${error.message}`);
    return jsonResponse({ recorded: false, reason: "feedback_unavailable" }, 202);
  }
}

export async function statsPayload() {
  try {
    return await readAnalyticsStats();
  } catch {
    return {
      enabled: false,
      error: "Stats unavailable. Run the latest Supabase schema and check server credentials.",
    };
  }
}
