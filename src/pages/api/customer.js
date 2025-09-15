import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 5;
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map(c => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      // Customers are linked to Users; restrict to customers whose user belongs to same company
      const companyFilter = { user: { companyId: session?.companyId } };

      // ---- Load single customer ----
      if (id) {
        const customer = await prisma.customer.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, username: true, companyId: true, password: true } },
            vehicles: {
              select: { id: true, name: true, chassisNumber: true },
            },
          },
        });

        if (!customer || customer.user?.companyId !== session?.companyId) {
          return res.status(404).json({ error: "Customer not found" });
        }

        return res.status(200).json({
          id: customer.id,
          name: customer.name,
          country: customer.country,
          uniqueId: customer.uniqueId,
          username: customer.user.username,
          password: customer.user.password,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          vehicles: customer.vehicles,
          vehicleCount: customer.vehicles.length,
        });
      }

      // ---- Specific fields ----
      if (selectFields) {
        const customers = await prisma.customer.findMany({
          select: {
            ...selectFields,
            vehicles: { select: { id: true } },
            user: { select: { id: true, username: true, companyId: true } },
          },
          where: {
            AND: [
              companyFilter,
              {
                OR: [{ name: { contains: search, mode: "insensitive" } }, { uniqueId: { contains: search, mode: "insensitive" } }, { country: { contains: search, mode: "insensitive" } }],
              },
            ],
          },
          orderBy: { [sortBy]: sortOrder },
        });

        const formatted = customers.map(c => ({
          ...c,
          vehicleCount: c.vehicles?.length || 0,
        }));

        return res.status(200).json(formatted);
      }

      // ---- All with pagination ----
      const whereClause = {
        AND: [
          companyFilter,
          {
            OR: [{ name: { contains: search, mode: "insensitive" } }, { uniqueId: { contains: search, mode: "insensitive" } }, { country: { contains: search, mode: "insensitive" } }],
          },
        ],
      };

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: whereClause,
          include: {
            user: { select: { id: true, username: true, password: true } },
            vehicles: { select: { id: true, name: true, chassisNumber: true } },
          },
        }),
        prisma.customer.count({ where: whereClause }),
      ]);

      const formatted = customers.map(c => ({
        id: c.id,
        name: c.name,
        country: c.country,
        uniqueId: c.uniqueId,
        username: c.user.username,
        password: c.user.password,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        vehicles: c.vehicles,
        vehicleCount: c.vehicles.length,
      }));

      return res.status(200).json({ customer: formatted, total });
    }

    if (req.method === "PUT") {
      // Create customer (frontend sends: username, password, name, uniqueId, companyId, country)
      const { name, country, uniqueId, username, password, companyId } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Customer name is required" });
      }
      if (!uniqueId || uniqueId.trim() === "") {
        return res.status(400).json({ error: "Unique ID is required" });
      }
      if (!username || username.trim() === "") {
        return res.status(400).json({ error: "Username is required" });
      }
      if (!password || password.trim() === "") {
        return res.status(400).json({ error: "Password is required" });
      }
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      // Check if uniqueId already exists globally
      const existingByUnique = await prisma.customer.findFirst({
        where: { uniqueId: { equals: uniqueId.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (existingByUnique) {
        return res.status(409).json({ error: "Unique ID already exists" });
      }

      // Check if username already exists
      const existingUser = await prisma.user.findUnique({ where: { username: username.trim() } });
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }

      // Ensure companyId matches session.companyId
      if (Number(companyId) !== session.companyId) {
        return res.status(403).json({ error: "Access denied: Cannot create customer for different company" });
      }
      const customerRole = await prisma.role.findFirst({
        where: { name: "customer", companyId: null },
      });
      
      if (!customerRole) {
        return res.status(500).json({ error: "System role 'customer' not found. Please run seed." });
      }
      // Create user and customer in a transaction
      const result = await prisma.$transaction(async tx => {
        const user = await tx.user.create({ data: { username: username.trim(), password: password.trim(), companyId: Number(companyId) } });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: customerRole.id,
          },
        });

        await tx.customer.create({
          data: {
            name: name.trim(),
            country: country?.trim() || null,
            uniqueId: uniqueId.trim(),
            userId: user.id,
          },
        });
      });

      return res.status(201).json({ message: "Customer created successfully" });
    }

    if (req.method === "POST") {
      // Update customer (frontend sends: id, username, password (optional), name, uniqueId, companyId, country)
      const { id, name, country, uniqueId, username, password, companyId } = req.body;
      const customerId = Number(id);

      if (!customerId) {
        return res.status(400).json({ error: "Customer id is required" });
      }
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Customer name is required" });
      }
      if (!uniqueId || uniqueId.trim() === "") {
        return res.status(400).json({ error: "Unique ID is required" });
      }
      if (!username || username.trim() === "") {
        return res.status(400).json({ error: "Username is required" });
      }
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      const currentCustomer = await prisma.customer.findUnique({ where: { id: customerId }, include: { user: { select: { id: true, companyId: true } } } });
      if (!currentCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (currentCustomer.user?.companyId !== session.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check uniqueId not used by another customer
      const existingByUnique = await prisma.customer.findFirst({ where: { uniqueId: { equals: uniqueId.trim(), mode: "insensitive" }, id: { not: customerId } } });
      if (existingByUnique) {
        return res.status(409).json({ error: "Unique ID already exists" });
      }

      // Check username uniqueness (excluding current user)
      const existingUserByName = await prisma.user.findFirst({ where: { username: username.trim(), id: { not: currentCustomer.user?.id } } });
      if (existingUserByName) {
        return res.status(409).json({ error: "Username already exists" });
      }

      // Ensure companyId matches session.companyId
      if (Number(companyId) !== session.companyId) {
        return res.status(403).json({ error: "Access denied: Cannot assign customer to different company" });
      }

      // Update user (password optional) and customer in a transaction
      const result = await prisma.$transaction(async tx => {
        // Update user
        const userUpdateData = { username: username.trim() };
        if (password && password.trim() !== "") userUpdateData.password = password.trim();

        const updatedUser = await tx.user.update({ where: { id: currentCustomer.user.id }, data: userUpdateData });

        // Update customer
        const updatedCustomer = await tx.customer.update({
          where: { id: customerId },
          data: {
            name: name.trim(),
            country: country?.trim() || null,
            uniqueId: uniqueId.trim(),
          },
          include: { user: { select: { id: true, username: true } }, vehicles: { select: { id: true, name: true, chassisNumber: true } } },
        });

        return { updatedUser, updatedCustomer };
      });

      return res.status(200).json({ message: "Customer updated successfully", customer: result.updatedCustomer });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const customerId = Number(id);

      if (!customerId) {
        return res.status(400).json({ error: "Customer id is required" });
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { user: { select: { companyId: true } } } });
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (customer.user?.companyId !== session.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const vehicleCount = await prisma.vehicle.count({ where: { customerId } });
      if (vehicleCount > 0) {
        return res.status(400).json({ error: `Cannot delete customer. ${vehicleCount} vehicle(s) are still associated with this customer. Please reassign or remove the vehicles first.` });
      }

      const deletedCustomer = await prisma.customer.delete({ where: { id: customerId } });
      await prisma.user.delete({ where: { id: deletedCustomer.userId } });
      return res.status(200).json({ message: "Customer deleted successfully" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Customer API error:", error);
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Unique constraint violation: This value already exists" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
