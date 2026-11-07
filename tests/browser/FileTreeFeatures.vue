<script setup lang="ts">
import { computed, ref } from "vue"
import LpFileTree from "../../src/components/LpFileTree.vue"
import type { FileNode } from "../../src/components/fileTree"

const part = new URLSearchParams(location.search).get("part") ?? "full"

const BIG_FOLDER = 5000
const LOAD_MS = 300

const small: FileNode[] = [
  {
    id: "src",
    name: "src",
    kind: "dir",
    children: [
      { id: "src/a.ts", name: "a.ts", kind: "file", size: 100 },
      { id: "src/b.png", name: "b.png", kind: "file", size: 5000 },
    ],
  },
  { id: "docs", name: "docs", kind: "dir", children: [{ id: "docs/guide.md", name: "guide.md", kind: "file" }] },
  { id: "lazy", name: "lazy", kind: "dir" },
]
const big: FileNode[] = [
  {
    id: "big",
    name: "big",
    kind: "dir",
    children: Array.from({ length: BIG_FOLDER }, (_, i) => ({ id: `big/${i}`, name: `file-${i}`, kind: "file" as const })),
  },
]

const log = ref<string[]>([])
const selected = ref("")
const selection = ref<string[]>([])
const expanded = ref(part === "virtual" ? ["big"] : ["src", "docs"])

async function load(node: FileNode, signal: AbortSignal): Promise<FileNode[]> {
  signal.addEventListener("abort", () => log.value.push(`aborted ${node.id}`))
  await new Promise((resolve) => setTimeout(resolve, LOAD_MS))
  return [{ id: `${node.id}/late`, name: "late.txt", kind: "file" }]
}

const report = computed(() => JSON.stringify({ selection: selection.value, log: log.value }))
</script>

<template>
  <main class="flex h-96 w-96 flex-col gap-2 p-4">
    <LpFileTree v-if="part === 'plain'" :nodes="small" />
    <LpFileTree v-else-if="part === 'virtual'" v-model:expanded="expanded" class="min-h-0 flex-1" :nodes="big" virtual :sort="false" />
    <LpFileTree
      v-else
      v-model:selected="selected"
      v-model:selection="selection"
      v-model:expanded="expanded"
      class="min-h-0 flex-1"
      :nodes="small"
      searchable
      breadcrumb
      multiple
      movable
      renamable
      :load="load"
      @move="(m) => log.push(`move ${m.nodes.map((n) => n.id).join()} to ${m.target.id}`)"
      @rename="(n, name) => log.push(`rename ${n.id} to ${name}`)"
    />
    <output aria-label="Report">{{ report }}</output>
  </main>
</template>
