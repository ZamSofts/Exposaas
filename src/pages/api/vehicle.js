import { prisma, getSession } from "@/lib/useful";
import { putFile, deleteFile, putMultipleFiles } from "@/lib/blob.mjs";
import { processPayments, processPaymentOperations } from "./vehiclePayments.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
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
      "text/csv"
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
      mimeType: files[index].mimetype
    }));

    console.log(`✅ Successfully uploaded ${uploadedDocuments.length} files`);

    return {
      uploadedDocuments: uploadedDocuments,
      documentsUploaded: uploadedDocuments.length,
      errors: []
    };
    
  } catch (error) {
    console.error("❌ Upload failed:", error);
    return {
      uploadedDocuments: [],
      documentsUploaded: 0,
      errors: [{ fileName: "batch_upload", error: error.message }]
    };
  }
};

// Helper function to validate vehicle data
const validateVehicle = async ({ chassisNumber, brandId, companyId, statusId, vehicleId = null }) => {
  if (!chassisNumber || !brandId || !companyId || !statusId) {
    throw new Error("Missing required fields");
  }

  const [brand, status, existing] = await Promise.all([
    prisma.brand.findUnique({ where: { id: Number(brandId) } }),
    prisma.vehicleStatus.findUnique({ where: { id: Number(statusId) } }),
    prisma.vehicle.findFirst({ where: { chassisNumber, ...(vehicleId && { id: { not: vehicleId } }) } }),
  ]);

  if (!brand) throw new Error("Brand not found");
  if (!status) throw new Error("Status not found");
  if (existing) throw new Error("Chassis number already exists");
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
          { brand: { name: { contains: search, mode: "insensitive" } } },
          { status: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

const getOrderBy = (sortBy, sortOrder) =>
  ({
    brand: { brand: { name: sortOrder } },
    status: { status: { name: sortOrder } },
  }[sortBy] || { [sortBy]: sortOrder });

const includeRelations = {
  company: { select: { name: true } },
  brand: { select: { name: true } },
  status: { select: { name: true } },
  documents: { select: { id: true, Url: true, createdAt: true } },
  payments: { select: { id: true, name: true, date: true, remarks: true, url: true } },
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
    const { page = 1, limit = 10, search = "", sortBy = "id", sortOrder = "asc", col } = req.query;
    const selectFields = col ? Object.fromEntries(col.split(",").map(c => [c, true])) : undefined;
    const userFilter = session.role === "Sadmin" ? {} : { companyId: session?.companyId };

    switch (req.method) {
      case "GET": {
        // Single vehicle
        if (id) {
          const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: includeRelations });
          if (!vehicle || (session.role !== "Sadmin" && vehicle.companyId !== session?.companyId)) {
            return res.status(404).json({ error: "Vehicle not found" });
          }
          return res.json(vehicle);
        }

        const where = { ...userFilter, ...getSearchFilter(search.trim().toLowerCase()) };

        // Specific fields
        if (selectFields) {
          const vehicles = await prisma.vehicle.findMany({
            select: { ...selectFields, ...includeRelations },
            where,
            orderBy: getOrderBy(sortBy, sortOrder),
          });
          return res.json(vehicles);
        }

        // Paginated list
        const [vehicles, total] = await Promise.all([
          prisma.vehicle.findMany({
            skip: (page - 1) * limit,
            take: Number(limit),
            where,
            include: includeRelations,
            orderBy: getOrderBy(sortBy, sortOrder),
          }),
          prisma.vehicle.count({ where }),
        ]);
        return res.json({ vehicles, total });
      }

      case "PUT": {
        const { name, chassisNumber, brandId, remarks, companyId, statusId, auction, lotNumber, payments } = req.body;
        await validateVehicle({ chassisNumber, brandId, companyId, statusId });

        const vehicle = await prisma.vehicle.create({
          data: {
            name,
            chassisNumber,
            auction,
            lotNumber,
            remarks,
            brandId: Number(brandId),
            companyId: Number(companyId),
            statusId: Number(statusId),
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
              Url: doc.Url
            }))
          });
        }

        // Handle payment processing
        let paymentResult = { paymentsProcessed: 0, paymentErrors: [] };
        if (payments) {
          try {
            const paymentsData = JSON.parse(payments);
            paymentResult = await processPayments(vehicle.id, paymentsData, req.files, session);
          } catch (paymentError) {
            console.error("❌ Payment processing failed:", paymentError);
            paymentResult.paymentErrors.push({
              error: paymentError.message,
              context: "Payment data parsing"
            });
          }
        }

        const response = { 
          message: "Vehicle created successfully", 
          vehicleId: vehicle.id,
          documentsUploaded: uploadResult.documentsUploaded,
          paymentsProcessed: paymentResult.paymentsProcessed,
        };

        // Include upload errors if any
        const allErrors = [...uploadResult.errors, ...paymentResult.paymentErrors];
        if (allErrors.length > 0) {
          response.errors = allErrors;
          response.message += ` (${allErrors.length} operations had errors)`;
        }

        return res.status(201).json(response);
      }

      case "POST": {
        const { id, name, chassisNumber, brandId, remarks, companyId, statusId, auction, lotNumber, documentsToDelete, paymentOperations } = req.body;
        const vehicleId = Number(id);
        if (!vehicleId) return res.status(400).json({ error: "Valid vehicle ID required" });

        await validateVehicle({ chassisNumber, brandId, companyId, statusId, vehicleId });

        const updateData = {
          chassisNumber,
          auction,
          lotNumber,
          remarks,
          brandId: Number(brandId),
          companyId: Number(companyId),
          statusId: Number(statusId),
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
        const deletionErrors = [];
        if (documentsToDelete) {
          try {
            const idsToDelete = JSON.parse(documentsToDelete);
            if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
              // Get document URLs before deletion for Azure cleanup
              const docsToDelete = await prisma.vehicleDocument.findMany({
                where: {
                  id: { in: idsToDelete },
                  vehicleId: vehicleId // Ensure docs belong to this vehicle
                }
              });

              // Delete from database first
              const deleteResult = await prisma.vehicleDocument.deleteMany({
                where: {
                  id: { in: idsToDelete },
                  vehicleId: vehicleId
                }
              });
              
              documentsDeleted = deleteResult.count;

              // Delete from Azure Blob Storage one by one
              for (const doc of docsToDelete) {
                try {
                  await deleteFile(doc.Url);
                  console.log(`✅ Deleted from Azure: ${doc.Url}`);
                } catch (error) {
                  console.error(`❌ Failed to delete from Azure: ${doc.Url}`, error);
                  deletionErrors.push({
                    docUrl: doc.Url,
                    error: error.message
                  });
                }
              }
            }
          } catch (error) {
            console.error("Error processing document deletions:", error);
            deletionErrors.push({
              error: error.message,
              context: "Failed to parse documentsToDelete"
            });
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
              Url: doc.Url
            }))
          });
        }

        // Handle payment operations
        let paymentResult = { paymentsProcessed: 0, paymentsDeleted: 0, paymentErrors: [] };
        if (paymentOperations) {
          try {
            const operations = JSON.parse(paymentOperations);
            paymentResult = await processPaymentOperations(vehicleId, operations, req.files, session);
          } catch (paymentError) {
            console.error("❌ Payment operations failed:", paymentError);
            paymentResult.paymentErrors.push({
              error: paymentError.message,
              context: "Payment operations parsing"
            });
          }
        }
        
        const response = {
          message: "Vehicle updated successfully",
          documentsUploaded: uploadResult.documentsUploaded,
          documentsDeleted: documentsDeleted,
          paymentsProcessed: paymentResult.paymentsProcessed,
          paymentsDeleted: paymentResult.paymentsDeleted,
        };

        // Include any errors
        const allErrors = [...uploadResult.errors, ...deletionErrors, ...paymentResult.paymentErrors];
        if (allErrors.length > 0) {
          response.errors = allErrors;
          response.message += ` (${allErrors.length} operations had errors)`;
        }

        return res.json(response);
      }

      case "DELETE": {
        if (!id) return res.status(400).json({ error: "Vehicle ID required" });
        
        // First, get all documents and payments associated with this vehicle BEFORE deletion
        const [vehicleDocuments, vehiclePayments] = await Promise.all([
          prisma.vehicleDocument.findMany({
            where: { vehicleId: id },
            select: { id: true, Url: true }
          }),
          prisma.vehiclePayments.findMany({
            where: { vehicleId: id },
            select: { id: true, url: true }
          })
        ]);

        // Delete the vehicle (cascade will automatically delete documents and payments from database)
        await prisma.vehicle.delete({ where: { id } });

        // Clean up documents from Azure Blob Storage
        let documentsDeleted = 0;
        let paymentsDeleted = 0;
        const deletionErrors = [];
        
        // Delete vehicle documents from Azure
        if (vehicleDocuments.length > 0) {
          for (const doc of vehicleDocuments) {
            try {
              await deleteFile(doc.Url);
              documentsDeleted++;
              console.log(`✅ Deleted document from Azure: ${doc.Url}`);
            } catch (error) {
              console.error(`❌ Failed to delete document from Azure: ${doc.Url}`, error);
              deletionErrors.push({
                type: "document",
                docUrl: doc.Url,
                error: error.message
              });
            }
          }
        }

        // Delete payment files from Azure
        if (vehiclePayments.length > 0) {
          for (const payment of vehiclePayments) {
            if (payment.url) {
              try {
                await deleteFile(payment.url);
                paymentsDeleted++;
                console.log(`✅ Deleted payment file from Azure: ${payment.url}`);
              } catch (error) {
                console.error(`❌ Failed to delete payment file from Azure: ${payment.url}`, error);
                deletionErrors.push({
                  type: "payment",
                  fileUrl: payment.url,
                  error: error.message
                });
              }
            }
          }
        }

        const response = { 
          message: "Vehicle deleted successfully",
          documentsDeleted: documentsDeleted,
          paymentsDeleted: paymentsDeleted
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
    const status = error.message.includes("not found") ? 404 : 
                  error.message.includes("already exists") ? 409 : 
                  error.message.includes("required") ? 400 : 500;
    res.status(status).json({ error: error.message || "Internal server error" });
  }
}
