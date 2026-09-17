<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Straighten-and-crop for a picture on its way to being uploaded.
 *
 * Not a photo editor. The three things a camera gets wrong on the way into a
 * record are the only things here: the phone was held sideways, the label is
 * a third of the frame, and the shot is off by a couple of degrees. Anything
 * beyond that belongs in a program made for it.
 *
 * The result comes back as a Blob, so the caller uploads what is on screen
 * rather than the original plus a list of edits nothing downstream can apply.
 * `null` from `export()` means "unchanged" — an untouched picture is passed
 * through byte-for-byte instead of being re-encoded a generation worse.
 *
 * Zoom and pan are useZoomPan, the same maths the lightbox uses: the crop box
 * is fixed and the picture moves under it, which is the interaction people
 * already know from every avatar cropper.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { useHotkeys } from "../composables/useHotkeys"
import { useReveal } from "../composables/useReveal"
import { useZoomPan } from "../composables/useZoomPan"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    /** The picture to work on. */
    file: File | Blob
    /**
     * Shape of the crop box.
     *
     * The named ones are shorthand for the common cases; a NUMBER is the real
     * interface — `:aspect="2.35"` for anamorphic, `:aspect="0.8"` for a
     * shelf label — so a consumer whose shape is not on the list is not stuck
     * choosing the nearest wrong one. "free" keeps the source's own
     * proportions and crops only what panning and zoom leave outside.
     */
    aspect?: "free" | "square" | "4:3" | "3:4" | "16:9" | number
    /** Longest edge of the exported image. Larger sources are scaled down. */
    maxEdge?: number
    /** JPEG quality of the export. */
    quality?: number
    /**
     * Labels for the toolbar. Defaulted in English rather than left blank: an
     * icon button with no accessible name is announced as "button", and the
     * kit cannot reach the consumer's translations. Apps with i18n pass their
     * own strings.
     */
    labels?: Partial<
      Record<"rotateLeft" | "rotateRight" | "zoomIn" | "zoomOut" | "reset" | "canvas", string>
    >
    /** Fade the picture in when the editor first comes into view. */
    animate?: boolean
  }>(),
  { aspect: "free", maxEdge: 2400, quality: 0.9, labels: () => ({}), animate: true },
)

// Same rule as the rest of the kit: the entrance belongs to arrival, not to
// mount. An editor inside a dialog that opens a minute later still draws.
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animate })

const text = computed(() => ({
  rotateLeft: "Rotate left",
  rotateRight: "Rotate right",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Reset",
  canvas: "Crop area — arrows pan, +/− zoom, R rotates, Alt+wheel turns freely",
  ...props.labels,
}))

const ASPECTS: Record<string, number | null> = {
  free: null,
  square: 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
}

const source = shallowRef<ImageBitmap | HTMLImageElement | null>(null)
const objectUrl = ref("")
const rotation = ref(0)
const viewport = ref<HTMLElement | null>(null)
const zoom = useZoomPan({ min: 1, max: 6 })

watch(viewport, (el) => zoom.setViewport(el))

/** Which way up it ends, 0-270, whatever the accumulated angle. */
const upright = computed(() => ((rotation.value % 360) + 360) % 360)

/** Touched at all? An untouched picture is uploaded as it arrived — four turns
 *  back to where it started is not an edit, however far the dial travelled. */
const edited = computed(() => upright.value !== 0 || zoom.scale.value !== 1)

watch(
  () => props.file,
  async (file) => {
    revoke()
    rotation.value = 0
    zoom.reset()
    objectUrl.value = URL.createObjectURL(file)
    source.value = await decode(file, objectUrl.value)
  },
  { immediate: true },
)

/**
 * The picture, as something canvas can draw and measure.
 *
 * `createImageBitmap` first: it decodes off the main thread and hands back
 * real dimensions. It refuses SVG outright — "the source image could not be
 * decoded" — which is not a corner case here, since a screenshot tool or a
 * diagram export is exactly the sort of thing someone pastes in. So an <img>
 * is the fallback, and it decodes everything the browser can render.
 *
 * Without this the editor still SHOWED the picture — the <img> tag never
 * needed the bitmap — while silently measuring nothing: the frame fell back to
 * a square, and export returned null. A failure that looks like a layout
 * choice is the worst kind.
 */
async function decode(
  file: File | Blob,
  url: string,
): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file)
  } catch {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  }
}

/** Natural size, whichever kind of source came back. */
const sourceSize = computed(() => {
  const s = source.value
  if (!s) return null
  return s instanceof HTMLImageElement
    ? { width: s.naturalWidth, height: s.naturalHeight }
    : { width: s.width, height: s.height }
})

function revoke() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ""
  if (source.value instanceof ImageBitmap) source.value.close()
  source.value = null
}

onBeforeUnmount(revoke)

function rotate(by: number) {
  // Accumulated, never wrapped to 0-359. Normalising made the fourth quarter
  // turn read as 270 → 0, and CSS animates that as three quarters BACKWARD:
  // the picture unwound past every angle it had just come through instead of
  // completing the turn. Everything downstream takes a modulus of its own.
  rotation.value += by
  // The pan turns with the picture instead of being thrown away. Resetting was
  // the easy answer and the wrong one: someone zooms in on a rating plate,
  // turns the photograph upright, and has to find the plate again. A quarter
  // turn maps (x, y) to (-y, x) — the same rotation, applied to where they
  // were looking.
  const { x, y } = zoom.offset.value
  const quarters = ((by / 90) % 4 + 4) % 4
  let next = { x, y }
  for (let i = 0; i < quarters; i++) next = { x: -next.y, y: next.x }
  zoom.setView(next)
}

function reset() {
  rotation.value = 0
  zoom.reset()
}

/*
 * The frame is FIXED and the picture moves under it.
 *
 * The other model — a rectangle dragged around a still image by its handles —
 * was tried here first and it was the wrong one twice over. It gave two ways
 * to say the same thing (zoom the picture, or resize the frame), which is the
 * duplication this component is otherwise careful to avoid; and it put eight
 * bright handles permanently over the photograph being judged. This is the
 * model every avatar cropper and X itself settled on: aim the picture, and
 * what is inside the frame is what is kept.
 *
 * So there is no crop rectangle to store. What is kept is exactly what the
 * viewport shows, which the zoom and pan already describe.
 */
/** Shape of the frame, after the rotation has been applied. */
const boxRatio = computed(() => {
  if (typeof props.aspect === "number" && props.aspect > 0) return props.aspect
  const ratio = ASPECTS[props.aspect as string]
  if (ratio) return ratio
  const size = sourceSize.value
  if (!size) return 1
  const turned = upright.value % 180 !== 0
  const w = turned ? size.height : size.width
  const h = turned ? size.width : size.height
  return w / h
})

const frameStyle = computed(() => ({ aspectRatio: String(boxRatio.value) }))

const imageStyle = computed(() => ({
  ...zoom.style.value,
  // Rotation sits innermost, after the composable's scale and translate, so a
  // drag still moves the picture the way the pointer went once it is turned.
  transform: `${zoom.style.value.transform} rotate(${rotation.value}deg)`,
  // A quarter turn travels. Snapping is how you lose track of which way the
  // picture went, and the rest of the kit moves — a control that jumps reads
  // as a different component. The composable suppresses its own transition
  // while a drag is in flight, and that wins here too.
  transition:
    zoom.style.value.transition ??
    `transform var(--duration-medium) var(--ease-emphasized)`,
}))

/*
 * What the frame holds, as a Blob. `null` when nothing was changed.
 *
 * Taken from the rendered viewport rather than recomputed: what the person
 * lined up on screen is what gets written, which is the one thing a cropper
 * has to be right about.
 */
async function exportImage(): Promise<Blob | null> {
  const picture = source.value
  const size = sourceSize.value
  const frame = viewport.value
  if (!picture || !size || !frame) return null
  if (!edited.value && props.aspect === "free") return null

  // Work in "upright space": the picture as the person sees it, already
  // turned. The rotation is re-applied once, when drawing, which keeps the
  // maths free of quarter-turn special cases.
  const turned = upright.value % 180 !== 0
  const uprightW = turned ? size.height : size.width
  const uprightH = turned ? size.width : size.height

  // object-cover: the picture fills the frame and the overflow is what panning
  // reaches. One frame pixel is this many upright pixels.
  const cover = Math.max(frame.clientWidth / uprightW, frame.clientHeight / uprightH)
  const shown = cover * zoom.scale.value
  const cropW = Math.min(uprightW, frame.clientWidth / shown)
  const cropH = Math.min(uprightH, frame.clientHeight / shown)

  // `offset` is in content pixels — the same space the cover scale maps from —
  // so it converts with `cover`, not with the zoomed scale.
  const centreX = clamp(
    uprightW / 2 - zoom.offset.value.x / cover,
    cropW / 2,
    uprightW - cropW / 2,
  )
  const centreY = clamp(
    uprightH / 2 - zoom.offset.value.y / cover,
    cropH / 2,
    uprightH - cropH / 2,
  )

  const scale = Math.min(1, props.maxEdge / Math.max(cropW, cropH))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(cropW * scale))
  canvas.height = Math.max(1, Math.round(cropH * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((upright.value * Math.PI) / 180)
  ctx.scale(scale, scale)

  // Back to source coordinates for the read: a quarter turn swaps the axes.
  const readW = turned ? cropH : cropW
  const readH = turned ? cropW : cropH
  const readX = (turned ? centreY : centreX) - readW / 2
  const readY = (turned ? centreX : centreY) - readH / 2

  ctx.drawImage(picture, readX, readY, readW, readH, -readW / 2, -readH / 2, readW, readH)

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", props.quality),
  )
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

/*
 * The wheel.
 *
 * Bare, it zooms — that is what it already did and what the lightbox does with
 * it. Alt turns the picture instead, one degree a notch, fifteen with Shift.
 *
 * Alt and not Ctrl deliberately, even though Ctrl+wheel is the editor
 * convention: the browser has claimed Ctrl+wheel for page zoom, every other
 * application on the machine honours that, and a component in a web page that
 * takes it over is fighting a reflex rather than serving one. Figma can do it
 * because Figma is the whole page; a kit component is a guest on someone
 * else's.
 *
 * A degree at a time, because this is the same control as levelling a crooked
 * shot — the horizon adjustment and the free rotation are one gesture, not two
 * features that happen to both turn the picture.
 */
function onWheel(event: WheelEvent) {
  if (event.altKey) {
    event.preventDefault()
    const step = event.shiftKey ? 15 : 1
    rotation.value += Math.sign(event.deltaY) * step
    return
  }
  zoom.onWheel(event)
}

/*
 * Shortcuts, through the kit's registry rather than a switch of my own.
 *
 * useHotkeys answers three things a hand-rolled handler gets wrong, and one of
 * them bites here specifically: on a Cyrillic layout "R" arrives as
 * `key: "к"`, so matching the letter alone would leave the shortcut dead for
 * the person most likely to be using this. Scoped to the viewport, so two
 * editors on a page do not both answer the same key.
 */
function pan(dx: number, dy: number, shift: boolean) {
  // Panning moves the picture under a fixed frame, so the arrow goes the way
  // the CONTENT should go — the opposite of scrolling a page.
  const step = shift ? 40 : 10
  const { x, y } = zoom.offset.value
  zoom.setView({ x: x + dx * step, y: y + dy * step })
}

useHotkeys(
  () => [
    { key: "arrowleft", handler: () => pan(1, 0, false) },
    { key: "arrowleft", shift: true, handler: () => pan(1, 0, true) },
    { key: "arrowright", handler: () => pan(-1, 0, false) },
    { key: "arrowright", shift: true, handler: () => pan(-1, 0, true) },
    { key: "arrowup", handler: () => pan(0, 1, false) },
    { key: "arrowup", shift: true, handler: () => pan(0, 1, true) },
    { key: "arrowdown", handler: () => pan(0, -1, false) },
    { key: "arrowdown", shift: true, handler: () => pan(0, -1, true) },
    { key: "+", handler: () => zoom.zoomBy(1.3) },
    { key: "=", handler: () => zoom.zoomBy(1.3) },
    { key: "-", handler: () => zoom.zoomBy(1 / 1.3) },
    { key: "r", code: "KeyR", handler: () => rotate(90) },
    // Shift reverses it, the way a modifier reverses a direction elsewhere.
    { key: "r", code: "KeyR", shift: true, handler: () => rotate(-90) },
    { key: "0", code: "Digit0", handler: reset },
  ],
  { scope: viewport },
)

/** What the editor answers to, for a consumer building a shortcuts dialog. */
const SHORTCUTS = [
  { keys: ["←", "→", "↑", "↓"], label: "Pan (Shift for a bigger step)" },
  { keys: ["+", "−"], label: "Zoom" },
  { keys: ["R"], label: "Rotate a quarter turn (Shift reverses)" },
  { keys: ["Alt", "wheel"], label: "Turn freely (Shift snaps to 15°)" },
  { keys: ["0"], label: "Reset" },
] as const

defineExpose({ export: exportImage, reset, edited, shortcuts: SHORTCUTS })

// The editor lays out canvas and controls on a fixed gap, which a narrow panel has to tighten.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex flex-col gap-3",
)
</script>

<template>
  <div ref="revealAnchor"
    :class="rootClass"
    v-bind="rest">
    <!-- The frame is the crop. The picture moves under it, which is the
         interaction every avatar cropper already taught people. -->
    <!-- Focusable, because everything here is otherwise a mouse gesture: a
         person on a keyboard could reach the toolbar buttons and nothing else,
         and panning a zoomed picture was unreachable entirely. -->
    <div
      ref="viewport"
      tabindex="0"
      role="application"
      :aria-label="text.canvas"
      class="relative w-full overflow-hidden rounded-card border border-line bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :style="frameStyle"
      @wheel.prevent="onWheel"
      @pointerdown="zoom.onPointerDown"
      @pointermove="zoom.onPointerMove"
      @pointerup="zoom.onPointerUp"
      @pointercancel="zoom.onPointerUp"
    >
      <img
        v-if="objectUrl"
        :src="objectUrl"
        alt=""
        draggable="false"
        class="lp-editor__image absolute inset-0 size-full select-none object-cover motion-reduce:transition-none"
        :class="[
          zoom.panning.value ? 'cursor-grabbing' : 'cursor-grab',
          animate && !revealed ? 'lp-editor__image--waiting' : '',
        ]"
        :style="imageStyle"
      >

      <!-- Thirds, only while the picture is being moved. A composition guide
           belongs to the moment of composing; left on, it is one more thing to
           look past for all the time you are not. -->
      <Transition
        enter-active-class="transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
        leave-active-class="transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="zoom.panning.value"
          class="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
        >
          <div
            v-for="i in 9"
            :key="i"
            class="border-white/15"
            :class="[i % 3 !== 0 ? 'border-r' : '', i < 7 ? 'border-b' : '']"
          />
        </div>
      </Transition>
    </div>

    <!-- Two operations, shown as two. Five loose icons in a row — with two of
         them opposite pairs — read as five unrelated things; grouped, each
         pair is one control with a direction, and the zoom reading sits
         between the buttons that move it. -->
    <div class="flex items-center gap-1.5 text-muted">
      <div class="flex items-center rounded-control bg-surface-soft p-0.5">
        <LpButton
          size="sm"
          variant="ghost"
          :title="text.rotateLeft"
          :aria-label="text.rotateLeft"
          @click="rotate(-90)"
        >
          <LpIcon name="lucide:rotate-ccw" :size="16" />
        </LpButton>
        <LpButton
          size="sm"
          variant="ghost"
          :title="text.rotateRight"
          :aria-label="text.rotateRight"
          @click="rotate(90)"
        >
          <LpIcon name="lucide:rotate-cw" :size="16" />
        </LpButton>
      </div>

      <div class="flex items-center rounded-control bg-surface-soft p-0.5">
        <LpButton
          size="sm"
          variant="ghost"
          :disabled="zoom.scale.value <= 1"
          :title="text.zoomOut"
          :aria-label="text.zoomOut"
          @click="zoom.zoomBy(1 / 1.2)"
        >
          <LpIcon name="lucide:minus" :size="16" />
        </LpButton>
        <!-- Tabular, so the digits do not shuffle their own width as it moves. -->
        <span class="min-w-10 text-center text-xs tabular-nums">
          {{ Math.round(zoom.scale.value * 100) }}%
        </span>
        <LpButton
          size="sm"
          variant="ghost"
          :title="text.zoomIn"
          :aria-label="text.zoomIn"
          @click="zoom.zoomBy(1.2)"
        >
          <LpIcon name="lucide:plus" :size="16" />
        </LpButton>
      </div>

      <!-- Only once there is something to undo: a permanently dimmed control
           is a question the eye answers on every pass. -->
      <LpButton v-if="edited" size="sm" variant="ghost" class="ml-auto" @click="reset">
        <LpIcon name="lucide:undo-2" :size="15" />
        {{ text.reset }}
      </LpButton>
    </div>
  </div>
</template>

<style scoped>
/* The picture settles into the frame instead of appearing in it. Scale rather
   than a slide: the frame is the fixed thing here and the image lives inside
   it, so anything that moved would read as a crop that had shifted. */
.lp-editor__image {
  animation: lp-editor-in var(--duration-slow) var(--ease-settle) both;
}

.lp-editor__image--waiting {
  opacity: 0;
  animation: none;
}

@keyframes lp-editor-in {
  from {
    opacity: 0;
    scale: 1.04;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-editor__image,
  .lp-editor__image--waiting {
    opacity: 1;
    scale: 1;
    animation: none;
  }
}
</style>
