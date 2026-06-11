# StackScout YouTube MVP Checklist

Scope for this pass: YouTube only. No TikTok, Instagram, Reddit, retailer outreach, or broad launch work until Rob expands scope.

## Goal

Use YouTube to validate whether people care about StackScout: a NZ supplement price/stack tracker that compares real delivered cost, product freshness, and retailer links.

Primary question: can short useful YouTube demos create measurable buyer-intent traffic to StackScout product pages?

## Working assumptions

- Current app already supports creatine, protein, and pre-workout categories.
- YouTube work should be low-token and practical: scripts, demo checklist, analytics requirements, and upload plan.
- Product data must remain honest: no claim that StackScout finds the absolute best product unless the ranking evidence supports it.

## Checklist

### 1. Define the YouTube test offer

- [x] Pick the first YouTube angle: "Cheapest NZ creatine stack today"
- [x] Decide whether videos should say StackScout is a prototype/beta.
  - First video package uses `StackScout MVP` language and keeps shipping/data caveats explicit.
- [ ] Decide Rob's voice/personality: analytical, gym-bro practical, or build-in-public founder.
- [ ] Pick 3 repeatable video formats.

Recommended first formats:

1. Price check: "Cheapest creatine in NZ today according to StackScout"
2. Stack build: "Build a budget gym supplement stack in NZ"
3. Trust explainer: "Why supplement price comparison is harder than it looks"

### 2. Prepare StackScout for YouTube demos

- [x] Confirm the app can run locally without errors: `npm start`.
  - Verified 2026-06-05: local server responded `200` on `/` and `/api/products`.
- [x] Confirm product data refresh works: `npm run fetch`.
  - Verified 2026-06-05: refreshed 95/120 products; wrote 96 price history rows and 120 availability rows to Supabase.
  - Warning to fix later: Supabase products table is missing `category`; run `supabase/schema.sql` to enable category filtering in SQL.
- [ ] Confirm category tabs are visually clear on screen recording.
- [ ] Confirm outbound product links work.
- [ ] Add visible trust labels before publishing serious demos:
  - Live price / checked today
  - Shipping estimated
  - Stale price
  - Unavailable hidden
- [ ] Add or verify a clean demo route/state for screen recording.

### 3. Add minimum analytics before traffic tests

- [ ] Track YouTube campaign visits with UTM params.
- [ ] Track outbound retailer clicks.
- [ ] Track category switches.
- [ ] Track add-to-stack events.
- [ ] Keep analytics privacy-first; no user accounts needed for MVP.

Suggested UTM format:

```text
https://stackscout.co.nz/?utm_source=youtube&utm_medium=video&utm_campaign=creatine_mvp_001
```

### 4. First video script

- [x] Created first YouTube video script/package: [docs/youtube-video-001.md](youtube-video-001.md)

Working title: "Cheapest NZ Creatine Today? I Built a Tool to Check"

Hook:

> Creatine prices in New Zealand are messy once you include tub size, shipping, and stock. I built StackScout to compare the real delivered price instead of just the sticker price.

Body beats:

1. Show the problem: same product category, different tub sizes and shipping.
2. Open StackScout.
3. Filter to creatine.
4. Sort by price per 100g or delivered total.
5. Point out trust caveat: shipping is estimated, data is checked daily, stale products should not win.
6. Click the top product link to show it goes to the retailer.
7. Ask viewers what NZ stores/products are missing.

CTA:

> If you're in NZ and want me to add a store or product, comment it. The goal is not to hype a supplement; it's to make prices easier to compare.

### 5. Upload checklist

- [ ] Record 45-90 sec screen demo.
- [ ] Use title with NZ + creatine + price comparison.
- [ ] Put StackScout link first in description with YouTube UTM params.
- [ ] Pin a comment asking for missing retailers/products.
- [ ] Save video URL in this doc after upload.
- [ ] After 24-72 hours, record:
  - views
  - comments requesting stores/products
  - StackScout visits from YouTube
  - outbound retailer clicks

## Immediate next engineering tasks

Priority order for YouTube readiness:

1. Implement or verify outbound click tracking.
2. Add UTM-aware analytics capture.
3. Add trust labels if not already present.
4. Create a clean demo state for recording.
5. Run `npm start` and capture a demo screenshot/video path.

## Risks / blind spots

- YouTube traffic is weak evidence unless outbound retailer clicks are tracked.
- If stale or shipping-unknown products rank first, the demo can damage trust.
- A polished video before analytics is premature; first objective is learning, not branding.
- YouTube comments may identify missing products faster than scraper discovery, so feedback capture matters.
