<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Text that may not fit: cut with an ellipsis, and the whole of it in a tip —
 * but only when something was actually cut. A tip that repeats the text you
 * can already read in full is noise, and a list of names where every row
 * pops one up teaches people to ignore them.
 *
 *   <LpTruncate :text="server.name" />
 *   <LpTruncate :text="description" :lines="2" />
 *   <LpTruncate :text="commitHash" middle :tail="6" copyable />
 *
 * Whether it was cut is measured, not guessed: a ResizeObserver re-checks when
 * the box resizes (a sidebar collapsing, a column dragged), so the tip appears
 * and disappears with the layout.
 *
 * `middle` cuts out of the middle instead (`/home/u…/report.pdf`), for ids,
 * paths and hashes, whose two ends are what people compare. The browser has
 * no CSS for that, so the longest fitting cut is found by measuring with the
 * element's own font (see `middleTruncate`). Assistive tech always gets the
 * full text: the cut version is only drawn.
 *
 * A truncated value becomes focusable, so the tip is reachable by keyboard too.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpCopyButton from "./LpCopyButton.vue"
import LpTooltip from "./LpTooltip.vue"
import { middleTruncate } from "./fieldText"

const props = withDefaults(
  defineProps<{
    text: string
    /** Lines before the cut. Ignored with `middle`, which is one line by nature. */
    lines?: number
    /** Cut from the middle, keeping both ends. */
    middle?: boolean
    /** With `middle`: how many characters the end keeps. Unset splits evenly. */
    tail?: number
    /** A copy button after the text, for values people paste elsewhere. */
    copyable?: boolean
    /** Where the tip opens. */
    side?: "top" | "right" | "bottom" | "left"
    /** Never show the tip, even when cut (the full text is shown elsewhere). */
    noTooltip?: boolean
  }>(),
  { lines: 1, side: "top" },
)

const box = ref<HTMLElement | null>(null)
const truncated = ref(false)
const drawn = ref(props.text)

let canvas: CanvasRenderingContext2D | null = null
function measurer(el: HTMLElement): (s: string) => number {
  canvas ??= document.createElement("canvas").getContext("2d")
  const style = getComputedStyle(el)
  // Built from the longhands: Firefox leaves the `font` shorthand empty in
  // computed styles.
  if (canvas) canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const spacing = Number.parseFloat(style.letterSpacing) || 0
  return (s) => (canvas ? canvas.measureText(s).width + spacing * Array.from(s).length : 0)
}

function measure() {
  const el = box.value
  if (!el) return
  if (props.middle) {
    const width = el.clientWidth
    if (!width) return
    const widthOf = measurer(el)
    // Half a pixel of slack: canvas and layout round sub-pixels differently.
    const fit = middleTruncate(props.text, (s) => widthOf(s) <= width - 0.5, { tail: props.tail })
    drawn.value = fit
    truncated.value = fit !== props.text
    return
  }
  truncated.value = props.lines > 1 ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 0.5
}

let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  observer = new ResizeObserver(() => measure())
  if (box.value) observer.observe(box.value)
  // Web fonts land after mount and change every width.
  void document.fonts?.ready.then(() => measure())
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => [props.text, props.lines, props.middle, props.tail],
  async () => {
    drawn.value = props.text
    await nextTick()
    measure()
  },
)

const clampStyle = computed(() =>
  !props.middle && props.lines > 1
    ? { display: "-webkit-box", WebkitBoxOrient: "vertical" as const, WebkitLineClamp: props.lines, overflow: "hidden" }
    : undefined,
)
const boxClass = computed(() =>
  props.middle ? "block overflow-hidden whitespace-pre" : props.lines > 1 ? "break-words" : "block truncate",
)

const { class: rootClass, attrs: rest } = useMergedAttrs(() => "inline-flex min-w-0 max-w-full items-center gap-1 align-bottom")
</script>

<template>
  <span :class="rootClass" v-bind="rest">
    <LpTooltip :content="text" :side="side" :disabled="noTooltip || !truncated">
      <span
        ref="box"
        class="min-w-0 flex-1 rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="boxClass"
        :style="clampStyle"
        :tabindex="truncated && !noTooltip ? 0 : undefined"
      >
        <template v-if="middle">
          <span aria-hidden="true">{{ drawn }}</span>
          <!-- The full text, invisible and flat, gives the box its natural
               width; without it the box would shrink to the cut text and
               never grow back when room opens up. -->
          <span aria-hidden="true" class="invisible block h-0">{{ text }}</span>
          <span class="sr-only">{{ text }}</span>
        </template>
        <template v-else>{{ text }}</template>
      </span>
    </LpTooltip>
    <LpCopyButton v-if="copyable" :value="text" size="xs" class="-my-1 size-6 shrink-0 text-muted" />
  </span>
</template>
