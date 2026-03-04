import PgBoss from "pg-boss";

let boss;

async function initBoss() {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      archiveCompletedJobsEvery: "1 hour",
      deleteExpiredJobsEvery: "1 hour",
      retryLimit: 3,
      retryDelay: 30,           // seconds between retries
      expireInHours: 24,        // jobs expire after 24h
    });

    await boss.start();
    console.log("pg-boss started");

    if (typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }
  }

  return boss;
}

export async function ensureQueue(queueName) {
  const b = await initBoss();

  // Create Dead Letter Queue companion first, then main queue with DLQ routing.
  // pg-boss createQueue is idempotent (INSERT ON CONFLICT DO NOTHING).
  // Note: DLQ option only takes effect on first creation — pre-existing queues retain their config.
  const dlqName = `${queueName}__dlq`;
  try {
    await b.createQueue(dlqName);
    await b.createQueue(queueName, { deadLetter: dlqName });
    console.log(`✅ ensured queue: ${queueName} (DLQ: ${dlqName})`);
  } catch (err) {
    console.error(`⚠️ failed to create queue ${queueName}:`, err?.message || err);
  }

  return b;
}
