import { useState } from "react";
import { API } from "@/hooks/wrapper";

/**
 * Reusable file upload hook with validation and fake progress bar.
 *
 * @param {Object} config
 * @param {string}   config.endpoint        API endpoint name (e.g. "addVehicle")
 * @param {string}   config.method          HTTP method (e.g. "POST" | "PUT")
 * @param {string[]} config.validExtensions Allowed file extensions (e.g. ["csv"])
 * @param {string[]} config.validMimeTypes  Allowed MIME types
 * @param {string}   config.fileLabel       Human label for error messages (e.g. "CSV")
 *
 * @returns {{ file, progress, error, validate, upload, reset }}
 */
export default function useFileUpload({ endpoint, method, validExtensions, validMimeTypes, fileLabel }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  /** Validate a file input change event. Sets file or error. */
  const validate = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (!validExtensions.includes(ext) || !validMimeTypes.includes(selected.type)) {
      setError(`Only valid ${fileLabel} files are allowed!`);
      setFile(null);
      return;
    }
    setFile(selected);
    setError("");
  };

  /**
   * Upload the file with a fake progress bar.
   * @param {Object}   callbacks
   * @param {Function} callbacks.onSuccess  Called with API response on success
   * @param {Function} callbacks.onError    Called with error message string
   */
  const upload = async ({ onSuccess, onError } = {}) => {
    if (!file) {
      const msg = `Please select a valid ${fileLabel} file first.`;
      setError(msg);
      onError?.(msg);
      return;
    }

    // Start fake progress
    setProgress(1);
    let fakeProgress = 1;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 10;
      if (fakeProgress < 90) {
        setProgress(Math.floor(fakeProgress));
      }
    }, 200);

    const formData = new FormData();
    formData.append("file", file);
    const response = await API(method, endpoint, formData, true);

    clearInterval(interval);
    setProgress(100);
    setTimeout(() => setProgress(0), 1000);

    if (response.error) {
      setError(response.error);
      onError?.(response.error);
      return;
    }

    onSuccess?.(response);
    setFile(null);
    setError("");
  };

  /** Reset all state. */
  const reset = () => {
    setFile(null);
    setProgress(0);
    setError("");
  };

  return { file, progress, error, validate, upload, reset };
}
