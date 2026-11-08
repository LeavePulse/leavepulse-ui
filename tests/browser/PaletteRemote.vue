<script setup lang="ts">
import { computed, ref } from "vue"
import LpCommandPalette, { type Command } from "../../src/components/LpCommandPalette.vue"
import type { RecentEntry } from "../../src/components/commandPalette"

const open = ref(false)
const generation = ref("Old row")
declare global {
  interface Window { swapFetcher?: () => void; pwned?: boolean; releaseSlow?: (fail?: boolean) => void; streamClosed?: boolean }
}
window.swapFetcher = () => (generation.value = "New row")

// Two quick rows at once, then a slow one ahead of them once the test lets it
// through (or a throw in its place).
async function* streamed(): AsyncGenerator<Command[]> {
  window.streamClosed = false
  const fast: Command[] = [{ id: "fast-1", label: "Fast one" }, { id: "fast-2", label: "Fast two" }]
  try {
    yield fast
    const fail = await new Promise<boolean>((resolve) => (window.releaseSlow = (f = false) => resolve(f)))
    if (fail) throw new Error("slow source down")
    yield [{ id: "slow", label: "Slow row" }, ...fast]
  } finally {
    window.streamClosed = true
  }
}

const commands = computed<Command[]>(() => {
  const row = generation.value
  return [
    { id: "services", label: "Services", children: [{ id: "restart", label: "Restart service" }] },
    { id: "restart", label: "Restart root" },
    { id: "live", label: "Live mode", children: async () => [{ id: "row", label: row }] },
    { id: "stream", label: "Streamed mode", children: streamed },
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
