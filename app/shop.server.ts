import { prisma } from "./db.server";

const demoShopDomain = "example-dev-store.myshopify.com";

const defaultSettings = {
  warningThresholdDays: 30,
  notificationEmail: "ops@example-dev-store.myshopify.com",
  timezone: "America/New_York",
  alertsEnabled: true,
};

export type ShopSettings = typeof defaultSettings;

export type ShopSettingsInput = {
  warningThresholdDays: number;
  notificationEmail: string;
  timezone: string;
  alertsEnabled: boolean;
};

export async function getCurrentShopId() {
  // TODO: Replace this with the Shopify template's authenticated admin/session lookup.
  const existingShop = await prisma.shop.findUnique({
    where: { domain: demoShopDomain },
  });

  if (existingShop) {
    return existingShop.id;
  }

  const shop = await prisma.shop.create({
    data: {
      domain: demoShopDomain,
      settings: JSON.stringify(defaultSettings),
    },
  });

  return shop.id;
}

export async function getCurrentShop() {
  const shopId = await getCurrentShopId();
  return prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
  });
}

export function parseShopSettings(settings: string): ShopSettings {
  try {
    const parsed = JSON.parse(settings) as Partial<ShopSettings>;
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
    data: { settings: JSON.stringify(normalizedSettings) },
  });
}
