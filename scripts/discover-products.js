import { readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { discoverProducts } from "../lib/product-discovery.js";

loadEnv();

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  const dataPath = join(process.cwd(), "data", "products.json");
  const tempPath = join(process.cwd(), "data", "products.json.tmp");
  const current = JSON.parse(await readFile(dataPath, "utf8"));
  const result = await discoverProducts({ products: current.products });
  const payload = {
    ...current,
    refreshedAt: current.refreshedAt,
    discoveryRefreshedAt: result.discoveryRefreshedAt,
    discoveryMode: "http-config",
    products: result.products,
  };
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tempPath, dataPath);
  console.log(
    `Discovered ${result.added} new products; ${result.existing} already tracked; ${result.total} total products`,
  );
  if (result.supabase.enabled) {
    console.log(
      result.supabase.error
        ? `Supabase product upsert failed: ${result.supabase.error}`
        : `Upserted ${result.supabase.products} products to Supabase`,
    );
  } else {
    console.log("Supabase disabled");
  }
  for (const retailer of result.retailers) {
    console.log(
      `${retailer.retailer}: ${retailer.count} comparable candidates${
        retailer.error ? ` (${retailer.error})` : ""
      }`,
    );
  }
}

export { discoverProducts };
