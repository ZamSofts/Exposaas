/*
  Warnings:

  - You are about to drop the column `status` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `statusId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Vehicle" DROP COLUMN "status",
ADD COLUMN     "statusId" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "public"."VehicleStatus";

-- CreateTable
CREATE TABLE "public"."VehicleStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VehicleStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleStatus_name_key" ON "public"."VehicleStatus"("name");

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."VehicleStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
