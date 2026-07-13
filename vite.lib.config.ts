import vue from "@vitejs/plugin-vue"
import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import { libInjectCss } from "vite-plugin-lib-inject-css"

const require = createRequire(import.meta.url)
const pkg = require("./package.json")
const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Every dependency and peer stays external so the kit ships only its own code;
// the predicate also matches deep import paths (e.g. "@vue-flow/core/dist/..").
const externalNames = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]
const isExternal = (id: string) =>
  externalNames.some((name) => id === name || id.startsWith(`${name}/`))

// One entry per source file (each component/composable is its own chunk),
// mirroring src/ into dist/. Multiple entries — rather than preserveModules —
// is the combination libInjectCss supports, so each chunk gets its scoped CSS
// injected. Keys are dist-relative paths without extension → dist/<key>.js.
function collectEntries() {
  const entries: Record<string, string> = { index: resolve("./src/index.ts") }
  for (const dir of ["components", "composables", "layout"]) {
    for (const file of readdirSync(resolve(`./src/${dir}`))) {
      if (!/\.(vue|ts)$/.test(file) || file.endsWith(".d.ts")) continue
      entries[`${dir}/${file.replace(/\.ts$/, "")}`] = resolve(`./src/${dir}/${file}`)
    }
  }
  return entries
}

/*
 * Library build for the publishable @leavepulse/ui package.
 * Separate from vite.config.ts (which serves the preview and aliases vue to the
 * runtime compiler — not wanted in a library). Externalizes all framework deps
 * so the kit ships only its own code; consumers provide vue/reka/etc.
 *
 * Code-split per source file: index.js is a thin re-export barrel, so a
 * consumer importing one component (or the Nuxt module's per-component
 * auto-import) pulls only that component's chunk and its real dependencies —
 * never the whole kit. That is what lets a docs site ship a handful of
 * components instead of the full bundle.
 */
export default defineConfig({
  plugins: [
    vue(),
    // Injects each component's scoped CSS into its own chunk via an import,
    // so a consumer importing one component still gets its styles. Requires
    // the multiple-entry (not preserveModules) layout above.
    libInjectCss(),
    dts({
      include: ["src"],
      exclude: ["src/**/*.spec.ts", "src/_css-entry.ts"],
      tsconfigPath: "./tsconfig.build.json",
    }),
  ],
  build: {
    outDir: "dist",
    cssCodeSplit: true,
    // Consumers minify themselves; keep the many small chunks readable.
    minify: false,
    lib: {
      entry: collectEntries(),
      formats: ["es"],
    },
    rollupOptions: {
      external: isExternal,
      output: {
        // Entry names mirror src/ (e.g. components/LpButton.vue.js) so they
        // line up with the .d.ts vite-plugin-dts emits. Shared script/template
        // sub-chunks that plugin-vue splits out get a tidy name instead of the
        // default ".vue_vue_type_script_setup_true_lang" mangling.
        entryFileNames: "[name].js",
        chunkFileNames: (chunk) => {
          const clean = chunk.name.replace(/\.vue_vue_type.*$/, "")
          return `chunks/${clean}-[hash].js`
        },
        assetFileNames: "assets/[name]-[hash][extname]",
        // Avoids the empty-import artifacts libInjectCss warns about.
        hoistTransitiveImports: false,
        globals: { vue: "Vue" },
      },
    },
  },
})
