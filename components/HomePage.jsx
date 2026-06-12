import { estimatedShipping, estimatedTotal, pricePer100g } from "../lib/stackscout-server.js";

const money = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

const categoryLabels = {
  creatine: "creatine",
  protein: "whey protein",
  pre_workout: "pre-workout",
};

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
  return safeUrl(value) === "#" ? "/assets/product-placeholder.svg" : value;
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

function ProductRow({ product }) {
  const source = safeUrl(product.source);
  return (
    <tr>
      <td>
        <a className="retailer-cell row-link" href={source} target="_blank" rel="noreferrer" data-outbound="true" data-click-location="table-retailer" data-source={product.source}>
          <img src={imageUrl(product.image)} alt={`${product.retailer} logo`} loading="lazy" />
          <div>
            <div className="retailer">{product.retailer}</div>
          </div>
        </a>
      </td>
      <td>
        <a className="product-cell row-link" href={source} target="_blank" rel="noreferrer" data-outbound="true" data-click-location="table-product" data-source={product.source}>
          <img src={imageUrl(product.productImage ?? product.image)} alt={product.product} loading="lazy" />
          <div>
            <strong>{product.product}</strong>
            <div className={`tag ${product.rankingEligible === false ? "warn" : ""}`}>
              {product.rankingWarning ?? product.confidence ?? "Product data loaded."}
            </div>
          </div>
        </a>
      </td>
      <td>
        <div className="metric metric-size">
          <strong>{product.sizeGrams.toLocaleString()}g</strong>
          <span>pack size</span>
        </div>
      </td>
      <td>{formatReviews(product)}</td>
      <td>
        <div className="metric">
          <strong>{money.format(product.price)}</strong>
          <span>item price</span>
        </div>
      </td>
      <td>{formatShipping(product)}</td>
      <td>
        <div className="metric metric-total">
          <strong>{money.format(estimatedTotal(product))}</strong>
          <span>incl. shipping estimate</span>
        </div>
      </td>
      <td>
        <div className="metric metric-value">
          <strong>{money.format(pricePer100g(product))}</strong>
          <span>per 100g</span>
        </div>
      </td>
      <td>
        <button className="stack-add" type="button" data-stack-action="add" data-source={product.source}>
          Add to stack
        </button>
      </td>
    </tr>
  );
}

function ProductCard({ product }) {
  return (
    <article className="card">
      <div className="card-head">
        <img src={imageUrl(product.image)} alt={`${product.retailer} logo`} loading="lazy" />
        <h3>{product.retailer}</h3>
      </div>
      <img className="card-product-image" src={imageUrl(product.productImage ?? product.image)} alt={product.product} loading="lazy" />
      <a className="card-product-link" href={safeUrl(product.source)} target="_blank" rel="noreferrer" data-outbound="true" data-click-location="card-product" data-source={product.source}>
        {product.product}
      </a>
      <div className="meta">
        <div><span>Pack size</span><strong>{product.sizeGrams.toLocaleString()}g</strong></div>
        <div><span>Item price</span><strong>{money.format(product.price)}</strong></div>
        <div><span>Delivered total</span><strong>{money.format(estimatedTotal(product))}</strong></div>
        <div><span>Price per 100g</span><strong className="value">{money.format(pricePer100g(product))}</strong></div>
      </div>
      <p>{formatShipping(product)}</p>
      <button className="stack-add" type="button" data-stack-action="add" data-source={product.source}>Add to stack</button>
    </article>
  );
}

export function HomePage({ initialProducts, refreshedAt, selectedCategory = "creatine" }) {
  const visibleProducts = initialProducts.slice(0, 12);
  const refreshText = refreshedAt
    ? `Data refreshed ${new Date(refreshedAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })} NZDT.`
    : "Refresh time unknown.";

  return (
    <main className="app">
      <section className="toolbar" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Build your stack for less with NZ's supplement price checker</p>
          <h1 id="page-title" className="brand-heading">
            <img src="/assets/stackscout-logo.svg" alt="StackScout" width="920" height="220" />
          </h1>
          <p className="summary">
            Compare <span id="category-cycle" className="category-cycle">{categoryLabels[selectedCategory]}</span> by real cost, size, reviews, shipping, and delivered total.
          </p>
          <p className="data-status" id="data-status">{refreshText}</p>
        </div>
      </section>

      <nav className="category-tabs" role="tablist" aria-label="Supplement category">
        <button className="category-tab active" type="button" role="tab" aria-selected="true" aria-controls="results-panel" data-category="creatine">Creatine</button>
        <button className="category-tab" type="button" role="tab" aria-selected="false" aria-controls="results-panel" data-category="protein">Whey protein</button>
        <button className="category-tab" type="button" role="tab" aria-selected="false" aria-controls="results-panel" data-category="pre_workout">Pre-workout</button>
      </nav>

      <div className="controls results-controls" aria-label="Sort and display controls">
        <label className="sort-control">
          <span className="control-label-row">
            Sort
            <span className="value-info">
              <button className="info-button" type="button" aria-label="How best value is calculated" aria-describedby="value-tooltip">i</button>
              <span className="value-tooltip" id="value-tooltip" role="tooltip">
                Best value ranks available products by estimated delivered price per 100g: (item price + estimated shipping) / pack grams * 100. Unknown shipping is shown and ranked after confirmed shipping.
              </span>
            </span>
          </span>
          <select id="sort-select" defaultValue="value">
            <option value="value">Best value</option>
            <option value="value-desc">Highest price per 100g</option>
            <option value="total-asc">Lowest delivered total</option>
            <option value="total-desc">Highest delivered total</option>
            <option value="price-asc">Lowest item price</option>
            <option value="price-desc">Highest item price</option>
            <option value="size-desc">Largest pack size</option>
            <option value="size-asc">Smallest pack size</option>
          </select>
        </label>
        <label>
          Retailer
          <select id="retailer-filter" defaultValue="">
            <option value="">All retailers</option>
          </select>
        </label>
        <fieldset className="pack-filter">
          <legend>Pack size</legend>
          <label>Min grams<input id="min-pack-size" type="number" min="0" step="50" inputMode="numeric" placeholder="Any" /></label>
          <label>Max grams<input id="max-pack-size" type="number" min="0" step="50" inputMode="numeric" placeholder="Any" /></label>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Quality filters</legend>
          <label><input id="hide-shipping-unknown" type="checkbox" /> Hide shipping unknown</label>
          <label><input id="only-checked-today" type="checkbox" /> Checked today only</label>
          <label><input id="hide-stale" type="checkbox" defaultChecked /> Hide stale data</label>
        </fieldset>
      </div>

      <section id="results-panel" className="results-panel" role="tabpanel" aria-label="Supplement results">
        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Retailer</th>
                <th>Product</th>
                <th><button className="sort-header" type="button" data-sort-key="size" aria-label="Sort by pack size">Pack size <span data-sort-indicator aria-hidden="true"></span></button></th>
                <th>Reviews</th>
                <th><button className="sort-header" type="button" data-sort-key="price" aria-label="Sort by item price">Item price <span data-sort-indicator aria-hidden="true"></span></button></th>
                <th>Shipping</th>
                <th><button className="sort-header" type="button" data-sort-key="total" aria-label="Sort by delivered total">Delivered total <span data-sort-indicator aria-hidden="true"></span></button></th>
                <th><button className="sort-header sort-header-stacked" type="button" data-sort-key="value" aria-label="Sort by price per 100 grams. Formula: estimated delivered total divided by pack grams times 100."><span>Price per 100g</span><small>delivered / g * 100</small><span data-sort-indicator aria-hidden="true"></span></button></th>
                <th>My stack</th>
              </tr>
            </thead>
            <tbody id="results-body">
              {visibleProducts.map((product) => <ProductRow key={product.source} product={product} />)}
            </tbody>
          </table>
        </section>

        <section className="cards" id="cards" aria-label="Supplement cards">
          {visibleProducts.map((product) => <ProductCard key={product.source} product={product} />)}
        </section>

        <div className="load-row">
          <span id="result-count" aria-live="polite">Showing {visibleProducts.length} of {initialProducts.length} available {categoryLabels[selectedCategory]} products</span>
          <button id="load-more-button" type="button" hidden={visibleProducts.length >= initialProducts.length}>Load more</button>
        </div>
      </section>

      <section className="stack-panel" aria-labelledby="stack-title">
        <div className="stack-head">
          <div>
            <h2 id="stack-title">My stack</h2>
            <p id="stack-summary">No products added yet.</p>
          </div>
          <div className="stack-actions">
            <span>Item subtotal <strong id="stack-total">$0.00</strong></span>
            <span>Estimated delivered <strong id="stack-delivered-total">$0.00</strong></span>
          </div>
        </div>
        <div className="stack-items" id="stack-items"><p className="stack-empty">Add products to compare a rough stack total.</p></div>
      </section>

      <section className="featured-panel" aria-label="Featured products">
        <div className="featured-head">
          <h2>Featured comparisons</h2>
          <button id="featured-toggle" className="featured-toggle" type="button" aria-pressed="false" aria-label="Pause carousel">
            <svg className="icon-pause" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"></path></svg>
            <svg className="icon-play" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
          </button>
        </div>
        <div className="featured-rail" id="featured-rail"></div>
      </section>

      <section className="feedback-panel" aria-labelledby="feedback-title">
        <h2 id="feedback-title">Help improve StackScout</h2>
        <form id="feedback-form">
          <label>What should we check?<select name="feedbackType"><option value="missing_product">Missing product</option><option value="missing_retailer">Missing retailer</option><option value="wrong_price">Wrong price</option><option value="wrong_stock">Wrong stock</option><option value="general">General feedback</option></select></label>
          <label>Details<textarea name="message" rows="4" maxLength="1200" placeholder="Tell us what is missing or wrong." required aria-describedby="feedback-status"></textarea></label>
          <div className="feedback-grid">
            <label>Product or retailer<input name="productName" maxLength="260" placeholder="Optional" /></label>
            <label>Link<input name="sourceUrl" type="url" maxLength="1200" placeholder="Optional retailer URL" aria-describedby="feedback-status" /></label>
          </div>
          <button type="submit">Send feedback</button>
          <p className="feedback-status" id="feedback-status" aria-live="polite"></p>
        </form>
      </section>

      <section className="faq" aria-label="FAQ">
        <h2>FAQ</h2>
        <details open><summary>What does best value mean?</summary><p>Best value means the lowest estimated delivered cost per 100g. This helps compare small tubs and large tubs fairly.</p></details>
        <details open><summary>How current is the data?</summary><p>StackScout refreshes product data regularly where reliable retailer sources are available. Prices, stock, shipping, and reviews are snapshots, not final checkout quotes.</p></details>
        <details><summary>How does StackScout get product data?</summary><p>StackScout checks NZ-accessible retailer sources such as product feeds, store platform data, product page metadata, and public product pages. It extracts comparable basics like product name, pack size, item price, availability, review signals, and shipping rules.</p></details>
        <details><summary>How can I trust the comparison?</summary><p>Prices and availability are only used when they can be parsed from clear retailer evidence. Products also need a valid pack size, plausible price, and the right format for the category, so capsules, bundles, samples, and unrelated products are filtered out.</p></details>
        <details><summary>What happens when a retailer page cannot be checked?</summary><p>If a retailer page fails or returns data that looks wrong, StackScout keeps the last saved product information and labels it as stale instead of treating it as fresh. Stale or unavailable products should not be treated as the best current deal.</p></details>
        <details><summary>What should I double-check before buying?</summary><p>Check the retailer page for final shipping, rural fees, promo codes, stock, and product details. StackScout is a shortlist tool, so the retailer checkout is still the source of truth before you buy.</p></details>
      </section>
    </main>
  );
}
