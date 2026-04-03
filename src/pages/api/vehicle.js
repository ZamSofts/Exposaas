import { prisma, getSession } from "@/lib/useful";
import { putFile, deleteFile, putMultipleFiles } from "@/lib/blob.mjs";
import multer from "multer";
import { parseChargeFieldsFromFlat } from "../../../extra/utils/chargeMapping";
import { logVehicleAudit, logVehicleFieldChanges } from "../../../extra/utils/auditLog";
import { buildFilterWhere, getSearchFilter, getOrderBy } from "@/lib/vehicleFilters";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 15, // Maximum 15 files can be uploaded at once
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/csv",
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error("Invalid file type"), allowed.includes(file.mimetype));
  },
}).any(); // Accept any field names for maximum flexibility

export const config = { api: { bodyParser: false } };

// Utilities
const parseFormData = req =>
  new Promise((resolve, reject) => {
    upload(req, {}, err => {
      if (err) {
        reject(err);
      } else {
        // When using .any(), files are in req.files as an array, not grouped by field name
        // We need to group them by field name manually
        const filesByField = {};
        if (req.files && Array.isArray(req.files)) {
          req.files.forEach(file => {
            if (!filesByField[file.fieldname]) {
              filesByField[file.fieldname] = [];
            }
            filesByField[file.fieldname].push(file);
          });
        }

        resolve({ files: filesByField, body: req.body || {} });
      }
    });
  });

const uploadFiles = async (files, vehicleId, folderPath = "vehicle/") => {
  if (!files || files.length === 0) {
    return { uploadedDocuments: [], documentsUploaded: 0, errors: [] };
  }

  try {
    // Use putMultipleFiles to upload all files at once
    const uploadResults = await putMultipleFiles(files, folderPath);

    // Transform results to match expected format
    const uploadedDocuments = uploadResults.map((result, index) => ({
      vehicleId: vehicleId,
      Url: result.url,
      fileName: files[index].originalname,
      fileSize: files[index].buffer.length,
      mimeType: files[index].mimetype,
    }));

    console.log(`✅ Successfully uploaded ${uploadedDocuments.length} files`);

    return {
      uploadedDocuments: uploadedDocuments,
      documentsUploaded: uploadedDocuments.length,
      errors: [],
    };
  } catch (error) {
    console.error("❌ Upload failed:", error);
    return {
      uploadedDocuments: [],
      documentsUploaded: 0,
      errors: [{ fileName: "batch_upload", error: error.message }],
    };
  }
};

// Helper function to validate vehicle data
const validateVehicle = async ({ chassisNumber, brandId, companyId, vehicleId = null }) => {
  if (!chassisNumber || !brandId || !companyId) {
    throw new Error("Missing required fields");
  }

  const [brand, existing] = await Promise.all([
    prisma.brand.findUnique({ where: { id: Number(brandId) } }),
    prisma.vehicle.findUnique({
      where: {
        companyId_chassisNumber: {
          companyId: Number(companyId),
          chassisNumber,
        },
      },
    }),
  ]);

  if (!brand) throw new Error("Brand not found");
  if (existing && Number(existing.id) !== Number(vehicleId)) {
    throw new Error("Chassis number already exists");
  }
};

// ── Filter support imported from shared utility ──
// buildFilterWhere, getSearchFilter, getOrderBy imported from @/lib/vehicleFilters

/** Build Prisma include object. Omit documents for large page sizes. */
const getIncludeRelations = (includeDocuments = true) => {
  const base = {
    brand: { select: { name: true } },
    customer: { select: { id: true, name: true } },
    sourceInvoiceJob: { select: { id: true, DocumentURL: true } },
  };
  if (includeDocuments) {
    base.documents = { select: { id: true, Url: true, docType: true, createdAt: true } };
    base.company = { select: { name: true } };
  }
  return base;
};

/** Delete documents from storage. Returns { deleted, errors }. */
const deleteDocuments = async (documents) => {
  let deleted = 0;
  const errors = [];
  for (const doc of documents) {
    try {
      await deleteFile(doc.Url);
      deleted++;
      console.log(`✅ Deleted from storage: ${doc.Url}`);
    } catch (error) {
      console.error(`❌ Failed to delete from storage: ${doc.Url}`, error);
      errors.push({ docUrl: doc.Url, error: error.message });
    }
  }
  return { deleted, errors };
};

// Helper to parse charge + metadata fields from request body
const parseVehicleFields = body => {
  // Charge fields (uses shared utility — includes totalCost and taxSum)
  const fields = parseChargeFieldsFromFlat(body);

  // sourceInvoiceJobId
  if (body.sourceInvoiceJobId !== undefined && body.sourceInvoiceJobId !== null && body.sourceInvoiceJobId !== "") {
    fields.sourceInvoiceJobId = parseInt(body.sourceInvoiceJobId);
  }

  // Metadata/logistics fields (string values)
  const metadataKeys = [
    "auctionDate", "session", "transportCompany", "deliverTo",
    "numberPlate", "containerNumber", "etd", "documentStatus", "memo",
  ];
  for (const key of metadataKeys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      fields[key] = body[key];
    }
  }

  // Size fields (integer: length/width/height, decimal: m3)
  for (const key of ["length", "width", "height"]) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      const parsed = parseInt(body[key]);
      if (!isNaN(parsed)) fields[key] = parsed;
    }
  }
  if (body.m3 !== undefined && body.m3 !== null && body.m3 !== "") {
    const parsed = parseFloat(body.m3);
    if (!isNaN(parsed)) fields.m3 = parsed;
  }

  // titleTransferDeadline (DateTime)
  if (body.titleTransferDeadline !== undefined && body.titleTransferDeadline !== null && body.titleTransferDeadline !== "") {
    const d = new Date(body.titleTransferDeadline);
    if (!isNaN(d.getTime())) {
      fields.titleTransferDeadline = d;
    }
  }

  return fields;
};

export default async function handler(req, res) {
  const session = await getSession(req, res);

  try {
    // Handle file uploads for PUT and POST methods
    if (["PUT", "POST"].includes(req.method)) {
      const { files, body } = await parseFormData(req);
      req.files = files;
      req.body = body;
    }

    const id = Number(req.query.id);
    const chassisNumber = req.query.chassisNumber;
    const { page = 1, limit: rawLimit = 10, search = "", sortBy = "id", sortOrder = "asc", col } = req.query;
    const limit = Math.min(Number(rawLimit), 10000);
    const selectFields = col ? Object.fromEntries(col.split(",").map(c => [c, true])) : undefined;
    const userFilter = session.role === "Sadmin" ? {} : { companyId: session?.companyId };

    switch (req.method) {
      case "GET": {
        // Single vehicle

        if (session.role?.toLowerCase() === "customer") {
          const customerid = await prisma.customer.findUnique({ where: { userId: Number(session.id) }, select: { id: true } });
          userFilter.customerId = customerid?.id;
        }

        if (id) {
          const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: getIncludeRelations(true) });
          if (!vehicle || (session.role !== "Sadmin" && vehicle.companyId !== session?.companyId)) {
            return res.status(404).json({ error: "Vehicle not found" });
          }
          return res.json(vehicle);
        }

        const filterWhere = buildFilterWhere(req.query.filters);
        const where = { ...userFilter, ...getSearchFilter(search.trim().toLowerCase()), ...filterWhere };

        // Specific fields
        if (selectFields) {
          const vehicles = await prisma.vehicle.findMany({
            select: { ...selectFields, ...getIncludeRelations(true) },
            where,
            orderBy: getOrderBy(sortBy, sortOrder),
          });
          return res.json(vehicles);
        }

        if(chassisNumber){
          const vehicle = await prisma.vehicle.findFirst({ where: { chassisNumber, companyId:session.companyId} });
          if (!vehicle) return res.status(404).json({ error: "chassis number not found.please first register vehicle" });
          return res.json(vehicle);
        }

        // Paginated list — documents excluded for performance (only needed in detail view)
        const include = getIncludeRelations(false);
        const [vehicles, total] = await Promise.all([
          prisma.vehicle.findMany({
            skip: (page - 1) * limit,
            take: limit,
            where,
            include,
            orderBy: getOrderBy(sortBy, sortOrder),
          }),
          prisma.vehicle.count({ where }),
        ]);
        return res.json({ vehicles, total });
      }

      case "PUT": {
        const { name, chassisNumber, brandId, remarks, companyId, customerId, auction, lotNumber } = req.body;
        await validateVehicle({ chassisNumber, brandId, companyId });

        // Parse charge fields from request
        const chargeFields = parseVehicleFields(req.body);

        const vehicle = await prisma.vehicle.create({
          data: {
            name,
            chassisNumber,
            auction,
            lotNumber,
            remarks,
            brandId: Number(brandId),
            companyId: Number(companyId),
            customerId: customerId && customerId !== "" ? Number(customerId) : null,
            createdById: parseInt(session.id, 10) || null,
            ...chargeFields,
          },
        });

        // Audit trail (fire-and-forget)
        logVehicleAudit(prisma, {
          vehicleId: vehicle.id,
          action: "create",
          actor: "user",
          actorId: session.id,
          source: "manual",
        });

        // Handle document uploads
        const documentFiles = req.files.documents || [];
        const uploadResult = await uploadFiles(documentFiles, vehicle.id, "vehicle/");

        // Save successfully uploaded documents to database
        if (uploadResult.uploadedDocuments.length > 0) {
          await prisma.vehicleDocument.createMany({
            data: uploadResult.uploadedDocuments.map(doc => ({
              vehicleId: doc.vehicleId,
              Url: doc.Url,
            })),
          });
        }

        const response = {
          message: "Vehicle created successfully",
          vehicleId: vehicle.id,
          documentsUploaded: uploadResult.documentsUploaded,
        };

        // Include upload errors if any
        if (uploadResult.errors.length > 0) {
          response.errors = uploadResult.errors;
          response.message += ` (${uploadResult.errors.length} operations had errors)`;
        }

        return res.status(201).json(response);
      }

      case "POST": {
        const { id, name, chassisNumber, brandId, remarks, companyId, customerId, auction, lotNumber, documentsToDelete } = req.body;
        const vehicleId = Number(id);
        if (!vehicleId) return res.status(400).json({ error: "Valid vehicle ID required" });

        await validateVehicle({ chassisNumber, brandId, companyId, vehicleId });

        // Fetch current vehicle state for audit diff
        const oldVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

        // Parse charge fields from request
        const chargeFields = parseVehicleFields(req.body);

        const updateData = {
          chassisNumber,
          auction,
          lotNumber,
          remarks,
          brandId: Number(brandId),
          companyId: Number(companyId),
          customerId: customerId && customerId !== "" ? Number(customerId) : null,
          updatedById: parseInt(session.id, 10) || null,
          ...chargeFields,
        };

        if (name != null && name !== "null") {
          updateData.name = name;
        }

        await prisma.vehicle.update({
          where: { id: vehicleId },
          data: updateData,
        });

        // Audit trail — log changed fields (fire-and-forget)
        if (oldVehicle) {
          const trackedFields = ["chassisNumber", "auction", "lotNumber", "remarks", "brandId", "customerId", "name",
            "bidAmount", "auctionFee", "insuranceFee", "recyclingFee", "transportFee", "otherFees",
            "auctionDate", "session", "transportCompany", "deliverTo", "numberPlate", "containerNumber", "etd", "documentStatus", "memo",
            "length", "width", "height", "m3", "titleTransferDeadline"];
          const changes = trackedFields
            .filter(f => updateData[f] !== undefined)
            .map(f => ({ field: f, oldValue: oldVehicle[f], newValue: updateData[f] }));
          logVehicleFieldChanges(prisma, { vehicleId, actor: "user", actorId: session.id, source: "manual", changes });
        }

        // Handle document deletions
        let documentsDeleted = 0;
        let deletionErrors = [];
        if (documentsToDelete) {
          try {
            const idsToDelete = JSON.parse(documentsToDelete);
            if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
              const docsToDelete = await prisma.vehicleDocument.findMany({
                where: { id: { in: idsToDelete }, vehicleId },
              });
              const deleteResult = await prisma.vehicleDocument.deleteMany({
                where: { id: { in: idsToDelete }, vehicleId },
              });
              documentsDeleted = deleteResult.count;

              const storageResult = await deleteDocuments(docsToDelete);
              deletionErrors = storageResult.errors;
            }
          } catch (error) {
            console.error("Error processing document deletions:", error);
            deletionErrors.push({ error: error.message, context: "Failed to parse documentsToDelete" });
          }
        }

        // Handle new document uploads
        const documentFiles = req.files.documents || [];
        const uploadResult = await uploadFiles(documentFiles, vehicleId, "vehicle/");

        // Save successfully uploaded documents to database
        if (uploadResult.uploadedDocuments.length > 0) {
          await prisma.vehicleDocument.createMany({
            data: uploadResult.uploadedDocuments.map(doc => ({
              vehicleId: doc.vehicleId,
              Url: doc.Url,
            })),
          });
        }

        const response = {
          message: "Vehicle updated successfully",
          documentsUploaded: uploadResult.documentsUploaded,
          documentsDeleted: documentsDeleted,
        };

        // Include any errors
        const allErrors = [...uploadResult.errors, ...deletionErrors];
        if (allErrors.length > 0) {
          response.errors = allErrors;
          response.message += ` (${allErrors.length} operations had errors)`;
        }

        return res.json(response);
      }

      case "DELETE": {
        if (!id) return res.status(400).json({ error: "Vehicle ID required" });

        // Capture vehicle snapshot for audit trail BEFORE deletion
        const vehicleToDelete = await prisma.vehicle.findUnique({ where: { id } });

        // First, get all documents associated with this vehicle BEFORE deletion
        const vehicleDocuments = await prisma.vehicleDocument.findMany({
          where: { vehicleId: id },
          select: { id: true, Url: true },
        });

        // Log audit BEFORE delete (cascade will remove audit logs too, so log includes snapshot)
        if (vehicleToDelete) {
          const { createdAt, updatedAt, ...snapshot } = vehicleToDelete;
          logVehicleAudit(prisma, {
            vehicleId: id,
            action: "delete",
            actor: "user",
            actorId: session.id,
            source: "manual",
            metadata: { snapshot },
          });
        }

        // Clean up documents from storage FIRST (before DB delete, so references are still available)
        const { deleted: documentsDeleted, errors: deletionErrors } = await deleteDocuments(vehicleDocuments);

        // Delete the vehicle (cascade will automatically delete documents from database)
        await prisma.vehicle.delete({ where: { id } });

        const response = {
          message: "Vehicle deleted successfully",
          documentsDeleted,
        };
        if (deletionErrors.length > 0) {
          response.errors = deletionErrors;
          response.message += ` (${deletionErrors.length} files failed to delete from storage)`;
        }

        return res.json(response);
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("API error:", error);
    const status = error.message.includes("not found") ? 404 : error.message.includes("already exists") ? 409 : error.message.includes("required") ? 400 : 500;
    res.status(status).json({ error: error.message || "Internal server error" });
  }
}
