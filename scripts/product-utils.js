export const userAgent =
  "Mozilla/5.0 (compatible; CreatineCompare/0.1; +https://localhost.local)";

export function asNumber(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).replaceAll(",", "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function parseSizeGrams(text, fallbackSize = null) {
  const multipackMatches = [
    ...String(text).matchAll(/(\d+)\s*(?:x|pack(?:\s+of)?|pk)\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams)\b/gi),
    ...String(text).matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams)\s*(?:x|×)\s*(\d+)\b/gi),
    ...String(text).matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams)[^\n\r]{0,40}?\bbox\s+of\s+(\d+)\b/gi),
  ].map((match) => {
    const countFirst = /^\d+\s*(?:x|pack|pk)/i.test(match[0]);
    const count = countFirst ? Number(match[1]) : Number(match[3]);
    const amount = countFirst ? Number(match[2]) : Number(match[1]);
    const unit = (countFirst ? match[3] : match[2]).toLowerCase();
    const grams = unit === "kg" ? amount * 1000 : amount;
    return Math.round(count * grams);
  });

  const matches = [...String(text).matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams|lb|lbs)\b/gi)].map(
    (match) => {
      const amount = Number(match[1]);
      const unit = match[2].toLowerCase();
      const grams = unit === "kg" ? amount * 1000 : unit.startsWith("lb") ? amount * 453.592 : amount;
      return Math.round(grams);
    },
  );
  const allMatches = [...multipackMatches, ...matches];

  if (!allMatches.length) return fallbackSize;
  if (!fallbackSize) return allMatches.sort((a, b) => b - a)[0];
  return allMatches.sort((a, b) => Math.abs(a - fallbackSize) - Math.abs(b - fallbackSize))[0];
}

export function productHandle(source) {
  try {
    return new URL(source).pathname.split("/products/")[1]?.split("/")[0] ?? null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(url, options = {}) {
  const retries = options.retries ?? 2;
  const retryStatuses = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json,text/plain,*/*",
      },
    });

    if (response.ok) return response.json();

    if (attempt >= retries || !retryStatuses.has(response.status)) {
      throw new Error(`HTTP ${response.status}`);
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : 750 * 2 ** attempt + Math.floor(Math.random() * 250);
    await sleep(delay);
  }

  throw new Error("JSON fetch failed");
}

export async function fetchJsonOnce(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json,text/plain,*/*",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href.replace(/\/$/, "");
}

export function variantMatchesSize(variant, sizeGrams) {
  const label = [variant.title, variant.option1, variant.option2, variant.name]
    .filter(Boolean)
    .join(" ");
  return parseSizeGrams(label, null) === sizeGrams;
}
