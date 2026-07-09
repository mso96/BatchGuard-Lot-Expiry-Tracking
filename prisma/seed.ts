import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSettings = {
  warningThresholdDays: 30,
  notificationEmail: "ops@example-dev-store.myshopify.com",
  timezone: "America/New_York",
  alertsEnabled: true,
};

type DemoLot = {
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitle: string;
  variantTitle: string;
  variantSku: string;
  variantPrice: string;
  lotNumber: string;
  expiryDate: string;
  initialQuantity: number;
  remainingQuantity: number;
  receivedAt: string;
  note?: string;
  status?: string;
};

const demoLots: DemoLot[] = [
  {
    shopifyProductId: "gid://shopify/Product/1000000001",
    shopifyVariantId: "gid://shopify/ProductVariant/2000000001",
    productTitle: "Cold-Pressed Elderberry Syrup",
    variantTitle: "12 oz bottle",
    variantSku: "ELD-SYR-12",
    variantPrice: "24.00",
    lotNumber: "ELD-MAR-26",
    expiryDate: "2026-07-15T00:00:00.000Z",
    initialQuantity: 80,
    remainingQuantity: 28,
    receivedAt: "2026-03-01T12:00:00.000Z",
    note: "Use in July merchandising push.",
  },
  {
    shopifyProductId: "gid://shopify/Product/1000000001",
    shopifyVariantId: "gid://shopify/ProductVariant/2000000001",
    productTitle: "Cold-Pressed Elderberry Syrup",
    variantTitle: "12 oz bottle",
    variantSku: "ELD-SYR-12",
    variantPrice: "24.00",
    lotNumber: "ELD-JUN-26",
    expiryDate: "2026-10-01T00:00:00.000Z",
    initialQuantity: 120,
    remainingQuantity: 112,
    receivedAt: "2026-06-02T12:00:00.000Z",
  },
  {
    shopifyProductId: "gid://shopify/Product/1000000002",
    shopifyVariantId: "gid://shopify/ProductVariant/2000000002",
    productTitle: "Vitamin D3 Gummies",
    variantTitle: "60 count",
    variantSku: "D3-GUM-60",
    variantPrice: "18.50",
    lotNumber: "D3-FEB-26",
    expiryDate: "2026-07-05T00:00:00.000Z",
    initialQuantity: 60,
    remainingQuantity: 14,
    receivedAt: "2026-02-20T12:00:00.000Z",
    status: "EXPIRED",
  },
  {
    shopifyProductId: "gid://shopify/Product/1000000003",
    shopifyVariantId: "gid://shopify/ProductVariant/2000000003",
    productTitle: "Rosehip Face Oil",
    variantTitle: "30 ml",
    variantSku: "RSH-OIL-30",
    variantPrice: "32.00",
    lotNumber: "RSH-APR-26",
    expiryDate: "2026-08-20T00:00:00.000Z",
    initialQuantity: 45,
    remainingQuantity: 0,
    receivedAt: "2026-04-12T12:00:00.000Z",
    status: "DEPLETED",
  },
  {
    shopifyProductId: "gid://shopify/Product/1000000004",
    shopifyVariantId: "gid://shopify/ProductVariant/2000000004",
    productTitle: "Organic Almond Butter",
    variantTitle: "16 oz jar",
    variantSku: "ALM-BTR-16",
    variantPrice: "15.75",
    lotNumber: "ALM-MAY-26",
    expiryDate: "2026-09-10T00:00:00.000Z",
    initialQuantity: 96,
    remainingQuantity: 74,
    receivedAt: "2026-05-18T12:00:00.000Z",
  },
];

async function main() {
  const shop = await prisma.shop.upsert({
    where: { domain: "example-dev-store.myshopify.com" },
    update: { settings: defaultSettings },
    create: {
      domain: "example-dev-store.myshopify.com",
      settings: defaultSettings,
    },
  });

  for (const lot of demoLots) {
    const createdLot = await prisma.lot.upsert({
      where: {
        shopId_shopifyVariantId_lotNumber: {
          shopId: shop.id,
          shopifyVariantId: lot.shopifyVariantId,
          lotNumber: lot.lotNumber,
        },
      },
      update: {
        expiryDate: new Date(lot.expiryDate),
        initialQuantity: lot.initialQuantity,
        remainingQuantity: lot.remainingQuantity,
        status: lot.status ?? "ACTIVE",
        note: lot.note,
      },
      create: {
        shopId: shop.id,
        shopifyProductId: lot.shopifyProductId,
        shopifyVariantId: lot.shopifyVariantId,
        productTitle: lot.productTitle,
        variantTitle: lot.variantTitle,
        variantSku: lot.variantSku,
        variantPrice: new Prisma.Decimal(lot.variantPrice),
        lotNumber: lot.lotNumber,
        expiryDate: new Date(lot.expiryDate),
        initialQuantity: lot.initialQuantity,
        remainingQuantity: lot.remainingQuantity,
        receivedAt: new Date(lot.receivedAt),
        note: lot.note,
        status: lot.status ?? "ACTIVE",
      },
    });

    await prisma.lotEvent.upsert({
      where: { id: `seed-created-${createdLot.id}` },
      update: {},
      create: {
        id: `seed-created-${createdLot.id}`,
        lotId: createdLot.id,
        type: "CREATED",
        quantityDelta: lot.initialQuantity,
      },
    });

    const deductedQuantity = lot.initialQuantity - lot.remainingQuantity;
    if (deductedQuantity > 0) {
      await prisma.lotEvent.upsert({
        where: { id: `seed-deducted-${createdLot.id}` },
        update: {},
        create: {
          id: `seed-deducted-${createdLot.id}`,
          lotId: createdLot.id,
          type: "DEDUCTED",
          quantityDelta: -deductedQuantity,
          orderId: "gid://shopify/Order/3000000001",
        },
      });
    }
  }

  const expiringLot = await prisma.lot.findFirstOrThrow({
    where: { shopId: shop.id, lotNumber: "ELD-MAR-26" },
  });

  await prisma.alertLog.upsert({
    where: {
      shopId_lotId_channel_thresholdDays: {
        shopId: shop.id,
        lotId: expiringLot.id,
        channel: "console",
        thresholdDays: 30,
      },
    },
    update: {},
    create: {
      shopId: shop.id,
      lotId: expiringLot.id,
      channel: "console",
      thresholdDays: 30,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
