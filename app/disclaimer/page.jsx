import { ContentPage } from "../../components/ContentPage.jsx";

export const metadata = {
  title: "Disclaimer - StackScout",
};

export default function DisclaimerPage() {
  return (
    <ContentPage
      eyebrow="Disclaimer"
      title="Disclaimer"
      summary="StackScout is a comparison and shortlist tool. Retailer checkout pages remain the source of truth."
    >
      <h2>Price and availability</h2>
      <p>
        StackScout takes reasonable care when collecting and presenting product data, but prices, shipping, stock, promotions, reviews, and product details can change without notice. Always confirm the final details with the retailer before buying.
      </p>

      <h2>Shipping estimates</h2>
      <p>
        Delivered totals use estimated shipping where StackScout can identify a usable shipping rule or amount. Rural delivery, address-specific fees, free-shipping thresholds, promo codes, and checkout rules may change the final total.
      </p>

      <h2>Retailer links</h2>
      <p>
        Links take you to third-party retailer websites. StackScout does not control those websites, their checkout process, product claims, policies, or fulfilment.
      </p>

      <h2>No health advice</h2>
      <p>
        StackScout does not provide medical, nutrition, supplement, fitness, or safety advice. Product rankings are based on comparison data, not suitability for your body, goals, health conditions, or medication use.
      </p>

      <h2>No purchase guarantee</h2>
      <p>
        A product appearing on StackScout does not mean it is endorsed, safe for you, in stock, or available at the displayed price. Check labels, ingredients, retailer terms, and final checkout details before purchasing.
      </p>
    </ContentPage>
  );
}
