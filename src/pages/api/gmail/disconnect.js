/**
 * Gmail Disconnect
 *
 * DELETE /api/gmail/disconnect
 * Removes the Gmail connection for the current company.
 */

import { getSession, prisma } from "@/lib/useful";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);

  // Delete related EmailMessages first, then the GmailAccount
  const account = await prisma.gmailAccount.findUnique({
    where: { companyId: session.companyId },
  });

  if (!account) {
    return res.status(200).json({ message: "No Gmail account to disconnect" });
  }

  await prisma.emailMessage.deleteMany({
    where: { gmailAccountId: account.id },
  });

  await prisma.gmailAccount.delete({
    where: { id: account.id },
  });

  res.status(200).json({ message: "Gmail disconnected" });
}
