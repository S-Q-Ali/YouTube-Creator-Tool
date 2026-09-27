import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.{ts,tsx,js,mjs}"],
    exclude: ["node_modules/**", ".opencode/**"],
  },
});