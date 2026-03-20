import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.test.ts"],
    setupFiles: ["./e2e/setup.ts"],
    globalSetup: "./e2e/global-setup.ts",
    testTimeout: 30000,
    hookTimeout: 30000,
    maxConcurrency: 1,
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
