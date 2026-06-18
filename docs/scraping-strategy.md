# StackScout Scraping Strategy

This document is the source of truth for how StackScout should discover, refresh, and trust retailer product data.

## Source Priority

Use the most structured and least fragile source available for each retailer.

1. Official retailer/API feed
2. Platform adapter: Shopify, WooCommerce, Magento, BigCommerce, or similar
3. JSON-LD/schema.org `Product` and `Offer`
4. Generic HTML adapter
5. Playwright rendered-page adapter
6. Manual fallback or review queue

Playwright is a last resort. It is slower, harder to host, and easier to block than HTTP/JSON scraping.

## Accuracy Rules

- Price must be parseable and plausible.
- Pack size must be parseable.
- Availability must come from structured, platform, or clear page evidence.
- Category filters must reject obvious wrong-format products before insertion.
- For creatine, keep pure creatine monohydrate powders and reject gummies, capsules, bundles, pre-workouts, blends, samples, bars, shakers, mass gainers, and protein powders.
- For whey protein, keep whey protein powders that are not isolate, plant-based, mass gainers, bars, drinks, collagen, creatine, pre-workout, amino products, samples, bundles, or shakers.
- For protein isolate, keep isolate powders; reject bars, drinks, collagen, vegan/plant proteins, mass gainers, creatine, pre-workout, amino products, samples, bundles, and shakers.
- For plant-based protein, keep vegan/plant/pea/rice/soy protein powders; reject whey/isolate powders, bars, drinks, collagen, mass gainers, creatine, pre-workout, amino products, samples, bundles, and shakers.
- For mass gainers, keep mass/weight gainer powders; reject bars, drinks, creatine, pre-workout, amino products, samples, bundles, and shakers.
- For protein bars, keep protein bars/cookies/brownies with parseable pack size; reject powders, RTDs, collagen, creatine, pre-workout, amino products, samples, bundles, and shakers.
- For pre-workout, keep stimulant pre-workout powder tubs; reject non-stim/stim-free/caffeine-free products, protein, creatine-only products, capsules, gummies, hydration/electrolytes, samples, bundles, and shakers.
- For non-stim pre-workout, keep non-stim/stim-free/caffeine-free pre-workout powders; reject protein, creatine-only products, capsules, gummies, hydration/electrolytes, samples, bundles, and shakers.
- For electrolytes, keep electrolyte/hydration products with parseable price and pack size; reject pre-workouts, protein, creatine, amino products, samples, bundles, and shakers.
- Keep unavailable products in the database, but hide them from the public comparison by default.
- Write price history only when a product is available and has valid price and size data.
- Write availability history every refresh.
- AI can help classify ambiguous products, but price and availability must come from deterministic scraper evidence.

## Adapter Types

- `officialFeed`: retailer-provided feed or partner API.
- `shopifyCollection`: Shopify collection `products.json` discovery.
- `shopifyAllProducts`: Shopify catalog-wide `products.json` discovery when collection handles are not reliable.
- `shopifySearchSuggest`: Shopify `/search/suggest.json` discovery with product JSON enrichment where possible.
- `genericHtml`: server-side HTML discovery from category/search pages.
- `jsonLdProduct`: product page refresh from JSON-LD Product/Offer data.
- `playwrightRendered`: browser-rendered discovery or refresh.
- `manualFallback`: saved data only until a clean feed/API/adapter exists.

## Retailer Config Contract

Retailer definitions live in `scripts/retailer-config.js`.

Each retailer config should include:

- `name`
- `baseUrl`
- `adapterType`
- `discoverySources` with `category`, `adapterType`, and `url`
- `maxCandidates`
- `scrapePolicy` with `minDelayMs`, `maxConcurrent`, `cacheTtlMs`, `cooldownOn429Ms`, and `retries`
- `shipping`
- `enabled`
- `notes`

Discovery should only run configs that are enabled and supported by the current adapter code. Older single-category configs may still use `discoveryUrls`, but new category work should use `discoverySources`.

Most retailers should inherit the default scrape policy. Override only retailers with known rate limits, blocking behavior, or fragile HTML sources. Do not slow all retailers to the strictest policy unless the refresh job can tolerate the extra runtime.
