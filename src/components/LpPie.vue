<script setup lang="ts">
/*
 * Shares of a whole, as a pie or a donut. Same SVG-and-tokens approach as
 * LpChart; the two differ only by `innerRadius`, so they're one component.
 *
 * Takes ANY number of slices. A circle stops being readable past a handful —
 * slivers can't be compared or clicked — but a shared kit can't dictate how
 * many categories a caller has, so instead of refusing or truncating, the tail
 * is folded into a single "Other" slice (see resolveSlices) that keeps its
 * total, its share and a count of what it stands for. Raise `maxSlices` or pass
 * `0` to draw every slice as given.
 *
 * A donut's hole is the natural place for the headline the chart is about — the
 * total, or whatever the caller puts in the `center` slot.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { easeTravel, prefersReducedMotion } from "../composables/easing"
import { useReveal } from "../composables/useReveal"
import { arcPath, calloutLabels, resolveSlices, formatTick, type PieSlice } from "./chart"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpNumberFlow from "./LpNumberFlow.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import LpTooltip from "./LpTooltip.vue"

/** A slice, as reported by every interaction event. */
export interface SliceEvent {
  index: number
  label: string
  value: number
  isOther: boolean
}

const props = withDefaults(
  defineProps<{
    slices: PieSlice[]
    type?: "pie" | "donut"
    /** Outer diameter in px. */
    size?: number
    /** Donut only: hole diameter as a fraction of the outer radius (0–1). */
    innerRatio?: number
    title?: string
    subtitle?: string
    /**
     * Keep the largest N-1 slices and sum the rest into "Other". `0` disables
     * the fold and draws every slice — for a caller that knows its data is
     * already few, or that would rather show a crowded circle than a bucket.
     */
    maxSlices?: number
    /** Label for the folded remainder. */
    otherLabel?: string
    /**
     * Draw the slices largest-first instead of in the order given. Ranking
     * always decides which slices survive `maxSlices`; this decides whether it
     * also reorders them.
     */
    sortBySize?: boolean
    /** Appended to values in the legend and tooltip, e.g. " GB". */
    unit?: string
    /** Custom value formatter; overrides the compact 1.2k default. */
    formatValue?: (v: number) => string
    /**
     * Name the slices with leader lines around the circle instead of a legend
     * beside it. Better when the labels are long and self-explanatory (versions,
     * hostnames) and the reader wants share-per-name without cross-referencing a
     * colour; the legend stays better for short, repeated categories.
     */
    labels?: boolean
    /** Callout width reserved for text on each side, in px. */
    labelWidth?: number
    /**
     * Defaults to true, except in `labels` mode — callouts already name every
     * slice, and a legend beside them says the same thing twice. Set it
     * explicitly to have both.
     */
    showLegend?: boolean
    /** Print each slice's percentage next to its legend entry. */
    showPercent?: boolean
    /** Donut only: print the total in the hole. Ignored when #center is used. */
    showTotal?: boolean
    /** Gap between slices in degrees — reads as separate parts, not one disc. */
    padAngle?: number
    /** Corner radius of each slice in px. 0 for hard edges. */
    cornerRadius?: number
    /** How far the hovered slice lifts out of the circle, in px. */
    hoverOffset?: number
    /**
     * Sweep the circle open, clockwise from twelve, when it first comes into
     * view. Turn it off where several are drawn at once and the sweeps would
     * compete rather than read as one arrival.
     */
    animate?: boolean
    /** Sweep time in ms. */
    duration?: number
    /**
     * Right-click menu, built from the slice that was hit and the whole current
     * selection — so an action can apply to one slice or to all the picked ones.
     */
    menuItems?: (slice: SliceEvent, selection: SliceEvent[]) => ContextMenuItemDef[]
    emptyLabel?: string
  }>(),
  {
    type: "donut",
    size: 180,
    innerRatio: 0.62,
    maxSlices: 6,
    otherLabel: "Other",
    showPercent: true,
    showTotal: true,
    labelWidth: 140,
    padAngle: 1.5,
    cornerRadius: 4,
    hoverOffset: 8,
    emptyLabel: "No data",
    animate: true,
    duration: 900,
  },
)

const emit = defineEmits<{
  (e: "sliceClick", payload: SliceEvent): void
  /** The full selection after any change — click, Ctrl, Shift, drag or clear. */
  (e: "selectionChange", payload: SliceEvent[]): void
  /** Right-click, fired before `menuItems` is consulted. */
  (e: "sliceContextMenu", payload: SliceEvent): void
}>()

const resolved = computed(() =>
  resolveSlices(
    props.slices,
    props.maxSlices || undefined,
    props.otherLabel,
    !props.sortBySize,
  ),
)

const hasData = computed(() => resolved.value.slices.length > 0)

const legendShown = computed(() => props.showLegend ?? !props.labels)

const fmt = (v: number): string =>
  `${props.formatValue ? props.formatValue(v) : formatTick(v)}${props.unit ?? ""}`

const pct = (fraction: number): string => {
  const p = fraction * 100
  // Never round a present slice down to "0%" — it reads as absent.
  if (p > 0 && p < 0.1) return "<0.1%"
  return `${Number(p.toFixed(p < 10 ? 1 : 0))}%`
}

/* Angles first, separately: the label layout needs them before the paths can be
   placed (the canvas height depends on how many labels there are). */
const arcAngles = computed(() => {
  const list = resolved.value.slices
  const pad = list.length > 1 ? (props.padAngle * Math.PI) / 180 : 0
  let angle = -Math.PI / 2

  return list.map((s, index) => {
    const sweep = s.fraction * Math.PI * 2
    const start = angle
    angle += sweep
    // A pad wider than the slice itself would invert it; clamp to a hairline.
    const gap = Math.min(pad, sweep * 0.5)
    return { index, slice: s, start: start + gap / 2, end: angle - gap / 2, mid: start + sweep / 2 }
  })
})

/*
 * Callouts need room on both sides for their text, so the canvas grows while
 * the circle keeps its `size`. Everything below is measured from the canvas
 * centre, which is why cx and cy are tracked separately.
 */
/* The radial leg is long enough that leaders fan out clearly before they turn;
   too short and a cluster of slivers bends almost on the rim. */
const ELBOW = 16
const RUN = 14
const LABEL_LINE = 17

const canvasWidth = computed(() =>
  props.labels ? props.size + (props.labelWidth + ELBOW + RUN) * 2 : props.size,
)

/*
 * Stacked labels can need more vertical room than the circle itself — sized by
 * the FULLER SIDE, not the total. Splitting 20 labels across two columns needs
 * room for ten, not twenty; sizing by the total left the columns loose while
 * sizing by half exactly would overflow whenever the split is uneven (the
 * balancing pass allows one side to hold the extra).
 */
const canvasHeight = computed(() => {
  if (!props.labels) return props.size
  /*
   * Tall enough for the column that actually forms. Labels are assigned by
   * geometry, so the split follows the data rather than being even — a chart
   * whose slices bunch on one side puts most of its labels there, and sizing for
   * a 50/50 split would clip them. Counting each side's real occupancy sizes the
   * box for the fuller one.
   */
  const right = arcAngles.value.filter((a) => Math.cos(a.mid) >= 0).length
  const perSide = Math.max(right, arcAngles.value.length - right) + 2
  return Math.max(props.size, perSide * LABEL_LINE + 16)
})

const cx = computed(() => canvasWidth.value / 2)
const cy = computed(() => canvasHeight.value / 2)

// The lift has to come out of the radius, not out of the box: a slice that
// grows past the viewBox would be clipped mid-hover.
const outer = computed(() => props.size / 2 - 2 - props.hoverOffset)
const inner = computed(() =>
  props.type === "donut" ? outer.value * Math.min(0.95, Math.max(0, props.innerRatio)) : 0,
)

/*
 * Angles run clockwise from twelve o'clock, which is where a circle is read
 * from. The pad is taken off each slice's own sweep and only when there is more
 * than one slice — a lone slice with a gap would be a circle with a nick in it.
 */
const arcs = computed(() =>
  arcAngles.value.map(({ slice, start, end, mid }) => ({
    ...slice,
    d: arcPath(cx.value, cy.value, outer.value, inner.value, start, end, props.cornerRadius),
    /*
     * Push along the slice's own bisector, so it moves straight out of the
     * circle rather than sideways.
     *
     * As an SVG `transform` attribute, not a CSS `translate`: Vue binds the
     * latter as an inline style, and on an SVG <path> that produced no style
     * attribute at all — the wedge never moved, though the dimming beside it
     * worked and made it look as if it had.
     */
    lift: `translate(${(Math.cos(mid) * props.hoverOffset).toFixed(2)} ${(
      Math.sin(mid) * props.hoverOffset
    ).toFixed(2)})`,
  })),
)

/*
 * The circle sweeps open clockwise from twelve, the way it is read.
 *
 * A wedge-shaped clip does the work, so nothing about the slices themselves
 * changes — they are drawn once, at their final geometry, and simply revealed.
 * Growing each slice's own angle instead would re-lay the callouts on every
 * frame and shuffle the labels around the rim.
 *
 * The wedge is an `arcPath` from the same helper the slices use, at a radius
 * comfortably past the rim so the lift on a hovered slice is never clipped.
 */
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animate })

const sweep = ref(props.animate ? 0 : 1)
let sweepFrame = 0

const stopSweep = () => {
  if (sweepFrame) cancelAnimationFrame(sweepFrame)
  sweepFrame = 0
}

const runSweep = () => {
  stopSweep()
  if (prefersReducedMotion() || props.duration <= 0) {
    sweep.value = 1
    return
  }
  const started = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / props.duration)
    // The sweep is a journey around the circle, so it eases like one.
    sweep.value = easeTravel(t)
    sweepFrame = t < 1 ? requestAnimationFrame(step) : 0
  }
  sweepFrame = requestAnimationFrame(step)
}

watch(
  revealed,
  (visible) => {
    if (visible && props.animate) runSweep()
  },
  { immediate: true },
)

onBeforeUnmount(stopSweep)

const sweepId = `lp-pie-${Math.random().toString(36).slice(2, 9)}`

/** Full circle once the sweep completes, so nothing stays clipped. */
const sweepPath = computed(() => {
  const start = -Math.PI / 2
  const radius = outer.value + props.hoverOffset + 4
  return arcPath(cx.value, cy.value, radius, 0, start, start + Math.PI * 2 * sweep.value)
})

const callouts = computed(() =>
  props.labels
    ? calloutLabels(
        arcAngles.value.map((a) => ({ index: a.index, mid: a.mid })),
        cx.value,
        cy.value,
        outer.value,
        ELBOW,
        RUN,
        LABEL_LINE,
        canvasHeight.value,
      )
    : [],
)

/*
 * Hover and selection are separate states, because they answer different
 * questions. Hovering LIFTS the slice under the pointer — a local, positive
 * response that leaves the rest alone. Selecting is a claim about the whole
 * chart, and that is when everything unselected recedes; dimming on mere hover
 * would make the circle flicker as the pointer crossed it.
 *
 * Selection is a SET, following the conventions of every list people already
 * know: click replaces it, Ctrl/Cmd toggles one, Shift takes the run from the
 * anchor, and dragging across the circle picks up whatever it passes over. A
 * chart people compare slices in needs "these two, not that one", which a
 * single-selection model can't express.
 */
const active = ref(-1)
const selected = ref(new Set<number>())
/** Where a Shift-range starts: the last slice touched deliberately. */
const anchor = ref(-1)
const dragging = ref(false)

const isSelected = (i: number) => selected.value.has(i)

const payloadFor = (i: number) => {
  const a = arcs.value[i]
  return { index: i, label: a.label, value: a.value, isOther: a.isOther }
}

const emitSelection = () => {
  const indices = [...selected.value].sort((x, y) => x - y)
  emit("selectionChange", indices.map(payloadFor))
}

const rangeTo = (i: number) => {
  const from = anchor.value < 0 ? i : anchor.value
  const [lo, hi] = from <= i ? [from, i] : [i, from]
  const next = new Set(selected.value)
  for (let k = lo; k <= hi; k++) next.add(k)
  return next
}

const onSlicePointerDown = (i: number, e: PointerEvent) => {
  // Right-click opens a menu; it must not disturb a selection the menu acts on.
  if (e.button === 2) return

  if (e.shiftKey) {
    selected.value = rangeTo(i)
  } else if (e.ctrlKey || e.metaKey) {
    const next = new Set(selected.value)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    selected.value = next
    anchor.value = i
  } else {
    // A plain click on the only selected slice clears, so the circle can be
    // reset without hunting for empty space.
    const only = selected.value.size === 1 && selected.value.has(i)
    selected.value = only ? new Set() : new Set([i])
    anchor.value = only ? -1 : i
    if (!only) beginDrag()
  }
  emitSelection()
  emit("sliceClick", payloadFor(i))
}

/** Drag across slices to gather them — same gesture as a rubber-band in a list. */
const onSlicePointerEnter = (i: number) => {
  clearTimeout(leaveTimer)
  active.value = i
  if (!dragging.value || selected.value.has(i)) return
  const next = new Set(selected.value)
  next.add(i)
  selected.value = next
  emitSelection()
}

/*
 * A drag that ends outside the component never fires our own pointerup, and the
 * circle would then keep gathering slices on the next hover. Bind to the window
 * for the duration of the gesture only — the same shape LpScrollArea and
 * LpDrawer use for their drags — rather than holding a global listener for the
 * component's whole life.
 */
/*
 * Leaving a slice for the canvas — the donut's hole, the gaps between wedges —
 * is not leaving the chart, so the svg's own pointerleave never fires and the
 * hover would stay on the last slice touched. Clearing per slice means the
 * readout and the tooltip both let go the moment the pointer is over nothing.
 * Guarded by index so a move straight onto a neighbour (whose pointerenter has
 * already run) doesn't immediately undo it.
 */
let leaveTimer: ReturnType<typeof setTimeout> | undefined

const onSlicePointerLeave = (i: number) => {
  if (active.value !== i) return
  /*
   * Deferred by a frame or two: crossing from one wedge to the next passes over
   * the gap between them, and clearing immediately made the readout blink and
   * the tooltip close and reopen on every crossing. A neighbour's pointerenter
   * cancels this before it runs; only landing on nothing lets it through.
   */
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    if (active.value === i) active.value = -1
  }, 60)
}

/*
 * Leaving the chart itself is unambiguous — drop the hover at once, without the
 * grace period that covers the gaps between wedges.
 *
 * Except when the pointer "left" onto the tooltip. The tip is placed AT the
 * cursor, and although it takes no pointer events the browser still resolves it
 * as the element being entered, so crossing a wedge boundary underneath it
 * reports a pointerleave from the whole svg with the tip as relatedTarget.
 * Treated as a real exit, that closed the tip the instant it got in its own way.
 */
const leaveChart = (e: PointerEvent) => {
  // relatedTarget can be the panel itself or reka's positioning wrapper around
  // it, so look both up and down from wherever the pointer was reported to go.
  const to = e.relatedTarget
  if (
    to instanceof Element &&
    (to.closest("[data-lp-follow]") || to.querySelector("[data-lp-follow]"))
  )
    return
  clearTimeout(leaveTimer)
  active.value = -1
  endDrag()
}

const endDrag = () => {
  dragging.value = false
  window.removeEventListener("pointerup", endDrag)
  window.removeEventListener("pointercancel", endDrag)
}

const beginDrag = () => {
  dragging.value = true
  window.addEventListener("pointerup", endDrag)
  window.addEventListener("pointercancel", endDrag)
}

onBeforeUnmount(() => {
  endDrag()
  clearTimeout(leaveTimer)
  window.removeEventListener("keydown", onKeydown)
})

const clearSelection = () => {
  if (!selected.value.size) return
  selected.value = new Set()
  anchor.value = -1
  emitSelection()
}

/*
 * Escape drops the selection, the way it dismisses any transient state. Bound
 * to the window rather than the chart because a selection made with the mouse
 * leaves focus nowhere in particular — requiring the user to focus the chart
 * first would make the key useless exactly when they reach for it. Only armed
 * while something is selected, so the chart never swallows an Escape meant for
 * a dialog or a menu above it.
 */
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") clearSelection()
}

watch(
  () => selected.value.size > 0,
  (hasSelection) => {
    if (hasSelection) window.addEventListener("keydown", onKeydown)
    else window.removeEventListener("keydown", onKeydown)
  },
)

const menuPoint = ref<{ index: number; label: string; value: number; isOther: boolean } | null>(
  null,
)

const menuEntries = computed(() =>
  props.menuItems && menuPoint.value
    ? props.menuItems(menuPoint.value, [...selected.value].sort((x, y) => x - y).map(payloadFor))
    : [],
)

/*
 * A right-click on an unselected slice moves the selection to it — the menu
 * must act on what the user pointed at. Right-clicking INSIDE an existing
 * selection keeps it, so a menu can operate on all of the picked slices.
 */
const onSliceContextMenu = (i: number) => {
  if (!selected.value.has(i)) {
    selected.value = new Set([i])
    anchor.value = i
    emitSelection()
  }
  menuPoint.value = payloadFor(i)
  emit("sliceContextMenu", menuPoint.value)
}

/** The slice the centre reads out: the hovered one, else a lone selection. */
const focused = computed(() => {
  if (active.value >= 0) return active.value
  return selected.value.size === 1 ? [...selected.value][0] : -1
})

/** Unselected slices only recede once something is actually selected. */
const dimmed = (i: number) => selected.value.size > 0 && !selected.value.has(i)

const total = computed(() => resolved.value.total)

const selectedArcs = computed(() =>
  [...selected.value].sort((x, y) => x - y).map((i) => arcs.value[i]),
)

/** The slice under the pointer; null over the gaps, which disables the tip. */
const hovered = computed(() => (active.value >= 0 ? arcs.value[active.value] : null))

/* Sticky copy for the tooltip's own contents: `hovered` drops to null the
   instant the pointer leaves a slice, and reading it directly would blank the
   panel before its exit animation had run. */
const tipSlice = ref<(typeof arcs.value)[number] | null>(null)
watch(hovered, (v) => {
  if (v) tipSlice.value = v
})

/* The raw number, so the centre can COUNT to it rather than cut. */
const centreValue = computed(() => {
  if (focused.value >= 0) return arcs.value[focused.value].value
  if (selected.value.size > 1)
    return selectedArcs.value.reduce((sum, a) => sum + a.value, 0)
  return total.value
})

const centreLabel = computed(() => {
  if (focused.value >= 0) return arcs.value[focused.value].label
  if (selected.value.size > 1) return `${selected.value.size} selected`
  return "total"
})
</script>

<template>
  <div ref="revealAnchor" class="flex flex-col gap-3">
    <div v-if="title || subtitle" class="flex flex-col gap-0.5">
      <span v-if="title" class="text-sm font-medium text-ink">{{ title }}</span>
      <span v-if="subtitle" class="text-xs text-muted">{{ subtitle }}</span>
    </div>

    <div
      v-if="!hasData"
      class="flex flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line text-muted"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <LpIcon name="lucide:chart-pie" :size="18" />
      <span class="text-xs">{{ emptyLabel }}</span>
    </div>

    <!-- items-start, not items-center: an unfolded legend can be taller than
         the circle, and centring would push the circle down past it. -->
    <LpContextMenu v-else :items="menuEntries" :always="!!menuItems">
        <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
        <!--
          One tooltip for the whole circle, following the cursor, rather than one
          per slice. reka anchors a tip to an HTML box, and an SVG <path> gives
          it nothing to measure — a per-slice tip simply never positioned itself.
          Wrapping the container and reading the hovered slice gets the kit's
          themed tip while keeping it beside the wedge under the pointer.
        -->
        <!-- Disabled while no slice is under the pointer: the trigger is the
             whole canvas, so the gaps, the corners and a donut's hole would
             otherwise open an empty panel. -->
        <LpTooltip :delay="80" follow-cursor side="top" :disabled="!hovered">
          <template #content>
            <!--
              Held from the last hovered slice so the panel keeps its text
              through the closing animation instead of emptying first.

              The tip stays put while the pointer crosses from one slice to the
              next, so its text would otherwise hard-cut mid-glide: rolling the
              label and counting the figure make it read as one readout being
              updated rather than as a new tip that happens to be in the same
              place.
            -->
            <!-- Eased: the label and the figure change width as the pointer
                 crosses slices, and an unmanaged panel snaps to each new size. -->
            <LpShift v-if="tipSlice" axis="width">
              <span class="flex items-center gap-1.5">
              <span
                class="size-1.5 shrink-0 rounded-full transition-colors duration-fast"
                :style="{ backgroundColor: tipSlice.color }"
              />
              <LpRollingText
                class="text-muted-strong"
                :value="tipSlice.label"
                :duration="200"
                align="start"
              />
              <LpNumberFlow
                class="font-mono text-ink"
                :value="tipSlice.value"
                :duration="240"
                :format="fmt"
                :animate-on-mount="false"
              />
              <LpRollingText
                class="text-muted"
                :value="pct(tipSlice.fraction)"
                :duration="200"
                align="end"
              />
              </span>
            </LpShift>
          </template>
            <div
              class="relative shrink-0"
              :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
            >
            <!-- Clicking the empty middle (or the gaps) clears, so a selection can
                 be dropped without hunting for somewhere outside the chart. -->
            <svg
              :width="canvasWidth"
              :height="canvasHeight"
              class="touch-none select-none"
              @pointerleave="leaveChart"
              @pointerup="endDrag"
              @click.self="clearSelection"
            >
              <!--
                Drawing and hit-testing are SEPARATE paths, and only the drawn
                one moves.

                A wedge that lifts on hover slides out from under the very
                pointer that lifted it: the cursor lands in the gap it left, the
                hover drops, the wedge falls back, and it is under the pointer
                again — so it oscillates for as long as the mouse rests near the
                edge. Keeping the interactive copy fixed means the region being
                hovered never changes shape, and the lift is purely cosmetic.
              -->
              <defs v-if="animate">
                <clipPath :id="`${sweepId}-sweep`">
                  <path :d="sweepPath" />
                </clipPath>
              </defs>

              <!-- Only the DRAWN slices are clipped. The hit areas below stay
                   whole, so a pointer resting where the sweep has not yet
                   reached still belongs to the slice it is over rather than to
                   nothing. -->
              <g :clip-path="animate ? `url(#${sweepId}-sweep)` : undefined">
                <path
                  v-for="(a, i) in arcs"
                  :key="a.label"
                  :d="a.d"
                  :fill="a.color"
                  class="pointer-events-none transition-[transform,opacity] duration-medium ease-[var(--ease-emphasized)] motion-reduce:transition-none"
                  :transform="active === i ? a.lift : undefined"
                  :opacity="dimmed(i) ? 0.28 : 1"
                />
              </g>

              <!-- Invisible, unmoving, and on top: the actual hit area. -->
              <path
                v-for="(a, i) in arcs"
                :key="`hit-${a.label}`"
                :d="a.d"
                fill="transparent"
                class="cursor-pointer"
                @pointerenter="onSlicePointerEnter(i)"
                @pointerleave="onSlicePointerLeave(i)"
                @pointerdown="onSlicePointerDown(i, $event)"
                @contextmenu="onSliceContextMenu(i)"
              />

              <!-- Callouts. Drawn after the slices so a leader is never buried,
                   and hoverable as one unit with the slice they name. -->
              <g v-if="labels">
                <g
                  v-for="c in callouts"
                  :key="`c-${c.index}`"
                  class="cursor-pointer transition-opacity duration-fast"
                  :opacity="dimmed(c.index) ? 0.35 : 1"
                  @pointerenter="onSlicePointerEnter(c.index)"
                  @pointerleave="onSlicePointerLeave(c.index)"
                  @pointerdown="onSlicePointerDown(c.index, $event)"
                  @contextmenu="onSliceContextMenu(c.index)"
                >
                  <polyline
                    :points="c.points"
                    fill="none"
                    :stroke="arcs[c.index].color"
                    stroke-width="1"
                  />
                  <text
                    :x="c.x"
                    :y="c.y"
                    :text-anchor="c.side === 'right' ? 'start' : 'end'"
                    dominant-baseline="middle"
                    class="text-[11px]"
                    :class="active === c.index ? 'fill-[var(--color-ink)]' : 'fill-[var(--color-muted-strong)]'"
                  >
                    {{ arcs[c.index].label }}: {{ pct(arcs[c.index].fraction) }}
                  </text>
                </g>
              </g>
            </svg>

            <!-- The hole carries the headline: the hovered slice, or the total. -->
            <div
              v-if="type === 'donut' && (showTotal || $slots.center)"
              class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <slot
                name="center"
                :total="total"
                :active="focused >= 0 ? arcs[focused] : null"
                :selection="selectedArcs"
              >
                <!-- One slice in focus reads out itself; several selected read out
                     their sum, which is the question a multi-selection asks.
                     The figure counts across and the caption rolls, so moving
                     between slices reads as one readout changing rather than as
                     two unrelated labels blinking. -->
                <LpNumberFlow
                  class="font-mono text-xl font-medium text-ink"
                  :value="centreValue"
                  :duration="360"
                  :format="fmt"
                  :animate-on-mount="false"
                />
                <LpRollingText
                  class="max-w-[80%] text-[11px] text-muted"
                  :value="centreLabel"
                  :duration="260"
                />
              </slot>
            </div>
          </div>
        </LpTooltip>

        <!-- The legend is the same control surface as the circle: identical
             modifiers, and slivers too small to hit are reachable here. -->
        <div v-if="legendShown" class="flex min-w-0 flex-col gap-1.5" @pointerup="endDrag">
          <button
            v-for="(a, i) in arcs"
            :key="a.label"
            type="button"
            class="group flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-xs outline-none transition-[opacity,background-color] duration-fast focus-visible:ring-2 focus-visible:ring-ring"
            :class="[dimmed(i) ? 'opacity-45' : '', isSelected(i) ? 'bg-surface-soft' : '']"
            :aria-pressed="isSelected(i)"
            @pointerenter="onSlicePointerEnter(i)"
            @pointerleave="onSlicePointerLeave(i)"
            @pointerdown="onSlicePointerDown(i, $event)"
            @contextmenu="onSliceContextMenu(i)"
          >
            <span
              class="size-2 shrink-0 rounded-full transition-transform duration-fast group-hover:scale-125"
              :style="{ backgroundColor: a.color }"
            />
            <span class="truncate text-muted-strong group-hover:text-ink">{{ a.label }}</span>
            <!-- What the bucket stands for, so a fold is never a silent loss. -->
            <span v-if="a.isOther" class="shrink-0 text-muted">({{ a.count }})</span>
            <span class="ml-auto shrink-0 pl-2 font-mono tabular-nums text-muted">
              {{ showPercent ? pct(a.fraction) : fmt(a.value) }}
            </span>
          </button>
        </div>
      </div>
    </LpContextMenu>
  </div>
</template>
