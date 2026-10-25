<script lang="ts">
export interface TourContext {
  /** Undo something when this step is left, in either direction (close the menu it opened). */
  onLeave(cleanup: () => void): void
  /** Undo something when the tour ends, for what several steps share (a dialog they all live in). */
  onEnd(cleanup: () => void): void
}

export interface TourStep {
  /**
   * What to point at: a `v-hint` id, a CSS selector, an element or a getter.
   * Left out, the step is a centred card with nothing highlighted (an intro).
   * A target that never appears is skipped, so a step for a control the user
   * cannot see costs nothing.
   */
  target?: string | Element | (() => Element | null)
  title: string
  text?: string
  /** A shortcut for the same action, shown as keycaps ("Ctrl+K"). */
  keys?: string
  side?: "top" | "right" | "bottom" | "left"
  /**
   * Ask the user to press the highlighted control themselves; the tour moves
   * on when they do. Doing it beats reading about it.
   */
  try?: boolean
  /** With `try`, a "do it for me" button runs this instead. */
  perform?: () => void | Promise<void>
  /** The target is a sample (LpHintExample), not the real thing: the card says so. */
  example?: boolean
  /** Runs before the step shows: open the dialog or tab its target lives in. */
  enter?: (context: TourContext) => void | Promise<void>
}
</script>

<script setup lang="ts">
/*
 * A guided walk over the real interface: the target is lit through a dim
 * scrim, a card beside it says what it is, and the user steps through with the
 * buttons or the arrow keys.
 *
 * The dim is one blurred layer clipped around the hole (`holeClip`), so the
 * blur has no seams; four transparent panels around the hole take the clicks,
 * so the target stays clickable (a `try` step waits for exactly that click).
 * Both glide between targets on any engine, WebKitGTK included. Closing fades
 * the whole layer out instead of dropping it. The card is a reka
 * popover anchored to the hole, so flipping and sliding to stay on screen is
 * floating-ui's job; on a phone it becomes a sheet at the bottom instead.
 *
 * Whatever a step opens through `enter` it undoes through `onLeave` (gone when
 * the step is) or `onEnd` (shared by the steps after it), and the tour runs
 * those however it ends: finished, closed, Escape, or unmounted by a route
 * change. A tour must leave the page as it found it.
 */
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from "reka-ui"
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { hints } from "../composables/useHints"
import { useHotkeys } from "../composables/useHotkeys"
import { useLabels } from "../composables/useLpConfig"
import { useMediaQuery } from "../composables/useMediaQuery"
import { scrollToElement } from "../composables/scroll"
import { PANEL_SURFACE } from "./dropdown"
import TourCard from "./TourCard.vue"
import type { Box } from "../composables/spatialNav"
import { holeClip, holeOf, panelsAround } from "./tour"

const props = withDefaults(
  defineProps<{
    steps: TourStep[]
    /** Room around the target inside the lit hole, px. */
    padding?: number
    labels?: Partial<typeof DEFAULT_LABELS>
  }>(),
  { padding: 6 },
)

const emit = defineEmits<{
  /** The last step was passed. */
  (e: "finish"): void
  /** Closed early, on this step index. */
  (e: "dismiss", index: number): void
}>()

const open = defineModel<boolean>("open", { default: false })
const index = defineModel<number>("step", { default: 0 })

const DEFAULT_LABELS = {
  next: "Next",
  back: "Back",
  done: "Done",
  close: "Close tour",
  progress: "{n} of {total}",
  perform: "Do it for me",
  tryIt: "Try it: press the highlighted control.",
  example: "This is an example: there are none right now.",
}
const labels = useLabels("tour", DEFAULT_LABELS, () => props.labels)

const WAIT_MS = 800
const TRY_SETTLE_MS = 120

const wide = useMediaQuery("(min-width: 640px)")
const step = computed<TourStep | undefined>(() => props.steps[index.value])
const target = shallowRef<Element | null>(null)
const box = ref<Box | null>(null)
const viewport = ref({ width: 0, height: 0 })
const ready = ref(false)
const cleanups: (() => void)[] = []
const leaving: (() => void)[] = []
let frame = 0
let token = 0
let direction = 1

const hole = computed(() => (box.value ? holeOf(box.value, props.padding, viewport.value) : null))
const panels = computed(() =>
  hole.value
    ? panelsAround(hole.value, viewport.value)
    : [{ x: 0, y: 0, width: viewport.value.width, height: viewport.value.height }],
)
const radius = ref(8)
const clip = computed(() => holeClip(hole.value, viewport.value, radius.value))
const reference = {
  getBoundingClientRect: () => {
    const h = hole.value
    return h ? new DOMRect(h.x, h.y, h.width, h.height) : new DOMRect(viewport.value.width / 2, viewport.value.height / 2, 0, 0)
  },
}
const last = computed(() => index.value >= props.steps.length - 1)
const progress = computed(() => labels.value.progress.replace("{n}", String(index.value + 1)).replace("{total}", String(props.steps.length)))
const smooth = () => !prefersReducedMotion()

function resolve(raw: TourStep["target"]): Element | null {
  if (!raw) return null
  try {
    if (typeof raw === "function") return raw()
    if (typeof raw !== "string") return raw.isConnected ? raw : null
    return hints.element(raw) ?? document.querySelector(raw)
  } catch {
    return null
  }
}

function waitFor(raw: TourStep["target"], mine: number): Promise<Element | null> {
  const started = performance.now()
  return new Promise((done) => {
    const tick = () => {
      if (mine !== token) return done(null)
      const el = resolve(raw)
      if (el && el.getClientRects().length) return done(el)
      if (performance.now() - started > WAIT_MS) return done(null)
      requestAnimationFrame(tick)
    }
    tick()
  })
}

function measure() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  const el = target.value
  if (!el || !el.isConnected) {
    box.value = null
    return
  }
  const r = el.getBoundingClientRect()
  const prev = box.value
  if (!prev || prev.x !== r.x || prev.y !== r.y || prev.width !== r.width || prev.height !== r.height) {
    box.value = { x: r.x, y: r.y, width: r.width, height: r.height }
  }
}

function track() {
  measure()
  frame = requestAnimationFrame(track)
}

async function show(): Promise<void> {
  const mine = ++token
  ready.value = false
  leave()
  const current = step.value
  if (!current) return
  try {
    await current.enter?.({ onLeave: (fn) => leaving.push(fn), onEnd: (fn) => cleanups.push(fn) })
  } catch (error) {
    console.warn("[LpTour] step skipped, its enter() failed:", error)
    if (mine === token) skip()
    return
  }
  if (mine !== token) return
  if (!current.target) {
    target.value = null
    measure()
    ready.value = true
    return
  }
  const el = current.enter ? await waitFor(current.target, mine) : resolve(current.target)
  if (mine !== token) return
  if (!el || !el.getClientRects().length) return skip()
  target.value = el
  scrollToElement(el, { block: wide.value ? "nearest" : "center", behavior: smooth() ? "smooth" : "auto", margin: 48 })
  await nextTick()
  measure()
  ready.value = true
}

function skip(): Promise<void> | void {
  const nextIndex = index.value + direction
  if (nextIndex < 0 || nextIndex >= props.steps.length) return direction > 0 ? finish() : show()
  index.value = nextIndex
}

function next(): void {
  direction = 1
  if (last.value) return finish()
  index.value += 1
}

function back() {
  if (index.value === 0) return
  direction = -1
  index.value -= 1
}

function forward() {
  if (!step.value?.try) next()
}

async function perform() {
  await step.value?.perform?.()
  setTimeout(next, TRY_SETTLE_MS)
}

function runAll(list: (() => void)[]) {
  for (const cleanup of list.splice(0).reverse()) {
    try {
      cleanup()
    } catch (error) {
      console.warn("[LpTour] cleanup failed:", error)
    }
  }
}

function leave() {
  runAll(leaving)
}

function end() {
  token++
  leave()
  cancelAnimationFrame(frame)
  frame = 0
  target.value = null
  runAll(cleanups)
}

function finish(): void {
  open.value = false
  emit("finish")
}

function dismiss() {
  const at = index.value
  open.value = false
  emit("dismiss", at)
}

function onTargetClick(event: Event) {
  if (!step.value?.try || !target.value) return
  if (event.target instanceof Node && target.value.contains(event.target)) setTimeout(next, TRY_SETTLE_MS)
}

watch(
  open,
  (value) => {
    if (value) {
      direction = 1
      box.value = null
      radius.value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--radius-control")) || 8
      document.addEventListener("click", onTargetClick, true)
      document.addEventListener("contextmenu", onTargetClick, true)
      frame ||= requestAnimationFrame(track)
      void show()
    } else {
      document.removeEventListener("click", onTargetClick, true)
      document.removeEventListener("contextmenu", onTargetClick, true)
      end()
    }
  },
  { immediate: true },
)

watch(index, () => {
  if (open.value) void show()
})

onBeforeUnmount(() => {
  document.removeEventListener("click", onTargetClick, true)
  document.removeEventListener("contextmenu", onTargetClick, true)
  if (open.value) end()
})

useHotkeys(
  () => [
    { key: "Escape", handler: dismiss, overLayers: true, allowInInput: true },
    { key: "ArrowRight", handler: forward, overLayers: true },
    { key: "Enter", handler: forward, overLayers: true },
    { key: "ArrowLeft", handler: back, overLayers: true },
  ],
  { enabled: open, priority: 100 },
)

const CARD = `${PANEL_SURFACE} rounded-card w-80 max-w-[calc(100vw-24px)] p-4 text-sm text-ink outline-none`
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-[var(--duration-medium)] ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
    <div v-if="open" class="lp-tour pointer-events-none fixed inset-0 z-(--z-tour)" @pointerdown.stop>
      <div
        class="lp-scrim absolute inset-0 transition-[clip-path] duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
        :style="{ clipPath: clip }"
      />
      <div
        v-for="(panel, i) in panels"
        :key="i"
        class="pointer-events-auto absolute left-0 top-0"
        :style="{ transform: `translate(${panel.x}px, ${panel.y}px)`, width: `${panel.width}px`, height: `${panel.height}px` }"
      />
      <div
        v-if="hole"
        class="absolute left-0 top-0 rounded-control ring-2 ring-brand transition-[transform,width,height] duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
        :class="step?.try ? 'pointer-events-none animate-pulse' : 'pointer-events-auto'"
        :style="{ transform: `translate(${hole.x}px, ${hole.y}px)`, width: `${hole.width}px`, height: `${hole.height}px` }"
      />
    </div>
    </Transition>

    <PopoverRoot v-if="wide" :open="open && ready">
      <PopoverAnchor :reference="reference" />
      <PopoverPortal>
        <PopoverContent
          :side="step?.side ?? 'bottom'"
          :side-offset="12"
          :collision-padding="12"
          update-position-strategy="always"
          :trap-focus="false"
          :class="[CARD, 'z-[calc(var(--z-tour)+1)] data-[state=open]:animate-[popover-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[popover-out_var(--duration-fast)_ease-out] motion-reduce:animate-none']"
          role="dialog"
          :aria-label="step?.title"
          @pointerdown.stop
          @interact-outside.prevent
          @escape-key-down.prevent
          @focus-outside.prevent
        >
          <slot name="card" :step="step" :index="index" :next="next" :back="back" :dismiss="dismiss">
            <TourCard :step="step" :index="index" :last="last" :progress="progress" :labels="labels" @next="next" @back="back" @perform="perform" @dismiss="dismiss" />
          </slot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>

    <Transition leave-active-class="animate-[rise-out_var(--duration-fast)_ease-out] motion-reduce:animate-none">
    <div
      v-if="open && !wide && ready"
      :class="[CARD, 'pointer-events-auto fixed inset-x-3 bottom-3 z-[calc(var(--z-tour)+1)] w-auto animate-[rise-in_var(--duration-medium)_var(--ease-emphasized)] motion-reduce:animate-none']"
      role="dialog"
      :aria-label="step?.title"
      @pointerdown.stop
    >
      <slot name="card" :step="step" :index="index" :next="next" :back="back" :dismiss="dismiss">
            <TourCard :step="step" :index="index" :last="last" :progress="progress" :labels="labels" @next="next" @back="back" @perform="perform" @dismiss="dismiss" />
          </slot>
    </div>
    </Transition>
  </Teleport>
</template>
