import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth, Error, API, CustomButton, FilePreviewer, Toast, isValid, Loader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import Payments from "@/components/Payments";
import VehicleHistory from "@/components/VehicleHistory";
import { Car, ArrowLeft, Save, User, CreditCard, Files, DollarSign, Truck, History } from "lucide-react";
import VehicleBasicTab from "@/components/vehicle/VehicleBasicTab";
import VehicleChargesTab from "@/components/vehicle/VehicleChargesTab";
import VehicleLogisticsTab from "@/components/vehicle/VehicleLogisticsTab";
import VehicleDocumentsTab from "@/components/vehicle/VehicleDocumentsTab";


export const EditVehicle = ({ vehicleId = null, onBack, onSuccess }) => {
  const { session, status } = useAuth();
  const [activeTab, setActiveTab] = useState("basic");

  const [brand, setBrand] = useState([]);
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
  const [customerId, setCustomerId] = useState(null);
  const [remarks, setRemarks] = useState("");

  // Charge fields
  const [bidAmount, setBidAmount] = useState("");
  const [auctionFee, setAuctionFee] = useState("");
  const [insuranceFee, setInsuranceFee] = useState("");
  const [recyclingFee, setRecyclingFee] = useState("");
  const [transportFee, setTransportFee] = useState("");
  const [otherFees, setOtherFees] = useState("");

  // Logistics/metadata fields
  const [auctionDate, setAuctionDate] = useState("");
  const [sessionField, setSessionField] = useState("");
  const [transportCompany, setTransportCompany] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [numberPlate, setNumberPlate] = useState("");
  const [titleTransferDeadline, setTitleTransferDeadline] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [etd, setEtd] = useState("");
  const [documentStatus, setDocumentStatus] = useState("");
  const [memo, setMemo] = useState("");

  // Calculate tax: 10% of taxable fees (recyclingFee is tax-exempt)
  const calculateTaxSum = () => {
    const taxBase = [bidAmount, auctionFee, insuranceFee, transportFee, otherFees];
    const sum = taxBase.reduce((s, val) => {
      const num = parseFloat(val);
      return s + (isNaN(num) ? 0 : num);
    }, 0);
    return sum * 0.1;
  };

  // Calculate total cost from all charge fields + tax
  const calculateTotalCost = () => {
    const charges = [bidAmount, auctionFee, insuranceFee, recyclingFee, transportFee, otherFees];
    const sum = charges.reduce((s, val) => {
      const num = parseFloat(val);
      return s + (isNaN(num) ? 0 : num);
    }, 0);
    return sum + calculateTaxSum();
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
    }
  }, [status, session]);

  useEffect(() => {
    loadInitialData();
  }, []);
  
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
      const [brandData, customerData] = await Promise.all([API("GET", "brand"), API("GET", "customer?col=id,name,uniqueId")]);
      setBrand(!brandData.error ? brandData : []);
      setCustomers(
        !customerData.error
          ? customerData.map(c => ({
              id: c.id,
              name: /^(CSV-|auto-)/.test(c.uniqueId || "") ? c.name : c.name + "-" + c.uniqueId,
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
    setCustomerId(data.customerId || null);
    setLotNumber(data.lotNumber || "");
    setAuction(data.auction || "");
    setRemarks(data.remarks || "");

    // Populate charge fields
    setBidAmount(data.bidAmount || "");
    setAuctionFee(data.auctionFee || "");
    setInsuranceFee(data.insuranceFee || "");
    setRecyclingFee(data.recyclingFee || "");
    setTransportFee(data.transportFee || "");
    setOtherFees(data.otherFees || "");

    // Logistics/metadata fields
    setAuctionDate(data.auctionDate || "");
    setSessionField(data.session || "");
    setTransportCompany(data.transportCompany || "");
    setDeliverTo(data.deliverTo || "");
    setNumberPlate(data.numberPlate || "");
    setTitleTransferDeadline(data.titleTransferDeadline ? data.titleTransferDeadline.split("T")[0] : "");
    setContainerNumber(data.containerNumber || "");
    setEtd(data.etd || "");
    setDocumentStatus(data.documentStatus || "");
    setMemo(data.memo || "");

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
            previewUrl: URL.createObjectURL(file),
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

    // Revoke object URL to free memory
    if (documentToRemove && documentToRemove.previewUrl) {
      URL.revokeObjectURL(documentToRemove.previewUrl);
    }

    setVehicleDocuments(prev => prev.filter(file => file.id !== fileId));
    setError("");
  };

  const editData = async () => {
    if (!isValid({ auctionDate: auctionDate, titleTransferDeadline: titleTransferDeadline }, setError)) return;
    if (!brandId || !chassisNumber) {
      setError(!brandId ? "Please select a brand" : "Chassis number is required");
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
      formData.append("customerId", customerId || "");
      formData.append("lotNumber", lotNumber);
      formData.append("auction", auction);
      formData.append("remarks", remarks);

      // Append charge fields
      if (bidAmount) formData.append("bidAmount", bidAmount);
      if (auctionFee) formData.append("auctionFee", auctionFee);
      if (insuranceFee) formData.append("insuranceFee", insuranceFee);
      if (recyclingFee) formData.append("recyclingFee", recyclingFee);
      if (transportFee) formData.append("transportFee", transportFee);
      if (otherFees) formData.append("otherFees", otherFees);

      // Logistics/metadata fields
      formData.append("auctionDate", auctionDate);
      formData.append("session", sessionField);
      formData.append("transportCompany", transportCompany);
      formData.append("deliverTo", deliverTo);
      formData.append("numberPlate", numberPlate);
      formData.append("titleTransferDeadline", titleTransferDeadline);
      formData.append("containerNumber", containerNumber);
      formData.append("etd", etd);
      formData.append("documentStatus", documentStatus);
      formData.append("memo", memo);

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
                  {!vehicleId && <span className="text-xs">(Payments can't be added during creation.)</span>}
                </button>
                <button
                  onClick={() => vehicleId && setActiveTab("history")}
                  disabled={!vehicleId}
                  title={!vehicleId ? "Save vehicle first to view history" : "View change history"}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    !vehicleId
                      ? "text-[var(--muted-foreground)] cursor-not-allowed opacity-50"
                      : activeTab === "history"
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--input)]"
                  }`}
                >
                  <History className="w-4 h-4" />
                  History
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === "basic" && (
                <VehicleBasicTab
                  name={name} setName={setName}
                  brandId={brandId} setBrandId={setBrandId} brand={brand}
                  chassisNumber={chassisNumber} setChassisNumber={setChassisNumber}
                  customerId={customerId} setCustomerId={setCustomerId} customers={customers}
                  lotNumber={lotNumber} setLotNumber={setLotNumber}
                  auction={auction} setAuction={setAuction}
                  remarks={remarks} setRemarks={setRemarks}
                />
              )}

              {activeTab === "charges" && (
                <VehicleChargesTab
                  bidAmount={bidAmount} setBidAmount={setBidAmount}
                  auctionFee={auctionFee} setAuctionFee={setAuctionFee}
                  insuranceFee={insuranceFee} setInsuranceFee={setInsuranceFee}
                  recyclingFee={recyclingFee} setRecyclingFee={setRecyclingFee}
                  transportFee={transportFee} setTransportFee={setTransportFee}
                  otherFees={otherFees} setOtherFees={setOtherFees}
                  calculateTaxSum={calculateTaxSum}
                  calculateTotalCost={calculateTotalCost}
                />
              )}

              {activeTab === "logistics" && (
                <VehicleLogisticsTab
                  auctionDate={auctionDate} setAuctionDate={setAuctionDate}
                  sessionField={sessionField} setSessionField={setSessionField}
                  transportCompany={transportCompany} setTransportCompany={setTransportCompany}
                  deliverTo={deliverTo} setDeliverTo={setDeliverTo}
                  numberPlate={numberPlate} setNumberPlate={setNumberPlate}
                  titleTransferDeadline={titleTransferDeadline} setTitleTransferDeadline={setTitleTransferDeadline}
                  containerNumber={containerNumber} setContainerNumber={setContainerNumber}
                  etd={etd} setEtd={setEtd}
                  documentStatus={documentStatus} setDocumentStatus={setDocumentStatus}
                  memo={memo} setMemo={setMemo}
                />
              )}

              {activeTab === "payments" && vehicleId && <Payments vehicleId={vehicleId} />}

              {activeTab === "history" && vehicleId && <VehicleHistory vehicleId={vehicleId} />}

              {activeTab === "payments" && !vehicleId && (
                <div className="text-center py-8">
                  <p className="text-[var(--secondary-foreground)] text-lg mb-2">Payments Not Available</p>
                  <p className="text-[var(--secondary-foreground)]">Please save the vehicle first to manage payments.</p>
                </div>
              )}

              {activeTab === "documents" && (
                <VehicleDocumentsTab
                  vehicleDocuments={vehicleDocuments}
                  handleDocumentChange={handleDocumentChange}
                  removeDocument={removeDocument}
                  setPreviewFile={setPreviewFile}
                />
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
