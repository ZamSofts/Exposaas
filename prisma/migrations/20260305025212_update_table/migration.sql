/*
  Warnings:

  - You are about to drop the `ChatMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ChatMessage" DROP CONSTRAINT "ChatMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- AlterTable
ALTER TABLE "public"."InvoiceJobs" ADD COLUMN     "docType" TEXT NOT NULL DEFAULT 'invoice';

-- AlterTable
ALTER TABLE "public"."PaymentConfirmation" ADD COLUMN     "auctionHouse" TEXT,
ADD COLUMN     "diffSummary" JSONB,
ADD COLUMN     "embedding" JSONB,
ADD COLUMN     "isGolden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "public"."Vehicle" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "length" INTEGER,
ADD COLUMN     "m3" DECIMAL(8,2),
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "public"."VehicleDocument" ADD COLUMN     "docType" TEXT;

-- DropTable
DROP TABLE "public"."ChatMessage";

-- DropTable
DROP TABLE "public"."Notification";

-- DropEnum
DROP TYPE "public"."NotificationCategory";

-- CreateTable
CREATE TABLE "public"."PromptVersion" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" INTEGER,
    "strategy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "score" DOUBLE PRECISION,
    "scoreDetails" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleAuditLog" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorId" TEXT,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptVersion_companyId_idx" ON "public"."PromptVersion"("companyId");

-- CreateIndex
CREATE INDEX "PromptVersion_companyId_status_idx" ON "public"."PromptVersion"("companyId", "status");

-- CreateIndex
CREATE INDEX "VehicleAuditLog_vehicleId_idx" ON "public"."VehicleAuditLog"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleAuditLog_vehicleId_createdAt_idx" ON "public"."VehicleAuditLog"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceJobs_companyId_docType_idx" ON "public"."InvoiceJobs"("companyId", "docType");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_companyId_auctionHouse_idx" ON "public"."PaymentConfirmation"("companyId", "auctionHouse");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_invoiceJobId_idx" ON "public"."PaymentConfirmation"("invoiceJobId");

-- AddForeignKey
ALTER TABLE "public"."PromptVersion" ADD CONSTRAINT "PromptVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromptVersion" ADD CONSTRAINT "PromptVersion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleAuditLog" ADD CONSTRAINT "VehicleAuditLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
