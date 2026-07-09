import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";
import { parseShopSettings } from "../shop.server";
import { ConsoleMailTransport, type MailTransport } from "../services/mail.server";

export type AlertDigestResult = {
  shopsChecked: number;
  digestsSent: number;
  alertLogsCreated: number;
};

export async function runAlertDigestJob({
  database = prisma,
  mailTransport = new ConsoleMailTransport(),
  now = new Date(),
}: {
  database?: PrismaClient;
  mailTransport?: MailTransport;
  now?: Date;
} = {}): Promise<AlertDigestResult> {
  const shops = await database.shop.findMany();
  let digestsSent = 0;
  let alertLogsCreated = 0;

  for (const shop of shops) {
    const settings = parseShopSettings(shop.settings);
    if (!settings.alertsEnabled || !settings.notificationEmail) {
      continue;
    }

    const thresholdDate = addUtcDays(startOfUtcDay(now), settings.warningThresholdDays);
    const candidateLots = await database.lot.findMany({
      where: {
        shopId: shop.id,
        status: "ACTIVE",
        remainingQuantity: { gt: 0 },
        expiryDate: { lte: thresholdDate },
      },
      orderBy: { expiryDate: "asc" },
    });
    const unsentLots = [];

    for (const lot of candidateLots) {
      const existingAlert = await database.alertLog.findUnique({
        where: {
          shopId_lotId_channel_thresholdDays: {
            shopId: shop.id,
            lotId: lot.id,
            channel: "email",
            thresholdDays: settings.warningThresholdDays,
          },
        },
      });

      if (!existingAlert) {
        unsentLots.push(lot);
      }
    }

    if (unsentLots.length === 0) {
      continue;
    }

    await mailTransport.sendExpiryDigest({
      to: settings.notificationEmail,
      shopDomain: shop.domain,
      thresholdDays: settings.warningThresholdDays,
      lots: unsentLots.map((lot) => ({
        productTitle: lot.productTitle ?? "Untitled product",
        variantTitle: lot.variantTitle ?? "Default variant",
        variantSku: lot.variantSku ?? "",
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate.toISOString().slice(0, 10),
        remainingQuantity: lot.remainingQuantity,
      })),
    });

    for (const lot of unsentLots) {
      try {
        await database.alertLog.create({
          data: {
            shopId: shop.id,
            lotId: lot.id,
            channel: "email",
            thresholdDays: settings.warningThresholdDays,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    digestsSent += 1;
    alertLogsCreated += unsentLots.length;
  }

  return {
    shopsChecked: shops.length,
    digestsSent,
    alertLogsCreated,
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
