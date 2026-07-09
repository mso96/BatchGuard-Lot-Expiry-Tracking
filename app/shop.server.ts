import type { Prisma } from "@prisma/client";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "./db.server";
import { authenticate } from "./shopify.server";

const defaultSettings = {
  warningThresholdDays: 30,
  notificationEmail: "",
  timezone: "UTC",
  alertsEnabled: true,
};

export type ShopSettings = typeof defaultSettings;

export type ShopSettingsInput = {
  warningThresholdDays: number;
  notificationEmail: string;
  timezone: string;
  alertsEnabled: boolean;
};

type AuthenticatedRequest = LoaderFunctionArgs["request"] | ActionFunctionArgs["request"];

export async function getCurrentShopId(request: AuthenticatedRequest) {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForDomain(session.shop);

  return shop.id;
}

export async function getCurrentShop(request: AuthenticatedRequest) {
  const { session } = await authenticate.admin(request);
  return ensureShopForDomain(session.shop);
}

export async function ensureShopForDomain(domain: string) {
  const existingShop = await prisma.shop.findUnique({
    where: { domain },
  });

  if (existingShop) {
    return existingShop;
  }

  return prisma.shop.create({
    data: {
      domain,
      settings: defaultSettings,
    },
  });
}

export function parseShopSettings(settings: Prisma.JsonValue): ShopSettings {
  try {
    const parsed =
      typeof settings === "string"
        ? (JSON.parse(settings) as Partial<ShopSettings>)
        : (settings as Partial<ShopSettings>);
    return {
      warningThresholdDays:
        typeof parsed.warningThresholdDays === "number"
          ? parsed.warningThresholdDays
          : defaultSettings.warningThresholdDays,
      notificationEmail:
        typeof parsed.notificationEmail === "string"
          ? parsed.notificationEmail
          : defaultSettings.notificationEmail,
      timezone:
        typeof parsed.timezone === "string" ? parsed.timezone : defaultSettings.timezone,
      alertsEnabled:
        typeof parsed.alertsEnabled === "boolean"
          ? parsed.alertsEnabled
          : defaultSettings.alertsEnabled,
    };
  } catch {
    return defaultSettings;
  }
}

export async function updateShopSettings(shopId: string, settings: ShopSettingsInput) {
  const normalizedSettings: ShopSettings = {
    warningThresholdDays: Math.max(1, Math.floor(settings.warningThresholdDays)),
    notificationEmail: settings.notificationEmail.trim(),
    timezone: settings.timezone.trim() || defaultSettings.timezone,
    alertsEnabled: settings.alertsEnabled,
  };

  return prisma.shop.update({
    where: { id: shopId },
    data: { settings: normalizedSettings },
  });
}
