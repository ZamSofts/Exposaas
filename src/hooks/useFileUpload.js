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
      // Upload all files — use allSettled so partial failures don't block successes
      const settled = await Promise.allSettled(
        toUpload.map((f) => {
          const formData = new FormData();
          formData.append("file", f);
          return API(method, endpoint, formData, true).then((r) => {
            if (r.error) throw new Error(r.error);
            return r;
          });
        })
      );

      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);

      const successes = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failures = settled.filter((r) => r.status === "rejected").map((r) => r.reason?.message || "Upload failed");

      // Always call onSuccess if any files succeeded (so UI refreshes)
      if (successes.length > 0) {
        onSuccess?.(multiple ? successes : successes[0]);
      }

      if (failures.length > 0) {
        const msg = failures.join("; ");
        setError(msg);
        onError?.(msg);
      }

      // Only reset file state when all succeeded
      if (failures.length === 0) {
        setFile(null);
        setFiles([]);
        setError("");
      }
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
