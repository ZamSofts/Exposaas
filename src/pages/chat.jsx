import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth, CustomButton, Error } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import { MessageCircle, Send, Users, Wifi, WifiOff } from "lucide-react";

export default function ChatPage() {
  const { session, status } = useAuth();
  
  // Memoize user info to prevent unnecessary re-renders
  const userInfo = useMemo(() => ({
    username: session?.name,
    userId: session?.id
  }), [session?.name, session?.id]);
  
  // Don't render anything while loading or if not authenticated
  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (status !== "authenticated" || !session) {
    return <div className="flex justify-center items-center h-screen">Please log in to access chat.</div>;
  }
  
  return <ChatContent userInfo={userInfo} />;
}

function ChatContent({ userInfo }) {
  const { username, userId } = userInfo;
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const connectingRef = useRef(false);
  const connectionAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const shouldConnectRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [loading, setLoading] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WebSocket connection with improved error handling
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (connectingRef.current) {
      console.log("⏳ Connection already in progress, skipping...");
      return;
    }

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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
        setReady(true);
        setError("");
        connectionAttemptsRef.current = 0; // Reset connection attempts
        setConnectionAttempts(0);
        console.log("🔌 WebSocket connected");

        // Join the chat with user info
        if (userId && username) {
          ws.send(JSON.stringify({
            type: "join",
            userId: userId,
            username: username,
            timestamp: Date.now()
          }));
        } else {
          console.error("❌ Missing user credentials:", { userId, username });
          setError("User authentication data missing");
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === "user_count") {
            setOnlineUsers(data.count);
            return;
          }
          
          if (data.type === "chat_history") {
            setMessages(data.messages || []);
            setLoading(false);
            return;
          }

          if (data.type === "join_success") {
            console.log("✅ Successfully joined chat:", data.user);
            return;
          }

          if (data.type === "error") {
            setError(data.message);
            return;
          }

          if (data.type === "system") {
            setMessages((prev) => [...prev, {
              ...data,
              id: data.id || Date.now() + Math.random(),
              timestamp: data.timestamp || Date.now()
            }]);
            return;
          }
          
          // Handle chat messages
          if (data.type === "chat") {
            console.log("📨 Received chat message:", data);
            console.log("👤 Current username:", username);
            console.log("🔍 Message user:", data.user);
            console.log("🤔 Is own message:", data.user === username);
            
            setMessages((prev) => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(msg => msg.id === data.id);
              if (exists) return prev;
              
              return [...prev, {
                ...data,
                id: data.id || Date.now() + Math.random(),
                timestamp: data.timestamp || Date.now()
              }];
            });
          }
        } catch (parseError) {
          console.error("❌ Error parsing message:", parseError);
          setMessages((prev) => [...prev, { 
            id: Date.now() + Math.random(),
            type: "chat", 
            text: event.data, 
            timestamp: Date.now(),
            user: "System"
          }]);
        }
      };

      ws.onclose = (event) => {
        connectingRef.current = false; // Reset connecting flag
        setReady(false);
        console.log("❌ WebSocket closed, code:", event.code);
        
        if (connectionAttemptsRef.current < 5) {
          connectionAttemptsRef.current += 1;
          setConnectionAttempts(connectionAttemptsRef.current);
          setError(`Connection lost. Reconnecting... (Attempt ${connectionAttemptsRef.current}/5)`);
          
          // Use timeout ref to allow cleanup
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 2000 * connectionAttemptsRef.current); // Exponential backoff
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
      setLoading(false);
    }
  }, [userId, username]); // Removed connectionAttempts from dependencies

  useEffect(() => {
    if (userId && username && shouldConnectRef.current) {
      console.log("🔐 User authenticated, connecting WebSocket:", { userId, username });
      shouldConnectRef.current = false; // Prevent multiple connections
      connect();
    } else {
      console.log("⏳ Waiting for authentication or already connected:", { userId, username, shouldConnect: shouldConnectRef.current });
    }
    return () => {
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Reset connection flag for next mount
      shouldConnectRef.current = true;
    };
  }, [userId, username]); // Removed connect from dependencies to prevent reconnection loops

  const sendMessage = useCallback(() => {
    const text = message.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN || !userId) {
      if (!ready) {
        setError("Cannot send message: not connected to server");
      }
      if (!userId) {
        setError("User not authenticated");
      }
      return;
    }

    const payload = {
      type: "chat",
      user: username,
      text,
      userId: userId,
      timestamp: Date.now()
    };

    try {
      wsRef.current.send(JSON.stringify(payload));
      setMessage("");
      setError("");
    } catch (err) {
      setError("Failed to send message");
      console.error("Send error:", err);
    }
  }, [message, ready, userId, username]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const formatTime = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

  if (status === "loading") {
    return (
      <Sidebar>
        <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
          <div className="text-[var(--secondary-foreground)]">Loading...</div>
        </div>
      </Sidebar>
    );
  }

  return (
    <>
      <Head>
        <title>Team Chat - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="flex flex-col h-screen bg-[var(--background)]">
          {/* Header */}
          <div className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                  <MessageCircle className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[var(--foreground)]">Team Chat</h1>
                  <p className="text-sm text-[var(--secondary-foreground)]">
                    Real-time communication for your team
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-[var(--secondary-foreground)]">
                  <Users className="w-4 h-4" />
                  <span>{onlineUsers} online</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {ready ? (
                    <Wifi className="w-5 h-5 text-[var(--success)]" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-[var(--error)]" />
                  )}
                  <span className={`text-sm ${ready ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                    {ready ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          <Error message={error} />

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)]">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-16 h-16 text-[var(--secondary-foreground)] mb-4" />
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  No messages yet
                </h3>
                <p className="text-[var(--secondary-foreground)]">
                  Start the conversation by sending a message below
                </p>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id || Math.random()} className="flex justify-center">
                    <div className="px-3 py-1 bg-[var(--secondary)] rounded-full">
                      <span className="text-xs text-[var(--secondary-foreground)]">
                        {msg.message}
                      </span>
                    </div>
                  </div>
                );
              }

              const isOwnMessage = msg.user === username;
           
              return (
                <div 
                  key={msg.id || Math.random()} 
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
                        {msg.user || "Anonymous"}
                      </div>
                    )}
                    <div className="text-sm leading-relaxed break-words">
                      {msg.text}
                    </div>
                    <div 
                      className={`text-xs mt-2 ${
                        isOwnMessage 
                          ? "text-[var(--primary-foreground)]/70" 
                          : "text-[var(--secondary-foreground)]"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Section */}
          <div className="bg-[var(--surface)] border-t border-[var(--border)] p-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--secondary-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>
              <CustomButton
                title="Send"
                onClick={sendMessage}
                disabled={!ready || !message.trim()}
                className="btn-primary px-6 py-3 flex items-center gap-2"
                icon={<Send className="w-4 h-4" />}
              />
            </div>
            
            <div className="flex items-center justify-between mt-3 text-xs text-[var(--secondary-foreground)]">
              <span>Connected as: {username}</span>
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>
        </div>
      </Sidebar>
    </>
  );
}
