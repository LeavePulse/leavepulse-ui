<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts" generic="T">
/*
 * LpMasonry — items of different heights packed into columns without the
 * ragged gaps a grid leaves: memo cards, screenshots, mod tiles.
 *
 *   <LpMasonry :items="memos" item-key="id" :min-column-width="240">
 *     <template #default="{ item }"><LpCard>{{ item.text }}</LpCard></template>
 *   </LpMasonry>
 *
 * Why positioned, not CSS columns: `column-count` fills column by column, so
 * the first items run down the left edge and adding one item reflows
 * everything. Here each item goes, in order, into the shortest column, so the
 * newest content stays at the top and an appended item leaves the rest alone.
 *
 * Every item is measured (one ResizeObserver for all of them) and placed with
 * the `translate` property, so a change of column count, an item growing, or one being
 * added or removed makes the others glide to their new places rather than
 * jump; the container's height eases along. Items arrive with a short
 * staggered entrance the first time the block is seen (useReveal), and later
 * additions fade in where they land. Reduced motion places everything at once.
 *
 * DOM order is the items' order, which is also the reading order for
 * keyboard and screen readers.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { easingToken, prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useReveal } from "../composables/useReveal"
import { masonryColumnCount, placeMasonry } from "./masonry"
import { staggerDelay } from "./reveal"

const props = withDefaults(
  defineProps<{
    items: T[]
    /** Field (or function) giving each item a stable identity, so it keeps its element across changes. */
    itemKey?: keyof T | ((item: T, index: number) => string | number)
    /**
     * Fixed column count, or a table of minimum container widths to counts
     * (`{ 0: 1, 560: 2, 900: 3 }`). Omit to fit as many `minColumnWidth`
     * columns as the container allows — the right default, because a masonry
     * usually lives in a panel whose width the viewport does not decide.
     */
    columns?: number | Record<number, number>
    /** Narrowest a column may get when the count is derived from the width. */
    minColumnWidth?: number
    /** Upper bound for the derived count. */
    maxColumns?: number
    /** Space between items, in px, both ways. */
    gap?: number
    /** Play the entrance when the block is first seen. Off shows it as is. */
    entrance?: boolean
  }>(),
  { minColumnWidth: 240, gap: 16, entrance: true },
)

defineSlots<{
  default?(props: { item: T; index: number }): unknown
}>()

const { class: classes, attrs: rest } = useMergedAttrs(
  () => "relative w-full transition-[height] duration-(--duration-slow) ease-(--ease-emphasized)",
)

function keyOf(item: T, index: number): string | number {
  const key = props.itemKey
  if (typeof key === "function") return key(item, index)
  if (key != null) return item[key] as string | number
  return index
}

const keys = computed(() => props.items.map((item, index) => keyOf(item, index)))

// ── measuring ─────────────────────────────────────────────

const root = ref<HTMLElement | null>(null)
const width = ref(0)
const heights = reactive(new Map<string | number, number>())
const elements = new Map<string | number, HTMLElement>()
const keyByElement = new WeakMap<Element, string | number>()

let observer: ResizeObserver | null = null

function heightOf(entry: ResizeObserverEntry): number {
  const box = entry.borderBoxSize?.[0]
  return box ? box.blockSize : (entry.target as HTMLElement).offsetHeight
}

function setItem(key: string | number, el: unknown) {
  const previous = elements.get(key)
  if (el instanceof HTMLElement) {
    if (previous === el) return
    if (previous) observer?.unobserve(previous)
    elements.set(key, el)
    keyByElement.set(el, key)
    heights.set(key, el.offsetHeight)
    observer?.observe(el)
  } else if (previous && !keys.value.includes(key)) {
    // Gone from the items (its element may still be fading out): stop
    // measuring it. A re-added key gets a fresh element and a fresh entry.
    observer?.unobserve(previous)
    elements.delete(key)
    heights.delete(key)
  }
}

onMounted(() => {
  if (typeof ResizeObserver === "undefined") {
    width.value = root.value?.clientWidth ?? 0
    return
  }
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === root.value) {
        width.value = entry.contentRect.width
        continue
      }
      const key = keyByElement.get(entry.target)
      if (key !== undefined) heights.set(key, heightOf(entry))
    }
  })
  if (root.value) {
    width.value = root.value.clientWidth
    observer.observe(root.value)
  }
  for (const el of elements.values()) observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())

// ── layout ────────────────────────────────────────────────

const count = computed(() =>
  masonryColumnCount(width.value, {
    columns: props.columns,
    minColumnWidth: props.minColumnWidth,
    maxColumns: props.maxColumns,
    gap: props.gap,
  }),
)

const layout = computed(() =>
  placeMasonry(
    keys.value.map((key) => heights.get(key) ?? 0),
    count.value,
    width.value,
    props.gap,
  ),
)

const position = computed(() => {
  const map = new Map<string | number, { x: number; y: number }>()
  keys.value.forEach((key, index) => map.set(key, { x: layout.value.x[index]!, y: layout.value.y[index]! }))
  return map
})

// An item glides only once it has been placed: a new one must appear where it
// belongs, not fly in from the top-left corner where it was first measured.
const placed = reactive(new Set<string | number>())
const ready = computed(() => width.value > 0)

watch(
  [layout, ready],
  () => {
    if (!ready.value) return
    requestAnimationFrame(() => {
      for (const key of keys.value) placed.add(key)
      for (const key of placed) if (!keys.value.includes(key)) placed.delete(key)
    })
  },
  { flush: "post" },
)

function itemStyle(key: string | number) {
  const at = position.value.get(key)
  return {
    width: `${layout.value.columnWidth}px`,
    // `translate`, not `transform`: TransitionGroup runs its own FLIP on any
    // child whose transition names `transform`, and that FLIP clears the inline
    // transform when it finishes — every item landed in the top-left corner.
    translate: at ? `${at.x}px ${at.y}px` : undefined,
  }
}

// ── entrance ──────────────────────────────────────────────

const { el: revealEl, revealed } = useReveal({ immediate: () => !props.entrance, threshold: 0.05 })
watch(root, (node) => (revealEl.value = node))

const hidden = computed(() => !ready.value || !revealed.value)

watch(
  () => ready.value && revealed.value,
  (go) => {
    if (!go || !props.entrance || prefersReducedMotion()) return
    const easing = easingToken("ease-emphasized")
    // Stagger by the order items are placed in, which reads top to bottom.
    keys.value.forEach((key, index) => {
      const el = elements.get(key)
      el?.firstElementChild?.animate?.(
        [
          { opacity: 0, transform: "translate3d(0, 12px, 0)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 460, delay: staggerDelay(index, 0, 40, 12), easing, fill: "backwards" },
      )
    })
  },
  { flush: "post" },
)
</script>

<template>
  <div
    ref="root"
    :class="classes"
    role="list"
    :style="{ height: `${layout.height}px`, opacity: hidden ? 0 : undefined }"
    v-bind="rest"
  >
    <TransitionGroup
      enter-active-class="transition-[opacity,scale] duration-(--duration-slow) ease-(--ease-emphasized)"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition-[opacity,scale] duration-(--duration-medium) ease-(--ease-emphasized)"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="(item, index) in items"
        :key="keys[index]"
        :ref="(el) => setItem(keys[index]!, el)"
        role="listitem"
        class="absolute top-0 left-0"
        :class="placed.has(keys[index]!) && 'transition-[translate] duration-(--duration-slow) ease-(--ease-emphasized)'"
        :style="itemStyle(keys[index]!)"
      >
        <!-- The inner box takes the entrance, so its transform never fights
             the placement transform on the outer one. -->
        <div>
          <slot :item="item" :index="index" />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
