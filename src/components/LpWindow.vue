<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A floating panel over the page that the page keeps working under: a log
 * tail beside a dashboard, a console, a reference next to a form. Move it by
 * its title bar, resize it by its edges, drop it on a screen edge to dock it.
 *
 *   <LpWindow v-model:open="logs" title="Logs" persist="logs">
 *     <LpLogViewer :lines="lines" />
 *   </LpWindow>
 *
 * Different from the neighbours on purpose:
 * - LpModal and LpDrawer take the page away until they close; this does not:
 *   no scrim, no focus trap, and it stays out of the modal stack.
 * - LpLayoutCanvas tiles blocks into a page; a window sits over one.
 *
 * Not a window manager: no minimising, no taskbar. Raising, docking and
 * snapping are what it takes for a few panels to live together.
 *
 * Geometry is kept apart from what is applied. A window saved on a wide screen
 * is fitted to a smaller one, and gets its own place back on the wide one.
 *
 * Keyboard: the title bar takes focus; arrows move, Shift+arrows resize, Enter
 * fills the view, Escape anywhere in the window closes it.
 */
import IconCloseButton from "./IconCloseButton.vue"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from "vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { useCloseGuard, type CloseGuard } from "../composables/useCloseGuard"
import { useGlass } from "../composables/useGlass"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { usePersisted } from "../composables/usePersisted"
import { usePrefersReducedMotion } from "../composables/useReducedMotion"
import { usePortalTarget, useView, viewWindow } from "../composables/useView"
import {
  WINDOW_DOCKS,
  clampRect,
  dockAt,
  dockedRect,
  isWindowRect,
  resizeRect,
  snapRect,
  useWindowLayer,
  type WindowDock,
  type WindowEdge,
  type WindowRect,
  type WindowViewport,
} from "../composables/windowing"
import { CLOSE_ICON } from "./dropdown"
import LpIcon from "./LpIcon.vue"

const DEFAULT_SIZE = { width: 420, height: 320 }
const KEY_STEP = 16
const SNAP_THRESHOLD = 8
/** How near a screen edge the pointer must come to offer a dock. */
const DOCK_EDGE = 12
const EDGES: WindowEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]
const EDGE_CLASS: Record<WindowEdge, string> = {
  n: "inset-x-2 -top-1 h-2 cursor-ns-resize",
  s: "inset-x-2 -bottom-1 h-2 cursor-ns-resize",
  e: "inset-y-2 -right-1 w-2 cursor-ew-resize",
  w: "inset-y-2 -left-1 w-2 cursor-ew-resize",
  ne: "-right-1 -top-1 size-3 cursor-nesw-resize",
  nw: "-left-1 -top-1 size-3 cursor-nwse-resize",
  se: "-bottom-1 -right-1 size-3 cursor-nwse-resize",
  sw: "-bottom-1 -left-1 size-3 cursor-nesw-resize",
}

const props = withDefaults(
  defineProps<{
    title?: string
    /** Accessible name for a window without a visible `title`. */
    ariaLabel?: string
    /** Where it first opens, and at what size. Centred when unset. */
    defaultRect?: Partial<WindowRect>
    minWidth?: number
    minHeight?: number
    /** Share of the view (0–1) a docked side takes. */
    dockFraction?: number
    resizable?: boolean
    /** Offer docking when dragged to a screen edge. */
    dockable?: boolean
    /** Pull toward the view's edges and other windows while moving. */
    snap?: boolean
    closable?: boolean
    /** Remember place, size and dock under this key, across visits (see `usePersisted`). */
    persist?: string
    /** Something would be lost by closing: `true` asks first, a function asks the app. */
    guard?: CloseGuard
    /** Frosted glass instead of a solid panel. Unset follows `provideGlass`. */
    glass?: boolean
    labels?: Partial<{ close: string; move: string }>
  }>(),
  {
    minWidth: 240,
    minHeight: 160,
    dockFraction: 0.5,
    resizable: true,
    dockable: true,
    snap: true,
    closable: true,
    glass: undefined,
  },
)

const open = defineModel<boolean>("open", { default: false })
const emit = defineEmits<{
  /** After a move, resize or dock ends: where the window now stands. */
  (e: "change", value: { rect: WindowRect; dock: WindowDock | null }): void
}>()

const text = useLabels("window", { close: "Close", move: "Move window" }, () => props.labels)
const frosted = useGlass(() => props.glass)
const portalTo = usePortalTarget()
const view = useView()
const titleId = useId()

interface Placement {
  rect: WindowRect | null
  dock: WindowDock | null
}
const validPlacement = (value: unknown): value is Placement => {
  const saved = value as Placement | null
  return (
    !!saved &&
    (saved.rect === null || isWindowRect(saved.rect)) &&
    (saved.dock === null || WINDOW_DOCKS.includes(saved.dock))
  )
}
const placement = usePersisted<Placement>(() => props.persist && `lp-window:${props.persist}`, { rect: null, dock: null }, {
  validate: validPlacement,
})

const viewport = shallowRef<WindowViewport>({ width: 0, height: 0 })
const bounds = computed(() => ({ minWidth: props.minWidth, minHeight: props.minHeight }))

function firstRect(): WindowRect {
  const width = props.defaultRect?.width ?? DEFAULT_SIZE.width
  const height = props.defaultRect?.height ?? DEFAULT_SIZE.height
  return {
    x: props.defaultRect?.x ?? Math.round((viewport.value.width - width) / 2),
    y: props.defaultRect?.y ?? Math.round((viewport.value.height - height) / 2),
    width,
    height,
  }
}

/* What is drawn; `placement` keeps what was asked for. */
const applied = computed<WindowRect>(() => {
  const { rect, dock } = placement.value
  if (dock) return dockedRect(dock, viewport.value, props.dockFraction)
  return clampRect(rect ?? firstRect(), viewport.value, bounds.value)
})

const layer = useWindowLayer(() => (open.value ? applied.value : null))
const panel = ref<HTMLElement | null>(null)
const moving = ref(false)
const offeredDock = ref<WindowDock | null>(null)
const ghost = computed(() => (offeredDock.value ? dockedRect(offeredDock.value, viewport.value, props.dockFraction) : null))

function measure() {
  const win = viewWindow(view.value)
  viewport.value = { width: win.innerWidth, height: win.innerHeight }
}

// Teleported on the client only: the server has no view to place it in.
const mounted = ref(false)
onMounted(() => (mounted.value = true))

function commit() {
  emit("change", { rect: applied.value, dock: placement.value.dock })
}

let stopDrag: (() => void) | null = null

function onTitlePointerDown(event: PointerEvent) {
  if (event.button !== 0 || (event.target as Element).closest?.("button, a, input")) return
  layer.raise()
  const startX = event.clientX
  const startY = event.clientY
  const { dock } = placement.value
  // Leaving a dock restores the window's own size, under the pointer.
  const start = dock ? { ...(placement.value.rect ?? firstRect()), x: startX - KEY_STEP, y: startY - KEY_STEP } : applied.value
  let dragged = false
  moving.value = true
  stopDrag = startPointerDrag(event, {
    move: (ev) => {
      dragged = true
      const moved = { ...start, x: start.x + ev.clientX - startX, y: start.y + ev.clientY - startY }
      const snapped = props.snap ? snapRect(moved, viewport.value, layer.others(), SNAP_THRESHOLD) : moved
      placement.value = { rect: clampRect(snapped, viewport.value, bounds.value), dock: null }
      offeredDock.value = props.dockable ? dockAt(ev.clientX, ev.clientY, viewport.value, DOCK_EDGE) : null
    },
    end: (completed) => {
      moving.value = false
      stopDrag = null
      const chosen = offeredDock.value
      offeredDock.value = null
      if (completed && chosen) placement.value = { rect: placement.value.rect, dock: chosen }
      if (dragged) commit()
    },
  })
}

function onEdgePointerDown(event: PointerEvent, edge: WindowEdge) {
  if (event.button !== 0) return
  layer.raise()
  const start = applied.value
  const startX = event.clientX
  const startY = event.clientY
  moving.value = true
  stopDrag = startPointerDrag(event, {
    move: (ev) => {
      const rect = resizeRect(start, edge, ev.clientX - startX, ev.clientY - startY, viewport.value, bounds.value)
      placement.value = { rect, dock: null }
    },
    end: () => {
      moving.value = false
      stopDrag = null
      commit()
    },
  })
}

function toggleFull() {
  if (!props.dockable) return
  placement.value = { rect: placement.value.rect ?? applied.value, dock: placement.value.dock === "full" ? null : "full" }
  commit()
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.target !== event.currentTarget) return
  if (event.key === "Enter") {
    event.preventDefault()
    toggleFull()
    return
  }
  const dx = event.key === "ArrowRight" ? KEY_STEP : event.key === "ArrowLeft" ? -KEY_STEP : 0
  const dy = event.key === "ArrowDown" ? KEY_STEP : event.key === "ArrowUp" ? -KEY_STEP : 0
  if (!dx && !dy) return
  event.preventDefault()
  const rect = applied.value
  const next = event.shiftKey && props.resizable
    ? resizeRect(rect, "se", dx, dy, viewport.value, bounds.value)
    : { ...rect, x: rect.x + dx, y: rect.y + dy }
  placement.value = { rect: clampRect(next, viewport.value, bounds.value), dock: null }
  commit()
}

const { allowClose } = useCloseGuard(() => props.guard, () => open.value)

async function close() {
  if (await allowClose()) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !props.closable || event.defaultPrevented) return
  event.preventDefault()
  void close()
}

defineExpose({ close, raise: () => layer.raise() })

let returnTo: HTMLElement | null = null

watch(
  [open, mounted],
  async ([isOpen, ready], _, onCleanup) => {
    if (!ready) return
    if (!isOpen) {
      stopDrag?.()
      layer.release()
      returnTo?.focus?.({ preventScroll: true })
      returnTo = null
      return
    }
    const win = viewWindow(view.value)
    measure()
    win.addEventListener("resize", measure)
    onCleanup(() => win.removeEventListener("resize", measure))
    layer.raise()
    returnTo = win.document.activeElement as HTMLElement | null
    await nextTick()
    panel.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopDrag?.()
  layer.release()
})

const reduced = usePrefersReducedMotion()
const animate = computed(() => !moving.value && !reduced.value)
const { class: panelClass, attrs: rest } = useMergedAttrs(() =>
  [
    "fixed flex min-h-0 min-w-0 flex-col rounded-card border border-line shadow-panel outline-none",
    frosted.value ? "lp-glass-overlay" : "bg-surface-raised",
    placement.value.dock === "full" ? "rounded-none" : "",
  ].join(" "),
)

const px = (rect: WindowRect) => ({
  left: `${rect.x}px`,
  top: `${rect.y}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
})
</script>

<template>
  <Teleport v-if="mounted && open" :to="portalTo">
    <div
      v-if="ghost"
      data-lp-window-ghost
      class="pointer-events-none fixed rounded-card border-2 border-brand bg-brand/10"
      :style="{ ...px(ghost), zIndex: layer.z.value }"
    />
    <section
      v-bind="rest"
      ref="panel"
      role="dialog"
      aria-modal="false"
      :aria-label="title ? undefined : ariaLabel"
      :aria-labelledby="title ? titleId : undefined"
      tabindex="-1"
      :class="panelClass"
      :data-dock="placement.dock ?? undefined"
      :style="{
        ...px(applied),
        zIndex: layer.z.value,
        transition: animate ? 'left var(--duration-fast), top var(--duration-fast), width var(--duration-fast), height var(--duration-fast)' : 'none',
      }"
      @pointerdown.capture="layer.raise()"
      @focusin="layer.raise()"
      @keydown="onKeydown"
    >
      <header
        tabindex="0"
        :aria-label="`${text.move}: ${title ?? ariaLabel ?? ''}`"
        class="flex shrink-0 cursor-move touch-none select-none items-center gap-2 rounded-t-card px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @pointerdown="onTitlePointerDown"
        @dblclick="toggleFull"
        @keydown="onTitleKeydown"
      >
        <span :id="titleId" class="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          <slot name="title">{{ title }}</slot>
        </span>
        <slot name="actions" />
        <IconCloseButton v-if="closable" :label="text.close" @click="close" />
      </header>
      <div class="min-h-0 min-w-0 flex-1 overflow-auto">
        <slot :close="close" />
      </div>
      <template v-if="resizable">
        <div
          v-for="edge in EDGES"
          :key="edge"
          aria-hidden="true"
          :data-lp-window-edge="edge"
          class="absolute touch-none"
          :class="EDGE_CLASS[edge]"
          @pointerdown="onEdgePointerDown($event, edge)"
        />
      </template>
    </section>
  </Teleport>
</template>
