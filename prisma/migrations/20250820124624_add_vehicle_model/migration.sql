-- CreateEnum
CREATE TYPE "public"."VehicleStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "chassisNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "public"."VehicleStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassisNumber_key" ON "public"."Vehicle"("chassisNumber");

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
