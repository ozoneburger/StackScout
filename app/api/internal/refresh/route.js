import { runRefreshNow } from "../../../../lib/stackscout-refresh.js";
import { forbiddenJson, isAdminRequest, jsonResponse } from "../../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  if (!isAdminRequest(request, new URL(request.url))) return forbiddenJson();
  const result = await runRefreshNow("manual");
  return jsonResponse(result, result.started ? 200 : 409);
}

export async function GET() {
  return jsonResponse({ error: "Method not allowed" }, 405);
}
