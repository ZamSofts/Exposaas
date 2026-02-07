import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth, Error, API, CustomSelect, CustomButton, FilePreviewer, Toast, isValid, Loader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import Payments from "@/components/Payments";
import { Car, FileUp, ArrowLeft, Save, Plus, User, CreditCard, Files, DollarSign, Truck } from "lucide-react";

// Format currency for display
const formatCurrencyDisplay = value => {
  if (value === null || value === undefined || value === "") return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return `¥${num.toLocaleString()}`;
};

export const EditVehicle = ({ vehicleId = null, onBack, onSuccess }) => {
  const { session, status } = useAuth();
  const [activeTab, setActiveTab] = useState("basic");

  const [brand, setBrand] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [customLoader, setCustomLoader] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(null);
  const [chassisNumber, setChassisNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [auction, setAuction] = useState("");
  const [companyId, setCompanyId] = useState(session?.companyId || null);
  const [statusId, setStatusId] = useState(0);
  const [customerId, setCustomerId] = useState(null);
  const [remarks, setRemarks] = useState("");

  // Charge fields
  const [bidAmount, setBidAmount] = useState("");
  const [bidTax, setBidTax] = useState("");
  const [auctionFee, setAuctionFee] = useState("");
  const [auctionTax, setAuctionTax] = useState("");
  const [insuranceFee, setInsuranceFee] = useState("");
  const [insuranceTax, setInsuranceTax] = useState("");
  const [recyclingFee, setRecyclingFee] = useState("");
  const [transportFee, setTransportFee] = useState("");
  const [transportTax, setTransportTax] = useState("");
  const [otherFees, setOtherFees] = useState("");
  const [taxProration, setTaxProration] = useState("");

  // Logistics/metadata fields
  const [auctionDate, setAuctionDate] = useState("");
  const [sessionField, setSessionField] = useState("");
  const [transportCompany, setTransportCompany] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [numberPlate, setNumberPlate] = useState("");
  const [titleTransferDeadline, setTitleTransferDeadline] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [etd, setEtd] = useState("");

  // Calculate total cost from charge fields
  const calculateTotalCost = () => {
    const charges = [bidAmount, bidTax, auctionFee, auctionTax, insuranceFee, insuranceTax, recyclingFee, transportFee, transportTax, taxProration, otherFees];
    return charges.reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  };

  const calculateTaxSum = () => {
    const taxes = [bidTax, auctionTax, insuranceTax, transportTax, taxProration];
    return taxes.reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  };

  // Vehicle documents upload states
  const [vehicleDocuments, setVehicleDocuments] = useState([]);
  const [documentsToDelete, setDocumentsToDelete] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  // Toast state
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  const isEditMode = vehicleId !== null && vehicleId !== 0;

  useEffect(() => {
    if (status === "authenticated" && session) {
      setCompanyId(Number(session.companyId));
      loadInitialData();
    }
  }, [status, session]);

  useEffect(() => {
    if (isEditMode) {
      loadData();
    }
  }, [vehicleId]);

  // Reset active tab when vehicleId changes
  useEffect(() => {
    if (!vehicleId && activeTab === "payments") {
      setActiveTab("basic");
    }
  }, [vehicleId, activeTab]);

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  const loadInitialData = async () => {
    setCustomLoader(true);
    setError("");
    try {
      const [brandData, statusData, customerData] = await Promise.all([API("GET", "brand"), API("GET", "vehicleStatus"), API("GET", "customer?col=id,name,uniqueId")]);
      setBrand(!brandData.error ? brandData : []);
      setVehicleStatus(!statusData.error ? statusData : []);
      setCustomers(
        !customerData.error
          ? customerData.map(c => ({
              id: c.id,
              name: c.name + "-" + c.uniqueId,
            }))
          : []
      );
    } catch {
      setError("Something went wrong");
    } finally {
      setCustomLoader(false);
    }
  };

  const loadData = async () => {
    setCustomLoader(true);
    const data = await API("GET", `vehicle?id=${vehicleId}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      setCustomLoader(false);
      return;
    }

    // Populate form fields
    setName(data.name || "");
    setBrandId(data.brandId);
    setChassisNumber(data.chassisNumber);
    setCompanyId(data.companyId);
    setStatusId(data.statusId);
    setCustomerId(data.customerId || null);
    setLotNumber(data.lotNumber || "");
    setAuction(data.auction || "");
    setRemarks(data.remarks || "");

    // Populate charge fields
    setBidAmount(data.bidAmount || "");
    setBidTax(data.bidTax || "");
    setAuctionFee(data.auctionFee || "");
    setAuctionTax(data.auctionTax || "");
    setInsuranceFee(data.insuranceFee || "");
    setInsuranceTax(data.insuranceTax || "");
    setRecyclingFee(data.recyclingFee || "");
    setTransportFee(data.transportFee || "");
    setTransportTax(data.transportTax || "");
    setOtherFees(data.otherFees || "");
    setTaxProration(data.taxProration || "");

    // Logistics/metadata fields
    setAuctionDate(data.auctionDate || "");
    setSessionField(data.session || "");
    setTransportCompany(data.transportCompany || "");
    setDeliverTo(data.deliverTo || "");
    setNumberPlate(data.numberPlate || "");
    setTitleTransferDeadline(data.titleTransferDeadline ? data.titleTransferDeadline.split("T")[0] : "");
    setContainerNumber(data.containerNumber || "");
    setEtd(data.etd || "");

    setDocumentsToDelete([]);

    // Map existing documents
    const existingDocs = (data.documents || []).map(doc => ({
      id: doc.id,
      name: doc.Url.split("/").pop(),
      docUrl: doc.Url,
      isExisting: true,
      size: 0,
      type: doc.Url.toLowerCase().includes(".jpg") || doc.Url.toLowerCase().includes(".jpeg") || doc.Url.toLowerCase().includes(".png") ? "image" : "document",
    }));
    setVehicleDocuments(existingDocs);

    setCustomLoader(false);
  };

  const handleDocumentChange = e => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (vehicleDocuments.length + files.length > 15) {
      showToast("You can upload a maximum of 15 files.", "error");
      setError("You can upload a maximum of 15 files.");
      return;
    }

    const validFiles = [];
    const invalidFiles = [];
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];

    files.forEach(file => {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (allowedExtensions.includes(fileExtension) && allowedTypes.includes(file.type)) {
        if (file.size > 5 * 1024 * 1024) {
          showToast(`File ${file.name} exceeds the 5MB size limit.`, "error");
          setError(`File ${file.name} exceeds the 5MB size limit.`);
          invalidFiles.push(file.name);
        } else {
          validFiles.push({
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        }
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid files: ${invalidFiles.join(", ")}. Only PDF, JPG, PNG, DOC, DOCX files are allowed! and must be under 5MB.`);
    } else {
      setError("");
    }

    setVehicleDocuments(prev => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const removeDocument = fileId => {
    const documentToRemove = vehicleDocuments.find(doc => doc.id === fileId);

    if (documentToRemove && documentToRemove.isExisting) {
      setDocumentsToDelete(prev => [...prev, documentToRemove.id]);
    }

    setVehicleDocuments(prev => prev.filter(file => file.id !== fileId));
    setError("");
  };

  const editData = async () => {
    if (!isValid({ auctionDate: auctionDate, titleTransferDeadline: titleTransferDeadline }, setError)) return;
    if (!brandId || !chassisNumber || !statusId) {
        setError(!brandId ? "Please select a brand" : !chassisNumber ? "Chassis number is required" : "Please select current status");
        return;
      }

    setCustomLoader(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("brandId", brandId);
      formData.append("chassisNumber", chassisNumber);
      formData.append("companyId", Number(session.companyId));
      formData.append("statusId", statusId);
      formData.append("customerId", customerId || "");
      formData.append("lotNumber", lotNumber);
      formData.append("auction", auction);
      formData.append("remarks", remarks);

      // Append charge fields
      if (bidAmount) formData.append("bidAmount", bidAmount);
      if (bidTax) formData.append("bidTax", bidTax);
      if (auctionFee) formData.append("auctionFee", auctionFee);
      if (auctionTax) formData.append("auctionTax", auctionTax);
      if (insuranceFee) formData.append("insuranceFee", insuranceFee);
      if (insuranceTax) formData.append("insuranceTax", insuranceTax);
      if (recyclingFee) formData.append("recyclingFee", recyclingFee);
      if (transportFee) formData.append("transportFee", transportFee);
      if (transportTax) formData.append("transportTax", transportTax);
      if (otherFees) formData.append("otherFees", otherFees);
      if (taxProration) formData.append("taxProration", taxProration);

      // Logistics/metadata fields
      formData.append("auctionDate", auctionDate);
      formData.append("session", sessionField);
      formData.append("transportCompany", transportCompany);
      formData.append("deliverTo", deliverTo);
      formData.append("numberPlate", numberPlate);
      formData.append("titleTransferDeadline", titleTransferDeadline);
      formData.append("containerNumber", containerNumber);
      formData.append("etd", etd);

      // Only append new vehicle document files
      const newFiles = vehicleDocuments.filter(docObj => !docObj.isExisting && docObj.file);
      newFiles.forEach(docObj => {
        formData.append("documents", docObj.file);
      });

      if (isEditMode) {
        formData.append("id", vehicleId);
        formData.append("documentsToDelete", JSON.stringify(documentsToDelete));
      }

      let response;
      if (!isEditMode) {
        response = await API("PUT", "vehicle", formData, true);
      } else {
        response = await API("POST", "vehicle", formData, true);
      }

      if (response.error) {
        setError(response.error);
        showToast(response.error, "error");
        return;
      }

      showToast(
        !isEditMode
          ? `Vehicle added successfully! ${response.documentsUploaded || 0} document(s) uploaded.`
          : `Vehicle updated successfully! ${response.documentsUploaded || 0} document(s) uploaded, ${response.documentsDeleted || 0} document(s) deleted.`,
        "success"
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setError("An unexpected error occurred");
      showToast("An unexpected error occurred", "error");
    } finally {
      setCustomLoader(false);
    }
  };

  return (
    <>
      <Head>
        <title>{isEditMode ? "Edit Vehicle" : "Add Vehicle"} - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          {/* Header Section */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)] hover:bg-[var(--input)] transition-colors">
                <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
              </button>
              <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <Car className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">{isEditMode ? "Edit Vehicle" : "Add New Vehicle"}</h1>
            </div>
            <div className="flex gap-3">
              <CustomButton title={isEditMode ? "Update Vehicle" : "Save Vehicle"} onClick={editData} className="btn-primary" icon={<Save className="w-5 h-5" />} />
              <CustomButton title="Cancel" onClick={onBack} className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg" />
            </div>
          </div>

          <Error message={error} />

          {/* Tab Navigation */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="border-b border-[var(--border)]">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab("basic")}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "basic" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--input)]"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Basic Info
                </button>

                <button
                  onClick={() => setActiveTab("charges")}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "charges" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--input)]"
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Charges
                </button>
                <button
                  onClick={() => setActiveTab("logistics")}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "logistics" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--input)]"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Logistics
                </button>
                <button
                  onClick={() => setActiveTab("documents")}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "documents" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--input)]"
                  }`}
                >
                  <Files className="w-4 h-4" />
                  Documents
                </button>
                <button
                  onClick={() => vehicleId && setActiveTab("payments")}
                  disabled={!vehicleId}
                  title={!vehicleId ? "Save vehicle first to manage payments" : "Manage vehicle payments"}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    !vehicleId
                      ? "text-[var(--muted-foreground)] cursor-not-allowed opacity-50"
                      : activeTab === "payments"
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--input)]"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Payments
                  {!vehicleId && <span className="text-xs">(Payments can’t be added during creation.)</span>}
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === "basic" && (
                <div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="input-label">Vehicle Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-style" placeholder="Enter vehicle name..." />
                    </div>
                    <div>
                      <label className="input-label">Brand *</label>
                      <CustomSelect data={brand} selectedId={brandId} setSelectedId={setBrandId} />
                    </div>
                    <div>
                      <label className="input-label">Current Status *</label>
                      <CustomSelect data={vehicleStatus} selectedId={statusId} setSelectedId={setStatusId} />
                    </div>
                    <div>
                      <label className="input-label">Chassis Number *</label>
                      <input type="text" value={chassisNumber} onChange={e => setChassisNumber(e.target.value)} className="input-style" placeholder="Enter chassis number..." />
                    </div>
                    <div>
                      <label className="input-label">Customer</label>
                      <CustomSelect data={customers} selectedId={customerId} setSelectedId={setCustomerId} placeholder="Select customer" />
                    </div>
                    <div>
                      <label className="input-label">Lot Number</label>
                      <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="input-style" placeholder="Enter lot number..." />
                    </div>
                    <div>
                      <label className="input-label">Auction</label>
                      <input type="text" value={auction} onChange={e => setAuction(e.target.value)} className="input-style" placeholder="Enter auction..." />
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <label className="input-label">Remarks</label>
                      <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-style" placeholder="Enter remarks..." rows={3} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "charges" && (
                <div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Acquisition Charges</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="input-label">Bid Amount</label>
                      <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Bid Tax</label>
                      <input type="number" value={bidTax} onChange={e => setBidTax(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Auction Fee</label>
                      <input type="number" value={auctionFee} onChange={e => setAuctionFee(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Auction Tax</label>
                      <input type="number" value={auctionTax} onChange={e => setAuctionTax(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Insurance Fee</label>
                      <input type="number" value={insuranceFee} onChange={e => setInsuranceFee(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Insurance Tax</label>
                      <input type="number" value={insuranceTax} onChange={e => setInsuranceTax(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Recycling Fee</label>
                      <input type="number" value={recyclingFee} onChange={e => setRecyclingFee(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Transport Fee</label>
                      <input type="number" value={transportFee} onChange={e => setTransportFee(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Transport Tax</label>
                      <input type="number" value={transportTax} onChange={e => setTransportTax(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Other Fees</label>
                      <input type="number" value={otherFees} onChange={e => setOtherFees(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                    <div>
                      <label className="input-label">Tax Proration</label>
                      <input type="number" value={taxProration} onChange={e => setTaxProration(e.target.value)} className="input-style" placeholder="0" />
                    </div>
                  </div>

                  {/* Total Cost & Tax Sum Display */}
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-medium text-[var(--foreground)]">Total Acquisition Cost</span>
                        <span className="text-2xl font-bold text-[var(--primary)]">{formatCurrencyDisplay(calculateTotalCost())}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-medium text-[var(--foreground)]">Tax Sum</span>
                        <span className="text-2xl font-bold text-yellow-600">{formatCurrencyDisplay(calculateTaxSum())}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--secondary-foreground)] mt-4">
                    These charges represent the acquisition costs for this vehicle. Total cost and tax sum are calculated automatically.
                  </p>
                </div>
              )}

              {activeTab === "logistics" && (
                <div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Logistics & Metadata</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="input-label">Auction Date</label>
                      <input type="date" value={auctionDate} onChange={e => setAuctionDate(e.target.value)} className="input-style" placeholder="e.g., 2025/06/09" />
                    </div>
                    <div>
                      <label className="input-label">Session</label>
                      <input type="text" value={sessionField} onChange={e => setSessionField(e.target.value)} className="input-style" placeholder="e.g., 885" />
                    </div>
                    <div>
                      <label className="input-label">Transportation Company</label>
                      <input type="text" value={transportCompany} onChange={e => setTransportCompany(e.target.value)} className="input-style" placeholder="Enter transport company..." />
                    </div>
                    <div>
                      <label className="input-label">Deliver To</label>
                      <input type="text" value={deliverTo} onChange={e => setDeliverTo(e.target.value)} className="input-style" placeholder="Delivery destination..." />
                    </div>
                    <div>
                      <label className="input-label">Number Plate</label>
                      <input type="text" value={numberPlate} onChange={e => setNumberPlate(e.target.value)} className="input-style" placeholder="Vehicle plate number..." />
                    </div>
                    <div>
                      <label className="input-label">Title Transfer Deadline</label>
                      <input type="date" value={titleTransferDeadline} onChange={e => setTitleTransferDeadline(e.target.value)} className="input-style" />
                    </div>
                    <div>
                      <label className="input-label">Container Number</label>
                      <input type="text" value={containerNumber} onChange={e => setContainerNumber(e.target.value)} className="input-style" placeholder="Shipping container #..." />
                    </div>
                    <div>
                      <label className="input-label">ETD (Estimated Departure)</label>
                      <input type="text" value={etd} onChange={e => setEtd(e.target.value)} className="input-style" placeholder="e.g., Feb 2025" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "payments" && vehicleId && <Payments vehicleId={vehicleId} />}

              {activeTab === "payments" && !vehicleId && (
                <div className="text-center py-8">
                  <p className="text-[var(--secondary-foreground)] text-lg mb-2">Payments Not Available</p>
                  <p className="text-[var(--secondary-foreground)]">Please save the vehicle first to manage payments.</p>
                </div>
              )}

              {activeTab === "documents" && (
                <div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Vehicle Documents</h3>
                  <div className="vehicle-doc-style">
                    {/* Add Document Tile */}
                    <div className="relative">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={handleDocumentChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className="vehicle-doc-upload-button">
                        <Plus className="w-6 h-6 text-[var(--secondary-foreground)] mb-1" />
                        <span className="text-xs text-[var(--secondary-foreground)] text-center px-1">Add Documents</span>
                      </div>
                    </div>

                    {/* Document Tiles */}
                    {vehicleDocuments.map(docObj => (
                      <div key={docObj.id} className="relative group">
                        <div className="vehicle-doc-display">
                          <div
                            className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--secondary)]/30 rounded transition-colors"
                            onClick={() =>
                              setPreviewFile({
                                url: docObj.isExisting ? docObj.docUrl : URL.createObjectURL(docObj.file),
                                fileName: docObj.name,
                              })
                            }
                          >
                            {docObj.isExisting ? (
                              docObj.type === "image" ? (
                                <img src={docObj.docUrl} alt={docObj.name} className="w-8 h-8 object-cover rounded mb-1" />
                              ) : (
                                <FileUp className="w-5 h-5 text-[var(--primary)] mb-1" />
                              )
                            ) : docObj.type && docObj.type.includes("image") ? (
                              <img src={URL.createObjectURL(docObj.file)} alt={docObj.name} className="w-8 h-8 object-cover rounded mb-1" />
                            ) : (
                              <FileUp className="w-5 h-5 text-[var(--primary)] mb-1" />
                            )}
                            <div className="text-xs text-[var(--foreground)] text-center break-words leading-tight">
                              {docObj.name && docObj.name.length > 15 ? docObj.name.substring(0, 12) + "..." : docObj.name || ""}
                            </div>
                            <div className="text-xs text-[var(--secondary-foreground)] mt-1">{docObj.isExisting ? "Existing" : `${(docObj.size / 1024).toFixed(1)} KB`}</div>
                          </div>
                          <button onClick={() => removeDocument(docObj.id)} className="vehicle-doc-remove-button">
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {vehicleDocuments.length > 0 && (
                    <div className="mt-4 p-3 bg-[var(--input)] rounded-lg text-sm text-[var(--secondary-foreground)]">
                      <span className="font-medium">{vehicleDocuments.length} document(s) selected</span>
                      <span className="ml-2">({(vehicleDocuments.reduce((acc, doc) => acc + doc.size, 0) / 1024).toFixed(1)} KB total)</span>
                    </div>
                  )}
                  <p className="text-xs text-[var(--secondary-foreground)] mt-3">Supported formats: PDF, JPG, PNG, DOC, DOCX (Max size per file: 5MB, Max files: 15)</p>
                </div>
              )}
            </div>
          </div>
          {customLoader && <Loader />}
        </div>
      </Sidebar>

      {/* File Preview Component */}
      {previewFile && <FilePreviewer url={previewFile.url} fileName={previewFile.fileName} isOpen={true} onClose={() => setPreviewFile(null)} trigger={null} />}

      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
};
