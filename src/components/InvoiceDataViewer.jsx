import React, { useMemo, useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import { useAuth, API, Error, Toast, Loader, useConfirm } from "@/hooks/wrapper";
import { ArrowLeft, FileUp, ExternalLink, RefreshCw, Trash2, Car, Check, AlertTriangle } from "lucide-react";

export const InvoiceDataViewer = ({ data = null, onBack }) => {
  const router = useRouter();
 console.log("received data from invoicejob page",data)
  const { confirm, ConfirmComponent } = useConfirm();

  const [pdfPage, setPdfPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPageKey, setSelectedPageKey] = useState("page_1");
  const [selectedChassis, setSelectedChassis] = useState(null);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });
  const [chassisReviewStatus, setChassisReviewStatus] = useState({});

  const [savedPages, setSavedPages] = useState({});
  const [pageReviewStatus, setPageReviewStatus] = useState({});
  const [feedback, setFeedback] = useState("yes");
  const [editable, setEditable] = useState({});

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  // Create Vehicles Modal state
  const [showCreateVehiclesModal, setShowCreateVehiclesModal] = useState(false);
  const [createVehiclesLoading, setCreateVehiclesLoading] = useState(false);
  const [vehiclesToCreate, setVehiclesToCreate] = useState([]);

  useEffect(() => {
    // Build editable object from incoming data, normalizing charges
    const base = {};
    const keys = [];
    if (data && typeof data === "object") {
      Object.keys(data).forEach(k => {
        if (k && k.startsWith("page_")) keys.push(k);
      });
    }
    // ensure at least two pages exist for UI fallback
    if (keys.length === 0) {
      keys.push("page_1", "page_2");
    }

    keys.forEach(key => {
      base[key] = Array.isArray(data?.[key])
        ? data[key].map(p => ({
            ...p,
            charges: (p.charges || []).map(c => ({
              ...c,
              amount: c.amount != null ? String(c.amount) : "",
              isConfirm: c.isConfirm == null ? false : Boolean(c.isConfirm),
            })),
          }))
        : [];
    });

    setEditable(base);
    // reset saved state and per-page review
    const savedInit = {};
    keys.forEach(k => (savedInit[k] = false));
    setSavedPages(savedInit);
    setPageReviewStatus({});
    // Default to first page and select the first chassis if present
    setSelectedPageKey(keys[0] || "page_1");
    const firstChassis = base[keys[0]] && base[keys[0]].length > 0 ? base[keys[0]][0] : null;
    setSelectedChassis(firstChassis);
  }, [data]);

  const pageKeys = useMemo(() => {
    const keys = new Set();
    if (data && typeof data === "object") {
      Object.keys(data).forEach(k => {
        if (k && k.startsWith("page_")) keys.add(k);
      });
    }
    // also include keys from editable state (in case data is empty but editable populated)
    Object.keys(editable || {}).forEach(k => {
      if (k && k.startsWith("page_")) keys.add(k);
    });
    if (keys.size === 0) {
      keys.add("page_1");
      keys.add("page_2");
    }
    return Array.from(keys).sort((a, b) => {
      const na = parseInt((a.split("_")[1] || "0"), 10) || 0;
      const nb = parseInt((b.split("_")[1] || "0"), 10) || 0;
      return na - nb;
    });
  }, [data, editable]);

  useEffect(() => {
    const list = (editable && editable[selectedPageKey]) || [];
    if (list && list.length > 0) {
      // Try to preserve current selection when editable changes.
      setSelectedChassis(prev => {
        if (prev) {
          // If previous selected chassis still exists (match by chassis_number), keep it.
          const found = list.find(p => p.chassis_number === prev.chassis_number);
          if (found) return found;
        }
        // Otherwise default to first chassis on the page
        return list[0];
      });
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
    }
  }, [data?.blobUrl]);

  // Update total pages separately when pageKeys changes (without reloading PDF)
  useEffect(() => {
    if (pageKeys.length > 0) {
      setTotalPages(Math.max(1, pageKeys.length));
    }
  }, [pageKeys.length]);

  const handleSelectChassis = item => {
    setSelectedChassis(item);
  };

  const handleChargeChange = (chassisNum, idx, field, value) => {
    setEditable(prev => {
      const next = { ...prev };
      // ensure each known page key exists and is shallow-copied
      for (const key of pageKeys) {
        next[key] = (prev?.[key] || []).map(p => ({ ...p }));
      }
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

  const handleFieldChange = (chassisNum, field, value) => {
    setEditable(prev => {
      const next = { ...prev };
      for (const key of pageKeys) {
        next[key] = (prev?.[key] || []).map(p => ({ ...p }));
      }
      for (const key of pageKeys) {
        next[key] = next[key].map(item => ({ ...item, charges: (item.charges || []).map(c => ({ ...c })) }));
        const foundIdx = next[key].findIndex(p => p.chassis_number === chassisNum);
        if (foundIdx !== -1) {
          // update field
          next[key][foundIdx] = { ...next[key][foundIdx], [field]: value };
          // if chassis_number changed, keep selection in sync
          if (field === "chassis_number") {
            setSelectedChassis({ ...next[key][foundIdx] });
          }
        }
      }
      return next;
    });
    // if editing other fields, update selectedChassis too
    if (field !== "chassis_number") {
      setSelectedChassis(prev => (prev ? { ...prev, [field]: value } : prev));
    }
    setSavedPages(prev => (prev[selectedPageKey] === true ? prev : { ...prev, [selectedPageKey]: false }));
  };

  const addCharge = chassisNum => {
    setEditable(prev => {
      const next = { ...prev };
      for (const key of pageKeys) {
        next[key] = (prev?.[key] || []).map(p => ({ ...p }));
      }
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
      const next = { ...prev };
      for (const key of pageKeys) {
        next[key] = (prev?.[key] || []).map(p => ({ ...p }));
      }
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

  const chassisByPage = useMemo(() => {
    const map = {};
    for (const key of pageKeys) {
      map[key] = editable?.[key] || [];
    }
    return map;
  }, [editable, pageKeys]);

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

  const normalizedPage = normalizePage(editable[selectedPageKey]);
  const pageJson = { [selectedPageKey]: normalizedPage };

    const body = {
      Page: pageNum,
      Json: pageJson,
      isCorrect: feedback,
      CompanyID: data?.companyId || null,
      DocumentURL: data?.blobUrl || null,
      invoiceJobId: data?.id || null,
    };
    try {
      setIsLoading(true);
      const res = await API("PUT", "paymentConfirmation", body);

      if (res.error) {
        setError(res.error);
        showToast(res.error, "error");
        return;
      }

      setSavedPages(prev => {
        const next = { ...prev, [selectedPageKey]: true };
        const allSaved = pageKeys.every(k => next[k] === true);
        if (allSaved) {
          // All pages saved - prepare vehicles data and show modal
          prepareVehiclesForCreation();
        }
        return next;
      });
      showToast(res.message, "success");
      setFeedback("yes");
    } catch (err) {
      console.error("Page save error", err);
      showToast("Error saving page", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare all vehicles from all pages for the Create Vehicles modal
  const prepareVehiclesForCreation = () => {
    const allVehicles = [];
    for (const key of pageKeys) {
      const pageData = editable[key] || [];
      for (const item of pageData) {
        if (item.chassis_number) {
          allVehicles.push({
            chassis_number: item.chassis_number,
            brand: item.brand || "",
            auction: item.auction || "",
            lot_number: item.lot_number || "",
            charges: item.charges || [],
          });
        }
      }
    }
    setVehiclesToCreate(allVehicles);
    if (allVehicles.length > 0) {
      setShowCreateVehiclesModal(true);
    } else {
      // No vehicles to create, just go back
      if (typeof onBack === "function") onBack();
    }
  };

  // Calculate total cost from charges array
  const calculateVehicleTotalCost = (charges) => {
    if (!Array.isArray(charges)) return 0;
    return charges.reduce((sum, c) => {
      const amount = parseFloat(c.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  // Format currency for display
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return `¥${num.toLocaleString()}`;
  };

  // Create vehicles from invoice
  const handleCreateVehicles = async () => {
    if (!data?.id || vehiclesToCreate.length === 0) return;

    setCreateVehiclesLoading(true);
    try {
      const res = await API("POST", "createVehiclesFromInvoice", {
        invoiceJobId: data.id,
        vehicles: vehiclesToCreate,
      });

      if (res.error) {
        showToast(res.error, "error");
        return;
      }

      showToast(res.message, "success");
      setShowCreateVehiclesModal(false);

      // Go back after a short delay
      setTimeout(() => {
        if (typeof onBack === "function") onBack();
      }, 500);
    } catch (err) {
      console.error("Create vehicles error", err);
      showToast("Error creating vehicles", "error");
    } finally {
      setCreateVehiclesLoading(false);
    }
  };

  // Skip creating vehicles and just go back
  const handleSkipCreateVehicles = () => {
    setShowCreateVehiclesModal(false);
    if (typeof onBack === "function") onBack();
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
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 md:p-6  min-h-[620px] md:min-h-[700px] shadow-sm self-start sticky top-4 z-10 max-h-[calc(100vh-160px)]">
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
            <div className="h-[420px]  md:h-[560px] bg-white border border-[var(--border)] rounded-lg overflow-hidden shadow-inner relative">
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
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 md:p-6 flex flex-col shadow-sm max-h-[calc(100vh-160px)] md:max-h-[1000px] overflow-auto">
            <div className="mb-4 sticky top-4 bg-[var(--surface)] z-10">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Parsed Data</h2>
              <div className="flex  items-center gap-1 bg-[var(--background)] p-1 rounded-lg">
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

                  {/* Editable chassis-level fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-[var(--secondary-foreground)]">Chassis Number</label>
                      <input
                        value={selectedChassis.chassis_number || ""}
                        onChange={e => handleFieldChange(selectedChassis.chassis_number, "chassis_number", e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--secondary-foreground)]">Brand</label>
                      <input
                        value={selectedChassis.brand || ""}
                        onChange={e => handleFieldChange(selectedChassis.chassis_number, "brand", e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--secondary-foreground)]">Lot Number</label>
                      <input
                        value={selectedChassis.lot_number || ""}
                        onChange={e => handleFieldChange(selectedChassis.chassis_number, "lot_number", e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--secondary-foreground)]">Auction</label>
                      <input
                        value={selectedChassis.auction || ""}
                        onChange={e => handleFieldChange(selectedChassis.chassis_number, "auction", e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                      />
                    </div>
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
                          const allPages = pageKeys.reduce((acc, k) => acc.concat(editable?.[k] || []), []);
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
                          const allPages = pageKeys.reduce((acc, k) => acc.concat(editable?.[k] || []), []);
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

      {/* Create Vehicles Modal */}
      {showCreateVehiclesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                <Car className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">Create Vehicles from Invoice</h3>
                <p className="text-sm text-[var(--secondary-foreground)]">
                  {vehiclesToCreate.length} vehicle{vehiclesToCreate.length !== 1 ? "s" : ""} found in this invoice
                </p>
              </div>
            </div>

            {/* Vehicle List */}
            <div className="flex-1 overflow-auto mb-4 border border-[var(--border)] rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-[var(--secondary)] sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Chassis Number</th>
                    <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Brand</th>
                    <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Auction</th>
                    <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Lot #</th>
                    <th className="text-right py-3 px-4 font-semibold text-[var(--foreground)]">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiclesToCreate.map((v, idx) => (
                    <tr key={idx} className="border-t border-[var(--border)] hover:bg-[var(--secondary)]/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-[var(--primary)]" />
                          <span className="font-medium text-[var(--foreground)]">{v.chassis_number}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--foreground)]">{v.brand || "-"}</td>
                      <td className="py-3 px-4 text-[var(--foreground)]">{v.auction || "-"}</td>
                      <td className="py-3 px-4 text-[var(--foreground)]">{v.lot_number || "-"}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--primary)]">
                        {formatCurrency(calculateVehicleTotalCost(v.charges))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Info Box */}
            <div className="mb-4 p-3 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--foreground)]">
                <p className="font-medium">What will happen:</p>
                <ul className="mt-1 space-y-1 text-[var(--secondary-foreground)]">
                  <li>• New vehicles will be created with charges from this invoice</li>
                  <li>• Existing vehicles (same chassis) will be updated with new charge data</li>
                  <li>• Invoice PDF will be linked to each vehicle</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleSkipCreateVehicles}
                disabled={createVehiclesLoading}
                className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
              >
                Skip
              </button>
              <button
                onClick={handleCreateVehicles}
                disabled={createVehiclesLoading || vehiclesToCreate.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
              >
                {createVehiclesLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create {vehiclesToCreate.length} Vehicle{vehiclesToCreate.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmComponent />
    </>
  );
};
