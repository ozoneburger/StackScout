# StackScout Launch Plan

This is the MVP launch checklist for getting StackScout onto `stackscout.co.nz` with enough trust, data, and feedback collection to learn from real users.

## Launch Goal

Launch a useful NZ supplement comparison site for creatine, whey/isolate protein, and pre-workout. The goal is not to claim every product is covered. The launch claim should be:

> StackScout checks NZ-accessible supplement retailers daily where possible, compares available products by estimated delivered cost, and helps users build a basic stack for less.

## Production Shape

- Host the server and frontend together so `/api/products`, `/api/stats`, `/api/feedback`, and static files share the same domain.
- Deploy through Vercel using `api/index.js` and `vercel.json`.
- Point `stackscout.co.nz` to the deployed Vercel app through Metaname DNS.
- Store environment variables securely:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_TOKEN`
  - `CRON_SECRET`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `REFRESH_MS=86400000` for local/server refresh cadence only
- Run the scraper daily through Vercel Cron at `/api/cron/refresh`, not from a laptop.
- Keep `data/products.json` as a cache/fallback, but treat Supabase as the launch source of truth.
- Use Upstash in production; Vercel serverless instances cannot rely on in-memory rate limits.

## Pre-Launch Checks

- Run the latest `supabase/schema.sql`.
- Run `npm run discover`.
- Run `npm run fetch`.
- Check `/api/products?category=creatine`.
- Check `/api/products?category=protein`.
- Check `/api/products?category=pre_workout`.
- Check `/api/health`.
- Check `/api/stats` with the admin token.
- Trigger `POST /api/internal/refresh` with the admin token and confirm it returns `202` locally or `200` on Vercel.
- Trigger `GET /api/cron/refresh` with `CRON_SECRET` and confirm it returns `200`.
- Submit one feedback report and confirm it reaches Supabase.
- Click a product link and confirm `outbound_clicks` records it.
- Switch category, change sort, and add to stack; confirm `analytics_events` records those events.
- Repeatedly click the same product link within 30 seconds; confirm later rows have `credible_click=false`.
- Confirm `refresh_runs` records the latest scraper run.
- Confirm public write endpoints return `429` after repeated test submissions, or verify Upstash counters move in the Upstash dashboard.

## Trust Rules

- Hide unavailable products by default.
- Do not let stale/manual products win top value positions without a visible warning.
- Show trust labels such as live price, checked today, shipping estimated, and stale data.
- Say "estimated delivered total", not final checkout price.
- Say "buyer-intent clicks" or "outbound clicks", not sales.

## Feedback Loop

For the first 4-6 weeks, collect feedback on:

- Missing stores
- Missing products
- Wrong prices
- Wrong stock state
- Whether My stack is useful
- Whether users trust the value ranking

Use feedback to decide the next retailer adapters before adding more visual features.

## Retailer Pitch Readiness

Do not pitch retailers until StackScout can show:

- Total outbound clicks
- Clicks by retailer
- Clicks by category
- Top clicked products
- Stack-originated clicks
- User feedback themes

The first pitch should be evidence-based:

> StackScout redirected X supplement shoppers to your product pages while they were comparing prices and building stacks.

## Not MVP Yet

- User accounts
- Checkout
- Sales attribution
- Sponsored placements
- Paid rankings
- Nutrition-adjusted protein value
- Per-serve pre-workout value
