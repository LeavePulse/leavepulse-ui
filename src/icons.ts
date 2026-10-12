import { addCollection, addIcon, iconLoaded, type IconifyIcon, type IconifyJSON } from "@iconify/vue"
import { ref } from "vue"
import { KIT_ICONS } from "./kit-icons"

/*
 * Offline icons without the whole lucide set in every bundle. The kit registers
 * only the icons its own components render (KIT_ICONS, generated at build). Any
 * other "lucide:*" name an app renders loads the full collection as a separate
 * chunk on first use, from the app's own bundle, never from the iconify API, so
 * Tauri and air-gapped apps keep working. Apps that need every icon in the
 * server render (or no late chunk at all) register them up front: the Nuxt
 * module's `icons` option, `registerIcons`, or `import "@leavepulse/ui/icons-all"`.
 */
addCollection(KIT_ICONS)

/** Bumped whenever icons are registered, so rendered icons re-resolve. */
export const iconsVersion = ref(0)

let lucide: Promise<IconifyJSON> | undefined

function loadLucide(): Promise<IconifyJSON> {
  lucide ??= import("@iconify-json/lucide/icons.json").then((m) => (m.default ?? m) as IconifyJSON)
  return lucide
}

/** Register a whole iconify collection (any prefix) for offline use. */
export function registerIconCollection(collection: IconifyJSON): void {
  addCollection(collection)
  iconsVersion.value++
}

/**
 * Register lucide icons by name ("check" or "lucide:check") from the bundled
 * collection. Resolves once they render offline.
 */
export async function registerIcons(names: readonly string[]): Promise<void> {
  const wanted = names.map((n) => n.replace(/^lucide:/, ""))
  if (wanted.every((n) => iconLoaded(`lucide:${n}`))) return
  const all = await loadLucide()
  for (const name of wanted) {
    const parent = all.aliases?.[name]?.parent
    const body = all.icons[name] ?? (parent ? all.icons[parent] : undefined)
    if (!body) continue
    const icon: IconifyIcon = { width: all.width, height: all.height, ...body }
    addIcon(`lucide:${name}`, icon)
  }
  iconsVersion.value++
}

/** Register the full lucide collection. */
export async function registerAllIcons(): Promise<void> {
  registerIconCollection(await loadLucide())
}

const pending = new Set<string>()

/** A lucide name that isn't registered yet: load it from the bundled set. */
export function requestIcon(name: string): void {
  if (pending.has(name) || typeof window === "undefined") return
  pending.add(name)
  void registerIcons([name]).finally(() => pending.delete(name))
}
