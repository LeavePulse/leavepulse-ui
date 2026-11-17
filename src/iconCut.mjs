// Cutting an iconify collection down to some of its names, aliases keeping
// their parent. Pure: no file system, so the browser-side iconPairs and the
// build scripts share it, while iconSubset.mjs (which reads source files) stays
// node-only.
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
