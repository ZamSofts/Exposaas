import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { WebSocketServer, WebSocket } from "ws";
const { prisma } = require("../PrismaClient/prismaClient.js");

const WS_PORT = process.env.WS_PORT || 5000;

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.heartbeatInterval = null;
    this.clients = new Map();
  }

  async initialize() {
    try {
      // Test database connection
      await prisma.$connect();
      console.log("✅ Database connected successfully");

      this.wss = new WebSocketServer({
        port: WS_PORT,
        perMessageDeflate: false,
      });

      this.setupHeartbeat();
      this.setupEventHandlers();

      console.log(`🚀 WebSocket server running on ws://localhost:${WS_PORT}`);
    } catch (error) {
      console.error("❌ Failed to start WebSocket server:", error.message);
      process.exit(1);
    }
  }

  setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
          console.log("💀 Terminating dead connection");
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on("close", () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
    });
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    try {
      const clientId = this.generateClientId();
      ws.id = clientId;
      ws.isAlive = true;
      ws.connectedAt = new Date();

      this.clients.set(clientId, {
        ws,
        connectedAt: ws.connectedAt,
        lastActivity: new Date(),
        userId: null, // Will be set when user joins
        username: null,
      });

      console.log(`🔌 New client connected: ${clientId} (Total: ${this.wss.clients.size})`);

      // Setup event listeners
      ws.on("pong", this.handlePong.bind(ws));
      ws.on("message", message => this.handleMessage(ws, message));
      ws.on("close", () => this.handleDisconnection(ws));
      ws.on("error", error => this.handleError(ws, error));

      // Send welcome message and user count
      this.sendToClient(ws, {
        type: "system",
        message: "Welcome to ExpoSaaS 👋",
        clientId,
        timestamp: Date.now(),
      });

      // Send current user count
      this.broadcastUserCount();
    } catch (error) {
      console.error("❌ Error handling connection:", error.message);
      ws.close(1011, "Server error");
    }
  }

  handlePong() {
    this.isAlive = true;
  }

  handleMessage(ws, message) {
    try {
      const client = this.clients.get(ws.id);
      if (client) {
        client.lastActivity = new Date();
      }

      let payload;
      try {
        payload = JSON.parse(message.toString());
      } catch {
        payload = {
          type: "chat",
          text: message.toString(),
          clientId: ws.id,
        };
      }

      // Add metadata
      if (!payload.timestamp) payload.timestamp = Date.now();
      if (!payload.clientId) payload.clientId = ws.id;

      console.log(`📨 Message from ${ws.id}:`, payload.type);

      // Route message based on type
      this.routeMessage(ws, payload);
    } catch (error) {
      console.error("❌ Error handling message:", error.message);
      this.sendError(ws, "Invalid message format");
    }
  }

  routeMessage(senderWs, payload) {
    switch (payload.type) {
      case "chat":
        this.handleChatMessage(senderWs, payload);
        break;
      case "join":
        this.handleUserJoin(senderWs, payload);
        break;
      case "load_history":
        this.handleLoadHistory(senderWs, payload);
        break;
      case "vehicle_update":
        this.handleVehicleUpdate(senderWs, payload);
        break;
      case "system":
        this.handleSystemMessage(senderWs, payload);
        break;
      default:
        this.broadcast(payload, senderWs);
    }
  }

  async handleUserJoin(senderWs, payload) {
    try {
      const { userId, username } = payload;

      if (!userId || !username) {
        this.sendError(senderWs, "userId and username are required");
        return;
      }

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        include: {
          company: true,
        },
      });

      if (!user) {
        this.sendError(senderWs, "User not found");
        return;
      }

      // Update client info
      const client = this.clients.get(senderWs.id);
      if (client) {
        client.userId = parseInt(userId);
        client.username = username;
        client.user = user;
      }

      console.log(`👤 User ${username} (${userId}) joined the chat`);

      // Send join confirmation
      this.sendToClient(senderWs, {
        type: "join_success",
        message: `Welcome ${username}!`,
        user: {
          id: user.id,
          username: user.username,
          company: user.company,
        },
        timestamp: Date.now(),
      });

      // Load recent chat history for the user
      await this.sendChatHistory(senderWs, { limit: 50 });
    } catch (error) {
      console.error("❌ Error handling user join:", error.message);
      this.sendError(senderWs, "Failed to join chat");
    }
  }

  async handleLoadHistory(senderWs, payload) {
    try {
      const { page = 1, limit = 50 } = payload;
      await this.sendChatHistory(senderWs, { page, limit });
    } catch (error) {
      console.error("❌ Error loading history:", error.message);
      this.sendError(senderWs, "Failed to load chat history");
    }
  }

  async sendChatHistory(ws, { page = 1, limit = 50 } = {}) {
    try {
      const skip = (page - 1) * limit;

      const messages = await prisma.chatMessage.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc", // Oldest first for history
        },
        skip,
        take: limit,
      });

      // Format messages for client
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        text: msg.message,
        user: msg.user.username,
        userId: msg.userId,
        timestamp: msg.createdAt.getTime(),
        type: "chat",
        company: msg.user.company,
      }));

      this.sendToClient(ws, {
        type: "chat_history",
        messages: formattedMessages,
        hasMore: messages.length === limit,
        page,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("❌ Error sending chat history:", error.message);
      this.sendError(ws, "Failed to load chat history");
    }
  }

  async handleChatMessage(senderWs, payload) {
    try {
      const { text, userId } = payload;
      const client = this.clients.get(senderWs.id);
      // Validation
      if (!text || text.trim().length === 0) {
        this.sendError(senderWs, "Message cannot be empty");
        return;
      }

      if (!userId) {
        this.sendError(senderWs, "User not authenticated");
        return;
      }

      // Save message to database
      const savedMessage = await prisma.chatMessage.create({
        data: {
          message: text.trim(),
          userId: parseInt(userId),
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Format message for broadcast
      const broadcastMessage = {
        id: savedMessage.id,
        text: savedMessage.message,
        user: savedMessage.user.username,
        userId: savedMessage.userId,
        timestamp: savedMessage.createdAt.getTime(),
        type: "chat",
        company: savedMessage.user.company,
      };

      // Broadcast to all clients
      this.broadcast(broadcastMessage);

      console.log(`💬 Message saved and broadcasted: ${savedMessage.user.username}: ${savedMessage.message}`);
    } catch (error) {
      console.error("❌ Error handling chat message:", error.message);
      this.sendError(senderWs, "Failed to save message");
    }
  }

  /* handleVehicleUpdate(senderWs, payload) {
    // Broadcast vehicle updates to all clients
    this.broadcast({
      ...payload,
      type: "vehicle_update",
      timestamp: Date.now()
    });
  } */

  /*   handleSystemMessage(senderWs, payload) {
    console.log(`🔧 System message from ${senderWs.id}:`, payload.message);
  } */

  handleDisconnection(ws) {
    const client = this.clients.get(ws.id);
    if (client && client.username) {
      console.log(`❌ User ${client.username} disconnected: ${ws.id}`);
    } else {
      console.log(`❌ Client disconnected: ${ws.id}`);
    }

    this.clients.delete(ws.id);
    this.broadcastUserCount();
    console.log(`📊 Remaining clients: ${this.wss.clients.size}`);
  }

  broadcastUserCount() {
    this.broadcast({
      type: "user_count",
      count: this.wss.clients.size,
      timestamp: Date.now(),
    });
  }

  handleError(ws, error) {
    console.error(`❌ WebSocket error for client ${ws.id}:`, error.message);
    this.clients.delete(ws.id);
  }

  broadcast(payload, excludeWs = null) {
    const message = typeof payload === "string" ? payload : JSON.stringify(payload);
    let sentCount = 0;

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error(`❌ Failed to send message to client ${client.id}:`, error.message);
        }
      }
    });

    console.log(`📤 Broadcast sent to ${sentCount} clients`);
  }

  sendToClient(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof payload === "string" ? payload : JSON.stringify(payload);
        ws.send(message);
      } catch (error) {
        console.error(`❌ Failed to send message to client ${ws.id}:`, error.message);
      }
    }
  }

  sendError(ws, errorMessage) {
    this.sendToClient(ws, {
      type: "error",
      message: errorMessage,
      timestamp: Date.now(),
    });
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      totalClients: this.wss.clients.size,
      activeConnections: this.clients.size,
      uptime: process.uptime(),
    };
  }

  async shutdown() {
    console.log("🛑 Shutting down WebSocket server...");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.wss.clients.forEach(ws => {
      ws.close(1001, "Server shutting down");
    });

    this.wss.close(async () => {
      console.log("✅ WebSocket server closed");
      await prisma.$disconnect();
      console.log("✅ Database disconnected");
      process.exit(0);
    });
  }
}

// Initialize WebSocket manager
const wsManager = new WebSocketManager();
wsManager.initialize().catch(error => {
  console.error("❌ Failed to initialize WebSocket manager:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => wsManager.shutdown());
process.on("SIGTERM", () => wsManager.shutdown());
