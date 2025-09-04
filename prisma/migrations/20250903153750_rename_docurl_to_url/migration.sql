/*
  Warnings:

  - You are about to drop the column `docUrl` on the `VehicleDocument` table. All the data in the column will be lost.
  - Added the required column `Url` to the `VehicleDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."VehicleDocument" DROP COLUMN "docUrl",
ADD COLUMN     "Url" TEXT NOT NULL;
