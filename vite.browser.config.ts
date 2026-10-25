import { defineConfig } from "vite"
import preview from "./vite.config"

export default defineConfig({
  ...preview,
  cacheDir: "node_modules/.vite-browser",
  server: { ...preview.server, port: 4501 },
})
