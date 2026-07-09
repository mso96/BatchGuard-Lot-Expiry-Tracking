import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type ShopifyOrderLineItem = {
  id?: number | string;
  name?: string;
  title?: string;
  product_id?: number | string | null;
  variant_id?: number | string | null;
  admin_graphql_api_id?: string | null;
  sku?: string | null;
  variant_title?: string | null;
  quantity?: number;
};

export type ShopifyOrderCreatePayload = {
  id?: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  line_items?: ShopifyOrderLineItem[];
};

export type ProcessOrderWebhookInput = {
  shopId: string;
  webhookId: string;
  payload: ShopifyOrderCreatePayload;
  payloadDigest?: string;
};

export type ProcessOrderWebhookResult = {
  ignoredDuplicate: boolean;
  deductedQuantity: number;
  untrackedQuantity: number;
};

type AggregatedLineItem = {
  shopifyProductId?: string;
  shopifyVariantId: string;
  productTitle?: string;
  variantTitle?: string;
  variantSku?: string;
  quantity: number;
};

export async function processOrdersCreateWebhook(
  input: ProcessOrderWebhookInput,
  database: PrismaClient = prisma,
): Promise<ProcessOrderWebhookResult> {
  const orderId = normalizeOrderId(input.payload);
  const orderName = input.payload.name;
  const lineItems = aggregateLineItems(input.payload.line_items ?? []);
  const existingWebhook = await database.processedWebhook.findUnique({
    where: {
      shopId_webhookId: {
        shopId: input.shopId,
        webhookId: input.webhookId,
      },
    },
  });

  if (existingWebhook) {
    return {
      ignoredDuplicate: true,
      deductedQuantity: 0,
      untrackedQuantity: 0,
    };
  }

  try {
    return await database.$transaction(async (tx) => {
      await tx.processedWebhook.create({
        data: {
          shopId: input.shopId,
          webhookId: input.webhookId,
          topic: "orders/create",
          payloadDigest: input.payloadDigest ?? digestPayload(input.payload),
        },
      });

      let deductedQuantity = 0;
      let untrackedQuantity = 0;

      for (const lineItem of lineItems) {
        const result = await deductVariantLotsFifo({
          tx,
          shopId: input.shopId,
          orderId,
          orderName,
          lineItem,
        });
        deductedQuantity += result.deductedQuantity;
        untrackedQuantity += result.untrackedQuantity;
      }

      return {
        ignoredDuplicate: false,
        deductedQuantity,
        untrackedQuantity,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ignoredDuplicate: true,
        deductedQuantity: 0,
        untrackedQuantity: 0,
      };
    }
    throw error;
  }
}

export function digestPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function aggregateLineItems(lineItems: ShopifyOrderLineItem[]) {
  const itemsByVariant = new Map<string, AggregatedLineItem>();

  for (const lineItem of lineItems) {
    const shopifyVariantId = normalizeVariantId(lineItem);
    const quantity = lineItem.quantity ?? 0;
    if (!shopifyVariantId || quantity <= 0) {
      continue;
    }

    const existingItem = itemsByVariant.get(shopifyVariantId);
    if (existingItem) {
      existingItem.quantity += quantity;
      continue;
    }

    itemsByVariant.set(shopifyVariantId, {
      shopifyProductId: normalizeProductId(lineItem.product_id),
      shopifyVariantId,
      productTitle: lineItem.title ?? lineItem.name,
      variantTitle: lineItem.variant_title ?? undefined,
      variantSku: lineItem.sku ?? undefined,
      quantity,
    });
  }

  return [...itemsByVariant.values()];
}

async function deductVariantLotsFifo({
  tx,
  shopId,
  orderId,
  orderName,
  lineItem,
}: {
  tx: Prisma.TransactionClient;
  shopId: string;
  orderId: string;
  orderName?: string;
  lineItem: AggregatedLineItem;
}) {
  let quantityToDeduct = lineItem.quantity;
  let deductedQuantity = 0;

  const lots = await tx.lot.findMany({
    where: {
      shopId,
      shopifyVariantId: lineItem.shopifyVariantId,
      status: "ACTIVE",
      remainingQuantity: { gt: 0 },
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  for (const lot of lots) {
    if (quantityToDeduct <= 0) {
      break;
    }

    const deduction = Math.min(quantityToDeduct, lot.remainingQuantity);
    const remainingQuantity = lot.remainingQuantity - deduction;

    await tx.lot.update({
      where: { id: lot.id },
      data: {
        remainingQuantity,
        status: remainingQuantity === 0 ? "DEPLETED" : "ACTIVE",
      },
    });

    await tx.lotEvent.create({
      data: {
        lotId: lot.id,
        type: "DEDUCTED",
        quantityDelta: -deduction,
        orderId,
      },
    });

    quantityToDeduct -= deduction;
    deductedQuantity += deduction;
  }

  if (quantityToDeduct > 0) {
    await tx.untrackedStockSale.upsert({
      where: {
        shopId_orderId_shopifyVariantId: {
          shopId,
          orderId,
          shopifyVariantId: lineItem.shopifyVariantId,
        },
      },
      update: {
        quantity: { increment: quantityToDeduct },
      },
      create: {
        shopId,
        shopifyProductId: lineItem.shopifyProductId,
        shopifyVariantId: lineItem.shopifyVariantId,
        productTitle: lineItem.productTitle,
        variantTitle: lineItem.variantTitle,
        variantSku: lineItem.variantSku,
        orderId,
        orderName,
        quantity: quantityToDeduct,
      },
    });
  }

  return {
    deductedQuantity,
    untrackedQuantity: quantityToDeduct,
  };
}

function normalizeOrderId(payload: ShopifyOrderCreatePayload) {
  if (payload.admin_graphql_api_id) {
    return payload.admin_graphql_api_id;
  }
  return payload.id ? `gid://shopify/Order/${payload.id}` : "unknown-order";
}

function normalizeVariantId(lineItem: ShopifyOrderLineItem) {
  if (lineItem.admin_graphql_api_id?.includes("ProductVariant")) {
    return lineItem.admin_graphql_api_id;
  }
  if (!lineItem.variant_id) {
    return undefined;
  }
  return `gid://shopify/ProductVariant/${lineItem.variant_id}`;
}

function normalizeProductId(productId: ShopifyOrderLineItem["product_id"]) {
  if (!productId) {
    return undefined;
  }
  return `gid://shopify/Product/${productId}`;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
