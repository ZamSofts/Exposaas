/**
 * Simple in-memory rate limiter for login attempts.
 * Limits by IP address, resets after windowMs.
 */

const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // Max attempts per window

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate-limited.
 * @param {import("next").NextApiRequest} req
 * @returns {{ limited: boolean, remaining: number, resetAt: number }}
 */
export function checkLoginRateLimit(req) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";

  const key = `login:${ip}`;
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // New window
    attempts.set(key, { count: 1, firstAttempt: now });
    return { limited: false, remaining: MAX_ATTEMPTS - 1, resetAt: now + WINDOW_MS };
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    return {
      limited: true,
      remaining: 0,
      resetAt: entry.firstAttempt + WINDOW_MS,
    };
  }

  return {
    limited: false,
    remaining: MAX_ATTEMPTS - entry.count,
    resetAt: entry.firstAttempt + WINDOW_MS,
  };
}
