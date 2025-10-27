import { ensureQueue } from "./pgBoss.mjs";

export async function initQueue() {
  const boss = await ensureQueue("send-notification");
  return boss;
}
