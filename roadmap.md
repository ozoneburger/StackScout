# StackScout Roadmap

## Status Key

- ✅ Already built
- 🟡 Partially built
- No icon: not implemented yet

## Vision

StackScout is a NZ supplement price checker for people building a basic supplement stack. The MVP focuses on the three most common stack categories:

- Creatine
- Whey and whey isolate protein powder
- Pre-workout

The product goal is to help users compare real supplement costs, understand why a product is ranked as good value, build a simple stack, and click through to the retailer that best fits their budget.

The business goal is to prove StackScout can send measurable purchase-intent traffic to NZ supplement retailers. Once there is evidence, the next step is to approach retailers with a clear pitch: StackScout has redirected real users to their product pages, which creates value that could support affiliate links, sponsored placements, retailer feeds, coupon codes, or ads.

## MVP Status

- ✅ Creatine comparison
- ✅ Multiple NZ-accessible retailers
- ✅ Product discovery from supported retailer adapters
- 🟡 Daily product refresh: implemented and scheduled, but production freshness needs verification.
- ✅ Supabase product, price, and availability history
- ✅ Public product API
- ✅ Product images with fallback placeholder
- ✅ Product links to retailer pages
- ✅ Retailer links to product pages
- ✅ Featured products panel
- ✅ Top-three value podium
- ✅ Sort by item price, delivered total, pack size, and price per 100g
- ✅ Basic best-value ranking by estimated delivered price per 100g
- ✅ Load more results
- ✅ My stack basket
- ✅ My stack product links
- ✅ First-party outbound click tracking
- ✅ Local stats dashboard
- ✅ Product trust labels
- ✅ Feedback form UI and API
- ✅ Launch plan document
- 🟡 Retailer coverage: popular NZ-accessible stores are included, but coverage is not complete across all target categories.
- ✅ Category switching for creatine, whey protein, and pre-workout
- ✅ Whey and whey isolate discovery v1
- ✅ Pre-workout discovery v1
- 🟡 Protein and pre-workout coverage: real product data now exists, but coverage is not yet complete across the target retailers.
- ✅ Launch backend: Vercel deployment, Supabase-backed API, protected admin/cron routes, and Upstash rate limiting are live.
- 🟡 Trust and value algorithm: price per 100g and trust labels exist, but category-aware ranking rules are not complete.
- ✅ Analytics: page views, category switches, sort/filter changes, stack events, outbound clicks, and the stats dashboard are implemented.
- 🟡 Feedback collection: UI, API, schema, and rate limiting exist, but production Supabase writes still need live confirmation.
- ✅ Domain hosting on `stackscout.co.nz`
- ✅ Transparent trust and value algorithm
- ✅ Product confidence labels
- ✅ Privacy-first analytics dashboard
- 🟡 Feedback collection: implemented, pending production write verification.
- Retailer partnership pitch pack
- Affiliate link support
- Sponsored placement rules and labels

## Product Roadmap

### Phase 1: Creatine MVP And Launch Readiness

- ✅ Keep creatine comparison useful and honest.
- ✅ Hide unavailable products by default.
- 🟡 Refresh product data daily: implemented and scheduled, but production cron freshness needs verification.
- ✅ Store product, price, and availability history in Supabase.
- ✅ Rank products by estimated delivered price per 100g.
- 🟡 Improve retailer coverage and adapter reliability.
- 🟡 Add clearer stale-data and unavailable-product handling where needed.
- ✅ Add trust labels such as "Live price", "Checked today", "Shipping estimated", "Stale price", and "Unavailable hidden".
- ✅ Add confidence rules so stale products or products with unknown shipping cannot win best-value placements without a visible warning.
- ✅ Prepare production hosting for `stackscout.co.nz`.
- 🟡 Add basic production monitoring and error logging: health, status, and refresh-run tracking exist; alerting still needs to be added.

### Phase 2: Category Expansion

- ✅ Add a product `category` model for `creatine`, `protein`, and `pre_workout`.
- ✅ Add category tabs or segmented controls so users can switch between the three supplement views.
- ✅ Add whey and whey isolate product discovery.
- ✅ Add pre-workout product discovery.
- ✅ Add category-specific filters so unrelated products do not pollute each category.
- ✅ Keep the MVP value metric simple and consistent: estimated delivered price per 100g.
- 🟡 Improve category coverage for retailers where v1 discovery is thin or blocked.
- Later, improve category-specific value logic:
  - Protein: cost per protein gram when nutrition data is reliable.
  - Pre-workout: cost per serve when serving data is reliable.

### Phase 2.5: Trust And Value Algorithm

- ✅ Make the StackScout value algorithm explicit in the product and docs.
- ✅ Store enough evidence for each ranked product:
  - item price
  - estimated shipping
  - delivered total
  - pack size
  - price per 100g
  - availability
  - last checked time
  - source URL
  - fetch status
  - confidence level
- ✅ Use this MVP formula:
  - `delivered_total = item_price + estimated_shipping`
  - `price_per_100g = delivered_total / size_grams * 100`
- ✅ Rank best value using:
  - available products only
  - lowest price per 100g first
  - lower delivered total as the first tie-breaker
  - larger pack size as the second tie-breaker
  - fresher data as the third tie-breaker
- ✅ Do not let stale, unavailable, or unverified products win the top value spots.
- ✅ If shipping is unknown, show it clearly and either rank the product lower or label the ranking as shipping-unconfirmed.
- ✅ Use honest labels such as "Best current value", "Lowest estimated delivered cost", and "Checked daily" instead of broad claims like "best product".

### Phase 3: Stack Builder

- ✅ Let users add products to My stack.
- ✅ Let users adjust product quantity.
- ✅ Keep My stack stored locally in the browser.
- ✅ Support products from multiple retailers and categories in one stack.
- Show stack totals by category.
- ✅ Show estimated total stack cost.
- ✅ Show outbound retailer links for every stack item.
- Later, estimate monthly stack cost.

### Phase 4: Analytics And Feedback

- ✅ Add privacy-first analytics for:
  - ✅ page views
  - ✅ category switches
  - ✅ sort changes
  - ✅ add-to-stack events
  - ✅ remove-from-stack events
  - ✅ outbound retailer clicks
- ✅ Track outbound clicks by retailer, product, category, and timestamp.
- ✅ Add a lightweight feedback form or link.
- ✅ Ask users about missing products, missing stores, trust in pricing, and whether the stack builder is useful.
- ✅ Keep MVP analytics privacy-first and avoid user accounts until there is a clear reason.

### Phase 5: Public Launch And Promotion

- ✅ Launch on `stackscout.co.nz`.
- Share useful demos instead of spammy posts.
- Test promotion channels:
  - Reddit NZ fitness and supplement communities, where allowed.
  - LinkedIn build-in-public updates.
  - TikTok demos showing examples like "cheapest NZ stack today".
  - Instagram/Reels if short-form demos perform.
  - Relevant gym, supplement, Discord, or Facebook communities where posting is welcome.
- Validate publicly for 4-6 weeks before retailer outreach.
- Measure which categories, products, and retailers get real engagement.

## Partnership Roadmap

Do not pitch retailers only with the idea that StackScout lists their products. The stronger pitch is that StackScout sends measurable buyer-intent traffic to their product pages.

The first retailer pitch should be evidence-based:

- "StackScout redirected X users to your product pages."
- "These users were comparing supplement prices and actively building a stack."
- "We can support affiliate tracking, retailer feeds, coupon codes, or sponsored placements."

Potential monetisation options:

- Affiliate links
- Retailer-provided product feeds
- Sponsored placements
- Coupon codes
- Category sponsorship
- Display ads

Trust rule: paid placements must be clearly labelled and must not fake the value ranking.

Sponsored listings can exist later, but the organic value ranking must remain separate, explainable, and based on the same value algorithm for every retailer.

## Current Blind Spots

- Protein and pre-workout are real data categories now, but coverage is thinner than creatine.
- Pre-workout is harder to compare fairly because tub weight alone does not capture servings or active ingredients.
- Protein comparison is stronger if cost per protein gram becomes available later.
- Shipping estimates are snapshots, not final checkout quotes.
- Unknown shipping can distort rankings if it is not clearly labelled or handled by the algorithm.
- Stale products can damage trust if they appear as top-ranked deals.
- Some retailers may block scraping, rate-limit requests, or change page markup.
- Partnership value depends on outbound click tracking producing enough credible data.
- Traffic volume matters. Retailers are unlikely to care until StackScout can show consistent usage.

## Near-Term Success Criteria

- StackScout has enough creatine, whey/isolate, and pre-workout products to feel useful for NZ users.
- Users can switch between the three categories without confusion.
- Users can add products from any category to My stack.
- Product links reliably open retailer pages.
- Product data refreshes daily.
- Best-value rankings are explainable and based on estimated delivered price per 100g.
- Top-ranked products have fresh, available, and sufficiently trusted data.
- Users can see when price, stock, or shipping is estimated rather than final checkout truth.
- Usage analytics show page views, category interest, stack actions, and retailer click-throughs.
- Feedback identifies the most requested missing stores and products.
- After 4-6 weeks, there is enough traffic evidence to create a retailer pitch pack.
