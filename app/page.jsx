import Script from "next/script";
import { HomePage } from "../components/HomePage.jsx";
import { productsPayload } from "../lib/stackscout-server.js";

export const dynamic = "force-dynamic";

export default async function Page() {
  const payload = await productsPayload(new URL("http://localhost/api/products?category=creatine&sort=value"));
  const initialScript = JSON.stringify({
    products: payload.products ?? [],
    refreshedAt: payload.refreshedAt ?? null,
  }).replaceAll("<", "\\u003c");

  return (
    <>
      <HomePage initialProducts={payload.products ?? []} refreshedAt={payload.refreshedAt} selectedCategory="creatine" />
      <Script
        id="stackscout-initial-products"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.__STACKSCOUT_INITIAL_PRODUCTS__ = ${initialScript};`,
        }}
      />
      <Script src="/src/app.js?v=next-migration-1" strategy="afterInteractive" />
    </>
  );
}
