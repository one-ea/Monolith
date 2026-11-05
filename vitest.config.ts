import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/*/src/**/*.test.ts",
      "server/src/**/*.test.ts",
      "server/test/**/*.test.ts",
      "client/test/**/*.test.ts",
    ],
  },
});
