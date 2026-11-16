<script setup lang="ts">
/*
 * The menu a trigger opens at the cursor: blocks for "/", people and channels
 * for a mention. Items are grouped and, unless the trigger searched them
 * itself, ranked with the kit's command search (a query typed in the wrong
 * keyboard layout still finds them). Focus stays in the document; the editor
 * forwards arrows and Enter.
 */
import { autoUpdate, computePosition, flip, offset, shift, size } from "@floating-ui/dom"
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { parseCommandQuery, searchCommandItems } from "../components/commandSearch"
import { POPOVER_PANEL } from "../components/dropdown"
import LpAvatar from "../components/LpAvatar.vue"
import LpIcon from "../components/LpIcon.vue"
import { scrollToElement } from "../composables/scroll"
import { usePortalTarget } from "../composables/useView"

import type { PickItem } from "./blocks"

const props = defineProps<{
  items: PickItem[]
  query: string
  rect: () => DOMRect | null
  empty: string
  open: boolean
  searched?: boolean
}>()
const emit = defineEmits<{ (e: "pick", id: string): void }>()

const portalTo = usePortalTarget()
const panel = ref<HTMLElement | null>(null)
const index = ref(0)

const found = computed(() => (props.searched ? props.items : searchCommandItems(props.items, parseCommandQuery(props.query)).items))
const sections = computed(() => {
  const out = new Map<string, { label: string; rows: { item: PickItem; at: number }[] }>()
  found.value.forEach((item, at) => {
    const section = out.get(item.group) ?? { label: item.groupLabel ?? item.group, rows: [] }
    section.rows.push({ item, at })
    out.set(item.group, section)
  })
  return [...out.values()]
})
const ordered = computed(() => sections.value.flatMap((section) => section.rows.map((row) => row.item)))

watch(() => props.query, () => (index.value = 0))

function move(step: number) {
  const count = ordered.value.length
  if (!count) return
  index.value = (index.value + step + count) % count
  void nextTick(() => scrollToElement(panel.value?.querySelector(`[data-row="${index.value}"]`), { container: panel.value ?? undefined }))
}

function key(event: KeyboardEvent): boolean {
  if (event.key === "ArrowDown") return move(1), true
  if (event.key === "ArrowUp") return move(-1), true
  if (event.key === "Enter" || event.key === "Tab") {
    const item = ordered.value[index.value]
    if (!item) return false
    emit("pick", item.id)
    return true
  }
  return false
}
defineExpose({ key })

const virtual = { getBoundingClientRect: () => props.rect() ?? new DOMRect() }
let stop: (() => void) | undefined
watch(panel, (element) => {
  stop?.()
  if (!element) return
  stop = autoUpdate(virtual, element, () => {
    void computePosition(virtual, element, {
      strategy: "fixed",
      placement: "bottom-start",
      middleware: [
        offset(6),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        size({ padding: 8, apply: ({ availableHeight }) => element.style.setProperty("max-height", `${Math.min(360, availableHeight)}px`) }),
      ],
    }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
  })
})
onBeforeUnmount(() => stop?.())

function order(item: PickItem) {
  return ordered.value.indexOf(item)
}
</script>

<template>
  <Teleport :to="portalTo">
    <Transition leave-active-class="animate-[popover-out_100ms_ease] motion-reduce:animate-none">
    <div v-if="open" ref="panel" :class="POPOVER_PANEL" class="fixed left-0 top-0 z-(--z-popover) w-72 overflow-y-auto p-1" data-state="open" data-side="bottom" role="listbox" @mousedown.prevent>
      <p v-if="!ordered.length" class="px-3 py-2 text-sm text-muted">{{ empty }}</p>
      <div v-for="section in sections" :key="section.label" class="py-0.5">
        <p class="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{{ section.label }}</p>
        <button
          v-for="row in section.rows"
          :key="row.item.id"
          type="button"
          role="option"
          :data-row="order(row.item)"
          :aria-selected="order(row.item) === index"
          class="flex w-full items-center gap-2.5 rounded-[calc(var(--radius-control)-2px)] px-2 py-1.5 text-left transition-colors"
          :class="order(row.item) === index ? 'bg-brand-soft text-ink' : 'text-muted-strong hover:bg-ink/[0.05]'"
          @mouseenter="index = order(row.item)"
          @click="emit('pick', row.item.id)"
        >
          <LpAvatar v-if="row.item.image" :src="row.item.image" :alt="row.item.label" size="sm" class="shrink-0" />
          <span v-else class="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-raised">
            <LpIcon :name="row.item.icon ?? 'lucide:circle'" class="size-4" />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm text-ink">{{ row.item.label }}</span>
            <span v-if="row.item.description" class="block truncate text-xs text-muted">{{ row.item.description }}</span>
          </span>
        </button>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>
