import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useAuth, API, Error, Toast, Loader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import { FlaskConical, Star, StarOff, Play, CheckCircle, XCircle, ExternalLink } from "lucide-react";

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-[var(--muted-foreground)]">-</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
    : pct >= 60 ? "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30"
    : "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

export default function EvaluationPage() {
  const { session, status } = useAuth(["view:vehicle"], ["Sadmin"]);
  const [goldenRecords, setGoldenRecords] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResults, setEvalResults] = useState(null);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  const loadGoldenRecords = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const res = await API("GET", "evaluationDataset");
    if (res.error) {
      setError(res.error);
    } else {
      setGoldenRecords(res.records || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadGoldenRecords();
  }, [status, loadGoldenRecords]);

  const toggleGolden = async (id, currentlyGolden) => {
    const res = await API("PATCH", "paymentConfirmation", { id, isGolden: !currentlyGolden });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setToast({ id: Date.now(), message: currentlyGolden ? "Removed from golden dataset" : "Added to golden dataset", type: "success" });
      loadGoldenRecords();
    }
  };

  const runEvaluation = async () => {
    if (goldenRecords.length === 0) {
      setToast({ id: Date.now(), message: "No golden records to evaluate", type: "error" });
      return;
    }
    setIsEvaluating(true);
    setEvalResults(null);
    const res = await API("POST", "evaluationDataset", { action: "evaluate" });
    if (res.error) {
      setToast({ id: Date.now(), message: res.error, type: "error" });
    } else {
      setEvalResults(res);
      setToast({ id: Date.now(), message: `Evaluation complete: ${Math.round((res.aggregateScore || 0) * 100)}% accuracy`, type: "success" });
    }
    setIsEvaluating(false);
  };

  if (status === "loading") return <Loader />;

  return (
    <>
      <Head>
        <title>Evaluation Dataset - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-6 md:p-8 bg-[var(--background)] min-h-screen">
          <Error message={error} />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-7 h-7 text-[var(--primary)]" />
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Evaluation Dataset</h1>
                <p className="text-sm text-[var(--secondary-foreground)]">
                  Golden records for testing prompt accuracy ({goldenRecords.length} records)
                </p>
              </div>
            </div>
            <button
              onClick={runEvaluation}
              disabled={isEvaluating || goldenRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Evaluation
                </>
              )}
            </button>
          </div>

          {/* Evaluation Results */}
          {evalResults && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-6">
              <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Evaluation Results</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-[var(--background)] rounded-lg">
                  <p className="text-3xl font-bold text-[var(--foreground)]">
                    {Math.round((evalResults.aggregateScore || 0) * 100)}%
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">Overall Accuracy</p>
                </div>
                <div className="text-center p-3 bg-[var(--background)] rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{evalResults.exactMatches || 0}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Exact Matches</p>
                </div>
                <div className="text-center p-3 bg-[var(--background)] rounded-lg">
                  <p className="text-3xl font-bold text-amber-600">{evalResults.totalRecords - (evalResults.exactMatches || 0)}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">With Differences</p>
                </div>
              </div>

              {/* Per-record results */}
              {evalResults.perRecord && evalResults.perRecord.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Record</th>
                        <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Score</th>
                        <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Fields Changed</th>
                        <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evalResults.perRecord.map(r => (
                        <tr key={r.id} className="border-b border-[var(--border)]">
                          <td className="py-2 px-3 text-[var(--foreground)]">#{r.id}</td>
                          <td className="py-2 px-3"><ScoreBadge score={r.score} /></td>
                          <td className="py-2 px-3 text-[var(--muted-foreground)]">{r.fieldsChanged || 0}</td>
                          <td className="py-2 px-3">
                            {r.isExactMatch ? (
                              <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> Match</span>
                            ) : r.error ? (
                              <span className="flex items-center gap-1 text-red-600"><XCircle size={14} /> Error</span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600">Differs</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Golden Records Table */}
          {isLoading ? (
            <Loader />
          ) : goldenRecords.length > 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Golden Records</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">ID</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Document</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Page</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Vehicles</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Auction</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Status</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goldenRecords.map(r => (
                      <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--input)] transition-colors">
                        <td className="py-2.5 px-3 text-[var(--foreground)]">#{r.id}</td>
                        <td className="py-2.5 px-3">
                          {r.documentURL ? (
                            <a
                              href={r.documentURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--primary)] hover:underline flex items-center gap-1"
                            >
                              PDF <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--foreground)]">{r.page}</td>
                        <td className="py-2.5 px-3 text-[var(--foreground)]">{r.vehicleCount}</td>
                        <td className="py-2.5 px-3 text-[var(--foreground)]">{r.auctionHouse || "-"}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.isCorrect === "exact_match"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {r.isCorrect === "exact_match" ? "Exact" : "Corrected"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--muted-foreground)]">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => toggleGolden(r.id, true)}
                            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-xs"
                          >
                            <StarOff size={14} />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <Star className="mx-auto mb-3 text-[var(--muted-foreground)]" size={40} />
              <p className="text-lg text-[var(--foreground)]">No golden records yet</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Mark reviewed invoices as &quot;Golden&quot; from the Invoice Review page to build your evaluation dataset
              </p>
            </div>
          )}
        </div>
      </Sidebar>
      <Toast id={toast.id} type={toast.type} message={toast.message}
             onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
