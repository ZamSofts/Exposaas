import { prisma, getSession } from "@/lib/useful";
import { putFile, deleteFile, putMultipleFiles } from "@/lib/blob.mjs";
import multer from "multer";
import { parseChargeFieldsFromFlat } from "../../../extra/utils/chargeMapping.mjs";

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

//file upload function using putMultipleFiles
const uploadFilesToAzure = async (files, vehicleId, folderPath = "vehicle/") => {
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

const getSearchFilter = search =>
  search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { chassisNumber: { contains: search, mode: "insensitive" } },
          { auction: { contains: search, mode: "insensitive" } },
          { lotNumber: { contains: search, mode: "insensitive" } },
          { remarks: { contains: search, mode: "insensitive" } },
          { numberPlate: { contains: search, mode: "insensitive" } },
          { containerNumber: { contains: search, mode: "insensitive" } },
          { transportCompany: { contains: search, mode: "insensitive" } },
          { brand: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

const getOrderBy = (sortBy, sortOrder) =>
  ({
    brand: { brand: { name: sortOrder } },
  }[sortBy] || { [sortBy]: sortOrder });

// ── Filter support (Lark Base style) ─────────────────────────────────

const ALLOWED_FILTER_FIELDS = new Set([
  "chassisNumber", "lotNumber", "auction", "auctionDate", "session",
  "transportCompany", "deliverTo", "numberPlate", "containerNumber",
  "etd", "documentStatus", "memo",
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
  "titleTransferDeadline",
]);

const DECIMAL_FIELDS = new Set([
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
]);

const DATE_FIELDS = new Set(["titleTransferDeadline"]);

function getFieldDataType(field) {
  if (DECIMAL_FIELDS.has(field)) return "number";
  if (DATE_FIELDS.has(field)) return "date";
  return "string";
}

/** Get start/end of a date (for day-level equality comparisons) */
function getDateRange(date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date);   end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Build a single Prisma condition from operator + value + data type.
 * Note: doesNotContain and date isNot are special-cased in buildFilterWhere
 * because they need NOT wrappers at the clause level, not the field level.
 */
function buildCondition(dataType, operator, value) {
  if (operator === "isEmpty") return null;
  if (operator === "isNotEmpty") return { not: null };

  if (dataType === "string") {
    switch (operator) {
      case "is":       return { equals: value, mode: "insensitive" };
      case "isNot":    return { not: { equals: value, mode: "insensitive" } };
      case "contains": return { contains: value, mode: "insensitive" };
      default:         return undefined; // doesNotContain handled in buildFilterWhere
    }
  }

  if (dataType === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) return undefined;
    switch (operator) {
      case "is":             return { equals: num };
      case "isNot":          return { not: num };
      case "isGreater":      return { gt: num };
      case "isGreaterEqual": return { gte: num };
      case "isLess":         return { lt: num };
      case "isLessEqual":    return { lte: num };
      default:               return undefined;
    }
  }

  if (dataType === "date") {
    const d = new Date(value);
    if (isNaN(d.getTime())) return undefined;
    switch (operator) {
      case "is": {
        const { start, end } = getDateRange(d);
        return { gte: start, lte: end };
      }
      case "isGreater":      return { gt: d };
      case "isGreaterEqual": return { gte: d };
      case "isLess":         return { lt: d };
      case "isLessEqual":    return { lte: d };
      default:               return undefined; // isNot handled in buildFilterWhere
    }
  }

  return undefined;
}

/** Parse the filters query param and return a Prisma where fragment */
function buildFilterWhere(filtersParam) {
  if (!filtersParam) return {};

  let parsed;
  try { parsed = JSON.parse(filtersParam); } catch { return {}; }

  const { conjunction = "and", conditions } = parsed;
  if (!Array.isArray(conditions) || conditions.length === 0) return {};

  const clauses = [];

  for (const cond of conditions) {
    const { field_name, operator, value } = cond;
    if (!field_name || !operator) continue;

    // isEmpty/isNotEmpty don't need a value
    const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
    if (needsValue && (value === undefined || value === null || value === "")) continue;

    // --- Relation fields ---
    if (field_name === "brand.name") {
      // Brand is required (brandId Int, never null)
      if (operator === "isEmpty") { clauses.push({ id: -1 }); continue; }       // impossible → 0 results
      if (operator === "isNotEmpty") continue;                                     // always true → no-op
      if (operator === "doesNotContain") {
        clauses.push({ NOT: { brand: { name: { contains: value, mode: "insensitive" } } } });
        continue;
      }
      if (operator === "isNot") {
        clauses.push({ NOT: { brand: { name: { equals: value, mode: "insensitive" } } } });
        continue;
      }
      const c = buildCondition("string", operator, value);
      if (c) clauses.push({ brand: { name: c } });
      continue;
    }
    if (field_name === "customer.name") {
      // Customer is optional (customerId Int?) so isEmpty/isNotEmpty check relation existence
      if (operator === "isEmpty") { clauses.push({ customer: { is: null } }); continue; }
      if (operator === "isNotEmpty") { clauses.push({ customer: { isNot: null } }); continue; }
      if (operator === "doesNotContain") {
        clauses.push({ NOT: { customer: { name: { contains: value, mode: "insensitive" } } } });
        continue;
      }
      if (operator === "isNot") {
        clauses.push({ NOT: { customer: { name: { equals: value, mode: "insensitive" } } } });
        continue;
      }
      const c = buildCondition("string", operator, value);
      if (c) clauses.push({ customer: { name: c } });
      continue;
    }

    // --- Direct fields (whitelist check; relation fields handled above) ---
    if (!ALLOWED_FILTER_FIELDS.has(field_name)) continue;

    const dataType = getFieldDataType(field_name);

    // isEmpty → field is null
    if (operator === "isEmpty") {
      clauses.push({ [field_name]: null });
      continue;
    }

    // Operators that need NOT wrapper at clause level (can't be expressed inside a single field condition)
    if (operator === "doesNotContain" && dataType === "string") {
      clauses.push({ NOT: { [field_name]: { contains: value, mode: "insensitive" } } });
      continue;
    }
    if (operator === "isNot" && dataType === "date") {
      const d = new Date(value);
      if (isNaN(d.getTime())) continue;
      const { start, end } = getDateRange(d);
      clauses.push({ NOT: { [field_name]: { gte: start, lte: end } } });
      continue;
    }

    const prismaCondition = buildCondition(dataType, operator, value);
    if (prismaCondition !== undefined) {
      clauses.push({ [field_name]: prismaCondition });
    }
  }

  if (clauses.length === 0) return {};

  // Combine with conjunction
  const key = conjunction === "or" ? "OR" : "AND";
  return { [key]: clauses };
}

/** Build Prisma include object. Omit documents for large page sizes. */
const getIncludeRelations = (includeDocuments = true) => {
  const base = {
    company: { select: { name: true } },
    brand: { select: { name: true } },
    customer: { select: { id: true, name: true } },
    sourceInvoiceJob: { select: { id: true, DocumentURL: true } },
  };
  if (includeDocuments) {
    base.documents = { select: { id: true, Url: true, createdAt: true } };
  }
  return base;
};

/** Delete documents from Azure Blob Storage. Returns { deleted, errors }. */
const deleteDocumentsFromAzure = async (documents) => {
  let deleted = 0;
  const errors = [];
  for (const doc of documents) {
    try {
      await deleteFile(doc.Url);
      deleted++;
      console.log(`✅ Deleted from Azure: ${doc.Url}`);
    } catch (error) {
      console.error(`❌ Failed to delete from Azure: ${doc.Url}`, error);
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

  // Metadata/logistics fields
  const metadataKeys = [
    "auctionDate", "session", "transportCompany", "deliverTo",
    "numberPlate", "containerNumber", "etd", "documentStatus", "memo",
  ];
  for (const key of metadataKeys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      fields[key] = body[key];
    }
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
    const limit = Math.min(Number(rawLimit), 5000);
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

        // Paginated list (use lighter relations for large page sizes)
        const include = getIncludeRelations(limit <= 500);
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
            ...chargeFields,
          },
        });

        // Handle document uploads
        const documentFiles = req.files.documents || [];
        const uploadResult = await uploadFilesToAzure(documentFiles, vehicle.id, "vehicle/");

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
          ...chargeFields,
        };

        if (name !== "null") {
          updateData.name = name;
        }

        await prisma.vehicle.update({
          where: { id: vehicleId },
          data: updateData,
        });

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

              const azureResult = await deleteDocumentsFromAzure(docsToDelete);
              deletionErrors = azureResult.errors;
            }
          } catch (error) {
            console.error("Error processing document deletions:", error);
            deletionErrors.push({ error: error.message, context: "Failed to parse documentsToDelete" });
          }
        }

        // Handle new document uploads
        const documentFiles = req.files.documents || [];
        const uploadResult = await uploadFilesToAzure(documentFiles, vehicleId, "vehicle/");

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

        // First, get all documents associated with this vehicle BEFORE deletion
        const vehicleDocuments = await prisma.vehicleDocument.findMany({
          where: { vehicleId: id },
          select: { id: true, Url: true },
        });

        // Delete the vehicle (cascade will automatically delete documents from database)
        await prisma.vehicle.delete({ where: { id } });

        // Clean up documents from Azure Blob Storage
        const { deleted: documentsDeleted, errors: deletionErrors } = await deleteDocumentsFromAzure(vehicleDocuments);

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
