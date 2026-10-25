import { Text, type Slot, type VNode } from "vue"

/*
 * A slot's words when it holds nothing but text, else null. Components that
 * animate a change of what they say (a badge rolling to a new status, an alert
 * swapping its message) need to know when the words changed; anything richer
 * (an icon, markup) is shown as given and only its box eases.
 */
export function slotText(slot: Slot | undefined): string | null {
  const nodes: VNode[] = slot?.() ?? []
  if (!nodes.length || !nodes.every((node) => node.type === Text)) return null
  return nodes.map((node) => String(node.children ?? "")).join("").trim() || null
}
