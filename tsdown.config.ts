import { defineConfig } from 'tsdown';

export default defineConfig({
  // entry: ["src/**/*.ts"],
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  clean: true,
  target: "node22", // Compatible with most Node versions
  treeshake: true,
  minify: process.env?.NODE_ENV === "production",
  sourcemap: !(process.env?.NODE_ENV === "production"),
  outDir: "dist",
});