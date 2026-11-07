<script lang="ts">
import IconCloseButton from "./IconCloseButton.vue"
import { clamp } from "../composables/clamp"
import type { DataListItem } from "./LpDataList.vue"

export interface InspectorSection {
  /** Stable identity, and the name of its slot: `#section-<key>`. */
  key: string
  title?: string
  /** Facts about the subject. Replaced by the section's slot, which is where editing fields go. */
  items?: DataListItem[]
  /** Folds under its title. Sections without a title cannot fold. */
  collapsible?: boolean
  /** Starts folded, when `collapsible`. */
  collapsed?: boolean
}

export default { inheritAttrs: false }
</script>

<script setup lang="ts" generic="T">
/*
 * The panel beside a table, graph or canvas that shows the selected thing and
 * lets it be edited: one place and one shape for "what is this, and change it".
 *
 *   <LpInspector :subject="server" :title="server?.name" :sections="[
 *     { key: 'facts', title: 'Overview', items: facts },
 *     { key: 'edit', title: 'Settings' },
 *   ]" v-model:open="inspecting" resizable persist="servers">
 *     <template #section-edit="{ subject }"><LpInput v-model="subject.name" label="Name" /></template>
 *   </LpInspector>
 *
 * It sits in the layout, beside what it inspects, so selecting another row
 * while it is open just works: nothing is covered and no focus is taken. On a
 * phone, where there is no beside, put it in an LpDrawer with `closable` off.
 *
 * With nothing selected it stays and says so (`#empty`), so the page around it
 * does not jump at every change of selection.
 */
import { computed, onBeforeUnmount, useSlots, watch } from "vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { useCloseGuard, type CloseGuard } from "../composables/useCloseGuard"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { usePersisted } from "../composables/usePersisted"
import { CLOSE_ICON } from "./dropdown"
import LpDataList from "./LpDataList.vue"
import LpDisclosure from "./LpDisclosure.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

const KEY_STEP = 16

const props = withDefaults(
  defineProps<{
    /** The thing inspected, handed to the slots. Empty state when nothing else is given either. */
    subject?: T | null
    title?: string
    subtitle?: string
    sections?: InspectorSection[]
    /** Which side of the content it sits on: the resize grip goes on the other. */
    side?: "left" | "right"
    /** Default width in px. */
    width?: number
    /** Drag the inner edge to resize, or use arrow keys on it. */
    resizable?: boolean
    minWidth?: number
    maxWidth?: number
    /** Remember the dragged width under this key, across visits. */
    persist?: string
    closable?: boolean
    /** Unsaved edits: `true` asks before closing, a function asks the app. */
    guard?: CloseGuard
    labels?: Partial<{ close: string; empty: string; resize: string; region: string }>
  }>(),
  { side: "right", width: 320, minWidth: 240, maxWidth: 640, closable: true, subject: undefined },
)

const open = defineModel<boolean>("open", { default: true })
const slots = useSlots()
const text = useLabels(
  "inspector",
  { close: "Close", empty: "Nothing selected", resize: "Resize panel", region: "Details" },
  () => props.labels,
)

const saved = usePersisted<number | null>(() => props.resizable && props.persist && `lp-inspector:${props.persist}`, null, {
  validate: (value): value is number | null => value === null || (typeof value === "number" && value > 0),
})
// Applied within today's limits; the saved width outlives a change to them.
const shownWidth = computed(() => clamp(saved.value ?? props.width, props.minWidth, props.maxWidth))

const isEmpty = computed(() => props.subject == null && !props.sections?.length && !slots.default)

const { allowClose } = useCloseGuard(() => props.guard, () => open.value)
async function close() {
  if (await allowClose()) open.value = false
}
defineExpose({ close })

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "relative flex h-full min-h-0 shrink-0 flex-col bg-surface border-line",
    props.side === "right" ? "border-l" : "border-r",
  ].join(" "),
)

let stopDrag: (() => void) | null = null

function startResize(event: PointerEvent) {
  if (event.button !== 0) return
  const start = shownWidth.value
  const startX = event.clientX
  const sign = props.side === "right" ? -1 : 1
  stopDrag = startPointerDrag(event, {
    move: (ev) => {
      saved.value = clamp(start + (ev.clientX - startX) * sign, props.minWidth, props.maxWidth)
    },
    end: () => (stopDrag = null),
  })
}

function onGripKeydown(event: KeyboardEvent) {
  const step = event.key === "ArrowLeft" ? -KEY_STEP : event.key === "ArrowRight" ? KEY_STEP : 0
  if (!step) return
  event.preventDefault()
  const sign = props.side === "right" ? -1 : 1
  saved.value = clamp(shownWidth.value + step * sign, props.minWidth, props.maxWidth)
}

watch(open, (isOpen) => {
  if (!isOpen) stopDrag?.()
})
onBeforeUnmount(() => stopDrag?.())
</script>

<template>
  <aside
    v-if="open"
    v-bind="rest"
    :class="rootClass"
    :style="{ width: `${shownWidth}px` }"
    :aria-label="title ?? text.region"
  >
    <div
      v-if="resizable"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="text.resize"
      :aria-valuenow="shownWidth"
      :aria-valuemin="minWidth"
      :aria-valuemax="maxWidth"
      class="group/resize absolute inset-y-0 z-10 w-1.5 cursor-ew-resize touch-none outline-none"
      :class="side === 'right' ? '-left-px' : '-right-px'"
      @pointerdown="startResize"
      @keydown="onGripKeydown"
    >
      <span class="absolute inset-y-0 left-0 w-px transition-colors group-hover/resize:bg-brand group-focus-visible/resize:bg-brand" />
    </div>

    <header v-if="title || subtitle || $slots.title || closable" class="flex shrink-0 items-start gap-2 px-4 pb-3 pt-4">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-sm font-semibold text-ink"><slot name="title">{{ title }}</slot></h2>
        <p v-if="subtitle" class="truncate text-xs text-muted">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
      <IconCloseButton v-if="closable" :label="text.close" @click="close" />
    </header>

    <LpScrollArea class="min-h-0 flex-1" content-class="flex flex-col gap-4 px-4 pb-4">
      <slot v-if="isEmpty" name="empty">
        <p class="py-8 text-center text-sm text-muted">{{ text.empty }}</p>
      </slot>
      <template v-else>
        <template v-for="section in sections" :key="section.key">
          <LpDisclosure v-if="section.collapsible && section.title" :label="section.title" :default-open="!section.collapsed">
            <slot :name="`section-${section.key}`" :subject="subject" :section="section">
              <LpDataList :items="section.items ?? []" size="sm" />
            </slot>
          </LpDisclosure>
          <section v-else class="flex flex-col gap-2">
            <h3 v-if="section.title" class="text-xs font-semibold text-muted">{{ section.title }}</h3>
            <slot :name="`section-${section.key}`" :subject="subject" :section="section">
              <LpDataList :items="section.items ?? []" size="sm" />
            </slot>
          </section>
        </template>
        <slot :subject="subject" />
      </template>
    </LpScrollArea>

    <footer v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 px-4 pb-4 pt-3">
      <slot name="footer" :subject="subject" :close="close" />
    </footer>
  </aside>
</template>
