import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth, CustomButton, Error ,Loader as customLoader} from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import { Loader, MessageCircle, Send, Users, Wifi, WifiOff } from "lucide-react";

export default function ChatPage() {
  const { session, status } = useAuth();

  // Memoize user info to prevent unnecessary re-renders
  const userInfo = useMemo(
    () => ({
      username: session?.name,
      userId: session?.id,
      companyId: session?.companyId,
    }),
    [session?.name, session?.id, session?.companyId]
  );

  // Don't render anything while loading or if not authenticated
  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen"></div>;
  }

  if (status !== "authenticated" || !session) {
    return <div className="flex justify-center items-center h-screen"></div>;
  }

  return <ChatContent userInfo={userInfo} />;
}

function ChatContent({ userInfo }) {
  const { username, userId, companyId } = userInfo;
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const connectingRef = useRef(false);
  const connectionAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const shouldConnectRef = useRef(true);
  const mountedRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  
  // Lazy loading states
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const MESSAGES_PER_PAGE = 10;

  // Component mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    shouldConnectRef.current = true;
    console.log("📍 Chat component mounted");
    
    return () => {
      console.log("📍 Chat component unmounting");
      mountedRef.current = false;
      shouldConnectRef.current = false;
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive (but not when loading more)
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Only auto-scroll for new messages, not when loading more old messages
    if (!loadingMore) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, loadingMore]);

  // Load more messages when scrolling to top
  const loadMoreMessages = useCallback(() => {
    if (!wsRef.current || !ready || loadingMore || !hasMoreMessages || !userId || !companyId) {
      console.log("❌ Cannot load more messages:", { 
        wsReady: !!wsRef.current, 
        ready, 
        loadingMore, 
        hasMoreMessages, 
        userId: !!userId, 
        companyId: !!companyId 
      });
      return;
    }

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      wsRef.current.send(
        JSON.stringify({
          type: "load_more",
          userId: userId,
          companyId: companyId,
          page: nextPage,
          limit: MESSAGES_PER_PAGE,
        })
      );
    } catch (error) {
      console.error("❌ Error sending load more request:", error);
      setLoadingMore(false);
      setError("Failed to load more messages");
    }
  }, [ready, loadingMore, hasMoreMessages, page, userId, companyId]);

  // Handle scroll events for lazy loading
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollTop = container.scrollTop;
    const threshold = 200; // Load more when within 200px of top

    if (scrollTop <= threshold && hasMoreMessages && !loadingMore && ready) {
      const currentScrollHeight = container.scrollHeight;
      const currentScrollTop = container.scrollTop;
      
      // Store current scroll position for maintaining position after load
      container.dataset.previousScrollHeight = currentScrollHeight;
      container.dataset.previousScrollTop = currentScrollTop;
      
      console.log(`🔄 Loading more messages - Scroll: ${scrollTop}px, Page: ${page + 1}`);
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadingMore, ready, loadMoreMessages, page]);

  // Maintain scroll position after loading more messages
  useEffect(() => {
    if (messagesContainerRef.current && !loadingMore && page > 1) {
      const container = messagesContainerRef.current;
      const previousScrollHeight = parseInt(container.dataset.previousScrollHeight || '0');
      const previousScrollTop = parseInt(container.dataset.previousScrollTop || '0');
      
      if (previousScrollHeight > 0) {
        const newScrollHeight = container.scrollHeight;
        const heightDifference = newScrollHeight - previousScrollHeight;
        // Maintain position by adjusting scroll
        container.scrollTop = previousScrollTop + heightDifference;
        
        // Clean up data attributes
        delete container.dataset.previousScrollHeight;
        delete container.dataset.previousScrollTop;
      }
    }
  }, [messages, loadingMore, page]);

  // WebSocket connection with improved error handling
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (connectingRef.current || !mountedRef.current || !shouldConnectRef.current) {
      console.log("⏳ Connection prevented:", { 
        connecting: connectingRef.current, 
        mounted: mountedRef.current, 
        shouldConnect: shouldConnectRef.current 
      });
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
      wsRef.current = null;
    }

    connectingRef.current = true;
    setConnecting(true);
    console.log("🔌 Starting WebSocket connection...");

    try {
      const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000";
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        
        connectingRef.current = false; // Reset connecting flag
        setConnecting(false);
        setReady(true);
        setError("");
        connectionAttemptsRef.current = 0; // Reset connection attempts
        setConnectionAttempts(0);
        console.log("🔌 WebSocket connected");

        // Join the chat with user info and request initial messages
        if (userId && username && companyId) {
          ws.send(
            JSON.stringify({
              type: "join",
              userId: userId,
              username: username,
              companyId: companyId,
              timestamp: Date.now(),
              page: 1,
              limit: MESSAGES_PER_PAGE,
            })
          );
        } else {
          console.error("❌ Missing user credentials:", { userId, username, companyId });
          setError("User authentication data missing");
        }
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          if (data.type === "user_count") {
            setOnlineUsers(data.count);
            return;
          }

          if (data.type === "chat_history") {
            const newMessages = data.messages || [];
            const total = data.total || 0;
            const currentPage = data.page || 1;
            
            setTotalMessages(total);
            setMessages(newMessages);
            setPage(1);
            setHasMoreMessages(total > newMessages.length);
            setLoading(false);
            setLoadingMore(false);
            return;
          }

          if (data.type === "load_more_messages") {
            const newMessages = data.messages || [];
            const total = data.total || 0;
            const currentPage = data.page || 1;
            
            setTotalMessages(total);
            
            // Prepend older messages to the beginning (they come in desc order, newest first)
            setMessages(prevMessages => [...newMessages.reverse(), ...prevMessages]);
            setPage(currentPage);
            setHasMoreMessages(data.hasMore);
            setLoadingMore(false);
            return;
          }

          if (data.type === "join_success") {
            console.log("✅ Successfully joined chat:", data.user);
            return;
          }

          if (data.type === "error") {
            console.error("❌ Server error:", data.message);
            setError(data.message);
            setLoadingMore(false); // Reset loading state on error
            return;
          }

          if (data.type === "system") {
            setMessages(prev => [
              ...prev,
              {
                ...data,
                id: data.id || Date.now() + Math.random(),
                timestamp: data.timestamp || Date.now(),
              },
            ]);
            return;
          }

          // Handle chat messages
          if (data.type === "chat") {
            console.log("📨 Received chat message:", data);

            setMessages(prev => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(msg => msg.id === data.id);
              if (exists) {
                console.log("⚠️ Duplicate message received, ignoring");
                return prev;
              }

              return [
                ...prev,
                {
                  ...data,
                  id: data.id || Date.now() + Math.random(),
                  timestamp: data.timestamp || Date.now(),
                },
              ];
            });
          }
        } catch (parseError) {
          console.error("❌ Error parsing message:", parseError);
          setError("Received invalid message from server");
        }
      };

      ws.onclose = event => {
        connectingRef.current = false; // Reset connecting flag
        setConnecting(false);
        setReady(false);
        console.log("❌ WebSocket closed, code:", event.code);

        // Only attempt reconnection if component is still mounted and we should connect
        if (mountedRef.current && shouldConnectRef.current && connectionAttemptsRef.current < 5) {
          connectionAttemptsRef.current += 1;
          setConnectionAttempts(connectionAttemptsRef.current);
         

          // Use timeout ref to allow cleanup
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && shouldConnectRef.current) {
              reconnectTimeoutRef.current = null;
              connect();
            }
          }, 2000 * connectionAttemptsRef.current); // Exponential backoff
        } else if (connectionAttemptsRef.current >= 5) {
          setError("Failed to connect after multiple attempts. Please refresh the page.");
        }
      };

      ws.onerror = err => {
        connectingRef.current = false; // Reset connecting flag
        setConnecting(false);
        console.error("❌ WebSocket error:", err);
        setError("Failed to connect to chat server");
        
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
      };
    } catch (err) {
      connectingRef.current = false; // Reset connecting flag
      setConnecting(false);
      setError("Failed to establish WebSocket connection");
      console.error("Connection error:", err);
      setLoading(false);
    }
  }, [userId, username, companyId]); 
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userId && username && companyId && shouldConnectRef.current && mountedRef.current) {
        console.log("🔐 User authenticated, connecting WebSocket:", { userId, username, companyId });
        connect();
        shouldConnectRef.current = false; // Prevent multiple connections
      } else {
        console.log("⏳ Waiting for authentication or already connected:", { 
          userId, 
          username, 
          companyId, 
          shouldConnect: shouldConnectRef.current,
          mounted: mountedRef.current 
        });
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      console.log("🧹 Chat component cleanup");
      shouldConnectRef.current = false; // Prevent reconnections during cleanup
      
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close WebSocket connection safely
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("🔌 Closing WebSocket on cleanup");
        wsRef.current.close(1000, "Component unmounting");
      }
      wsRef.current = null;
      
      // Reset states
      setReady(false);
      setMessages([]);
      setOnlineUsers(1);
    };
  }, [userId, username, companyId]); // Removed connect dependency

  const sendMessage = useCallback(() => {
    const text = message.trim();
    
    // Enhanced validation
    if (!text) {
      setError("Message cannot be empty");
      return;
    }
    
    if (text.length > 2000) {
      setError("Message too long. Maximum 2000 characters.");
      return;
    }
    
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError("Cannot send message: not connected to server");
      return;
    }
    
    if (!userId || !username || !companyId) {
      setError("User authentication required");
      return;
    }

    const payload = {
      type: "chat",
      user: username,
      text,
      userId: userId,
      companyId: companyId,
      timestamp: Date.now(),
    };

    try {
      wsRef.current.send(JSON.stringify(payload));
      setTotalMessages(prev => prev + 1);
      setMessage("");
      setError("");
    } catch (err) {
      setError("Failed to send message");
      console.error("Send error:", err);
    }
  }, [message, userId, username, companyId]);

  const handleKeyPress = useCallback(
    e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const formatTime = useCallback(timestamp => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  

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
                  <p className="text-sm text-[var(--secondary-foreground)]">Real-time communication for your team</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-[var(--secondary-foreground)]">
                  <Users className="w-4 h-4" />
                  <span>{onlineUsers} online</span>
                </div>

                <div className="flex items-center gap-2">
                  {connecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--warning)]"></div>
                      <span className="text-sm text-[var(--warning)]">Connecting...</span>
                    </>
                  ) : ready ? (
                    <>
                      <Wifi className="w-5 h-5 text-[var(--success)]" />
                      <span className="text-sm text-[var(--success)]">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-5 h-5 text-[var(--error)]" />
                      <span className="text-sm text-[var(--error)]">Disconnected</span>
                    </>
                  )}
                  {connectionAttempts > 0 && !ready && !connecting && (
                    <span className="text-xs text-[var(--secondary-foreground)]">
                      (Attempt {connectionAttempts}/5)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          <Error message={error} />
          
          {/* Loading overlay when connecting for the first time or loading messages */}
          {(loading || (connecting && messages.length === 0)) && (
            <div className="flex-1 flex items-center justify-center bg-[var(--background)]">
              <div className="text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
                    <MessageCircle className="w-6 h-6 text-[var(--primary)] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      {connecting ? "Connecting to chat..." : "Loading messages..."}
                    </h3>
                    <p className="text-sm text-[var(--secondary-foreground)]">
                      {connecting 
                        ? "Establishing connection to the chat server" 
                        : "Please wait while we load your chat history"
                      }
                    </p>
                    {connectionAttempts > 0 && (
                      <p className="text-xs text-[var(--warning)]">
                        Connection attempt {connectionAttempts}/5
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages Container - only show when not in initial loading state */}
          {!(loading || (connecting && messages.length === 0)) && (
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)]"
              onScroll={handleScroll}
            >
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]"></div>
                  <span className="text-sm text-[var(--secondary-foreground)]">Loading more messages...</span>
                </div>
              </div>
            )}
            
            {/* Show message count info */}
            {messages.length > 0 && !hasMoreMessages && (
              <div className="flex justify-center py-2">
                <div className="px-3 py-1 bg-[var(--secondary)] rounded-full">
                  <span className="text-xs text-[var(--secondary-foreground)]">
                    {totalMessages > 0 ? `Showing all ${totalMessages} messages` : 'Beginning of conversation'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Show load more info */}
            {messages.length > 0 && hasMoreMessages && !loadingMore && (
              <div className="flex justify-center py-2">
                <div className="px-3 py-1 bg-[var(--primary)]/10 rounded-full border border-[var(--primary)]/20">
                  <span className="text-xs text-[var(--primary)]">
                    Scroll up to load more messages ({totalMessages - messages.length} remaining)
                  </span>
                </div>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-16 h-16 text-[var(--secondary-foreground)] mb-4" />
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No messages yet</h3>
                <p className="text-[var(--secondary-foreground)]">Start the conversation by sending a message below</p>
              </div>
            )}

            {messages.map(msg => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id || Math.random()} className="flex justify-center">
                    <div className="px-3 py-1 bg-[var(--secondary)] rounded-full">
                      <span className="text-xs text-[var(--secondary-foreground)]">{msg.message}</span>
                    </div>
                  </div>
                );
              }

              const isOwnMessage = msg.user === username;

              return (
                <div key={msg.id || Math.random()} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow-sm ${
                      isOwnMessage ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                    }`}
                  >
                    {!isOwnMessage && <div className="text-xs font-medium mb-1 text-[var(--primary)]">{msg.user || "Anonymous"}</div>}
                    <div className="text-sm leading-relaxed break-words">{msg.text}</div>
                    <div className={`text-xs mt-2 ${isOwnMessage ? "text-[var(--primary-foreground)]/70" : "text-[var(--secondary-foreground)]"}`}>{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          )}

          {/* Input Section */}
          <div className="bg-[var(--surface)] border-t border-[var(--border)] p-4">
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <textarea
                  className={`w-full px-4 py-3 bg-[var(--input)] border rounded-lg text-[var(--foreground)] placeholder-[var(--secondary-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-none ${
                    message.length > 2000 ? 'border-[var(--error)]' : 'border-[var(--border)]'
                  } ${(loading || connecting) ? 'opacity-50' : ''}`}
                  value={message}
                  onChange={e => {
                    const newValue = e.target.value;
                    if (newValue.length <= 2100) { // Allow slight overflow for warning
                      setMessage(newValue);
                    }
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    loading ? "Loading messages..." :
                    connecting ? "Connecting to chat..." :
                    "Type your message..."
                  }
                  rows={1}
                  maxLength={2100}
                  disabled={loading || connecting}
                  style={{ minHeight: "48px", maxHeight: "120px" }}
                  onInput={e => {
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-[var(--secondary-foreground)]">
                    {loading || connecting ? 
                      (connecting ? "Establishing connection..." : "Loading chat history...") :
                      "Press Enter to send, Shift+Enter for new line"
                    }
                  </span>
                  <span className={`text-xs ${
                    message.length > 2000 ? 'text-[var(--error)]' : 
                    message.length > 1800 ? 'text-[var(--warning)]' : 
                    'text-[var(--secondary-foreground)]'
                  }`}>
                    {message.length}/2000
                  </span>
                </div>
              </div>
              <CustomButton 
                title={loading ? "Loading..." : connecting ? "Connecting..." : "Send"} 
                onClick={sendMessage} 
                disabled={!ready || !message.trim() || message.length > 2000 || loading || connecting} 
                className="btn-primary px-6 py-3 flex items-center gap-2 h-12 min-h-[48px]" 
                icon={<Send className="w-4 h-4" />} 
              />
            </div>

            
          </div>
        </div>
      </Sidebar>
    </>
  );
}
