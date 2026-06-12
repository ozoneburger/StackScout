import { ContentPage } from "../../components/ContentPage.jsx";

export const metadata = {
  title: "About - StackScout",
};

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="What StackScout does"
      summary="StackScout helps NZ shoppers compare supplement products by estimated delivered value, not just sticker price."
    >
      <h2>Purpose</h2>
      <p>
        StackScout compares product size, item price, estimated shipping, delivered total, reviews, and freshness signals so shoppers can shortlist better-value supplement options.
      </p>

      <h2>What it is not</h2>
      <p>
        StackScout is not a retailer, medical adviser, nutrition adviser, or checkout provider. It does not sell products or guarantee that a product is suitable for you.
      </p>

      <h2>How to use it</h2>
      <p>
        Use StackScout to narrow your options, then check the retailer page before buying. Retailers control final prices, shipping, stock, promo codes, product claims, and checkout terms.
      </p>
    </ContentPage>
  );
}
