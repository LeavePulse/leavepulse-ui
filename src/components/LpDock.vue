<script lang="ts">
export default { inheritAttrs: false }

export interface DockItem {
  /** Stable identity; what `select` reports and `active` matches. */
  id: string
  /** Name shown in the tooltip and announced as the button's name. */
  label: string
  /** Icon name (`lucide:*`). Use the `#icon` slot for an image or avatar instead. */
  icon?: string
  /** Render as a link. */
  href?: string
  disabled?: boolean
}
</script>

<script setup lang="ts">
/*
 * LpDock — a row (or column) of icon buttons that swell under the pointer,
 * their neighbours less with distance: the launcher's quick bar of apps,
 * instances or tools.
 *
 *   <LpDock :items="apps" :active="running" @select="open" />
 *
 * The magnification is a way to aim at small targets in a dense bar, not
 * decoration, so it is only on where it helps: a mouse. Touch and pen get
 * plain buttons at rest size (no hover to follow; a finger would only ever see
 * the icon it already pressed grow), and so does reduced motion.
 *
 * Sizes are springs stepped once per animation frame and written straight to
 * the elements, so the bar costs no re-render while the pointer moves — the
 * launcher runs on WebKitGTK, where a reactive update per pointermove shows.
 * The loop stops as soon as every icon is at rest.
 *
 * Keyboard: one Tab stop; arrows move along the bar (useRovingFocus), Home and
 * End jump, letters jump by label, Enter or Space selects. The focused icon
 * swells the same way the hovered one does, so keyboard users see where they
 * are in the same language. Labels live in tooltips, which also name the
 * buttons for screen readers.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { springSettled, springStep, type SpringState } from "../composables/usePillTransition"
import { useRovingFocus } from "../composables/useRovingFocus"
import { dockSize } from "./dock"
import LpIcon from "./LpIcon.vue"
import LpTooltip from "./LpTooltip.vue"

const props = withDefaults(
  defineProps<{
    items: DockItem[]
    /** Ids marked with a dot: running, open, or the current section. */
    active?: string | string[]
    /** Lay the bar out in a row or a column. */
    orientation?: "horizontal" | "vertical"
    /** Resting icon size in px. */
    size?: number
    /** Size of the icon right under the pointer, in px. Equal to `size` turns magnification off. */
    magnify?: number
    /** How far, in px, the swell reaches to either side of the pointer. */
    reach?: number
    /** Which side the tooltips open on; defaults to away from the bar's edge. */
    tooltipSide?: "top" | "right" | "bottom" | "left"
    /**
     * Drive the swell from outside — a pointer position along the bar, in px
     * from its start. For demos and guided tours; `null` hands it back to the
     * pointer.
     */
    focusAt?: number | null
  }>(),
  { orientation: "horizontal", size: 44, magnify: 72, reach: 150, focusAt: null },
)

const emit = defineEmits<{ select: [id: string, item: DockItem] }>()

defineSlots<{
  icon?(props: { item: DockItem; active: boolean }): unknown
}>()

const vertical = computed(() => props.orientation === "vertical")

const { class: classes, attrs: rest } = useMergedAttrs(() =>
  [
    "lp-skin-panel inline-flex rounded-card border border-line bg-surface-raised p-1.5 gap-1.5",
    vertical.value ? "flex-col items-start" : "flex-row items-end",
  ].join(" "),
)

const activeIds = computed(() => new Set(Array.isArray(props.active) ? props.active : props.active ? [props.active] : []))

function select(id: string) {
  const item = props.items.find((entry) => entry.id === id)
  if (item && !item.disabled) emit("select", id, item)
}

const roving = useRovingFocus(
  () => props.items.map((item) => ({ id: item.id, label: item.label, disabled: item.disabled })),
  { orientation: props.orientation, onActivate: select },
)

// ── magnification ─────────────────────────────────────────

const buttons = new Map<string, HTMLElement>()
const springs = new Map<string, SpringState>()
const bar = ref<HTMLElement | null>(null)

// Where the swell is centred, in client px along the bar's axis; null = rest.
let pointer: number | null = null
let frame = 0
let lastTime = 0

function setButton(id: string, el: unknown) {
  if (el instanceof HTMLElement) buttons.set(id, el)
  else buttons.delete(id)
}

function centreOf(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  return vertical.value ? rect.top + rect.height / 2 : rect.left + rect.width / 2
}

function targetFor(el: HTMLElement): number {
  if (pointer === null) return props.size
  return dockSize(props.size, Math.max(props.size, props.magnify), pointer - centreOf(el), props.reach)
}

function step(time: number) {
  frame = 0
  const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60
  lastTime = time
  let moving = false
  // Read every target before writing any size: interleaving reads and writes
  // would force a layout per icon per frame.
  const targets = new Map<string, number>()
  for (const [id, el] of buttons) targets.set(id, targetFor(el))
  for (const [id, el] of buttons) {
    const target = targets.get(id)!
    const next = springStep(springs.get(id) ?? { value: props.size, velocity: 0 }, target, "pill", dt)
    const settled = springSettled(next, target)
    const value = settled ? target : next.value
    springs.set(id, settled ? { value: target, velocity: 0 } : next)
    el.style.setProperty("--lp-dock-size", `${value.toFixed(2)}px`)
    if (!settled) moving = true
  }
  if (moving) frame = requestAnimationFrame(step)
  else lastTime = 0
}

function kick() {
  if (!frame) frame = requestAnimationFrame(step)
}

function magnifying(): boolean {
  return props.magnify > props.size && !prefersReducedMotion()
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== "mouse" || props.focusAt !== null || !magnifying()) return
  pointer = vertical.value ? event.clientY : event.clientX
  kick()
}

function onPointerLeave() {
  if (props.focusAt !== null) return
  pointer = null
  kick()
}

function onFocusIn(event: FocusEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.matches(":focus-visible") || props.focusAt !== null || !magnifying()) return
  pointer = centreOf(target)
  kick()
}

function onFocusOut(event: FocusEvent) {
  if (bar.value?.contains(event.relatedTarget as Node | null) || props.focusAt !== null) return
  pointer = null
  kick()
}

// The outside-driven swell: converted from bar-relative to client px on every
// frame it is set, so a bar that moves (scrolls) keeps the swell in place.
watch(
  () => props.focusAt,
  (at) => {
    if (at === null) {
      pointer = null
    } else if (bar.value && magnifying()) {
      const rect = bar.value.getBoundingClientRect()
      pointer = (vertical.value ? rect.top : rect.left) + at
    }
    kick()
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
})

const dotSide = computed(() => (vertical.value ? "left" : "bottom"))
const tipSide = computed(() => props.tooltipSide ?? (vertical.value ? "right" : "top"))
</script>

<template>
  <div
    :ref="(el) => { bar = el as HTMLElement | null; roving.setContainer(el as HTMLElement | null) }"
    role="toolbar"
    :aria-orientation="orientation"
    :class="classes"
    :style="{ '--lp-dock-rest': `${size}px` }"
    :data-orientation="orientation"
    v-bind="rest"
    @keydown="roving.onKeydown"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div
      v-for="item in items"
      :key="item.id"
      class="relative flex shrink-0 items-center justify-center"
    >
      <LpTooltip :content="item.label" label :side="tipSide" :delay="0">
        <component
          :is="item.href && !item.disabled ? 'a' : 'button'"
          :ref="(el: unknown) => setButton(item.id, el)"
          :type="item.href ? undefined : 'button'"
          :href="item.disabled ? undefined : item.href"
          :disabled="item.href ? undefined : item.disabled"
          :aria-disabled="item.disabled || undefined"
          :aria-current="activeIds.has(item.id) ? 'true' : undefined"
          v-bind="roving.itemProps(item.id)"
          class="lp-dock-item flex items-center justify-center rounded-control bg-surface-soft text-ink outline-none transition-colors duration-(--duration-fast) hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-50"
          @click="select(item.id)"
        >
          <slot name="icon" :item="item" :active="activeIds.has(item.id)">
            <LpIcon v-if="item.icon" :name="item.icon" class="size-[52%]" aria-hidden="true" />
          </slot>
        </component>
      </LpTooltip>
      <span
        aria-hidden="true"
        class="pointer-events-none absolute size-1 rounded-pill bg-brand transition-[opacity,scale] duration-(--duration-medium) ease-(--ease-emphasized)"
        :class="[
          dotSide === 'bottom' ? '-bottom-1 left-1/2 -translate-x-1/2' : '-left-1 top-1/2 -translate-y-1/2',
          activeIds.has(item.id) ? 'opacity-100 scale-100' : 'opacity-0 scale-0',
        ]"
      />
    </div>
  </div>
</template>

<style scoped>
/* The bar keeps its rest thickness while icons swell: they grow out of it
   (upward, or to the right when vertical) instead of pushing the bar, and
   with it whatever sits next to the bar, around on every pointer move. */
[data-orientation="horizontal"] {
  height: calc(var(--lp-dock-rest) + 0.75rem + 2px);
}
[data-orientation="vertical"] {
  width: calc(var(--lp-dock-rest) + 0.75rem + 2px);
}

/* Size is a custom property the spring writes per frame; the rest size is the
   fallback so the first paint (and touch, and reduced motion) needs no script. */
.lp-dock-item {
  width: var(--lp-dock-size, var(--lp-dock-rest));
  height: var(--lp-dock-size, var(--lp-dock-rest));
}
</style>
