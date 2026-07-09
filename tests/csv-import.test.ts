import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../app/db.server";
import {
  commitLotCsvImport,
  previewLotCsvImport,
  previewLotCsvImportWithResolver,
} from "../app/models/csv-import.server";

const touchedShopDomains: string[] = [];

describe("CSV lot import", () => {
  afterEach(async () => {
    await prisma.shop.deleteMany({
      where: { domain: { in: touchedShopDomains.splice(0) } },
    });
  });

  it("parses rows and reports row-level validation failures", async () => {
    const preview = await previewLotCsvImportWithResolver(
      [
        "variant sku or id,lot number,expiry date,quantity",
        '"SKU,WITH,COMMAS",LOT-001,2026-08-01,12',
        "MISSING,LOT-002,not-a-date,abc",
      ].join("\n"),
      async (variantReference) =>
        variantReference === "SKU,WITH,COMMAS"
          ? {
              shopifyProductId: "gid://shopify/Product/1",
              shopifyVariantId: "gid://shopify/ProductVariant/1",
              productTitle: "Quoted Product",
              variantSku: variantReference,
            }
          : undefined,
    );

    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      variantReference: "SKU,WITH,COMMAS",
      lotNumber: "LOT-001",
      status: "valid",
    });
    expect(preview.rows[1]?.errors).toEqual([
      "Quantity must be a positive whole number",
      "Expiry date must use YYYY-MM-DD",
      "Variant SKU or ID was not found",
    ]);
  });

  it("creates lots and CREATED events from valid CSV rows", async () => {
    const shop = await createTestShop();
    await createVariantAnchorLot({
      shopId: shop.id,
      variantId: "gid://shopify/ProductVariant/7001",
      productId: "gid://shopify/Product/6001",
      sku: "IMPORT-SKU",
    });

    const csvText = [
      "variant sku or id,lot number,expiry date,quantity",
      "IMPORT-SKU,IMPORT-LOT-1,2026-11-01,7",
      "7001,IMPORT-LOT-2,2026-12-01,8",
    ].join("\n");

    const preview = await previewLotCsvImport(shop.id, csvText);
    const result = await commitLotCsvImport(shop.id, csvText);
    const importedLots = await prisma.lot.findMany({
      where: {
        shopId: shop.id,
        lotNumber: { in: ["IMPORT-LOT-1", "IMPORT-LOT-2"] },
      },
      include: { events: true },
      orderBy: { lotNumber: "asc" },
    });

    expect(preview.validCount).toBe(2);
    expect(result).toEqual({ createdCount: 2, skippedCount: 0 });
    expect(importedLots).toHaveLength(2);
    expect(importedLots.map((lot) => lot.remainingQuantity)).toEqual([7, 8]);
    expect(importedLots.flatMap((lot) => lot.events.map((event) => event.type))).toEqual([
      "CREATED",
      "CREATED",
    ]);
  });
});

async function createTestShop() {
  const domain = `batchguard-csv-${randomUUID()}.myshopify.com`;
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

async function createVariantAnchorLot({
  shopId,
  variantId,
  productId,
  sku,
}: {
  shopId: string;
  variantId: string;
  productId: string;
  sku: string;
}) {
  return prisma.lot.create({
    data: {
      shopId,
      shopifyProductId: productId,
      shopifyVariantId: variantId,
      productTitle: "Import Anchor Product",
      variantTitle: "Default",
      variantSku: sku,
      variantPrice: new Prisma.Decimal("11.00"),
      lotNumber: `ANCHOR-${randomUUID()}`,
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
      initialQuantity: 1,
      remainingQuantity: 1,
      receivedAt: new Date("2026-07-01T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });
}
