import { supabaseConfig, supabaseRequest } from "./supabase-history.js";

function rowMetadata(row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function nullableNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapProductRow(row) {
  const metadata = rowMetadata(row);
  return {
    retailer: row.retailer,
    image: row.image_url,
    product: row.product_name,
    category: row.category ?? metadata.category ?? "creatine",
    productImage: metadata.productImage ?? null,
    sizeGrams: row.size_grams,
    price: nullableNumber(row.last_item_price),
    rating: nullableNumber(row.last_rating),
    reviewCount: row.last_review_count,
    shipping: metadata.shipping ?? {
      cost: nullableNumber(row.last_shipping_price) ?? 0,
      freeThreshold: 999999,
      note: row.shipping_note ?? "Shipping estimate not available.",
    },
    deliveryAvailable: row.delivery_available,
    source: row.source_url,
    fetchStatus: row.last_fetch_status,
    fetchError: row.last_fetch_error,
    confidence: metadata.confidence ?? null,
    updatedAt: row.last_checked_at ?? row.last_seen_at,
    available: row.available !== false && row.product_state !== "unavailable",
    productState: row.product_state ?? null,
  };
}

export async function readProductsFromSupabase() {
  if (!supabaseConfig()) return null;

  const rows = await supabaseRequest(
    "/products?select=*&order=last_price_per_100g.asc.nullslast,product_name.asc",
    {
      method: "GET",
    },
  );

  if (!rows?.length) return null;
  const products = rows.map(mapProductRow);
  if (products.every((product) => product.price === null)) {
    throw new Error("Supabase products are missing launch current-price fields");
  }

  return {
    source: "supabase",
    products,
    refreshedAt:
      products
        .map((product) => product.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
  };
}
