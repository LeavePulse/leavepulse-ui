// Shared by the kit's own icon generator and the Nuxt module's app scan: find
// "<prefix>:<name>" literals in source text and cut an iconify collection down
// to just those icons (aliases keep their parent). Any prefix is collected;
// whoever reads the result decides which prefixes are icon sets (the module
// keeps those the app has an @iconify-json package for), so "node:fs" in a
// source file costs nothing.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const PART = "[a-z0-9]+(?:-[a-z0-9]+)*"
const REF = new RegExp(`(?<![a-z0-9-])(${PART}):(${PART})`, "g")
const SOURCE = /\.(vue|ts|tsx|js|jsx|mjs|md|html)$/
const SKIP = new Set(["node_modules", "dist", ".nuxt", ".output", ".git"])

/** Every "<prefix>:<name>" literal, as [prefix, name] pairs. */
export function refsInText(text) {
  return [...text.matchAll(REF)].map((m) => [m[1], m[2]])
}

/** The lucide names in a text. */
export function namesInText(text) {
  return refsInText(text)
    .filter(([prefix]) => prefix === "lucide")
    .map(([, name]) => name)
}

/** Every "<prefix>:<name>" literal under the dirs, as prefix -> names. */
export function refsInDirs(dirs) {
  const refs = new Map()
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP.has(entry)) continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (SOURCE.test(entry)) {
        for (const [prefix, name] of refsInText(readFileSync(path, "utf8"))) {
          if (!refs.has(prefix)) refs.set(prefix, new Set())
          refs.get(prefix).add(name)
        }
      }
    }
  }
  for (const dir of dirs) walk(dir)
  return refs
}

/** The lucide names under the dirs. */
export function namesInDirs(dirs) {
  return refsInDirs(dirs).get("lucide") ?? new Set()
}

export function subset(collection, names) {
  const icons = {}
  const aliases = {}
  for (const name of [...names].sort()) {
    if (collection.icons[name]) {
      icons[name] = collection.icons[name]
      continue
    }
    const alias = collection.aliases?.[name]
    if (!alias) continue
    aliases[name] = alias
    if (collection.icons[alias.parent]) icons[alias.parent] = collection.icons[alias.parent]
  }
  const out = { prefix: collection.prefix, icons, width: collection.width, height: collection.height }
  if (Object.keys(aliases).length) out.aliases = aliases
  return out
}
