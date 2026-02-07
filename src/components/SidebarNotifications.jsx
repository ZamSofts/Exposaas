import { useEffect, useRef, useState, useCallback } from "react";
import {useAuth , API,useConfirm  } from "@/hooks/wrapper";
import { Bell, X, CheckCircle, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import wsClient from "@/lib/wsClient";

const SidebarNotifications = ({ isCollapsed = false }) => {
  const { session } = useAuth([], ["sadmin", "customer"]);
  const { confirm, ConfirmComponent } = useConfirm();
  const wsRef = useRef(null);
  const buttonRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ right: 0, left: "auto" });

  const loadNotifications = useCallback(async () => {
    if (!session?.id) return;

    setLoading(true);
    try {
      const data = await API("GET", "notifications");
      if (data && !data.error) {
        setNotifications(
          (data.notifications || []).map(n => ({
            ...n,
            read: n.isRead,
            timestamp: n.createdAt,
          }))
        );
      } else {
        console.error("❌ Failed to load notifications (API):", data && data.error);
      }
    } catch (error) {
      console.error("❌ Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.id]);

  // Handle incoming notifications
  const handleNotification = useCallback(notificationData => {
    const notification = {
      id: notificationData.id || Date.now() + Math.random(),
      ...notificationData,
      timestamp: notificationData.timestamp || new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => {
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;

      return [notification, ...prev];
    });

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title || "New Notification", {
        body: notification.message,
        icon: "/favicon.ico",
        tag: notification.category || "general",
      });
    }

  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async notificationId => {
    try {
      const res = await API("PUT", "notifications", { notificationId });
      if (res && !res.error) {
        setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read: true } : n)));
      } else {
        console.error("❌ Failed to mark as read (API):", res && res.error);
      }
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error);
    }
  }, []);

  const deleteIt = async id => {
   
    try {
      const data = await API("DELETE", `notifications?id=${id}`);
      if (data.error) {
        return;
      }

      loadNotifications();
    } catch (error) {
      console.error("❌ Failed to delete notification:", error);
    }
  };

  const calculateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 320;
    const viewportWidth = window.innerWidth;
    const spaceOnRight = viewportWidth - buttonRect.right;

    if (isCollapsed) {
      setDropdownPosition({
        left: "100%",
        right: "auto",
        marginLeft: "8px",
      });
    } else {
      if (spaceOnRight >= dropdownWidth) {
        setDropdownPosition({
          right: "0",
          left: "auto",
          marginLeft: "0",
        });
      } else {
        const rightOffset = Math.max(0, dropdownWidth - spaceOnRight + 16); // 16px padding
        setDropdownPosition({
          right: `-${rightOffset}px`,
          left: "auto",
          marginLeft: "0",
        });
      }
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (showNotifications) {
      calculateDropdownPosition();

      const handleResize = () => calculateDropdownPosition();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [showNotifications, calculateDropdownPosition]);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await API("PUT", "notifications", { markAllRead: true });
      if (res && !res.error) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } else {
        console.error("❌ Failed to mark all as read (API):", res && res.error);
      }
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
    }
  }, []);

  // WebSocket connection for notifications
  useEffect(() => {
    // Connect the shared wsClient when session available
    if (!session?.id || !session?.companyId) {
      // disconnect shared client if session removed
      wsClient.disconnect();
      setIsConnected(false);
      return;
    }

    const handler = data => {
      if (!data) return;
      if (data.type === '__open') {
        setIsConnected(true);
        return;
      }
      if (data.type === '__close') {
        setIsConnected(false);
        return;
      }
      if (data.type === 'notification') {
        handleNotification(data);
      }
    };

    wsClient.subscribe(handler);
    wsClient.connect({ id: session.id, username: session.username, companyId: session.companyId });

    return () => {
      wsClient.unsubscribe(handler);
    };
  }, [session?.id, session?.companyId, session?.username, handleNotification]);

  // Load notifications on mount
  useEffect(() => {
    if (session?.id) {
      loadNotifications();
    }
  }, [session?.id, loadNotifications]);

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log("🔔 Sidebar notification permission:", permission);
      });
    }
  }, []);

  // Debug: indicate the component mounted in browser console
  useEffect(() => {
    console.log("🔔 SidebarNotifications mounted", {
      isCollapsed,
      session: session
        ? {
            id: session.id,
            username: session.username,
            companyId: session.companyId,
          }
        : "No session",
    });
  }, [isCollapsed, session]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (showNotifications && !event.target.closest(".sidebar-notification-dropdown")) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showNotifications]);

  // Don't render if no session
  if (!session?.id) {
    return null;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setShowNotifications(!showNotifications)}
        className={`relative p-2 rounded-lg transition-all duration-200 border ${
          isConnected ? "text-[var(--foreground)] hover:bg-[var(--accent)] border-[var(--border)]" : "text-[var(--muted-foreground)] cursor-not-allowed border-red-300"
        }`}
        disabled={!isConnected}
        title={isConnected ? "View notifications" : "Connecting..."}
        aria-label={isConnected ? "View notifications" : "Connecting to notifications"}
        role="button"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--error)] text-[var(--primary-foreground)] text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {/* Connection indicator */}
        <div className={`absolute -bottom-0 -right-0 rounded-full ${isConnected ? "bg-[var(--success)]" : "bg-[var(--error)]"}`} style={{width:'5px',height:"5px"}} />
      </button>

      {/* Notification Dropdown */}
      {showNotifications && (
        <div
          className="sidebar-notification-dropdown absolute top-0  w-66 max-h-96 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-500000"
          style={{
            right: dropdownPosition.right,
            left: dropdownPosition.left,
            marginLeft: dropdownPosition.marginLeft,
            minWidth: "60px",
            maxWidth: "380px",
          }}
        >
          <div className="p-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--primary)]">
            <h3 className="font-semibold text-[var(--primary-foreground)] text-sm">Notifications</h3>
            <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-[var(--accent)] rounded transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="max-h-80  overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-[var(--muted-foreground)]">
                <Bell size={32} className="mx-auto text-[var(--muted-foreground)]/50 mb-2" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors ${!notification.read ? "bg-[var(--primary)]/10" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {notification.category === "error" ? (
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    ) : notification.category === "success" ? (
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Bell size={16} className="text-[var(--primary)] flex-shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[var(--foreground)] font-semibold text-xs leading-tight">{notification.title}</h4>
                      {/* <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-tight">
                        {notification.message
    ? `${notification.message.slice(0, 30)}${notification.message.length > 40 ? '...' : ''}`
    : 'No message available.'}
                      </p> */}
                      <p className="text-xs text-[var(--muted-foreground)]/70 mt-1">{new Date(notification.timestamp).toLocaleString()}</p>

                      {notification.actions && notification.actions.length > 0 && (
                        <div className="mt-2 space-x-1">
                          {notification.actions.map((action, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (action.url) {
                                  if (action.url.startsWith("/")) {
                                    window.location.href = action.url;
                                  } else {
                                    window.open(action.url, "_blank");
                                  }
                                }
                                markAsRead(notification.id);
                                setShowNotifications(false);
                              }}
                              className="text-xs bg-[var(--primary)]/10 text-[var(--foreground)] border border-[var(--primary)]/30 px-2 py-1 rounded hover:bg-[var(--primary)]/80 hover:text-[var(--primary-foreground)] transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!notification.read && (
                      <button onClick={() => markAsRead(notification.id)} className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/70 flex-shrink-0">
                        ✓
                      </button>

                    )}
                    <button onClick={() => deleteIt(notification.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2">
                      <Trash2 size={14} />
                    </button>

                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="h-10 flex items-center justify-center  border-t border-[var(--border)] bg-[var(--primary)]  hover:bg-[var(--primary)]/50 transition-colors disabled:opacity-50">
              <button onClick={markAllAsRead} disabled={loading} className="text-xs text-[var(--primary-foreground)] hover:text-[var(--primary-foreground)]  ">
                {loading ? "Loading..." : "Mark all as read"}
              </button>
            </div>
          )}
        </div>
      )}
        <ConfirmComponent />
    </div>
  );
};

export default SidebarNotifications;
