import { supabaseConfig, supabaseRequest } from "./supabase-history.js";

const allowedFeedbackTypes = new Set([
  "missing_product",
  "missing_retailer",
  "wrong_price",
  "wrong_stock",
  "general",
]);

function cleanString(value, maxLength) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanUrl(value) {
  const text = cleanString(value, 1200);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function feedbackRow(payload) {
  const feedbackType = cleanString(payload.feedbackType, 60) ?? "general";
  const message = cleanString(payload.message, 1200);
  if (!message || message.length < 4) return null;

  return {
    feedback_type: allowedFeedbackTypes.has(feedbackType) ? feedbackType : "general",
    message,
    category: cleanString(payload.category, 40),
    product_name: cleanString(payload.productName, 260),
    retailer: cleanString(payload.retailer, 160),
    source_url: cleanUrl(payload.sourceUrl),
    page_path: cleanString(payload.pagePath, 240),
  };
}

export async function recordFeedback(payload) {
  if (!supabaseConfig()) return { enabled: false, recorded: false };

  const row = feedbackRow(payload);
  if (!row) return { enabled: true, recorded: false, reason: "invalid_feedback" };

  await supabaseRequest("/feedback_reports", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  return { enabled: true, recorded: true };
}
