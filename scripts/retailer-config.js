const categorySearchTerms = {
  creatine: ["creatine", "creatine monohydrate"],
  protein: ["whey protein", "whey isolate"],
  pre_workout: ["pre workout", "pre-workout"],
};

function shopifySearchSources(baseUrl, categories = Object.keys(categorySearchTerms)) {
  return categories.flatMap((category) =>
    categorySearchTerms[category].map((term) => ({
      category,
      adapterType: "shopifySearchSuggest",
      url: `${baseUrl}/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product&resources[limit]=20`,
    })),
  );
}

function shopifyCollectionSource(category, url) {
  return {
    category,
    adapterType: "shopifyCollection",
    url,
  };
}

function chemistWarehouseSearchSources() {
  return Object.entries({
    creatine: "creatine",
    protein: "whey protein",
    pre_workout: "pre workout",
  }).map(([category, term]) => ({
    category,
    adapterType: "chemistWarehouseSearch",
    url: `https://www.chemistwarehouse.co.nz/searchapiv2/search?&identifier=nz&fh_location=//catalog01/en_AU/categories%3C{catalog01_chemnz}/$s=${encodeURIComponent(term).replaceAll("%20", "+")}&fh_start_index=0`,
  }));
}

function xplosivSources() {
  return [
    { category: "creatine", adapterType: "genericHtml", url: "https://xplosiv.nz/creatine.html" },
    {
      category: "protein",
      adapterType: "genericHtml",
      url: "https://xplosiv.nz/catalogsearch/result/?q=whey+protein",
    },
    {
      category: "pre_workout",
      adapterType: "genericHtml",
      url: "https://xplosiv.nz/catalogsearch/result/?q=pre+workout",
    },
  ];
}

function sprintFitSources() {
  return [
    {
      category: "creatine",
      adapterType: "genericHtml",
      url: "https://www.sprintfit.co.nz/products/category/315/creatine",
    },
    {
      category: "protein",
      adapterType: "genericHtml",
      url: "https://www.sprintfit.co.nz/products/search?search=whey%20protein",
    },
    {
      category: "pre_workout",
      adapterType: "genericHtml",
      url: "https://www.sprintfit.co.nz/products/search?search=pre%20workout",
    },
  ];
}

function nzProteinSources() {
  return ["creatine", "protein", "pre_workout"].map((category) => ({
    category,
    adapterType: "genericHtml",
    url: "https://www.nzprotein.co.nz/products",
  }));
}

export const retailerConfigs = [
  {
    name: "Sportsfuel",
    baseUrl: "https://www.sportsfuel.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: [
      shopifyCollectionSource(
        "creatine",
        "https://www.sportsfuel.co.nz/collections/creatine-monohydrate/products.json?limit=50",
      ),
      ...shopifySearchSources("https://www.sportsfuel.co.nz", ["protein", "pre_workout"]),
    ],
    maxCandidates: 25,
    shipping: {
      cost: 0,
      freeThreshold: 60,
      note: "Free NZ-wide delivery over $60.",
    },
    enabled: true,
    notes: "Shopify structured discovery. Creatine uses collection; protein and pre-workout use search suggest.",
  },
  {
    name: "Supplements.co.nz",
    baseUrl: "https://www.supplements.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: [
      shopifyCollectionSource("creatine", "https://www.supplements.co.nz/collections/creatine/products.json?limit=50"),
      ...shopifySearchSources("https://www.supplements.co.nz", ["protein", "pre_workout"]),
    ],
    maxCandidates: 25,
    shipping: {
      cost: 0,
      freeThreshold: 60,
      note: "Free NZ-wide shipping over $60; rural surcharge may apply.",
    },
    enabled: true,
    notes: "Shopify structured discovery. Creatine uses collection; protein and pre-workout use search suggest.",
  },
  {
    name: "Musashi NZ",
    baseUrl: "https://nz.musashi.com",
    adapterType: "shopifySearchSuggest",
    discoverySources: shopifySearchSources("https://nz.musashi.com"),
    maxCandidates: 25,
    shipping: {
      cost: 4,
      freeThreshold: 60,
      note: "Standard NZ shipping under $60; free shipping over $60.",
    },
    enabled: true,
    notes: "Shopify search suggest across StackScout MVP categories.",
  },
  {
    name: "NZ Muscle",
    baseUrl: "https://www.nzmuscle.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: shopifySearchSources("https://www.nzmuscle.co.nz"),
    maxCandidates: 25,
    shipping: {
      cost: 3.99,
      freeThreshold: 70,
      note: "Flat standard shipping under $70; free standard shipping over $70.",
    },
    enabled: true,
    notes: "Shopify search suggest plus product JSON enrichment exposes variant sizes.",
  },
  {
    name: "Chemist Warehouse",
    baseUrl: "https://www.chemistwarehouse.co.nz",
    adapterType: "chemistWarehouseSearch",
    discoverySources: chemistWarehouseSearchSources(),
    maxCandidates: 25,
    shipping: {
      cost: 5.99,
      freeThreshold: 100,
      note: "Non-rural standard shipping; click & collect free.",
    },
    enabled: true,
    notes: "Uses Chemist Warehouse product discovery API exposed by the search page.",
  },
  {
    name: "HealthPost",
    baseUrl: "https://www.healthpost.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: shopifySearchSources("https://www.healthpost.co.nz"),
    maxCandidates: 25,
    shipping: {
      cost: 4.9,
      freeThreshold: 79,
      note: "Estimated NZ shipping; confirm final shipping at checkout.",
    },
    enabled: true,
    notes: "Shopify search suggest returns structured product candidates.",
  },
  {
    name: "Bargain Chemist",
    baseUrl: "https://www.bargainchemist.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: shopifySearchSources("https://www.bargainchemist.co.nz"),
    maxCandidates: 25,
    shipping: {
      cost: 6.99,
      freeThreshold: 99,
      note: "Estimated NZ shipping; confirm final shipping at checkout.",
    },
    enabled: true,
    notes: "Shopify search suggest returns structured product candidates.",
  },
  {
    name: "BN Healthy",
    baseUrl: "https://www.bnhealthy.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: shopifySearchSources("https://www.bnhealthy.co.nz"),
    maxCandidates: 25,
    shipping: {
      cost: 9.99,
      freeThreshold: 150,
      note: "Estimated NZ shipping; confirm final shipping at checkout.",
    },
    enabled: true,
    notes: "Shopify search suggest returns structured product candidates.",
  },
  {
    name: "Net Pharmacy",
    baseUrl: "https://www.netpharmacy.co.nz",
    adapterType: "shopifySearchSuggest",
    discoverySources: shopifySearchSources("https://www.netpharmacy.co.nz"),
    maxCandidates: 25,
    shipping: {
      cost: 7.5,
      freeThreshold: 100,
      note: "Estimated NZ shipping; confirm final shipping at checkout.",
    },
    enabled: true,
    notes: "Shopify search suggest returns structured product candidates.",
  },
  {
    name: "Xplosiv Supplements",
    baseUrl: "https://xplosiv.nz",
    adapterType: "genericHtml",
    discoverySources: xplosivSources(),
    maxCandidates: 25,
    shipping: {
      cost: 3.99,
      freeThreshold: 100,
      note: "Flat fee under $100; free nationwide over $100.",
    },
    enabled: true,
    notes: "Magento HTML/search discovery across StackScout MVP categories.",
  },
  {
    name: "Sprint Fit",
    baseUrl: "https://www.sprintfit.co.nz",
    adapterType: "genericHtml",
    discoverySources: sprintFitSources(),
    maxCandidates: 25,
    shipping: {
      cost: null,
      freeThreshold: 60,
      note: "Free NZ shipping over $60; under-threshold cost needs confirmation.",
    },
    enabled: true,
    notes: "Readable category/search HTML with product cards and prices.",
  },
  {
    name: "NZ Protein",
    baseUrl: "https://www.nzprotein.co.nz",
    adapterType: "genericHtml",
    discoverySources: nzProteinSources(),
    maxCandidates: 25,
    shipping: {
      cost: 5,
      freeThreshold: 100,
      note: "Estimated NZ shipping; confirm final shipping at checkout.",
    },
    enabled: true,
    notes: "Static product grid discovery across StackScout MVP categories.",
  },
  {
    name: "iHerb NZ",
    baseUrl: "https://nz.iherb.com",
    adapterType: "manualFallback",
    discoverySources: [],
    maxCandidates: 0,
    shipping: {
      cost: 0,
      freeThreshold: 67,
      note: "Free shipping on NZ orders over the current threshold; exact threshold can change.",
    },
    enabled: false,
    notes: "Server-side HTTP is blocked. Keep saved/manual data until an approved feed, API, or affiliate data source exists.",
  },
];

export const discoveryConfigs = retailerConfigs
  .filter((config) => config.enabled)
  .flatMap((config) => {
    const sources =
      config.discoverySources ??
      config.discoveryUrls.map((url) => ({
        url,
        category: "creatine",
        adapterType: config.adapterType,
      }));
    return sources.map((source) => ({
      retailer: config.name,
      adapter: source.adapterType ?? config.adapterType,
      category: source.category ?? "creatine",
      collectionUrl: source.url,
      discoveryUrl: source.url,
      baseUrl: config.baseUrl,
      maxCandidates: config.maxCandidates,
      shipping: config.shipping,
    }));
  });
