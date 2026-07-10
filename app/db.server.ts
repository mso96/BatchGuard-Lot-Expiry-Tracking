import { type Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export type CloudflareBindings = {
  HYPERDRIVE?: {
    connectionString: string;
  };
};

declare global {
  var __batchguardPrisma: PrismaClient | undefined;
  var __batchguardCloudflareBindings: CloudflareBindings | undefined;
}

export function setCloudflareBindings(bindings: CloudflareBindings) {
  globalThis.__batchguardCloudflareBindings = bindings;
}

function createPrismaClient() {
  const log: Prisma.LogLevel[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
  const connectionString = globalThis.__batchguardCloudflareBindings?.HYPERDRIVE?.connectionString;

  if (connectionString) {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log,
    });
  }

  return new PrismaClient({ log });
}

function getPrismaClient() {
  if (!globalThis.__batchguardPrisma) {
    globalThis.__batchguardPrisma = createPrismaClient();
  }

  return globalThis.__batchguardPrisma;
}

// The Shopify session adapter is configured during module initialization. A
// proxy defers creating Prisma until the Pages Function receives its bindings.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
