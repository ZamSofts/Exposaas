-- AlterTable
ALTER TABLE "public"."Role" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "public"."Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
