import { PDFDocument, degrees } from 'pdf-lib';
import { GoogleGenAI } from '@google/genai';

/**
 * Detects if a PDF is rotated and corrects it in-memory.
 *
 * Uses gemini-1.5-flash-8b (cheapest vision model) on page 1 only to detect
 * the rotation angle, then applies a metadata rotation correction to all pages
 * via pdf-lib so downstream workers (classification, extraction) always see
 * an upright document.
 *
 * This is non-blocking: any failure returns the original buffer unchanged.
 *
 * @param {Buffer} pdfBuffer - The original PDF as a Node.js Buffer
 * @returns {Promise<Buffer>} - Corrected PDF buffer (or original on error/no rotation)
 */
export async function detectAndCorrectRotation(pdfBuffer) {
  try {
    // Extract page 1 only to minimize Gemini token usage
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const page1Pdf = await PDFDocument.create();
    const [page1] = await page1Pdf.copyPages(pdfDoc, [0]);
    page1Pdf.addPage(page1);
    const page1Bytes = await page1Pdf.save();
    const base64 = Buffer.from(page1Bytes).toString('base64');

    // Ask Gemini to detect the needed correction angle
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        'What correction angle is needed to make this PDF page upright and readable? Return ONLY JSON: {"rotation": N} where N is 0 (already upright), 90, 180, or 270.',
      ],
      config: { responseMimeType: 'application/json' },
    });

    const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const rotation = parsed?.rotation;

    if (!rotation || rotation === 0) {
      return pdfBuffer; // Already upright — skip pdf-lib processing
    }

    // Apply rotation correction via metadata to all pages
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + rotation) % 360));
    }

    const corrected = await pdfDoc.save();
    console.log(`🔄 [pdfRotation] Corrected PDF rotation by ${rotation}°`);
    return Buffer.from(corrected);

  } catch (err) {
    // Non-blocking: must not break the email ingestion pipeline
    console.warn(`⚠️ [pdfRotation] Rotation detection skipped: ${err.message}`);
    return pdfBuffer;
  }
}
