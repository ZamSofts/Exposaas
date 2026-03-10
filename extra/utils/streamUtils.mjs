const MAX_PDF_SIZE = 200 * 1024 * 1024; // 200 MB

/**
 * Convert a readable stream to a Buffer with size limit protection.
 * @param {ReadableStream} stream
 * @param {number} [maxSize=MAX_PDF_SIZE]
 * @returns {Promise<Buffer>}
 */
export async function streamToBuffer(stream, maxSize = MAX_PDF_SIZE) {
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of stream) {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      if (typeof stream.destroy === "function") stream.destroy();
      throw new Error(
        `PDF exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`
      );
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}
