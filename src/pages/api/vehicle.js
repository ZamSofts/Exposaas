import { prisma, getSession } from "@/lib/useful";
import { putFile, deleteFile } from "@/lib/blob.mjs";
import multer from "multer";
import fs from "fs";
import path from "path";

// Setup file upload
const uploadDir = path.join(process.cwd(), "uploads", "vehicles-doc");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Invalid file type"), allowed.includes(file.mimetype));
  },
}).array("documents", 15);

export const config = { api: { bodyParser: false } };

// Utilities
const cleanupFiles = files =>
  files?.forEach(file => {
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.warn("Cleanup failed:", e.message);
    }
  });

const parseFormData = req =>
  new Promise((resolve, reject) => {
    upload(req, {}, err => {
      if (err) {
        cleanupFiles(req.files);
        reject(err);
      } else {
        resolve({ files: req.files || [], body: req.body || {} });
      }
    });
  });

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
};

export default async function handler(req, res) {
  const session = await getSession(req, res);
  let uploadedFiles = [];

  try {
    // Handle file uploads
    if (["PUT", "POST"].includes(req.method)) {
      const { files, body } = await parseFormData(req);
      req.files = uploadedFiles = files;
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
        const { name, chassisNumber, brandId, remarks, companyId, statusId, auction, lotNumber } = req.body;
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

        if (uploadedFiles.length) {
          await Promise.all(uploadedFiles.map(file => putFile(file)));
        }

        cleanupFiles(uploadedFiles); // Clean files after processing
        return res.status(201).json({ message: "Vehicle created", vehicleId: vehicle.id });
      }

      case "POST": {
        const { id, name, chassisNumber, brandId, remarks, companyId, statusId, auction, lotNumber } = req.body;
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

        if (uploadedFiles.length) cleanupFiles(uploadedFiles);
        return res.json({ message: "Vehicle updated" });
      }

      case "DELETE": {
        if (!id) return res.status(400).json({ error: "Vehicle ID required" });
        await prisma.vehicle.delete({ where: { id } });
        return res.json({ message: "Vehicle deleted" });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("API error:", error);
    cleanupFiles(uploadedFiles);
    const status = error.message.includes("not found") ? 404 : error.message.includes("already exists") ? 409 : error.message.includes("required") ? 400 : 500;
    res.status(status).json({ error: error.message || "Internal server error" });
  }
}
