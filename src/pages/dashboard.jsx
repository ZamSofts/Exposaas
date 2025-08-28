import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Head from "next/head";
import { Search, Hash, Send, Wifi, WifiOff } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/wrapper";

export default function Dashboard() {
  const { session, status } = useAuth(); 
  
  // Get user info - moved before conditional returns to maintain hook order
  const userInfo = useMemo(() => ({
    username: session?.name,
    userId: session?.id
  }), [session?.name, session?.id]);
  
  
  // Don't render anything while loading or if not authenticated
  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (status !== "authenticated" || !session) {
    return <div className="flex justify-center items-center h-screen">Please log in to access the dashboard.</div>;
  }
  
  return <DashboardContent userInfo={userInfo} />;
}

function DashboardContent({ userInfo }) {
  const { username, userId } = userInfo;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");
  
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [error, setError] = useState("");
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const historyLoadedRef = useRef(false);
  const connectingRef = useRef(false);


  const channels = [
    {
      id: 1,
      name: "Container Summary",
      description: "Real-time container tracking and analytics",
      icon: "CS",
      color: "bg-[var(--primary)]",
      status: "active",
      lastMessage: "2 min ago",
      unread: 3,
      channel: "Dashboard Channel",
    },
    {
      id: 2,
      name: "Logistics Overview",
      description: "Global shipping routes and schedules",
      icon: "LO",
      color: "bg-[var(--primary)]",
      status: "active",
      lastMessage: "15 min ago",
      unread: 0,
      channel: "Dashboard Channel",
    },
    {
      id: 3,
      name: "Team Performance",
      description: "Team metrics and productivity insights",
      icon: "TP",
      color: "bg-[var(--primary)]",
      status: "busy",
      lastMessage: "1 hour ago",
      unread: 1,
      channel: "Dashboard Channel",
    },
  ];

  const [selectedChannel, setSelectedChannel] = useState(channels[0]);

  const [messages, setMessages] = useState([
    // Keep these as fallback messages if no chat history is loaded
  ]);

  const containerStats = {
    total: 15,
    active: 12,
    urgent: 2,
    pending: 1,
  };

  // WebSocket connection for chat
  const connectWebSocket = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (connectingRef.current) {
      console.log("⏳ Connection already in progress, skipping...");
      return;
    }
    
    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log("🔄 Closing existing WebSocket connection");
      wsRef.current.close();
    }
    
    connectingRef.current = true;
    
    try {
      const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000";
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        connectingRef.current = false; // Reset connecting flag
        setIsWsConnected(true);
        setError("");
        setConnectionAttempts(0);
        console.log("🔌 WebSocket connected");
        
        // Send join message to authenticate user
        if (userId && username) {
          const joinMessage = {
            type: "join",
            userId: userId,
            username: username
          };
          ws.send(JSON.stringify(joinMessage));
          console.log("👤 Sent user join message:", joinMessage);
        } else {
          console.error("❌ Missing user credentials:", { userId, username });
          setError("User authentication data missing");
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Received WebSocket message:", data);
          
          // Handle different message types
          if (data.type === "user_count") {
            setOnlineUsers(data.count);
            return;
          }
          
          if (data.type === "join_success") {
            console.log("✅ User joined successfully:", data.message);
            return;
          }
          
          if (data.type === "error") {
            console.error("❌ WebSocket error:", data.message);
            setError(data.message);
            return;
          }
          
          if (data.type === "chat_history") {
            console.log("📚 Received chat history:", data.messages?.length, "messages");
            if (data.messages && data.messages.length > 0 && !historyLoadedRef.current) {
              const formattedHistory = data.messages.map(msg => ({
                ...msg,
                id: msg.id || Date.now() + Math.random(),
                timestamp: msg.timestamp || Date.now(),
                sender: msg.user || msg.sender || "Unknown",
                message: msg.text || msg.message || "",
                time: formatTime(msg.timestamp || Date.now()),
              }));
              // Replace the default messages with history (don't append to avoid duplicates)
              setMessages(formattedHistory);
              historyLoadedRef.current = true;
            }
            return;
          }
          
          if (data.type === "chat") {
            const newMessage = {
              ...data,
              id: data.id || Date.now() + Math.random(),
              timestamp: data.timestamp || Date.now(),
              sender: data.user || data.sender || "Unknown",
              message: data.text || data.message || "",
              time: formatTime(data.timestamp || Date.now()),
            };
            
            // Check for duplicate messages by ID
            setMessages((prev) => {
              const messageExists = prev.some(msg => msg.id === newMessage.id);
              if (messageExists) {
                console.log("🔄 Skipping duplicate message:", newMessage.id);
                return prev;
              }
              return [...prev, newMessage];
            });
          }
        } catch (parseError) {
          console.error("❌ Failed to parse WebSocket message:", parseError);
          setError("Failed to parse WebSocket message");
        }
      };

      ws.onclose = (event) => {
        connectingRef.current = false; // Reset connecting flag
        setIsWsConnected(false);
        historyLoadedRef.current = false; // Reset history loaded flag
        console.log("❌ WebSocket closed, code:", event.code);
        
        if (connectionAttempts < 5) {
          setConnectionAttempts(prev => prev + 1);
          setError(`Connection lost. Reconnecting... (Attempt ${connectionAttempts + 1}/5)`);
          setTimeout(connectWebSocket, 2000 * (connectionAttempts + 1)); // Exponential backoff
        } else {
          setError("Failed to connect after multiple attempts. Please refresh the page.");
        }
      };

      ws.onerror = (err) => {
        connectingRef.current = false; // Reset connecting flag
        console.error("❌ WebSocket error:", err);
        setError("Connection error occurred");
        ws.close();
      };
    } catch (err) {
      connectingRef.current = false; // Reset connecting flag
      setError("Failed to establish WebSocket connection");
      console.error("Connection error:", err);
    }
  }, [userId, username]); // useCallback dependencies

  // formatTime needs to be defined before connectWebSocket uses it
  const formatTime = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

   useEffect(() => {
    if (userId && username) {
      console.log("🔐 User authenticated, connecting WebSocket:", { userId, username });
      connectWebSocket();
    } else {
      console.log("⏳ Waiting for authentication:", { userId, username });
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId, username, connectWebSocket]); // Include connectWebSocket in dependencies

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = messageInput.trim();
    if (!text) return;

    // Check if user is authenticated
    if (!userId) {
      setError("User not authenticated. Please refresh the page.");
      return;
    }

    // If WebSocket is connected, send via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        type: "chat",
        text,
        userId: userId,  // Use the correct userId
        user: username,
        timestamp: Date.now()
      };

      try {
        wsRef.current.send(JSON.stringify(payload));
        setMessageInput("");
        setError("");
        console.log("📤 Sent message:", payload);
      } catch (err) {
        setError("Failed to send message");
        console.error("❌ Send error:", err);
      }
    } else {
      setError("WebSocket not connected. Please wait for connection.");
    }
  }, [messageInput, userId, username]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <>
      <Head>
        <title>Dashboard - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
          {/* Sidebar */}
          <div className="w-80 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)]">
              <h1 className="text-xl font-semibold text-[var(--foreground)]">Dashboard</h1>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--secondary-foreground)]" />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg
                         text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                         transition-all duration-200"
                />
              </div>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`p-4 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--input)] transition-colors duration-200 ${
                    selectedChannel.id === channel.id ? "bg-[var(--input)]" : ""
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${channel.color} rounded-full flex items-center justify-center text-white font-semibold relative`}>
                      {channel.icon}
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--surface)] ${
                          channel.status === "active"
                            ? "bg-[var(--success)]"
                            : channel.status === "busy"
                            ? "bg-[var(--error)]"
                            : "bg-[var(--secondary-foreground)]"
                        }`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-[var(--foreground)] truncate">{channel.name}</h3>
                        <div className="flex items-center gap-2">
                          {channel.unread > 0 && (
                            <span className="bg-[var(--error)] text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                              {channel.unread}
                            </span>
                          )}
                          <span className="text-xs text-[var(--secondary-foreground)]">{channel.lastMessage}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--secondary-foreground)] truncate mt-1">{channel.description}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Hash className="w-3 h-3 text-[var(--secondary-foreground)]" />
                        <span className="text-xs text-[var(--secondary-foreground)]">{channel.channel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${selectedChannel.color} rounded-lg flex items-center justify-center text-white font-semibold`}>
                    {selectedChannel.icon}
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--foreground)]">{selectedChannel.name}</h2>
                    <p className="text-sm text-[var(--secondary-foreground)]">{selectedChannel.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[var(--success)] text-white text-xs font-medium px-2 py-1 rounded-full">Active</span>
                  <span className="text-sm text-[var(--secondary-foreground)]">{selectedChannel.channel}</span>
                  
                  {/* Chat Status Indicator */}
                  <div className="flex items-center gap-2">
                    {isWsConnected ? (
                      <>
                        <Wifi className="w-4 h-4 text-[var(--success)]" />
                        <span className="text-sm text-[var(--success)]">Live Chat ({onlineUsers})</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-[var(--error)]" />
                        <span className="text-sm text-[var(--error)]">Offline</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Error Display */}
              {error && (
                <div className="bg-[var(--error)] text-white p-3 rounded-lg mb-4">
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              {messages.map((message) => {
                if (message.isSystem) {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="px-3 py-1 bg-[var(--secondary)] rounded-full">
                        <span className="text-xs text-[var(--secondary-foreground)]">
                          {message.message}
                        </span>
                      </div>
                    </div>
                  );
                }

                const isOwnMessage = message.sender === username;
                
                return (
                  <div 
                    key={message.id} 
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow-sm ${
                        isOwnMessage 
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]" 
                          : "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className="text-xs font-medium mb-1 text-[var(--primary)]">
                          {message.sender || "Anonymous"}
                        </div>
                      )}
                      <div className="text-sm leading-relaxed break-words">
                        {message.message}
                      </div>
                      <div 
                        className={`text-xs mt-2 ${
                          isOwnMessage 
                            ? "text-[var(--primary-foreground)]/70" 
                            : "text-[var(--secondary-foreground)]"
                        }`}
                      >
                        {message.time}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Container Summary Card */}
              {selectedChannel.name === "Container Summary" && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mt-4">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Container Summary</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--primary)] mb-1">{containerStats.total}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Total Containers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--success)] mb-1">{containerStats.active}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--error)] mb-1">{containerStats.urgent}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Urgent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--warning)] mb-1">{containerStats.pending}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Pending</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg
                           text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                           transition-all duration-200"
                  />
                </div>
                <button 
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}
                  className="p-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Sidebar>
    </>
  );
}
