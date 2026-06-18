import { supabaseConfig, supabaseRequest } from "./supabase-history.js";

const dayMs = 24 * 60 * 60 * 1000;
const trackedCategories = [
  "creatine",
  "whey_protein",
  "protein_isolate",
  "plant_based_protein",
  "mass_gainer",
  "protein_bars",
  "pre_workout",
  "non_stim_pre_workout",
  "electrolytes",
];
const trackedCategorySet = new Set(trackedCategories);

function normalizedCategory(category) {
  if (category === "protein") return "whey_protein";
  return trackedCategorySet.has(category) ? category : "unknown";
}

function emptyStats() {
  return {
    enabled: false,
    totalClicks: 0,
    credibleClicks: 0,
    duplicateClicks: 0,
    clicksLast7Days: 0,
    credibleClicksLast7Days: 0,
    clicksLast30Days: 0,
    pageViews: 0,
    stackAdds: 0,
    byRetailer: [],
    byRetailerCategory: [],
    byCategory: [],
    byProduct: [],
    byClickLocation: [],
    byEventType: [],
    byAnalyticsCategory: [],
    recentClicks: [],
  };
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function topEntries(map, limit = 10) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export async function readAnalyticsStats() {
  if (!supabaseConfig()) return emptyStats();

  const since = new Date(Date.now() - 30 * dayMs).toISOString();
  const rows =
    (await supabaseRequest(
      `/outbound_clicks?select=observed_at,retailer,product_name,category,click_location,source_url,credible_click&observed_at=gte.${encodeURIComponent(
        since,
      )}&order=observed_at.desc&limit=5000`,
      { method: "GET" },
    )) ?? [];
  const analyticsRows =
    (await supabaseRequest(
      `/analytics_events?select=observed_at,event_type,category&observed_at=gte.${encodeURIComponent(
        since,
      )}&order=observed_at.desc&limit=5000`,
      { method: "GET" },
    )) ?? [];

  const now = Date.now();
  const sevenDaysAgo = now - 7 * dayMs;
  const retailerMap = new Map();
  const retailerCategoryMap = new Map();
  const categoryMap = new Map();
  const productMap = new Map();
  const locationMap = new Map();
  const eventTypeMap = new Map();
  const analyticsCategoryMap = new Map();

  let clicksLast7Days = 0;
  let credibleClicksLast7Days = 0;
  let credibleClicks = 0;
  for (const row of rows) {
    const observedAt = new Date(row.observed_at).getTime();
    if (observedAt >= sevenDaysAgo) clicksLast7Days += 1;
    const credible = row.credible_click !== false;
    if (!credible) continue;
    credibleClicks += 1;
    if (observedAt >= sevenDaysAgo) credibleClicksLast7Days += 1;
    increment(retailerMap, row.retailer);
    if (row.retailer) {
      const current = retailerCategoryMap.get(row.retailer) ?? {
        retailer: row.retailer,
        total: 0,
        ...Object.fromEntries(trackedCategories.map((category) => [category, 0])),
        unknown: 0,
      };
      const category = normalizedCategory(row.category);
      current.total += 1;
      current[category] += 1;
      retailerCategoryMap.set(row.retailer, current);
    }
    increment(categoryMap, normalizedCategory(row.category));
    increment(productMap, `${row.product_name} | ${row.retailer}`);
    increment(locationMap, row.click_location);
  }
  for (const row of analyticsRows) {
    increment(eventTypeMap, row.event_type);
    increment(analyticsCategoryMap, normalizedCategory(row.category));
  }

  return {
    enabled: true,
    totalClicks: rows.length,
    credibleClicks,
    duplicateClicks: rows.length - credibleClicks,
    clicksLast7Days,
    credibleClicksLast7Days,
    clicksLast30Days: rows.length,
    pageViews: eventTypeMap.get("page_view") ?? 0,
    stackAdds: eventTypeMap.get("add_to_stack") ?? 0,
    byRetailer: topEntries(retailerMap),
    byRetailerCategory: [...retailerCategoryMap.values()].sort(
      (a, b) => b.total - a.total || a.retailer.localeCompare(b.retailer),
    ),
    byCategory: topEntries(categoryMap),
    byProduct: topEntries(productMap),
    byClickLocation: topEntries(locationMap),
    byEventType: topEntries(eventTypeMap),
    byAnalyticsCategory: topEntries(analyticsCategoryMap),
    recentClicks: rows.slice(0, 20).map((row) => ({
      observedAt: row.observed_at,
      retailer: row.retailer,
      productName: row.product_name,
      category: row.category,
      clickLocation: row.click_location,
      sourceUrl: row.source_url,
      credible: row.credible_click !== false,
    })),
  };
}
