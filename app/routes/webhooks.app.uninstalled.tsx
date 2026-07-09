import { json, type ActionFunctionArgs } from "@remix-run/node";
import { cleanupShopData } from "../models/gdpr.server";

export async function action({ request }: ActionFunctionArgs) {
  // TODO: Replace with Shopify template `authenticate.webhook(request)` verification.
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? (await readShopDomain(request));
  if (!shopDomain) {
    return json({ ok: true, skipped: "missing shop domain" });
  }

  const result = await cleanupShopData(shopDomain);
  return json({ ok: true, result });
}

export async function loader() {
  return json({ ok: false }, { status: 405 });
}

async function readShopDomain(request: Request) {
  try {
    const payload = (await request.json()) as { myshopify_domain?: string; domain?: string };
    return payload.myshopify_domain ?? payload.domain;
  } catch {
    return undefined;
  }
}
