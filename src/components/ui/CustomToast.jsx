import React, { useState, useEffect } from "react";

export function Toast({ type = "success", message }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      setIsExiting(false);

      // Auto-hide after 2 seconds
      const timer = setTimeout(() => {
        setIsExiting(true);
        // Wait for exit animation to complete before hiding
        setTimeout(() => {
          setIsVisible(false);
        }, 400);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [message]);

  if (!isVisible && !message) return null;

  const getTypeConfig = toastType => {
    switch (toastType) {
      case "success":
        return {
          bgColor: "bg-[var(--surface)]",
          textColor: "text-[var(--foreground)]",
          borderColor: "border-[var(--success)]",
          iconBg: "bg-[var(--success)]/10",
          iconColor: "text-[var(--success)]",
        };
      case "error":
        return {
          bgColor: "bg-[var(--surface)]",
          textColor: "text-[var(--foreground)]",
          borderColor: "border-[var(--error)]",
          iconBg: "bg-[var(--error)]/10",
          iconColor: "text-[var(--error)]",
        };
      case "warning":
        return {
          bgColor: "bg-[var(--surface)]",
          textColor: "text-[var(--foreground)]",
          borderColor: "border-[var(--warning)]",
          iconBg: "bg-[var(--warning)]/10",
          iconColor: "text-[var(--warning)]",
        };
      case "info":
        return {
          bgColor: "bg-[var(--surface)]",
          textColor: "text-[var(--foreground)]",
          borderColor: "border-[var(--primary)]",
          iconBg: "bg-[var(--primary)]/10",
          iconColor: "text-[var(--primary)]",
        };
      default:
        return getTypeConfig("success");
    }
  };

  const config = getTypeConfig(type);

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );
      case "error":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case "warning":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case "info":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return getIcon("success");
    }
  };

  return (
    <>
      <div
        className={`fixed top-4 left-[60%] transform -translate-x-1/2 z-[9999] 
          min-w-[280px] max-w-[400px] transition-all duration-300 ease-out
          ${isExiting ? "animate-toast-exit" : "animate-toast-enter"}
          ${config.bgColor} ${config.textColor} ${config.borderColor}
          px-4 py-3 rounded-lg shadow-lg border
          flex items-center gap-3 font-medium`}
        style={{
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        <div className={`flex items-center justify-center rounded-full ${config.iconBg} ${config.iconColor} p-2`}>{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-relaxed break-words">{message}</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes toast-enter {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes toast-exit {
          0% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
        }

        .animate-toast-enter {
          animation: toast-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-toast-exit {
          animation: toast-exit 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }
      `}</style>
    </>
  );
}
