import { ContentPage } from "../../components/ContentPage.jsx";

export const metadata = {
  title: "FAQ - StackScout",
};

export default function FaqPage() {
  return (
    <ContentPage
      eyebrow="FAQ"
      title="Questions about StackScout"
      summary="Plain answers about rankings, data freshness, retailer checks, and what to confirm before buying."
    >
      <details open>
        <summary>What does best value mean?</summary>
        <p>Best value means the lowest estimated delivered cost per 100g. This helps compare small tubs and large tubs fairly.</p>
      </details>
      <details open>
        <summary>How current is the data?</summary>
        <p>StackScout refreshes product data regularly where reliable retailer sources are available. Prices, stock, shipping, and reviews are snapshots, not final checkout quotes.</p>
      </details>
      <details>
        <summary>How does StackScout get product data?</summary>
        <p>StackScout checks NZ-accessible retailer sources such as product feeds, store platform data, product page metadata, and public product pages. It extracts comparable basics like product name, pack size, item price, availability, review signals, and shipping rules.</p>
      </details>
      <details>
        <summary>How can I trust the comparison?</summary>
        <p>Prices and availability are only used when they can be parsed from clear retailer evidence. Products also need a valid pack size, plausible price, and the right format for the category, so capsules, bundles, samples, and unrelated products are filtered out.</p>
      </details>
      <details>
        <summary>What happens when a retailer page cannot be checked?</summary>
        <p>If a retailer page fails or returns data that looks wrong, StackScout keeps the last saved product information and labels it as stale instead of treating it as fresh. Stale or unavailable products should not be treated as the best current deal.</p>
      </details>
      <details>
        <summary>What should I double-check before buying?</summary>
        <p>Check the retailer page for final shipping, rural fees, promo codes, stock, and product details. StackScout is a shortlist tool, so the retailer checkout is still the source of truth before you buy.</p>
      </details>
    </ContentPage>
  );
}
