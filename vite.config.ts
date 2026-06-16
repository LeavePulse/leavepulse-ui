import tailwind from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [vue(), tailwind()],
  // Preview output goes to its own dir so a `vite build` of the demo never
  // clobbers the library's dist (which is built by vite.lib.config.ts).
  build: { outDir: "dist-preview" },
  resolve: {
    alias: {
      // Preview needs the runtime template compiler for the live playground.
      // The kit package itself never depends on this build.
      vue: "vue/dist/vue.esm-bundler.js",
      // Resolve the bridge's bare import to our local kit source.
      "@leavepulse/ui": new URL("./src/index.ts", import.meta.url).pathname,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4500,
    strictPort: true,
  },
})
