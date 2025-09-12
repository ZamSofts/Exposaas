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
  "edit:role",
  "add:role",
  "delete:role",

  // Company
  "view:company",
  "edit:company",
  "add:company",
  "delete:company",

  // Vehicle
  "view:vehicle",
  "edit:vehicle",
  "add:vehicle",
  "delete:vehicle",

  // Brand
  "edit:brand",
  "add:brand",
  "delete:brand",

  // Permission
  "view:permission",
  "edit:permission",
  "delete:permission",

  // Add Vehicle (CSV upload)
  "view:addVehicle",
  "add:csv",
  "edit:addVehicle",
  "delete:addVehicle",
];

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
  const Brand = ["-","Toyota", "Honda", "Nissan", "Ford", "Chevrolet", "BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Hyundai"];
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
