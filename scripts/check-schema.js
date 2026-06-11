import { loadEnv } from "./env.js";

loadEnv();

const checks = [
  {
    name: "products.category",
    path: "/rest/v1/products?select=category&limit=1",
  },
  {
    name: "product_availability_history",
    path: "/rest/v1/product_availability_history?select=id&limit=1",
  },
  {
    name: "outbound_clicks",
    path: "/rest/v1/outbound_clicks?select=id&limit=1",
  },
  {
    name: "outbound_clicks.credible_click",
    path: "/rest/v1/outbound_clicks?select=credible_click&limit=1",
  },
  {
    name: "analytics_events",
    path: "/rest/v1/analytics_events?select=id&limit=1",
  },
  {
    name: "feedback_reports",
    path: "/rest/v1/feedback_reports?select=id&limit=1",
  },
  {
    name: "refresh_runs",
    path: "/rest/v1/refresh_runs?select=id&limit=1",
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  fail("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

let failed = false;
for (const check of checks) {
  const response = await fetch(`${url}${check.path}`, { headers });
  if (response.ok) {
    console.log(`OK ${check.name}`);
    continue;
  }

  failed = true;
  const body = await response.text();
  console.log(`MISSING ${check.name}: HTTP ${response.status} ${body}`);
}

if (failed) {
  console.log("\nRun npm run db:schema, or paste supabase/schema.sql into the Supabase SQL Editor.");
  process.exit(1);
}

console.log("Supabase schema looks current.");
