import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useAuth, API, Error, Toast, Loader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import {
  Sparkles, Play, CheckCircle, Archive, Trash2, Plus, Wand2, Eye, EyeOff,
  ChevronDown, ChevronRight, Zap, Brain,
} from "lucide-react";
import { ACCURACY_PCT } from "@/config/aiConstants";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  evaluating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  evaluated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500",
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-[var(--muted-foreground)] text-sm">-</span>;
  const pct = Math.round(score * 100);
  const color = pct >= ACCURACY_PCT.HIGH ? "text-green-600" : pct >= ACCURACY_PCT.MID ? "text-amber-600" : "text-red-600";
  return <span className={`text-sm font-semibold ${color}`}>{pct}%</span>;
}

export default function PromptsPage() {
  const { session, status } = useAuth(["view:vehicle"], ["Sadmin"]);
  const [versions, setVersions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  // UI state
  const [expandedId, setExpandedId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPromptContent, setNewPromptContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResults, setOptimizeResults] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const res = await API("GET", "promptVersion");
    if (res.error) {
      setError(res.error);
    } else {
      setVersions(res.versions || []);
      setActiveId(res.activeId);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadVersions();
  }, [status, loadVersions]);

  const createVersion = async () => {
    if (!newPromptContent.trim()) {
      setToast({ id: Date.now(), message: "Prompt content is required", type: "error" });
      return;
    }
    const res = await API("POST", "promptVersion", {
      content: newPromptContent,
      strategy: "manual",
    });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setToast({ id: Date.now(), message: `Created ${res.version}`, type: "success" });
      setShowCreateForm(false);
      setNewPromptContent("");
      loadVersions();
    }
  };

  const generateVariations = async () => {
    setIsGenerating(true);
    const res = await API("POST", "promptVersion", { action: "generate" });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      const count = res.generated?.length || 0;
      setToast({ id: Date.now(), message: `Generated ${count} prompt variation(s)`, type: "success" });
      loadVersions();
    }
    setIsGenerating(false);
  };

  const optimizeWithAI = async () => {
    setIsOptimizing(true);
    setOptimizeResults(null);
    const res = await API("POST", "promptVersion", { action: "optimize" });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setOptimizeResults(res);
      const best = res.bestCandidate;
      const msg = best
        ? `AI最適化完了: ${best.approach} (${Math.round((best.score || 0) * 100)}%)${res.improvement != null ? ` 改善: ${res.improvement >= 0 ? "+" : ""}${res.improvement}%` : ""}`
        : "AI最適化完了";
      setToast({ id: Date.now(), message: msg, type: "success" });
      loadVersions();
    }
    setIsOptimizing(false);
  };

  const initPrompt = async () => {
    setIsInitializing(true);
    const res = await API("POST", "promptVersion", { action: "init" });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setToast({ id: Date.now(), message: `初期プロンプト v1.0 を作成しました (schema_default)`, type: "success" });
      loadVersions();
    }
    setIsInitializing(false);
  };

  const evaluateVersion = async (id) => {
    setEvaluatingId(id);
    const res = await API("POST", "promptVersion", { action: "evaluate", promptVersionId: id });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      const score = res.aggregateScore != null ? Math.round(res.aggregateScore * 100) : "?";
      setToast({ id: Date.now(), message: `Evaluation complete: ${score}% accuracy`, type: "success" });
      loadVersions();
    }
    setEvaluatingId(null);
  };

  const activateVersion = async (id) => {
    const res = await API("PUT", "promptVersion", { id, action: "activate" });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setToast({ id: Date.now(), message: "Prompt activated! Future extractions will use this prompt.", type: "success" });
      loadVersions();
    }
  };

  const archiveVersion = async (id) => {
    const res = await API("PUT", "promptVersion", { id, action: "archive" });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setToast({ id: Date.now(), message: "Prompt archived", type: "success" });
      loadVersions();
    }
  };

  const deleteVersion = async (id) => {
    const res = await API("DELETE", "promptVersion", { id });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setToast({ id: Date.now(), message: "Prompt deleted", type: "success" });
      loadVersions();
    }
  };

  if (status === "loading") return <Loader />;

  return (
    <>
      <Head>
        <title>Prompt Management - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-6 md:p-8 bg-[var(--background)] min-h-screen">
          <Error message={error} />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-[var(--primary)]" />
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Prompt Management</h1>
                <p className="text-sm text-[var(--secondary-foreground)]">
                  Manage and optimize AI extraction prompts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={optimizeWithAI}
                disabled={isOptimizing || !activeId}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-md"
              >
                {isOptimizing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    AI Optimizing...
                  </>
                ) : (
                  <>
                    <Brain size={16} />
                    AI Optimize
                  </>
                )}
              </button>
              <button
                onClick={generateVariations}
                disabled={isGenerating || !activeId}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    Template Gen
                  </>
                )}
              </button>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus size={16} />
                New Prompt
              </button>
            </div>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-6">
              <h3 className="text-base font-semibold text-[var(--foreground)] mb-3">Create New Prompt Version</h3>
              <textarea
                value={newPromptContent}
                onChange={e => setNewPromptContent(e.target.value)}
                placeholder="Paste your prompt content here..."
                rows={12}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => { setShowCreateForm(false); setNewPromptContent(""); }}
                  className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--input)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createVersion}
                  className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* AI Optimization Results */}
          {optimizeResults && (
            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={18} className="text-indigo-600" />
                <h3 className="text-base font-semibold text-[var(--foreground)]">AI Optimization Results</h3>
              </div>

              {/* Error analysis summary */}
              {optimizeResults.errorAnalysis && (
                <div className="mb-4">
                  <p className="text-sm text-[var(--secondary-foreground)] mb-2">
                    Analyzed {optimizeResults.errorAnalysis.totalDiffs} corrections, {optimizeResults.goldenCount} golden records
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {optimizeResults.errorAnalysis.topErrors?.map(e => (
                      <span
                        key={e.field}
                        className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      >
                        {e.field}: {e.errorRate}% error
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate results */}
              {optimizeResults.results?.length > 0 && (
                <div className="space-y-2">
                  {optimizeResults.results.map((r, i) => (
                    <div
                      key={r.id || i}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        i === 0
                          ? "bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700"
                          : "bg-[var(--background)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && <Zap size={14} className="text-indigo-600" />}
                        <span className="text-sm text-[var(--foreground)]">
                          {r.approach || `Candidate ${i + 1}`}
                        </span>
                        {r.error && (
                          <span className="text-xs text-red-600">({r.error})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <ScoreBadge score={r.score} />
                        {r.id && (
                          <button
                            onClick={() => activateVersion(r.id)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Improvement summary */}
              {optimizeResults.improvement != null && (
                <p className={`text-sm mt-3 font-medium ${
                  optimizeResults.improvement >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {optimizeResults.improvement >= 0 ? "+" : ""}{optimizeResults.improvement}% vs current
                  {optimizeResults.baselineScore != null && ` (baseline: ${Math.round(optimizeResults.baselineScore * 100)}%)`}
                </p>
              )}

              <button
                onClick={() => setOptimizeResults(null)}
                className="mt-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Active Prompt Info */}
          {activeId && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <span className="text-sm text-green-800 dark:text-green-400 font-medium">
                  Active prompt: {versions.find(v => v.id === activeId)?.version || `#${activeId}`}
                  {" "}({versions.find(v => v.id === activeId)?.strategy || "manual"})
                </span>
              </div>
            </div>
          )}

          {/* Versions List */}
          {isLoading ? (
            <Loader />
          ) : versions.length > 0 ? (
            <div className="space-y-3">
              {versions.map(v => {
                const isExpanded = expandedId === v.id;
                const isActive = v.status === "active";
                const isEval = evaluatingId === v.id;

                return (
                  <div
                    key={v.id}
                    className={`bg-[var(--surface)] border rounded-xl overflow-hidden transition-colors ${
                      isActive ? "border-green-300 dark:border-green-700" : "border-[var(--border)]"
                    }`}
                  >
                    {/* Header row */}
                    <div
                      className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-[var(--input)] transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="font-medium text-[var(--foreground)]">{v.version}</span>
                        <StatusBadge status={v.status} />
                        {v.strategy && (
                          <span className="text-xs text-[var(--muted-foreground)] bg-[var(--background)] px-2 py-0.5 rounded">
                            {v.strategy}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <ScoreBadge score={v.score} />
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-[var(--border)] px-5 py-4">
                        {/* Score details */}
                        {v.scoreDetails && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Evaluation Results</h4>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="p-2 bg-[var(--background)] rounded-lg">
                                <p className="text-lg font-bold">{Math.round((v.score || 0) * 100)}%</p>
                                <p className="text-xs text-[var(--muted-foreground)]">Score</p>
                              </div>
                              <div className="p-2 bg-[var(--background)] rounded-lg">
                                <p className="text-lg font-bold text-green-600">{v.scoreDetails.exactMatches || 0}</p>
                                <p className="text-xs text-[var(--muted-foreground)]">Exact</p>
                              </div>
                              <div className="p-2 bg-[var(--background)] rounded-lg">
                                <p className="text-lg font-bold">{v.scoreDetails.totalRecords || 0}</p>
                                <p className="text-xs text-[var(--muted-foreground)]">Total</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {v.status !== "active" && v.status !== "archived" && (
                            <button
                              onClick={() => evaluateVersion(v.id)}
                              disabled={isEval}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {isEval ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Evaluating...
                                </>
                              ) : (
                                <>
                                  <Play size={14} />
                                  Evaluate
                                </>
                              )}
                            </button>
                          )}
                          {v.status !== "active" && v.score != null && (
                            <button
                              onClick={() => activateVersion(v.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle size={14} />
                              Activate
                            </button>
                          )}
                          {v.status !== "active" && v.status !== "archived" && (
                            <button
                              onClick={() => archiveVersion(v.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--input)] transition-colors"
                            >
                              <Archive size={14} />
                              Archive
                            </button>
                          )}
                          {v.status !== "active" && (
                            <button
                              onClick={() => deleteVersion(v.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          )}
                        </div>

                        {/* Evaluated at */}
                        {v.evaluatedAt && (
                          <p className="text-xs text-[var(--muted-foreground)] mt-3">
                            Evaluated: {new Date(v.evaluatedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Sparkles className="mx-auto mb-3 text-[var(--muted-foreground)]" size={40} />
              <p className="text-lg text-[var(--foreground)]">No prompt versions yet</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-4">
                Initialize the first prompt from schema definitions to start the optimization loop
              </p>
              <button
                onClick={initPrompt}
                disabled={isInitializing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-md"
              >
                {isInitializing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Initialize v1.0 (Schema Default)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </Sidebar>
      <Toast id={toast.id} type={toast.type} message={toast.message}
             onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
