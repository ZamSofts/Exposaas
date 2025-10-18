import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  if (["sadmin"].includes(session.role.toLowerCase())) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const { unreadOnly = "false" } = req.query;
  const { sortBy = "createdAt", sortOrder = "desc" } = req.query;

  try {
    if (req.method === "GET") {
      const userId = parseInt(session.id);

      // ---- Load single notification ----
      if (id) {
        const notification = await prisma.notification.findUnique({
          where: {
            id,
            userId: userId, // Ensure user can only access their own notifications
          },
        });

        if (!notification) {
          return res.status(404).json({ error: "Notification not found" });
        }

        // Parse JSON fields
        const formattedNotification = {
          ...notification,
          actions: notification.actions ? JSON.parse(notification.actions) : null,
          metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
        };

        return res.status(200).json(formattedNotification);
      }

      // ---- Load notifications list ----
      const whereClause = {
        userId: userId,
      };

      if (unreadOnly === "true") {
        whereClause.isRead = false;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.notification.count({
          where: whereClause,
        }),
        prisma.notification.count({
          where: {
            userId: userId,
            isRead: false,
          },
        }),
      ]);

      // Parse JSON fields
      const formattedNotifications = notifications.map(n => ({
        ...n,
        actions: n.actions ? JSON.parse(n.actions) : null,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
      }));

      return res.status(200).json({
        notifications: formattedNotifications,
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    if (req.method === "PUT") {
      const { notificationId, markAllRead } = req.body;
      const userId = parseInt(session.id);

      if (markAllRead) {
        // Mark all notifications as read for the user
        const result = await prisma.notification.updateMany({
          where: {
            userId: userId,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });

        return res.status(200).json({
          message: `Marked ${result.count} notifications as read`,
          count: result.count,
        });
      } else if (notificationId) {
        // Mark specific notification as read
        const notification = await prisma.notification.update({
          where: {
            id: parseInt(notificationId),
            userId: userId, // Ensure user can only update their own notifications
          },
          data: {
            isRead: true,
          },
        });

        return res.status(200).json({
          message: "Notification marked as read",
          notification,
        });
      } else {
        return res.status(400).json({ error: "Missing notificationId or markAllRead flag" });
      }
    }

    if (req.method === "DELETE") {
      const { notificationId } = req.body;
      const userId = parseInt(session.id);

      if (!notificationId) {
        return res.status(400).json({ error: "Missing notificationId" });
      }

      // Delete specific notification
      await prisma.notification.delete({
        where: {
          id: parseInt(notificationId),
          userId: userId, // Ensure user can only delete their own notifications
        },
      });

      return res.status(200).json({
        message: "Notification deleted successfully",
      });
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("❌ Error in notifications API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
