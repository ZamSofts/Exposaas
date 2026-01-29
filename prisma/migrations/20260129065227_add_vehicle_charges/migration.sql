-- AlterTable
ALTER TABLE "public"."Vehicle" ADD COLUMN     "auctionFee" DECIMAL(12,2),
ADD COLUMN     "auctionTax" DECIMAL(12,2),
ADD COLUMN     "bidAmount" DECIMAL(12,2),
ADD COLUMN     "bidTax" DECIMAL(12,2),
ADD COLUMN     "insuranceFee" DECIMAL(12,2),
ADD COLUMN     "insuranceTax" DECIMAL(12,2),
ADD COLUMN     "otherFees" DECIMAL(12,2),
ADD COLUMN     "recyclingFee" DECIMAL(12,2),
ADD COLUMN     "sourceInvoiceJobId" INTEGER,
ADD COLUMN     "totalCost" DECIMAL(12,2),
ADD COLUMN     "transportFee" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "Vehicle_sourceInvoiceJobId_idx" ON "public"."Vehicle"("sourceInvoiceJobId");

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_sourceInvoiceJobId_fkey" FOREIGN KEY ("sourceInvoiceJobId") REFERENCES "public"."InvoiceJobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
