import { basics } from "./entries/basics"
import { data } from "./entries/data"
import { forms } from "./entries/forms"
import { motion } from "./entries/motion"
import { navigation } from "./entries/navigation"
import { onboarding } from "./entries/onboarding"
import { overlays } from "./entries/overlays"
import type { ComponentEntry } from "./entries/shared"
import { theming } from "./entries/theming"
import { patterns } from "./entries/patterns"
import * as fields from "./entries/fields"
import * as looks from "./entries/looks"
import * as process from "./entries/process"
import * as status from "./entries/status"
import * as layout from "./entries/layout"
import * as text from "./entries/text"

const groups = [status, process, fields, looks, text, layout]
const extra = (key: "Basics" | "Forms" | "Data" | "Overlays" | "Motion") =>
  groups.flatMap((g) => Object.entries(g).filter(([name]) => name.endsWith(key)).flatMap(([, list]) => list))

export type { ComponentEntry } from "./entries/shared"

export interface Section {
  id: string
  title: string
  icon: string
  /** One line for the index: what the section is for. */
  lead: string
  entries: ComponentEntry[]
}

export const sections: Section[] = [
  { id: "patterns", title: "Patterns", icon: "lucide:combine", lead: "Choose between similar components and try useful combinations with shared state.", entries: patterns },
  { id: "basics", title: "Basics", icon: "lucide:shapes", lead: "Buttons, cards, badges and the small pieces every screen is made of.", entries: [...basics, ...extra("Basics")] },
  { id: "forms", title: "Forms", icon: "lucide:text-cursor-input", lead: "Fields, pickers and uploads, each with its own validation and notices.", entries: [...forms, ...extra("Forms")] },
  { id: "data", title: "Data", icon: "lucide:chart-column", lead: "Charts, tables, stats and logs that load, empty and update without jumping.", entries: [...data, ...extra("Data")] },
  { id: "navigation", title: "Navigation", icon: "lucide:compass", lead: "Tabs, menus, the command palette and keyboard and gamepad movement.", entries: navigation },
  { id: "overlays", title: "Overlays and feedback", icon: "lucide:layers", lead: "Dialogs, drawers, toasts and the notification bell.", entries: [...overlays, ...extra("Overlays")] },
  { id: "motion", title: "Motion", icon: "lucide:wand-sparkles", lead: "Helpers that make size and content changes glide instead of jump.", entries: [...motion, ...extra("Motion")] },
  { id: "onboarding", title: "Tours and hints", icon: "lucide:graduation-cap", lead: "Guided tours, new-feature dots and samples for what is not there yet.", entries: onboarding },
  { id: "theming", title: "Theming", icon: "lucide:palette", lead: "Token-driven themes, switched with a reveal.", entries: theming },
]

export const sectionOf = new Map(sections.flatMap((s) => s.entries.map((e) => [e.id, s] as const)))

export const registry: ComponentEntry[] = sections.flatMap((s) => s.entries)
