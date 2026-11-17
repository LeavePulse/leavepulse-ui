// Pairs lucide names with an icon set, for a look that draws with that set.
//
// An app keeps writing "lucide:check"; a look's `icons` says which icon of its
// own set draws it. Writing that table by hand for hundreds of names is the
// part nobody does, so this builds it: a name pairs with the icon of the same
// name, and `synonyms` cover the ones the set names differently
// (lucide "x" is pixelarticons "close"). A name with no pair stays lucide.
//
// `only` limits it to the lucide names the app renders, and the collection is
// cut down to their icons, so a look carries a few kilobytes instead of the
// whole set. The pixel look is built by this same function at kit build time.
import { subset } from "../iconCut.mjs"

export function iconPairs(collection, options = {}) {
  const synonyms = options.synonyms ?? {}
  const has = (name) => Boolean(collection.icons[name] || collection.aliases?.[name])
  const map = {}
  if (options.only) {
    for (const raw of options.only) {
      const name = String(raw).replace(/^lucide:/, "")
      const target = synonyms[name] ?? name
      if (has(target)) map[name] = target
    }
  } else {
    for (const name of [...Object.keys(collection.icons), ...Object.keys(collection.aliases ?? {})]) map[name] = name
    for (const [name, target] of Object.entries(synonyms)) if (has(target)) map[name] = target
  }
  const kept = options.only ? subset(collection, new Set(Object.values(map))) : collection
  return { prefix: collection.prefix, map, collection: kept }
}
