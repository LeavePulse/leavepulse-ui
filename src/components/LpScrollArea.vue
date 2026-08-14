<script setup lang="ts">
/*
 * Drawn overlay scrollbar (reka ScrollArea). Floats over content — never
 * reserves layout width, so the viewport doesn't jump. Thin at rest, a touch
 * thicker on hover; fades in/out (reka Presence keeps it mounted through the
 * exit animation). Rounded only on the OUTER edge — the side flush to the wall
 * stays square. Themed via tokens; native scroll/keyboard/touch preserved.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "reka-ui"

// `fade` softens whichever of the top/bottom edges currently has content beyond
// it, so a clipped list reads as continuing rather than as cut off. On by
// default: a hard crop through a row looks like damage wherever it happens, and
// every consumer wanted it. Pass `:fade="false"` where the edge must stay
// crisp — content that has to be read to its last pixel.
// `contentClass` styles the scrollable CONTENT container (the viewport's inner
// wrapper) — put list layout here (display:grid / gap / padding), not on the
// component root, since items live inside reka's viewport.
// `barInsetTop` (any CSS length) pulls the vertical scrollbar down by that much,
// so it doesn't run under a sticky header pinned at the top of the viewport.
// Wheel and keyboard scrolling ease by default. `instant` opts back out, and
// any consumer that DRIVES the scroll itself needs it: CSS scroll-behaviour
// also governs programmatic scrolling, overriding `scrollTo({behavior:"auto"})`
// and animating even a plain `scrollTop = n`. A log tail pinning itself to the
// newest line, or restoring a position after prepending rows, has to land
// instantly — see LpLogViewer.
const props = withDefaults(
  defineProps<{
    fade?: boolean
    instant?: boolean
    contentClass?: string
    barInsetTop?: string
  }>(),
  { fade: true, instant: false },
)

// Re-emit the native scroll event of the underlying viewport so consumers that
// drive scroll-following (e.g. log tails) can track position. The listener is
// bound on ScrollAreaViewport, whose `$attrs` reka forwards onto the scrollable
// element itself.
const emit = defineEmits<{ scroll: [event: Event] }>()

// Expose the scrollable viewport element so callers can read/write scrollTop
// (auto-scroll to bottom, "is at bottom" checks). reka's ScrollAreaViewport
// exposes it as `viewportElement`.
const viewportRef = ref<{ viewportElement?: HTMLElement } | null>(null)
const viewportEl = computed<HTMLElement | null>(
  () => viewportRef.value?.viewportElement ?? null,
)
defineExpose({ viewportEl })

// `opacity-0` + the hidden-state fade is what keeps the bar invisible at rest:
// with force-mount the element stays in the DOM, so a one-shot fade-out alone
// would snap back to visible once the animation finished.
const barFade =
  "opacity-0 data-[state=visible]:animate-[fade-in_180ms_ease] data-[state=visible]:opacity-100 data-[state=hidden]:animate-[fade-out_240ms_ease]"

// Dragging the thumb pulls the pointer off the bar and across the content, and
// the browser reads that as a text selection — the rows highlight blue while
// the user is only trying to scroll. Suppressed for the duration of the drag
// rather than with a blanket `select-none`, which would cost the content its
// selectability for good.
const dragging = ref(false)

/** How far the fade reaches in from an edge that has content beyond it. */
const FADE_PX = 14

const atTop = ref(true)
const atBottom = ref(true)

/// Only the edges that actually hide something are softened. A fixed mask dims
/// the last line of a list that has already been scrolled to the end, which
/// reads as content missing rather than as content continuing.
const fadeMask = computed(() => {
  const top = atTop.value ? "black 0" : `transparent 0, black ${FADE_PX}px`
  const bottom = atBottom.value
    ? "black 100%"
    : `black calc(100% - ${FADE_PX}px), transparent 100%`
  return `linear-gradient(to bottom, ${top}, ${bottom})`
})

function measureEdges(el: HTMLElement) {
  atTop.value = el.scrollTop <= 1
  // A rounded-up scrollHeight can sit a pixel above the sum, so the comparison
  // is given the same slack as the top rather than demanding an exact landing.
  atBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
}

function onViewportScroll(event: Event) {
  if (props.fade) measureEdges(event.target as HTMLElement)
  emit("scroll", event)
}

// Scrolling is not the only thing that changes which edges hide content: a list
// that fills in, a panel that resizes, or content short enough to need no fade
// at all never fire a scroll event. Watched only when `fade` is on, since
// nothing else here depends on the measurements.
let edgeObserver: ResizeObserver | undefined

watch(
  [viewportEl, () => props.fade],
  ([el, enabled]) => {
    edgeObserver?.disconnect()
    edgeObserver = undefined
    if (!el || !enabled || typeof ResizeObserver === "undefined") return
    measureEdges(el)
    edgeObserver = new ResizeObserver(() => measureEdges(el))
    edgeObserver.observe(el)
    // The content box grows independently of the viewport's own size.
    for (const child of Array.from(el.children)) edgeObserver.observe(child)
  },
  { immediate: true, flush: "post" },
)

onBeforeUnmount(() => edgeObserver?.disconnect())

function onThumbPointerDown() {
  dragging.value = true
  const stop = () => {
    dragging.value = false
    window.removeEventListener("pointerup", stop)
    window.removeEventListener("pointercancel", stop)
  }
  // Bound on the window: the pointer is captured by the thumb, and the release
  // routinely happens far outside the scroll area.
  window.addEventListener("pointerup", stop)
  window.addEventListener("pointercancel", stop)
}
</script>

<template>
  <!-- A flex column, not a plain block: the viewport below sizes itself with
       `flex-1 min-h-0` rather than `height:100%`. A percentage height resolves
       against the root's own height, which in the common case — a root stretched
       by `flex-1` inside a capped panel — is itself content-derived, so the
       viewport grew to the full content height and scrolled nothing while the
       root clipped the overflow. -->
  <ScrollAreaRoot
    class="relative flex flex-col overflow-hidden"
    :class="dragging ? 'select-none' : undefined"
    type="hover"
    :scroll-hide-delay="500"
  >
    <!-- The bar itself is a pointer target far wider than it looks: the visible
         rail is the thumb, sized below, while the track pads it out to a
         grabbable strip. A 4px-wide hit area is near-impossible to catch with a
         mouse. Padding (not width) carries the extra room so the thumb stays
         flush against the wall. -->
    <!-- force-mount: reka only sets the viewport's `overflow-y: scroll` while a
         vertical scrollbar is MOUNTED, and with type="hover" that happens on
         first hover — so before the pointer ever entered, the region silently
         refused to scroll (wheel included). Mounting it up front fixes that;
         the bar still only becomes visible on hover, via `barFade` below. -->
    <ScrollAreaScrollbar
      orientation="vertical"
      force-mount
      class="group flex w-3.5 touch-none select-none justify-end py-px pl-2.5 pr-px"
      :class="barFade"
      :style="barInsetTop ? { marginTop: barInsetTop } : undefined"
    >
      <!-- Sized with min-width, not width: reka sets an inline
           `width: var(--reka-scroll-area-thumb-width)` on the thumb, and for a
           VERTICAL bar it only ever defines the height variable — the width one
           stays empty, so the inline rule resolves to 0 and beat a plain `w-1`,
           leaving an invisible thumb. A minimum wins over that without fighting
           the positioning reka owns. -->
      <ScrollAreaThumb
        class="min-w-1 rounded-l-pill bg-brand/40 transition-[min-width,background-color] duration-[var(--duration-fast)] group-hover:min-w-1.5 group-hover:bg-brand"
        @pointerdown="onThumbPointerDown"
      />
    </ScrollAreaScrollbar>

    <ScrollAreaScrollbar
      orientation="horizontal"
      class="group flex h-3.5 flex-col touch-none select-none justify-end px-px pb-px pt-2.5"
      :class="barFade"
    >
      <ScrollAreaThumb
        class="min-h-1 rounded-t-pill bg-brand/40 transition-[min-height,background-color] duration-[var(--duration-fast)] group-hover:min-h-1.5 group-hover:bg-brand"
        @pointerdown="onThumbPointerDown"
      />
    </ScrollAreaScrollbar>

    <ScrollAreaViewport
      ref="viewportRef"
      class="w-full min-h-0 min-w-0 flex-1 [&>div]:!block [&>div]:!min-w-0"
      :class="instant ? '' : 'scroll-smooth motion-reduce:scroll-auto'"
      :style="fade ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined"
      @scroll.passive="onViewportScroll"
    >
      <div :class="contentClass">
        <slot />
      </div>
    </ScrollAreaViewport>
  </ScrollAreaRoot>
</template>
