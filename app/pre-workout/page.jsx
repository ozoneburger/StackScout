import Script from "next/script";
import { JsonLd } from "../../components/JsonLd.jsx";
import { HomePage } from "../../components/HomePage.jsx";
import { CategorySeoPanel } from "../../components/SeoPanels.jsx";
import { productsPayload } from "../../lib/stackscout-server.js";
import { breadcrumbJsonLd, categoryPages, itemListJsonLd, pageMetadata } from "../../lib/seo.js";

const page = categoryPages.pre_workout;

export const dynamic = "force-dynamic";
export const metadata = pageMetadata(page);

export default async function PreWorkoutPage() {
  const payload = await productsPayload(new URL("http://localhost/api/products?category=pre_workout&sort=value"));
  const products = payload.products ?? [];
  const initialScript = JSON.stringify({ products, refreshedAt: payload.refreshedAt ?? null }).replaceAll("<", "\\u003c");

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "StackScout", path: "/" }, { name: page.label, path: page.path }])} />
      <JsonLd data={itemListJsonLd(products, page.path)} />
      <HomePage
        initialProducts={products}
        refreshedAt={payload.refreshedAt}
        selectedCategory="pre_workout"
        seoContent={<CategorySeoPanel page={page} products={products} refreshedAt={payload.refreshedAt} />}
      />
      <Script id="stackscout-initial-products" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `window.__STACKSCOUT_INITIAL_PRODUCTS__ = ${initialScript};` }} />
      <Script src="/src/app.js?v=seo-1" strategy="afterInteractive" />
    </>
  );
}
