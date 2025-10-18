import { prisma } from "../PrismaClient/prismaClient.mjs";
import notificationWS from "../webSocket/notifications.mjs";

class NotificationService {
  static async createAndSend({ userId, companyId, title, message, category = "info", actions = null, metadata = null }) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: Number(userId),
          companyId: Number(companyId),
          title,
          message,
          category,
          actions: actions ? JSON.stringify(actions) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          isRead: false,
        },
      });

      const wsNotification = {
        id: notification.id,
        title,
        message,
        category,
        actions,
        metadata,
        timestamp: notification.createdAt.toISOString(),
        read: false,
      };

      const sent = notificationWS.sendToUser(userId, wsNotification);

      console.log(`🔔 Notification created and ${sent ? "sent" : "queued"} for user ${userId}: ${title}`);

      return notification;
    } catch (error) {
      console.error("❌ Failed to create notification:", error);
      throw error;
    }
  }

  static async sendInvoiceProcessedNotification(userId, companyId, invoiceJob) {
    const actions = [
      {
        label: "View Invoice",
        url: `/InvoiceJobs?id=${invoiceJob.id}`,
      },
    ];

    return this.createAndSend({
      userId,
      companyId,
      title: "Invoice Processed Successfully",
      message: "Your invoice has been processed and the data has been extracted successfully.",
      category: "success",
      actions,
      metadata: {
        invoiceJobId: invoiceJob.id,
        documentUrl: invoiceJob.DocumentURL,
      },
    });
  }

  static async sendInvoiceFailedNotification(userId, companyId, documentUrl, error) {
    return this.createAndSend({
      userId,
      companyId,
      title: "Invoice Processing Failed",
      message: `Failed to process your invoice: ${error}`,
      category: "error",
      metadata: {
        documentUrl,
        error,
      },
    });
  }

  static async getUnreadNotifications(userId, limit = 50) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      return notifications.map(n => ({
        ...n,
        actions: n.actions ? JSON.parse(n.actions) : null,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
      }));
    } catch (error) {
      console.error("❌ Failed to get unread notifications:", error);
      throw error;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const notification = await prisma.notification.update({
        where: {
          id: notificationId,
          userId,
        },
        data: {
          isRead: true,
        },
      });

      console.log(`🔔 Notification ${notificationId} marked as read for user ${userId}`);
      return notification;
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error);
      throw error;
    }
  }

  static async markAllAsRead(userId) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      console.log(`🔔 ${result.count} notifications marked as read for user ${userId}`);
      return result;
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
      throw error;
    }
  }

  static async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`🧹 Cleaned up ${result.count} old notifications (older than ${daysOld} days)`);
      return result;
    } catch (error) {
      console.error("❌ Failed to cleanup old notifications:", error);
      throw error;
    }
  }
}

export default NotificationService;
