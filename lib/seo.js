export const siteUrl = "https://stackscout.co.nz";
export const siteName = "StackScout";
export const defaultImage = `${siteUrl}/assets/stackscout-logo.svg`;

export const categoryPages = {
  creatine: {
    key: "creatine",
    path: "/creatine",
    label: "Creatine",
    productLabel: "creatine",
    title: "Creatine Price Comparison NZ",
    description:
      "Compare NZ creatine products by estimated delivered cost, pack size, freshness, retailer, and price per 100g.",
    h1: "Creatine price comparison NZ",
    summary:
      "Find better-value creatine from NZ-accessible retailers using estimated delivered total, pack size, freshness, and price per 100g.",
    primaryKeyword: "creatine price comparison nz",
  },
  protein: {
    key: "whey_protein",
    path: "/protein",
    label: "Whey Protein",
    productLabel: "whey protein",
    title: "Whey Protein Price Comparison NZ",
    description:
      "Compare NZ whey protein products by estimated delivered cost, pack size, freshness, retailer, and price per 100g.",
    h1: "Whey protein price comparison NZ",
    summary:
      "Compare whey protein options from NZ-accessible retailers by delivered estimate, tub size, product freshness, and price per 100g.",
    primaryKeyword: "whey protein price comparison nz",
  },
  pre_workout: {
    key: "pre_workout",
    path: "/pre-workout",
    label: "Pre-Workout",
    productLabel: "pre-workout",
    title: "Pre-Workout Price Comparison NZ",
    description:
      "Compare NZ pre-workout products by estimated delivered cost, pack size, freshness, retailer, and price per 100g.",
    h1: "Pre-workout price comparison NZ",
    summary:
      "Shortlist pre-workout products from NZ-accessible retailers using delivered estimates, pack size, availability, and freshness signals.",
    primaryKeyword: "pre workout price comparison nz",
  },
};

export const intentPages = {
  "best-creatine-nz": {
    path: "/best-creatine-nz",
    category: "creatine",
    title: "Best Value Creatine NZ",
    description:
      "Compare current NZ creatine options by estimated delivered value, retailer availability, pack size, and price per 100g.",
    h1: "Best value creatine in NZ",
    summary:
      "A data-led shortlist of NZ-accessible creatine products ranked by estimated delivered value, with freshness and shipping caveats visible.",
    angle: "best current value",
  },
  "cheap-creatine-nz": {
    path: "/cheap-creatine-nz",
    category: "creatine",
    title: "Cheap Creatine NZ",
    description:
      "Find cheap creatine options in NZ by comparing item price, estimated shipping, delivered total, and price per 100g.",
    h1: "Cheap creatine NZ",
    summary:
      "Cheap creatine is not always the lowest sticker price. Compare delivered total and price per 100g before choosing a retailer.",
    angle: "lowest delivered cost",
  },
  "where-to-buy-creatine-nz": {
    path: "/where-to-buy-creatine-nz",
    category: "creatine",
    title: "Where To Buy Creatine NZ",
    description:
      "See NZ-accessible retailers with creatine products and compare availability, delivered estimates, pack size, and price per 100g.",
    h1: "Where to buy creatine in NZ",
    summary:
      "Compare NZ-accessible creatine retailers in one place, then confirm final stock, shipping, and checkout price with the retailer.",
    angle: "retailer availability",
  },
};

export const publicSitemapPages = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  ...Object.values(categoryPages).map((page) => ({
    path: page.path,
    priority: 0.9,
    changeFrequency: "daily",
  })),
  ...Object.values(intentPages).map((page) => ({
    path: page.path,
    priority: 0.82,
    changeFrequency: "daily",
  })),
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.55, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.45, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.35, changeFrequency: "yearly" },
  { path: "/disclaimer", priority: 0.35, changeFrequency: "yearly" },
];

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).href;
}

export function pageMetadata({ title, description, path = "/", image = defaultImage }) {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      type: "website",
      images: [
        {
          url: image,
          alt: `${siteName} supplement comparison`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function jsonLdScript(data) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: defaultImage,
    description:
      "NZ supplement price comparison focused on estimated delivered value, retailer coverage, and product freshness.",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListJsonLd(products, path) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${siteName} comparison results`,
    url: absoluteUrl(path),
    itemListElement: products.slice(0, 12).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.product,
      url: product.source,
    })),
  };
}

export function faqJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
