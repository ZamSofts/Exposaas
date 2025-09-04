import React from 'react'
import { Geist } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export function Loader() {
  return (
      <div className={`${geistSans.variable} font-sans min-h-screen flex items-center justify-center  `}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "var(--primary)" }}></div>
        </div>
      </div>
    );
}

