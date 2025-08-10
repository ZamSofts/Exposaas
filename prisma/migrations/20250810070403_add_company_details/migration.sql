/*
  Warnings:

  - Added the required column `createdAt` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."CompanyStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "public"."CompanyStatus" NOT NULL DEFAULT 'active';
