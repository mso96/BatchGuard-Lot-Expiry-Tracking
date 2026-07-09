import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../app/db.server";
import { processOrdersCreateWebhook } from "../app/models/orders.server";

const touchedShopDomains: string[] = [];

describe("orders/create webhook FIFO deduction", () => {
  afterEach(async () => {
    await prisma.shop.deleteMany({
      where: { domain: { in: touchedShopDomains.splice(0) } },
    });
  });

  it("deducts from active lots by soonest expiry and flags untracked stock", async () => {
    const shop = await createTestShop();
    const variantId = "gid://shopify/ProductVariant/9001";
    const productId = "gid://shopify/Product/8001";
    const olderLot = await createTestLot({
      shopId: shop.id,
      variantId,
      productId,
      lotNumber: "FIFO-OLDER",
      expiryDate: "2026-08-01",
      quantity: 5,
    });
    const newerLot = await createTestLot({
      shopId: shop.id,
      variantId,
      productId,
      lotNumber: "FIFO-NEWER",
      expiryDate: "2026-09-01",
      quantity: 5,
    });

    const result = await processOrdersCreateWebhook({
      shopId: shop.id,
      webhookId: `hook-${randomUUID()}`,
      payload: {
        id: 7001,
        admin_graphql_api_id: "gid://shopify/Order/7001",
        name: "#7001",
        line_items: [
          {
            product_id: 8001,
            variant_id: 9001,
            title: "FIFO Test Product",
            variant_title: "Bottle",
            sku: "FIFO-9001",
            quantity: 12,
          },
        ],
      },
    });

    expect(result).toEqual({
      ignoredDuplicate: false,
      deductedQuantity: 10,
      untrackedQuantity: 2,
    });

    const [updatedOlderLot, updatedNewerLot, events, untrackedSale] = await Promise.all([
      prisma.lot.findUniqueOrThrow({ where: { id: olderLot.id } }),
      prisma.lot.findUniqueOrThrow({ where: { id: newerLot.id } }),
      prisma.lotEvent.findMany({
        where: { lotId: { in: [olderLot.id, newerLot.id] }, type: "DEDUCTED" },
        orderBy: { quantityDelta: "asc" },
      }),
      prisma.untrackedStockSale.findFirstOrThrow({
        where: { shopId: shop.id, shopifyVariantId: variantId },
      }),
    ]);

    expect(updatedOlderLot.remainingQuantity).toBe(0);
    expect(updatedOlderLot.status).toBe("DEPLETED");
    expect(updatedNewerLot.remainingQuantity).toBe(0);
    expect(updatedNewerLot.status).toBe("DEPLETED");
    expect(events.map((event) => event.quantityDelta).sort((a, b) => a - b)).toEqual([-5, -5]);
    expect(untrackedSale.quantity).toBe(2);
    expect(untrackedSale.orderName).toBe("#7001");
  });

  it("ignores duplicate webhook IDs without deducting twice", async () => {
    const shop = await createTestShop();
    const webhookId = `hook-${randomUUID()}`;
    const variantId = "gid://shopify/ProductVariant/9002";
    const lot = await createTestLot({
      shopId: shop.id,
      variantId,
      productId: "gid://shopify/Product/8002",
      lotNumber: "IDEMPOTENT",
      expiryDate: "2026-08-15",
      quantity: 9,
    });
    const payload = {
      id: 7002,
      admin_graphql_api_id: "gid://shopify/Order/7002",
      name: "#7002",
      line_items: [{ product_id: 8002, variant_id: 9002, quantity: 4 }],
    };

    const firstResult = await processOrdersCreateWebhook({ shopId: shop.id, webhookId, payload });
    const secondResult = await processOrdersCreateWebhook({ shopId: shop.id, webhookId, payload });

    const [updatedLot, events] = await Promise.all([
      prisma.lot.findUniqueOrThrow({ where: { id: lot.id } }),
      prisma.lotEvent.findMany({ where: { lotId: lot.id, type: "DEDUCTED" } }),
    ]);

    expect(firstResult.ignoredDuplicate).toBe(false);
    expect(secondResult).toEqual({
      ignoredDuplicate: true,
      deductedQuantity: 0,
      untrackedQuantity: 0,
    });
    expect(updatedLot.remainingQuantity).toBe(5);
    expect(events).toHaveLength(1);
    expect(events[0]?.quantityDelta).toBe(-4);
  });
});

async function createTestShop() {
  const domain = `batchguard-test-${randomUUID()}.myshopify.com`;
  touchedShopDomains.push(domain);
  return prisma.shop.create({
    data: {
      domain,
      settings: {
        warningThresholdDays: 30,
        notificationEmail: "test@example.com",
        timezone: "UTC",
        alertsEnabled: true,
      },
    },
  });
}

async function createTestLot({
  shopId,
  variantId,
  productId,
  lotNumber,
  expiryDate,
  quantity,
}: {
  shopId: string;
  variantId: string;
  productId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
}) {
  return prisma.lot.create({
    data: {
      shopId,
      shopifyProductId: productId,
      shopifyVariantId: variantId,
      productTitle: "FIFO Test Product",
      variantTitle: "Bottle",
      variantSku: variantId.split("/").at(-1),
      variantPrice: new Prisma.Decimal("10.00"),
      lotNumber: `${lotNumber}-${randomUUID()}`,
      expiryDate: new Date(`${expiryDate}T00:00:00.000Z`),
      initialQuantity: quantity,
      remainingQuantity: quantity,
      receivedAt: new Date("2026-07-01T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });
}
