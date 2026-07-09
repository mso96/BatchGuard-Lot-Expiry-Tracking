import { type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";

export type NightlyMaintenanceResult = {
  expiredLots: number;
  depletedLots: number;
  metafieldMirrorUpdatesQueued: number;
  metafieldMirrorUpdatesApplied: number;
};

export type VariantMetafieldMirror = (input: {
  shopId: string;
  shopifyVariantId: string;
  nearestExpiryDate: string | null;
}) => Promise<void>;

export async function runNightlyMaintenanceJob({
  database = prisma,
  now = new Date(),
  mirrorVariantMetafield,
}: {
  database?: PrismaClient;
  now?: Date;
  mirrorVariantMetafield?: VariantMetafieldMirror;
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

  let metafieldMirrorUpdatesApplied = 0;

  if (mirrorVariantMetafield) {
    for (const variant of affectedVariants) {
      const nearestLot = await database.lot.findFirst({
        where: {
          shopId: variant.shopId,
          shopifyVariantId: variant.shopifyVariantId,
          status: "ACTIVE",
          remainingQuantity: { gt: 0 },
        },
        orderBy: { expiryDate: "asc" },
      });

      await mirrorVariantMetafield({
        shopId: variant.shopId,
        shopifyVariantId: variant.shopifyVariantId,
        nearestExpiryDate: nearestLot?.expiryDate.toISOString().slice(0, 10) ?? null,
      });
      metafieldMirrorUpdatesApplied += 1;
    }
  }

  return {
    expiredLots: expiredLots.count,
    depletedLots: depletedLots.count,
    metafieldMirrorUpdatesQueued: affectedVariants.length,
    metafieldMirrorUpdatesApplied,
  };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
