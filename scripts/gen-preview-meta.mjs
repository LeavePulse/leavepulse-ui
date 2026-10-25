// The preview's API tables, read from the components' own types: props with
// their type, default, doc comment and the choices of a string union, plus
// events and slots. Written once to preview/playground/meta.json, so the tables
// never drift from the code the way hand-written ones would.
import { readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createChecker } from "vue-component-meta"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dir = join(root, "src/components")
const checker = createChecker(join(root, "tsconfig.build.json"), {
  forceUseTs: true,
  printer: { newLine: 1 },
  noDeclarations: true,
})

// The union's string members, when the prop is nothing but string literals
// (and undefined): those become the playground's select options.
function choices(type) {
  const parts = type.split("|").map((t) => t.trim()).filter((t) => t !== "undefined")
  if (!parts.length || !parts.every((t) => /^"[^"]*"$/.test(t))) return undefined
  return parts.map((t) => t.slice(1, -1))
}

const out = {}
for (const file of readdirSync(dir).filter((f) => /^Lp.*\.vue$/.test(f)).sort()) {
  const name = file.replace(/\.vue$/, "")
  let meta
  try {
    meta = checker.getComponentMeta(join(dir, file))
  } catch (error) {
    console.warn(`skipped ${name}: ${error.message}`)
    continue
  }
  out[name] = {
    props: meta.props
      .filter((p) => !p.global)
      .map((p) => ({
        name: p.name,
        type: p.type,
        required: p.required,
        default: p.default,
        description: p.description || undefined,
        choices: choices(p.type),
      })),
    events: meta.events.map((e) => ({ name: e.name, type: e.type, description: e.description || undefined })),
    slots: meta.slots.map((s) => ({ name: s.name, type: s.type, description: s.description || undefined })),
  }
}

const target = join(root, "preview/playground/meta.json")
writeFileSync(target, JSON.stringify(out, null, 1) + "\n")
console.log(`wrote ${Object.keys(out).length} components to ${target}`)
