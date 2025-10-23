/*
  Warnings:

  - A unique constraint covering the columns `[companyId,chassisNumber]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Vehicle_chassisNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_chassisNumber_key" ON "public"."Vehicle"("companyId", "chassisNumber");
