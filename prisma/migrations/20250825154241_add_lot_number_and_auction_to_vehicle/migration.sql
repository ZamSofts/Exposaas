/*
  Warnings:

  - Added the required column `auction` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lotNumber` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Vehicle" ADD COLUMN     "auction" TEXT NOT NULL,
ADD COLUMN     "lotNumber" TEXT NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;
