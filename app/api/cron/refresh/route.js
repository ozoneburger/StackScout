import { runRefreshNow } from "../../../../lib/stackscout-refresh.js";
import { jsonResponse } from "../../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request) {
  const secret = process.env.CRON_SECRET ?? null;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request) {
  if (!authorized(request)) return jsonResponse({ error: "Cron secret required" }, 401);
  const result = await runRefreshNow("cron");
  return jsonResponse(result, result.started ? 200 : 409);
}

export async function POST(request) {
  return GET(request);
}
