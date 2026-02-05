-- AlterTable
ALTER TABLE "public"."InvoiceJobs" ADD COLUMN     "originalTotalPages" INTEGER,
ADD COLUMN     "pageNumber" INTEGER,
ADD COLUMN     "parentDocumentUrl" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "totalPages" INTEGER,
ALTER COLUMN "Json" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Vehicle" ADD COLUMN     "auctionDate" TEXT,
ADD COLUMN     "containerNumber" TEXT,
ADD COLUMN     "deliverTo" TEXT,
ADD COLUMN     "etd" TEXT,
ADD COLUMN     "numberPlate" TEXT,
ADD COLUMN     "session" TEXT,
ADD COLUMN     "taxProration" DECIMAL(12,2),
ADD COLUMN     "taxSum" DECIMAL(12,2),
ADD COLUMN     "titleTransferDeadline" TIMESTAMP(3),
ADD COLUMN     "transportCompany" TEXT,
ADD COLUMN     "transportTax" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "public"."ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "InvoiceJobs_parentDocumentUrl_idx" ON "public"."InvoiceJobs"("parentDocumentUrl");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "public"."User"("companyId");

-- CreateIndex
CREATE INDEX "Vehicle_brandId_idx" ON "public"."Vehicle"("brandId");

-- CreateIndex
CREATE INDEX "Vehicle_statusId_idx" ON "public"."Vehicle"("statusId");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "public"."Vehicle"("customerId");

-- CreateIndex
CREATE INDEX "VehicleDocument_vehicleId_idx" ON "public"."VehicleDocument"("vehicleId");

-- CreateIndex
CREATE INDEX "VehiclePayments_vehicleId_idx" ON "public"."VehiclePayments"("vehicleId");
