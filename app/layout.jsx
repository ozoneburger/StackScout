import "../src/styles.css";
import { JsonLd } from "../components/JsonLd.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { defaultImage, organizationJsonLd, siteName, siteUrl, websiteJsonLd } from "../lib/seo.js";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StackScout - Supplement Compare NZ",
    template: `%s | ${siteName}`,
  },
  description:
    "Compare NZ-accessible supplement products by delivered cost, pack size, reviews, freshness, and price per 100g.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "StackScout - Supplement Compare NZ",
    description:
      "Compare NZ-accessible supplement products by delivered cost, pack size, reviews, freshness, and price per 100g.",
    url: siteUrl,
    siteName,
    type: "website",
    images: [{ url: defaultImage, alt: "StackScout supplement comparison" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StackScout - Supplement Compare NZ",
    description:
      "Compare NZ-accessible supplement products by delivered cost, pack size, reviews, freshness, and price per 100g.",
    images: [defaultImage],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
