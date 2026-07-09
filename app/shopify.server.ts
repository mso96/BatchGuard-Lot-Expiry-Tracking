import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./db.server";

const appUrl =
  process.env.SHOPIFY_APP_URL ?? "https://batchguard-lot-expiry-tracking.onrender.com";
const apiKey =
  process.env.SHOPIFY_API_KEY ??
  process.env.SHOPIFY_CLIENT_ID ??
  "df413c77e6ed80c6b0115f1d00a9e73e";
const apiSecretKey = process.env.SHOPIFY_API_SECRET ?? "development-secret";
const scopes = (process.env.SCOPES ?? "read_products,write_products,read_orders").split(",");

const defaultSettings = {
  warningThresholdDays: 30,
  notificationEmail: "",
  timezone: "UTC",
  alertsEnabled: true,
};

const shopify = shopifyApp({
  apiKey,
  apiSecretKey,
  apiVersion: ApiVersion.July26,
  scopes,
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  hooks: {
    afterAuth: async ({ session }) => {
      const existingShop = await prisma.shop.findUnique({
        where: { domain: session.shop },
      });

      if (!existingShop) {
        await prisma.shop.create({
          data: {
            domain: session.shop,
            settings: defaultSettings,
          },
        });
      }
    },
  },
});

export default shopify;
export const authenticate = shopify.authenticate;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
