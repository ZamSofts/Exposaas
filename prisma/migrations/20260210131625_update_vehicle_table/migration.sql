/*
  Warnings:

  - You are about to drop the column `auctionTax` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `bidTax` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceTax` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `statusId` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `taxProration` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `transportTax` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the `VehicleStatus` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[companyId,uniqueId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Customer" DROP CONSTRAINT "Customer_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vehicle" DROP CONSTRAINT "Vehicle_statusId_fkey";

-- DropIndex
DROP INDEX "public"."Customer_uniqueId_key";

-- DropIndex
DROP INDEX "public"."Vehicle_statusId_idx";

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "companyId" INTEGER,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Vehicle" DROP COLUMN "auctionTax",
DROP COLUMN "bidTax",
DROP COLUMN "insuranceTax",
DROP COLUMN "statusId",
DROP COLUMN "taxProration",
DROP COLUMN "transportTax",
ADD COLUMN     "documentStatus" TEXT,
ADD COLUMN     "memo" TEXT;

-- DropTable
DROP TABLE "public"."VehicleStatus";

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "public"."Customer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_uniqueId_key" ON "public"."Customer"("companyId", "uniqueId");

-- CreateIndex
CREATE INDEX "Vehicle_companyId_idx" ON "public"."Vehicle"("companyId");

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
