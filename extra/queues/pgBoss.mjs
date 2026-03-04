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

  try {
    // Create Dead Letter Queue companion first
    const dlqName = `${queueName}__dlq`;
    await b.createQueue(dlqName);

    // Create main queue with DLQ routing — failed jobs go to DLQ instead of expiring
    await b.createQueue(queueName, { deadLetter: dlqName });
    console.log(`✅ ensured queue: ${queueName} (DLQ: ${dlqName})`);
  } catch (err) {
    // Queue may already exist (createQueue is idempotent) — try without DLQ option as fallback
    try {
      await b.createQueue(queueName);
      console.log(`✅ ensured queue: ${queueName} (DLQ skipped — queue may pre-exist)`);
    } catch (innerErr) {
      console.error(`⚠️ failed to create queue ${queueName}:`, innerErr && innerErr.message ? innerErr.message : innerErr);
    }
  }

  return b;
}
