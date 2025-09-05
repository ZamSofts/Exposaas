const process = require("process");

function formatBytes(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100 + " MB";
}

function logMemoryUsage() {
  const usage = process.memoryUsage();
  console.log("📊 Memory Usage:");
  console.log(`  RSS: ${formatBytes(usage.rss)} (Resident Set Size)`);
  console.log(`  Heap Used: ${formatBytes(usage.heapUsed)} / ${formatBytes(usage.heapTotal)}`);
  console.log(`  External: ${formatBytes(usage.external)}`);
  console.log(`  Array Buffers: ${formatBytes(usage.arrayBuffers)}`);
  console.log("---");
}

// Log initial memory
logMemoryUsage();

// Log memory every 30 seconds
setInterval(logMemoryUsage, 30000);

// Export for use in other modules
module.exports = { logMemoryUsage };
