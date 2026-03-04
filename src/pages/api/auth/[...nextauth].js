import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkLoginRateLimit } from "@/lib/rateLimit";

const nextAuthHandler = NextAuth(authOptions);

export default async function handler(req, res) {
  // Rate-limit login attempts (POST to credentials callback)
  if (req.method === "POST") {
    const { limited, resetAt } = checkLoginRateLimit(req);
    if (limited) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }
  }
  return nextAuthHandler(req, res);
}
