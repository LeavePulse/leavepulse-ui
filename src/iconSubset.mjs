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

/** Every "<prefix>:<name>" literal under the dirs, as prefix -> names. `skip` are paths left out. */
export function refsInDirs(dirs, skip = []) {
  const refs = new Map()
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry)
      if (SKIP.has(entry) || skip.includes(path)) continue
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
export function namesInDirs(dirs, skip = []) {
  return refsInDirs(dirs, skip).get("lucide") ?? new Set()
}
