import { healthPayload, jsonResponse } from "../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return jsonResponse(await healthPayload());
}
