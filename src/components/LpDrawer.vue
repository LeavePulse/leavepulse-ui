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
import { computed, useSlots } from "vue"
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
  }>(),
  { side: "right", size: "sm", dismissible: true, noDragControls: true },
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

const sizeStyle = computed(() => {
  // When snapPoints drive the height, let vaul own the main-axis size.
  if (props.snapPoints?.length && isSheet.value) return undefined
  const len = props.width ?? `min(${isHorizontal.value ? "94vw" : "94vh"}, ${SIZES[props.size]}rem)`
  return isHorizontal.value ? { width: len } : { height: len }
})

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
</script>

<template>
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
      <DrawerContent :class="contentClass" :style="sizeStyle">
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
          class="flex min-h-0 flex-1 flex-col"
          :data-vaul-no-drag="noDragContent ? '' : undefined"
        >
          <LpScrollArea class="min-h-0 flex-1" :content-class="padClass">
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
