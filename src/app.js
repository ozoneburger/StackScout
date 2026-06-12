const initialPayload = window.__STACKSCOUT_INITIAL_PRODUCTS__;
let products = Array.isArray(initialPayload?.products) ? initialPayload.products : [];
let refreshedAt = initialPayload?.refreshedAt ?? null;
const productPlaceholder = "assets/product-placeholder.svg";
const initialVisibleCount = 12;
const loadMoreStep = 12;
const stackStorageKey = "stackscout.myStack.v1";
const sessionStorageKey = "stackscout.sessionId.v1";

const money = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

const sortSelect = document.querySelector("#sort-select");
const categoryCycle = document.querySelector("#category-cycle");
const dataStatus = document.querySelector("#data-status");
const resultsBody = document.querySelector("#results-body");
const cards = document.querySelector("#cards");
const featuredRail = document.querySelector("#featured-rail");
const featuredToggle = document.querySelector("#featured-toggle");
const resultCount = document.querySelector("#result-count");
const loadMoreButton = document.querySelector("#load-more-button");
const stackItems = document.querySelector("#stack-items");
const stackSummary = document.querySelector("#stack-summary");
const stackTotal = document.querySelector("#stack-total");
const stackDeliveredTotal = document.querySelector("#stack-delivered-total");
const sortHeaders = document.querySelectorAll(".sort-header");
const categoryTabs = document.querySelectorAll(".category-tab");
const retailerFilter = document.querySelector("#retailer-filter");
const minPackSizeFilter = document.querySelector("#min-pack-size");
const maxPackSizeFilter = document.querySelector("#max-pack-size");
const hideShippingUnknownFilter = document.querySelector("#hide-shipping-unknown");
const onlyCheckedTodayFilter = document.querySelector("#only-checked-today");
const hideStaleFilter = document.querySelector("#hide-stale");
const feedbackForm = document.querySelector("#feedback-form");
const feedbackStatus = document.querySelector("#feedback-status");

let lastControlState = "";
let visibleCount = initialVisibleCount;
let stack = loadStack();
let selectedCategory = "creatine";
let featuredPaused = false;
const analyticsSessionId = loadSessionId();
const expandedHistorySources = new Set();
const priceHistoryBySource = new Map();
const categoryLabels = {
  creatine: "creatine",
  protein: "whey protein",
  pre_workout: "pre-workout",
};

function estimatedShipping(product) {
  if (product.estimatedShipping !== undefined) return product.estimatedShipping;
  if (!product.deliveryAvailable) return null;
  if (!product.shipping) return null;
  if (Number.isFinite(product.shipping.freeThreshold) && product.price >= product.shipping.freeThreshold) return 0;
  return Number.isFinite(product.shipping.cost) ? product.shipping.cost : null;
}

function hasUnknownShipping(product) {
  return product.deliveryAvailable && estimatedShipping(product) === null;
}

function estimatedTotal(product) {
  if (Number.isFinite(product.deliveredTotal)) return product.deliveredTotal;
  const shipping = estimatedShipping(product);
  return shipping === null ? product.price : product.price + shipping;
}

function pricePer100g(product) {
  if (Number.isFinite(product.pricePer100g)) return product.pricePer100g;
  return (estimatedTotal(product) / product.sizeGrams) * 100;
}

function shippingSortGroup(product) {
  return product.shippingConfidence === "unknown" || hasUnknownShipping(product) ? 1 : 0;
}

function bestValueCompare(a, b, direction = "asc") {
  const valueDirection = direction === "desc" ? -1 : 1;
  return (
    Number(a.rankingEligible === false) - Number(b.rankingEligible === false) ||
    shippingSortGroup(a) - shippingSortGroup(b) ||
    (pricePer100g(a) - pricePer100g(b)) * valueDirection ||
    estimatedTotal(a) - estimatedTotal(b) ||
    b.sizeGrams - a.sizeGrams
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return "#";
  }
  return "#";
}

function imageUrl(value) {
  const url = safeUrl(value);
  return url === "#" ? productPlaceholder : url;
}

function loadSessionId() {
  try {
    const existing = sessionStorage.getItem(sessionStorageKey);
    if (existing) return existing;
    const id =
      crypto.randomUUID?.() ??
      `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(sessionStorageKey, id);
    return id;
  } catch {
    return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function currentPagePath() {
  return `${window.location.pathname}${window.location.search}`;
}

function trackAnalyticsEvent(eventType, metadata = {}) {
  const body = JSON.stringify({
    eventType,
    sessionId: analyticsSessionId,
    category: selectedCategory,
    pagePath: currentPagePath(),
    metadata: {
      sort: sortSelect?.value,
      retailer: retailerFilter?.value,
      minPackSize: minPackSizeFilter?.value,
      maxPackSize: maxPackSizeFilter?.value,
      hideShippingUnknown: hideShippingUnknownFilter?.checked,
      onlyCheckedToday: onlyCheckedTodayFilter?.checked,
      hideStale: hideStaleFilter?.checked,
      ...metadata,
    },
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/events/analytics", blob);
    return;
  }

  fetch("/api/events/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function productBySource(source) {
  return (
    products.find((product) => product.source === source) ??
    stack.map((item) => stackProduct(item)).find((product) => product?.source === source) ??
    null
  );
}

function outboundAttrs(product, clickLocation) {
  return `data-outbound="true" data-click-location="${escapeHtml(clickLocation)}" data-source="${escapeHtml(
    product.source,
  )}"`;
}

function trackOutboundClick(link) {
  const product = productBySource(link.dataset.source);
  if (!product) return;

  const payload = {
    sourceUrl: product.source,
    clickLocation: link.dataset.clickLocation,
    pagePath: currentPagePath(),
    sessionId: analyticsSessionId,
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/events/outbound-click", blob);
    return;
  }

  fetch("/api/events/outbound-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function formatReviews(product) {
  if (product.reviewCount === null) return "N/A";
  if (product.reviewCount === 0) return "0 reviews";
  if (product.rating === null) return `${product.reviewCount.toLocaleString()} reviews`;
  return `${product.rating.toFixed(1)} / 5 (${product.reviewCount.toLocaleString()} reviews)`;
}

function formatShipping(product) {
  const ship = estimatedShipping(product);
  const threshold = product.shipping?.freeThreshold;
  if (ship === null) {
    if (product.deliveryAvailable) return "Shipping needs confirmation. Check the retailer for final delivery fees.";
    return "Pickup only. Delivery is not listed.";
  }
  const base = ship === 0 ? "Estimated shipping is free." : `Estimated shipping is ${money.format(ship)}.`;
  if (Number.isFinite(threshold) && ship > 0) {
    return `${base} Free shipping may apply over ${money.format(threshold)}. Check the retailer for final delivery fees.`;
  }
  if (Number.isFinite(threshold) && ship === 0 && product.price >= threshold) {
    return `${base} This item appears to meet the free-shipping threshold. Check the retailer for final delivery fees.`;
  }
  return `${base} Check the retailer for final delivery fees.`;
}

function averagePricePer100g(items = comparableProducts()) {
  if (!items.length) return 0;
  return items.reduce((total, product) => total + pricePer100g(product), 0) / items.length;
}

function savingsLabel(product) {
  const average = averagePricePer100g();
  if (!average) return "";
  const difference = average - pricePer100g(product);
  if (difference <= 0) return "Above average cost";
  return `${money.format(difference)} cheaper per 100g than average`;
}

function productKey(product) {
  return product.source ?? `${product.retailer}|${product.product}|${product.sizeGrams}`;
}

function loadStack() {
  try {
    const stored = JSON.parse(localStorage.getItem(stackStorageKey) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((item) => item?.source)
      .map((item) => ({
        source: item.source,
        quantity: Math.max(1, Number(item.quantity) || 1),
        snapshot: item.snapshot ?? null,
      }));
  } catch {
    return [];
  }
}

function saveStack() {
  localStorage.setItem(stackStorageKey, JSON.stringify(stack));
}

function productSnapshot(product) {
  return {
    category: product.category ?? selectedCategory,
    retailer: product.retailer,
    product: product.product,
    productImage: product.productImage ?? product.image,
    sizeGrams: product.sizeGrams,
    price: product.price,
    shipping: product.shipping,
    deliveryAvailable: product.deliveryAvailable,
    estimatedShipping: product.estimatedShipping,
    deliveredTotal: product.deliveredTotal,
    pricePer100g: product.pricePer100g,
    shippingConfidence: product.shippingConfidence,
    source: product.source,
  };
}

function stackItemFor(product) {
  return stack.find((item) => item.source === product.source);
}

function stackProduct(item) {
  return products.find((product) => product.source === item.source) ?? item.snapshot;
}

function stackLineTotal(item) {
  const product = stackProduct(item);
  if (!product) return 0;
  return (product.price ?? 0) * item.quantity;
}

function stackDeliveredLineTotal(item) {
  const product = stackProduct(item);
  if (!product) return 0;
  return estimatedTotal(product) * item.quantity;
}

function stackHasUnknownShipping() {
  return stack.some((item) => {
    const product = stackProduct(item);
    return product ? hasUnknownShipping(product) : false;
  });
}

function stackQuantity() {
  return stack.reduce((total, item) => total + item.quantity, 0);
}

function addToStack(product) {
  const existing = stackItemFor(product);
  if (existing) {
    existing.quantity += 1;
    existing.snapshot = productSnapshot(product);
  } else {
    stack.push({ source: product.source, quantity: 1, snapshot: productSnapshot(product) });
  }
  saveStack();
  trackAnalyticsEvent("add_to_stack", {
    sourceUrl: product.source,
    product: product.product,
    retailer: product.retailer,
    quantity: existing ? existing.quantity : 1,
  });
  render();
}

function updateStackQuantity(source, delta) {
  const item = stack.find((entry) => entry.source === source);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    stack = stack.filter((entry) => entry.source !== source);
    trackAnalyticsEvent("remove_from_stack", { sourceUrl: source, reason: "quantity_zero" });
  } else {
    trackAnalyticsEvent("stack_quantity_change", { sourceUrl: source, quantity: item.quantity });
  }
  saveStack();
  render();
}

function removeFromStack(source) {
  const item = stack.find((entry) => entry.source === source);
  if (!item) return;
  item.quantity -= 1;
  if (item.quantity <= 0) {
    stack = stack.filter((entry) => entry.source !== source);
    trackAnalyticsEvent("remove_from_stack", { sourceUrl: source, reason: "remove_button" });
  } else {
    trackAnalyticsEvent("stack_quantity_change", { sourceUrl: source, quantity: item.quantity });
  }
  saveStack();
  render();
}

function stackButton(product) {
  const item = stackItemFor(product);
  return `<button class="stack-add ${item ? "active" : ""}" type="button" data-stack-action="add" data-source="${escapeHtml(product.source)}">${
    item ? `Add another (${item.quantity})` : "Add to stack"
  }</button>`;
}

function podiumRanks(items) {
  return new Map(
    [...items]
      .filter((product) => product.rankingEligible !== false)
      .sort((a, b) => bestValueCompare(a, b))
      .slice(0, 3)
      .map((product, index) => [productKey(product), index + 1]),
  );
}

function podiumLabel(rank) {
  if (rank === 1) return "Best value";
  if (rank === 2) return "Runner up";
  if (rank === 3) return "Third pick";
  return "";
}

function podiumBadge(rank) {
  if (!rank) return "";
  return `<div class="podium-badge rank-${rank}"><span>#${rank}</span>${podiumLabel(rank)}</div>`;
}

function formatFetchStatus(product) {
  if (product.fetchStatus === "live") return "Live fetch updated.";
  if (product.fetchStatus === "unavailable" || product.available === false) {
    return "Unavailable from retailer.";
  }
  if (product.fetchStatus === "stale") return `Using saved data: ${product.fetchError ?? "fetch failed"}`;
  if (product.rankingWarning) return product.rankingWarning;
  return product.confidence;
}

function checkedToday(product) {
  if (!product.updatedAt) return false;
  return new Date(product.updatedAt).toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
  }) === new Date().toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland" });
}

function trustLabels(product) {
  const labels = [];
  if (product.fetchStatus === "live") labels.push({ label: "Live price", tone: "good" });
  if (checkedToday(product)) labels.push({ label: "Checked today", tone: "good" });
  if (estimatedShipping(product) !== null) labels.push({ label: "Shipping estimated", tone: "info" });
  if (product.shippingConfidence === "unknown" || hasUnknownShipping(product)) {
    labels.push({ label: "Shipping unknown", tone: "warn" });
  }
  if (product.rankingEligible === false) labels.push({ label: "Not top-ranked", tone: "warn" });
  if (product.fetchStatus === "stale") labels.push({ label: "Stale data", tone: "warn" });
  if (product.fetchStatus === "unavailable" || product.available === false) {
    labels.push({ label: "Unavailable", tone: "warn" });
  }
  return labels.slice(0, 3);
}

function trustChips(product) {
  const labels = trustLabels(product);
  if (!labels.length) return "";
  return `<div class="trust-chips">${labels
    .map((item) => `<span class="${escapeHtml(item.tone)}">${escapeHtml(item.label)}</span>`)
    .join("")}</div>`;
}

function historyButton(product) {
  const expanded = expandedHistorySources.has(product.source);
  return `<button class="history-toggle" type="button" data-history-action="toggle" data-source="${escapeHtml(
    product.source,
  )}" aria-expanded="${expanded}">
    <span>${expanded ? "Hide tracker" : "Price tracker"}</span>
    <strong>${expanded ? "Close history" : "View history"}</strong>
  </button>`;
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    timeZone: "Pacific/Auckland",
  });
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function historyWindow(points, days = 90) {
  const cutoff = daysAgo(days);
  const ranged = points.filter((point) => new Date(point.observedAt) >= cutoff);
  return ranged.length ? ranged : points;
}

function dayKey(value) {
  return new Date(value).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  });
}

function dailyHistoryPoints(points) {
  const byDay = new Map();
  points.forEach((point) => {
    byDay.set(dayKey(point.observedAt), point);
  });
  return [...byDay.values()];
}

function historyTrend(points, key, days = 30) {
  const ranged = dailyHistoryPoints(historyWindow(points, days));
  if (ranged.length < 2) return null;
  const first = ranged[0][key];
  const latest = ranged.at(-1)[key];
  if (!Number.isFinite(first) || !Number.isFinite(latest) || first === 0) return null;
  return ((latest - first) / first) * 100;
}

function formatTrend(value) {
  if (value === null) return "New";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function trendClass(value) {
  if (value === null) return "neutral";
  if (value < 0) return "good";
  if (value > 0) return "warn";
  return "neutral";
}

function metricBounds(points, key) {
  const values = points.map((point) => point[key]).filter(Number.isFinite);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  if (minValue === maxValue) {
    const pad = Math.max(1, minValue * 0.08);
    return { min: Math.max(0, minValue - pad), max: maxValue + pad };
  }
  const pad = (maxValue - minValue) * 0.12;
  return { min: Math.max(0, minValue - pad), max: maxValue + pad };
}

function pointPosition(points, point, index, key, min, max, width, height, pad) {
  const range = max - min || 1;
  const x = points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = height - pad - ((point[key] - min) / range) * (height - pad * 2);
  return { x, y };
}

function chartPath(points, key, min, max, width, height, pad) {
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
      const y = height - pad - ((point[key] - min) / range) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function chartAreaPath(points, key, min, max, width, height, pad) {
  const line = chartPath(points, key, min, max, width, height, pad);
  const firstX = points.length === 1 ? width / 2 : pad;
  const lastX = points.length === 1 ? width / 2 : width - pad;
  const baseline = height - pad;
  return `${line} L ${lastX.toFixed(1)} ${baseline.toFixed(1)} L ${firstX.toFixed(1)} ${baseline.toFixed(1)} Z`;
}

function chartDots(points, key, min, max, width, height, pad, className) {
  return points
    .map((point, index) => {
      const { x, y } = pointPosition(points, point, index, key, min, max, width, height, pad);
      return `<circle class="${className}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"><title>${formatShortDate(
        point.observedAt,
      )}: ${money.format(point[key])}</title></circle>`;
    })
    .join("");
}

function renderMetricHistoryChart(points, key, label, className) {
  const cleanPoints = dailyHistoryPoints(historyWindow(points, 90)).filter((point) => Number.isFinite(point[key]));
  if (!cleanPoints.length) return "";

  const width = 960;
  const height = 270;
  const pad = 48;
  const { min, max } = metricBounds(cleanPoints, key);
  const first = cleanPoints[0];
  const latest = cleanPoints.at(-1);
  const latestPosition = pointPosition(cleanPoints, latest, cleanPoints.length - 1, key, min, max, width, height, pad);
  const badgeWidth = 72;
  const badgeHeight = 24;
  const badgeX = width - pad - badgeWidth - 8;
  const badgeY = Math.max(pad - 6, Math.min(height - pad - badgeHeight + 6, latestPosition.y - badgeHeight / 2));
  const mid = min + (max - min) / 2;
  const gridRows = [max, mid, min]
    .map((value) => {
      const y = height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2);
      return `
        <line class="history-grid" x1="${pad}" y1="${y.toFixed(1)}" x2="${width - pad}" y2="${y.toFixed(1)}"></line>
        <text class="history-y-label" x="${width - pad + 8}" y="${(y + 4).toFixed(1)}">${escapeHtml(
          money.format(value),
        )}</text>
      `;
    })
    .join("");
  const dotMarkup =
    cleanPoints.length > 1 && cleanPoints.length <= 14
      ? chartDots(cleanPoints, key, min, max, width, height, pad, `history-dot ${className}`)
      : "";
  const endDateLabel =
    dayKey(first.observedAt) === dayKey(latest.observedAt)
      ? ""
      : `<text class="history-x-label" x="${width - pad}" y="${height - 10}" text-anchor="end">${escapeHtml(
          formatShortDate(latest.observedAt),
        )}</text>`;

  return `
    <section class="history-chart-card">
      <div class="history-chart-title">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(formatShortDate(first.observedAt))} to ${escapeHtml(formatShortDate(latest.observedAt))}</span>
      </div>
      <svg class="history-chart ${className}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
        label,
      )} history chart">
        ${gridRows}
        <path class="history-area ${className}" d="${chartAreaPath(cleanPoints, key, min, max, width, height, pad)}"></path>
        <path class="history-line ${className}" d="${chartPath(cleanPoints, key, min, max, width, height, pad)}"></path>
        ${dotMarkup}
        <circle class="history-current-dot ${className}" cx="${latestPosition.x.toFixed(1)}" cy="${latestPosition.y.toFixed(
          1,
        )}" r="4"></circle>
        <rect class="history-current-badge ${className}" x="${badgeX.toFixed(1)}" y="${badgeY.toFixed(
          1,
        )}" width="${badgeWidth}" height="${badgeHeight}" rx="6"></rect>
        <text class="history-current-label" x="${(badgeX + badgeWidth / 2).toFixed(1)}" y="${(
          badgeY + 16
        ).toFixed(1)}" text-anchor="middle">${escapeHtml(money.format(latest[key]))}</text>
        <text class="history-x-label" x="${pad}" y="${height - 10}">${escapeHtml(formatShortDate(first.observedAt))}</text>
        ${endDateLabel}
      </svg>
    </section>
  `;
}

function renderPriceHistoryChart(points) {
  const cleanPoints = points
    .filter((point) => Number.isFinite(point.itemPrice) && Number.isFinite(point.pricePer100g))
    .slice(-240);
  if (!cleanPoints.length) {
    return `<p class="history-empty">No price history has been recorded for this product yet.</p>`;
  }

  const latest = cleanPoints.at(-1);
  const last90 = dailyHistoryPoints(historyWindow(cleanPoints, 90));
  const itemValues = last90.map((point) => point.itemPrice);
  const valueValues = last90.map((point) => point.pricePer100g);
  const lowestItem = Math.min(...itemValues);
  const lowestValue = Math.min(...valueValues);
  const itemTrend = historyTrend(cleanPoints, "itemPrice", 30);
  const valueTrend = historyTrend(cleanPoints, "pricePer100g", 30);
  const latestDate = formatShortDate(latest.observedAt);

  return `
    <div class="history-chart-wrap">
      <p class="history-range-note">Showing the latest tracked 90-day window when available.</p>
      ${renderMetricHistoryChart(cleanPoints, "itemPrice", "Item price", "item-price")}
      ${renderMetricHistoryChart(cleanPoints, "pricePer100g", "Price per 100g", "value-price")}
      <div class="history-stat-grid">
        <div class="history-stat">
          <span>Item price now</span>
          <strong>${escapeHtml(money.format(latest.itemPrice))}</strong>
          <em class="${trendClass(itemTrend)}">30 day trend ${escapeHtml(formatTrend(itemTrend))}</em>
        </div>
        <div class="history-stat">
          <span>Price per 100g now</span>
          <strong>${escapeHtml(money.format(latest.pricePer100g))}</strong>
          <em class="${trendClass(valueTrend)}">30 day trend ${escapeHtml(formatTrend(valueTrend))}</em>
        </div>
        <div class="history-stat">
          <span>Lowest tracked item price</span>
          <strong>${escapeHtml(money.format(lowestItem))}</strong>
          <em>within shown range</em>
        </div>
        <div class="history-stat">
          <span>Lowest tracked per 100g</span>
          <strong>${escapeHtml(money.format(lowestValue))}</strong>
          <em>${cleanPoints.length.toLocaleString()} point${cleanPoints.length === 1 ? "" : "s"} saved, latest ${escapeHtml(
            latestDate,
          )}</em>
        </div>
      </div>
    </div>
  `;
}

function renderPriceHistoryPanel(product) {
  const state = priceHistoryBySource.get(product.source);
  if (!state || state.status === "loading") {
    return `<div class="history-panel"><p class="history-empty">Loading price history...</p></div>`;
  }
  if (state.status === "error") {
    return `<div class="history-panel"><p class="history-empty">Could not load price history: ${escapeHtml(
      state.error,
    )}</p></div>`;
  }
  return `
    <div class="history-panel">
      <div class="history-head">
        <strong>${escapeHtml(product.product)}</strong>
        <span>Item price and price per 100g from saved refresh history.</span>
      </div>
      ${renderPriceHistoryChart(state.points ?? [])}
    </div>
  `;
}

async function loadPriceHistory(source) {
  priceHistoryBySource.set(source, { status: "loading", points: [] });
  render();
  try {
    const response = await fetch(`/api/price-history?sourceUrl=${encodeURIComponent(source)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    priceHistoryBySource.set(source, { status: "ready", points: payload.points ?? [] });
  } catch (error) {
    priceHistoryBySource.set(source, { status: "error", error: error.message, points: [] });
  }
  render();
}

function togglePriceHistory(source) {
  if (expandedHistorySources.has(source)) {
    expandedHistorySources.delete(source);
    render();
    return;
  }
  expandedHistorySources.add(source);
  if (!priceHistoryBySource.has(source)) {
    loadPriceHistory(source);
    return;
  }
  render();
}

function comparableProducts() {
  return products.filter((product) => product.available !== false && product.fetchStatus !== "unavailable");
}

function numericFilterValue(control) {
  if (!control?.value) return null;
  const value = Number(control.value);
  return Number.isFinite(value) ? value : null;
}

function filteredProducts() {
  const minPackSize = numericFilterValue(minPackSizeFilter);
  const maxPackSize = numericFilterValue(maxPackSizeFilter);
  return comparableProducts()
    .filter((product) => !retailerFilter?.value || product.retailer === retailerFilter.value)
    .filter((product) => minPackSize === null || product.sizeGrams >= minPackSize)
    .filter((product) => maxPackSize === null || product.sizeGrams <= maxPackSize)
    .filter((product) => !hideShippingUnknownFilter?.checked || !hasUnknownShipping(product))
    .filter((product) => !onlyCheckedTodayFilter?.checked || checkedToday(product))
    .filter((product) => !hideStaleFilter?.checked || product.fetchStatus !== "stale")
    .sort((a, b) => {
      switch (sortSelect.value) {
        case "total-asc":
          return shippingSortGroup(a) - shippingSortGroup(b) || estimatedTotal(a) - estimatedTotal(b);
        case "total-desc":
          return shippingSortGroup(a) - shippingSortGroup(b) || estimatedTotal(b) - estimatedTotal(a);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "size-desc":
          return b.sizeGrams - a.sizeGrams;
        case "size-asc":
          return a.sizeGrams - b.sizeGrams;
        case "value-desc":
          return bestValueCompare(a, b, "desc");
        default:
          return bestValueCompare(a, b);
      }
    });
}

function sortValueForKey(key, direction) {
  const suffix = direction === "asc" ? "asc" : "desc";
  if (key === "value") return direction === "asc" ? "value" : "value-desc";
  return `${key}-${suffix}`;
}

function currentSortParts() {
  if (sortSelect.value === "value") return { key: "value", direction: "asc" };
  if (sortSelect.value === "value-desc") return { key: "value", direction: "desc" };
  const [key, direction] = sortSelect.value.split("-");
  return { key, direction };
}

function updateSortHeaders() {
  const current = currentSortParts();
  sortHeaders.forEach((button) => {
    const isActive = button.dataset.sortKey === current.key;
    const header = button.closest("th");
    button.classList.toggle("active", isActive);
    button.dataset.direction = isActive ? current.direction : "";
    if (header) {
      if (isActive) header.setAttribute("aria-sort", current.direction === "asc" ? "ascending" : "descending");
      else header.removeAttribute("aria-sort");
    }
    button.querySelector("[data-sort-indicator]").textContent = isActive
      ? current.direction === "asc"
        ? "↑"
        : "↓"
      : "↕";
  });
}

function updateCategoryTabs() {
  categoryTabs.forEach((button) => {
    const active = button.dataset.category === selectedCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

function updateCategoryLabel() {
  if (categoryCycle) categoryCycle.textContent = categoryLabels[selectedCategory];
}

function updateRetailerOptions() {
  if (!retailerFilter) return;
  const current = retailerFilter.value;
  const retailers = [...new Set(comparableProducts().map((product) => product.retailer).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  retailerFilter.innerHTML = [
    `<option value="">All retailers</option>`,
    ...retailers.map((retailer) => `<option value="${escapeHtml(retailer)}">${escapeHtml(retailer)}</option>`),
  ].join("");
  retailerFilter.value = retailers.includes(current) ? current : "";
}

function firstBy(items, compare) {
  return [...items].sort(compare)[0] ?? null;
}

function featuredProducts(items) {
  if (!items.length) return [];
  return [
    {
      label: "Best current value",
      product: firstBy(
        items.filter((product) => product.rankingEligible !== false),
        (a, b) => bestValueCompare(a, b),
      ),
      value: (product) => `${money.format(pricePer100g(product))} per 100g`,
    },
    {
      label: "Lowest estimated delivered",
      product: firstBy(
        items.filter((product) => product.shippingConfidence !== "unknown"),
        (a, b) => estimatedTotal(a) - estimatedTotal(b),
      ),
      value: (product) => money.format(estimatedTotal(product)),
    },
    {
      label: "Largest available pack",
      product: firstBy(items, (a, b) => b.sizeGrams - a.sizeGrams),
      value: (product) => `${product.sizeGrams.toLocaleString()}g`,
    },
    {
      label: "Most reviewed",
      product: firstBy(
        items.filter((product) => product.reviewCount > 0),
        (a, b) => b.reviewCount - a.reviewCount,
      ),
      value: (product) => `${product.reviewCount.toLocaleString()} reviews`,
    },
    {
      label: "Lowest item price",
      product: firstBy(items, (a, b) => a.price - b.price),
      value: (product) => money.format(product.price),
    },
    {
      label: "Best rated",
      product: firstBy(
        items.filter((product) => product.rating !== null && product.reviewCount > 0),
        (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      ),
      value: (product) => `${product.rating.toFixed(1)} / 5`,
    },
  ].filter((item) => item.product);
}

function featuredCardMarkup(item, duplicate = false) {
  const focusAttrs = duplicate ? `tabindex="-1" aria-hidden="true"` : "";
  return `
    <a class="featured-card" href="${safeUrl(item.product.source)}" target="_blank" rel="noreferrer" ${focusAttrs} ${outboundAttrs(
      item.product,
      "featured",
    )}>
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value(item.product))}</strong>
      <div>
        <img src="${imageUrl(item.product.productImage ?? item.product.image)}" alt="${escapeHtml(item.product.product)}" loading="lazy" onerror="this.src='${productPlaceholder}'" />
        <p>${escapeHtml(item.product.product)}</p>
      </div>
      <em>${escapeHtml(item.product.retailer)}</em>
    </a>
  `;
}

function updateFeaturedToggle() {
  if (!featuredToggle) return;
  featuredToggle.setAttribute("aria-pressed", String(featuredPaused));
  featuredToggle.setAttribute("aria-label", featuredPaused ? "Play carousel" : "Pause carousel");
}

function renderFeatured(items = comparableProducts()) {
  if (!items.length) {
    featuredRail.innerHTML = `<p class="empty-state">No available ${escapeHtml(categoryLabels[selectedCategory])} products yet.</p>`;
    if (featuredToggle) featuredToggle.hidden = true;
    return;
  }

  const featuredItems = featuredProducts(items);
  const cards = featuredItems.map((item) => featuredCardMarkup(item)).join("");
  const repeatedCards = featuredItems.map((item) => featuredCardMarkup(item, true)).join("");
  if (featuredToggle) featuredToggle.hidden = featuredItems.length <= 1;
  updateFeaturedToggle();

  featuredRail.innerHTML = `
    <div class="featured-track ${featuredPaused ? "paused" : ""}" aria-live="off">
      <div class="featured-group">${cards}</div>
      <div class="featured-repeat" aria-hidden="true">${repeatedCards}</div>
    </div>
  `;
}

function renderTable(items, rankItems = items) {
  const ranks = podiumRanks(rankItems);
  resultsBody.innerHTML = items
    .map((product) => {
      const rank = ranks.get(productKey(product));
      const historyExpanded = expandedHistorySources.has(product.source);
      return `
        <tr class="${rank ? `podium-row rank-${rank}` : ""}">
          <td>
            <a class="retailer-cell row-link" href="${safeUrl(product.source)}" target="_blank" rel="noreferrer" ${outboundAttrs(
              product,
              "table-retailer",
            )}>
              <img src="${imageUrl(product.image)}" alt="${escapeHtml(product.retailer)} logo" loading="lazy" onerror="this.src='${productPlaceholder}'" />
              <div>
                <div class="retailer">${escapeHtml(product.retailer)}</div>
              </div>
            </a>
          </td>
          <td>
            <a class="product-cell row-link" href="${safeUrl(product.source)}" target="_blank" rel="noreferrer" ${outboundAttrs(
              product,
              "table-product",
            )}>
              <img src="${imageUrl(product.productImage ?? product.image)}" alt="${escapeHtml(product.product)}" loading="lazy" onerror="this.src='${productPlaceholder}'" />
              <div>
                ${podiumBadge(rank)}
                <strong>${escapeHtml(product.product)}</strong>
                <div class="tag ${formatFetchStatus(product).includes("failed") || formatFetchStatus(product).includes("limited") ? "warn" : ""}">
                  ${escapeHtml(formatFetchStatus(product))}
                </div>
                ${trustChips(product)}
              </div>
            </a>
            ${historyButton(product)}
          </td>
          <td>
            <div class="metric metric-size">
              <strong>${product.sizeGrams.toLocaleString()}g</strong>
              <span>pack size</span>
            </div>
          </td>
          <td>${formatReviews(product)}</td>
          <td>
            <div class="metric">
              <strong>${money.format(product.price)}</strong>
              <span>item price</span>
            </div>
          </td>
          <td>${escapeHtml(formatShipping(product))}</td>
          <td>
            <div class="metric metric-total">
              <strong>${money.format(estimatedTotal(product))}</strong>
              <span>incl. shipping estimate</span>
            </div>
          </td>
          <td>
            <div class="metric metric-value">
              <strong>${money.format(pricePer100g(product))}</strong>
              <span>per 100g</span>
              <em>${escapeHtml(savingsLabel(product))}</em>
            </div>
          </td>
          <td>${stackButton(product)}</td>
        </tr>
        ${
          historyExpanded
            ? `<tr class="history-row"><td colspan="9">${renderPriceHistoryPanel(product)}</td></tr>`
            : ""
        }
      `;
    })
    .join("");
}

function renderCards(items, rankItems = items) {
  const ranks = podiumRanks(rankItems);
  cards.innerHTML = items
    .map((product) => {
      const rank = ranks.get(productKey(product));
      return `
        <article class="card ${rank ? `podium-card rank-${rank}` : ""}">
          ${podiumBadge(rank)}
          <div class="card-head">
            <img src="${imageUrl(product.image)}" alt="${escapeHtml(product.retailer)} logo" loading="lazy" onerror="this.src='${productPlaceholder}'" />
            <h3>${escapeHtml(product.retailer)}</h3>
          </div>
          <img class="card-product-image" src="${imageUrl(product.productImage ?? product.image)}" alt="${escapeHtml(product.product)}" loading="lazy" onerror="this.src='${productPlaceholder}'" />
          <a class="card-product-link" href="${safeUrl(product.source)}" target="_blank" rel="noreferrer" ${outboundAttrs(
            product,
            "card-product",
          )}>${escapeHtml(product.product)}</a>
          ${trustChips(product)}
          <div class="meta">
            <div><span>Pack size</span><strong>${product.sizeGrams.toLocaleString()}g</strong></div>
            <div><span>Item price</span><strong>${money.format(product.price)}</strong></div>
            <div><span>Delivered total</span><strong>${money.format(estimatedTotal(product))}</strong></div>
            <div><span>Price per 100g</span><strong class="value">${money.format(pricePer100g(product))}</strong></div>
            <div><span>Reviews</span><strong>${formatReviews(product)}</strong></div>
          </div>
          <p>${escapeHtml(formatShipping(product))}</p>
          ${historyButton(product)}
          ${expandedHistorySources.has(product.source) ? renderPriceHistoryPanel(product) : ""}
          ${stackButton(product)}
        </article>
      `;
    })
    .join("");
}

function renderStack() {
  const quantity = stackQuantity();
  const itemTotal = stack.reduce((sum, item) => sum + stackLineTotal(item), 0);
  const deliveredTotal = stack.reduce((sum, item) => sum + stackDeliveredLineTotal(item), 0);
  stackSummary.textContent = quantity
    ? `${quantity} product${quantity === 1 ? "" : "s"} saved. Delivered subtotal uses current shipping estimates${
        stackHasUnknownShipping() ? " where known." : "."
      }`
    : "No products added yet.";
  stackTotal.textContent = money.format(itemTotal);
  if (stackDeliveredTotal) stackDeliveredTotal.textContent = money.format(deliveredTotal);

  if (!stack.length) {
    stackItems.innerHTML = `<p class="stack-empty">Add products to compare a rough stack total.</p>`;
    return;
  }

  stackItems.innerHTML = stack
    .map((item) => {
      const product = stackProduct(item);
      if (!product) return "";
      return `
        <article class="stack-item">
          <a class="stack-product-image" href="${safeUrl(product.source)}" target="_blank" rel="noreferrer" ${outboundAttrs(
            product,
            "stack-image",
          )}>
            <img src="${imageUrl(product.productImage ?? product.image)}" alt="${escapeHtml(product.product)}" loading="lazy" onerror="this.src='${productPlaceholder}'" />
          </a>
          <div>
            <a class="stack-product-link" href="${safeUrl(product.source)}" target="_blank" rel="noreferrer" ${outboundAttrs(
              product,
              "stack-product",
            )}>${escapeHtml(product.product)}</a>
            <span>${escapeHtml(product.retailer)} · ${money.format(product.price ?? 0)} item price</span>
          </div>
          <a class="stack-go" href="${safeUrl(product.source)}" target="_blank" rel="noreferrer" ${outboundAttrs(
            product,
            "stack-go",
          )}>Buy Now</a>
          <div class="stack-qty" aria-label="Quantity controls">
            <button type="button" data-stack-action="decrement" data-source="${escapeHtml(item.source)}" aria-label="Decrease quantity for ${escapeHtml(product.product)}">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-stack-action="increment" data-source="${escapeHtml(item.source)}" aria-label="Increase quantity for ${escapeHtml(product.product)}">+</button>
          </div>
          <strong>${money.format(stackLineTotal(item))}</strong>
          <button class="stack-remove" type="button" data-stack-action="remove" data-source="${escapeHtml(item.source)}">Remove</button>
        </article>
      `;
    })
    .join("");
}

function render() {
  updateRetailerOptions();
  const allItems = filteredProducts();
  const visibleItems = allItems.slice(0, visibleCount);
  renderFeatured(allItems);
  renderStack();
  renderTable(visibleItems, allItems);
  renderCards(visibleItems, allItems);
  resultCount.textContent = `Showing ${visibleItems.length} of ${allItems.length} available ${categoryLabels[selectedCategory]} products`;
  loadMoreButton.hidden = visibleItems.length >= allItems.length;
  updateSortHeaders();
  updateCategoryTabs();
  updateCategoryLabel();
  lastControlState = currentControlState();
}

function formatRefreshTime(value) {
  if (!value) return "Refresh time unknown";
  return `Data refreshed ${new Date(value).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
  })} NZDT`;
}

async function loadProducts() {
  dataStatus.textContent = `Loading ${categoryLabels[selectedCategory]} data...`;
  try {
    const params = new URLSearchParams({
      sort: sortSelect.value,
      category: selectedCategory,
    });
    const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    products = payload.products ?? [];
    refreshedAt = payload.refreshedAt ?? null;
    dataStatus.textContent = `${formatRefreshTime(refreshedAt)}.`;
  } catch (error) {
    products = [];
    dataStatus.textContent = `Could not load product data: ${error.message}`;
  }
  resetAndRender();
}

function resetAndRender() {
  try {
    visibleCount = initialVisibleCount;
    render();
  } catch (error) {
    dataStatus.textContent = `Render failed: ${error.message}`;
    throw error;
  }
}

function currentControlState() {
  return [
    selectedCategory,
    sortSelect.value,
    retailerFilter?.value ?? "",
    minPackSizeFilter?.value ?? "",
    maxPackSizeFilter?.value ?? "",
    hideShippingUnknownFilter?.checked ? "shipping-confirmed" : "shipping-all",
    onlyCheckedTodayFilter?.checked ? "today" : "any-day",
    hideStaleFilter?.checked ? "fresh" : "with-stale",
  ].join("|");
}

function renderIfControlsChanged() {
  const nextControlState = currentControlState();
  if (nextControlState === lastControlState) return;
  resetAndRender();
}

window.resetAndRender = resetAndRender;

async function submitFeedback(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submitButton = form.querySelector("button[type='submit']");
  const payload = {
    feedbackType: data.get("feedbackType"),
    message: data.get("message"),
    category: selectedCategory,
    productName: data.get("productName"),
    sourceUrl: data.get("sourceUrl"),
    pagePath: `${window.location.pathname}${window.location.search}`,
  };

  feedbackStatus.textContent = "Sending feedback...";
  submitButton.disabled = true;
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok && response.status !== 202) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.recorded) {
      feedbackStatus.textContent = "Feedback is not connected yet. Please try again after the database update.";
      return;
    }
    form.reset();
    feedbackStatus.textContent = "Thanks. Feedback saved.";
  } catch (error) {
    feedbackStatus.textContent = `Could not send feedback: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
}

sortSelect.addEventListener("change", () => {
  trackAnalyticsEvent("sort_change", { source: "select" });
  resetAndRender();
});
[retailerFilter, minPackSizeFilter, maxPackSizeFilter, hideShippingUnknownFilter, onlyCheckedTodayFilter, hideStaleFilter].forEach((control) => {
  control?.addEventListener("change", () => {
    trackAnalyticsEvent("sort_change", { source: "filter", control: control.id });
    resetAndRender();
  });
});
featuredToggle?.addEventListener("click", () => {
  featuredPaused = !featuredPaused;
  updateFeaturedToggle();
  featuredRail.querySelector(".featured-track")?.classList.toggle("paused", featuredPaused);
});
categoryTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const nextCategory = button.dataset.category;
    if (!nextCategory || nextCategory === selectedCategory) return;
    const previousCategory = selectedCategory;
    selectedCategory = nextCategory;
    trackAnalyticsEvent("category_switch", { previousCategory });
    updateCategoryTabs();
    visibleCount = initialVisibleCount;
    loadProducts();
  });
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...categoryTabs];
    const currentIndex = tabs.indexOf(button);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowLeft"
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });
});
loadMoreButton.addEventListener("click", () => {
  visibleCount += loadMoreStep;
  render();
});
document.addEventListener("click", (event) => {
  const historyButton = event.target.closest("[data-history-action='toggle']");
  if (historyButton) {
    event.preventDefault();
    const source = historyButton.dataset.source;
    if (source) togglePriceHistory(source);
    return;
  }

  const outboundLink = event.target.closest("a[data-outbound]");
  if (outboundLink) trackOutboundClick(outboundLink);

  const button = event.target.closest("[data-stack-action]");
  if (!button) return;

  const source = button.dataset.source;
  const action = button.dataset.stackAction;
  if (!source || !action) return;

  if (action === "add") {
    const product = products.find((item) => item.source === source);
    if (product) addToStack(product);
    return;
  }
  if (action === "increment") updateStackQuantity(source, 1);
  if (action === "decrement") updateStackQuantity(source, -1);
  if (action === "remove") removeFromStack(source);
});
sortHeaders.forEach((button) => {
  button.addEventListener("click", () => {
    const current = currentSortParts();
    const key = button.dataset.sortKey;
    const direction = current.key === key && current.direction === "asc" ? "desc" : "asc";
    sortSelect.value = sortValueForKey(key, direction);
    trackAnalyticsEvent("sort_change", { source: "header", sortKey: key, direction });
    resetAndRender();
  });
});
if (feedbackForm) feedbackForm.addEventListener("submit", submitFeedback);
window.setInterval(renderIfControlsChanged, 150);
window.setInterval(loadProducts, 24 * 60 * 60 * 1000);

updateCategoryLabel();
trackAnalyticsEvent("page_view", { referrer: document.referrer });
loadProducts();
