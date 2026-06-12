import { readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { refreshProducts } from "../lib/product-refresh.js";

loadEnv();

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  const dataPath = join(process.cwd(), "data", "products.json");
  const tempPath = join(process.cwd(), "data", "products.json.tmp");
  const current = JSON.parse(await readFile(dataPath, "utf8"));
  const result = await refreshProducts({ products: current.products });
  const payload = {
    ...current,
    refreshedAt: result.refreshedAt,
    refreshMode: "http-fetch",
    products: result.products,
  };
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tempPath, dataPath);
  const history = result.supabase.enabled
    ? result.supabase.error
      ? `; Supabase write failed: ${result.supabase.error}`
      : `; wrote ${result.supabase.historyRows} price history rows and ${
          result.supabase.availabilityRows ?? 0
        } availability rows to Supabase`
    : "; Supabase disabled";
  console.log(`Refreshed ${result.live}/${result.total} products${history}`);
}

export { refreshProducts };
