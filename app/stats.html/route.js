import { adminCookieHeader, htmlResponse, isAdminRequest } from "../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  if (!isAdminRequest(request, url)) return htmlResponse("Admin token required", 401);
  const headers = {
    Location: "/stats",
    "Cache-Control": "no-store",
  };
  if (process.env.ADMIN_TOKEN) headers["Set-Cookie"] = adminCookieHeader(request);

  return new Response(null, {
    status: 302,
    headers,
  });
}
