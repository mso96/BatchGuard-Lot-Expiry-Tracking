import { json, type ActionFunctionArgs } from "@remix-run/node";
import { cleanupShopData } from "../models/gdpr.server";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { shop } = await authenticate.webhook(request);
  const result = await cleanupShopData(shop);
  return json({ ok: true, result });
}

export async function loader() {
  return json({ ok: false }, { status: 405 });
}
