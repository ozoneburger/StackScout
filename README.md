# StackScout

A NZ supplement comparison app for comparing real delivered supplement costs across NZ-accessible retailers.

## What it does

- Compares NZ-accessible supplement products by price, size, estimated shipping, reviews, delivered total, and price per 100g.
- Supports creatine, whey protein, protein isolate, plant-based protein, mass gainer, protein bars, pre-workout, non-stim pre-workout, and electrolytes where usable data exists.
- Discovers products from enabled retailer adapters, then filters out unrelated formats such as capsules, bundles, samples, accessories, and category pollution.
- Sorts by best value, item price, pack size, delivered total, or highest price per 100g.
- Shows quality filters for unknown shipping, checked-today data, and stale data.
- Shows product images, trust labels, top-three podium badges, a featured carousel, load more results, and a local "My stack" basket.
- Stores the stack in browser local storage and tracks item subtotal plus estimated delivered stack total.
- Shows price-history charts when Supabase history exists for a product.
- Serves public product data through `/api/products`, with `data/products.json` kept as a local cache/fallback.
- Serves a lightweight production health check through `/api/health`.
- Serves admin-protected operational status through `/api/status`.
- Serves first-party click and product-event stats through `/api/stats` and the stats dashboard at `/stats` or `/stats.html`.
- Accepts missing-product and data-quality feedback through `/api/feedback` after the latest schema is applied.
- Refreshes product pages through a protected Vercel Cron endpoint in production.
- Keeps `npm run fetch` and `npm run discover` as local/manual repair tools.

## Public pages

- `/` - main StackScout comparison app, initially loaded with creatine.
- `/creatine`, `/protein`, `/pre-workout` - dynamic category landing pages with comparison data and SEO panels.
- `/best-creatine-nz`, `/cheap-creatine-nz`, `/where-to-buy-creatine-nz` - buyer-intent creatine comparison pages.
- `/about`, `/faq`, `/contact`, `/privacy`, `/disclaimer` - trust, support, and policy pages.
- `/robots.txt` and `/sitemap.xml` - search indexing controls for public pages.

## Run

```bash
npm run dev
```

Then open `http://localhost:3000`.

Check whether the local server is alive:

```bash
curl http://localhost:3000/api/health
```

Refresh product data once without starting the server:

```bash
npm run fetch
```

Discover products once without starting the server:

```bash
npm run discover
```

Build the Next.js app:

```bash
npm run build
```

## Supabase price history

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor, or use `npm run db:schema` once `DATABASE_URL` is set.
3. Copy `.env.example` to `.env`.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `DATABASE_URL`.
5. Set `ADMIN_TOKEN` in production to protect `/stats.html`, `/api/stats`, and `/api/status`.
6. Set `CRON_SECRET` in production to protect `/api/cron/refresh`.
7. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production for shared rate limits.
8. Run `npm run db:check`.
9. Deploy to Vercel production so `vercel.json` can register the cron job.

When Supabase env vars are present, discovery upserts products, and refresh writes current product state plus price and availability history for available products.

The schema also creates `outbound_clicks`, `analytics_events`, `feedback_reports`, and `refresh_runs` for MVP analytics, feedback collection, and scraper run tracking. Re-run the schema after pulling changes that add new tables or analytics columns.

Apply the latest schema from the terminal:

```bash
npm run db:schema
```

Check whether Supabase has the required tables/columns:

```bash
npm run db:check
```

Trigger a protected product refresh:

```bash
curl -X POST https://stackscout.co.nz/api/internal/refresh \
  -H "Authorization: Bearer [LONG_RANDOM_ADMIN_TOKEN]"
```

Trigger the Vercel cron refresh endpoint manually:

```bash
curl https://stackscout.co.nz/api/cron/refresh \
  -H "Authorization: Bearer [LONG_RANDOM_CRON_SECRET]"
```

## Production refresh workflow

Production refreshes should be owned by Vercel Cron, not Codex or a developer laptop.

Current production path:

```text
Vercel Cron -> /api/cron/refresh -> discoverProducts -> refreshProducts -> Supabase
```

The schedule is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh",
      "schedule": "0 16 * * *"
    }
  ]
}
```

That runs once per day at 16:00 UTC. Vercel Cron invokes production deployments only. The cron route requires `Authorization: Bearer [LONG_RANDOM_CRON_SECRET]`, so `CRON_SECRET` must be set in Vercel production.

Operational checks:

- `/api/health` exposes whether cron auth is configured and whether the last successful refresh is stale.
- `/api/status` is admin-protected and includes the latest `refresh_runs` row plus the latest successful run.
- `refresh_runs` in Supabase is the durable audit log for scraper runs.

Manual tools:

- `npm run discover` updates local `data/products.json` from retailer discovery.
- `npm run fetch` refreshes local `data/products.json` prices and writes Supabase history when Supabase env vars are set.
- Use those scripts for local debugging or manual repair, not as the daily production scheduler.

Open the protected stats dashboard in production by visiting:

```bash
https://stackscout.co.nz/stats.html?admin_token=[LONG_RANDOM_ADMIN_TOKEN]
```

The server stores the token in an HttpOnly cookie and redirects to `/stats.html`.

`/api/status` uses the same admin token in production and reports product counts, fetch-status counts, category counts, and the latest refresh-run metadata.

## Rate limiting

Public write endpoints are rate-limited:

- `/api/events/outbound-click`: 120/minute/IP and 500/hour/IP.
- `/api/events/analytics`: 240/minute/IP and 2,000/hour/IP.
- `/api/feedback`: 3/10 minutes/IP and 20/day/IP.

When Upstash env vars are set, limits are shared across deploys and server instances. On Vercel production, public write endpoints require Upstash env vars and return `503` if they are missing. Locally, the app falls back to in-memory limits for development and basic MVP protection. IP addresses are hashed before being used as rate-limit keys.

Outbound clicks are stored as raw events and marked with `credible_click=false` when the same IP hash clicks the same product from the same location within 30 seconds. The stats dashboard reports both raw and credible clicks.

`npm run db:schema` requires `DATABASE_URL` and the `psql` command-line client. If those are not available, paste `supabase/schema.sql` into the Supabase SQL Editor instead.

## Data notes

The app uses lightweight HTTP fetches against retailer product pages. If a fetch fails or returns an implausible value, the app keeps the last-known-good saved data and marks the row as stale.

Current coverage snapshot:

- Local cache audit on 2026-06-16: 297 tracked products, 262 displayed available products, 35 hidden unavailable products, 13 retailers with displayed products, and 12 enabled automated discovery configs.
- Running Supabase-backed local API on 2026-06-17 returned 299 total products and 54 available creatine products.
- Categories with real rows: creatine, whey protein, protein isolate, plant-based protein, mass gainer, protein bars, pre-workout, non-stim pre-workout, and electrolytes.
- Known low-confidence coverage: BN Healthy has no displayed products; iHerb NZ remains a manual/stale fallback because server-side fetching is blocked.

Chemist Warehouse currently uses a retailer search adapter for discovery plus the shared product refresh parser. The refresh parser checks JSON-LD product data first, then Open Graph/product meta tags, then simple price patterns. This avoids browser automation, but retailer markup changes can still break parsing.

Shipping thresholds are still configured manually because product pages rarely expose reliable checkout data.

Sportsfuel uses Shopify product JSON, so the fetcher selects the configured 1kg variant from its live variant list. iHerb currently blocks server-side HTTP fetching with a Cloudflare challenge, so it needs an approved API/feed, affiliate data source, or manual last-known-good fallback.

The MVP value formula is still estimated delivered price per 100g:

```text
delivered_total = item_price + estimated_shipping
price_per_100g = delivered_total / size_grams * 100
```

That is useful for powders and tubs, but weaker for protein bars, electrolytes, and pre-workout. Future category-specific ranking should use better evidence when available, such as cost per protein gram, cost per serve, or active-ingredient-aware comparisons.

Use Playwright only for retailers that require rendered JavaScript and do not expose stable JSON/product metadata. It is slower, heavier to host, easier to block, and needs stricter timeout/retry controls.

## Scraping strategy

The durable scraping plan lives in `docs/scraping-strategy.md`.

The MVP launch checklist lives in `docs/launch-plan.md`.

The current retailer coverage dashboard lives in `docs/retailer-dashboard.md`.

SEO planning docs live in `docs/seo/`.

Retailer definitions live in `scripts/retailer-config.js`. Discovery should only run configs that are enabled and supported by the current adapter code.

Source priority:

1. Official retailer/API feed
2. Platform adapter, such as Shopify or WooCommerce
3. JSON-LD/schema.org Product and Offer
4. Generic HTML adapter
5. Playwright rendered-page adapter
6. Manual fallback or review queue

AI/classification can help with ambiguous products, but price and availability must come from deterministic scraper evidence.
