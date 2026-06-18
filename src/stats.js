const statusEl = document.querySelector("#stats-status");
const totalEl = document.querySelector("#stat-total");
const credibleEl = document.querySelector("#stat-credible");
const duplicatesEl = document.querySelector("#stat-duplicates");
const sevenEl = document.querySelector("#stat-7");
const pageViewsEl = document.querySelector("#stat-page-views");
const stackAddsEl = document.querySelector("#stat-stack-adds");
const retailersEl = document.querySelector("#stats-retailers");
const retailerCategoriesEl = document.querySelector("#stats-retailer-categories");
const productsEl = document.querySelector("#stats-products");
const categoriesEl = document.querySelector("#stats-categories");
const locationsEl = document.querySelector("#stats-locations");
const eventsEl = document.querySelector("#stats-events");
const eventCategoriesEl = document.querySelector("#stats-event-categories");
const recentEl = document.querySelector("#stats-recent");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
  });
}

function renderList(element, items, emptyText = "No data yet.") {
  if (!items?.length) {
    element.innerHTML = `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
    return;
  }

  element.innerHTML = `
    <div class="stat-list">
      ${items
        .map(
          (item) => `
            <div>
              <span>${escapeHtml(item.label)}</span>
              <strong>${Number(item.count ?? 0).toLocaleString()}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderRecent(items) {
  if (!items?.length) {
    recentEl.innerHTML = `<p class="empty-state">No outbound clicks recorded yet.</p>`;
    return;
  }

  recentEl.innerHTML = `
    <div class="recent-clicks">
      ${items
        .map(
          (item) => `
            <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">
              <strong>${escapeHtml(item.productName)}</strong>
              <span>${escapeHtml(item.retailer)} · ${escapeHtml(item.category)} · ${escapeHtml(item.clickLocation)}${
                item.credible === false ? " · duplicate" : ""
              }</span>
              <em>${escapeHtml(formatDate(item.observedAt))} NZDT</em>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderRetailerCategories(items) {
  if (!items?.length) {
    retailerCategoriesEl.innerHTML = `<p class="empty-state">No retailer/category clicks recorded yet.</p>`;
    return;
  }

  retailerCategoriesEl.innerHTML = `
    <div class="retailer-category-list">
      ${items
        .map(
          (item) => `
            <div>
              <strong>${escapeHtml(item.retailer)}</strong>
              <span>Total ${Number(item.total ?? 0).toLocaleString()}</span>
              <em>Creatine ${Number(item.creatine ?? 0).toLocaleString()}</em>
              <em>Whey ${Number(item.whey_protein ?? 0).toLocaleString()}</em>
              <em>Isolate ${Number(item.protein_isolate ?? 0).toLocaleString()}</em>
              <em>Plant ${Number(item.plant_based_protein ?? 0).toLocaleString()}</em>
              <em>Gainer ${Number(item.mass_gainer ?? 0).toLocaleString()}</em>
              <em>Bars ${Number(item.protein_bars ?? 0).toLocaleString()}</em>
              <em>Pre-workout ${Number(item.pre_workout ?? 0).toLocaleString()}</em>
              <em>Non-stim ${Number(item.non_stim_pre_workout ?? 0).toLocaleString()}</em>
              <em>Electrolytes ${Number(item.electrolytes ?? 0).toLocaleString()}</em>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const stats = await response.json();
    if (!stats.enabled) {
      statusEl.textContent = stats.error ?? "Stats are not available yet.";
      return;
    }

    totalEl.textContent = Number(stats.totalClicks ?? 0).toLocaleString();
    credibleEl.textContent = Number(stats.credibleClicks ?? 0).toLocaleString();
    duplicatesEl.textContent = Number(stats.duplicateClicks ?? 0).toLocaleString();
    sevenEl.textContent = Number(stats.credibleClicksLast7Days ?? 0).toLocaleString();
    pageViewsEl.textContent = Number(stats.pageViews ?? 0).toLocaleString();
    stackAddsEl.textContent = Number(stats.stackAdds ?? 0).toLocaleString();
    renderRetailerCategories(stats.byRetailerCategory);
    renderList(retailersEl, stats.byRetailer);
    renderList(productsEl, stats.byProduct);
    renderList(categoriesEl, stats.byCategory);
    renderList(locationsEl, stats.byClickLocation);
    renderList(eventsEl, stats.byEventType);
    renderList(eventCategoriesEl, stats.byAnalyticsCategory);
    renderRecent(stats.recentClicks);
    statusEl.textContent = "Stats loaded from first-party clicks and product interaction events.";
  } catch (error) {
    statusEl.textContent = `Could not load stats: ${error.message}`;
  }
}

loadStats();
