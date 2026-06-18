import Script from "next/script";
import { JsonLd } from "./JsonLd.jsx";
import { HomePage } from "./HomePage.jsx";
import { IntentSeoPanel } from "./SeoPanels.jsx";
import { productsPayload } from "../lib/stackscout-server.js";
import { breadcrumbJsonLd, categoryPages, itemListJsonLd } from "../lib/seo.js";

export async function IntentComparisonPage({ page }) {
  const categoryPage = categoryPages[page.category];
  const payload = await productsPayload(new URL(`http://localhost/api/products?category=${page.category}&sort=value`));
  const products = payload.products ?? [];
  const initialScript = JSON.stringify({ products, refreshedAt: payload.refreshedAt ?? null }).replaceAll("<", "\\u003c");

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "StackScout", path: "/" }, { name: page.h1, path: page.path }])} />
      <JsonLd data={itemListJsonLd(products, page.path)} />
      <HomePage
        initialProducts={products}
        refreshedAt={payload.refreshedAt}
        selectedCategory={page.category}
        seoContent={<IntentSeoPanel page={page} categoryPage={categoryPage} products={products} refreshedAt={payload.refreshedAt} />}
      />
      <Script id="stackscout-initial-products" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `window.__STACKSCOUT_INITIAL_PRODUCTS__ = ${initialScript};` }} />
      <Script src="/src/app.js?v=seo-1" strategy="afterInteractive" />
    </>
  );
}
