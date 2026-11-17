import type { IconifyJSON } from "@iconify/vue"
import type { LookIcons } from "./look"

export interface IconPairsOptions {
  /** lucide name → name in the collection, for pairs the set names differently. */
  synonyms?: Readonly<Record<string, string>>
  /** Only these lucide names ("check" or "lucide:check"); the collection is cut down to their icons. */
  only?: Iterable<string>
}

/** A look's `icons` for `collection`: same names pair up, `synonyms` cover the rest. */
export function iconPairs(collection: IconifyJSON, options?: IconPairsOptions): LookIcons
