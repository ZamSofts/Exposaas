import { useState } from "react";
import { API } from "@/hooks/wrapper";

export default function useFileUpload({ endpoint, method, validExtensions, validMimeTypes, fileLabel, multiple = false }) {
  const [file, setFile] = useState(null);      // Single file (backward compat)
  const [files, setFiles] = useState([]);       // Multiple files
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const validate = (e) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    if (multiple) {
      const valid = [];
      for (const f of selected) {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (!validExtensions.includes(ext) || !validMimeTypes.includes(f.type)) {
          setError(`"${f.name}" is not a valid ${fileLabel} file — skipped.`);
          continue;
        }
        valid.push(f);
      }
      if (valid.length > 0) {
        setFiles(valid);
        setFile(valid[0]); // Keep backward compat: `file` = first file
        setError("");
      }
    } else {
      const f = selected[0];
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!validExtensions.includes(ext) || !validMimeTypes.includes(f.type)) {
        setError(`Only valid ${fileLabel} files are allowed!`);
        setFile(null);
        return;
      }
      setFile(f);
      setFiles([f]);
      setError("");
    }
  };

  const upload = async ({ onSuccess, onError } = {}) => {
    const toUpload = multiple ? files : (file ? [file] : []);
    if (toUpload.length === 0) {
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

    try {
      // Upload all files in parallel
      const results = await Promise.all(
        toUpload.map((f) => {
          const formData = new FormData();
          formData.append("file", f);
          return API(method, endpoint, formData, true);
        })
      );

      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);

      // Check for errors in any response
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        const msg = errors.map((r) => r.error).join("; ");
        setError(msg);
        onError?.(msg);
        return;
      }

      // Return first result for backward compat, or all results for multiple
      onSuccess?.(multiple ? results : results[0]);
      setFile(null);
      setFiles([]);
      setError("");
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      const msg = err?.message || "Upload failed";
      setError(msg);
      onError?.(msg);
    }
  };

  /** Reset all state. */
  const reset = () => {
    setFile(null);
    setFiles([]);
    setProgress(0);
    setError("");
  };

  return { file, files, progress, error, validate, upload, reset };
}
