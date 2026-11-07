<script setup lang="ts">
import { computed, ref } from "vue"
import LpCommandPalette, { type Command } from "../../src/components/LpCommandPalette.vue"
import type { RecentEntry } from "../../src/components/commandPalette"

const open = ref(false)
const generation = ref("Old row")
declare global {
  interface Window { swapFetcher?: () => void; pwned?: boolean }
}
window.swapFetcher = () => (generation.value = "New row")

const commands = computed<Command[]>(() => {
  const row = generation.value
  return [
    { id: "services", label: "Services", children: [{ id: "restart", label: "Restart service" }] },
    { id: "restart", label: "Restart root" },
    { id: "live", label: "Live mode", children: async () => [{ id: "row", label: row }] },
    { id: "bad", label: "Bad link", href: "javascript:window.pwned=true" },
    { id: "ask", label: "Ask a name", prompt: { placeholder: "Name", submit: () => {} } },
  ]
})

async function search(query: string): Promise<Command[]> {
  if (!"ada".startsWith(query.toLowerCase())) return []
  return [
    { id: "ada", label: "Ada Lovelace", recentData: { kind: "person" } },
    { id: "ada", label: "Ada again", recentData: { kind: "person" } },
  ]
}

const resolveRecent = (entry: RecentEntry): Command | null =>
  (entry.data as { kind?: string } | undefined)?.kind === "person"
    ? { id: entry.id, label: `Resolved ${entry.label}`, recentData: entry.data }
    : null
</script>

<template>
  <button type="button" @click="open = true">Open palette</button>
  <LpCommandPalette v-model:open="open" :commands="commands" :search="search" :debounce="0" recent-key="pw-remote" :resolve-recent="resolveRecent" />
</template>
