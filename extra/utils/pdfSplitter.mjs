import { PDFDocument } from 'pdf-lib';
import { putFile } from '../../src/lib/blob.mjs';

export async function splitAndUploadPages(pdfBuffer, invoiceJobId) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  const pages = [];

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
  }
  return pages;
}

export async function getPageCount(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.getPageCount();
}
