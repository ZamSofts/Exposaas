const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  const permissions = [
    // User
    "view:user",
    "edit:user",
    "add:user",
    "delete:user",

    // Role
    "view:role",
    "edit:role",
    "add:role",
    "delete:role",

    // Vehicle
    "view:vehicle",
    "edit:vehicle",
    "add:vehicle",
    "delete:vehicle",

    // Add Vehicle (CSV upload)
    "add:csv",
    // customer
    "view:customer",
    "edit:customer",
    "add:customer",
    "delete:customer",
  ];

  const Brand = ["-", "Toyota", "Honda", "Nissan", "Ford", "Chevrolet", "BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Hyundai"];
  try {
    await prisma.permission.deleteMany();
    await prisma.brand.deleteMany();
  } catch {}

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p },
      update: {}, // do nothing if already exists
      create: { name: p },
    });
  }

  const vehiclePermission = await prisma.permission.findUnique({
    where: { name: "view:vehicle" },
  });

  let customerRole = await prisma.role.findFirst({
  where: {
    name: {
      equals: "Customer",
      mode: "insensitive", 
    },
    companyId: null,
  },
});

  if (!customerRole) {
    customerRole = await prisma.role.create({
      data: {
        name: "Customer",
        companyId: null,
      },
    });
  }
  if (vehiclePermission) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: customerRole.id,
          permissionId: vehiclePermission.id,
        },
      },
      update: {},
      create: {
        roleId: customerRole.id,
        permissionId: vehiclePermission.id,
      },
    });
  }

  // Ensure "-" brand gets ID = 1 by seeding it first
  await prisma.brand.upsert({
    where: { id: 1 },
    update: { name: "-" },
    create: { id: 1, name: "-" },
  });

  // Seed the rest of the brands (excluding "-" since it's already handled)
  const otherBrands = Brand.filter(b => b !== "-");
  for (const b of otherBrands) {
    await prisma.brand.upsert({
      where: { name: b },
      update: {}, // do nothing if already exists
      create: { name: b },
    });
  }
}

main()
  .then(() => console.log("Seed completed ✅"))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
