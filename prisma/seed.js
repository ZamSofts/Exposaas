const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  const permissions = ["add:user", "edit:user", "delete:user", "view:user", "view:vehicle", "add:vehicle", "edit:vehicle", "delete:vehicle"];

  try {
    await prisma.permission.deleteMany();
  } catch {}

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p },
      update: {}, // do nothing if already exists
      create: { name: p },
    });
  }
}

main()
  .then(() => console.log("Seed completed ✅"))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
