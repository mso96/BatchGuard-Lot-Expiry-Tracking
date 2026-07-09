-- CreateTable
CREATE TABLE "UntrackedStockSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT NOT NULL,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "variantSku" TEXT,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UntrackedStockSale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UntrackedStockSale_shopId_orderId_shopifyVariantId_key" ON "UntrackedStockSale"("shopId", "orderId", "shopifyVariantId");
CREATE INDEX "UntrackedStockSale_shopId_createdAt_idx" ON "UntrackedStockSale"("shopId", "createdAt");
CREATE INDEX "UntrackedStockSale_shopId_shopifyVariantId_idx" ON "UntrackedStockSale"("shopId", "shopifyVariantId");
