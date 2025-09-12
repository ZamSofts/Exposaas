import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  
  if (session.role === "Sadmin") {
    return res.status(403).json({ error: "Access denied: Sadmin users cannot access customer operations" });
  }
  
  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 5;
  const search = String(req.query.search || "").trim().toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map((c) => [c, true])) : undefined;

  try {
    if (req.method === "GET") {

      // filter depends on role
      const filterByCompany = {companyId: session?.companyId };

      // ---- Load single customer ----
      if (id) {
        const customer = await prisma.customer.findUnique({
          where: { id },
          include: {
            company: { select: { name: true } },
            vehicles: { 
              select: { 
                id: true, 
                name: true, 
                chassisNumber: true 
              } 
            },
          },
        });

        if (!customer || customer.companyId !== session?.companyId) {
          return res.status(404).json({ error: "Customer not found" });
        }

        return res.status(200).json({
          id: customer.id,
          name: customer.name,
          country: customer.country,
          uniqueId: customer.uniqueId,
          companyId: customer.companyId,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          company: customer.company,
          vehicles: customer.vehicles,
          vehicleCount: customer.vehicles.length,
        });
      }

      // ---- Specific fields ----
      if (selectFields) {
        const customers = await prisma.customer.findMany({
          select: {
            ...selectFields,
            vehicles: { select: { id: true } }, // Include vehicle count
          },
          where: {
            ...filterByCompany,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { uniqueId: { contains: search, mode: "insensitive" } },
              { country: { contains: search, mode: "insensitive" } },
            ],
          },
          orderBy: { [sortBy]: sortOrder },
        });

        const formatted = customers.map((c) => ({
          ...c,
          vehicleCount: c.vehicles?.length || 0,
        }));

        return res.status(200).json(formatted);
      }

      // ---- All with pagination ----
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: {
            ...filterByCompany,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { uniqueId: { contains: search, mode: "insensitive" } },
              { country: { contains: search, mode: "insensitive" } },
            ],
          },
          include: {
            company: { select: { name: true } },
            vehicles: { 
              select: { 
                id: true, 
                name: true, 
                chassisNumber: true 
              } 
            },
          },
        }),
        prisma.customer.count({
          where: {
            ...filterByCompany,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { uniqueId: { contains: search, mode: "insensitive" } },
              { country: { contains: search, mode: "insensitive" } },
            ],
          },
        }),
      ]);

      const formatted = customers.map((c) => ({
        id: c.id,
        name: c.name,
        country: c.country,
        uniqueId: c.uniqueId,
        companyId: c.companyId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        company: c.company,
        vehicles: c.vehicles,
        vehicleCount: c.vehicles.length,
      }));

      return res.status(200).json({ customer: formatted, total });
    }

    if (req.method === "PUT") {
      const { name, country, uniqueId, companyId } = req.body;
      
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Customer name is required" });
      }
      if (!uniqueId || uniqueId.trim() === "") {
        return res.status(400).json({ error: "Unique ID is required" });
      }
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      // Check if uniqueId already exists for this company
      const existingCustomer = await prisma.customer.findFirst({
        where: { 
          uniqueId: { equals: uniqueId.trim(), mode: "insensitive" },
          companyId: Number(companyId)
        },
        select: { uniqueId: true, companyId: true },
      });

      if (existingCustomer) {
        return res.status(409).json({ error: "Unique ID already exists for this company" });
      }

      // Check if company exists and user has access
      if (Number(companyId) !== session.companyId) {
        return res.status(403).json({ error: "Access denied: Cannot create customer for different company" });
      }

      const customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          country: country?.trim() || null,
          uniqueId: uniqueId.trim(),
          companyId: Number(companyId),
        },
        include: {
          company: { select: { name: true } },
        },
      });

      res.status(201).json({
        message: "Customer created successfully",
        customer: {
          id: customer.id,
          name: customer.name,
          country: customer.country,
          uniqueId: customer.uniqueId,
          companyId: customer.companyId,
          company: customer.company,
        },
      });
    }

    if (req.method === "POST") {
      const { id, name, country, uniqueId, companyId } = req.body;
      
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Customer name is required" });
      }
      if (!uniqueId || uniqueId.trim() === "") {
        return res.status(400).json({ error: "Unique ID is required" });
      }
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      // Check if uniqueId already exists for this company (excluding current customer)
      const existingCustomer = await prisma.customer.findFirst({
        where: { 
          uniqueId: { equals: uniqueId.trim(), mode: "insensitive" },
          companyId: Number(companyId),
          id: { not: id }
        },
      });

      if (existingCustomer) {
        return res.status(409).json({ error: "Unique ID already exists for this company" });
      }

      // Check if user has access to update this customer
      const currentCustomer = await prisma.customer.findUnique({
        where: { id },
        select: { companyId: true },
      });

      if (!currentCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      if (currentCustomer.companyId !== session.companyId || Number(companyId) !== session.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedCustomer = await prisma.customer.update({
        where: { id },
        data: {
          name: name.trim(),
          country: country?.trim() || null,
          uniqueId: uniqueId.trim(),
          companyId: Number(companyId),
        },
        include: {
          company: { select: { name: true } },
          vehicles: { 
            select: { 
              id: true, 
              name: true, 
              chassisNumber: true 
            } 
          },
        },
      });

      res.status(200).json({ 
        message: "Customer updated successfully",
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          country: updatedCustomer.country,
          uniqueId: updatedCustomer.uniqueId,
          companyId: updatedCustomer.companyId,
          company: updatedCustomer.company,
          vehicles: updatedCustomer.vehicles,
        },
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const customerId = Number(id);

      // Check if customer exists and user has access
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { companyId: true },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      if (customer.companyId !== session.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if customer has associated vehicles
      const vehicleCount = await prisma.vehicle.count({
        where: { customerId },
      });

      if (vehicleCount > 0) {
        return res.status(400).json({ 
          error: `Cannot delete customer. ${vehicleCount} vehicle(s) are still associated with this customer. Please reassign or remove the vehicles first.` 
        });
      }

      // Delete the customer
      await prisma.customer.delete({ 
        where: { id: customerId } 
      });
      
      res.status(200).json({
        message: "Customer deleted successfully",
      });
    }

    // Handle unsupported HTTP methods
    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("Customer API error:", error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(409).json({ error: "Unique constraint violation: This combination already exists" });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
}
