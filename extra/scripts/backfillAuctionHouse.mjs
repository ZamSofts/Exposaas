/**
 * One-time backfill script: populate auctionHouse on existing PaymentConfirmation records.
 *
 * Run: node -r dotenv/config extra/scripts/backfillAuctionHouse.mjs
 */
import { prisma } from "../PrismaClient/prismaClient.mjs";

async function backfill() {
  const records = await prisma.paymentConfirmation.findMany({
    where: { auctionHouse: null },
    select: { id: true, Json: true },
  });

  console.log(`Found ${records.length} records with NULL auctionHouse`);

  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const json = record.Json;
    if (!json || typeof json !== "object") {
      skipped++;
      continue;
    }

    // Extract first vehicle array — supports { page_1: [...] }, { items: [...] }, or direct array
    let vehicles = null;
    if (Array.isArray(json)) {
      vehicles = json;
    } else if (json.items && Array.isArray(json.items)) {
      vehicles = json.items;
    } else {
      // Try page_1, page_2, etc.
      for (const key of Object.keys(json)) {
        if (Array.isArray(json[key]) && json[key].length > 0) {
          vehicles = json[key];
          break;
        }
      }
    }

    if (!vehicles || vehicles.length === 0) {
      skipped++;
      continue;
    }

    const auctionHouse = vehicles[0]?.auction?.trim() || null;
    if (!auctionHouse) {
      skipped++;
      continue;
    }

    await prisma.paymentConfirmation.update({
      where: { id: record.id },
      data: { auctionHouse },
    });

    updated++;
    console.log(`  #${record.id} → "${auctionHouse}"`);
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

backfill().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
