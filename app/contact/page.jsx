import { ContentPage } from "../../components/ContentPage.jsx";

export const metadata = {
  title: "Contact - StackScout",
};

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Contact"
      title="Contact StackScout"
      summary="Use this for enquiries, retailer corrections, missing products, or data issues."
    >
      <h2>Email</h2>
      <p>
        For enquiries, email <a href="mailto:rob.overtime.ai@gmail.com">rob.overtime.ai@gmail.com</a>.
      </p>

      <h2>Product corrections</h2>
      <p>
        If a price, stock status, shipping estimate, or product detail looks wrong, include the retailer name, product name, and retailer URL so it can be checked.
      </p>
    </ContentPage>
  );
}
