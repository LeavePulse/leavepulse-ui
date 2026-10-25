// The components' own API, generated from their types (npm run gen:meta).
import raw from "./meta.json"

export type PropMeta = {
  name: string
  type: string
  required: boolean
  default?: string
  description?: string
  choices?: string[]
}
export type EventMeta = {
  name: string
  type: string
  description?: string
}
export interface ComponentMeta {
  props: PropMeta[]
  events: EventMeta[]
  slots: EventMeta[]
}

export const meta = raw as Record<string, ComponentMeta>

export const slotNames = (name: string) => meta[name]?.slots.map((s) => s.name) ?? []
