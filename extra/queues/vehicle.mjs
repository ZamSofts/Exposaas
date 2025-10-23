import { ensureQueue } from "./pgBoss.mjs";

export async function initQueue() {
  const boss = await ensureQueue("vehicle");
  return boss;
}
