import { prisma, getSession } from "@/lib/useful";
import { putFile, deleteFile } from "@/lib/blob.mjs";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 1, // Maximum 1 file per payment
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
      "text/csv",
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error("Invalid file type"), allowed.includes(file.mimetype));
  },
}).single("document"); // Single file upload for payment document

export const config = { api: { bodyParser: false } };

// Utilities
const parseFormData = req =>
  new Promise((resolve, reject) => {
    upload(req, {}, err => {
      if (err) {
        reject(err);
      } else {
        resolve({ file: req.file, body: req.body || {} });
      }
    });
  });

// File upload function
const uploadFileToAzure = async (file, folderPath = "payment/") => {
  if (!file) {
    return { uploadedFile: null, fileUploaded: false, error: null };
  }

  try {
    const uploadResult = await putFile(file, folderPath);

    console.log(`✅ Successfully uploaded payment document: ${uploadResult.url}`);

    return {
      uploadedFile: {
        url: uploadResult.url,
        fileName: file.originalname,
        fileSize: file.buffer.length,
        mimeType: file.mimetype,
      },
      fileUploaded: true,
      error: null,
    };
  } catch (error) {
    console.error("❌ Upload failed:", error);
    return {
      uploadedFile: null,
      fileUploaded: false,
      error: { fileName: file.originalname, error: error.message },
    };
  }
};

// Helper function to validate payment data
const validatePayment = async ({ name, date, vehicleId, paymentId = null }) => {
  if (!name || !vehicleId) {
    throw new Error("name and vehicleId are required");
  }

  // Check if vehicle exists and user has access
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: Number(vehicleId) },
    select: { id: true, companyId: true },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  return vehicle;
};

const getSearchFilter = search => {
  if (!search) return {};

  const searchConditions = [];

  // Search by ID (exact match if numeric)
  if (!isNaN(Number(search))) {
    searchConditions.push({ id: { equals: Number(search) } });
  }

  // Search by name (case insensitive)
  searchConditions.push({ name: { contains: search, mode: "insensitive" } });

  // Search by remarks (case insensitive, handle null)
  searchConditions.push({
    remarks: {
      not: null,
      contains: search,
      mode: "insensitive",
    },
  });

  return { OR: searchConditions };
};

const getOrderBy = (sortBy, sortOrder) =>
  ({
    vehicleName: { vehicle: { name: sortOrder } },
    paymentId: { id: sortOrder },
    paymentName: { name: sortOrder },
    paymentDate: { date: sortOrder },
    paymentRemarks: { remarks: sortOrder },
  }[sortBy] || { [sortBy]: sortOrder });

export default async function handler(req, res) {
  const session = await getSession(req, res);

  try {
    // Handle file uploads for PUT and POST methods
    if (["PUT", "POST"].includes(req.method)) {
      const { file, body } = await parseFormData(req);
      req.file = file;
      req.body = body;
    }

    const id = Number(req.query.id);
    const vehicleId = Number(req.query.vehicleId);
    const { page = 1, limit = 10, search = "", sortBy = "id", sortOrder = "desc", col } = req.query;
    const selectFields = col ? Object.fromEntries(col.split(",").map(c => [c, true])) : undefined;
    const userFilter = session.role === "Sadmin" ? {} : { vehicle: { companyId: session?.companyId } };

    if (req.method === "GET") {
      // Single payment
      if (id) {
        const payment = await prisma.vehiclePayments.findUnique({
          where: { id },
          include: { vehicle: { select: { companyId: true } } },
        });

        if (!payment) {
          return res.status(404).json({ error: "Payment not found" });
        }

        // Remove vehicle data from response, keep only payment data
        const { vehicle, ...paymentData } = payment;
        return res.json(paymentData);
      }

      // Payments for specific vehicle
      if (vehicleId) {
        // Check if user has access to this vehicle
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: vehicleId },
          select: { companyId: true },
        });

        if (!vehicle) {
          return res.status(404).json({ error: "Vehicle not found or access denied" });
        }

        // Build where clause for vehicle payments with search
        const searchFilter = getSearchFilter(search.trim().toLowerCase());
        const whereClause = searchFilter.OR
          ? {
              AND: [{ vehicleId }, searchFilter],
            }
          : { vehicleId };

        // Get payments with pagination support
        if (page && limit) {
          const [payments, total] = await Promise.all([
            prisma.vehiclePayments.findMany({
              skip: (page - 1) * limit,
              take: Number(limit),
              where: whereClause,
              orderBy: getOrderBy(sortBy, sortOrder),
            }),
            prisma.vehiclePayments.count({ where: whereClause }),
          ]);

          return res.json({ payments, total });
        } else {
          // Get all payments without pagination
          const payments = await prisma.vehiclePayments.findMany({
            where: whereClause,
            orderBy: getOrderBy(sortBy, sortOrder),
          });

          return res.json(payments);
        }
      }

      const searchFilter = getSearchFilter(search.trim().toLowerCase());
      const where = searchFilter.OR
        ? {
            AND: [userFilter, searchFilter],
          }
        : userFilter;

      // Specific fields
      if (selectFields) {
        const payments = await prisma.vehiclePayments.findMany({
          select: selectFields,
          where,
          orderBy: getOrderBy(sortBy, sortOrder),
        });
        return res.json(payments);
      }

      // Paginated list
      const [payments, total] = await Promise.all([
        prisma.vehiclePayments.findMany({
          skip: (page - 1) * limit,
          take: Number(limit),
          where,
          orderBy: getOrderBy(sortBy, sortOrder),
        }),
        prisma.vehiclePayments.count({ where }),
      ]);
      return res.json({ payments, total });
    }

    if (req.method === "PUT") {
      const { name, amount, date, remarks, vehicleId, docURL } = req.body;

      const vehicle = await validatePayment({ name, date, vehicleId });

      // Validate amount
      if (amount === undefined || amount === null || amount === '') {
        return res.status(400).json({ error: "Amount is required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        return res.status(400).json({ error: "Amount must be a valid number" });
      }

      // Handle file upload
      let fileUrl = docURL || null;
      let uploadError = null;

      if (req.file) {
        const uploadResult = await uploadFileToAzure(req.file, "payment/");

        if (uploadResult.fileUploaded) {
          fileUrl = uploadResult.uploadedFile.url;
        } else {
          uploadError = uploadResult.error;
        }
      }

      const payment = await prisma.vehiclePayments.create({
        data: {
          name,
          amount: parsedAmount,
          date: date ? new Date(date) : null,
          remarks: remarks || null,
          vehicleId: Number(vehicleId),
          url: fileUrl,
        },
      });

      const response = {
        message: "Payment created successfully",
        paymentId: payment.id,
        fileUploaded: !!fileUrl,
      };

      if (uploadError) {
        response.fileError = uploadError;
        response.message += ` (File upload failed)`;
      }

      return res.status(201).json(response);
    }

    if (req.method === "POST") {
      const { id, name, amount, date, remarks, vehicleId, removeDocument } = req.body;
      const paymentId = Number(id);

      if (!paymentId) {
        return res.status(400).json({ error: "Valid payment ID required" });
      }

      // Validate amount
      if (amount === undefined || amount === null || amount === '') {
        return res.status(400).json({ error: "Amount is required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        return res.status(400).json({ error: "Amount must be a valid number" });
      }

      const vehicle = await validatePayment({ name, date, vehicleId, paymentId });

      // Check if payment exists and user has access
      const existingPayment = await prisma.vehiclePayments.findUnique({
        where: { id: paymentId },
        include: { vehicle: { select: { companyId: true } } },
      });

      if (!existingPayment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      let fileUrl = existingPayment.url; // Keep existing URL by default
      let fileUploaded = false;
      let uploadError = null;
      let oldFileUrl = null;

      // Handle document removal
      if (removeDocument === "true") {
        oldFileUrl = existingPayment.url; // Store for cleanup
        fileUrl = null; // Remove the document
        console.log(`📝 Document removal requested for payment ${paymentId}`);
      }

      // Handle new file upload (this takes precedence over removal)
      if (req.file) {
        const uploadResult = await uploadFileToAzure(req.file, "payment/");

        if (uploadResult.fileUploaded) {
          if (!oldFileUrl) {
            oldFileUrl = existingPayment.url; // Store old URL for cleanup if not already set
          }
          fileUrl = uploadResult.uploadedFile.url;
          fileUploaded = true;
        } else {
          uploadError = uploadResult.error;
        }
      }

      const updatedPayment = await prisma.vehiclePayments.update({
        where: { id: paymentId },
        data: {
          name,
          amount: parsedAmount,
          date: date ? new Date(date) : null,
          remarks: remarks || null,
          vehicleId: Number(vehicleId),
          url: fileUrl,
        },
      });

      // Clean up old file if a new one was uploaded or document was removed
      if (oldFileUrl && (fileUploaded || removeDocument === "true")) {
        try {
          await deleteFile(oldFileUrl);
          console.log(`✅ Deleted old payment file from Azure: ${oldFileUrl}`);
        } catch (error) {
          console.error(`❌ Failed to delete old payment file from Azure: ${oldFileUrl}`, error);
        }
      }

      const response = {
        message: "Payment updated successfully",
        fileUploaded: fileUploaded,
        documentRemoved: removeDocument === "true" && !fileUploaded, // Only true if document was removed and no new file uploaded
      };

      if (uploadError) {
        response.fileError = uploadError;
        response.message += ` (File upload failed)`;
      }

      return res.json(response);
    }

    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Payment ID required" });

      // Get payment with vehicle info before deletion
      const payment = await prisma.vehiclePayments.findUnique({
        where: { id },
        include: { vehicle: { select: { companyId: true } } },
      });

      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Delete the payment from database
      await prisma.vehiclePayments.delete({ where: { id } });

      // Clean up file from Azure Blob Storage if it exists
      let fileDeleted = false;
      let fileDeletionError = null;

      if (payment.url) {
        try {
          await deleteFile(payment.url);
          fileDeleted = true;
          console.log(`✅ Deleted payment file from Azure: ${payment.url}`);
        } catch (error) {
          console.error(`❌ Failed to delete payment file from Azure: ${payment.url}`, error);
          fileDeletionError = {
            fileUrl: payment.url,
            error: error.message,
          };
        }
      }

      const response = {
        message: "Payment deleted successfully",
        fileDeleted: fileDeleted,
      };

      if (fileDeletionError) {
        response.fileDeletionError = fileDeletionError;
        response.message += ` (File deletion failed)`;
      }

      return res.json(response);
    }

    // Handle unsupported HTTP methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("already exists")
      ? 409
      : error.message.includes("required")
      ? 400
      : error.message.includes("Access denied")
      ? 403
      : 500;
    res.status(status).json({ error: error.message || "Internal server error" });
  }
}
