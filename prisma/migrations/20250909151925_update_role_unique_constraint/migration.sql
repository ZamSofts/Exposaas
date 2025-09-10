/*
  Warnings:

  - A unique constraint covering the columns `[name,companyId]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Role_name_key";

-- DropIndex
DROP INDEX "public"."User_username_companyId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_companyId_key" ON "public"."Role"("name", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");
