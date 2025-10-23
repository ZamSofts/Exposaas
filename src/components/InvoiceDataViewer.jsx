import React, { useMemo, useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import { useAuth, Error, Toast, Loader, useConfirm } from "@/hooks/wrapper";
import { ArrowLeft, ChevronLeft, ChevronRight, FileUp, Download, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { API } from "../hooks/wrapper";

export const InvoiceDataViewer = ({ data = null, onBack }) => {
  const router = useRouter();

  const { confirm, ConfirmComponent } = useConfirm();

  const [pdfPage, setPdfPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPageKey, setSelectedPageKey] = useState("page_1");
  const [selectedChassis, setSelectedChassis] = useState(null);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });
  const [chassisReviewStatus, setChassisReviewStatus] = useState({});

  const [savedPages, setSavedPages] = useState({ page_1: false, page_2: false });
  const [pageReviewStatus, setPageReviewStatus] = useState({});
  const [feedback, setFeedback] = useState("yes");
  const [editable, setEditable] = useState({ page_1: [], page_2: [] });

  const [error] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    const base = { ...(data || {}) };
    base.page_1 = Array.isArray(base.page_1)
      ? base.page_1.map(p => ({
          ...p,
          charges: (p.charges || []).map(c => ({ ...c, amount: c.amount != null ? String(c.amount) : "", isConfirm: c.isConfirm == null ? false : Boolean(c.isConfirm) })),
        }))
      : [];
    base.page_2 = Array.isArray(base.page_2)
      ? base.page_2.map(p => ({
          ...p,
          charges: (p.charges || []).map(c => ({ ...c, amount: c.amount != null ? String(c.amount) : "", isConfirm: c.isConfirm == null ? false : Boolean(c.isConfirm) })),
        }))
      : [];
    setEditable(base);
    // reset saved state and per-page review
    setSavedPages({ page_1: false, page_2: false });
    setPageReviewStatus({});
    // Default to first page and select the first chassis if present
    setSelectedPageKey("page_1");
    const firstChassis = base.page_1 && base.page_1.length > 0 ? base.page_1[0] : null;
    setSelectedChassis(firstChassis);
  }, [data]);

  const pageKeys = ["page_1", "page_2"];

  useEffect(() => {
    const list = (editable && editable[selectedPageKey]) || [];
    if (list && list.length > 0) {
      setSelectedChassis(list[0]);
    } else {
      setSelectedChassis(null);
    }
  }, [selectedPageKey, editable]);

  const goPrev = () => setPdfPage(p => Math.max(1, p - 1));
  const goNext = () => setPdfPage(p => Math.min(totalPages, p + 1));

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };
  const getPdfUrl = (url, page) => {
    if (!url) return "";
    return `${url}#page=${page}&toolbar=1&navpanes=0&scrollbar=0&view=FitH`;
  };

  useEffect(() => {
    const handleKeyDown = event => {
      if (data?.blobUrl && !pdfError) {
        if (event.key === "ArrowLeft" && pdfPage > 1) {
          event.preventDefault();
          goPrev();
        } else if (event.key === "ArrowRight" && pdfPage < totalPages) {
          event.preventDefault();
          goNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pdfPage, totalPages, data?.blobUrl, pdfError]);

  useEffect(() => {
    if (data?.blobUrl) {
      setPdfPage(1);
      setPdfError(false);
      setPdfLoading(true);

      const hasPage1 = data?.page_1 && data.page_1.length > 0;
      const hasPage2 = data?.page_2 && data.page_2.length > 0;
      const estimatedPages = hasPage2 ? 2 : hasPage1 ? 1 : 2; // Default to 2 if unsure
      setTotalPages(Math.max(1, estimatedPages));
    }
  }, [data?.blobUrl, data?.page_1, data?.page_2]);

  const handleSelectChassis = item => {
    setSelectedChassis(item);
  };

  const handleChargeChange = (chassisNum, idx, field, value) => {
    setEditable(prev => {
      const next = { ...prev, page_1: prev.page_1.map(p => ({ ...p })), page_2: prev.page_2.map(p => ({ ...p })) };
      for (const key of pageKeys) {
        next[key] = next[key].map(item => ({ ...item, charges: (item.charges || []).map(c => ({ ...c })) }));
        const found = next[key].find(p => p.chassis_number === chassisNum);
        if (found) {
          found.charges = found.charges.map((c, i) => (i === idx ? { ...c, [field]: field === "amount" ? String(value) : value } : c));
        }
      }
      return next;
    });
    setSelectedChassis(prev => (prev ? { ...prev, charges: (prev.charges || []).map(c => ({ ...c })) } : null));
    setSavedPages(prev => (prev[selectedPageKey] === true ? prev : { ...prev, [selectedPageKey]: false }));
  };

  const addCharge = chassisNum => {
    setEditable(prev => {
      const next = { ...prev, page_1: prev.page_1.map(p => ({ ...p })), page_2: prev.page_2.map(p => ({ ...p })) };
      for (const key of pageKeys) {
        next[key] = next[key].map(item => ({ ...item, charges: (item.charges || []).map(c => ({ ...c })) }));
        const found = next[key].find(p => p.chassis_number === chassisNum);
        if (found) {
          found.charges = [...(found.charges || []), { type: "", amount: "", isConfirm: false }];
        }
      }
      return next;
    });
    // update selected chassis if it's the current one
    setSelectedChassis(prev => (prev && prev.chassis_number === chassisNum ? { ...prev, charges: [...(prev.charges || []), { type: "", amount: 0, isConfirm: false }] } : prev));
    setSavedPages(prev => (prev[selectedPageKey] === true ? prev : { ...prev, [selectedPageKey]: false }));
  };

  const removeCharge = (chassisNum, idx) => {
    setEditable(prev => {
      const next = { ...prev, page_1: prev.page_1.map(p => ({ ...p })), page_2: prev.page_2.map(p => ({ ...p })) };
      for (const key of pageKeys) {
        next[key] = next[key].map(item => ({ ...item, charges: (item.charges || []).map(c => ({ ...c })) }));
        const found = next[key].find(p => p.chassis_number === chassisNum);
        if (found) {
          found.charges = found.charges.filter((_, i) => i !== idx);
        }
      }
      return next;
    });
    setSelectedChassis(prev => (prev && prev.chassis_number === chassisNum ? { ...prev, charges: (prev.charges || []).filter((_, i) => i !== idx) } : prev));
    setSavedPages(prev => (prev[selectedPageKey] === true ? prev : { ...prev, [selectedPageKey]: false }));
  };

  const chassisByPage = {
    page_1: editable.page_1 || [],
    page_2: editable.page_2 || [],
  };

  const selectedPageList = chassisByPage[selectedPageKey] || [];
  const selectedIndexInPage = selectedChassis ? selectedPageList.findIndex(p => p.chassis_number === selectedChassis.chassis_number) : -1;

  const goToPrevChassis = () => {
    if (selectedIndexInPage > 0) {
      handleSelectChassis(selectedPageList[selectedIndexInPage - 1]);
    }
  };

  const goToNextChassis = () => {
    if (selectedIndexInPage < selectedPageList.length - 1) {
      handleSelectChassis(selectedPageList[selectedIndexInPage + 1]);
    }
  };

  const saveCurrentPage = async () => {
    // compute page number and chassis count for a friendly confirmation
    const pageNum = (() => {
      const parts = String(selectedPageKey || "page_1").split("_");
      const n = parseInt(parts[1], 10);
      return isNaN(n) ? 1 : n;
    })();
    const chassisCount = (chassisByPage[selectedPageKey] || []).length;

    const confirmed = await confirm({
      title: `Save Page ${pageNum}`,
      message: `You're about to save page ${pageNum}. This will record ${chassisCount} chassis item${chassisCount === 1 ? "" : "s"} for review. Do you want to continue?`,
      confirmText: "Save",
      cancelText: "Cancel",
      type: "primary",
    });
    if (!confirmed) return;

    const normalizePage = pageArr =>
      (pageArr || []).map(p => ({
        chassis_number: p.chassis_number,
        charges: (p.charges || []).map(c => ({
          type: c.type,
          amount: c.amount === "" ? null : isNaN(Number(c.amount)) ? c.amount : Number(c.amount),
          isConfirm: c.isConfirm == null ? false : Boolean(c.isConfirm),
        })),
        // preserve any other fields but place them after the expected keys
        ...Object.keys(p).reduce((acc, key) => {
          if (key !== "chassis_number" && key !== "charges") acc[key] = p[key];
          return acc;
        }, {}),
      }));

    const normalizedPage1 = normalizePage(editable.page_1);
    const normalizedPage2 = normalizePage(editable.page_2);
    const pageJson = selectedPageKey === "page_1" ? { page_1: normalizedPage1 } : { page_2: normalizedPage2 };

    const body = {
      Page: pageNum,
      Json: pageJson,
      isCorrect: feedback,
      CompanyID: data?.companyId || null,
      DocumentURL: data?.blobUrl || null,
      invoiceJobId: data?.id || null,
    };
    console.log("Saving page data", body);
    try {
      setIsLoading(true);
      const res = await API("PUT", "paymentConfirmation", body);
      if (!res || !res.ok) {
        showToast("Error saving page", "error");
        return;
      }
      setSavedPages(prev => {
        const next = { ...prev, [selectedPageKey]: true };
        const allSaved = pageKeys.every(k => next[k] === true);
        // call onBack shortly after state update so parent can react
        if (allSaved) {
          setTimeout(() => {
            if (typeof onBack === "function") onBack();
          }, 200);
        }
        return next;
      });
      showToast("Page saved", "success");
      setFeedback("yes");
    } catch (err) {
      console.error("Page save error", err);
      showToast("Error saving page", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = error ? (typeof error === "string" ? error : error && error.message ? error.message : String(error)) : "";

  return (
    <>
      <Head>
        <title>{data ? "View Invoice" : "No Invoice Selected"} - ExpoSaaS</title>
      </Head>

      <div className="p-6 bg-[var(--background)] min-h-screen">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] transition-all duration-200 shadow-sm hover:shadow">
              <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
            </button>

            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-1">Invoice Review</h1>
              <p className="text-sm text-[var(--secondary-foreground)]">Inspect uploaded PDF and validate parsed data</p>
            </div>
          </div>
        </div>

        <Error message={displayError} />

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {/* Left: PDF viewer */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 md:p-6 min-h-[420px] md:min-h-[600px] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                  <FileUp className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <span className="font-semibold text-[var(--foreground)]">Invoice Document</span>
                  <p className="text-xs text-[var(--secondary-foreground)] mt-0.5">{data?.blobUrl ? "PDF loaded successfully" : "No PDF available"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* PDF Page Navigation */}

                {/* Action Buttons */}
                {pdfError && (
                  <button
                    onClick={() => {
                      setPdfError(false);
                      setPdfLoading(true);
                    }}
                    className="p-2 bg-[var(--warning)]/10 hover:bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30 rounded-lg transition-colors"
                    title="Retry loading PDF"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* PDF viewer area: using proven iframe approach from FilePreviewer */}
            <div className="h-[420px] md:h-[560px] bg-white border border-[var(--border)] rounded-lg overflow-hidden shadow-inner relative">
              {data?.blobUrl ? (
                <>
                  {/* Loading overlay */}
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 p-4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)]"></div>
                        <p className="text-[var(--secondary-foreground)]">Loading PDF...</p>
                      </div>
                    </div>
                  )}

                  {/* Error state */}
                  {pdfError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10 p-4">
                      <div className="text-center p-4 md:p-8">
                        <FileUp className="w-16 h-16 mx-auto mb-4 text-red-400" />
                        <h3 className="text-lg font-medium text-red-900 mb-2">PDF Loading Failed</h3>
                        <p className="text-sm text-red-700 mb-4">Unable to load the PDF document. Please try again or use the download option.</p>
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={() => {
                              setPdfError(false);
                              setPdfLoading(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                          </button>
                          <button onClick={() => window.open(data.blobUrl, "_blank")} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                            Open in New Tab
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PDF iframe - controlled page navigation */}
                  <iframe
                    key={pdfPage} // Force re-render when page changes
                    src={getPdfUrl(data.blobUrl, pdfPage)}
                    className="w-full h-full border-0 min-h-[320px] md:min-h-[540px]"
                    style={{ display: "block" }}
                    title={`Invoice PDF - Page ${pdfPage}`}
                    onLoad={() => {
                      setPdfLoading(false);
                      setPdfError(false);

                      if (totalPages === 1) {
                        setTotalPages(2);
                      }
                    }}
                    onError={() => {
                      setPdfLoading(false);
                      setPdfError(true);
                    }}
                  />
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center bg-[var(--background)]/20 p-8">
                  <div className="max-w-sm">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[var(--secondary)] rounded-full flex items-center justify-center">
                      <FileUp className="w-8 h-8 text-[var(--secondary-foreground)]" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No PDF Available</h3>
                    <p className="text-sm text-[var(--secondary-foreground)]">The PDF document will appear here once uploaded and processed.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: parsed data, tabs and editable table */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 md:p-6 flex flex-col shadow-sm max-h-[calc(100vh-160px)] md:max-h-[1000px] overflow-hidden">
            <div className="mb-4 sticky top-4 bg-[var(--surface)] z-10">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Parsed Data</h2>
              <div className="flex items-center gap-1 bg-[var(--background)] p-1 rounded-lg">
                {pageKeys.map(key => {
                  const pageData = editable[key] || [];
                  const pageCount = pageData.length;
                  return (
                    <button
                      key={key}
                      onMouseDown={e => {
                        // Prevent mouse interactions that would switch pages when current page is dirty
                        if (savedPages[selectedPageKey] !== true && selectedPageKey !== key) {
                          e.preventDefault();
                          showToast("Please save the current page before switching pages.", "error");
                          return;
                        }
                      }}
                      onClick={() => {
                        // Prevent switching pages if current page has unsaved changes (strict check)
                        if (savedPages[selectedPageKey] !== true && selectedPageKey !== key) {
                          showToast("Please save the current page before switching pages.", "error");
                          return;
                        }
                        setSelectedPageKey(key);
                      }}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        selectedPageKey === key
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                          : "text-[var(--secondary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <div>{key.replace("_", " ").toUpperCase()}</div>
                      <div className="text-xs opacity-75 mt-0.5">{pageCount} chassis</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-auto px-0 py-3">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-[var(--foreground)]">Chassis Numbers</div>
                  <div className="text-xs text-[var(--secondary-foreground)]">{chassisByPage[selectedPageKey].length} items</div>
                </div>
                <div className="flex gap-2 justify-between flex-wrap">
                  {chassisByPage[selectedPageKey].length === 0 && (
                    <div className="text-sm text-[var(--secondary-foreground)] bg-[var(--background)] p-3 rounded-lg border border-dashed border-[var(--border)] w-full text-center">
                      No chassis found on this page
                    </div>
                  )}

                  <div>
                    {chassisByPage[selectedPageKey].map(item => {
                      const isSelected = selectedChassis && selectedChassis.chassis_number === item.chassis_number;
                      const isReviewed = chassisReviewStatus[item.chassis_number];
                      return (
                        <>
                          <button
                            key={item.chassis_number}
                            onClick={() => handleSelectChassis(item)}
                            className={`relative px-4 py-2 m-1 border rounded-lg text-xs font-medium transition-all duration-200 min-w-[120px] ${
                              isSelected
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-md scale-105"
                                : "bg-[var(--background)] text-[var(--secondary-foreground)] border-[var(--border)] hover:bg-[var(--secondary)] hover:border-[var(--primary)]/30 hover:shadow-sm"
                            }`}
                          >
                            <span>{item.chassis_number}</span>
                          </button>
                        </>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 align-middle mt-2 justify-end w-full">
                  <button onClick={goToPrevChassis} disabled={selectedIndexInPage <= 0} className="px-3 py-2 bg-[var(--surface)] border w-20 border-[var(--border)] rounded-md">
                    Previous
                  </button>
                  <button
                    onClick={goToNextChassis}
                    disabled={selectedIndexInPage < 0 || selectedIndexInPage >= selectedPageList.length - 1}
                    className="px-3 w-20 py-2 bg-[var(--primary)] border border-[var(--border)] rounded-md"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Editable table for selected chassis */}
              {selectedChassis ? (
                <div className="bg-[var(--background)]  p-4 md:p-6 rounded border flex flex-col">
                  <div className="flex items-center justify-between  ">
                    <div className="font-medium">{selectedChassis.chassis_number}</div>

                    <div className="text-sm text-[var(--secondary-foreground)]">Edit charges</div>
                  </div>

                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm mb-4 border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)] bg-[var(--secondary)]/20">Charge Type</th>
                          <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)] bg-[var(--secondary)]/20">Amount</th>
                          <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)] bg-[var(--secondary)]/20 w-20">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allPages = [...(editable.page_1 || []), ...(editable.page_2 || [])];
                          const currentChassis = allPages.find(p => p.chassis_number === selectedChassis?.chassis_number) || selectedChassis;
                          return (currentChassis?.charges || []).map((c, i) => (
                            <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--secondary)]/10 transition-colors">
                              <td className="py-3 px-2">
                                <input
                                  value={c.type || ""}
                                  onChange={e => handleChargeChange(currentChassis.chassis_number, i, "type", e.target.value)}
                                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                                  placeholder="Enter charge type"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  // keep as text-friendly value; numeric keyboard allowed via input config
                                  value={c.amount ?? ""}
                                  onChange={e => handleChargeChange(currentChassis.chassis_number, i, "amount", e.target.value)}
                                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => removeCharge(currentChassis.chassis_number, i)} className="text-xs text-red-600 hover:underline">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ));
                        })()}

                        {(() => {
                          const allPages = [...(editable.page_1 || []), ...(editable.page_2 || [])];
                          const currentChassis = allPages.find(p => p.chassis_number === selectedChassis?.chassis_number) || selectedChassis;
                          if (!currentChassis || !currentChassis.charges || currentChassis.charges.length === 0) {
                            return (
                              <tr>
                                <td colSpan="3" className="py-8 text-center text-[var(--secondary-foreground)]">
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 bg-[var(--secondary)] rounded-full flex items-center justify-center">
                                      <span className="text-xs">💰</span>
                                    </div>
                                    <p>No charges found for this chassis</p>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return null;
                        })()}

                        <tr>
                          <td colSpan="3" className="py-3 px-2 text-right">
                            <button onClick={() => addCharge(selectedChassis.chassis_number)} className="px-3 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm">
                              + Add Charge
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 p-3 md:p-4 bg-[var(--background)] rounded-lg border border-[var(--border)] sticky bottom-0 bg-opacity-90 backdrop-blur-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-medium">Was this data correct?</div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                name={`page-review-${selectedPageKey}`}
                                checked={feedback === "yes"}
                                onChange={() => {
                                  setFeedback("yes");
                                  setSavedPages(prev => (prev[selectedPageKey] === true ? prev : { ...prev, [selectedPageKey]: false }));
                                }}
                              />
                              <span className="text-[var(--success)] ml-1">Yes</span>
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                name={`page-review-${selectedPageKey}`}
                                checked={feedback === "no"}
                                onChange={() => {
                                  setFeedback("no");
                                  setSavedPages(prev => (prev[selectedPageKey] === true ? prev : { ...prev, [selectedPageKey]: false }));
                                }}
                              />
                              <span className="text-[var(--warning)] ml-1">No</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveCurrentPage}
                            disabled={isLoading || (chassisByPage[selectedPageKey] || []).length === 0 || savedPages[selectedPageKey] === true}
                            title={savedPages[selectedPageKey] === true ? "This page is saved" : undefined}
                            className={`px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md transition-opacity duration-200 ${
                              isLoading ? "opacity-50 cursor-not-allowed" : ""
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {savedPages[selectedPageKey] === true ? "Saved" : isLoading ? "Saving..." : "Save Page"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--secondary-foreground)]">Select a chassis to see and edit charges.</div>
              )}
            </div>
          </div>
        </div>
        <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
      </div>
      <ConfirmComponent />
    </>
  );
};
