-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "settings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "variantSku" TEXT,
    "variantPrice" DECIMAL(12, 2),
    "lotNumber" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LotEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotEvent_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,
    CONSTRAINT "AlertLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlertLog_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payloadDigest" TEXT,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedWebhook_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifySubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "priceAmount" DECIMAL(10, 2) NOT NULL,
    "priceCurrencyCode" TEXT NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");
CREATE INDEX "Shop_domain_idx" ON "Shop"("domain");

-- CreateIndex
CREATE INDEX "Lot_shopId_shopifyVariantId_idx" ON "Lot"("shopId", "shopifyVariantId");
CREATE INDEX "Lot_shopId_expiryDate_idx" ON "Lot"("shopId", "expiryDate");
CREATE INDEX "Lot_shopId_status_idx" ON "Lot"("shopId", "status");
CREATE UNIQUE INDEX "Lot_shopId_shopifyVariantId_lotNumber_key" ON "Lot"("shopId", "shopifyVariantId", "lotNumber");

-- CreateIndex
CREATE INDEX "LotEvent_lotId_createdAt_idx" ON "LotEvent"("lotId", "createdAt");
CREATE INDEX "LotEvent_orderId_idx" ON "LotEvent"("orderId");

-- CreateIndex
CREATE INDEX "AlertLog_shopId_sentAt_idx" ON "AlertLog"("shopId", "sentAt");
CREATE UNIQUE INDEX "AlertLog_shopId_lotId_channel_thresholdDays_key" ON "AlertLog"("shopId", "lotId", "channel", "thresholdDays");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhook_shopId_webhookId_key" ON "ProcessedWebhook"("shopId", "webhookId");
CREATE INDEX "ProcessedWebhook_shopId_topic_processedAt_idx" ON "ProcessedWebhook"("shopId", "topic", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSubscription_shopifySubscriptionId_key" ON "AppSubscription"("shopifySubscriptionId");
CREATE INDEX "AppSubscription_shopId_status_idx" ON "AppSubscription"("shopId", "status");
