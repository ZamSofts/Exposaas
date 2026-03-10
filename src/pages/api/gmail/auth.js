/**
 * Gmail OAuth2 Auth Redirect
 *
 * GET /api/gmail/auth
 * Redirects the user to Google's OAuth consent screen.
 */

import { getSession } from "@/lib/useful";
import { getAuthUrl } from "@extra/utils/gmailClient";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);

  const url = getAuthUrl();
  res.redirect(url);
}
