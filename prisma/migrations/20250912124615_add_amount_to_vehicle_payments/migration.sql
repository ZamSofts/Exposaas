/*
  Warnings:

  - A unique constraint covering the columns `[name,companyId]` on the table `Role` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Role_name_key";

-- CreateTable
CREATE TABLE "public"."VehiclePayments" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "amount" DECIMAL(10,2) NOT NULL,
    "remarks" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_companyId_key" ON "public"."Role"("name", "companyId");

-- AddForeignKey
ALTER TABLE "public"."VehiclePayments" ADD CONSTRAINT "VehiclePayments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
