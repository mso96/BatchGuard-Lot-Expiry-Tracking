import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../app/db.server";
import { runAlertDigestJob } from "../app/jobs/alerts.server";
import { runNightlyMaintenanceJob } from "../app/jobs/maintenance.server";
import type { DigestEmail, MailTransport } from "../app/services/mail.server";

const touchedShopDomains: string[] = [];

class CapturingMailTransport implements MailTransport {
  emails: DigestEmail[] = [];

  async sendExpiryDigest(email: DigestEmail) {
    this.emails.push(email);
  }
}

describe("scheduled jobs", () => {
  afterEach(async () => {
    await prisma.shop.deleteMany({
      where: { domain: { in: touchedShopDomains.splice(0) } },
    });
  });

  it("sends one alert digest and does not duplicate alert logs", async () => {
    const shop = await createTestShop();
    const expiringLot = await createTestLot({
      shopId: shop.id,
      lotNumber: "ALERT-SOON",
      expiryDate: "2026-07-20",
      remainingQuantity: 5,
      status: "ACTIVE",
    });
    await createTestLot({
      shopId: shop.id,
      lotNumber: "ALERT-LATER",
      expiryDate: "2026-10-01",
      remainingQuantity: 5,
      status: "ACTIVE",
    });
    const mailTransport = new CapturingMailTransport();

    const firstRun = await runAlertDigestJob({
      mailTransport,
      now: new Date("2026-07-09T12:00:00.000Z"),
    });
    const secondRun = await runAlertDigestJob({
      mailTransport,
      now: new Date("2026-07-09T12:00:00.000Z"),
    });
    const alertLogs = await prisma.alertLog.findMany({
      where: { lotId: expiringLot.id, channel: "email" },
    });

    expect(firstRun.digestsSent).toBeGreaterThanOrEqual(1);
    expect(firstRun.alertLogsCreated).toBeGreaterThanOrEqual(1);
    expect(secondRun.digestsSent).toBe(0);
    expect(secondRun.alertLogsCreated).toBe(0);
    expect(mailTransport.emails.length).toBeGreaterThanOrEqual(1);
    expect(
      mailTransport.emails.some((email) =>
        email.lots.some((lot) => lot.lotNumber === "ALERT-SOON"),
      ),
    ).toBe(true);
    expect(alertLogs).toHaveLength(1);
  });

  it("marks expired and zero-remaining active lots during nightly maintenance", async () => {
    const shop = await createTestShop();
    const expiredLot = await createTestLot({
      shopId: shop.id,
      lotNumber: "MAINT-EXPIRED",
      expiryDate: "2026-07-01",
      remainingQuantity: 3,
      status: "ACTIVE",
    });
    const depletedLot = await createTestLot({
      shopId: shop.id,
      lotNumber: "MAINT-DEPLETED",
      expiryDate: "2026-08-01",
      remainingQuantity: 0,
      status: "ACTIVE",
    });

    const result = await runNightlyMaintenanceJob({
      now: new Date("2026-07-09T12:00:00.000Z"),
    });
    const [updatedExpiredLot, updatedDepletedLot] = await Promise.all([
      prisma.lot.findUniqueOrThrow({ where: { id: expiredLot.id } }),
      prisma.lot.findUniqueOrThrow({ where: { id: depletedLot.id } }),
    ]);

    expect(result.expiredLots).toBeGreaterThanOrEqual(1);
    expect(result.depletedLots).toBeGreaterThanOrEqual(1);
    expect(updatedExpiredLot.status).toBe("EXPIRED");
    expect(updatedDepletedLot.status).toBe("DEPLETED");
  });
});

async function createTestShop() {
  const domain = `batchguard-jobs-${randomUUID()}.myshopify.com`;
  touchedShopDomains.push(domain);
  return prisma.shop.create({
    data: {
      domain,
      settings: JSON.stringify({
        warningThresholdDays: 30,
        notificationEmail: "alerts@example.com",
        timezone: "UTC",
        alertsEnabled: true,
      }),
    },
  });
}

async function createTestLot({
  shopId,
  lotNumber,
  expiryDate,
  remainingQuantity,
  status,
}: {
  shopId: string;
  lotNumber: string;
  expiryDate: string;
  remainingQuantity: number;
  status: string;
}) {
  return prisma.lot.create({
    data: {
      shopId,
      shopifyProductId: "gid://shopify/Product/555",
      shopifyVariantId: `gid://shopify/ProductVariant/${randomUUID()}`,
      productTitle: "Job Test Product",
      variantTitle: "Default",
      variantSku: `JOB-${randomUUID()}`,
      variantPrice: new Prisma.Decimal("10.00"),
      lotNumber,
      expiryDate: new Date(`${expiryDate}T00:00:00.000Z`),
      initialQuantity: Math.max(remainingQuantity, 1),
      remainingQuantity,
      receivedAt: new Date("2026-06-01T00:00:00.000Z"),
      status,
    },
  });
}
