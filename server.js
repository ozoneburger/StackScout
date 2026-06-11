import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { loadEnv } from "./scripts/env.js";
import { discoverProducts } from "./scripts/discover-products.js";
import { refreshProducts } from "./scripts/fetch-products.js";
import { recordAnalyticsEvent, recordOutboundClick } from "./scripts/supabase-events.js";
import { recordFeedback } from "./scripts/supabase-feedback.js";
import { supabaseRequest } from "./scripts/supabase-history.js";
import { readProductsFromSupabase } from "./scripts/supabase-products.js";
import { readAnalyticsStats } from "./scripts/supabase-stats.js";

loadEnv();

const port = Number(process.env.PORT ?? 4173);
const refreshMs = Number(process.env.REFRESH_MS ?? 24 * 60 * 60 * 1000);
const adminToken = process.env.ADMIN_TOKEN ?? null;
const cronSecret = process.env.CRON_SECRET ?? null;
const upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "") ?? null;
const upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
const isVercel = process.env.VERCEL === "1";
const root = process.cwd();
const productsCachePath = join(root, "data", "products.json");
let lastRefreshSummary = null;
let packageVersion = "0.0.0";
let activeRefresh = null;
const publicFiles = new Set(["/index.html", "/stats.html", "/assets/favicon.svg"]);
const publicDirectories = ["/assets/", "/src/"];
const rateLimits = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function safePath(urlPath) {
  let cleanPath;
  try {
    cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const requestedPath = cleanPath === "/" ? "/index.html" : cleanPath;
  const normalizedRequestPath = normalize(requestedPath);
  if (
    !publicFiles.has(normalizedRequestPath) &&
    !publicDirectories.some((directory) => normalizedRequestPath.startsWith(directory))
  ) {
    return null;
  }
  const filePath = normalize(join(root, normalizedRequestPath));
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function emptyResponse(response, status) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  response.end();
}

function securityHeaders() {
  return {
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' https: http: data:; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function requestToken(request, url) {
  const auth = request.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return (
    request.headers["x-admin-token"] ??
    url.searchParams.get("admin_token") ??
    parseCookies(request.headers.cookie).stackscout_admin ??
    null
  );
}

function isAdminRequest(request, url) {
  if (!adminToken) return !isVercel;
  return requestToken(request, url) === adminToken;
}

function adminCookieHeader(request) {
  const secure = request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `stackscout_admin=${encodeURIComponent(adminToken)}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

function redirectTo(response, location, headers = {}) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    ...securityHeaders(),
    ...headers,
  });
  response.end();
}

function permanentRedirectTo(response, location) {
  response.writeHead(308, {
    Location: location,
    "Cache-Control": "public, max-age=3600",
    ...securityHeaders(),
  });
  response.end();
}

function forbiddenJson(response) {
  jsonResponse(response, 401, { error: "Admin token required" });
}

function forbiddenHtml(response) {
  response.writeHead(401, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  response.end("Admin token required");
}

function clientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return request.socket.remoteAddress ?? "unknown";
}

function rateLimitId(request) {
  return createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 24);
}

function upstashEnabled() {
  return Boolean(upstashRedisUrl && upstashRedisToken);
}

function requireProductionRateLimitBackend(response) {
  if (!isVercel || upstashEnabled()) return true;
  jsonResponse(response, 503, {
    error: "Production rate limiting is not configured",
    requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  });
  return false;
}

async function upstashPipeline(commands) {
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

async function readJsonBody(request, maxBytes = 8192) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) {
      throw new Error("Request body too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

async function readProductsCache() {
  return JSON.parse(await readFile(productsCachePath, "utf8"));
}

async function readPackageVersion() {
  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    packageVersion = packageJson.version ?? packageVersion;
  } catch {
    packageVersion = "0.0.0";
  }
}

async function readProductDataset() {
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

function isAvailable(product) {
  return product.available !== false && product.fetchStatus !== "unavailable";
}

function estimatedShipping(product) {
  if (!product.deliveryAvailable) return null;
  if (!product.shipping) return null;
  if (product.shipping.freeThreshold !== null && product.price >= product.shipping.freeThreshold) return 0;
  return Number.isFinite(product.shipping.cost) ? product.shipping.cost : null;
}

function estimatedTotal(product) {
  const shipping = estimatedShipping(product);
  return shipping === null ? product.price : product.price + shipping;
}

function pricePer100g(product) {
  return (estimatedTotal(product) / product.sizeGrams) * 100;
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

function rankingEligible(product) {
  return rankingWarning(product) === null;
}

function rankingGroup(product) {
  return rankingEligible(product) ? 0 : 1;
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

function publicProduct(product) {
  const shipping = estimatedShipping(product);
  const deliveredTotal = estimatedTotal(product);
  const value = pricePer100g(product);
  const warning = rankingWarning(product);

  return {
    category: product.category ?? "creatine",
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

function sortProducts(products, sort) {
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

async function productForSourceUrl(sourceUrl) {
  const source = canonicalUrl(sourceUrl);
  if (!source) return null;
  const dataset = await readProductDataset();
  return (dataset.products ?? []).find((product) => canonicalUrl(product.source) === source) ?? null;
}

async function serveProductsApi(url, response) {
  const dataset = await readProductDataset();
  const includeUnavailable = url.searchParams.get("includeUnavailable") === "true";
  const category = url.searchParams.get("category");
  const sort = url.searchParams.get("sort") ?? "value";
  const allProducts = dataset.products ?? [];
  const categoryProducts = category
    ? allProducts.filter((product) => (product.category ?? "creatine") === category)
    : allProducts;
  const filteredProducts = includeUnavailable ? categoryProducts : categoryProducts.filter(isAvailable);
  const products = sortProducts(filteredProducts, sort).map(publicProduct);
  const byCategory = allProducts.reduce((counts, product) => {
    const key = product.category ?? "creatine";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  jsonResponse(response, 200, {
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
  });
}

async function servePriceHistoryApi(url, response) {
  const sourceUrl = url.searchParams.get("sourceUrl");
  if (!sourceUrl) {
    jsonResponse(response, 400, { error: "Missing sourceUrl" });
    return;
  }

  const products =
    (await supabaseRequest(
      `/products?select=id,source_url,product_name,retailer,category&source_url=eq.${encodeURIComponent(
        sourceUrl,
      )}&limit=1`,
      { method: "GET" },
    )) ?? [];
  const product = products[0];
  if (!product) {
    jsonResponse(response, 404, { error: "Product not found", points: [] });
    return;
  }

  const rows =
    (await supabaseRequest(
      `/price_history?select=observed_at,item_price,price_per_100g&product_id=eq.${product.id}&order=observed_at.asc&limit=240`,
      { method: "GET" },
    )) ?? [];

  jsonResponse(response, 200, {
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
  });
}

async function serveStatusApi(response) {
  const dataset = await readProductDataset();
  const products = dataset.products ?? [];
  const available = products.filter(isAvailable).length;
  const unavailable = products.length - available;
  const statusCounts = products.reduce(
    (counts, product) => {
      const status = product.fetchStatus ?? "unknown";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const categoryCounts = products.reduce((counts, product) => {
    const category = product.category ?? "creatine";
    const current = counts[category] ?? { total: 0, available: 0, unavailable: 0 };
    current.total += 1;
    if (isAvailable(product)) current.available += 1;
    else current.unavailable += 1;
    counts[category] = current;
    return counts;
  }, {});

  jsonResponse(response, 200, {
    source: dataset.source,
    refreshedAt: dataset.refreshedAt ?? null,
    discoveryRefreshedAt: dataset.discoveryRefreshedAt ?? null,
    refreshIntervalMs: refreshMs,
    products: {
      total: products.length,
      available,
      unavailable,
      byFetchStatus: statusCounts,
      byCategory: categoryCounts,
    },
    lastRefresh: lastRefreshSummary,
  });
}

async function serveOutboundClickApi(request, response) {
  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }
  if (!requireProductionRateLimitBackend(response)) return;
  if (
    !(await rateLimitAny(request, [
      { key: "outbound-click:min", max: 120, windowMs: 60_000 },
      { key: "outbound-click:hour", max: 500, windowMs: 60 * 60_000 },
    ]))
  ) {
    jsonResponse(response, 429, { error: "Too many events" });
    return;
  }

  const payload = await readJsonBody(request);
  const product = await productForSourceUrl(payload.sourceUrl);
  if (!product) {
    jsonResponse(response, 202, { recorded: false, reason: "unknown_product" });
    return;
  }
  let result;
  try {
    result = await recordOutboundClick(payload, product, { ipHash: rateLimitId(request) });
  } catch (error) {
    console.warn(`Outbound click tracking failed: ${error.message}`);
    jsonResponse(response, 202, { recorded: false, reason: "tracking_unavailable" });
    return;
  }
  if (!result.recorded) {
    jsonResponse(response, 202, { recorded: false, reason: result.reason ?? "disabled" });
    return;
  }
  emptyResponse(response, 204);
}

async function serveAnalyticsEventApi(request, response) {
  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }
  if (!requireProductionRateLimitBackend(response)) return;
  if (
    !(await rateLimitAny(request, [
      { key: "analytics:min", max: 240, windowMs: 60_000 },
      { key: "analytics:hour", max: 2_000, windowMs: 60 * 60_000 },
    ]))
  ) {
    jsonResponse(response, 429, { error: "Too many analytics events" });
    return;
  }

  const payload = await readJsonBody(request);
  let result;
  try {
    result = await recordAnalyticsEvent(payload, { ipHash: rateLimitId(request) });
  } catch (error) {
    console.warn(`Analytics event tracking failed: ${error.message}`);
    jsonResponse(response, 202, { recorded: false, reason: "tracking_unavailable" });
    return;
  }
  if (!result.recorded) {
    jsonResponse(response, 202, { recorded: false, reason: result.reason ?? "disabled" });
    return;
  }
  emptyResponse(response, 204);
}

async function serveFeedbackApi(request, response) {
  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }
  if (!requireProductionRateLimitBackend(response)) return;
  if (
    !(await rateLimitAny(request, [
      { key: "feedback:10min", max: 3, windowMs: 10 * 60_000 },
      { key: "feedback:day", max: 20, windowMs: 24 * 60 * 60_000 },
    ]))
  ) {
    jsonResponse(response, 429, { error: "Too many feedback reports" });
    return;
  }

  const payload = await readJsonBody(request, 12_000);
  let result;
  try {
    result = await recordFeedback(payload);
  } catch (error) {
    console.warn(`Feedback recording failed: ${error.message}`);
    jsonResponse(response, 202, { recorded: false, reason: "feedback_unavailable" });
    return;
  }

  if (!result.recorded) {
    jsonResponse(response, 400, { recorded: false, reason: result.reason ?? "invalid_feedback" });
    return;
  }
  jsonResponse(response, 201, { recorded: true });
}

async function serveStatsApi(response) {
  try {
    jsonResponse(response, 200, await readAnalyticsStats());
  } catch (error) {
    jsonResponse(response, 200, {
      enabled: false,
      error: "Stats unavailable. Run the latest Supabase schema and check server credentials.",
    });
  }
}

function refreshStatePayload() {
  return {
    running: Boolean(activeRefresh),
    lastRefresh: lastRefreshSummary,
  };
}

function triggerRefresh(reason) {
  if (activeRefresh) return false;
  activeRefresh = refreshSafely(reason).finally(() => {
    activeRefresh = null;
  });
  return true;
}

async function runRefreshNow(reason) {
  if (activeRefresh) {
    return { started: false, error: "Refresh already running", ...refreshStatePayload() };
  }
  activeRefresh = refreshSafely(reason).finally(() => {
    activeRefresh = null;
  });
  const result = await activeRefresh;
  return { started: true, running: false, lastRefresh: result };
}

function serveHealthApi(response) {
  jsonResponse(response, 200, {
    ok: true,
    service: "stackscout",
    version: packageVersion,
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    runtime: isVercel ? "vercel" : "node",
    rateLimitBackend: upstashEnabled() ? "upstash" : "memory",
    adminAuthConfigured: Boolean(adminToken),
  });
}

async function createRefreshRun(reason) {
  try {
    const rows = await supabaseRequest("/refresh_runs", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        reason,
        status: "running",
        metadata: {
          refreshIntervalMs: refreshMs,
        },
      }),
    });
    return rows?.[0]?.id ?? null;
  } catch (error) {
    console.warn(`Refresh run tracking unavailable: ${error.message}`);
    return null;
  }
}

async function finishRefreshRun(id, row) {
  if (!id) return;
  try {
    await supabaseRequest(`/refresh_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...row,
        finished_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn(`Refresh run update failed: ${error.message}`);
  }
}

async function serveApi(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  try {
    if (url.pathname === "/api/cron/refresh") {
      if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
        jsonResponse(response, 401, { error: "Cron secret required" });
        return true;
      }
      if (request.method !== "GET" && request.method !== "POST") {
        jsonResponse(response, 405, { error: "Method not allowed" });
        return true;
      }
      const result = await runRefreshNow("cron");
      jsonResponse(response, result.started ? 200 : 409, result);
      return true;
    }
    if (url.pathname === "/api/products") {
      await serveProductsApi(url, response);
      return true;
    }
    if (url.pathname === "/api/price-history") {
      await servePriceHistoryApi(url, response);
      return true;
    }
    if (url.pathname === "/api/health") {
      serveHealthApi(response);
      return true;
    }
    if (url.pathname === "/api/status") {
      if (!isAdminRequest(request, url)) {
        forbiddenJson(response);
        return true;
      }
      await serveStatusApi(response);
      return true;
    }
    if (url.pathname === "/api/events/outbound-click") {
      await serveOutboundClickApi(request, response);
      return true;
    }
    if (url.pathname === "/api/events/analytics") {
      await serveAnalyticsEventApi(request, response);
      return true;
    }
    if (url.pathname === "/api/feedback") {
      await serveFeedbackApi(request, response);
      return true;
    }
    if (url.pathname === "/api/stats") {
      if (!isAdminRequest(request, url)) {
        forbiddenJson(response);
        return true;
      }
      await serveStatsApi(response);
      return true;
    }
    if (url.pathname === "/api/internal/refresh") {
      if (!isAdminRequest(request, url)) {
        forbiddenJson(response);
        return true;
      }
      if (request.method !== "POST") {
        jsonResponse(response, 405, { error: "Method not allowed" });
        return true;
      }
      if (isVercel) {
        const result = await runRefreshNow("manual");
        jsonResponse(response, result.started ? 200 : 409, result);
        return true;
      }
      if (!triggerRefresh("manual")) {
        jsonResponse(response, 409, { error: "Refresh already running", ...refreshStatePayload() });
        return true;
      }
      jsonResponse(response, 202, { started: true, ...refreshStatePayload() });
      return true;
    }
    if (url.pathname.startsWith("/api/")) {
      jsonResponse(response, 404, { error: "API route not found" });
      return true;
    }
    return false;
  } catch (error) {
    jsonResponse(response, 500, { error: error.message });
    return true;
  }
}

async function serve(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.hostname === "www.stackscout.co.nz") {
    permanentRedirectTo(response, `https://stackscout.co.nz${url.pathname}${url.search}`);
    return;
  }

  if (await serveApi(request, response)) return;

  if (url.pathname === "/stats.html") {
    if (adminToken && url.searchParams.get("admin_token") === adminToken) {
      redirectTo(response, "/stats.html", { "Set-Cookie": adminCookieHeader(request) });
      return;
    }
    if (!isAdminRequest(request, url)) {
      forbiddenHtml(response);
      return;
    }
  }

  const filePath = safePath(request.url ?? "/");
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    const headers = {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    };
    response.writeHead(200, headers);
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function refreshSafely(reason) {
  const runId = await createRefreshRun(reason);
  try {
    const seedProducts = isVercel ? (await readProductDataset()).products : null;
    const discovery = await discoverProducts({ products: seedProducts, writeCache: !isVercel });
    const result = await refreshProducts({ products: discovery.products, writeCache: !isVercel });
    const failedRetailers = (discovery.retailers ?? []).filter((retailer) => retailer.error);
    lastRefreshSummary = {
      ok: true,
      reason,
      checkedAt: new Date().toISOString(),
      discovered: discovery.added,
      failedRetailers: failedRetailers.length,
      discoverySupabase: discovery.supabase,
      total: result.total,
      live: result.live,
      supabase: result.supabase,
    };
    await finishRefreshRun(runId, {
      status: "success",
      discovered_count: discovery.added,
      total_products: result.total,
      live_products: result.live,
      history_rows: result.supabase.historyRows ?? 0,
      availability_rows: result.supabase.availabilityRows ?? 0,
      supabase_enabled: result.supabase.enabled === true,
      error_message: result.supabase.error ?? null,
      metadata: {
        discoverySupabase: discovery.supabase,
        failedRetailers,
      },
    });
    const history = result.supabase.enabled
      ? result.supabase.error
        ? `, Supabase write failed: ${result.supabase.error}`
        : `, wrote ${result.supabase.historyRows} price history rows and ${result.supabase.availabilityRows ?? 0} availability rows`
      : ", Supabase disabled";
    console.log(
      `[${new Date().toISOString()}] ${reason}: discovered ${discovery.added} new products, refreshed ${result.live}/${result.total} live products${history}`,
    );
    return lastRefreshSummary;
  } catch (error) {
    lastRefreshSummary = {
      ok: false,
      reason,
      checkedAt: new Date().toISOString(),
      error: error.message,
    };
    await finishRefreshRun(runId, {
      status: "failed",
      error_message: error.message,
    });
    console.error(`[${new Date().toISOString()}] ${reason}: refresh failed`, error);
    return lastRefreshSummary;
  }
}

await readPackageVersion();

export { serve };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer(serve).listen(port, () => {
    console.log(`Creatine Compare running at http://localhost:${port}`);
    console.log(`Product data refresh interval: ${Math.round(refreshMs / (60 * 60 * 1000))} hours`);
    triggerRefresh("startup");
    setInterval(() => triggerRefresh("scheduled"), refreshMs);
  });
}
