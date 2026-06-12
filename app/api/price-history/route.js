import { jsonResponse, priceHistoryPayload } from "../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const result = await priceHistoryPayload(new URL(request.url));
  return jsonResponse(result.payload, result.status);
}
