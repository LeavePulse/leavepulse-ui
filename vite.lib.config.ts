import vue from "@vitejs/plugin-vue"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

/*
 * Library build for the publishable @leavepulse/ui package.
 * Separate from vite.config.ts (which serves the preview and aliases vue to the
 * runtime compiler — not wanted in a library). Externalizes all framework deps
 * so the kit ships only its own code; consumers provide vue/reka/etc.
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ["src"],
      // _css-entry.ts is a build-only shim for the CSS pass, not public API.
      exclude: ["src/**/*.spec.ts", "src/_css-entry.ts"],
      tsconfigPath: "./tsconfig.build.json",
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: "index",
    },
    outDir: "dist",
    rollupOptions: {
      // Everything framework-ish stays a peer — never bundle it.
      // Token CSS ships as source (exports "./tokens.css"), not via JS import.
      external: [
        "vue",
        "reka-ui",
        "motion-v",
        "@iconify/vue",
        "@iconify-json/lucide",
        "tailwind-variants",
        "tailwind-merge",
      ],
      output: { globals: { vue: "Vue" } },
    },
  },
})
