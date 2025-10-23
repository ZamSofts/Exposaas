import React from "react";
import { AlertTriangle, X, Check } from "lucide-react";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
  onConfirm,
  onCancel,
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      // Keep rendered until animation completes
      setTimeout(() => setShouldRender(false), 400);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "danger":
        return {
          iconBg: "bg-[var(--error)]/10",
          iconColor: "text-[var(--error)]",
          confirmBg: "bg-[var(--error)] hover:bg-[var(--error)]/90",
        };
      case "info":
        return {
          iconBg: "bg-[var(--primary)]/10",
          iconColor: "text-[var(--primary)]",
          confirmBg: "bg-[var(--primary)] hover:bg-[var(--primary)]/90",
        };
      default: // warning
        return {
          iconBg: "bg-[var(--warning)]/10",
          iconColor: "text-[var(--warning)]",
          confirmBg: "bg-[var(--warning)] hover:bg-[var(--warning)]/90",
        };
    }
  };

  const styles = getTypeStyles();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <>
      <style>{`
        
        
        @keyframes show-modal {
          0% {
            transform: scale(0);
          }
          
          100% {
            transform: scale(1);
          }
        }

        @keyframes hide-modal {
          0% {
            transform: scale(1);
          }
          20% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(0);
          }
        }
        
        .modal-content-enter {
          transform: scale(0);
          animation: show-modal 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          animation-fill-mode: forwards;
        }
        
        .modal-content-exit {
          animation: hide-modal 0.3s cubic-bezier(0.4, 0, 1, 1);
          animation-fill-mode: forwards;
        }
      `}</style>

      <div
        className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-500000 ${
          isVisible ? "modal-backdrop-enter" : "modal-backdrop-exit"
        }`}
        onClick={handleBackdropClick}>
        <div
          className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md shadow-2xl ${
            isVisible ? "modal-content-enter" : "modal-content-exit"
          }`}
          style={{
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            transform: isVisible ? undefined : "scale(0)",
          }}>
          {/* Header with Icon */}
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full ${styles.iconBg} transition-all duration-200`}>
              <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-[var(--secondary-foreground)] hover:text-[var(--foreground)] 
                       hover:bg-[var(--secondary)] rounded-lg transition-all duration-200
                       hover:scale-110 active:scale-95">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Message */}
          <div className="mb-6">
            <p className="text-[var(--secondary-foreground)] leading-relaxed">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-[var(--secondary)] hover:bg-[var(--border)]
                       text-[var(--secondary-foreground)] rounded-lg font-medium 
                       transition-all duration-200 border border-[var(--border)]
                       hover:scale-[1.02] active:scale-[0.98]">
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 px-4 py-2.5 ${styles.confirmBg}
                       text-white rounded-lg font-medium transition-all duration-200
                       shadow-lg hover:shadow-xl flex items-center justify-center gap-2
                       hover:scale-[1.02] active:scale-[0.98]`}>
              <Check className="w-4 h-4" />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook for easier usage
export function useConfirm() {
  const [confirmState, setConfirmState] = React.useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  });

  const confirm = (options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        ...options,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  };

  const ConfirmComponent = () => <ConfirmModal {...confirmState} />;

  return { confirm, ConfirmComponent };
}
