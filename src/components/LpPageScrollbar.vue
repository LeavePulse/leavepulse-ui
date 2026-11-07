<script setup lang="ts">
/*
 * The kit's overlay scrollbar for the document itself, for a page that scrolls
 * the window (LpAppShell's default): the same bar as LpScrollArea's, drawn by
 * the kit over the content instead of the browser's beside it.
 *
 *   <LpPageScrollbar top="4rem" />
 *
 * The browser's own bar is hidden while this is mounted, so the page no longer
 * loses its width to a gutter, nor changes width when it starts to scroll. The
 * scrolling stays the browser's: wheel, keyboard, touch, find-in-page, anchors,
 * scroll restoration, sticky, a full-page screenshot and printing are untouched
 * (the bar is not printed, and at rest it is not drawn). What the kit adds is
 * the drawing, a thumb that drags, and a press beside it that pages.
 *
 * Where the browser's bars already float over the content (phones, macOS set
 * to show them while scrolling) it draws nothing and leaves the browser's.
 *
 * `top` and `bottom` keep the bar clear of what covers the window's edges: a
 * sticky header, a bottom bar. Any CSS length, a variable included, and a
 * change eases.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { mergeClass } from "../composables/useMergedClass"
import { nodeWindow } from "../composables/useView"
import { BAR_FADE, BAR_Y, BAR_Y_SIZE, hideNativeBar, pageToward, SCROLL_HIDE_DELAY_MS, THUMB_Y, THUMB_Y_ROUND } from "./scrollbar"

const props = withDefaults(defineProps<{ top?: string; bottom?: string }>(), { top: "0px", bottom: "0px" })

/* Shorter than this the thumb is hard to catch; reka's bar holds the same floor. */
const MIN_THUMB_PX = 18

const barEl = ref<HTMLElement | null>(null)
const active = ref(false)
const thumb = ref({ top: 0, height: 0 })
const scrollable = ref(false)
const scrolling = ref(false)
const hovered = ref(false)
const dragging = ref(false)
// Unset until the bar first shows: a bar mounting "hidden" would play its fade-out.
const state = computed(() => (scrolling.value || hovered.value || dragging.value ? "visible" : shownOnce.value ? "hidden" : undefined))
const shownOnce = ref(false)

let releaseNative: (() => void) | undefined
let doc: Document | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0
let sizes: ResizeObserver | undefined

function scroller(): HTMLElement | null {
  return (doc?.scrollingElement as HTMLElement | null) ?? null
}

/* The width the browser's bar takes from the layout: 0 where it floats over the content. */
function nativeBarWidth(d: Document): number {
  const probe = d.createElement("div")
  probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll"
  d.body.append(probe)
  const width = probe.offsetWidth - probe.clientWidth
  probe.remove()
  return width
}

function measure() {
  frame = 0
  const view = scroller()
  const bar = barEl.value
  if (!view || !bar) return
  const range = view.scrollHeight - view.clientHeight
  scrollable.value = range > 1
  if (!scrollable.value) return
  const track = bar.clientHeight
  const height = Math.max(MIN_THUMB_PX, Math.round((track * view.clientHeight) / view.scrollHeight))
  thumb.value = { height, top: Math.round(((track - height) * view.scrollTop) / range) }
}
function measureSoon() {
  if (!frame && doc) frame = nodeWindow(doc).requestAnimationFrame(measure)
}

function onScroll() {
  measureSoon()
  scrolling.value = true
  shownOnce.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => (scrolling.value = false), SCROLL_HIDE_DELAY_MS)
}
function onEnter() {
  hovered.value = true
  shownOnce.value = true
}
function onLeave() {
  hideTimer && clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hovered.value = false
    scrolling.value = false
  }, SCROLL_HIDE_DELAY_MS)
}

/* A dialog that locks the page locks the bar with it. */
function locked(): boolean {
  return !!doc && nodeWindow(doc).getComputedStyle(doc.body).overflow === "hidden"
}

function onTrackPointerDown(event: PointerEvent) {
  const view = scroller()
  const thumbEl = barEl.value?.querySelector<HTMLElement>("[data-lp-thumb]")
  if (!view || !thumbEl || event.button !== 0 || thumbEl.contains(event.target as Node) || locked()) return
  event.preventDefault()
  pageToward(view, "y", event.clientY < thumbEl.getBoundingClientRect().top)
}

function onThumbPointerDown(event: PointerEvent) {
  const view = scroller()
  const bar = barEl.value
  if (!view || !bar || event.button !== 0 || locked()) return
  // Not a text selection across the page, and the release is heard wherever it lands.
  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  dragging.value = true
  const startY = event.clientY
  const startTop = view.scrollTop
  const perPixel = (view.scrollHeight - view.clientHeight) / Math.max(1, bar.clientHeight - thumb.value.height)
  const move = (e: PointerEvent) => view.scrollTo({ top: startTop + (e.clientY - startY) * perPixel, behavior: "instant" })
  const stop = () => {
    dragging.value = false
    handle.removeEventListener("pointermove", move)
    handle.removeEventListener("pointerup", stop)
    handle.removeEventListener("pointercancel", stop)
    handle.removeEventListener("lostpointercapture", stop)
  }
  handle.addEventListener("pointermove", move)
  handle.addEventListener("pointerup", stop)
  handle.addEventListener("pointercancel", stop)
  handle.addEventListener("lostpointercapture", stop)
}

onMounted(() => {
  const host = barEl.value ?? undefined
  doc = host?.ownerDocument
  if (!doc || nativeBarWidth(doc) === 0) return
  active.value = true
  releaseNative = hideNativeBar(doc)
  const win = nodeWindow(doc)
  win.addEventListener("scroll", onScroll, { passive: true })
  win.addEventListener("resize", measureSoon)
  sizes = new win.ResizeObserver(measureSoon)
  sizes.observe(doc.body)
  if (host) sizes.observe(host)
  measure()
})

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  sizes?.disconnect()
  if (!doc || !active.value) return
  const win = nodeWindow(doc)
  if (frame) win.cancelAnimationFrame(frame)
  win.removeEventListener("scroll", onScroll)
  win.removeEventListener("resize", measureSoon)
  releaseNative?.()
})

const barClass = computed(() =>
  mergeClass(
    BAR_Y,
    BAR_Y_SIZE.wall,
    BAR_FADE,
    "fixed right-0 z-(--z-sticky) transition-[top,bottom] duration-[var(--duration-medium)] ease-[var(--ease-settle)] print:hidden",
  ),
)
</script>

<template>
  <!-- Always in the DOM, so it can be measured; drawn only where the kit owns the bar. -->
  <div
    ref="barEl"
    aria-hidden="true"
    data-lp-page-scrollbar
    :class="barClass"
    :data-state="active && scrollable ? state : undefined"
    :style="{ top: props.top, bottom: props.bottom, visibility: active && scrollable ? undefined : 'hidden' }"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @pointerdown="onTrackPointerDown"
  >
    <div
      data-lp-thumb
      class="absolute right-px"
      :class="[THUMB_Y, THUMB_Y_ROUND.wall]"
      :style="{ top: `${thumb.top}px`, height: `${thumb.height}px` }"
      @pointerdown.stop="onThumbPointerDown"
    />
  </div>
</template>
