import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.{ts,js,mjs}"],
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "src") + "/",
      "@extra/": path.resolve(__dirname, "extra") + "/",
    },
  },
});
