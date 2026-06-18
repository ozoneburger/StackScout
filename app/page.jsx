import Script from "next/script";
import { JsonLd } from "../components/JsonLd.jsx";
import { HomePage } from "../components/HomePage.jsx";
import { productsPayload } from "../lib/stackscout-server.js";
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "../lib/seo.js";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "StackScout - Supplement Compare NZ",
  description:
    "Compare NZ creatine, protein, pre-workout, and electrolyte products by estimated delivered cost, pack size, reviews, freshness, and price per 100g.",
  path: "/",
});

export default async function Page() {
  const payload = await productsPayload(new URL("http://localhost/api/products?category=creatine&sort=value"));
  const initialScript = JSON.stringify({
    products: payload.products ?? [],
    refreshedAt: payload.refreshedAt ?? null,
  }).replaceAll("<", "\\u003c");

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "StackScout", path: "/" }])} />
      <JsonLd data={itemListJsonLd(payload.products ?? [], "/")} />
      <HomePage initialProducts={payload.products ?? []} refreshedAt={payload.refreshedAt} selectedCategory="creatine" />
      <Script
        id="stackscout-initial-products"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.__STACKSCOUT_INITIAL_PRODUCTS__ = ${initialScript};`,
        }}
      />
      <Script src="/src/app.js?v=seo-1" strategy="afterInteractive" />
    </>
  );
}
