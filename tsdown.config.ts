import { defineConfig } from 'tsdown';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  clean: true,
  target: "node22",
  treeshake: true,
  minify: process.env?.NODE_ENV === "production",
  sourcemap: process.env?.NODE_ENV !== "production",
  outDir: "dist",
  
  alias: {
    '@': path.resolve(rootDirectory, './src'),
    '@config': path.resolve(rootDirectory, './src/config'),
    '@controllers': path.resolve(rootDirectory, './src/controllers'),
    '@middleware': path.resolve(rootDirectory, './src/middleware'),
    '@models': path.resolve(rootDirectory, './src/models'),
    '@routes': path.resolve(rootDirectory, './src/routes'),
    '@services': path.resolve(rootDirectory, './src/services'),
    '@utils': path.resolve(rootDirectory, './src/utils'),
    '@types': path.resolve(rootDirectory, './src/types'),
    '@dto': path.resolve(rootDirectory, './src/dto'),
  },
});
