import { outboundClickResponse } from "../../../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  return outboundClickResponse(request);
}

export async function GET() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
