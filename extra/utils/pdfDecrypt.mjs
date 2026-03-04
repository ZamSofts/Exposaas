/**
 * PDF Decryption Utility
 *
 * Uses qpdf CLI (via node-qpdf2) to decrypt password-protected PDFs.
 * Required for USS auction invoices which use the member number as password.
 */
import { decrypt } from "node-qpdf2";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

const TEMP_DIR = join(tmpdir(), "exposaas-pdf");

/**
 * Decrypt a password-protected PDF buffer.
 * @param {Buffer} pdfBuffer - The encrypted PDF
 * @param {string} password - The decryption password
 * @returns {Promise<Buffer>} The decrypted PDF buffer
 */
export async function decryptPdf(pdfBuffer, password) {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  const id = randomUUID();
  const inputPath = join(TEMP_DIR, `in-${id}.pdf`);
  const outputPath = join(TEMP_DIR, `out-${id}.pdf`);

  try {
    writeFileSync(inputPath, pdfBuffer);
    await decrypt({ input: inputPath, output: outputPath, password });
    return readFileSync(outputPath);
  } finally {
    try { unlinkSync(inputPath); } catch {}
    try { unlinkSync(outputPath); } catch {}
  }
}

/**
 * Quick heuristic check for PDF encryption.
 * Looks for /Encrypt dictionary in the PDF header area.
 */
export function isEncryptedPdf(pdfBuffer) {
  const sample = pdfBuffer
    .subarray(0, Math.min(pdfBuffer.length, 4096))
    .toString("latin1");
  return sample.includes("/Encrypt");
}
