<script setup lang="ts">
/*
 * Page navigator. Pairs with LpTable but stands alone.
 *
 * Fixed-width window: we always render the SAME number of slots in the SAME
 * positions — first, an inner run of (2*siblings+1) pages, last, and the two
 * ellipsis spots. As the page changes only the *labels* in those slots change;
 * no slot is added or removed, so the row never reflows and nothing jumps.
 * Because slots are keyed by position (not page number), Vue reuses each node
 * and just swaps its number — which lets the brand pill glide between slots via
 * motion-v's shared layoutId with zero list-animation conflicts.
 */
import { Motion } from "motion-v"
import { computed, useId } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Current page, 1-based (v-model:page). */
    page?: number
    /** Total item count — used with pageSize to derive the page count. */
    total?: number
    pageSize?: number
    /** Direct page count; wins over total/pageSize when given. */
    pageCount?: number
    /** Pages shown on each side of the current one in the inner run. */
    siblings?: number
    disabled?: boolean
  }>(),
  { page: 1, pageSize: 10, siblings: 1 },
)

const emit = defineEmits<{
  (e: "update:page", value: number): void
  (e: "change", value: number): void
}>()

const count = computed(() => {
  if (props.pageCount != null) return Math.max(1, props.pageCount)
  if (props.total != null) return Math.max(1, Math.ceil(props.total / props.pageSize))
  return 1
})

const current = computed(() => Math.min(Math.max(1, props.page), count.value))

// A fixed run of page slots. Each slot is either a real page or a gap ("…").
// The number of slots is constant for a given `count`, so the row width is
// stable as the user pages through.
type Slot = { kind: "page"; page: number } | { kind: "gap" }

const slots = computed<Slot[]>(() => {
  const c = count.value
  const cur = current.value
  const inner = props.siblings * 2 + 1 // pages shown around (and including) current
  // Total = first + leftGap + inner + rightGap + last. Constant for a given
  // count, so the row width never changes as you page through.
  const total = inner + 4

  // Few enough pages to list them all (still a fixed run = count).
  if (c <= total) {
    return Array.from({ length: c }, (_, i) => ({ kind: "page", page: i + 1 }))
  }

  // Inner window [lo..hi] of length `inner`, clamped into [3 .. c-2] so there's
  // always a slot for first(1)+page 2 on the left and page c-1+last(c) on right.
  let lo = cur - props.siblings
  let hi = cur + props.siblings
  if (lo < 3) {
    hi += 3 - lo
    lo = 3
  }
  if (hi > c - 2) {
    lo -= hi - (c - 2)
    hi = c - 2
  }

  const out: Slot[] = [{ kind: "page", page: 1 }]
  // Dedicated gap slots: a gap when the window doesn't already touch the edge,
  // otherwise the adjacent real page — so the slot COUNT stays fixed either way.
  out.push(lo > 3 ? { kind: "gap" } : { kind: "page", page: 2 })
  for (let p = lo; p <= hi; p++) out.push({ kind: "page", page: p })
  out.push(hi < c - 2 ? { kind: "gap" } : { kind: "page", page: c - 1 })
  out.push({ kind: "page", page: c })
  return out
})

function go(p: number) {
  if (props.disabled) return
  const next = Math.min(Math.max(1, p), count.value)
  if (next === current.value) return
  emit("update:page", next)
  emit("change", next)
}

// Geometry + interaction. No text/bg colour here — the pill paints the active
// fill, the per-state text colour below sits on top.
const navBase =
  "relative flex size-(--size-control-sm) items-center justify-center rounded-control text-sm outline-none transition-[color,border-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] active:scale-95 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100"

const navArrow =
  "border border-line text-muted hover:border-line-strong hover:text-ink disabled:hover:border-line disabled:hover:text-muted"

// The sliding brand pill (shared layoutId) glides under the current page.
const pillId = `lp-page-indicator-${useId()}`
const pillTransition = usePillTransition()
</script>

<template>
  <nav class="flex items-center gap-1.5" aria-label="Pagination">
    <button
      type="button"
      :class="[navBase, navArrow]"
      :disabled="disabled || current === 1"
      aria-label="Previous page"
      @click="go(current - 1)"
    >
      <LpIcon name="lucide:chevron-left" :size="16" />
    </button>

    <!-- Keyed by POSITION (slot-i), not page number, so Vue reuses each node and
         only swaps the label — the row never re-creates buttons, so nothing
         flickers and the pill can travel smoothly between slots. -->
    <template v-for="(slot, i) in slots" :key="`slot-${i}`">
      <span
        v-if="slot.kind === 'gap'"
        class="flex size-(--size-control-sm) items-center justify-center text-sm text-muted select-none"
        aria-hidden="true"
        >…</span
      >
      <button
        v-else
        type="button"
        :class="[
          navBase,
          'min-w-(--size-control-sm) px-2',
          slot.page === current
            ? 'text-ink-inverse'
            : 'border border-line text-muted hover:border-line-strong hover:text-ink',
        ]"
        :disabled="disabled"
        :aria-current="slot.page === current ? 'page' : undefined"
        @click="go(slot.page)"
      >
        <Motion
          v-if="slot.page === current"
          :layout-id="pillId"
          :transition="pillTransition"
          class="absolute inset-0 z-0 rounded-control bg-brand"
        />
        <span class="relative z-10">{{ slot.page }}</span>
      </button>
    </template>

    <button
      type="button"
      :class="[navBase, navArrow]"
      :disabled="disabled || current === count"
      aria-label="Next page"
      @click="go(current + 1)"
    >
      <LpIcon name="lucide:chevron-right" :size="16" />
    </button>
  </nav>
</template>
