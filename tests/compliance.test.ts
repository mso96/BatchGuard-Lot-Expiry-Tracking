import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../app/db.server";
import {
  buildAppSubscriptionCreateMutation,
  createLocalTestSubscription,
  getBillingStatus,
} from "../app/models/billing.server";
import { cleanupShopData, noCustomerPiiStoredResponse } from "../app/models/gdpr.server";

const touchedShopDomains: string[] = [];

describe("billing and compliance", () => {
  afterEach(async () => {
    await prisma.session.deleteMany({
      where: { shop: { in: touchedShopDomains } },
    });
    await prisma.shop.deleteMany({
      where: { domain: { in: touchedShopDomains.splice(0) } },
    });
  });

  it("builds the Shopify subscription mutation payload", () => {
    const mutation = buildAppSubscriptionCreateMutation({
      appUrl: "https://batchguard.example.com/",
      test: true,
    });

    expect(mutation.query).toContain("appSubscriptionCreate");
    expect(mutation.variables).toMatchObject({
      name: "BatchGuard Monthly",
      returnUrl: "https://batchguard.example.com/app/billing/return",
      test: true,
      trialDays: 14,
    });
    expect(mutation.variables.lineItems[0]?.plan.appRecurringPricingDetails.price).toEqual({
      amount: 49,
      currencyCode: "USD",
    });
  });

  it("recognizes active local test subscriptions when billing test mode is disabled", async () => {
    const previousTestMode = process.env.BATCHGUARD_BILLING_TEST_MODE;
    process.env.BATCHGUARD_BILLING_TEST_MODE = "false";
    const shop = await createTestShop();

    const beforeSubscription = await getBillingStatus(shop.id);
    await createLocalTestSubscription(shop.id);
    const afterSubscription = await getBillingStatus(shop.id);

    process.env.BATCHGUARD_BILLING_TEST_MODE = previousTestMode;

    expect(beforeSubscription.hasActiveSubscription).toBe(false);
    expect(afterSubscription.hasActiveSubscription).toBe(true);
    expect(afterSubscription.subscription?.test).toBe(true);
  });

  it("cleans shop data for uninstall and shop redact webhooks", async () => {
    const shop = await createTestShop();
    await prisma.session.create({
      data: {
        id: `offline_${shop.domain}`,
        shop: shop.domain,
        state: "state",
        accessToken: "token",
      },
    });
    await prisma.lot.create({
      data: {
        shopId: shop.id,
        shopifyProductId: "gid://shopify/Product/123",
        shopifyVariantId: "gid://shopify/ProductVariant/456",
        lotNumber: `GDPR-${randomUUID()}`,
        expiryDate: new Date("2026-09-01T00:00:00.000Z"),
        initialQuantity: 1,
        remainingQuantity: 1,
        receivedAt: new Date("2026-07-01T00:00:00.000Z"),
        status: "ACTIVE",
        variantPrice: new Prisma.Decimal("1.00"),
      },
    });

    const result = await cleanupShopData(shop.domain);
    const [shopCount, sessionCount, lotCount] = await Promise.all([
      prisma.shop.count({ where: { domain: shop.domain } }),
      prisma.session.count({ where: { shop: shop.domain } }),
      prisma.lot.count({ where: { shopId: shop.id } }),
    ]);

    expect(result.shopDeleted).toBe(true);
    expect(shopCount).toBe(0);
    expect(sessionCount).toBe(0);
    expect(lotCount).toBe(0);
  });

  it("reports that customer PII is not stored", () => {
    expect(noCustomerPiiStoredResponse()).toEqual({
      ok: true,
      customerDataStored: false,
    });
  });
});

async function createTestShop() {
  const domain = `batchguard-compliance-${randomUUID()}.myshopify.com`;
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
