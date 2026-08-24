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
import { useReveal } from "../composables/useReveal"
import { useZoomPan } from "../composables/useZoomPan"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"

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
    labels?: Partial<Record<"rotateLeft" | "rotateRight" | "zoomIn" | "zoomOut" | "reset", string>>
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
  ...props.labels,
}))

const ASPECTS: Record<string, number | null> = {
  free: null,
  square: 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
}

const bitmap = shallowRef<ImageBitmap | null>(null)
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
    bitmap.value = await createImageBitmap(file).catch(() => null)
  },
  { immediate: true },
)

function revoke() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ""
  bitmap.value?.close()
  bitmap.value = null
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

/** Crop box proportions, after the rotation has been applied. */
const boxRatio = computed(() => {
  if (typeof props.aspect === "number" && props.aspect > 0) return props.aspect
  const ratio = ASPECTS[props.aspect as string]
  if (ratio) return ratio
  const source = bitmap.value
  if (!source) return 1
  const turned = upright.value % 180 !== 0
  const w = turned ? source.height : source.width
  const h = turned ? source.width : source.height
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
  // as a different component. The composable already suppresses its own
  // transition while a drag is in flight, and that wins here too: `undefined`
  // from it means "animate", anything else means "follow the pointer exactly".
  transition:
    zoom.style.value.transition ??
    `transform var(--duration-medium) var(--ease-emphasized)`,
}))

/**
 * What is inside the crop box, as a Blob. `null` when nothing was changed.
 *
 * The geometry is taken from the rendered frame rather than recomputed: what
 * the person lined up on screen is what gets written, which is the one thing a
 * cropper has to be right about.
 */
async function exportImage(): Promise<Blob | null> {
  const source = bitmap.value
  const frame = viewport.value
  if (!source || !frame) return null
  if (!edited.value && props.aspect === "free") return null

  // Work in "upright space": the picture as the person sees it, already turned.
  // The rotation is then re-applied once, when drawing, which keeps the crop
  // maths free of quarter-turn special cases.
  const turned = upright.value % 180 !== 0
  const uprightW = turned ? source.height : source.width
  const uprightH = turned ? source.width : source.height

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

  // Centre, turn, then draw the source about its own middle: the crop window is
  // expressed in upright space and the rotation puts the pixels back.
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((upright.value * Math.PI) / 180)
  ctx.scale(scale, scale)

  // Back to source coordinates for the read: a quarter turn swaps the axes.
  const readW = turned ? cropH : cropW
  const readH = turned ? cropW : cropH
  const readX = (turned ? centreY : centreX) - readW / 2
  const readY = (turned ? centreX : centreY) - readH / 2

  ctx.drawImage(source, readX, readY, readW, readH, -readW / 2, -readH / 2, readW, readH)

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", props.quality),
  )
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

defineExpose({ export: exportImage, reset, edited })
</script>

<template>
  <div ref="revealAnchor" class="flex flex-col gap-3">
    <!-- The frame is the crop. The picture moves under it, which is the
         interaction every avatar cropper already taught people. -->
    <div
      ref="viewport"
      class="relative w-full overflow-hidden rounded-card border border-line bg-surface-soft"
      :style="frameStyle"
      @wheel.prevent="zoom.onWheel"
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
    </div>

    <div class="flex flex-wrap items-center gap-1">
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
      <LpButton
        size="sm"
        variant="ghost"
        :title="text.zoomIn"
        :aria-label="text.zoomIn"
        @click="zoom.zoomBy(1.2)"
      >
        <LpIcon name="lucide:zoom-in" :size="16" />
      </LpButton>
      <LpButton
        size="sm"
        variant="ghost"
        :title="text.zoomOut"
        :aria-label="text.zoomOut"
        @click="zoom.zoomBy(1 / 1.2)"
      >
        <LpIcon name="lucide:zoom-out" :size="16" />
      </LpButton>
      <LpButton
        size="sm"
        variant="ghost"
        class="ml-auto"
        :disabled="!edited"
        @click="reset"
      >
        <LpIcon name="lucide:undo-2" :size="16" />
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
