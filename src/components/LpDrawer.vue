<script setup lang="ts">
/*
 * Side / bottom panel built on vaul-vue (drag-driven drawer over reka's Dialog
 * primitive — same base as the rest of the kit, so accessibility and the token
 * theming carry over). Over the old reka-Dialog version this adds drag-to-
 * dismiss with inertia, snap points, a draggable handle and an optional
 * scale-background effect. Slot/prop surface stays backwards compatible: `side`
 * still works (mapped onto `direction`), plus `size`/`width`/title/footer.
 *
 * scale-background note: the effect scales the page behind the drawer, so the
 * host app must wrap its root in an element with `[vaul-drawer-wrapper]` (and a
 * solid background) for vaul to find and transform. Without it the drawer still
 * works — the background just doesn't scale.
 */
import { usePointerSwipe } from "@vueuse/core"
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
} from "vaul-vue"
import { computed, ref, useSlots } from "vue"
import { CLOSE_ICON } from "./dropdown"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

type Direction = "top" | "bottom" | "left" | "right"

const props = withDefaults(
  defineProps<{
    open?: boolean
    /** Edge the drawer attaches to. `side` is a back-compat alias (left/right). */
    direction?: Direction
    side?: "left" | "right"
    title?: string
    description?: string
    /** Size preset along the drawer's main axis (width for left/right, height for top/bottom). */
    size?: "sm" | "md" | "lg" | "xl"
    /** Explicit size override (any CSS length), wins over `size`. */
    width?: string
    /** Drag-to-dismiss + click-outside. Set false to force a controlled close. */
    dismissible?: boolean
    /** Fractions (0–1) or px strings the drawer snaps between, nearest edge first. */
    snapPoints?: (number | string)[]
    /** Show the drag handle (auto-on for bottom/top sheets). */
    handle?: boolean
    /** Only the handle initiates a drag — frees inner content to scroll. */
    handleOnly?: boolean
    /** Scale the [vaul-drawer-wrapper] background while open. */
    scaleBackground?: boolean
    /** Drag fraction (0–1) past which a release dismisses. */
    closeThreshold?: number
    /**
     * Auto-tag interactive descendants (input, textarea, select, button, links,
     * [contenteditable]) with data-vaul-no-drag so a drag can't start on them —
     * you can select text / use controls without dragging the drawer. On by
     * default; the drawer still drags from empty space, the handle and header.
     */
    noDragControls?: boolean
    /**
     * Mark the entire body as non-draggable: the drawer then only drags from the
     * handle/header. Stronger than noDragControls — use for form-heavy drawers.
     */
    noDragContent?: boolean
    /**
     * Open by dragging in from the screen edge (Discord-style). Renders an
     * invisible edge strip; a pull from it drags a preview panel that follows
     * the finger, and a release past `edgeOpenThreshold` opens the drawer. Only
     * meaningful for left/right drawers.
     */
    edgeOpen?: boolean
    /** Width (px) of the edge grab strip. */
    edgeSize?: number
    /** Fraction (0–1) of the panel width the pull must reach to open on release. */
    edgeOpenThreshold?: number
    /**
     * Let the user drag the inner edge to resize the panel (horizontal drawers
     * only — e.g. a logs panel whose long lines overflow). The new size is kept
     * for the session. Min/max bound the drag.
     */
    resizable?: boolean
    /** Min main-axis size while resizing (any CSS length). Default 22rem. */
    minSize?: string
    /** Max main-axis size while resizing (any CSS length). Default 96vw. */
    maxSize?: string
  }>(),
  {
    side: "right",
    size: "sm",
    dismissible: true,
    noDragControls: true,
    edgeSize: 44,
    edgeOpenThreshold: 0.3,
    minSize: "22rem",
    maxSize: "96vw",
  },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
}>()

// `direction` wins; otherwise fall back to the legacy `side`.
const dir = computed<Direction>(() => props.direction ?? props.side ?? "right")
const isHorizontal = computed(() => dir.value === "left" || dir.value === "right")
const isSheet = computed(() => dir.value === "top" || dir.value === "bottom")

// Handle defaults on for top/bottom sheets (where dragging a handle is the norm).
const showHandle = computed(() => props.handle ?? isSheet.value)

const SIZES = { sm: 22, md: 28, lg: 36, xl: 48 } // rem along the main axis

// Geometry per edge. The cross-axis is pinned to the viewport; the main axis
// takes the size preset. vaul drives the open/close transform itself, so we
// don't add slide keyframes — only the resting box + rounding toward the centre.
const contentClass = computed(() => {
  const base = "fixed z-(--z-modal) flex flex-col border-line bg-surface-raised shadow-panel outline-none"
  const map: Record<Direction, string> = {
    left: "inset-y-0 left-0 border-r rounded-r-card",
    right: "inset-y-0 right-0 border-l rounded-l-card",
    top: "inset-x-0 top-0 border-b rounded-b-card",
    bottom: "inset-x-0 bottom-0 border-t rounded-t-card",
  }
  return [base, map[dir.value]]
})

// User-resized main-axis size (px), null until the handle is dragged. Persists
// for the component's lifetime so reopening keeps the chosen width.
const resizedPx = ref<number | null>(null)

const sizeStyle = computed(() => {
  // When snapPoints drive the height, let vaul own the main-axis size.
  if (props.snapPoints?.length && isSheet.value) return undefined
  // A live resize wins over the preset/width.
  if (props.resizable && isHorizontal.value && resizedPx.value != null) {
    return { width: `${resizedPx.value}px` }
  }
  const len = props.width ?? `min(${isHorizontal.value ? "94vw" : "94vh"}, ${SIZES[props.size]}rem)`
  return isHorizontal.value ? { width: len } : { height: len }
})

// Drag the inner edge to resize. For a right drawer the panel grows as the
// pointer moves left (width = viewportRight − clientX); mirror for left.
function startResize(e: PointerEvent) {
  if (!props.resizable || !isHorizontal.value) return
  e.preventDefault()
  const fromRight = dir.value === "right"
  const toPx = (css: string) => {
    // Resolve rem/vw to px against the viewport for clamping.
    if (css.endsWith("rem")) return Number.parseFloat(css) * 16
    if (css.endsWith("vw")) return (Number.parseFloat(css) / 100) * window.innerWidth
    return Number.parseFloat(css)
  }
  const min = toPx(props.minSize)
  const max = toPx(props.maxSize)
  const onMove = (ev: PointerEvent) => {
    const raw = fromRight ? window.innerWidth - ev.clientX : ev.clientX
    resizedPx.value = Math.max(min, Math.min(max, raw))
  }
  const onUp = () => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
  }
  document.body.style.userSelect = "none"
  document.body.style.cursor = "ew-resize"
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
}

const slots = useSlots()
const hasHeader = computed(() => Boolean(props.title || slots.title))

// Body padding. The handle or the header already own the top edge, so drop the
// body's top padding when either is present; otherwise pad evenly.
const padClass = computed(() => {
  const horizontal = "px-5 pb-5"
  if (showHandle.value || hasHeader.value) return `${horizontal} pt-0`
  return "p-5"
})

// Header padding is edge-independent (the side-drawer bug was deriving it from
// padClass, which left side drawers with no horizontal inset). Always inset
// horizontally + separate from the body; trim the top when a handle sits above.
const headerClass = computed(() => (showHandle.value ? "px-5 pb-4 pt-1" : "px-5 pb-4 pt-5"))

// vaul aborts a drag whose pointerdown lands on (or inside) a [data-vaul-no-drag]
// element. We tag interactive descendants so the drawer can't be dragged off a
// field/control — text selection and clicks work, drag still starts on blank
// space. Re-runs on update so it covers slot content that mounts/changes later.
const NO_DRAG_SELECTOR =
  "input, textarea, select, button, a[href], label, [contenteditable=''], [contenteditable='true']"
function tagNoDrag(el: HTMLElement, { value }: { value: boolean }) {
  if (!value) return
  for (const node of el.querySelectorAll<HTMLElement>(NO_DRAG_SELECTOR)) {
    node.setAttribute("data-vaul-no-drag", "")
  }
}
const vNoDragControls = {
  mounted: tagNoDrag,
  updated: tagNoDrag,
}

// ── Edge-drag-to-open (Discord-style) ──────────────────────────────────────
// vaul opens/closes programmatically and only drags an *already-open* drawer,
// so the pull-from-edge gesture is ours: an invisible edge strip captures the
// pointer, we translate a preview panel that follows the finger, and a release
// past the threshold flips `open` (vaul then animates the rest). Horizontal
// drawers only.
const edgeStrip = ref<HTMLElement | null>(null)
// 0 (closed) … 1 (fully pulled in). Drives the preview transform + overlay.
const peek = ref(0)
const peeking = ref(false)
// True while we hand off from the finger-preview to the real drawer, so vaul's
// own open animation is suppressed — the preview has already slid it in, a
// second slide would look like a double-open.
const handingOff = ref(false)

// Resolve the panel's main-axis size in px to map drag distance → progress.
function panelPx(): number {
  const vw = typeof window === "undefined" ? 0 : window.innerWidth
  // mirror sizeStyle's min(94vw, SIZES[size]rem); 1rem≈16px.
  const cap = props.width ? Number.parseFloat(props.width) : SIZES[props.size] * 16
  return Math.min(vw * 0.94, Number.isFinite(cap) ? cap : SIZES[props.size] * 16)
}

usePointerSwipe(edgeStrip, {
  threshold: 0,
  pointerTypes: ["touch", "pen"],
  onSwipeStart() {
    if (!props.edgeOpen || props.open) return
    peeking.value = true
  },
  onSwipe(e) {
    if (!peeking.value) return
    // Inward pull distance: from the right edge we move left (−x), from the
    // left edge we move right (+x). Normalise to 0…1 of the panel width.
    const fromRight = dir.value === "right"
    const dx = fromRight ? window.innerWidth - e.clientX : e.clientX
    peek.value = Math.max(0, Math.min(1, dx / panelPx()))
  },
  onSwipeEnd() {
    if (!peeking.value) return
    peeking.value = false
    if (peek.value >= props.edgeOpenThreshold) {
      // Open: let the preview finish sliding to fully-in, then swap in the real
      // drawer *without* a vaul slide (handingOff) so there's no second anim.
      peek.value = 1
      handingOff.value = true
      window.setTimeout(() => {
        emit("update:open", true)
        // Clear after the real drawer has mounted in place.
        window.setTimeout(() => {
          handingOff.value = false
          peek.value = 0
        }, 60)
      }, 160)
    } else {
      // Below threshold: snap the preview back out.
      peek.value = 0
    }
  },
})

// The preview panel slides with the finger: translate from fully-off (100%)
// toward 0 as peek → 1. Kept visible through the hand-off so the real drawer
// can appear underneath without a flash.
const previewStyle = computed(() => {
  if (!props.edgeOpen || (props.open && !handingOff.value)) return { display: "none" }
  const off = (1 - peek.value) * 100
  const axis = dir.value === "right" ? off : -off
  return {
    transform: `translateX(${axis}%)`,
    transition: peeking.value ? "none" : "transform 0.16s ease-out",
    pointerEvents: "none" as const,
  }
})

const edgeStripStyle = computed(() => {
  const w = `${props.edgeSize}px`
  return dir.value === "right"
    ? { right: "0", width: w }
    : { left: "0", width: w }
})
</script>

<template>
  <!-- Edge-drag-to-open: an invisible grab strip + a finger-following preview
       of the panel, shown only while closed. Horizontal drawers only. -->
  <template v-if="edgeOpen && isHorizontal">
    <div
      ref="edgeStrip"
      class="fixed inset-y-0 z-(--z-overlay) touch-none"
      :style="edgeStripStyle"
      aria-hidden="true"
    />
    <div
      v-show="peeking || peek > 0"
      class="pointer-events-none fixed inset-0 z-(--z-overlay) bg-black/50"
      :style="{ opacity: peek }"
    />
    <div :class="contentClass" :style="[sizeStyle, previewStyle]" aria-hidden="true">
      <div v-if="hasHeader" class="flex items-start justify-between gap-4" :class="headerClass">
        <span class="text-base font-semibold text-ink">{{ title }}</span>
      </div>
    </div>
  </template>

  <DrawerRoot
    :open="open"
    :direction="dir"
    :dismissible="dismissible"
    :snap-points="snapPoints"
    :handle-only="handleOnly"
    :should-scale-background="scaleBackground"
    :close-threshold="closeThreshold"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <DrawerPortal>
      <DrawerOverlay
        class="fixed inset-0 z-(--z-overlay) bg-black/50 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease] data-[state=closed]:animate-[fade-out_130ms_ease]"
      />
      <DrawerContent
        :class="contentClass"
        :style="sizeStyle"
        :data-vaul-animate="handingOff ? 'false' : undefined"
      >
        <!-- Resize grip on the inner edge (horizontal drawers). data-vaul-no-drag
             so grabbing it resizes the panel instead of starting a vaul drag. -->
        <div
          v-if="resizable && isHorizontal"
          data-vaul-no-drag
          class="group/resize absolute inset-y-0 z-10 w-1.5 cursor-ew-resize"
          :class="dir === 'right' ? 'left-0' : 'right-0'"
          @pointerdown="startResize"
        >
          <span
            class="absolute inset-y-0 w-px bg-line transition-colors group-hover/resize:bg-brand"
            :class="dir === 'right' ? 'left-0' : 'right-0'"
          />
        </div>

        <!-- Drag handle: a pill the user grabs; vaul wires the drag to it. -->
        <DrawerHandle
          v-if="showHandle"
          class="mx-auto my-2 h-1.5 w-12 shrink-0 cursor-grab rounded-pill bg-line-strong transition-colors hover:bg-muted active:cursor-grabbing"
        />

        <header
          v-if="hasHeader"
          class="flex items-start justify-between gap-4"
          :class="headerClass"
        >
          <div class="flex flex-col gap-1">
            <DrawerTitle class="text-base font-semibold text-ink">
              <slot name="title">{{ title }}</slot>
            </DrawerTitle>
            <DrawerDescription v-if="description" class="text-sm text-muted">
              {{ description }}
            </DrawerDescription>
          </div>
          <DrawerClose
            class="group flex shrink-0 items-center rounded-md p-1 text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <LpIcon
              name="lucide:x"
              :size="18"
              :class="CLOSE_ICON"
            />
          </DrawerClose>
        </header>

        <!-- Body scrolls via LpScrollArea's overlay bar. The wrapper keeps the
             no-drag wiring on the OUTER element so vaul still sees one content
             container (overlay scroll lives one level in); padding moves to the
             scroll content so the bar floats at the panel edge. -->
        <div
          v-no-drag-controls="noDragControls"
          class="flex min-h-0 min-w-0 flex-1 flex-col"
          :data-vaul-no-drag="noDragContent ? '' : undefined"
        >
          <!-- min-w-0 on the body + scroll content so a wide child (e.g. a log
               viewer's min-w-max rows with wrap off) scrolls INSIDE itself
               instead of stretching the whole panel into a horizontal scroll. -->
          <LpScrollArea class="min-h-0 min-w-0 flex-1" :content-class="`min-w-0 ${padClass}`">
            <slot />
          </LpScrollArea>
        </div>

        <footer v-if="$slots.footer" class="flex justify-end gap-2 px-5 pb-5 pt-4">
          <slot name="footer" />
        </footer>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
