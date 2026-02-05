import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth } from "@/hooks/useAuth";
import { CustomButton, Error, Loader as customLoader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import {  MessageCircle, Send, Users, Wifi, WifiOff } from "lucide-react";
import wsClient from "@/lib/wsClient";

export default function ChatPage() {
  const { session, status } = useAuth([],["Customer"]);

  const userInfo = useMemo(
    () => ({
      username: session?.name,
      userId: session?.id,
      companyId: session?.companyId,
    }),
    [session?.name, session?.id, session?.companyId]
  );

  if (!session) {
    return <customLoader/>
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
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  
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
      
      // Clean up scroll timeout
      if (window.scrollTimeoutId) {
        clearTimeout(window.scrollTimeoutId);
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive (but not when loading more)
  const scrollToBottom = useCallback((immediate = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: immediate ? "instant" : "smooth",
        block: "end" 
      });
    }
  }, []);

  // Check if user is near bottom of chat
  const checkIfNearBottom = useCallback(() => {
    if (!messagesContainerRef.current) return false;
    
    const container = messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsNearBottom(isNear);
    return isNear;
  }, []);

  useEffect(() => {
    if (!loadingMore && (loading || (isNearBottom && !isUserScrolling))) {
  
      const scrollTimeout = setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      return () => clearTimeout(scrollTimeout);
    }
  }, [messages, scrollToBottom, loadingMore, loading, isNearBottom, isUserScrolling]);

 
  useEffect(() => {
   
    if (!loading && messages.length > 0) {
      const initialScrollTimeout = setTimeout(() => {
        scrollToBottom(true); // immediate scroll for initial load
        setIsNearBottom(true); // User is now at bottom
      }, 100);
      
      return () => clearTimeout(initialScrollTimeout);
    }
  }, [loading, scrollToBottom]); // Only depend on loading state change

  // Load more messages when scrolling to top
  const loadMoreMessages = useCallback(() => {
    if (!wsClient.isConnected() || !ready || loadingMore || !hasMoreMessages || !userId || !companyId) {
      console.log("❌ Cannot load more messages:", {
        wsConnected: wsClient.isConnected(),
        ready,
        loadingMore,
        hasMoreMessages,
        userId: !!userId,
        companyId: !!companyId,
      });
      return;
    }

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      wsClient.send({
        type: 'load_more',
        userId: userId,
        companyId: companyId,
        page: nextPage,
        limit: MESSAGES_PER_PAGE,
      });
    } catch (error) {
      console.error('❌ Error sending load more request:', error);
      setLoadingMore(false);
      setError('Failed to load more messages');
    }
  }, [ready, loadingMore, hasMoreMessages, page, userId, companyId]);

  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollTop = container.scrollTop;
    const threshold = 200; 
    
    checkIfNearBottom();
    setIsUserScrolling(true);
    
    // Clear the scrolling flag after a delay
    clearTimeout(window.scrollTimeoutId);
    window.scrollTimeoutId = setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);

    if (scrollTop <= threshold && hasMoreMessages && !loadingMore && ready) {
      const currentScrollHeight = container.scrollHeight;
      const currentScrollTop = container.scrollTop;
      
      container.dataset.previousScrollHeight = currentScrollHeight;
      container.dataset.previousScrollTop = currentScrollTop;
      
      console.log(`🔄 Loading more messages - Scroll: ${scrollTop}px, Page: ${page + 1}`);
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadingMore, ready, loadMoreMessages, page, checkIfNearBottom]);

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

  const connect = useCallback(() => {
    if (!mountedRef.current || !shouldConnectRef.current) return;
    // subscribe to wsClient messages via handler below when auth ready
    wsClient.connect({ id: userId, username, companyId });
  }, [userId, username, companyId]);
  useEffect(() => {
    const handler = data => {
      try {
        if (!data) return;
        if (data.type === '__open') {
          connectingRef.current = false;
          setConnecting(false);
          setReady(true);
          setError("");
          connectionAttemptsRef.current = 0;
          setConnectionAttempts(0);
          console.log('🔌 WebSocket connected (shared)');
          // Send join with pagination request so server returns initial chat history
          if (userId && username && companyId) {
            wsClient.send({
              type: 'join',
              userId: userId,
              username: username,
              companyId: companyId,
              timestamp: Date.now(),
              page: 1,
              limit: MESSAGES_PER_PAGE,
            });
          }
          return;
        }

        if (data.type === '__close') {
          connectingRef.current = false;
          setConnecting(false);
          setReady(false);
          console.log('❌ WebSocket closed (shared)');
          // Reconnect logic is handled by wsClient
          return;
        }

        if (data.type === 'user_count') {
          setOnlineUsers(data.count);
          return;
        }

        if (data.type === 'chat_history') {
          const newMessages = data.messages || [];
          const total = data.total || 0;
          const currentPage = data.page || 1;

          setTotalMessages(total);
          setMessages(newMessages);
          setPage(1);
          setHasMoreMessages(total > newMessages.length);
          setLoading(false);
          setLoadingMore(false);

          setTimeout(() => {
            scrollToBottom(true);
            setIsNearBottom(true);
            setIsUserScrolling(false);
          }, 100);
          return;
        }

        if (data.type === 'load_more_messages') {
          const newMessages = data.messages || [];
          const total = data.total || 0;
          const currentPage = data.page || 1;

          setTotalMessages(total);
          setMessages(prevMessages => [...newMessages.reverse(), ...prevMessages]);
          setPage(currentPage);
          setHasMoreMessages(data.hasMore);
          setLoadingMore(false);
          return;
        }

        if (data.type === 'join_success') {
          console.log('✅ Successfully joined chat:', data.user);
          return;
        }

        if (data.type === 'error') {
          console.error('❌ Server error:', data.message);
          setError(data.message);
          setLoadingMore(false);
          return;
        }

        if (data.type === 'system') {
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

        if (data.type === 'chat') {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === data.id);
            if (exists) return prev;
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
      } catch (e) {
        console.error('chat handler error', e);
      }
    };

    // subscribe and connect when user is available
    const timer = setTimeout(() => {
      if (userId && username && companyId && mountedRef.current) {
        console.log('🔐 User authenticated, connecting shared WebSocket:', { userId, username, companyId });
        wsClient.subscribe(handler);
        wsClient.connect({ id: userId, username, companyId });
        shouldConnectRef.current = false;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      console.log('🧹 Chat component cleanup');
      shouldConnectRef.current = false;
      wsClient.unsubscribe(handler);

      // reset chat UI state
      setReady(false);
      setMessages([]);
      setOnlineUsers(1);
    };
  }, [userId, username, companyId]);

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
    
    if (!wsClient.isConnected()) {
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
      wsClient.send(payload);
      setTotalMessages(prev => prev + 1);
      setMessage("");
      setError("");
      // After sending, force scroll to bottom so sender sees their message
      setTimeout(() => {
        try {
          scrollToBottom(true);
          setIsNearBottom(true);
          setIsUserScrolling(false);
        } catch (e) {
          /* ignore */
        }
      }, 80);
    } catch (err) {
      setError("Failed to send message");
      console.error("Send error:", err);
    }
  }, [message, userId, username, companyId, scrollToBottom]);

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
