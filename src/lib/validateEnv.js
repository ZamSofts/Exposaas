/**
 * Validate required environment variables at startup.
 * Import this early in _app.jsx (server-side) or in workers.
 */

const REQUIRED_ENV = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
];

const OPTIONAL_WARN_ENV = [
  "AZURE_STORAGE_ACCOUNT_NAME",
  "AZURE_STORAGE_ACCOUNT_KEY",
  "AZURE_STORAGE_CONTAINER_NAME",
  "GEMINI_API_KEY",
];

if (typeof window === "undefined") {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n  ${missing.join("\n  ")}\n`);
    // In production, fail hard; in dev, warn only
    // if (process.env.NODE_ENV === "production") {
    //   process.exit(1);
    // }
  }

  const missingOptional = OPTIONAL_WARN_ENV.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Missing optional environment variables (some features will be disabled):\n  ${missingOptional.join("\n  ")}`);
  }
}
