import { WebSocketServer } from 'ws';


class NotificationWebSocket {
  constructor(port = 5001) {
    this.port = port;
    this.wss = null;
    this.clients = new Map(); // Map of userId -> WebSocket connection
  }

  start() {
    this.wss = new WebSocketServer({ port: this.port });
    
    console.log(`🔔 Notification WebSocket server starting on port ${this.port}`);
    
    this.wss.on('connection', (ws, request) => {
      console.log('🔔 New notification client connected');
      
      ws.userId = null;
      ws.companyId = null;
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('❌ Error parsing notification message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });
      
      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
          console.log(`🔌 Notification client disconnected: ${ws.userId}`);
        }
      });
      
      ws.on('error', (error) => {
        console.error('❌ Notification WebSocket error:', error);
      });
      
      // Send connection acknowledgment
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to notification server'
      }));
    });
    
    console.log(`✅ Notification WebSocket server started on port ${this.port}`);
  }
  
  handleMessage(ws, data) {
    switch (data.type) {
      case 'join':
        if (data.userId && data.companyId) {
          ws.userId = data.userId;
          ws.companyId = data.companyId;
          ws.username = data.username || `User ${data.userId}`;
          
          // Store client connection
          this.clients.set(data.userId, ws);
          
          console.log(`🔔 User joined notifications: ${ws.username} (${data.userId})`);
          
          ws.send(JSON.stringify({
            type: 'joined',
            message: 'Successfully joined notification channel',
            userId: data.userId
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing userId or companyId'
          }));
        }
        break;
        
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
        break;
        
      default:
        console.log('🔔 Unknown message type:', data.type);
    }
  }
  
  sendToUser(userId, notification) {
    const client = this.clients.get(parseInt(userId));
    
    if (client && client.readyState === client.OPEN) {
      const message = {
        type: 'notification',
        ...notification,
        timestamp: notification.timestamp || new Date().toISOString()
      };
      
      try {
        client.send(JSON.stringify(message));
        console.log(`🔔 Notification sent to user ${userId}:`, notification.title);
        return true;
      } catch (error) {
        console.error(`❌ Failed to send notification to user ${userId}:`, error);
        // Remove dead connection
        this.clients.delete(parseInt(userId));
        return false;
      }
    } else {
      console.log(`⚠️ User ${userId} not connected for notification`);
      return false;
    }
  }
  
  // Send notification to all users in a company
  sendToCompany(companyId, notification) {
    let sentCount = 0;
    
    for (const [userId, client] of this.clients.entries()) {
      if (client.companyId === parseInt(companyId) && client.readyState === client.OPEN) {
        const message = {
          type: 'notification',
          ...notification,
          timestamp: notification.timestamp || new Date().toISOString()
        };
        
        try {
          client.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`❌ Failed to send notification to user ${userId}:`, error);
          this.clients.delete(userId);
        }
      }
    }
    
    console.log(`🔔 Notification sent to ${sentCount} users in company ${companyId}`);
    return sentCount;
  }
  
  // Broadcast notification to all connected users
  broadcast(notification) {
    let sentCount = 0;
    
    for (const [userId, client] of this.clients.entries()) {
      if (client.readyState === client.OPEN) {
        const message = {
          type: 'notification',
          ...notification,
          timestamp: notification.timestamp || new Date().toISOString()
        };
        
        try {
          client.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`❌ Failed to broadcast notification to user ${userId}:`, error);
          this.clients.delete(userId);
        }
      }
    }
    
    console.log(`🔔 Notification broadcasted to ${sentCount} users`);
    return sentCount;
  }
  
  // Get connected users count
  getConnectedUsersCount() {
    return this.clients.size;
  }
  
  // Get connected users for a company
  getCompanyUsersCount(companyId) {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.companyId === parseInt(companyId)) {
        count++;
      }
    }
    return count;
  }
}

// Create and export singleton instance
const notificationWS = new NotificationWebSocket(5001);

export default notificationWS;
export { NotificationWebSocket };