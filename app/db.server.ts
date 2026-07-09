import { PrismaClient } from "@prisma/client";

declare global {
  var __batchguardPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__batchguardPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__batchguardPrisma = prisma;
}
