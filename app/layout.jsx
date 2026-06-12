import "../src/styles.css";
import { SiteFooter } from "../components/SiteFooter.jsx";

export const metadata = {
  title: "StackScout - Supplement Compare NZ",
  description: "Compare NZ-accessible supplement products by delivered cost, pack size, reviews, and freshness.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
