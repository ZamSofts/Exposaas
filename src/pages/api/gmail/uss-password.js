/**
 * USS Password Management
 *
 * POST /api/gmail/uss-password
 * Saves the USS member number (used as PDF password) for the current company.
 */

import { getSession, prisma } from "@/lib/useful";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const { password } = req.body;

  if (!password || password.trim().length === 0) {
    return res.status(400).json({ error: "Password is required" });
  }

  const account = await prisma.gmailAccount.findUnique({
    where: { companyId: session.companyId },
  });

  if (!account) {
    return res
      .status(404)
      .json({ error: "Gmail not connected. Connect Gmail first." });
  }

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { ussPassword: password.trim() },
  });

  res.status(200).json({ message: "USS password saved" });
}
