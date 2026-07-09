-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "variantSku" TEXT,
    "variantPrice" DECIMAL(65,30),
    "lotNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotEvent" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payloadDigest" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSubscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifySubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "priceAmount" DECIMAL(65,30) NOT NULL,
    "priceCurrencyCode" TEXT NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UntrackedStockSale" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT NOT NULL,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "variantSku" TEXT,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UntrackedStockSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");
CREATE INDEX "Shop_domain_idx" ON "Shop"("domain");
CREATE INDEX "Lot_shopId_shopifyVariantId_idx" ON "Lot"("shopId", "shopifyVariantId");
CREATE INDEX "Lot_shopId_expiryDate_idx" ON "Lot"("shopId", "expiryDate");
CREATE INDEX "Lot_shopId_status_idx" ON "Lot"("shopId", "status");
CREATE UNIQUE INDEX "Lot_shopId_shopifyVariantId_lotNumber_key" ON "Lot"("shopId", "shopifyVariantId", "lotNumber");
CREATE INDEX "LotEvent_lotId_createdAt_idx" ON "LotEvent"("lotId", "createdAt");
CREATE INDEX "LotEvent_orderId_idx" ON "LotEvent"("orderId");
CREATE INDEX "AlertLog_shopId_sentAt_idx" ON "AlertLog"("shopId", "sentAt");
CREATE UNIQUE INDEX "AlertLog_shopId_lotId_channel_thresholdDays_key" ON "AlertLog"("shopId", "lotId", "channel", "thresholdDays");
CREATE UNIQUE INDEX "ProcessedWebhook_shopId_webhookId_key" ON "ProcessedWebhook"("shopId", "webhookId");
CREATE INDEX "ProcessedWebhook_shopId_topic_processedAt_idx" ON "ProcessedWebhook"("shopId", "topic", "processedAt");
CREATE UNIQUE INDEX "AppSubscription_shopifySubscriptionId_key" ON "AppSubscription"("shopifySubscriptionId");
CREATE INDEX "AppSubscription_shopId_status_idx" ON "AppSubscription"("shopId", "status");
CREATE UNIQUE INDEX "UntrackedStockSale_shopId_orderId_shopifyVariantId_key" ON "UntrackedStockSale"("shopId", "orderId", "shopifyVariantId");
CREATE INDEX "UntrackedStockSale_shopId_createdAt_idx" ON "UntrackedStockSale"("shopId", "createdAt");
CREATE INDEX "UntrackedStockSale_shopId_shopifyVariantId_idx" ON "UntrackedStockSale"("shopId", "shopifyVariantId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotEvent" ADD CONSTRAINT "LotEvent_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessedWebhook" ADD CONSTRAINT "ProcessedWebhook_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppSubscription" ADD CONSTRAINT "AppSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UntrackedStockSale" ADD CONSTRAINT "UntrackedStockSale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
