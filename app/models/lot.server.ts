import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";

export const lotStatuses = ["ACTIVE", "DEPLETED", "EXPIRED", "DISCARDED"] as const;
export type LotStatus = (typeof lotStatuses)[number];

export type LotListFilters = {
  shopId: string;
  status?: LotStatus | "ALL";
  query?: string;
  sort?: "expiry_asc" | "expiry_desc";
};

export type LotFormInput = {
  shopId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitle?: string;
  variantTitle?: string;
  variantSku?: string;
  variantPrice?: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  receivedAt?: string;
  note?: string;
};

export type LotUpdateInput = {
  shopId: string;
  lotId: string;
  lotNumber: string;
  expiryDate: string;
  remainingQuantity: number;
  note?: string;
};

export type QuantityAdjustmentInput = {
  shopId: string;
  lotId: string;
  newRemainingQuantity: number;
};

export type ExpiryDashboard = {
  summary: {
    expiring7: number;
    expiring30: number;
    expiring90: number;
    expired: number;
    valueAtRisk: string;
  };
  actionNeededLots: Array<{
    id: string;
    productTitle: string;
    variantTitle: string;
    variantSku: string;
    shopifyProductId: string;
    lotNumber: string;
    expiryDate: string;
    remainingQuantity: number;
    variantPrice: string;
    valueAtRisk: string;
    daysUntilExpiry: number;
    status: string;
  }>;
  untrackedStockSold: Array<{
    id: string;
    productTitle: string;
    variantTitle: string;
    variantSku: string;
    orderName: string;
    quantity: number;
    createdAt: string;
  }>;
};

export function isLotStatus(value: string): value is LotStatus {
  return lotStatuses.includes(value as LotStatus);
}

export async function listLots({ shopId, status, query, sort }: LotListFilters) {
  const trimmedQuery = query?.trim();

  return prisma.lot.findMany({
    where: {
      shopId,
      ...(status && status !== "ALL" ? { status } : {}),
      ...(trimmedQuery
        ? {
            OR: [
              { lotNumber: { contains: trimmedQuery } },
              { productTitle: { contains: trimmedQuery } },
              { variantSku: { contains: trimmedQuery } },
            ],
          }
        : {}),
    },
    orderBy: {
      expiryDate: sort === "expiry_desc" ? "desc" : "asc",
    },
  });
}

export async function getLotForEdit(shopId: string, lotId: string) {
  return prisma.lot.findFirst({
    where: { id: lotId, shopId },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });
}

export async function getExpiryDashboard(
  shopId: string,
  warningThresholdDays: number,
  now = new Date(),
): Promise<ExpiryDashboard> {
  const today = startOfUtcDay(now);
  const lots = await prisma.lot.findMany({
    where: {
      shopId,
      status: { in: ["ACTIVE", "EXPIRED"] },
      remainingQuantity: { gt: 0 },
    },
    orderBy: { expiryDate: "asc" },
  });

  const activeLots = lots.filter((lot) => lot.status === "ACTIVE");
  const expiredLots = lots.filter(
    (lot) => lot.status === "EXPIRED" || startOfUtcDay(lot.expiryDate) < today,
  );
  const warningCutoff = addUtcDays(today, warningThresholdDays);
  const actionNeededLots = activeLots
    .filter((lot) => startOfUtcDay(lot.expiryDate) <= warningCutoff)
    .map((lot) => {
      const valueAtRisk = getLotValueAtRisk(lot.remainingQuantity, lot.variantPrice);
      return {
        id: lot.id,
        productTitle: lot.productTitle ?? "Untitled product",
        variantTitle: lot.variantTitle ?? "Default variant",
        variantSku: lot.variantSku ?? "",
        shopifyProductId: lot.shopifyProductId,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate.toISOString().slice(0, 10),
        remainingQuantity: lot.remainingQuantity,
        variantPrice: lot.variantPrice?.toString() ?? "0",
        valueAtRisk: valueAtRisk.toFixed(2),
        daysUntilExpiry: getUtcDayDifference(today, lot.expiryDate),
        status: lot.status,
      };
    });

  const valueAtRisk = actionNeededLots.reduce(
    (sum, lot) => sum.plus(new Prisma.Decimal(lot.valueAtRisk)),
    new Prisma.Decimal(0),
  );
  const untrackedStockSold = await prisma.untrackedStockSale.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    summary: {
      expiring7: countExpiringUnits(activeLots, today, 7),
      expiring30: countExpiringUnits(activeLots, today, 30),
      expiring90: countExpiringUnits(activeLots, today, 90),
      expired: expiredLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0),
      valueAtRisk: valueAtRisk.toFixed(2),
    },
    actionNeededLots,
    untrackedStockSold: untrackedStockSold.map((sale) => ({
      id: sale.id,
      productTitle: sale.productTitle ?? "Untitled product",
      variantTitle: sale.variantTitle ?? "Default variant",
      variantSku: sale.variantSku ?? "",
      orderName: sale.orderName ?? sale.orderId,
      quantity: sale.quantity,
      createdAt: sale.createdAt.toISOString(),
    })),
  };
}

export async function createLot(input: LotFormInput) {
  return prisma.$transaction(async (tx) => {
    const createdLot = await tx.lot.create({
      data: {
        shopId: input.shopId,
        shopifyProductId: input.shopifyProductId,
        shopifyVariantId: input.shopifyVariantId,
        productTitle: input.productTitle,
        variantTitle: input.variantTitle,
        variantSku: input.variantSku,
        variantPrice: input.variantPrice ? new Prisma.Decimal(input.variantPrice) : null,
        lotNumber: input.lotNumber,
        expiryDate: parseDate(input.expiryDate),
        initialQuantity: input.quantity,
        remainingQuantity: input.quantity,
        receivedAt: input.receivedAt ? parseDate(input.receivedAt) : new Date(),
        note: input.note,
        status: "ACTIVE",
      },
    });

    await tx.lotEvent.create({
      data: {
        lotId: createdLot.id,
        type: "CREATED",
        quantityDelta: input.quantity,
      },
    });

    return createdLot;
  });
}

export async function updateLot(input: LotUpdateInput) {
  const existingLot = await prisma.lot.findFirstOrThrow({
    where: { id: input.lotId, shopId: input.shopId },
  });
  const quantityDelta = input.remainingQuantity - existingLot.remainingQuantity;
  const nextStatus = getQuantityStatus(input.remainingQuantity, existingLot.status);

  return prisma.$transaction(async (tx) => {
    const updatedLot = await tx.lot.update({
      where: { id: existingLot.id },
      data: {
        lotNumber: input.lotNumber,
        expiryDate: parseDate(input.expiryDate),
        remainingQuantity: input.remainingQuantity,
        note: input.note,
        status: nextStatus,
      },
    });

    if (quantityDelta !== 0) {
      await tx.lotEvent.create({
        data: {
          lotId: updatedLot.id,
          type: "ADJUSTED",
          quantityDelta,
        },
      });
    }

    return updatedLot;
  });
}

export async function adjustLotQuantity(input: QuantityAdjustmentInput) {
  const lot = await prisma.lot.findFirstOrThrow({
    where: { id: input.lotId, shopId: input.shopId },
  });
  const quantityDelta = input.newRemainingQuantity - lot.remainingQuantity;

  if (quantityDelta === 0) {
    return lot;
  }

  return prisma.$transaction(async (tx) => {
    const updatedLot = await tx.lot.update({
      where: { id: lot.id },
      data: {
        remainingQuantity: input.newRemainingQuantity,
        status: getQuantityStatus(input.newRemainingQuantity, lot.status),
      },
    });

    await tx.lotEvent.create({
      data: {
        lotId: updatedLot.id,
        type: "ADJUSTED",
        quantityDelta,
      },
    });

    return updatedLot;
  });
}

export async function discardLot(shopId: string, lotId: string) {
  const lot = await prisma.lot.findFirstOrThrow({
    where: { id: lotId, shopId },
  });

  return prisma.$transaction(async (tx) => {
    const updatedLot = await tx.lot.update({
      where: { id: lot.id },
      data: {
        status: "DISCARDED",
        remainingQuantity: 0,
      },
    });

    await tx.lotEvent.create({
      data: {
        lotId: updatedLot.id,
        type: "DISCARDED",
        quantityDelta: -lot.remainingQuantity,
      },
    });

    return updatedLot;
  });
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function getUtcDayDifference(fromDate: Date, toDate: Date) {
  const from = startOfUtcDay(fromDate).getTime();
  const to = startOfUtcDay(toDate).getTime();
  return Math.ceil((to - from) / 86_400_000);
}

function countExpiringUnits(
  lots: Awaited<ReturnType<typeof prisma.lot.findMany>>,
  today: Date,
  days: number,
) {
  const cutoff = addUtcDays(today, days);
  return lots
    .filter((lot) => {
      const expiryDate = startOfUtcDay(lot.expiryDate);
      return expiryDate >= today && expiryDate <= cutoff;
    })
    .reduce((sum, lot) => sum + lot.remainingQuantity, 0);
}

function getLotValueAtRisk(quantity: number, price: Prisma.Decimal | null) {
  if (!price) {
    return new Prisma.Decimal(0);
  }
  return price.mul(quantity);
}

function getQuantityStatus(quantity: number, currentStatus: string): LotStatus {
  if (currentStatus === "DISCARDED") {
    return "DISCARDED";
  }
  return quantity === 0 ? "DEPLETED" : "ACTIVE";
}
