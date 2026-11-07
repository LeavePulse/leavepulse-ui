// Bundles what an app importing these would ship, minified and gzipped, against
// a budget, so one small change that drags in a heavy dependency fails here.
// Vue is the app's anyway and stays out. Needs a fresh `dist`.
//
// The budget covers what loads up front: the entry chunk and every chunk it
// imports statically. Chunks behind a dynamic import() (the full lucide set
// LpIcon loads on first use of an unregistered name, for one) are reported
// beside it but not held to the budget, since an app pays for them only when
// it reaches them.
import { gzipSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { build } from "vite"

const OUT = ".pack/size"
const KB = 1024
const ALIAS = { "@leavepulse/ui": fileURLToPath(new URL("../dist/index.js", import.meta.url)) }

/*
 * Budget in gzipped KB: what it measured when set (2026-11-07: 44.1, 65.9,
 * 104.3, 154.8, 14.5), plus about 10% for ordinary growth. Most of the button
 * is tailwind-merge and @iconify/vue, which every component shares; most of
 * the topology is Vue Flow, which nothing else pulls in.
 */
const SCENARIOS = {
  button: { code: 'export { LpButton } from "@leavepulse/ui"', budget: 48 },
  modal: { code: 'export { LpButton, LpModal } from "@leavepulse/ui"', budget: 72 },
  palette: { code: 'export { LpCommandPalette } from "@leavepulse/ui"', budget: 114 },
  topology: { code: 'export { LpTopologyCanvas } from "@leavepulse/ui"', budget: 170 },
  icon: { code: 'export { LpIcon } from "@leavepulse/ui"', budget: 16 },
}

mkdirSync(OUT, { recursive: true })
const over = []
for (const [name, { code, budget }] of Object.entries(SCENARIOS)) {
  const entry = `${OUT}/${name}.js`
  writeFileSync(entry, code)
  const result = await build({
    configFile: false,
    logLevel: "error",
    resolve: { alias: ALIAS },
    build: {
      write: false,
      lib: { entry, formats: ["es"], fileName: name },
      rollupOptions: { external: ["vue"] },
    },
  })
  const outputs = Array.isArray(result) ? result.flatMap((r) => r.output) : result.output
  const chunks = new Map(outputs.filter((file) => file.type === "chunk").map((file) => [file.fileName, file]))
  const eager = new Set()
  const visit = (fileName) => {
    if (eager.has(fileName) || !chunks.has(fileName)) return
    eager.add(fileName)
    for (const imported of chunks.get(fileName).imports) visit(imported)
  }
  for (const chunk of chunks.values()) if (chunk.isEntry) visit(chunk.fileName)
  const gzip = (files) => gzipSync(files.map((file) => file.code).join("")).length / KB
  const size = gzip([...chunks.values()].filter((chunk) => eager.has(chunk.fileName)))
  const lazy = gzip([...chunks.values()].filter((chunk) => !eager.has(chunk.fileName)))
  console.log(
    `check-size: ${name} ${size.toFixed(1)} KB gzip up front (budget ${budget}), ${lazy.toFixed(1)} KB lazy`,
  )
  if (size > budget) over.push(name)
}

if (over.length) {
  console.error(`check-size: over budget: ${over.join(", ")}`)
  process.exit(1)
}
