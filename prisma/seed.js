const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  const permissions = ["add:user", "edit:user", "delete:user", "view:user", "view:vehicle", "add:vehicle", "edit:vehicle", "delete:vehicle", "add:csv"];
  const VehicleStatus = [
    "In Transit to Yard",
    "Awaiting Inspection",
    "Inspection in Progress",
    "Awaiting Parts/Maintenance",
    "Ready for Loading",
    "Loading in Progress",
    "On Vessel",
    "En Route to Port",
    "At Destination Port",
    "Awaiting Customs Clearance",
    "Cleared for Pickup",
    "Delivered",
  ];
  const Brand = ["Toyota", "Honda", "Nissan", "Ford", "Chevrolet", "BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Hyundai"];
  try {
    await prisma.permission.deleteMany();
    await prisma.vehicleStatus.deleteMany();
    await prisma.brand.deleteMany();
  } catch {}

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p },
      update: {}, // do nothing if already exists
      create: { name: p },
    });
  }

  for (const s of VehicleStatus) {
    await prisma.vehicleStatus.upsert({
      where: { name: s },
      update: {}, // do nothing if already exists
      create: { name: s },
    });
  }

  for (const b of Brand) {
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
