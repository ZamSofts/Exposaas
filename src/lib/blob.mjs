import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

// Initialize Azure Blob Service Client
const getBlobServiceClient = () => {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

  if (!accountName || !accountKey) {
    throw new Error("Azure Storage credentials are not configured");
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  return new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
};

/**
 * Upload a file to Azure Blob Storage
 * @param {Buffer|File} file - The file to upload
 * @param {string} path - The path where to save (e.g., "csv/" or "vehicle/")
 * @returns {Object} - Object containing fileName and blobUrl
 */
export const putFile = async (file, path) => {
  const blobServiceClient = getBlobServiceClient();
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Generate unique filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uniqueId = uuidv4().slice(0, 8);
  const fileExtension = file.originalname ? file.originalname.split(".").pop() : "bin";
  const fileName = `${path}${timestamp}-${uniqueId}.${fileExtension}`;

  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  // Upload file
  const fileBuffer = file.buffer || file;
  const fileSize = fileBuffer.length;
  console.log("Uploading file to Azure Blob Storage:", fileName, "Size:", fileSize);
  await blockBlobClient.upload(fileBuffer, fileSize, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype || "application/octet-stream",
    },
  });

  return {
    fileName,
    url: blockBlobClient.url,
  };
};

/**
 * Download a file from Azure Blob Storage
 * @param {string} fileUrl - The full Azure blob URL (e.g., "https://account.blob.core.windows.net/container/csv/example.csv")
 * @returns {ReadableStream} - The file content as a readable stream
 */
export const downloadFile = async fileUrl => {
  const blobServiceClient = getBlobServiceClient();

  // Extract container and blob path from full URL
  const url = new URL(fileUrl);
  const pathParts = url.pathname.split("/");
  const containerName = pathParts[1]; // First part after domain
  const blobPath = pathParts.slice(2).join("/"); // Rest is the blob path

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  const downloadResponse = await blockBlobClient.download();
  return downloadResponse.readableStreamBody;
};

/**
 * Delete a file from Azure Blob Storage
 * @param {string} fileUrl - The full Azure blob URL (e.g., "https://account.blob.core.windows.net/container/csv/example.csv")
 */
export const deleteFile = async fileUrl => {
  const blobServiceClient = getBlobServiceClient();
  const url = new URL(fileUrl);
  const pathParts = url.pathname.split("/");

  await blobServiceClient.getContainerClient(pathParts[1]).getBlockBlobClient(pathParts.slice(2).join("/")).delete();
};
