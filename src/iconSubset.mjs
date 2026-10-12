// Shared by the kit's own icon generator and the Nuxt module's app scan: find
// "lucide:<name>" literals in source text and cut an iconify collection down to
// just those icons (aliases keep their parent).
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const NAME = /lucide:([a-z0-9]+(?:-[a-z0-9]+)*)/g
const SOURCE = /\.(vue|ts|tsx|js|jsx|mjs|md|html)$/
const SKIP = new Set(["node_modules", "dist", ".nuxt", ".output", ".git"])

export function namesInText(text) {
  return [...text.matchAll(NAME)].map((m) => m[1])
}

export function namesInDirs(dirs) {
  const names = new Set()
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
      else if (SOURCE.test(entry)) for (const n of namesInText(readFileSync(path, "utf8"))) names.add(n)
    }
  }
  for (const dir of dirs) walk(dir)
  return names
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
