import React from "react";


export default function Skeleton({ columns, rows = 3, variant = "default" }) {
  const isSpreadsheet = variant === "spreadsheet";
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className={isSpreadsheet ? "px-2 py-1 whitespace-nowrap border border-[var(--border)]" : "px-6 py-4 whitespace-nowrap"}>
              <div className={isSpreadsheet ? "h-3 bg-[var(--border)] rounded w-16 opacity-60" : "h-4 bg-[var(--border)] rounded w-20 opacity-60"}></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
