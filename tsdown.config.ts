import { defineConfig } from 'tsdown';
import path from 'node:path';

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  clean: true,
  target: "node22",
  treeshake: true,
  minify: process.env?.NODE_ENV === "production",
  sourcemap: process.env?.NODE_ENV !== "production",
  outDir: "dist",
  
  // Добавляем явное разрешение алиасов для tsdown / rolldown
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@config': path.resolve(__dirname, './src/config'),
    '@controllers': path.resolve(__dirname, './src/controllers'),
    '@middleware': path.resolve(__dirname, './src/middleware'),
    '@models': path.resolve(__dirname, './src/models'),
    '@routes': path.resolve(__dirname, './src/routes'),
    '@services': path.resolve(__dirname, './src/services'),
    '@utils': path.resolve(__dirname, './src/utils'),
    '@types': path.resolve(__dirname, './src/types'),
    '@dto': path.resolve(__dirname, './src/dto'),
  },
});
