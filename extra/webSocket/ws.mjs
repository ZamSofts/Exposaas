import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../PrismaClient/prismaClient.mjs";

const WS_PORT = process.env.WS_PORT || 5000;
const MAX_CONNECTIONS = parseInt(process.env.MAX_WS_CONNECTIONS) || 1000;
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH) || 5000;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 60; // 60 messages per minute

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.heartbeatInterval = null;
    this.clients = new Map();
    this.rateLimitMap = new Map(); // Track message rates per user
    this.cleanupInterval = null;
  }

  async initialize() {
    try {
      // Test database connection
      await prisma.$connect();
      this.wss = new WebSocketServer({
        port: WS_PORT,
        perMessageDeflate: false,
        maxPayload: MAX_MESSAGE_LENGTH,
      });

      this.setupHeartbeat();
      this.setupCleanup();
      this.setupEventHandlers();

      console.log(`🚀 WebSocket server running on ws://localhost:${WS_PORT}`);
      console.log(`📊 Max connections: ${MAX_CONNECTIONS}, Max message length: ${MAX_MESSAGE_LENGTH}`);
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
          const client = this.clients.get(ws.id);
          if (client) {
            this.clients.delete(ws.id);
          }
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
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
    });
  }

  setupCleanup() {
    // Clean up rate limit map every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.rateLimitMap.forEach((data, userId) => {
        // Remove entries older than rate limit window
        data.messages = data.messages.filter(timestamp => 
          now - timestamp < RATE_LIMIT_WINDOW
        );
        if (data.messages.length === 0) {
          this.rateLimitMap.delete(userId);
        }
      });
    }, 300000); // 5 minutes
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    try {
      // Check connection limit
      if (this.wss.clients.size >= MAX_CONNECTIONS) {
        console.log("🚫 Connection limit reached, rejecting new connection");
        ws.close(1013, "Server overloaded");
        return;
      }

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
        companyId: null,
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

      // Check message size
      if (message.length > MAX_MESSAGE_LENGTH) {
        this.sendError(ws, "Message too long");
        return;
      }

      let payload;
      try {
        payload = JSON.parse(message.toString());
      } catch {
        // If not JSON, treat as plain text message
        payload = {
          type: "chat",
          text: this.sanitizeInput(message.toString()),
          clientId: ws.id,
        };
      }

      // Validate payload structure
      if (!this.validatePayload(payload)) {
        this.sendError(ws, "Invalid message format");
        return;
      }

      // Check rate limiting for authenticated users
      if (client?.userId && !this.checkRateLimit(client.userId)) {
        this.sendError(ws, "Too many messages. Please slow down.");
        return;
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

  validatePayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.type || typeof payload.type !== 'string') return false;
    
    // Additional validation based on message type
    switch (payload.type) {
      case 'chat':
        return payload.text && typeof payload.text === 'string' && payload.text.trim().length > 0;
      case 'join':
        return payload.userId && payload.username && payload.companyId;
      case 'load_more':
      case 'load_history':
        return true; // Basic validation already done
      default:
        return true;
    }
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Remove potential XSS characters and limit length
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .substring(0, MAX_MESSAGE_LENGTH);
  }

  checkRateLimit(userId) {
    const now = Date.now();
    
    if (!this.rateLimitMap.has(userId)) {
      this.rateLimitMap.set(userId, { messages: [] });
    }
    
    const userData = this.rateLimitMap.get(userId);
    
    // Clean old messages outside the window
    userData.messages = userData.messages.filter(timestamp => 
      now - timestamp < RATE_LIMIT_WINDOW
    );
    
    // Check if user exceeds rate limit
    if (userData.messages.length >= RATE_LIMIT_MAX_MESSAGES) {
      return false;
    }
    
    // Add current message timestamp
    userData.messages.push(now);
    return true;
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
      case "load_more":
        this.handleLoadMore(senderWs, payload);
        break;
      case "vehicle_update":
        this.handleVehicleUpdate(senderWs, payload);
        break;
      case "system":
        this.handleSystemMessage(senderWs, payload);
        break;
      case "notification":
        this.handleNotification(senderWs, payload);
        break;
      default:
        this.broadcast(payload, senderWs);
    }
  }

  async handleUserJoin(senderWs, payload) {
    try {
      const { userId, username, companyId } = payload;

      if (!userId || !username || !companyId) {
        this.sendError(senderWs, "userId, username, and companyId are required");
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
        console.warn(`⚠️ User lookup failed for userId=${userId}. Falling back to provided companyId=${companyId} and username=${username}`);
      } else {
        // Verify user belongs to the specified company
        if (user.companyId !== parseInt(companyId)) {
          this.sendError(senderWs, "User does not belong to the specified company");
          return;
        }
      }

      // Check for existing connections for this user and close them
      this.clients.forEach((client, clientId) => {
        if (client.userId === parseInt(userId) && client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
          console.log(`🔄 Closing existing connection for user ${username} (${clientId})`);
          client.ws.close(1000, "New connection established");
          this.clients.delete(clientId);
        }
      });

      // Update client info (use user info when available, otherwise use provided payload values)
      const client = this.clients.get(senderWs.id);
      if (client) {
        client.userId = user ? parseInt(userId) : null;
        client.username = username;
        client.companyId = parseInt(companyId);
        client.user = user || null;
      }

      if (user) {
        console.log(`👤 User ${username} (${userId}) from company ${user.company.name} joined the chat`);
      } else {
        console.log(`👤 Anonymous client joined as username='${username}' companyId=${companyId}`);
      }

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

      // Load recent chat history for the user (filtered by company)
      await this.sendInitialChatHistory(senderWs, { 
        page: payload.page || 1, 
        limit: payload.limit || 20, 
        companyId: parseInt(companyId) 
      });
      
      // Update user count for all companies
      this.broadcastUserCount();
    } catch (error) {
      console.error("❌ Error handling user join:", error.message);
      this.sendError(senderWs, "Failed to join chat");
    }
  }

  async handleLoadHistory(senderWs, payload) {
    try {
      const { page = 1, limit = 50 } = payload;
      const client = this.clients.get(senderWs.id);
      const companyId = client?.companyId;
      
      await this.sendChatHistory(senderWs, { page, limit, companyId });
    } catch (error) {
      console.error("❌ Error loading history:", error.message);
      this.sendError(senderWs, "Failed to load chat history");
    }
  }

  async handleLoadMore(senderWs, payload) {
    try {
      // Validate pagination parameters
      const page = Math.max(1, parseInt(payload.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(payload.limit) || 20)); // Limit between 1-50
      
      const client = this.clients.get(senderWs.id);
      const companyId = client?.companyId;
      
      if (!companyId || !Number.isInteger(companyId)) {
        this.sendError(senderWs, "");
        return;
      }

      console.log(`📖 Loading more messages - Page: ${page}, Limit: ${limit}, Company: ${companyId}`);
      
      await this.sendMoreMessages(senderWs, { page, limit, companyId });
    } catch (error) {
      console.error("❌ Error loading more messages:", error.message);
      this.sendError(senderWs, "Failed to load more messages");
    }
  }

  async sendInitialChatHistory(ws, { page = 1, limit = 20, companyId = null } = {}) {
    try {
      const client = this.clients.get(ws.id);
      const filterCompanyId = companyId || client?.companyId;

      if (!filterCompanyId) {
        this.sendError(ws, "");
        return;
      }

      // Get total count for pagination info
      const totalCount = await prisma.chatMessage.count({
        where: {
          user: {
            companyId: filterCompanyId
          }
        }
      });

      // Get latest messages (most recent first)
      const messages = await prisma.chatMessage.findMany({
        where: {
          user: {
            companyId: filterCompanyId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              companyId: true,
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
          createdAt: "desc", // Most recent first
        },
        take: limit,
      });

      // Reverse to show oldest first (for display)
      const formattedMessages = messages.reverse().map(msg => ({
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
        total: totalCount,
        page: 1,
        hasMore: totalCount > limit,
        timestamp: Date.now(),
      });

      console.log(`📨 Sent initial chat history: ${formattedMessages.length} messages, total: ${totalCount}`);
    } catch (error) {
      console.error("❌ Error sending initial chat history:", error.message);
      this.sendError(ws, "Failed to load chat history");
    }
  }

  async sendMoreMessages(ws, { page = 1, limit = 20, companyId = null } = {}) {
    try {
      const client = this.clients.get(ws.id);
      const filterCompanyId = companyId || client?.companyId;

      if (!filterCompanyId) {
        this.sendError(ws, "");
        return;
      }

      const skip = (page - 1) * limit;

      // Get total count for pagination info
      const totalCount = await prisma.chatMessage.count({
        where: {
          user: {
            companyId: filterCompanyId
          }
        }
      });

      // Get older messages for pagination (exclude already loaded messages)
      const messages = await prisma.chatMessage.findMany({
        where: {
          user: {
            companyId: filterCompanyId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              companyId: true,
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
          createdAt: "desc", // Most recent first
        },
        skip,
        take: limit,
      });

      // Keep desc order for older messages (newest of the batch first)
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
        type: "load_more_messages",
        messages: formattedMessages,
        total: totalCount,
        page,
        hasMore: (page * limit) < totalCount,
        timestamp: Date.now(),
      });

      console.log(`📨 Sent page ${page} of messages: ${formattedMessages.length} messages, total: ${totalCount}`);
    } catch (error) {
      console.error("❌ Error sending more messages:", error.message);
      this.sendError(ws, "Failed to load more messages");
    }
  }

  async sendChatHistory(ws, { page = 1, limit = 50, companyId = null } = {}) {
    try {
      const skip = (page - 1) * limit;

      // Get the client's company ID if not provided
      const client = this.clients.get(ws.id);
      const filterCompanyId = companyId || client?.companyId;

      if (!filterCompanyId) {
        this.sendError(ws, "");
        return;
      }

      const messages = await prisma.chatMessage.findMany({
        where: {
          user: {
            companyId: filterCompanyId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              companyId: true,
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
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        this.sendError(senderWs, "Message cannot be empty");
        return;
      }

      if (!userId || !Number.isInteger(parseInt(userId))) {
        this.sendError(senderWs, "User not authenticated");
        return;
      }

      if (!client?.userId || client.userId !== parseInt(userId)) {
        this.sendError(senderWs, "User authentication mismatch");
        return;
      }

      // Sanitize message content
      const sanitizedText = this.sanitizeInput(text);
      if (sanitizedText.length === 0) {
        this.sendError(senderWs, "Message content is invalid");
        return;
      }

      if (sanitizedText.length > 2000) { // Reasonable limit for chat messages
        this.sendError(senderWs, "Message too long. Maximum 2000 characters.");
        return;
      }

      // Save message to database
      const savedMessage = await prisma.chatMessage.create({
        data: {
          message: sanitizedText,
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

      // Broadcast only to clients from the same company
      this.broadcast(broadcastMessage, null, savedMessage.user.company.id);

      console.log(`💬 Message saved and broadcasted to company ${savedMessage.user.company.name}: ${savedMessage.user.username}: ${savedMessage.message.substring(0, 50)}...`);
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

  handleNotification(senderWs, payload) {
    try {
      const { companyId, ...notification } = payload;
      
      if (!companyId) {
        console.error("❌ Notification missing companyId");
        return;
      }

      console.log(`🔔 Broadcasting notification to company ${companyId}:`, notification.title || notification.message);
      
      // Broadcast notification to all clients in the same company
      this.broadcast({
        type: "notification",
        ...notification,
        timestamp: notification.timestamp || new Date().toISOString()
      }, null, companyId);
      
    } catch (error) {
      console.error("❌ Error handling notification:", error.message);
    }
  }

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
    // Get unique companies and their user counts
    const companyCounts = new Map();
    
    this.clients.forEach(client => {
      if (client.companyId && client.ws.readyState === WebSocket.OPEN) {
        const count = companyCounts.get(client.companyId) || 0;
        companyCounts.set(client.companyId, count + 1);
      }
    });

    // Send company-specific user counts
    companyCounts.forEach((count, companyId) => {
      const payload = {
        type: "user_count",
        count: count,
        timestamp: Date.now(),
      };
      this.broadcast(payload, null, companyId);
    });
  }

  handleError(ws, error) {
    console.error(`❌ WebSocket error for client ${ws.id}:`, error.message);
    this.clients.delete(ws.id);
  }

  broadcast(payload, excludeWs = null, companyId = null) {
    const message = typeof payload === "string" ? payload : JSON.stringify(payload);
    let sentCount = 0;

    // Debug: show current known clients and their companyIds
    try {
      const debugClients = [];
      this.clients.forEach((info, id) => {
        debugClients.push({ id, companyId: info.companyId, username: info.username });
      });
      console.log("[DEBUG] current tracked clients:", JSON.stringify(debugClients));
    } catch (err) {
      console.error("[DEBUG] failed to enumerate clients:", err && err.message ? err.message : err);
    }

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        try {
          // Get client info
          const clientInfo = this.clients.get(client.id);

          // Debug: log each candidate client and why it might be skipped
          if (!clientInfo) {
            console.log(`[DEBUG] skipping client ${client.id} - no clientInfo found`);
            return;
          }

          // Allow targeted user notifications when payload includes targetUserId
          let targetUserId = null;
          try {
            if (typeof payload === 'object' && payload.targetUserId) {
              targetUserId = parseInt(payload.targetUserId);
            }
          } catch (e) {
            targetUserId = null;
          }

          if (targetUserId) {
            if (clientInfo.userId !== targetUserId) {
              console.log(`[DEBUG] skipping client ${client.id} - target user mismatch (${clientInfo.userId} != ${targetUserId})`);
              return;
            }
            // matched target user — send
            client.send(message);
            sentCount++;
            return;
          }

          // If companyId is specified, only send to clients from the same company
          if (companyId && clientInfo && clientInfo.companyId !== companyId) {
            console.log(`[DEBUG] skipping client ${client.id} - company mismatch (${clientInfo.companyId} != ${companyId})`);
            return; // Skip this client
          }

          // Send message
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

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all client connections gracefully
    const closePromises = [];
    this.wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        closePromises.push(new Promise(resolve => {
          ws.once('close', resolve);
          ws.close(1001, "Server shutting down");
        }));
      }
    });

    // Wait for all connections to close (with timeout)
    try {
      await Promise.race([
        Promise.all(closePromises),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
      ]);
    } catch (error) {
      console.error("❌ Error closing connections:", error.message);
    }

    // Clear client tracking
    this.clients.clear();
    this.rateLimitMap.clear();

    // Close WebSocket server
    this.wss.close(async () => {
      console.log("✅ WebSocket server closed");
      try {
        await prisma.$disconnect();
        console.log("✅ Database disconnected");
      } catch (error) {
        console.error("❌ Error disconnecting database:", error.message);
      }
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log("⚠️ Force exiting due to shutdown timeout");
      process.exit(1);
    }, 10000);
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

// Export the manager instance for direct use
export { wsManager };
