import React, { useState, useEffect } from "react";
import { Geist } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const loadingPhrases = [
  "Preparing your automotive experience...",
  "Starting the engine...",
  "Shifting into gear...",
  "Warming up the engine...",
  "Loading vehicle data...",
  "Revving up the platform...",
  "Checking under the hood...",
  "Fueling up the system...",
  "Accelerating performance...",
  "Fine-tuning the experience...",
  "Calibrating systems...",
  "Getting everything road-ready...",
];

export function Loader({ overlay = false }) {
  const [currentPhrase, setCurrentPhrase] = useState(loadingPhrases[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase(loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`${geistSans.variable} font-sans min-h-screen flex items-center justify-center`} style={{ background: "transparent" }}>
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Car Drifting Animation Container */}
        <div className="relative w-32 h-32">
          {/* Drift Track Circle */}
          <div
            className="absolute inset-0 rounded-full border-2 border-dashed opacity-30"
            style={{
              borderColor: "var(--primary)",
              animation: "rotateDriftTrack 3s linear infinite",
            }}
          ></div>

          {/* Drift Smoke Effect */}
          <div
            className="absolute w-2 h-2 rounded-full opacity-60"
            style={{
              background: "var(--secondary-foreground)",
              animation: "driftSmoke1 1.5s ease-out infinite",
              transformOrigin: "56px 56px",
              left: "8px",
              top: "8px",
            }}
          ></div>
          <div
            className="absolute w-1.5 h-1.5 rounded-full opacity-40"
            style={{
              background: "var(--secondary-foreground)",
              animation: "driftSmoke2 1.8s ease-out infinite 0.3s",
              transformOrigin: "56px 56px",
              left: "8px",
              top: "8px",
            }}
          ></div>
          <div
            className="absolute w-1 h-1 rounded-full opacity-20"
            style={{
              background: "var(--secondary-foreground)",
              animation: "driftSmoke3 2s ease-out infinite 0.6s",
              transformOrigin: "56px 56px",
              left: "8px",
              top: "8px",
            }}
          ></div>
        </div>

        <div className="text-center">
          <p className="text-lg font-medium mb-1" style={{ color: "var(--foreground)" }}>
            Loading
          </p>
          <p className="text-sm opacity-75 transition-all duration-500 min-h-[20px]" style={{ color: "var(--secondary-foreground)" }} key={currentPhrase}>
            {currentPhrase}
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes driftCar {
          0% {
            transform: rotate(0deg) translateX(56px) rotate(0deg);
            left: 8px;
            top: 8px;
          }
          25% {
            transform: rotate(90deg) translateX(56px) rotate(-90deg);
            left: 8px;
            top: 8px;
          }
          50% {
            transform: rotate(180deg) translateX(56px) rotate(-180deg);
            left: 8px;
            top: 8px;
          }
          75% {
            transform: rotate(270deg) translateX(56px) rotate(-270deg);
            left: 8px;
            top: 8px;
          }
          100% {
            transform: rotate(360deg) translateX(56px) rotate(-360deg);
            left: 8px;
            top: 8px;
          }
        }

        @keyframes rotateDriftTrack {
          0% {
            transform: rotate(0deg);
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            transform: rotate(360deg);
            opacity: 0.3;
          }
        }

        @keyframes driftSmoke1 {
          0% {
            transform: rotate(0deg) translateX(50px) scale(0);
            opacity: 0.6;
            left: 8px;
            top: 8px;
          }
          50% {
            transform: rotate(180deg) translateX(50px) scale(1);
            opacity: 0.4;
            left: 8px;
            top: 8px;
          }
          100% {
            transform: rotate(360deg) translateX(50px) scale(0);
            opacity: 0;
            left: 8px;
            top: 8px;
          }
        }

        @keyframes driftSmoke2 {
          0% {
            transform: rotate(0deg) translateX(46px) scale(0);
            opacity: 0.4;
            left: 8px;
            top: 8px;
          }
          50% {
            transform: rotate(180deg) translateX(46px) scale(1);
            opacity: 0.3;
            left: 8px;
            top: 8px;
          }
          100% {
            transform: rotate(360deg) translateX(46px) scale(0);
            opacity: 0;
            left: 8px;
            top: 8px;
          }
        }

        @keyframes driftSmoke3 {
          0% {
            transform: rotate(0deg) translateX(42px) scale(0);
            opacity: 0.2;
            left: 8px;
            top: 8px;
          }
          50% {
            transform: rotate(180deg) translateX(42px) scale(1);
            opacity: 0.15;
            left: 8px;
            top: 8px;
          }
          100% {
            transform: rotate(360deg) translateX(42px) scale(0);
            opacity: 0;
            left: 8px;
            top: 8px;
          }
        }
      `}</style>
    </div>
  );
}
