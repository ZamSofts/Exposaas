import { prisma, getSession } from "@/lib/useful";
import multer from "multer";
import fs from "fs";
import path from "path";

const uploadDir = path.join(process.cwd(), "uploads", "vehicles-doc");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images, and documents
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, PNG, DOC, DOCX files are allowed!"), false);
    }
  },
}).array("documents", 15); // Allow up to 15 files

export const config = {
  api: { 
    bodyParser: false // Disable default body parser for file uploads
  },
};

// Helper function to parse multipart form data
const parseFormData = (req) => {
  return new Promise((resolve, reject) => {
    upload(req, {}, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          files: req.files || [],
          body: req.body || {}
        });
      }
    });
  });
};

// Helper function to save file information to database
const saveVehicleDocuments = async (vehicleId, files) => {
  if (!files || files.length === 0) return [];

  const documentData = files.map(file => ({
    vehicleId: vehicleId,
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
  }));

  // Save to database (you'll need to create a VehicleDocument model in your schema)
  // const savedDocuments = await prisma.vehicleDocument.createMany({
  //   data: documentData
  // });
  console.log('received documents :', documentData.length);
  return documentData;
};


const getOrderBy = (sortBy, sortOrder) => {
  if (sortBy === "brand") {
    return { brand: { name: sortOrder } };
  }
  if (sortBy === "status") {
    return { status: { name: sortOrder } };
  }
  // Add other relation-based sorting if needed
  return { [String(sortBy)]: String(sortOrder) };
};

export default async function handler(req, res) {
  const session = await getSession(req, res);

  // Handle file uploads for PUT and POST methods
  if (req.method === "PUT" || req.method === "POST") {
    try {
      const { files, body } = await parseFormData(req);
      req.files = files;
      req.body = body;
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map(c => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      const userCompanyId = session?.companyId;
      const filterByCompany = session.role === "Sadmin" ? {} : { companyId: userCompanyId };

      // ---- Load single vehicle ----
      if (id) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id },
          include: {
            company: { select: { name: true } },
            brand: { select: { name: true } },
            status: { select: { name: true } },
          },
        });

        if (!vehicle || (session.role !== "Sadmin" && vehicle.companyId !== userCompanyId)) {
          return res.status(404).json({ error: "Vehicle not found" });
        }

        return res.status(200).json(vehicle);
      }

      // ---- Specific fields ----
      if (selectFields) {
        const vehicles = await prisma.vehicle.findMany({
          select: {
            ...selectFields,
            company: { select: { name: true } },
            brand: { select: { name: true } },
            status: { select: { name: true } },
          },
          where: {
            ...filterByCompany,
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { chassisNumber: { contains: search, mode: "insensitive" } },
                    { auction: { contains: search, mode: "insensitive" } },
                    { lotNumber: { contains: search, mode: "insensitive" } },
                    { remarks: { contains: search, mode: "insensitive" } },
                    { brand: { name: { contains: search, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
          orderBy: getOrderBy(sortBy, sortOrder),
        });

        return res.status(200).json(vehicles);
      }

      // ---- All with pagination ----
      const searchFilter = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { chassisNumber: { contains: search, mode: "insensitive" } },
              { auction: { contains: search, mode: "insensitive" } },
              { lotNumber: { contains: search, mode: "insensitive" } },
              { remarks: { contains: search, mode: "insensitive" } },
              { brand: { name: { contains: search, mode: "insensitive" } } },
              { status: { name: { contains: search, mode: "insensitive" } } }, // <-- Add this line
            ],
          }
        : {};

      const where = {
        ...filterByCompany,
        ...searchFilter,
      };

      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: getOrderBy(sortBy, sortOrder),
          where,
          include: {
            company: { select: { name: true } },
            brand: { select: { name: true } },
            status: { select: { name: true } },
          },
        }),
        prisma.vehicle.count({ where }),
      ]);

      return res.status(200).json({ vehicles, total });
    }

    if (req.method === "PUT") {
      const { name, chassisNumber, brandId, remarks, companyId, statusId, auction, lotNumber } = req.body;
      const uploadedFiles = req.files || [];

      if (!chassisNumber) return res.status(400).json({ error: "Chassis number is required" });
      if (!brandId) return res.status(400).json({ error: "Brand is required" });
      if (!companyId) return res.status(400).json({ error: "Company is required" });
      if (!statusId) return res.status(400).json({ error: "Status is required" });

      // ensure brand exists
      const brandExists = await prisma.brand.findUnique({ where: { id: Number(brandId) } });
      if (!brandExists) return res.status(404).json({ error: "Brand not found" });

      // ensure status exists
      const statusExists = await prisma.vehicleStatus.findUnique({ where: { id: Number(statusId) } });
      if (!statusExists) return res.status(404).json({ error: "Status not found" });

      const exists = await prisma.vehicle.findUnique({ where: { chassisNumber } });
      if (exists) return res.status(409).json({ error: "Chassis number already exists" });

      const vehicle = await prisma.vehicle.create({
        data: {
          name,
          chassisNumber,
          brandId: Number(brandId),
          remarks,
          companyId: Number(companyId),
          statusId: Number(statusId),
          auction,
          lotNumber,
        },
      });

      // Save uploaded documents
      if (uploadedFiles.length > 0) {
        await saveVehicleDocuments(vehicle.id, uploadedFiles);
      }

      res.status(201).json({ 
        message: "Vehicle created successfully",
        vehicleId: vehicle.id,
        documentsUploaded: uploadedFiles.length
      });
    }

    if (req.method === "POST") {
      const { id, name, chassisNumber, brandId, remarks, companyId, statusId, auction, lotNumber } = req.body;
      const uploadedFiles = req.files || [];

      if (!id) return res.status(400).json({ error: "Vehicle ID is required" });

      // Convert id to number
      const vehicleId = Number(id);
      if (isNaN(vehicleId)) return res.status(400).json({ error: "Invalid vehicle ID" });

      if (!chassisNumber) return res.status(400).json({ error: "Chassis number is required" });
      if (!brandId) return res.status(400).json({ error: "Brand is required" });
      if (!companyId) return res.status(400).json({ error: "Company is required" });
      if (!statusId) return res.status(400).json({ error: "Status is required" });

      // ensure brand exists
      const brandExists = await prisma.brand.findUnique({ where: { id: Number(brandId) } });
      if (!brandExists) return res.status(404).json({ error: "Brand not found" });

      // ensure status exists
      const statusExists = await prisma.vehicleStatus.findUnique({ where: { id: Number(statusId) } });
      if (!statusExists) return res.status(404).json({ error: "Status not found" });

      const exists = await prisma.vehicle.findFirst({
        where: { chassisNumber, id: { not: vehicleId } },
      });
      if (exists) return res.status(409).json({ error: "Chassis number already exists" });

      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          name,
          chassisNumber,
          auction,
          lotNumber,
          brandId: Number(brandId),
          remarks,
          companyId: Number(companyId),
          statusId: Number(statusId),
        },
      });

      // Save uploaded documents (append to existing ones)
      if (uploadedFiles.length > 0) {
        await saveVehicleDocuments(vehicleId, uploadedFiles);
      }

      res.status(200).json({ 
        message: "Vehicle updated successfully",
        documentsUploaded: uploadedFiles.length
      });
    }

    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Vehicle ID is required" });

      await prisma.vehicle.delete({ where: { id: Number(id) } });

      res.status(200).json({ message: "Vehicle deleted successfully" });
    }
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
