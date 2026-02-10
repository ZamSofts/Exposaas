import React, { useMemo, useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth,API,useConfirm, Error, CustomSelect, CustomButton,DataTable, Loader, Toast, FilePreviewer } from "@/hooks/wrapper";
import { ArrowLeft, FileUp, ExternalLink, RefreshCw, Trash2, Car, Check, AlertTriangle, FileText } from "lucide-react";

export const InvoiceDataViewer = ({ data = null, onBack }) => {
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  // Get vehicles from data - supports both new and legacy formats
  const vehicles = useMemo(() => {
    if (!data) return [];
    // New format: { items: [...] }
    if (Array.isArray(data.items)) return data.items;
    // Legacy format: { page_1: [...], page_2: [...] }
    const allVehicles = [];
    for (const key of Object.keys(data)) {
      if (key.startsWith('page_') && Array.isArray(data[key])) {
        allVehicles.push(...data[key]);
      }
    }
    return allVehicles;
  }, [data]);

  // Page info for display
  const pageInfo = useMemo(() => {
    if (data?.pageNumber && data?.originalTotalPages) {
      return `Page ${data.pageNumber} of ${data.originalTotalPages}`;
    }
    return "Invoice Review";
  }, [data?.pageNumber, data?.originalTotalPages]);

  const [selectedChassis, setSelectedChassis] = useState(null);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  const [feedback, setFeedback] = useState("yes");
  const [editable, setEditable] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  // Create Vehicles Modal state
  const [showCreateVehiclesModal, setShowCreateVehiclesModal] = useState(false);
  const [createVehiclesLoading, setCreateVehiclesLoading] = useState(false);
  const [vehiclesToCreate, setVehiclesToCreate] = useState([]);

  // Initialize editable data on mount
  useEffect(() => {
    if (vehicles.length > 0) {
      const normalized = vehicles.map(p => ({
        ...p,
        charges: (p.charges || []).map(c => ({
          ...c,
          amount: c.amount != null ? String(c.amount) : "",
          isConfirm: c.isConfirm == null ? false : Boolean(c.isConfirm),
        })),
      }));
      setEditable(normalized);
      setHasChanges(false);
      // Select first chassis
      if (normalized.length > 0) {
        setSelectedChassis(normalized[0]);
      } else {
        setSelectedChassis(null);
      }
    } else {
      setEditable([]);
      setSelectedChassis(null);
      setHasChanges(false);
    }
  }, [vehicles]);

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  const getPdfUrl = (url) => {
    if (!url) return "";
    // Single page PDF - no page parameter needed
    return `${url}#toolbar=1&navpanes=0&scrollbar=0&view=FitH`;
  };

  useEffect(() => {
    if (data?.blobUrl) {
      setPdfError(false);
      setPdfLoading(true);
    }
  }, [data?.blobUrl]);

  const handleSelectChassis = item => {
    setSelectedChassis(item);
  };

  const handleChargeChange = (chassisNum, idx, field, value) => {
    setEditable(prev => {
      return prev.map(item => {
        if (item.chassis_number !== chassisNum) return item;
        return {
          ...item,
          charges: item.charges.map((c, i) =>
            i === idx ? { ...c, [field]: field === "amount" ? String(value) : value } : c
          ),
        };
      });
    });
    setHasChanges(true);
    // Update selectedChassis if it's the current one
    setSelectedChassis(prev => {
      if (prev && prev.chassis_number === chassisNum) {
        const updated = editable.find(p => p.chassis_number === chassisNum);
        if (updated) {
          return {
            ...updated,
            charges: updated.charges.map((c, i) =>
              i === idx ? { ...c, [field]: field === "amount" ? String(value) : value } : c
            ),
          };
        }
      }
      return prev;
    });
  };

  const handleFieldChange = (chassisNum, field, value) => {
    setEditable(prev => {
      return prev.map(item => {
        if (item.chassis_number !== chassisNum) return item;
        return { ...item, [field]: value };
      });
    });
    setHasChanges(true);
    if (field === "chassis_number") {
      setSelectedChassis(prev => (prev ? { ...prev, [field]: value } : prev));
    } else {
      setSelectedChassis(prev => (prev && prev.chassis_number === chassisNum ? { ...prev, [field]: value } : prev));
    }
  };

  const addCharge = chassisNum => {
    setEditable(prev => {
      return prev.map(item => {
        if (item.chassis_number !== chassisNum) return item;
        return {
          ...item,
          charges: [...(item.charges || []), { type: "", amount: "", isConfirm: false }],
        };
      });
    });
    setHasChanges(true);
    setSelectedChassis(prev =>
      prev && prev.chassis_number === chassisNum
        ? { ...prev, charges: [...(prev.charges || []), { type: "", amount: "", isConfirm: false }] }
        : prev
    );
  };

  const removeCharge = (chassisNum, idx) => {
    setEditable(prev => {
      return prev.map(item => {
        if (item.chassis_number !== chassisNum) return item;
        return {
          ...item,
          charges: item.charges.filter((_, i) => i !== idx),
        };
      });
    });
    setHasChanges(true);
    setSelectedChassis(prev =>
      prev && prev.chassis_number === chassisNum
        ? { ...prev, charges: (prev.charges || []).filter((_, i) => i !== idx) }
        : prev
    );
  };

  const selectedIndexInPage = selectedChassis ? editable.findIndex(p => p.chassis_number === selectedChassis.chassis_number) : -1;

  const goToPrevChassis = () => {
    if (selectedIndexInPage > 0) {
      handleSelectChassis(editable[selectedIndexInPage - 1]);
    }
  };

  const goToNextChassis = () => {
    if (selectedIndexInPage < editable.length - 1) {
      handleSelectChassis(editable[selectedIndexInPage + 1]);
    }
  };

  const saveCurrentPage = async () => {
    const pageNum = data?.pageNumber || 1;
    const chassisCount = editable.length;

    const confirmed = await confirm({
      title: `Save Review`,
      message: `You're about to save this review. This will record ${chassisCount} chassis item${chassisCount === 1 ? "" : "s"}. Do you want to continue?`,
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
        ...Object.keys(p).reduce((acc, key) => {
          if (key !== "chassis_number" && key !== "charges") acc[key] = p[key];
          return acc;
        }, {}),
      }));

    const normalizedPage = normalizePage(editable);
    const pageKey = `page_${pageNum}`;
    const pageJson = { [pageKey]: normalizedPage };

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

      showToast(res.message || "Review saved successfully", "success");
      setFeedback("yes");
      setHasChanges(false);

      // Show create vehicles modal
      prepareVehiclesForCreation();
    } catch (err) {
      console.error("Save error", err);
      showToast("Error saving review", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const prepareVehiclesForCreation = () => {
    const allVehicles = [];
    for (const item of editable) {
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
    setVehiclesToCreate(allVehicles);
    if (allVehicles.length > 0) {
      setShowCreateVehiclesModal(true);
    } else {
      if (typeof onBack === "function") onBack();
    }
  };

  const calculateVehicleTotalCost = charges => {
    if (!Array.isArray(charges)) return 0;
    return charges.reduce((sum, c) => {
      const amount = parseFloat(c.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  const formatCurrency = value => {
    if (value === null || value === undefined) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return `¥${num.toLocaleString()}`;
  };

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
              <p className="text-sm text-[var(--secondary-foreground)]">
                {pageInfo} • {editable.length} vehicles
              </p>
            </div>
          </div>
        </div>

        <Error message={displayError} />

        {editable.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-8 text-center">
            <FileUp className="w-16 h-16 mx-auto mb-4 text-[var(--secondary-foreground)]" />
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No Data Found</h3>
            <p className="text-sm text-[var(--secondary-foreground)]">This page has no extracted vehicle data.</p>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md"
            >
              Back to List
            </button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {/* Left: PDF viewer */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 md:p-6 min-h-[620px] md:min-h-[700px] shadow-sm self-start sticky top-4 z-10 max-h-[calc(100vh-160px)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                    <FileText className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">{pageInfo}</span>
                    <p className="text-xs text-[var(--secondary-foreground)] mt-0.5">
                      {editable.length} vehicles extracted
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-[420px] md:h-[560px] bg-white border border-[var(--border)] rounded-lg overflow-hidden shadow-inner relative">
                {data?.blobUrl ? (
                  <>
                    {pdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 p-4">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)]"></div>
                          <p className="text-[var(--secondary-foreground)]">Loading PDF...</p>
                        </div>
                      </div>
                    )}

                    {pdfError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10 p-4">
                        <div className="text-center p-4 md:p-8">
                          <FileUp className="w-16 h-16 mx-auto mb-4 text-red-400" />
                          <h3 className="text-lg font-medium text-red-900 mb-2">PDF Loading Failed</h3>
                          <p className="text-sm text-red-700 mb-4">Unable to load the PDF document.</p>
                          <button
                            onClick={() => {
                              setPdfError(false);
                              setPdfLoading(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors mx-auto"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}

                    <iframe
                      src={getPdfUrl(data.blobUrl)}
                      className="w-full h-full border-0 min-h-[320px] md:min-h-[540px]"
                      style={{ display: "block" }}
                      title="Invoice PDF"
                      onLoad={() => {
                        setPdfLoading(false);
                        setPdfError(false);
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

            {/* Right: parsed data */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 md:p-6 flex flex-col shadow-sm max-h-[calc(100vh-160px)] md:max-h-[1000px] overflow-auto">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Extracted Data</h2>
                <p className="text-sm text-[var(--secondary-foreground)]">{editable.length} vehicles on this page</p>
              </div>

              <div className="flex-1 overflow-auto px-0 py-3">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-[var(--foreground)]">Chassis Numbers</div>
                    <div className="text-xs text-[var(--secondary-foreground)]">{editable.length} items</div>
                  </div>
                  <div className="flex gap-2 justify-between flex-wrap">
                    {editable.length === 0 && (
                      <div className="text-sm text-[var(--secondary-foreground)] bg-[var(--background)] p-3 rounded-lg border border-dashed border-[var(--border)] w-full text-center">
                        No chassis found on this page
                      </div>
                    )}

                    <div>
                      {editable.map(item => {
                        const isSelected = selectedChassis && selectedChassis.chassis_number === item.chassis_number;
                        return (
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
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 align-middle mt-2 justify-end w-full">
                    <button onClick={goToPrevChassis} disabled={selectedIndexInPage <= 0} className="px-3 py-2 bg-[var(--surface)] border w-20 border-[var(--border)] rounded-md disabled:opacity-50">
                      Previous
                    </button>
                    <button
                      onClick={goToNextChassis}
                      disabled={selectedIndexInPage < 0 || selectedIndexInPage >= editable.length - 1}
                      className="px-3 w-20 py-2 bg-[var(--primary)] border border-[var(--border)] rounded-md disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Editable table for selected chassis */}
                {selectedChassis ? (
                  <div className="bg-[var(--background)] p-4 md:p-6 rounded border flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selectedChassis.chassis_number}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Edit charges</div>
                    </div>

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
                          {(selectedChassis.charges || []).map((c, i) => (
                            <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--secondary)]/10 transition-colors">
                              <td className="py-3 px-2">
                                <input
                                  value={c.type || ""}
                                  onChange={e => handleChargeChange(selectedChassis.chassis_number, i, "type", e.target.value)}
                                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                                  placeholder="Enter charge type"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  value={c.amount ?? ""}
                                  onChange={e => handleChargeChange(selectedChassis.chassis_number, i, "amount", e.target.value)}
                                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <button onClick={() => removeCharge(selectedChassis.chassis_number, i)} className="text-xs text-red-600 hover:underline">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {(!selectedChassis.charges || selectedChassis.charges.length === 0) && (
                            <tr>
                              <td colSpan="3" className="py-8 text-center text-[var(--secondary-foreground)]">
                                <div className="flex flex-col items-center gap-2">
                                  <div className="w-8 h-8 bg-[var(--secondary)] rounded-full flex items-center justify-center">
                                    <span className="text-xs">$</span>
                                  </div>
                                  <p>No charges found for this chassis</p>
                                </div>
                              </td>
                            </tr>
                          )}

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
                                <input type="radio" name="page-review" checked={feedback === "yes"} onChange={() => setFeedback("yes")} />
                                <span className="text-[var(--success)] ml-1">Yes</span>
                              </label>
                              <label className="flex items-center gap-1 text-sm">
                                <input type="radio" name="page-review" checked={feedback === "no"} onChange={() => setFeedback("no")} />
                                <span className="text-[var(--warning)] ml-1">No</span>
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={saveCurrentPage}
                              disabled={isLoading || editable.length === 0}
                              className={`px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md transition-opacity duration-200 ${
                                isLoading ? "opacity-50 cursor-not-allowed" : ""
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              {isLoading ? "Saving..." : "Save & Continue"}
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
        )}
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
                      <td className="py-3 px-4 text-right font-bold text-[var(--primary)]">{formatCurrency(calculateVehicleTotalCost(v.charges))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-4 p-3 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--foreground)]">
                <p className="font-medium">What will happen:</p>
                <ul className="mt-1 space-y-1 text-[var(--secondary-foreground)]">
                  <li>* New vehicles will be created with charges from this invoice</li>
                  <li>* Existing vehicles (same chassis) will be updated with new charge data</li>
                  <li>* Invoice PDF will be linked to each vehicle</li>
                </ul>
              </div>
            </div>

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
