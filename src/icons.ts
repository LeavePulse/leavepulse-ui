import { addCollection } from "@iconify/vue"
import lucide from "@iconify-json/lucide/icons.json"

/*
 * Register the lucide collection offline so <LpIcon name="lucide:*"> resolves
 * without hitting the iconify API (required for Tauri / air-gapped use).
 *
 * This pulls the whole lucide set. If bundle size matters in an app, replace
 * this with a curated subset via addIcon() — the LpIcon API is unchanged.
 */
addCollection(lucide as Parameters<typeof addCollection>[0])
