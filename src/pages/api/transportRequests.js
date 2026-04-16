import { prisma, getSession } from "@/lib/useful";

/**
 * GET  /api/transportRequests
 *   → Returns all vehicles for the company with their latest transport request
 *   → Query params: status ("requested"|"pending"), transportCompany, requestedById
 *
 * POST /api/transportRequests
 *   → Create a new transport request
 *   → Body: { vehicleId, transportCompany, requestedById, requestedAt, destination?, notes? }
 *
 * PATCH /api/transportRequests
 *   → Update an existing transport request
 *   → Body: { id, transportCompany?, requestedById?, requestedAt?, destination?, notes?, status? }
 *
 * DELETE /api/transportRequests?id=...
 *   → Delete a transport request
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session?.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── GET: vehicles with transport status ──────────────────────────────────
  if (req.method === "GET") {
    const { status } = req.query;

    // Only show vehicles from the new invoice workflow (auctionInvoiceId set)
    // Legacy manually-entered vehicles have no auctionInvoiceId and shouldn't appear here
    const vehicles = await prisma.vehicle.findMany({
      where: {
        companyId: session.companyId,
        auctionInvoiceId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id:                 true,
        chassisNumber:      true,
        lotNumber:          true,
        session:            true,
        auction:            true,
        auctionDate:        true,
        extractionDeadline: true,
        deliverTo:          true,
        auctionInvoice: {
          select: { sessionNumber: true },
        },
        customer: {
          select: { id: true, name: true },
        },
        transportRequests: {
          orderBy: { requestedAt: "desc" },
          take: 1,
          select: {
            id:               true,
            transportCompany: true,
            requestedAt:      true,
            completedAt:      true,
            destination:      true,
            notes:            true,
            requestedBy: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    // Flatten: attach latest transport request directly to vehicle
    let rows = vehicles.map(v => ({
      ...v,
      transportRequest: v.transportRequests[0] ?? null,
      transportRequests: undefined,
    }));

    // Filter by status
    if (status === "pending")    rows = rows.filter(r => !r.transportRequest);
    else if (status === "requested") rows = rows.filter(r => r.transportRequest && !r.transportRequest.completedAt);
    else if (status === "completed") rows = rows.filter(r => r.transportRequest?.completedAt);
    // default: exclude completed (搬出完了を除く)
    else rows = rows.filter(r => !r.transportRequest?.completedAt);

    return res.status(200).json({ data: rows });
  }

  // ── POST: create transport request ───────────────────────────────────────
  if (req.method === "POST") {
    const { vehicleId, transportCompany, requestedById, requestedAt, destination, notes, extractionDeadline } = req.body;

    if (!vehicleId || !transportCompany || !requestedById) {
      return res.status(400).json({ error: "vehicleId, transportCompany, requestedById are required" });
    }

    // Verify vehicle belongs to this company
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: Number(vehicleId), companyId: session.companyId },
    });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    // Optionally update extractionDeadline on the vehicle
    if (extractionDeadline !== undefined) {
      await prisma.vehicle.update({
        where: { id: Number(vehicleId) },
        data: { extractionDeadline: extractionDeadline ? new Date(extractionDeadline) : null },
      });
    }

    const created = await prisma.transportRequest.create({
      data: {
        vehicleId:        Number(vehicleId),
        transportCompany,
        requestedById:    Number(requestedById),
        requestedAt:      requestedAt ? new Date(requestedAt) : new Date(),
        destination:      destination || null,
        notes:            notes       || null,
        status:           "requested",
      },
      include: {
        requestedBy: { select: { id: true, username: true } },
      },
    });

    return res.status(201).json(created);
  }

  // ── PATCH: update transport request ─────────────────────────────────────
  if (req.method === "PATCH") {
    const { id, transportCompany, requestedById, requestedAt, completedAt, destination, notes, status, extractionDeadline } = req.body;

    if (id === undefined || id === null) return res.status(400).json({ error: "id required" });

    // Update extractionDeadline on Vehicle if provided
    if (extractionDeadline !== undefined && req.body.vehicleId) {
      await prisma.vehicle.update({
        where: { id: Number(req.body.vehicleId) },
        data: { extractionDeadline: extractionDeadline ? new Date(extractionDeadline) : null },
      });
    }

    const data = {};
    if (transportCompany !== undefined) data.transportCompany = transportCompany;
    if (requestedById    !== undefined) data.requestedById    = Number(requestedById);
    if (requestedAt      !== undefined) data.requestedAt      = requestedAt ? new Date(requestedAt) : null;
    if (completedAt      !== undefined) data.completedAt      = completedAt ? new Date(completedAt) : null;
    if (destination      !== undefined) data.destination      = destination || null;
    if (notes            !== undefined) data.notes            = notes || null;
    if (status           !== undefined) data.status           = status;

    if (Object.keys(data).length === 0 && extractionDeadline === undefined) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    if (Object.keys(data).length > 0) {
      const updated = await prisma.transportRequest.update({
        where: { id: Number(id) },
        data,
        include: { requestedBy: { select: { id: true, username: true } } },
      });
      return res.status(200).json(updated);
    }

    return res.status(200).json({ ok: true });
  }

  // ── DELETE: remove transport request ────────────────────────────────────
  if (req.method === "DELETE") {
    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ error: "id required" });

    await prisma.transportRequest.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
