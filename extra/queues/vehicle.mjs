import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  enableReadyCheck: false,
  reconnectOnError: err => {
    const targetError = "READONLY";
    return err.message.includes(targetError);
  },
});
console.log("Worker connecting to:", process.env.REDIS_URL);

const vehicle = new Queue("vehicle", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep only last 10 completed jobs
    removeOnFail: 5, // Keep only last 5 failed jobs
    attempts: 3, // Retry failed jobs 3 times
  },
});

console.log("Vehicle Queue initialized.");

export { connection, vehicle };
