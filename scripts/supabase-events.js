import { supabaseConfig, supabaseRequest } from "./supabase-history.js";

const duplicateWindowMs = 30_000;
const allowedClickLocations = new Set([
  "featured",
  "table-retailer",
  "table-product",
  "card-product",
  "stack-image",
  "stack-product",
  "stack-go",
]);
const allowedEventTypes = new Set([
  "page_view",
  "category_switch",
  "sort_change",
  "add_to_stack",
  "remove_from_stack",
  "stack_quantity_change",
]);

function cleanString(value, maxLength) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.href.slice(0, 1200);
  } catch {
    return null;
  }
}

function cleanCategory(value) {
  const category = cleanString(value, 40);
  if (["creatine", "protein", "pre_workout"].includes(category)) return category;
  return "unknown";
}

function cleanSessionId(value) {
  const sessionId = cleanString(value, 80);
  if (!sessionId || !/^[a-zA-Z0-9._:-]+$/.test(sessionId)) return null;
  return sessionId;
}

function cleanMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [cleanString(key, 60), cleanString(item, 240)])
      .filter(([key, item]) => key && item),
  );
}

function dedupeKey(context, row) {
  return [context?.ipHash ?? "unknown", row.source_url, row.click_location].join("|");
}

export function outboundClickRow(event, product, context = {}) {
  const sourceUrl = cleanUrl(product?.source);
  const retailer = cleanString(product?.retailer, 160);
  const productName = cleanString(product?.product, 260);
  const clickLocation = cleanString(event.clickLocation, 60);

  if (!sourceUrl || !retailer || !productName || !allowedClickLocations.has(clickLocation)) {
    return null;
  }

  const row = {
    source_url: sourceUrl,
    retailer,
    product_name: productName,
    category: cleanCategory(product?.category),
    click_location: clickLocation,
    page_path: cleanString(event.pagePath, 240),
    session_id: cleanSessionId(event.sessionId),
    ip_hash: cleanString(context.ipHash, 80),
  };
  row.dedupe_key = dedupeKey(context, row);
  return row;
}

async function isDuplicateClick(row) {
  const since = new Date(Date.now() - duplicateWindowMs).toISOString();
  const rows =
    (await supabaseRequest(
      `/outbound_clicks?select=id&dedupe_key=eq.${encodeURIComponent(
        row.dedupe_key,
      )}&observed_at=gte.${encodeURIComponent(since)}&limit=1`,
      { method: "GET" },
    )) ?? [];
  return rows.length > 0;
}

export async function recordOutboundClick(event, product, context = {}) {
  if (!supabaseConfig()) return { enabled: false, recorded: false };

  const row = outboundClickRow(event, product, context);
  if (!row) return { enabled: true, recorded: false, reason: "invalid_event" };
  row.credible_click = !(await isDuplicateClick(row));

  await supabaseRequest("/outbound_clicks", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  return { enabled: true, recorded: true, credible: row.credible_click };
}

export function analyticsEventRow(event, context = {}) {
  const eventType = cleanString(event.eventType, 60);
  if (!allowedEventTypes.has(eventType)) return null;

  return {
    event_type: eventType,
    category: cleanCategory(event.category),
    session_id: cleanSessionId(event.sessionId),
    ip_hash: cleanString(context.ipHash, 80),
    page_path: cleanString(event.pagePath, 240),
    metadata: cleanMetadata(event.metadata),
  };
}

export async function recordAnalyticsEvent(event, context = {}) {
  if (!supabaseConfig()) return { enabled: false, recorded: false };

  const row = analyticsEventRow(event, context);
  if (!row) return { enabled: true, recorded: false, reason: "invalid_event" };

  await supabaseRequest("/analytics_events", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  return { enabled: true, recorded: true };
}
