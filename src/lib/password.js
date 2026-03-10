import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Hash a plaintext password with a random salt.
 * Stored format: "hex_salt:hex_hash"
 */
export async function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${salt}:${hash.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Supports legacy plaintext passwords (no ":" separator) for migration.
 * Returns { valid, needsRehash }.
 */
export async function verifyPassword(plain, stored) {
  if (!stored.includes(":")) {
    const match = plain === stored;
    return { valid: match, needsRehash: match };
  }

  const [salt, storedHash] = stored.split(":");
  const hash = await scryptAsync(plain, salt, KEY_LENGTH);
  const storedBuf = Buffer.from(storedHash, "hex");
  const valid = timingSafeEqual(hash, storedBuf);
  return { valid, needsRehash: false };
}
