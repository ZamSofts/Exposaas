import { PDFDocument } from 'pdf-lib';
import { putFile } from '../../src/lib/blob.mjs';

/**
 * Split a PDF into individual pages and upload each to Azure Blob Storage
 * @param {Buffer} pdfBuffer - The original PDF buffer
 * @param {number} invoiceJobId - InvoiceJob ID for organizing uploaded files
 * @returns {Promise<{pageNumber: number, pageUrl: string}[]>} - Array of page info
 */
export async function splitAndUploadPages(pdfBuffer, invoiceJobId) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  const pages = [];

  console.log(`📄 Splitting PDF into ${pageCount} pages for job ${invoiceJobId}`);

  for (let i = 0; i < pageCount; i++) {
    // Create a new PDF with just this page
    const singlePagePdf = await PDFDocument.create();
    const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
    singlePagePdf.addPage(copiedPage);
    const pdfBytes = await singlePagePdf.save();

    // Upload to Azure Blob Storage
    const uploaded = await putFile(
      {
        buffer: Buffer.from(pdfBytes),
        mimetype: 'application/pdf',
        originalname: `page_${i + 1}.pdf`
      },
      `invoices/job_${invoiceJobId}/`
    );

    pages.push({
      pageNumber: i + 1,
      pageUrl: uploaded.url
    });

    console.log(`📄 Page ${i + 1}/${pageCount} uploaded: ${uploaded.url}`);
  }

  console.log(`✅ All ${pageCount} pages uploaded for job ${invoiceJobId}`);
  return pages;
}

/**
 * Get the page count from a PDF buffer without splitting
 * @param {Buffer} pdfBuffer - The PDF buffer
 * @returns {Promise<number>} - Number of pages
 */
export async function getPageCount(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.getPageCount();
}
