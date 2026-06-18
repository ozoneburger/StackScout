const money = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

function freshnessText(refreshedAt) {
  if (!refreshedAt) return "Refresh time unknown.";
  return `Comparison data refreshed ${new Date(refreshedAt).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
  })} NZ time.`;
}

function formatPackSize(sizeGrams) {
  if (!Number.isFinite(sizeGrams)) return "N/A";
  if (sizeGrams < 1000) return `${sizeGrams.toLocaleString()}g`;
  return `${(sizeGrams / 1000).toLocaleString("en-NZ", { maximumFractionDigits: 2 })} kg`;
}

function productSummary(product) {
  if (!product) return null;
  return `${product.product} from ${product.retailer}: ${money.format(product.deliveredTotal)} estimated delivered, ${money.format(product.pricePer100g)} per 100g, ${formatPackSize(product.sizeGrams)} pack.`;
}

export function CategorySeoPanel({ page, products, refreshedAt }) {
  const topProducts = products.slice(0, 3);
  const retailerCount = new Set(products.map((product) => product.retailer)).size;
  return (
    <section className="seo-panel" aria-labelledby={`${page.key}-seo-title`}>
      <div>
        <p className="eyebrow">NZ supplement comparison</p>
        <h2 id={`${page.key}-seo-title`}>{page.h1}</h2>
        <p>
          StackScout compares {page.productLabel} products from NZ-accessible retailers by estimated delivered total, pack size, freshness, and price per 100g. The retailer checkout remains the source of truth for stock, rural delivery, promo codes, and final shipping.
        </p>
      </div>

      <div className="seo-grid">
        <article>
          <h3>What this page is good for</h3>
          <p>
            Use it to shortlist {page.productLabel} options before visiting retailers. Current results cover {products.length} available products from {retailerCount} retailers where StackScout has usable data.
          </p>
        </article>
        <article>
          <h3>How value is ranked</h3>
          <p>
            Best value uses estimated delivered price per 100g, then delivered total, pack size, and freshness. Products with stale data or unknown shipping should be treated cautiously.
          </p>
        </article>
        <article>
          <h3>Freshness</h3>
          <p>{freshnessText(refreshedAt)}</p>
        </article>
      </div>

      {topProducts.length ? (
        <div className="seo-list">
          <h3>Current comparison signals</h3>
          <ul>
            {topProducts.map((product) => (
              <li key={product.source}>{productSummary(product)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function IntentSeoPanel({ page, categoryPage, products, refreshedAt }) {
  const topProducts = products.slice(0, 5);
  return (
    <section className="seo-panel" aria-labelledby={`${page.path.slice(1)}-seo-title`}>
      <div>
        <p className="eyebrow">Buyer-intent guide</p>
        <h2 id={`${page.path.slice(1)}-seo-title`}>{page.h1}</h2>
        <p>
          This page is built from StackScout comparison data, not generic supplement rankings. It focuses on {page.angle}, retailer availability, estimated delivered cost, and transparent caveats for NZ shoppers.
        </p>
      </div>

      <div className="seo-grid">
        <article>
          <h3>Best next check</h3>
          <p>
            Visit the retailer page before buying. Final price can change because of address-specific shipping, rural delivery, promo codes, stock status, and checkout rules.
          </p>
        </article>
        <article>
          <h3>Related comparison</h3>
          <p>
            For the full category table, use the <a href={categoryPage.path}>{categoryPage.label} comparison page</a>.
          </p>
        </article>
        <article>
          <h3>Freshness</h3>
          <p>{freshnessText(refreshedAt)}</p>
        </article>
      </div>

      {topProducts.length ? (
        <div className="seo-list">
          <h3>Products currently worth checking</h3>
          <ul>
            {topProducts.map((product) => (
              <li key={product.source}>{productSummary(product)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
