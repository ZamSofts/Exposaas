import { useState, useEffect } from "react";
import { API } from "@/hooks/wrapper";
import { Mail, Unplug, CheckCircle, AlertCircle, Key, Loader2 } from "lucide-react";

export default function GmailSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ussPassword, setUssPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await API("GET", "gmail/status");
      setStatus(res);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Show success/error from OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmailConnected")) {
      setMessage("Gmail connected successfully");
      setExpanded(true);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      fetchStatus();
    }
    if (params.get("gmailError")) {
      setMessage(`Error: ${params.get("gmailError")}`);
      setExpanded(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Gmail? Email auto-import will stop.")) return;
    try {
      await API("DELETE", "gmail/disconnect");
      setStatus({ connected: false });
      setMessage("Gmail disconnected");
    } catch (err) {
      setMessage("Failed to disconnect");
    }
  };

  const handleSavePassword = async () => {
    if (!ussPassword.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await API("POST", "gmail/uss-password", { password: ussPassword });
      setMessage("USS password saved");
      fetchStatus();
    } catch (err) {
      setMessage("Failed to save password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Header — always visible, clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--input)] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-[var(--secondary-foreground)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            Email Auto-Import
          </span>
          {status?.connected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
              <CheckCircle className="w-3 h-3" />
              {status.email}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Not connected
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--secondary-foreground)]">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)]">
          {message && (
            <div className="mt-3 px-3 py-2 rounded text-sm bg-[var(--input)] text-[var(--foreground)]">
              {message}
            </div>
          )}

          {!status?.connected ? (
            /* Not connected — show Connect button */
            <div className="mt-3">
              <p className="text-sm text-[var(--secondary-foreground)] mb-3">
                Connect your company Gmail to automatically import auction invoices and documents.
              </p>
              <a
                href="/api/gmail/auth"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                Connect Gmail
              </a>
            </div>
          ) : (
            /* Connected — show status + USS password + disconnect */
            <div className="mt-3 space-y-4">
              {/* Connection info */}
              <div className="flex items-center gap-4 text-sm text-[var(--secondary-foreground)]">
                <span>{status.emailCount} emails processed</span>
                {!status.isActive && (
                  <span className="inline-flex items-center gap-1 text-orange-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Auth expired — reconnect
                  </span>
                )}
              </div>

              {/* USS Password */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  <Key className="w-3.5 h-3.5 inline mr-1" />
                  USS Member Number (PDF Password)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ussPassword}
                    onChange={(e) => setUssPassword(e.target.value)}
                    placeholder={status.hasUssPassword ? "••••• (set)" : "e.g. N8001"}
                    maxLength={10}
                    className="px-3 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded text-sm text-[var(--foreground)] w-40"
                  />
                  <button
                    onClick={handleSavePassword}
                    disabled={saving || !ussPassword.trim()}
                    className="px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded text-sm hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--secondary-foreground)]">
                  Required for USS auction PDFs. Format: 1 uppercase letter + 4 digits.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                {!status.isActive && (
                  <a
                    href="/api/gmail/auth"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded text-sm hover:bg-orange-500/30 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Reconnect
                  </a>
                )}
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded text-sm transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
