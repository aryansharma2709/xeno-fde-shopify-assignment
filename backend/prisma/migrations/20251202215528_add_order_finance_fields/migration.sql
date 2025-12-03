/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Order` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_tenantId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "createdAt",
ADD COLUMN     "discounts" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "returns" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "totalPrice" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_tenantId_orderDate_idx" ON "Order"("tenantId", "orderDate");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
