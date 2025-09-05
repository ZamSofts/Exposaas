import React from "react";


export default function Error({ message, className = "" }) {
  if (!message) return null;

  return (
    <div
      className={`mb-6 p-4 rounded-xl border-l-4 text-sm ${className}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--error) 10%, var(--background))",
        borderLeftColor: "var(--error)",
        color: "var(--error)",
      }}>
      <div className="flex items-center">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {message}
      </div>
    </div>
  );
}
