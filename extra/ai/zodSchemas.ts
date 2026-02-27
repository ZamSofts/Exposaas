/**
 * Zod schemas for Gemini API response validation and Structured Output.
 *
 * These schemas serve two purposes:
 * 1. Runtime validation of Gemini responses (safeParse)
 * 2. Structured Output schema generation via zod-to-json-schema
 *
 * Note: The prompt-facing schemas (schema.mjs, documentSchemas.mjs) remain
 * separate — they contain constraints/descriptions used in prompt text.
 * These Zod schemas define the expected JSON structure for validation.
 */

import { z } from "zod";

// ─── Invoice Extraction ─────────────────────────────────────────

/** Allowed charge types matching EXTRACTION_SCHEMA.outputs.charges.allowed_types */
export const CHARGE_TYPES = [
  "bid_amount",
  "auction_fee",
  "recycling_fee",
  "shipping_fee",
  "insurance_fee",
  "listing_fee",
  "storage_fee",
  "admin_fee",
  "other_fee",
  "discount",
] as const;

/** Single charge item extracted from an invoice */
export const ChargeSchema = z.object({
  type: z.enum(CHARGE_TYPES),
  amount: z.number().int(),
  confidence: z.number().min(0).max(1),
});

/** Single vehicle extracted from an invoice page */
export const VehicleExtractionSchema = z.object({
  chassis_number: z.string(),
  brand: z.string(),
  auction: z.string(),
  auction_date: z.string(),
  lot_number: z.string(),
  confidence: z.number().min(0).max(1),
  charges: z.array(ChargeSchema),
});

/**
 * Invoice page response — Gemini returns { page_1: [...vehicles] }.
 * Uses passthrough() to allow page_2, page_3 etc. without strict key enforcement.
 */
export const InvoicePageResponseSchema = z
  .object({
    page_1: z.array(VehicleExtractionSchema),
  })
  .passthrough();

export type InvoicePageResponse = z.infer<typeof InvoicePageResponseSchema>;
export type VehicleExtraction = z.infer<typeof VehicleExtractionSchema>;
export type Charge = z.infer<typeof ChargeSchema>;

// ─── Document Classification ────────────────────────────────────

export const DOCUMENT_TYPE_KEYS = [
  "invoice",
  "export_cert",
  "inspection_cert",
  "temp_cancel",
  "unknown",
] as const;

/** Classification response from Gemini */
export const ClassificationSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_KEYS),
  confidence: z.number().min(0).max(1),
});

export type ClassificationResult = z.infer<typeof ClassificationSchema>;

// ─── Certificate Extraction (Non-Invoice Documents) ─────────────

/** Shared nullable string fields across all cert types */
const nullableStr = z.string().nullable();

/** Common fields shared by all certificate types */
const baseCertFields = {
  chassis_number: nullableStr,
  brand: nullableStr,
  model_code: nullableStr,
  registration_number: nullableStr,
  length: nullableStr,
  width: nullableStr,
  height: nullableStr,
  m3: nullableStr,
};

/** Export Cancellation Certificate (輸出抹消仮登録証明書) */
export const ExportCertSchema = z.object({
  ...baseCertFields,
  first_registration_date: nullableStr,
  vehicle_weight: nullableStr,
  export_scheduled_date: nullableStr,
});

/** Vehicle Inspection Certificate (自動車検査証) */
export const InspectionCertSchema = z.object({
  ...baseCertFields,
  model: nullableStr,
  first_registration_date: nullableStr,
  expiry_date: nullableStr,
  engine_displacement: nullableStr,
});

/** Temporary Cancellation Certificate (一時抹消登録証明書) */
export const TempCancelSchema = z.object({
  ...baseCertFields,
  owner_name: nullableStr,
  cancellation_date: nullableStr,
  registration_id: nullableStr,
});

/** Map docType → Zod schema for Structured Output */
export const DOC_ZOD_MAP: Record<string, z.ZodType> = {
  export_cert: ExportCertSchema,
  inspection_cert: InspectionCertSchema,
  temp_cancel: TempCancelSchema,
};

export type ExportCertResult = z.infer<typeof ExportCertSchema>;
export type InspectionCertResult = z.infer<typeof InspectionCertSchema>;
export type TempCancelResult = z.infer<typeof TempCancelSchema>;

// ─── Optimizer Candidates ───────────────────────────────────────

/** Single optimizer candidate from meta-prompting */
export const OptimizerCandidateSchema = z.object({
  id: z.union([z.number(), z.string()]),
  approach: z.string(),
  content: z.string(),
});

/** Full optimizer response (array of candidates) */
export const OptimizerResponseSchema = z.array(OptimizerCandidateSchema);

export type OptimizerCandidate = z.infer<typeof OptimizerCandidateSchema>;
