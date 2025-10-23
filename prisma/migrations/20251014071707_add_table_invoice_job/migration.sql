-- CreateTable
CREATE TABLE "public"."InvoiceJobs" (
    "id" SERIAL NOT NULL,
    "DocumentURL" TEXT,
    "Json" JSONB NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceJobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceJobs_companyId_idx" ON "public"."InvoiceJobs"("companyId");

-- AddForeignKey
ALTER TABLE "public"."InvoiceJobs" ADD CONSTRAINT "InvoiceJobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
