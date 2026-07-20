import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works when served from a GitHub Pages
  // project path like https://username.github.io/repo-name/
  base: "./",
});
