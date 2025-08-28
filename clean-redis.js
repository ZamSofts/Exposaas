const IORedis = require("ioredis");
require("dotenv").config();

const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: {}, // Upstash requires TLS
});

async function cleanRedis() {
  try {
    console.log("🧹 Starting Redis cleanup...");
    console.log("📡 Connected to:", process.env.REDIS_URL);

    // Vehicle queue keys to clean
    const queueKeys = ["bull:vehicle:waiting", "bull:vehicle:active", "bull:vehicle:completed", "bull:vehicle:failed", "bull:vehicle:delayed", "bull:vehicle:paused"];

    console.log("\n🚗 Cleaning vehicle queue...");

    let totalDeleted = 0;

    // Clean queue lists and sets
    for (const key of queueKeys) {
      try {
        const keyType = await redis.type(key);
        if (keyType !== "none") {
          const deleted = await redis.del(key);
          console.log(`  ✅ Deleted ${key} (${keyType})`);
          totalDeleted += deleted;
        }
      } catch (error) {
        console.log(`  ❌ Error deleting ${key}:`, error.message);
      }
    }

    // Get and delete individual job data
    console.log("\n📝 Cleaning individual jobs...");
    const allKeys = await redis.keys("*");
    const jobKeys = allKeys.filter(key => key.match(/^bull:vehicle:\d+$/));

    if (jobKeys.length > 0) {
      const deleted = await redis.del(...jobKeys);
      console.log(`  ✅ Deleted ${deleted} job records`);
      totalDeleted += deleted;
    }

    // Clean other vehicle-related keys
    const vehicleKeys = allKeys.filter(key => key.startsWith("bull:vehicle:"));
    const remainingKeys = vehicleKeys.filter(key => !queueKeys.includes(key) && !key.match(/^bull:vehicle:\d+$/));

    if (remainingKeys.length > 0) {
      console.log("\n🔧 Cleaning other vehicle queue keys...");
      for (const key of remainingKeys) {
        try {
          await redis.del(key);
          console.log(`  ✅ Deleted ${key}`);
          totalDeleted++;
        } catch (error) {
          console.log(`  ❌ Error deleting ${key}:`, error.message);
        }
      }
    }

    console.log(`\n✨ Cleanup completed! Deleted ${totalDeleted} keys total`);

    // Verify cleanup
    console.log("\n🔍 Verifying cleanup...");
    const remainingVehicleKeys = await redis.keys("bull:vehicle:*");
    if (remainingVehicleKeys.length === 0) {
      console.log("  ✅ All vehicle queue data cleaned successfully");
    } else {
      console.log(`  ⚠️  ${remainingVehicleKeys.length} keys still remaining:`, remainingVehicleKeys);
    }
  } catch (error) {
    console.error("❌ Error cleaning Redis:", error);
  } finally {
    await redis.disconnect();
    console.log("\n✅ Disconnected from Redis");
  }
}

cleanRedis();
