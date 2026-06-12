import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const contentTypes = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function publicFilePath(file) {
  const cleanFile = normalize(`/${file}`).replace(/^\/+/, "");
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanFile)) return null;
  return join(process.cwd(), "assets", cleanFile);
}

export async function GET(_request, { params }) {
  const { file } = await params;
  const filePath = publicFilePath(file);
  if (!filePath) return new Response("Forbidden", { status: 403 });
  const extension = file.includes(".") ? `.${file.split(".").at(-1)}` : "";

  try {
    return new Response(await readFile(filePath), {
      headers: {
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
