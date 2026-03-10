import { ensureQueue } from "./pgBoss.mjs";

export async function initQueue() {
  return ensureQueue("email-poll");
}
