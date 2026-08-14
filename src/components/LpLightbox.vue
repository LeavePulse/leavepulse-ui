<script setup lang="ts">
/*
 * Full-screen image viewer — the Discord-style lightbox: click a thumbnail, the
 * image fills the screen, arrows step through the set, the wheel zooms toward
 * the cursor, dragging pans, and the backdrop or Esc closes it.
 *
 * Built on reka's Dialog so focus trapping, Esc and scroll locking come from the
 * same primitive the rest of the kit's overlays use. The zoom/pan maths lives in
 * useZoomPan — this component is the shell: chrome, keyboard map, filmstrip and
 * the swipe-to-navigate gesture.
 *
 * Controlled via v-model:open and v-model:index, so the caller owns which image
 * is showing and can drive it from a grid, a route or a keyboard shortcut.
 */
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui"
import { computed, nextTick, ref, watch } from "vue"
import { useZoomPan } from "../composables/useZoomPan"
import { fileNameOf, type LightboxItem } from "./lightbox"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    open?: boolean
    /** Images to page through. */
    items: LightboxItem[]
    /** Index of the visible image (v-model:index). */
    index?: number
    /** Thumbnail strip along the bottom. Defaults on when there's more than one. */
    filmstrip?: boolean
    /** Show the rotate control. */
    rotatable?: boolean
    /** Show the download control. */
    downloadable?: boolean
    /** Show "copy image" — needs a same-origin or CORS-readable source. */
    copyable?: boolean
    /** Wrap from the last image back to the first. */
    loop?: boolean
    /** Largest zoom level. */
    maxZoom?: number
  }>(),
  {
    open: false,
    index: 0,
    rotatable: true,
    downloadable: true,
    copyable: false,
    loop: true,
    maxZoom: 8,
  },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "update:index", value: number): void
  /** The visible image changed (after clamping/looping). */
  (e: "change", index: number, item: LightboxItem): void
  (e: "download", item: LightboxItem): void
  /** Copy finished — `false` when the browser refused (tainted/cross-origin). */
  (e: "copy", item: LightboxItem, ok: boolean): void
}>()

defineSlots<{
  /** Replace the caption block under the image. */
  caption(props: { item: LightboxItem; index: number; total: number }): unknown
  /** Extra controls in the toolbar, before the close button. */
  actions(props: { item: LightboxItem; index: number }): unknown
}>()

const zoom = useZoomPan({ max: props.maxZoom })

// `zoom` is a plain object, so its refs don't unwrap in the template — surface
// the two the chrome reads as computeds rather than writing `.value` in markup.
const scale = computed(() => zoom.scale.value)
const isZoomed = computed(() => zoom.zoomed.value)
const isPanning = computed(() => zoom.panning.value)

const current = computed(() => Math.min(Math.max(props.index, 0), Math.max(props.items.length - 1, 0)))
const item = computed<LightboxItem | undefined>(() => props.items[current.value])
const total = computed(() => props.items.length)
const showStrip = computed(() => props.filmstrip ?? total.value > 1)

const rotation = ref(0)
const loading = ref(false)
const failed = ref(false)
const viewport = ref<HTMLElement | null>(null)
const stripEl = ref<HTMLElement | null>(null)

watch(viewport, (el) => zoom.setViewport(el))

// Which way the last navigation went, so the incoming frame slides in from the
// side it travelled from instead of always drifting the same direction.
const direction = ref<1 | -1>(1)

function go(next: number) {
  if (!total.value) return
  const wrapped = props.loop
    ? (next + total.value) % total.value
    : Math.min(Math.max(next, 0), total.value - 1)
  if (wrapped === current.value) return
  // Compare against the raw target, not the wrapped one: stepping past the last
  // image is still "forward" even though the index jumps back to 0.
  direction.value = next > current.value ? 1 : -1
  emit("update:index", wrapped)
  emit("change", wrapped, props.items[wrapped])
}

const canPrev = computed(() => total.value > 1 && (props.loop || current.value > 0))
const canNext = computed(() => total.value > 1 && (props.loop || current.value < total.value - 1))

// Reset the view whenever the image changes — carrying a 4x zoom onto the next
// picture means landing on a random crop of it.
watch(
  () => [current.value, props.open] as const,
  () => {
    zoom.reset()
    rotation.value = 0
    failed.value = false
    loading.value = true
    if (props.open) nextTick(scrollThumbIntoView)
  },
)

function scrollThumbIntoView() {
  const el = stripEl.value?.querySelector<HTMLElement>(`[data-index="${current.value}"]`)
  el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
}

function close() {
  emit("update:open", false)
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "ArrowRight":
      e.preventDefault()
      go(current.value + 1)
      break
    case "ArrowLeft":
      e.preventDefault()
      go(current.value - 1)
      break
    case "Home":
      e.preventDefault()
      go(0)
      break
    case "End":
      e.preventDefault()
      go(total.value - 1)
      break
    case "+":
    case "=":
      e.preventDefault()
      zoom.zoomBy(1.3)
      break
    case "-":
      e.preventDefault()
      zoom.zoomBy(1 / 1.3)
      break
    case "0":
      e.preventDefault()
      zoom.reset()
      break
    case "r":
      if (props.rotatable) {
        e.preventDefault()
        rotate()
      }
      break
  }
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360
  zoom.reset()
}

// Swipe to page through, but only while the image is at fit scale — once zoomed
// a horizontal drag is a pan, and stealing it would make the image unreachable.
let swipeStart: { x: number; y: number } | null = null

function onPointerDown(e: PointerEvent) {
  zoom.onPointerDown(e)
  swipeStart = zoom.zoomed.value ? null : { x: e.clientX, y: e.clientY }
}

function onPointerUp(e: PointerEvent) {
  zoom.onPointerUp(e)
  if (!swipeStart) return
  const dx = e.clientX - swipeStart.x
  const dy = e.clientY - swipeStart.y
  swipeStart = null
  // Mostly-horizontal and past a threshold, so a sloppy tap doesn't page.
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    go(current.value + (dx < 0 ? 1 : -1))
  }
}

function onDoubleClick(e: MouseEvent) {
  zoom.toggleZoom({ x: e.clientX, y: e.clientY })
}

/** Backdrop click closes; a click that ends a pan or lands on the image doesn't. */
function onViewportClick(e: MouseEvent) {
  if (zoom.zoomed.value) return
  if ((e.target as HTMLElement).closest("[data-lightbox-image]")) return
  close()
}

async function download() {
  const target = item.value
  if (!target) return
  emit("download", target)
  const a = document.createElement("a")
  a.href = target.src
  a.download = fileNameOf(target)
  // Cross-origin sources ignore `download` and just navigate, so open those in
  // a new tab instead of replacing the app.
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function copy() {
  const target = item.value
  if (!target) return
  try {
    const response = await fetch(target.src)
    const blob = await response.blob()
    // Clipboard only takes PNG; re-encode anything else through a canvas.
    const png =
      blob.type === "image/png" ? blob : await reencodeToPng(await createImageBitmap(blob))
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })])
    emit("copy", target, true)
  } catch {
    emit("copy", target, false)
  }
}

async function reencodeToPng(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png"),
  )
}

const imageStyle = computed(() => ({
  ...zoom.style.value,
  rotate: `${rotation.value}deg`,
  // Consumed by the lightbox-frame-in keyframe; negative when paging backwards.
  "--frame-from": `${direction.value * 24}px`,
}))

const BTN =
  "flex size-9 items-center justify-center rounded-control text-white/80 outline-none transition-colors duration-[var(--duration-fast)] hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
const ARROW =
  "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-black/45 text-white/90 outline-none backdrop-blur-sm transition-[background-color,scale] duration-[var(--duration-fast)] hover:bg-black/65 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0"
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogPortal>
      <!-- Sits on the lightbox rung, not the shared modal one: opening this
           from inside a dialog must cover that dialog, not tie with it. -->
      <DialogOverlay
        class="lp-scrim fixed inset-0 z-(--z-lightbox-overlay) backdrop-blur-sm data-[state=open]:animate-[fade-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[fade-out_120ms_ease]"
      />
      <DialogContent
        class="fixed inset-0 z-(--z-lightbox) flex flex-col outline-none data-[state=open]:animate-[lightbox-in_var(--duration-medium)_var(--ease-emphasized)] data-[state=closed]:animate-[lightbox-out_140ms_cubic-bezier(0.4,0,1,1)] motion-reduce:animate-none"
        @keydown="onKeydown"
      >
        <!-- reka wants both for a labelled dialog; the caption is the title. -->
        <DialogTitle class="sr-only">{{ item?.title ?? "Image viewer" }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ item?.description ?? `Image ${current + 1} of ${total}` }}
        </DialogDescription>

        <!-- Toolbar. Chrome drifts in from its own edge, slightly behind the
             image, so the picture is what arrives first. -->
        <div
          class="flex shrink-0 items-center gap-1 p-3 text-sm text-white/70 [--chrome-from:-8px] animate-[lightbox-chrome-in_var(--duration-medium)_var(--ease-emphasized)_60ms_both] motion-reduce:animate-none"
        >
          <span v-if="total > 1" class="px-2 tabular-nums">{{ current + 1 }} / {{ total }}</span>
          <span v-if="isZoomed" class="px-2 tabular-nums">
            {{ Math.round(scale * 100) }}%
          </span>

          <div class="ml-auto flex items-center gap-1">
            <slot name="actions" :item="item!" :index="current" />

            <button :class="BTN" type="button" title="Zoom out (−)" @click="zoom.zoomBy(1 / 1.3)">
              <LpIcon name="lucide:zoom-out" :size="18" />
            </button>
            <button :class="BTN" type="button" title="Zoom in (+)" @click="zoom.zoomBy(1.3)">
              <LpIcon name="lucide:zoom-in" :size="18" />
            </button>
            <button
              v-if="rotatable"
              :class="BTN"
              type="button"
              title="Rotate (R)"
              @click="rotate"
            >
              <LpIcon name="lucide:rotate-cw" :size="18" />
            </button>
            <button v-if="copyable" :class="BTN" type="button" title="Copy image" @click="copy">
              <LpIcon name="lucide:copy" :size="18" />
            </button>
            <button
              v-if="downloadable"
              :class="BTN"
              type="button"
              title="Download"
              @click="download"
            >
              <LpIcon name="lucide:download" :size="18" />
            </button>
            <button :class="BTN" type="button" title="Close (Esc)" @click="close">
              <LpIcon name="lucide:x" :size="20" />
            </button>
          </div>
        </div>

        <!-- Stage -->
        <div
          ref="viewport"
          class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
          :class="isPanning ? 'cursor-grabbing' : isZoomed ? 'cursor-grab' : ''"
          @wheel="zoom.onWheel"
          @pointerdown="onPointerDown"
          @pointermove="zoom.onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="zoom.onPointerUp"
          @dblclick="onDoubleClick"
          @click="onViewportClick"
        >
          <button
            :class="[ARROW, 'left-4']"
            type="button"
            :disabled="!canPrev"
            aria-label="Previous image"
            @click.stop="go(current - 1)"
          >
            <LpIcon name="lucide:chevron-left" :size="24" />
          </button>

          <div
            v-if="failed"
            class="flex flex-col items-center gap-3 text-white/60"
          >
            <LpIcon name="lucide:image-off" :size="40" />
            <p class="text-sm">This image couldn't be loaded.</p>
          </div>
          <!-- Keyed on src so paging remounts the img and replays the slide;
               without the key Vue patches it in place and the change is a hard
               cut with no sense of direction. -->
          <img
            v-else-if="item"
            :key="item.src"
            data-lightbox-image
            :src="item.src"
            :alt="item.title ?? ''"
            class="max-h-full max-w-full select-none object-contain transition-transform duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] animate-[lightbox-frame-in_var(--duration-medium)_var(--ease-emphasized)] motion-reduce:animate-none motion-reduce:transition-none"
            :style="imageStyle"
            draggable="false"
            @load="loading = false"
            @error="((failed = true), (loading = false))"
          />

          <LpIcon
            v-if="loading && !failed"
            name="lucide:loader-circle"
            :size="28"
            class="absolute animate-spin text-white/50"
          />

          <button
            :class="[ARROW, 'right-4']"
            type="button"
            :disabled="!canNext"
            aria-label="Next image"
            @click.stop="go(current + 1)"
          >
            <LpIcon name="lucide:chevron-right" :size="24" />
          </button>
        </div>

        <!-- Caption + filmstrip -->
        <div
          class="shrink-0 p-3 pt-2 animate-[lightbox-chrome-in_var(--duration-medium)_var(--ease-emphasized)_60ms_both] motion-reduce:animate-none"
        >
          <slot name="caption" :item="item!" :index="current" :total="total">
            <div v-if="item?.title || item?.description" class="mb-2 text-center">
              <p v-if="item.title" class="truncate text-sm font-medium text-white">
                {{ item.title }}
              </p>
              <p v-if="item.description" class="truncate text-xs text-white/55">
                {{ item.description }}
              </p>
            </div>
          </slot>

          <div
            v-if="showStrip && total > 1"
            ref="stripEl"
            class="lp-scrollbar-none flex justify-start gap-2 overflow-x-auto sm:justify-center"
          >
            <button
              v-for="(entry, i) in items"
              :key="entry.src + i"
              :data-index="i"
              type="button"
              :style="{ '--thumb-delay': `${Math.min(i * 30, 240)}ms` }"
              class="size-14 shrink-0 overflow-hidden rounded-control outline-none ring-2 transition-[opacity,box-shadow,scale] duration-[var(--duration-fast)] hover:scale-105 focus-visible:ring-ring animate-[lightbox-chrome-in_var(--duration-medium)_var(--ease-emphasized)_both] [animation-delay:var(--thumb-delay)] motion-reduce:animate-none"
              :class="i === current ? 'opacity-100 ring-brand' : 'opacity-45 ring-transparent hover:opacity-80'"
              :aria-label="entry.title ?? `Image ${i + 1}`"
              @click="go(i)"
            >
              <img
                :src="entry.thumb ?? entry.src"
                :alt="entry.title ?? ''"
                class="size-full object-cover"
                draggable="false"
              />
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
