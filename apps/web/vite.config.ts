import { defineConfig } from "vite";
import { rmSync } from "node:fs";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "exclude-local-fixtures",
      closeBundle() {
        for (const file of ["local-deployment.json", "local-proofs.json"])
          rmSync(`dist/${file}`, { force: true });
      },
    },
  ],
  base: process.env.VITE_BASE_PATH || "/",
  server: { strictPort: true },
  build: { chunkSizeWarningLimit: 850 },
});
