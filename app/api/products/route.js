import { jsonResponse, productsPayload } from "../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  return jsonResponse(await productsPayload(new URL(request.url)));
}
