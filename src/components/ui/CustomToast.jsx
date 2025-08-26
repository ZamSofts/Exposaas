import React from "react";

export function Toast({type = "success", message }) {

  return <>
     
        <div
          className={`fixed bottom-60 right-8 z-[9999] min-w-[280px] max-w-[90vw] px-5 py-4 rounded-lg shadow-xl font-medium flex items-center gap-3 transition-all duration-500 animate-slide-in
            ${type === "success" ? "bg-[var(--success)] text-[var(--success-foreground)] border border-[var(--success)]" : "bg-[var(--error)] text-[var(--error-foreground)] border border-[var(--error)]"}`}
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}
        >
          <span className={`flex items-center justify-center rounded-full bg-[var(--surface)]/60 p-2 shadow ${type === "success" ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            {type === "success" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
          </span>
          <span className="text-base font-semibold tracking-wide drop-shadow-sm">{message}</span>
        </div>
     
      <style jsx>{`
        @keyframes slide-in {
          0% { opacity: 0; transform: translateY(40px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-in {
          animation: slide-in 0.5s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
  
  </>;
}
