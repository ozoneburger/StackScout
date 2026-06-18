import { JsonLd } from "../../components/JsonLd.jsx";
import { ContentPage } from "../../components/ContentPage.jsx";
import { faqJsonLd, pageMetadata } from "../../lib/seo.js";

const faqItems = [
  {
    question: "What does best value mean?",
    answer:
      "Best value means the lowest estimated delivered cost per 100g, so shoppers can compare small and large supplement packs more fairly.",
  },
  {
    question: "How current is the data?",
    answer:
      "StackScout refreshes product data regularly where reliable retailer sources are available. Prices, stock, shipping, and reviews are snapshots, not final checkout quotes.",
  },
  {
    question: "How does StackScout get product data?",
    answer:
      "StackScout checks NZ-accessible retailer sources such as product feeds, store platform data, product page metadata, and public product pages.",
  },
  {
    question: "What should I double-check before buying?",
    answer:
      "Check the retailer page for final shipping, rural fees, promo codes, stock, and product details before buying.",
  },
];

export const metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers about StackScout rankings, supplement price freshness, retailer checks, shipping estimates, and what to confirm before buying.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(faqItems)} />
      <ContentPage
        eyebrow="FAQ"
        title="Questions about StackScout"
        summary="Plain answers about rankings, data freshness, retailer checks, and what to confirm before buying."
      >
        <details open>
          <summary>{faqItems[0].question}</summary>
          <p>{faqItems[0].answer}</p>
        </details>
        <details open>
          <summary>{faqItems[1].question}</summary>
          <p>{faqItems[1].answer}</p>
        </details>
        <details>
          <summary>{faqItems[2].question}</summary>
          <p>{faqItems[2].answer} It extracts comparable basics like product name, pack size, item price, availability, review signals, and shipping rules.</p>
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
          <summary>{faqItems[3].question}</summary>
          <p>{faqItems[3].answer} StackScout is a shortlist tool, so the retailer checkout is still the source of truth before you buy.</p>
        </details>
      </ContentPage>
    </>
  );
}
