import lucide from "@iconify-json/lucide/icons.json"
import type { IconifyJSON } from "@iconify/vue"
import { registerIconCollection } from "./icons"

/*
 * Side-effect entry: `import "@leavepulse/ui/icons-all"` registers every lucide
 * icon up front, for apps that render arbitrary icon names during SSR or want
 * no late chunk. Costs the whole collection (~540 KB before compression).
 */
registerIconCollection(lucide as IconifyJSON)
