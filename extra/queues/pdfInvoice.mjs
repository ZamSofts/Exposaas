import { ensureQueue } from "./pgBoss.mjs";

export async function initQueue() {
  const boss = await ensureQueue("gemini-extract");
  return boss;
}
