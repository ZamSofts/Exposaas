import React from "react";

interface SkeletonRowProps {
  columns: number;
  rows?: number;
}

export default function Skeleton({ columns, rows = 3 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
              <div className="h-4 bg-[var(--border)] rounded w-20 opacity-60"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
