# YouTube Video 001 Production Package

Scope: YouTube only. First StackScout MVP validation video.

## Generated draft assets

Current reproducible command:

```bash
npm run video:youtube:001
```

Optional verification:

```bash
npm run video:youtube:001:probe
```

Outputs:

- `assets/youtube/video-001-website-pov.mp4` - current POV-style draft.
- `assets/youtube/video-001-draft.mp4` - compatibility copy of the current draft.
- `assets/youtube/video-001-thumbnail.png` - screenshot-style thumbnail.
- `assets/youtube/video-001-website-pov.ffprobe.json` - basic ffprobe metadata.

Verified output from this run:

- Duration: `75.000000` seconds.
- Video: `1920x1080`, `30/1` fps.
- Size: `5085243` bytes.

Pipeline notes:

- The generator captures real local StackScout pages with headless Chrome screenshots, then animates those website frames with slow POV pans/zooms and click indicators.
- If Chrome capture ever fails, the script has a deterministic fallback that renders StackScout-style UI frames from `index.html`, current app behavior assumptions, and `data/products.json` product data.
- This is not a true live browser recording yet; it is an animated website-capture draft. It shows the StackScout app shell, category controls, sort controls, product comparison rows, delivered total, price per 100g, My stack, and checkout caveats rather than text-only slides.
- Background music and UI click sounds are generated with ffmpeg synthesis. No copyrighted audio files or paid services are used.
- Voiceover is generated with the local macOS `say` command when available; otherwise the video falls back to silent narration plus captions.
- No app product logic is changed by this pipeline.

## Core angle

Show a short, honest demo of StackScout comparing NZ creatine products by estimated delivered cost. The goal is not to prove StackScout has the absolute cheapest product; the goal is to learn whether NZ buyers want this comparison tool and which products or retailers are missing.

## Title options

1. Cheapest NZ Creatine Today? I Built a Tool to Check
2. NZ Creatine Prices Are Messy, So I Built StackScout
3. Comparing NZ Creatine by Real Delivered Cost
4. Stop Comparing Creatine by Sticker Price Only
5. StackScout MVP: NZ Creatine Price Check

Recommended title: `Cheapest NZ Creatine Today? I Built a Tool to Check`

## 60-90 second script

Target length: 75 seconds.

**0:00-0:07 - Hook**

I hate scouring the internet for deals on my stack.

So this is StackScout: a small tool for comparing creatine deals by estimated delivered cost instead of just sticker price.

**0:07-0:16 - Problem**

Open StackScout and compare creatine deals in one place.

**0:16-0:42 - Demo**

Sort by value, because sticker price alone hides pack size and shipping.

Check delivered total next, not just the item price.

Then use price per 100 grams to compare different tub sizes fairly.

**0:42-0:58 - Trust caveat**

If something looks worth checking, add it to My stack.

Before buying, click through and verify the retailer checkout.

**0:58-1:08 - Caveat**

Caveat: shipping is estimated, prices and stock are snapshots, and rural fees or promo codes can change the final total.

**1:08-1:15 - CTA**

Use it as a faster shortlist, then tell me which NZ store StackScout should add next.

## Shot-by-shot storyboard

Recording target: `http://localhost:4173`

| Time | Shot | Action | Voiceover | On-screen text |
| --- | --- | --- | --- | --- |
| 0:00-0:07 | StackScout app visible | Open on the StackScout UI, not a title slide. | "I hate scouring the internet for deals on my stack." | `I hate scouring the internet for deals on my stack` |
| 0:07-0:15 | Category controls | Show or click `Creatine`. | "Open StackScout and compare creatine deals in one place." | `Compare creatine deals` |
| 0:15-0:24 | Sort control/table | Sort by best value. | "Sort by value, because sticker price alone hides pack size and shipping." | `Sort by estimated value` |
| 0:24-0:33 | Delivered total column | Show delivered total. | "Check delivered total next, not just the item price." | `Delivered total includes estimated shipping` |
| 0:33-0:42 | Price per 100g column | Show price per 100g. | "Then use price per 100 grams to compare different tub sizes fairly." | `Price per 100g makes tub sizes comparable` |
| 0:42-0:50 | My stack | Add a product if possible. | "If something looks worth checking, add it to My stack." | `Add products to My stack` |
| 0:50-0:58 | Product/retailer link area | Indicate click-through to retailer. | "Before buying, click through and verify the retailer checkout." | `Verify final price at retailer checkout` |
| 0:58-1:08 | FAQ/caveat area | Show caveats. | "Shipping is estimated, prices and stock are snapshots..." | `Shipping estimated. Prices and stock are snapshots.` |
| 1:08-1:15 | Back to StackScout | End on app UI with CTA. | "Use it as a faster shortlist..." | `What NZ store should StackScout add next?` |

## Exact screen recording checklist

### Before recording

- [ ] Start the local app and confirm `http://localhost:4173` loads.
- [ ] Refresh product data if needed, then note the refresh date in private production notes.
- [ ] Confirm the page shows creatine products without console-visible errors.
- [ ] Confirm category tabs or controls are visible in the browser viewport.
- [ ] Confirm the table exposes enough columns to explain price, size, shipping/delivered total, and price per 100g.
- [ ] Confirm any stale, unavailable, or shipping-estimated indicators are visible or explain the caveat in voiceover.
- [ ] Confirm outbound product links open to retailer pages.
- [ ] Use a clean browser window with no private tabs, bookmarks bar secrets, extensions popovers, or unrelated notifications.
- [ ] Use 1440x900 or 1920x1080 recording. If using 1080p, zoom the browser only enough to keep table text readable.

### During recording

- [ ] Start on StackScout, not a title slide.
- [ ] Keep cursor movement slow and intentional.
- [ ] Do not call any product "the best" or "the cheapest in NZ."
- [ ] Say "estimated delivered cost" and "check the retailer before buying."
- [ ] Show sorting/filtering once; do not over-explain the UI.
- [ ] Click one retailer link near the end to prove buyer-intent flow.
- [ ] Stop recording after the CTA. Do not pad with app tour footage.

### After recording

- [ ] Trim dead air from the start and end.
- [ ] Add captions or burned-in text for the core caveats.
- [ ] Blur or crop anything unrelated to StackScout if it appears.
- [ ] Check audio intelligibility on laptop speakers.
- [ ] Check the YouTube description link uses the exact UTM URL below.

## Voiceover copy

I hate scouring the internet for deals on my stack.

Open StackScout and compare creatine deals in one place.

Sort by value, because sticker price alone hides pack size and shipping.

Check delivered total next, not just the item price.

Then use price per 100 grams to compare different tub sizes fairly.

If something looks worth checking, add it to My stack.

Before buying, click through and verify the retailer checkout.

Caveat: shipping is estimated, prices and stock are snapshots, and rural fees or promo codes can change the final total.

Use it as a faster shortlist, then tell me which NZ store StackScout should add next.

## On-screen text

- `NZ creatine price check`
- `I hate scouring the internet for deals on my stack`
- `StackScout MVP`
- `Estimated delivered $ / 100g`
- `Shipping estimated`
- `Prices and stock are snapshots`
- `Check retailer before buying`
- `What NZ store should I add next?`

Keep text short. Do not cover table values or product links.

## YouTube description

First StackScout MVP demo: comparing NZ creatine products by estimated delivered price per 100g.

Try StackScout:
https://stackscout.co.nz/?utm_source=youtube&utm_medium=video&utm_campaign=creatine_mvp_001

Notes:
- Shipping is estimated and may change at checkout.
- Product prices, stock, and reviews are snapshots.
- StackScout is meant to help shortlist products, not declare one absolute best supplement.

Comment any NZ supplement stores or creatine products that should be added next.

## Pinned comment

What NZ creatine product or supplement store is missing from StackScout?

I am treating this as an MVP test. Shipping is estimated, data freshness matters, and you should still verify the final price on the retailer site before buying.

## Thumbnail concept

Layout: screenshot crop of the StackScout creatine table on the right, large plain text on the left.

Text:

```text
NZ CREATINE
REAL COST?
```

Visual notes:

- Use an actual app screenshot, not a stock gym image.
- Highlight the value/delivered cost area with a simple box or arrow.
- Avoid showing a specific product as the guaranteed winner.
- Keep a small `StackScout MVP` label so the prototype status is honest.

## Success metrics

Measure after 24, 48, and 72 hours.

- YouTube views.
- Average view duration.
- Comments naming missing products, stores, or confusing parts.
- Clicks to StackScout from `utm_campaign=creatine_mvp_001`.
- Category switches from YouTube sessions, if tracked.
- Outbound retailer clicks from YouTube sessions, if tracked.
- Ratio of StackScout visits to outbound retailer clicks.

Minimum useful signal: at least one concrete missing-store/product comment or measurable outbound retailer click from YouTube traffic. Views alone are weak evidence.

## Preflight QA checklist

- [ ] App opens at `http://localhost:4173`.
- [ ] Creatine category is visible and usable.
- [ ] Product rows show enough data to justify the comparison.
- [ ] No stale or shipping-unknown product is framed as a certain winner.
- [ ] Outbound retailer link works.
- [ ] YouTube URL uses `utm_source=youtube&utm_medium=video&utm_campaign=creatine_mvp_001`.
- [ ] Script says shipping is estimated and final checkout must be checked.
- [ ] Video stays between 60 and 90 seconds.
- [ ] No private browser, account, API, or local file details are visible.
