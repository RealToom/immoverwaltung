import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/middleware/**"],
      reporter: ["text", "html"],
    },
  },
});
