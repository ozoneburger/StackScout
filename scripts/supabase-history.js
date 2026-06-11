const currency = "NZD";

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  validateServiceRoleKey(serviceRoleKey);
  return {
    baseUrl: `${url.replace(/\/$/, "")}/rest/v1`,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
}

function validateServiceRoleKey(key) {
  if (key.startsWith("sb_secret_")) return;

  try {
    const [, payload] = key.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.role !== "service_role") {
      console.warn(
        `Expected SUPABASE_SERVICE_ROLE_KEY to have role "service_role", but got "${decoded.role ?? "unknown"}". Supabase writes may fail under RLS.`,
      );
    }
  } catch {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY does not look like a valid Supabase JWT. Supabase writes may fail.",
    );
  }
}

function estimatedShipping(product) {
  if (!product.deliveryAvailable) return null;
  if (product.price >= product.shipping.freeThreshold) return 0;
  return product.shipping.cost;
}

function estimatedTotal(product) {
  const shipping = estimatedShipping(product);
  return shipping === null ? product.price : product.price + shipping;
}

function pricePer100g(product) {
  return (estimatedTotal(product) / product.sizeGrams) * 100;
}

export async function supabaseRequest(path, options) {
  const config = supabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      ...config.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

function isAvailable(product) {
  return product.available !== false && product.fetchStatus !== "unavailable";
}

function productState(product) {
  if (product.fetchStatus === "unavailable" || product.available === false) return "unavailable";
  if (product.fetchStatus === "discovered") return "discovered";
  if (product.fetchStatus === "stale") return "stale";
  return "active";
}

function productRow(product) {
  const available = isAvailable(product);
  const shipping = estimatedShipping(product);
  const deliveredTotal = estimatedTotal(product);
  const value = product.price && product.sizeGrams ? pricePer100g(product) : null;
  const checkedAt = product.updatedAt ?? new Date().toISOString();

  return {
    source_url: product.source,
    category: product.category ?? "creatine",
    retailer: product.retailer,
    product_name: product.product,
    image_url: product.image,
    size_grams: product.sizeGrams,
    available,
    product_state: productState(product),
    pickup_available: product.pickupAvailable,
    delivery_available: product.deliveryAvailable,
    pickup_note: product.pickup,
    shipping_note: product.shipping?.note ?? null,
    last_item_price: product.price ?? null,
    last_shipping_price: shipping,
    last_delivered_total: deliveredTotal,
    last_price_per_100g: value,
    last_rating: product.rating,
    last_review_count: product.reviewCount,
    metadata: {
      stores: product.stores ?? [],
      confidence: product.confidence ?? null,
      category: product.category ?? "creatine",
      productImage: product.productImage ?? null,
      shipping: product.shipping ?? null,
      discoverySource: product.discoverySource ?? null,
    },
    last_fetch_status: product.fetchStatus ?? null,
    last_fetch_error: product.fetchError ?? null,
    last_seen_at: checkedAt,
    last_checked_at: checkedAt,
    last_available_at: available ? checkedAt : null,
    last_unavailable_at: available ? null : checkedAt,
  };
}

function legacyProductRow(product) {
  const row = productRow(product);
  return {
    source_url: row.source_url,
    retailer: row.retailer,
    product_name: row.product_name,
    image_url: row.image_url,
    size_grams: row.size_grams,
    pickup_available: row.pickup_available,
    delivery_available: row.delivery_available,
    pickup_note: row.pickup_note,
    shipping_note: row.shipping_note,
    metadata: row.metadata,
    last_fetch_status: row.last_fetch_status,
    last_fetch_error: row.last_fetch_error,
    last_seen_at: row.last_seen_at,
  };
}

function productRowWithoutCategory(product) {
  const { category, ...row } = productRow(product);
  return row;
}

function priceHistoryRow(product, productId, observedAt) {
  const shipping = estimatedShipping(product);
  return {
    product_id: productId,
    observed_at: observedAt,
    currency,
    item_price: product.price,
    shipping_price: shipping,
    delivered_total: estimatedTotal(product),
    price_per_100g: pricePer100g(product),
    rating: product.rating,
    review_count: product.reviewCount,
    fetch_status: product.fetchStatus ?? null,
    fetch_error: product.fetchError ?? null,
  };
}

function availabilityHistoryRow(product, productId, observedAt) {
  return {
    product_id: productId,
    observed_at: observedAt,
    available: isAvailable(product),
    product_state: productState(product),
    fetch_status: product.fetchStatus ?? null,
    fetch_error: product.fetchError ?? null,
  };
}

async function upsertProducts(products) {
  try {
    return await supabaseRequest("/products?on_conflict=source_url", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(products.map(productRow)),
    });
  } catch (error) {
    const message = String(error.message);
    if (!message.includes("Could not find") && !message.includes("schema cache")) throw error;
    if (message.includes("category")) {
      console.warn(
        "Supabase products table is missing category. Falling back to metadata category; run supabase/schema.sql to enable category filtering in SQL.",
      );
      return supabaseRequest("/products?on_conflict=source_url", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(products.map(productRowWithoutCategory)),
      });
    }
    console.warn(
      "Supabase products table is missing new launch columns. Falling back to legacy product upsert; run supabase/schema.sql to enable product state fields.",
    );
    return supabaseRequest("/products?on_conflict=source_url", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(products.map(legacyProductRow)),
    });
  }
}

export async function syncProducts(products) {
  if (!supabaseConfig()) {
    return { enabled: false, products: 0 };
  }

  const upsertedProducts = await upsertProducts(products);
  return {
    enabled: true,
    products: upsertedProducts?.length ?? products.length,
  };
}

export async function syncPriceHistory(products, observedAt) {
  if (!supabaseConfig()) {
    return { enabled: false, products: 0, historyRows: 0, availabilityRows: 0 };
  }

  const upsertedProducts = await upsertProducts(products);

  const productsForHistory =
    upsertedProducts ??
    (await supabaseRequest(
      `/products?select=id,source_url&source_url=in.(${products
        .map((product) => `"${product.source.replaceAll('"', '\\"')}"`)
        .join(",")})`,
      {
        method: "GET",
      },
    ));

  const idBySource = new Map(productsForHistory.map((product) => [product.source_url, product.id]));
  const historyRows = products
    .filter((product) => isAvailable(product) && product.price && product.sizeGrams)
    .map((product) => priceHistoryRow(product, idBySource.get(product.source), observedAt))
    .filter((row) => row.product_id);
  const availabilityRows = products
    .map((product) => availabilityHistoryRow(product, idBySource.get(product.source), observedAt))
    .filter((row) => row.product_id);

  if (historyRows.length) {
    await supabaseRequest("/price_history", {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify(historyRows),
    });
  }

  let availabilityHistoryRows = 0;
  if (availabilityRows.length) {
    try {
      await supabaseRequest("/product_availability_history", {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify(availabilityRows),
      });
      availabilityHistoryRows = availabilityRows.length;
    } catch (error) {
      const message = String(error.message);
      if (!message.includes("product_availability_history")) throw error;
      console.warn(
        "Supabase product_availability_history table is missing. Run supabase/schema.sql to enable availability history.",
      );
    }
  }

  return {
    enabled: true,
    products: productsForHistory.length,
    historyRows: historyRows.length,
    availabilityRows: availabilityHistoryRows,
  };
}
