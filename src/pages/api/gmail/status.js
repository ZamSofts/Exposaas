/**
 * Gmail Connection Status
 *
 * GET /api/gmail/status
 * Returns the Gmail connection status for the current company.
 */

import { getSession, prisma } from "@/lib/useful";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);

  const account = await prisma.gmailAccount.findUnique({
    where: { companyId: session.companyId },
    select: {
      email: true,
      isActive: true,
      ussPassword: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { emails: true } },
    },
  });

  if (!account) {
    return res.status(200).json({ connected: false });
  }

  res.status(200).json({
    connected: true,
    email: account.email,
    isActive: account.isActive,
    hasUssPassword: !!account.ussPassword,
    emailCount: account._count.emails,
    connectedAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
}
