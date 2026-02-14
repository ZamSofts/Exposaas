import { useState } from "react";
import { API } from "@/hooks/wrapper";

export default function useFileUpload({ endpoint, method, validExtensions, validMimeTypes, fileLabel }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

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
