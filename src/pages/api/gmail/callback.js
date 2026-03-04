/**
 * Gmail OAuth2 Callback
 *
 * GET /api/gmail/callback?code=...
 * Exchanges the auth code for tokens, saves refresh token to GmailAccount.
 */

import { getSession, prisma } from "@/lib/useful";
import { exchangeCode, getEmailAddress } from "@extra/utils/gmailClient";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const { code } = req.query;

  if (!code) {
    return res.redirect("/documents?gmailError=Missing+auth+code");
  }

  try {
    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return res.redirect(
        "/documents?gmailError=No+refresh+token+received.+Try+disconnecting+and+reconnecting."
      );
    }

    const email = await getEmailAddress(tokens.refresh_token);

    // Upsert: one Gmail account per company
    await prisma.gmailAccount.upsert({
      where: { companyId: session.companyId },
      update: {
        email,
        refreshToken: tokens.refresh_token,
        isActive: true,
      },
      create: {
        companyId: session.companyId,
        email,
        refreshToken: tokens.refresh_token,
        isActive: true,
      },
    });

    res.redirect("/documents?gmailConnected=true");
  } catch (err) {
    console.error("❌ Gmail OAuth callback error:", err);
    res.redirect(
      "/documents?gmailError=" + encodeURIComponent(err.message)
    );
  }
}
