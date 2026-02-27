import { prisma, getSession } from "@/lib/useful";
import { buildFilterWhere, getSearchFilter, getOrderBy } from "@/lib/vehicleFilters";
import { VEHICLE_COLUMNS } from "@/config/vehicleColumns";
import ExcelJS from "exceljs";

/**
 * POST /api/vehicleExport
 * Generate and download an Excel file based on an export template.
 *
 * Body: { templateId, filters?, search?, sortBy?, sortOrder? }
 * Response: .xlsx binary stream
 */

// ── Column label lookup ──
const columnLabelMap = Object.fromEntries(VEHICLE_COLUMNS.map(c => [c.id, c.label]));

// ── Resolve vehicle field value (handles relations) ──
function resolveField(vehicle, field) {
  if (field === "brand") return vehicle.brand?.name || "";
  if (field === "customer") return vehicle.customer?.name || "";
  const val = vehicle[field];
  if (val === null || val === undefined) return "";
  // Decimal fields from Prisma come as Decimal objects
  if (typeof val === "object" && val.toNumber) return val.toNumber();
  return val;
}

// ── Evaluate token-based formula ──
function evaluateFormula(formula, vehicle) {
  // Build expression: field tokens become numbers, op tokens become operators
  let result = 0;
  let currentOp = "+";

  for (const token of formula) {
    if (token.type === "op") {
      currentOp = token.value;
    } else if (token.type === "field") {
      const raw = vehicle[token.value];
      const num = raw !== null && raw !== undefined
        ? (typeof raw === "object" && raw.toNumber ? raw.toNumber() : Number(raw))
        : 0;
      if (isNaN(num)) continue;

      switch (currentOp) {
        case "+": result += num; break;
        case "-": result -= num; break;
        case "*": result *= num; break;
        case "/": result = num !== 0 ? result / num : result; break;
      }
    }
  }
  return result;
}

// ── Check if a field is numeric (for SUM row) ──
const NUMERIC_FIELDS = new Set([
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
  "length", "width", "height", "m3",
]);

function isNumericColumn(field) {
  return NUMERIC_FIELDS.has(field);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const companyId = session?.companyId;

  try {
    const { templateId, filename: customFilename, filters, search, sortBy = "id", sortOrder = "asc" } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: "templateId is required" });
    }

    // 1. Load template
    const template = await prisma.exportTemplate.findUnique({ where: { id: Number(templateId) } });
    if (!template || template.companyId !== companyId) {
      return res.status(404).json({ error: "Template not found" });
    }

    const columns = template.columns || [];
    const computedColumns = template.computedColumns || [];
    const footerRows = template.footerRows || [];

    // 2. Query vehicles
    const filterWhere = filters ? buildFilterWhere(JSON.stringify(filters)) : {};
    const searchFilter = search ? getSearchFilter(search.trim().toLowerCase()) : {};
    const where = { companyId, ...searchFilter, ...filterWhere };

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        brand: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: getOrderBy(sortBy, sortOrder),
    });

    // 3. Build Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(template.name);

    // All column headers (vehicle fields + computed)
    const allHeaders = [
      ...columns.map(col => columnLabelMap[col] || col),
      ...computedColumns.map(cc => cc.label),
    ];
    const totalColCount = allHeaders.length;

    // ── Header section ──
    let currentRow = 1;

    // Title row (template name)
    const titleRow = sheet.getRow(currentRow);
    titleRow.getCell(1).value = template.name;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    currentRow++;

    // Container number + date row
    const firstVehicle = vehicles[0];
    const metaValues = [];
    if (template.showContainerNumber && firstVehicle?.containerNumber) {
      metaValues.push(firstVehicle.containerNumber);
    }
    if (template.showDate) {
      const today = new Date();
      metaValues.push(`${today.getMonth() + 1}月${today.getDate()}日`);
    }
    if (metaValues.length > 0) {
      const metaRow = sheet.getRow(currentRow);
      metaValues.forEach((val, i) => {
        metaRow.getCell(i + 1).value = val;
        metaRow.getCell(i + 1).font = { size: 10 };
      });
      currentRow++;
    }

    // ── Column headers ──
    const headerRowNum = currentRow;
    const headerRow = sheet.getRow(headerRowNum);
    allHeaders.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      cell.border = {
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    currentRow++;

    // ── Data rows ──
    const dataStartRow = currentRow;
    for (const vehicle of vehicles) {
      const row = sheet.getRow(currentRow);

      // Vehicle field columns
      columns.forEach((col, i) => {
        const val = resolveField(vehicle, col);
        const cell = row.getCell(i + 1);
        cell.value = val;
        if (isNumericColumn(col) && typeof val === "number") {
          cell.numFmt = "#,##0";
        }
      });

      // Computed columns
      computedColumns.forEach((cc, i) => {
        const val = evaluateFormula(cc.formula, vehicle);
        const cell = row.getCell(columns.length + i + 1);
        cell.value = val;
        cell.numFmt = "#,##0";
      });

      currentRow++;
    }
    const dataEndRow = currentRow - 1;

    // ── Sum row ──
    if (vehicles.length > 0) {
      const sumRow = sheet.getRow(currentRow);
      sumRow.font = { bold: true };

      columns.forEach((col, i) => {
        if (isNumericColumn(col)) {
          const colLetter = String.fromCharCode(65 + i); // A, B, C...
          sumRow.getCell(i + 1).value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` };
          sumRow.getCell(i + 1).numFmt = "#,##0";
        }
      });

      // Computed column sums
      computedColumns.forEach((cc, i) => {
        const colIdx = columns.length + i;
        const colLetter = colIdx < 26 ? String.fromCharCode(65 + colIdx) : "A" + String.fromCharCode(65 + colIdx - 26);
        sumRow.getCell(colIdx + 1).value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` };
        sumRow.getCell(colIdx + 1).numFmt = "#,##0";
      });

      // Top border for sum row
      for (let i = 1; i <= totalColCount; i++) {
        sumRow.getCell(i).border = { top: { style: "thin" } };
      }
      currentRow++;
    }

    // ── Empty row ──
    currentRow++;

    // ── Footer rows (船賃, 通関, 陸送, 手数料) ──
    for (const fr of footerRows) {
      const row = sheet.getRow(currentRow);
      // Label in the second-to-last column (or first if only 1 col)
      const labelCol = Math.max(1, totalColCount - 1);
      row.getCell(labelCol).value = fr.label;
      row.getCell(labelCol).font = { bold: false };
      // Amount cell (last column) — blank for user to fill in
      row.getCell(totalColCount).value = null;
      row.getCell(totalColCount).numFmt = "#,##0";
      currentRow++;
    }

    // ── TOTAL row ──
    if (footerRows.length > 0) {
      const totalRow = sheet.getRow(currentRow);
      const labelCol = Math.max(1, totalColCount - 1);
      totalRow.getCell(labelCol).value = "TOTAL";
      totalRow.getCell(labelCol).font = { bold: true };
      // TOTAL = sum row total + footer amounts (user fills footer in Excel)
      totalRow.getCell(totalColCount).font = { bold: true };
      totalRow.getCell(totalColCount).numFmt = "#,##0";
      for (let i = 1; i <= totalColCount; i++) {
        totalRow.getCell(i).border = { top: { style: "double" } };
      }
    }

    // ── Column widths ──
    allHeaders.forEach((_, i) => {
      const col = sheet.getColumn(i + 1);
      col.width = columns[i] && isNumericColumn(columns[i]) ? 15 : 18;
    });

    // 4. Stream response
    const baseName = customFilename?.trim() || template.name;
    const filename = `${baseName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("VehicleExport API error:", error);
    res.status(500).json({ error: error.message || "Export failed" });
  }
}
