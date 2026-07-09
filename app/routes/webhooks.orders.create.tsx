import { json, type ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import {
  digestPayload,
  processOrdersCreateWebhook,
  type ShopifyOrderCreatePayload,
} from "../models/orders.server";

export async function action({ request }: ActionFunctionArgs) {
  // TODO: Replace this route body with the Shopify template's `authenticate.webhook(request)`
  // wrapper, then enqueue `processOrdersCreateWebhook` work instead of processing inline.
  try {
    const shopDomain = request.headers.get("x-shopify-shop-domain");
    const webhookId = request.headers.get("x-shopify-webhook-id");
    const payload = (await request.json()) as ShopifyOrderCreatePayload;

    if (!shopDomain || !webhookId) {
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
      payload,
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
