const IORedis = require("ioredis");
require("dotenv").config();

const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: {}, // Upstash requires TLS
});

async function inspectRedis() {
  try {
    console.log("🔍 Inspecting Redis...");
    console.log("📡 Connected to:", process.env.REDIS_URL);

    // Get all keys
    const keys = await redis.keys("*");
    console.log("\n🔑 All Redis Keys:");
    keys.forEach(key => console.log(`  - ${key}`));

    // Get vehicle queue specific info
    console.log("\n🚗 Vehicle Queue Information:");

    const queueKeys = ["bull:vehicle:waiting", "bull:vehicle:active", "bull:vehicle:completed", "bull:vehicle:failed", "bull:vehicle:delayed", "bull:vehicle:paused"];

    for (const key of queueKeys) {
      try {
        const keyType = await redis.type(key);
        console.log(`  ${key} (${keyType}):`);

        if (keyType === "list") {
          const count = await redis.llen(key);
          console.log(`    ${count} items`);

          if (count > 0) {
            const items = await redis.lrange(key, 0, 2);
            console.log(`    Sample items:`, items.slice(0, 2));
          }
        } else if (keyType === "zset") {
          const count = await redis.zcard(key);
          console.log(`    ${count} items`);

          if (count > 0) {
            const items = await redis.zrange(key, 0, 2, "WITHSCORES");
            console.log(`    Sample items:`, items);
          }
        } else if (keyType === "string") {
          const value = await redis.get(key);
          console.log(`    Value: ${value}`);
        } else {
          console.log(`    Unsupported type: ${keyType}`);
        }
      } catch (error) {
        console.log(`    Error reading ${key}:`, error.message);
      }
    }

    // Get individual job details
    console.log("\n📝 Individual Job Details:");
    const jobKeys = keys.filter(key => key.match(/^bull:vehicle:\d+$/));
    for (const jobKey of jobKeys.slice(0, 5)) {
      // Show first 5 jobs
      try {
        const jobData = await redis.hgetall(jobKey);
        const parsedData = jobData.data ? JSON.parse(jobData.data) : {};
        console.log(`  ${jobKey}:`, {
          id: jobData.id,
          name: jobData.name,
          data: {
            filePath: parsedData.filePath,
            companyId: parsedData.companyId,
          },
          timestamp: jobData.timestamp ? new Date(parseInt(jobData.timestamp)).toISOString() : null,
          processedOn: jobData.processedOn ? new Date(parseInt(jobData.processedOn)).toISOString() : null,
          finishedOn: jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : null,
          //   returnvalue: jobData.returnvalue,
        });
      } catch (error) {
        console.log(`    Error reading ${jobKey}:`, error.message);
      }
    }

    // Get Redis info
    const info = await redis.info();
    console.log("\n📊 Redis Server Info:");
    const lines = info.split("\r\n");
    const relevantInfo = lines.filter(line => line.includes("used_memory_human") || line.includes("connected_clients") || line.includes("total_commands_processed"));
    relevantInfo.forEach(line => console.log(`  ${line}`));
  } catch (error) {
    console.error("❌ Error inspecting Redis:", error);
  } finally {
    await redis.disconnect();
    console.log("\n✅ Disconnected from Redis");
  }
}

inspectRedis();
