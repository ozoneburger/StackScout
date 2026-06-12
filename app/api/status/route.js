import { forbiddenJson, isAdminRequest, jsonResponse, statusPayload } from "../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!isAdminRequest(request, new URL(request.url))) return forbiddenJson();
  return jsonResponse(await statusPayload());
}
