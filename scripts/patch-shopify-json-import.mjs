import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appProviderPath = fileURLToPath(
  new URL(
    "../node_modules/@shopify/shopify-app-remix/dist/esm/react/components/AppProvider/AppProvider.mjs",
    import.meta.url,
  ),
);
const source = await readFile(appProviderPath, "utf8");
const patched = source.replace(
  "with { type: 'json' }",
  "assert { type: 'json' }",
);

if (patched === source && !source.includes("assert { type: 'json' }")) {
  throw new Error("Could not patch Shopify's JSON import syntax for Cloudflare Pages.");
}

if (patched !== source) {
  await writeFile(appProviderPath, patched);
  console.log("Patched Shopify JSON import syntax for Cloudflare Pages.");
}
