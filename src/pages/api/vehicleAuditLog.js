/**
 * Vehicle Audit Log API
 *
 * GET /api/vehicleAuditLog?vehicleId=123&limit=50
 *
 * Returns audit trail entries for a specific vehicle, ordered by most recent first.
 * Resolves actorId → username for display.
 */

import { prisma, getSession } from "@/lib/useful";

// Action labels for display
const ACTION_LABELS = {
  create: "車両を作成",
  update: "フィールドを変更",
  delete: "車両を削除",
  link_document: "書類をリンク",
  payment_create: "支払いを作成",
  payment_update: "支払いを更新",
  payment_delete: "支払いを削除",
  merge: "車両を統合",
};

// Actor labels for display
const ACTOR_LABELS = {
  user: "ユーザー",
  ai: "AI",
  system: "システム",
  csv_import: "CSVインポート",
};

// Source labels for display
function formatSource(source) {
  if (!source) return null;
  if (source === "manual") return "手入力";
  if (source.startsWith("invoiceJob:")) return "請求書";
  if (source.startsWith("csv:")) return "CSV";
  if (source.startsWith("ai_auto_link:")) return "AI自動リンク";
  if (source.startsWith("migration:")) return "データ移行";
  return source;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);

  const vehicleId = Number(req.query.vehicleId);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  if (!vehicleId) {
    return res.status(400).json({ error: "vehicleId is required" });
  }

  try {
    // Verify vehicle belongs to user's company
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { companyId: true },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    if (session.role !== "Sadmin" && vehicle.companyId !== session.companyId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Fetch audit logs
    const [logs, total] = await Promise.all([
      prisma.vehicleAuditLog.findMany({
        where: { vehicleId },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.vehicleAuditLog.count({ where: { vehicleId } }),
    ]);

    // Resolve actorIds to usernames (batch query)
    const actorIds = [...new Set(logs.map(l => l.actorId).filter(Boolean))];
    const userMap = new Map();

    if (actorIds.length > 0) {
      // actorId is stored as string, User.id is int
      const numericIds = actorIds.map(Number).filter(n => !isNaN(n));
      if (numericIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: numericIds } },
          select: { id: true, username: true },
        });
        for (const u of users) {
          userMap.set(String(u.id), u.username);
        }
      }
    }

    // Special case: actorId "1" = Sadmin (not in User table)
    if (!userMap.has("1")) {
      userMap.set("1", "Super Admin");
    }

    // Format logs for frontend
    const formatted = logs.map(log => ({
      id: log.id,
      action: log.action,
      actionLabel: ACTION_LABELS[log.action] || log.action,
      actor: log.actor,
      actorLabel: ACTOR_LABELS[log.actor] || log.actor,
      actorName: log.actorId ? (userMap.get(log.actorId) || `User #${log.actorId}`) : null,
      field: log.field,
      oldValue: log.oldValue,
      newValue: log.newValue,
      source: log.source,
      sourceLabel: formatSource(log.source),
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return res.json({ logs: formatted, total });
  } catch (err) {
    console.error("vehicleAuditLog error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
