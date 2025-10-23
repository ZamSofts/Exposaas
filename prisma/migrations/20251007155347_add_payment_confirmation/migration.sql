-- CreateTable
CREATE TABLE "public"."PaymentConfirmation" (
    "id" SERIAL NOT NULL,
    "DocumentURL" TEXT,
    "Page" INTEGER NOT NULL,
    "Json" JSONB NOT NULL,
    "isCorrect" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentConfirmation_companyId_idx" ON "public"."PaymentConfirmation"("companyId");

-- AddForeignKey
ALTER TABLE "public"."PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
