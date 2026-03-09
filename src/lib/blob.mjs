import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";

const BUCKET = "exposaasbpo";

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials are not configured");
  }

  return createClient(url, key);
};

/**
 * Extract the storage path from a full Supabase Storage URL.
 * URL format: https://<ref>.supabase.co/storage/v1/object/public/exposaas/<path>
 */
const extractStoragePath = (fileUrl) => {
  const url = new URL(fileUrl);
  const prefix = `/storage/v1/object/public/${BUCKET}/`;
  const storagePath = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.pathname.split(`/${BUCKET}/`).pop();
  return decodeURIComponent(storagePath);
};

/**
 * Upload a file to Supabase Storage
 * @param {Buffer|File} file - The file to upload
 * @param {string} path - The path where to save (e.g., "csv/" or "vehicle/")
 * @returns {Object} - Object containing fileName and url
 */
export const putFile = async (file, path) => {
  const supabase = getSupabaseClient();

  // Generate unique filename (same convention as before)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uniqueId = uuidv4().slice(0, 8);
  const fileExtension = file.originalname ? file.originalname.split(".").pop() : "bin";
  const fileName = `${path}${timestamp}-${uniqueId}.${fileExtension}`;

  const fileBuffer = file.buffer || file;
  const contentType = file.mimetype || "application/octet-stream";

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return {
    fileName,
    url: urlData.publicUrl,
  };
};

/**
 * Upload multiple files to Supabase Storage
 * @param {Array} files - Array of file objects to upload
 * @param {string} path - The path where to save (e.g., "csv/" or "vehicle/")
 * @returns {Array} - Array of objects containing fileName and url for each uploaded file
 */
export const putMultipleFiles = async (files, path) => {
  const uploadResults = [];

  for (const file of files) {
    const result = await putFile(file, path);
    uploadResults.push(result);
  }

  return uploadResults;
};

/**
 * Download a file from Supabase Storage
 * @param {string} fileUrl - The full Supabase storage URL
 * @returns {ReadableStream} - The file content as a Node.js readable stream
 */
export const downloadFile = async (fileUrl) => {
  const supabase = getSupabaseClient();
  const storagePath = extractStoragePath(fileUrl);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error) {
    throw new Error(`Supabase download failed: ${error.message}`);
  }

  // Convert Web API Blob to Node.js Readable stream for .pipe() compatibility
  return Readable.fromWeb(data.stream());
};

/**
 * Delete a file from Supabase Storage
 * @param {string} fileUrl - The full Supabase storage URL
 */
export const deleteFile = async (fileUrl) => {
  const supabase = getSupabaseClient();
  const storagePath = extractStoragePath(fileUrl);

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
};
