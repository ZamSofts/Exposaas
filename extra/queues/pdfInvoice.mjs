import PgBoss from "pg-boss";

let boss;

export async function initQueue() {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      archiveCompletedJobsEvery: "1 hour",
      deleteExpiredJobsEvery: "1 hour",
    });

    await boss.start();
    console.log("pg-boss started");

    try {
      await boss.createQueue("gemini-extract");
      console.log("✅ ensured queue: gemini-extract");
    } catch (err) {
      console.error("⚠️ failed to create queue gemini-extract:", err && err.message ? err.message : err);
    }
  }

  return boss;
}
