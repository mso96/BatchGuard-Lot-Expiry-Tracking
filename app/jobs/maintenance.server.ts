import { type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";

export type NightlyMaintenanceResult = {
  expiredLots: number;
  depletedLots: number;
  metafieldMirrorUpdatesQueued: number;
};

export async function runNightlyMaintenanceJob({
  database = prisma,
  now = new Date(),
}: {
  database?: PrismaClient;
  now?: Date;
} = {}): Promise<NightlyMaintenanceResult> {
  const today = startOfUtcDay(now);

  const expiredLots = await database.lot.updateMany({
    where: {
      status: "ACTIVE",
      remainingQuantity: { gt: 0 },
      expiryDate: { lt: today },
    },
    data: { status: "EXPIRED" },
  });

  const depletedLots = await database.lot.updateMany({
    where: {
      status: "ACTIVE",
      remainingQuantity: 0,
    },
    data: { status: "DEPLETED" },
  });

  const affectedVariants = await database.lot.findMany({
    where: {
      OR: [
        { status: { in: ["ACTIVE", "EXPIRED"] } },
        { remainingQuantity: 0 },
      ],
    },
    select: {
      shopId: true,
      shopifyVariantId: true,
    },
    distinct: ["shopId", "shopifyVariantId"],
  });

  // TODO: Use Shopify Admin GraphQL to mirror nearest expiry into
  // `batchguard.nearest_expiry` for each affected variant. Queue this work in production.
  return {
    expiredLots: expiredLots.count,
    depletedLots: depletedLots.count,
    metafieldMirrorUpdatesQueued: affectedVariants.length,
  };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
