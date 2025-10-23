import PgBoss from "pg-boss";

let boss;

async function initBoss() {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      archiveCompletedJobsEvery: "1 hour",
      deleteExpiredJobsEvery: "1 hour",
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
    await b.createQueue(queueName);
    console.log(`✅ ensured queue: ${queueName}`);
  } catch (err) {
    console.error(`⚠️ failed to create queue ${queueName}:`, err && err.message ? err.message : err);
  }

  return b;
}

export async function getBoss() {
  return await initBoss();
}
