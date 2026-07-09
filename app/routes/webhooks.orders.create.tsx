import { json, type ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import { authenticate } from "../shopify.server";
import {
  digestPayload,
  processOrdersCreateWebhook,
  type ShopifyOrderCreatePayload,
} from "../models/orders.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { shop: shopDomain, payload } = await authenticate.webhook(request);
    const webhookId = request.headers.get("x-shopify-webhook-id");

    if (!webhookId) {
      return json({ ok: true, skipped: "missing Shopify webhook headers" });
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shop) {
      return json({ ok: true, skipped: "unknown shop" });
    }

    const result = await processOrdersCreateWebhook({
      shopId: shop.id,
      webhookId,
      payload: payload as ShopifyOrderCreatePayload,
      payloadDigest: digestPayload(payload),
    });

    return json({ ok: true, result });
  } catch (error) {
    console.error("orders/create webhook processing failed", error);
    return json({ ok: true, queued: false });
  }
}

export async function loader() {
  return json({ ok: false }, { status: 405 });
}
