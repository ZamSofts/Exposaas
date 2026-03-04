import { prisma, getSession } from "@/lib/useful";
import { hashPassword } from "@/lib/password";

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
      const companyFilter = { companyId: session?.companyId };

      // ---- Load single customer ----
      if (id) {
        const customer = await prisma.customer.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, username: true } },
            vehicles: {
              select: { id: true, name: true, chassisNumber: true },
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
          username: customer.user?.username || null,
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
            user: { select: { id: true, username: true } },
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
        username: c.user?.username || null,
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
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      // Ensure companyId matches session.companyId
      if (Number(companyId) !== session.companyId) {
        return res.status(403).json({ error: "Access denied: Cannot create customer for different company" });
      }

      // Check if uniqueId already exists for this company
      const existingByUnique = await prisma.customer.findFirst({
        where: { companyId: Number(companyId), uniqueId: { equals: uniqueId.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (existingByUnique) {
        return res.status(409).json({ error: "Unique ID already exists" });
      }

      const hasCredentials = username && username.trim() !== "" && password && password.trim() !== "";

      if (hasCredentials) {
        // Check if username already exists
        const existingUser = await prisma.user.findUnique({ where: { username: username.trim() } });
        if (existingUser) {
          return res.status(409).json({ error: "Username already exists" });
        }

        const customerRole = await prisma.role.findFirst({
          where: { name: { equals: "Customer", mode: "insensitive" }, companyId: null },
        });
        if (!customerRole) {
          return res.status(500).json({ error: "System role 'customer' not found. Please run seed." });
        }

        // Create user and customer in a transaction
        await prisma.$transaction(async tx => {
          const user = await tx.user.create({ data: { username: username.trim(), password: await hashPassword(password.trim()), companyId: Number(companyId) } });
          await tx.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });
          await tx.customer.create({
            data: {
              name: name.trim(),
              country: country?.trim() || null,
              uniqueId: uniqueId.trim(),
              userId: user.id,
              companyId: Number(companyId),
            },
          });
        });
      } else {
        // Create customer without user account
        await prisma.customer.create({
          data: {
            name: name.trim(),
            country: country?.trim() || null,
            uniqueId: uniqueId.trim(),
            companyId: Number(companyId),
          },
        });
      }

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
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      const currentCustomer = await prisma.customer.findUnique({ where: { id: customerId }, include: { user: { select: { id: true } } } });
      if (!currentCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (currentCustomer.companyId !== session.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check uniqueId not used by another customer in same company
      const existingByUnique = await prisma.customer.findFirst({ where: { companyId: session.companyId, uniqueId: { equals: uniqueId.trim(), mode: "insensitive" }, id: { not: customerId } } });
      if (existingByUnique) {
        return res.status(409).json({ error: "Unique ID already exists" });
      }

      // Ensure companyId matches session.companyId
      if (Number(companyId) !== session.companyId) {
        return res.status(403).json({ error: "Access denied: Cannot assign customer to different company" });
      }

      // Update customer (and user if one exists)
      const result = await prisma.$transaction(async tx => {
        // Update user if customer has one and username is provided
        if (currentCustomer.userId && username && username.trim() !== "") {
          // Check username uniqueness (excluding current user)
          const existingUserByName = await tx.user.findFirst({ where: { username: username.trim(), id: { not: currentCustomer.userId } } });
          if (existingUserByName) {
            throw new Error("Username already exists");
          }

          const userUpdateData = { username: username.trim() };
          if (password && password.trim() !== "") userUpdateData.password = await hashPassword(password.trim());
          await tx.user.update({ where: { id: currentCustomer.userId }, data: userUpdateData });
        }

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

        return updatedCustomer;
      });

      return res.status(200).json({ message: "Customer updated successfully", customer: result });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const customerId = Number(id);

      if (!customerId) {
        return res.status(400).json({ error: "Customer id is required" });
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (customer.companyId !== session.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Use transaction to atomically check vehicles + delete
      await prisma.$transaction(async (tx) => {
        const vehicleCount = await tx.vehicle.count({ where: { customerId } });
        if (vehicleCount > 0) {
          throw new Error(`Cannot delete customer. ${vehicleCount} vehicle(s) are still associated with this customer. Please reassign or remove the vehicles first.`);
        }

        if (customer.userId) {
          await tx.userRole.deleteMany({ where: { userId: customer.userId } });
        }
        await tx.customer.delete({ where: { id: customerId } });
        if (customer.userId) {
          await tx.user.delete({ where: { id: customer.userId } });
        }
      });

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
