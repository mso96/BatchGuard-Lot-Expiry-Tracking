import { type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";

export type WebhookCleanupResult = {
  shopDeleted: boolean;
};

export async function cleanupShopData(
  shopDomain: string,
  database: PrismaClient = prisma,
): Promise<WebhookCleanupResult> {
  const shop = await database.shop.findUnique({
    where: { domain: shopDomain },
  });

  if (!shop) {
    await database.session.deleteMany({ where: { shop: shopDomain } });
    return { shopDeleted: false };
  }

  await database.$transaction([
    database.session.deleteMany({ where: { shop: shopDomain } }),
    database.shop.delete({ where: { id: shop.id } }),
  ]);

  return { shopDeleted: true };
}

export function noCustomerPiiStoredResponse() {
  return {
    ok: true,
    customerDataStored: false,
  };
}
