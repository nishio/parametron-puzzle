import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "editor",
  base: "./",
  plugins: [react()],
  publicDir: "../public",
  build: { outDir: "../docs", emptyOutDir: true },
});
