/*
  Warnings:

  - You are about to drop the column `companyId` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[uniqueId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Customer" DROP CONSTRAINT "Customer_companyId_fkey";

-- DropIndex
DROP INDEX "public"."Customer_uniqueId_companyId_key";

-- AlterTable
ALTER TABLE "public"."Customer" DROP COLUMN "companyId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_uniqueId_key" ON "public"."Customer"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "public"."Customer"("userId");

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
