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
  /**
   * The `v-hint` id this step is about, when `target` is not that id (a menu
   * the step opens). A step on a hint id gets its sample on its own: an
   * LpHintExample standing in for the absent element, or an empty chart inside
   * it drawing made-up data. The sample shows while the step does, the card
   * says it is an example, and a `try` step stops asking for a press.
   */
  hint?: string
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
import { durationToken, prefersReducedMotion } from "../composables/easing"
import { hints } from "../composables/useHints"
import { useHotkeys } from "../composables/useHotkeys"
import { useLabels } from "../composables/useLpConfig"
import { useMediaQuery } from "../composables/useMediaQuery"
import { useView, viewDocument, viewWindow } from "../composables/useView"
import { scrollToElement } from "../composables/scroll"
import { PANEL_SURFACE } from "./dropdown"
import TourCard from "./TourCard.vue"
import type { Box } from "../composables/spatialNav"
import { holeClip, holeOf, panelsAround } from "./tour"
import { usePortalTarget } from "../composables/useView"

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
const SETTLE_MS = 1000
const CARD_ROOM = 200

const wide = useMediaQuery("(min-width: 640px)")
// The window the tour walks: the page's, or an LpFrame's when it runs in one.
const view = useView()
const win = () => viewWindow(view.value)
const doc = () => viewDocument(view.value)
const sampled = ref(false)
const step = computed<TourStep | undefined>(() => {
  const raw = props.steps[index.value]
  return raw && sampled.value ? { ...raw, try: false, example: true } : raw
})
const target = shallowRef<Element | null>(null)
const box = ref<Box | null>(null)
const viewport = ref({ width: 0, height: 0 })
const ready = ref(false)
const gliding = ref(false)
const cleanups: (() => void)[] = []
const leaving: (() => void)[] = []
let frame = 0
let token = 0
let glide = 0
let direction = 1

const hole = computed(() => (box.value ? holeOf(box.value, props.padding, viewport.value) : null))
const panels = computed(() =>
  hole.value
    ? panelsAround(hole.value, viewport.value)
    : [{ x: 0, y: 0, width: viewport.value.width, height: viewport.value.height }],
)
const radius = ref(8)
const clip = computed(() => holeClip(hole.value, viewport.value, radius.value))
// A target taller than the screen leaves no room for the card above or below
// it, and floating-ui only slides the card along the edge, never back onto the
// screen: it would sit off-screen with its buttons. Such a card rests on the
// target's visible bottom edge instead.
const tall = computed(() => {
  const h = hole.value
  return !!h && h.y < CARD_ROOM && viewport.value.height - (h.y + h.height) < CARD_ROOM
})
const side = computed(() => (tall.value ? "top" : step.value?.side ?? "bottom"))
const reference = {
  getBoundingClientRect: () => {
    const h = hole.value
    if (!h) return new DOMRect(viewport.value.width / 2, viewport.value.height / 2, 0, 0)
    return tall.value ? new DOMRect(h.x, h.y + h.height - 12, h.width, 0) : new DOMRect(h.x, h.y, h.width, h.height)
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
    return hints.element(raw) ?? doc().querySelector(raw)
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

// The hole's corners match the kit's controls. The token may be written in rem
// or calc(), which parseFloat would misread (0.5rem → 0.5px), so the browser
// resolves it on a throwaway element.
function controlRadius(): number {
  const probe = doc().createElement("div")
  probe.style.cssText = "position:absolute;visibility:hidden;border-top-left-radius:var(--radius-control)"
  doc().body.append(probe)
  const px = parseFloat(getComputedStyle(probe).borderTopLeftRadius)
  probe.remove()
  return Number.isFinite(px) ? px : 8
}

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

// A target that is still easing in (an LpHintExample growing from nothing, the
// dialog or menu a step just opened) would be measured and scrolled to at its
// first-frame size; the walk waits for it, and for whatever around it moves,
// to land. Endless animations (a pulse, a spinner) never land and are left out.
async function settled(el: Element): Promise<void> {
  await new Promise(requestAnimationFrame)
  const moving = doc().getAnimations().filter((animation) => {
    const node = animation.effect instanceof KeyframeEffect ? animation.effect.target : null
    const end = Number(animation.effect?.getComputedTiming().endTime)
    return !!node && (node.contains(el) || el.contains(node)) && Number.isFinite(end)
  })
  await Promise.race([Promise.allSettled(moving.map((animation) => animation.finished)), pause(SETTLE_MS)])
}

// A smooth scroll has no reliable end event (WebKitGTK lacks scrollend), so the
// walk waits until the target stops moving for a few frames.
function still(el: Element, mine: number): Promise<void> {
  const started = performance.now()
  let last = ""
  let same = 0
  return new Promise((done) => {
    const tick = () => {
      const r = el.getBoundingClientRect()
      const key = `${r.x} ${r.y} ${r.width} ${r.height}`
      same = key === last ? same + 1 : 0
      last = key
      if (mine !== token || same >= 3 || performance.now() - started > SETTLE_MS) return done()
      requestAnimationFrame(tick)
    }
    tick()
  })
}

// The hole eases only when it moves to another target. Following a scroll it
// sticks to the target frame by frame: easing every frame's move made it trail
// behind and shiver.
function glideTo(el: Element | null) {
  target.value = el
  gliding.value = true
  clearTimeout(glide)
  glide = window.setTimeout(() => (gliding.value = false), durationToken("duration-medium") + 40)
}

function measure() {
  viewport.value = { width: win().innerWidth, height: win().innerHeight }
  const el = target.value
  if (!el) {
    box.value = null
    return
  }
  if (!el.isConnected) return
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
  const current = props.steps[index.value]
  if (!current) return
  const id = current.hint ?? (typeof current.target === "string" ? current.target : undefined)
  sampled.value = !!id && hints.hasExample(id)
  if (sampled.value) leaving.push(hints.showExample(id!))
  const raw = sampled.value && !hints.present(id!) ? () => hints.exampleElement(id!) : current.target
  try {
    await current.enter?.({ onLeave: (fn) => leaving.push(fn), onEnd: (fn) => cleanups.push(fn) })
  } catch (error) {
    console.warn("[LpTour] step skipped, its enter() failed:", error)
    if (mine === token) skip()
    return
  }
  if (mine !== token) return
  if (!raw) {
    glideTo(null)
    measure()
    ready.value = true
    return
  }
  const el = current.enter || sampled.value ? await waitFor(raw, mine) : resolve(raw)
  if (mine !== token) return
  if (!el || !el.getClientRects().length) return skip()
  await settled(el)
  if (mine !== token) return
  scrollToElement(el, { block: wide.value ? "nearest" : "center", behavior: smooth() ? "smooth" : "auto", margin: 48 })
  await still(el, mine)
  if (mine !== token) return
  glideTo(el)
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
  clearTimeout(glide)
  sampled.value = false
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
      radius.value = controlRadius()
      doc().addEventListener("click", onTargetClick, true)
      doc().addEventListener("contextmenu", onTargetClick, true)
      frame ||= requestAnimationFrame(track)
      void show()
    } else {
      doc().removeEventListener("click", onTargetClick, true)
      doc().removeEventListener("contextmenu", onTargetClick, true)
      end()
    }
  },
  { immediate: true },
)

watch(index, () => {
  if (open.value) void show()
})

onBeforeUnmount(() => {
  doc().removeEventListener("click", onTargetClick, true)
  doc().removeEventListener("contextmenu", onTargetClick, true)
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

// pointer-events-auto! beats reka: a menu a step opens is a newer modal layer,
// and reka switches off pointer events on every older one, the card included
// when it carries over from the step before. The tour sits above all of them.
const CARD = `${PANEL_SURFACE} pointer-events-auto! rounded-card w-80 max-w-[calc(100vw-24px)] p-4 text-sm text-ink outline-none`

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
</script>

<template>
  <Teleport :to="portalTo">
    <Transition
      enter-active-class="transition-opacity duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      leave-active-class="lp-tour-gone transition-opacity duration-[var(--duration-medium)] ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
    <div v-if="open" class="lp-tour pointer-events-none fixed inset-0 z-(--z-tour)" @pointerdown.stop>
      <div
        class="lp-scrim absolute inset-0"
        :class="gliding && 'transition-[clip-path] duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none'"
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
        class="absolute left-0 top-0 rounded-control ring-2 ring-brand"
        :class="[
          gliding && 'transition-[transform,width,height] duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none',
          step?.try ? 'pointer-events-none animate-pulse' : 'pointer-events-auto',
        ]"
        :style="{ transform: `translate(${hole.x}px, ${hole.y}px)`, width: `${hole.width}px`, height: `${hole.height}px` }"
      />
    </div>
    </Transition>

    <PopoverRoot v-if="wide" :open="open && ready">
      <PopoverAnchor :reference="reference" />
      <PopoverPortal :to="portalTo">
        <PopoverContent
          :side="side"
          :side-offset="12"
          :collision-padding="12"
          update-position-strategy="always"
          :trap-focus="false"
          :class="[CARD, 'z-[calc(var(--z-tour)+1)] data-[state=open]:animate-[popover-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[popover-out_var(--duration-fast)_ease-out] motion-reduce:animate-none']"
          :data-lp-glide-position="gliding || undefined"
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

    <Transition leave-active-class="lp-tour-gone animate-[rise-out_var(--duration-fast)_ease-out] motion-reduce:animate-none">
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

