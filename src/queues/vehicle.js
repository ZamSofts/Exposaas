import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: {}, // Upstash requires TLS
});
console.log("Worker connecting to:", process.env.REDIS_URL);

export const vehicle = new Queue('vehicle', { connection });
