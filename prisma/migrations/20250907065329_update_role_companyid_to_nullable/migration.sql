-- DropForeignKey
ALTER TABLE "public"."Role" DROP CONSTRAINT "Role_companyId_fkey";

-- AlterTable
ALTER TABLE "public"."Role" ALTER COLUMN "companyId" DROP NOT NULL,
ALTER COLUMN "companyId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
