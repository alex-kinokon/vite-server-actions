import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import serverComponents from "./dist/plugin";

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: "example-dist",
  },
  plugins: [react(), serverComponents()],
});
