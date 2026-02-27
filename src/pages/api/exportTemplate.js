import { prisma, getSession } from "@/lib/useful";
import { VEHICLE_COLUMNS } from "@/config/vehicleColumns";
import { FORMULA_ALLOWED_FIELDS, FORMULA_ALLOWED_OPS } from "@/config/exportTypes";

/**
 * ExportTemplate CRUD API
 * GET    — list all / get by id
 * PUT    — create
 * POST   — update
 * DELETE — delete
 */

// ── Validation ──

const validColumnIds = new Set(VEHICLE_COLUMNS.map(c => c.id));

function validateColumns(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("columns must be a non-empty array of column IDs");
  }
  for (const col of columns) {
    if (!validColumnIds.has(col)) {
      throw new Error(`Invalid column ID: ${col}`);
    }
  }
}

function validateComputedColumns(computedColumns) {
  if (!Array.isArray(computedColumns)) {
    throw new Error("computedColumns must be an array");
  }
  const allowedFields = new Set(FORMULA_ALLOWED_FIELDS);
  const allowedOps = new Set(FORMULA_ALLOWED_OPS);

  for (const cc of computedColumns) {
    if (!cc.id || !cc.label || !Array.isArray(cc.formula) || cc.formula.length === 0) {
      throw new Error("Each computed column needs id, label, and non-empty formula");
    }
    for (const token of cc.formula) {
      if (token.type === "field" && !allowedFields.has(token.value)) {
        throw new Error(`Invalid formula field: ${token.value}`);
      }
      if (token.type === "op" && !allowedOps.has(token.value)) {
        throw new Error(`Invalid formula operator: ${token.value}`);
      }
    }
  }
}

function validateFooterRows(footerRows) {
  if (!Array.isArray(footerRows)) {
    throw new Error("footerRows must be an array");
  }
  for (const row of footerRows) {
    if (!row.label || typeof row.label !== "string") {
      throw new Error("Each footer row needs a label string");
    }
  }
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  const companyId = session?.companyId;

  try {
    switch (req.method) {
      case "GET": {
        const id = Number(req.query.id);

        if (id) {
          const template = await prisma.exportTemplate.findUnique({ where: { id } });
          if (!template || template.companyId !== companyId) {
            return res.status(404).json({ error: "Template not found" });
          }
          return res.json(template);
        }

        const templates = await prisma.exportTemplate.findMany({
          where: { companyId },
          orderBy: { createdAt: "desc" },
        });
        return res.json({ templates, total: templates.length });
      }

      case "PUT": {
        const { name, columns, computedColumns = [], footerRows = [], showContainerNumber = true, showDate = true } = req.body;

        if (!name || typeof name !== "string") {
          return res.status(400).json({ error: "Template name is required" });
        }

        validateColumns(columns);
        validateComputedColumns(computedColumns);
        validateFooterRows(footerRows);

        const template = await prisma.exportTemplate.create({
          data: {
            name: name.trim(),
            companyId,
            createdById: session.id,
            columns,
            computedColumns,
            footerRows,
            showContainerNumber,
            showDate,
          },
        });
        return res.status(201).json(template);
      }

      case "POST": {
        const { id, name, columns, computedColumns = [], footerRows = [], showContainerNumber, showDate } = req.body;
        const templateId = Number(id);
        if (!templateId) return res.status(400).json({ error: "Template ID required" });

        const existing = await prisma.exportTemplate.findUnique({ where: { id: templateId } });
        if (!existing || existing.companyId !== companyId) {
          return res.status(404).json({ error: "Template not found" });
        }

        if (columns) validateColumns(columns);
        if (computedColumns) validateComputedColumns(computedColumns);
        if (footerRows) validateFooterRows(footerRows);

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (columns !== undefined) updateData.columns = columns;
        if (computedColumns !== undefined) updateData.computedColumns = computedColumns;
        if (footerRows !== undefined) updateData.footerRows = footerRows;
        if (showContainerNumber !== undefined) updateData.showContainerNumber = showContainerNumber;
        if (showDate !== undefined) updateData.showDate = showDate;

        const updated = await prisma.exportTemplate.update({
          where: { id: templateId },
          data: updateData,
        });
        return res.json(updated);
      }

      case "DELETE": {
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: "Template ID required" });

        const existing = await prisma.exportTemplate.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
          return res.status(404).json({ error: "Template not found" });
        }

        await prisma.exportTemplate.delete({ where: { id } });
        return res.json({ message: "Template deleted" });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("ExportTemplate API error:", error);
    const status = error.code === "P2002" ? 409 : 400;
    res.status(status).json({ error: error.message || "Internal server error" });
  }
}
