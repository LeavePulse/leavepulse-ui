import { computed, ref, watch, type Ref } from "vue"
import { clamp } from "../composables/clamp"
import { MOUSE_SLOP } from "../composables/gesture"
import { startPointerDrag } from "../composables/pointerDrag"
import { useChartSync } from "../composables/useChartSync"
import { nodeWindow } from "../composables/useView"
import { chartSummary, nearestIndex, plotHeight, plotWidth, xAt, yAt, type Box, type NormalSeries } from "./chart"
import { CHART_CARD_W } from "./chartOverlays"
import { ZOOM_STEP, clampRange, slotOf, sourceOf, zoomRange, type ChartRange, type ChartView } from "./chartWindow"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"

/** What was under the pointer when a point was clicked or right-clicked. */
export interface ChartPointEvent {
  index: number
  label: string
  /** Every series' value at this index, in `series` order (hidden included). */
  values: (number | null)[]
  /** The original event, for callers that need modifiers or coordinates. */
  originalEvent: MouseEvent
}

interface AxisRange {
  min: number
  max: number
}

type InteractiveSeries = NormalSeries & { id: string }

/*
 * Everything LpChart does with a pointer and a keyboard: the crosshair and the
 * tooltip it carries (shared with the charts of a `syncGroup`), zooming by
 * drag, Ctrl+wheel and keys, the point a click or right-click is about, arrow
 * keys walking the points with a spoken readout.
 */
export interface ChartInteractionOptions<S extends InteractiveSeries> {
  zoomable: () => boolean
  syncGroup: () => string | undefined
  menuItems: () => ((point: ChartPointEvent) => ContextMenuItemDef[]) | undefined
  ariaLabel: () => string | undefined
  title: () => string | undefined
  /** Prefix of the keyboard readout before a point without a label. */
  pointLabel: () => string
  onPointClick: (point: ChartPointEvent) => void
  onPointContextMenu: (point: ChartPointEvent) => void
  setRange: (range: ChartRange | null) => void
  view: Ref<ChartView>
  range: Ref<ChartRange | null>
  fullLabels: Ref<string[]>
  fullCount: Ref<number>
  labels: Ref<string[]>
  allSeries: Ref<S[]>
  visible: Ref<S[]>
  count: Ref<number>
  box: Ref<Box>
  geo: Ref<{ min: number; max: number; box: Box; count: number; banded: boolean }>
  banded: Ref<boolean>
  ready: Ref<boolean>
  drawnById: Ref<ReadonlyMap<string, { values: (number | null)[] }>>
  scaleOf: (series: { axis: "left" | "right" }) => AxisRange
  fmtSeries: (series: { axis: "left" | "right" }, value: number) => string
}

const CARD_GAP = 14

export function useChartInteraction<S extends InteractiveSeries>(options: ChartInteractionOptions<S>) {
  const { view, range, fullLabels, fullCount, labels, allSeries, visible, count, box, geo, banded, ready, drawnById } = options

  // ── hover ──────────────────────────────────────
  const active = ref(-1)
  const pointer = ref({ x: 0, y: 0 })

  /* The hover of another chart in the group, as a slot of this one. */
  const { peerLabel, publish } = useChartSync(options.syncGroup)
  const labelIndex = computed(() => (options.syncGroup() ? new Map(fullLabels.value.map((label, i) => [label, i])) : null))
  const peerSlot = computed(() => {
    const source = peerLabel.value == null ? undefined : labelIndex.value?.get(peerLabel.value)
    return source === undefined ? -1 : slotOf(view.value, source)
  })
  const crosshair = computed(() => (active.value >= 0 ? active.value : peerSlot.value))
  watch(active, (slot) => publish(slot >= 0 ? (labels.value[slot] ?? null) : null))

  /* Past this many px a press on the plot is a selection, not a click. */
  let swallowClick = false
  const selection = ref<{ from: number; to: number } | null>(null)

  const onPointerDown = (e: PointerEvent) => {
    if (!options.zoomable() || e.button !== 0) return
    const el = e.currentTarget as SVGElement
    const offset = (ev: PointerEvent) => ev.clientX - el.getBoundingClientRect().left
    const pressedAt = offset(e)
    startPointerDrag(e, {
      move(ev) {
        const x = offset(ev)
        if (Math.abs(x - pressedAt) > MOUSE_SLOP) selection.value = { from: pressedAt, to: x }
      },
      end(completed) {
        const picked = selection.value
        selection.value = null
        if (!completed || !picked) return
        swallowClick = true
        const ends = [picked.from, picked.to].map((x) => sourceOf(view.value, nearestIndex(x, geo.value)))
        options.setRange(clampRange({ start: ends[0], end: ends[1] }, fullCount.value))
      },
    })
  }

  const onMove = (e: PointerEvent) => {
    keyboard.value = false
    const el = e.currentTarget as SVGElement
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    pointer.value = { x, y: e.clientY - rect.top }
    active.value = nearestIndex(x, geo.value)
  }

  const selectionBox = computed(() => {
    if (!selection.value) return null
    const right = box.value.width - box.value.right
    const [from, to] = [selection.value.from, selection.value.to].map((x) => clamp(x, box.value.left, right))
    return { x: Math.min(from, to), width: Math.abs(to - from) }
  })

  function zoomBy(factor: number, anchor: number) {
    options.setRange(zoomRange(range.value, fullCount.value, anchor, factor))
  }

  /* Plain wheel stays the page's: a chart in a dashboard must not trap scrolling. */
  const onWheel = (e: WheelEvent) => {
    if (!options.zoomable() || !e.ctrlKey || !ready.value) return
    e.preventDefault()
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    const plot = plotWidth(box.value) || 1
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, (e.clientX - rect.left - box.value.left) / plot)
  }

  const resetZoom = () => {
    if (range.value) options.setRange(null)
  }

  const onLeave = () => {
    active.value = -1
  }

  const pointEvent = (originalEvent: MouseEvent): ChartPointEvent => ({
    index: sourceOf(view.value, active.value),
    label: labels.value[active.value] ?? "",
    values: allSeries.value.map((s) => s.values[active.value] ?? null),
    originalEvent,
  })

  /* A tap fires pointerleave before click, which has already cleared the hover,
     so the index comes from the click itself. */
  const onClick = (e: MouseEvent) => {
    if (swallowClick) {
      swallowClick = false
      return
    }
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    active.value = nearestIndex(e.clientX - rect.left, geo.value)
    if (active.value < 0) return
    options.onPointClick(pointEvent(e))
  }

  /*
   * The menu itself belongs to the caller — which actions a point offers is an
   * application question. All the chart owes is WHICH point was hit, resolved
   * before the menu opens so the items can be built for it.
   *
   * A right-click can land without a preceding pointermove (touch long-press, or
   * a click straight after a scroll), so the index is resolved from this event
   * rather than trusting whatever hover left behind.
   */
  const menuPoint = ref<ChartPointEvent | null>(null)

  /* Resolved on the right-click, so the menu describes the point actually hit. */
  const menuEntries = computed(() => {
    const items = options.menuItems()
    return items && menuPoint.value ? items(menuPoint.value) : []
  })

  const onContextMenu = (e: MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    active.value = nearestIndex(e.clientX - rect.left, geo.value)
    if (active.value < 0) return
    menuPoint.value = pointEvent(e)
    options.onPointContextMenu(menuPoint.value)
  }

  const activeX = computed(() =>
    crosshair.value < 0 ? 0 : xAt(crosshair.value, count.value, box.value, banded.value),
  )

  /** Dots on the crosshair — one per visible series that has a value here. */
  const activePoints = computed(() => {
    if (crosshair.value < 0) return []
    return visible.value
      .map((s) => ({ s, v: s.values[crosshair.value] }))
      .filter((r): r is { s: S; v: number } => r.v != null)
      .map(({ s, v }) => {
        const sc = options.scaleOf(s)
        // The dot rides the curve as drawn; the figure is the reading itself.
        const at = drawnById.value.get(s.id)?.values[crosshair.value] ?? v
        return {
          color: s.color,
          id: s.id,
          name: s.name,
          value: v,
          y: yAt(at, sc.min, sc.max, box.value),
        }
      })
  })

  const tooltipRows = computed(() =>
    active.value < 0
      ? []
      : visible.value.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          text:
            s.values[active.value] == null
              ? "—"
              : options.fmtSeries(s, s.values[active.value] as number),
        })),
  )

  /*
   * x tracks the snapped crosshair (the card belongs to the point it describes),
   * y tracks the raw pointer, clamped into the plot so it can't ride off the top
   * or bottom edge.
   */
  const tooltipTarget = computed(() => {
    const flip = activeX.value > box.value.width - CHART_CARD_W
    const y = Math.min(
      Math.max(pointer.value.y, box.value.top + 8),
      box.value.top + plotHeight(box.value) - 8,
    )
    return {
      x: flip ? activeX.value - CARD_GAP : activeX.value + CARD_GAP,
      y,
      flip,
    }
  })

  // ── keyboard & assistive text ──────────────────
  const summary = computed(
    () => options.ariaLabel() ?? chartSummary(visible.value, labels.value, options.fmtSeries, options.title()),
  )

  /* Arrow keys walk the points the way the pointer does; the readout below is
     announced politely so each step is heard without stealing focus. */
  const keyboard = ref(false)

  const onKeydown = (e: KeyboardEvent) => {
    if (!count.value || !ready.value) return
    const last = count.value - 1
    let next: number
    switch (e.key) {
      case "ArrowRight":
        next = active.value < 0 ? 0 : Math.min(last, active.value + 1)
        break
      case "ArrowLeft":
        next = active.value < 0 ? last : Math.max(0, active.value - 1)
        break
      case "Home":
        next = 0
        break
      case "End":
        next = last
        break
      case "Enter":
      case " ":
        if (active.value < 0) return
        e.preventDefault()
        options.onPointClick(pointEvent(new (nodeWindow(e.target as Node).MouseEvent)("click")))
        return
      case "Escape":
        active.value = -1
        return
      case "+":
      case "=":
      case "-":
        if (!options.zoomable()) return
        e.preventDefault()
        zoomBy(e.key === "-" ? 1 / ZOOM_STEP : ZOOM_STEP, active.value < 0 ? 0.5 : active.value / last)
        return
      case "0":
        if (!options.zoomable()) return
        e.preventDefault()
        resetZoom()
        return
      default:
        return
    }
    e.preventDefault()
    keyboard.value = true
    active.value = next
    const first = activePoints.value[0]
    pointer.value = {
      x: activeX.value,
      y: first ? first.y : box.value.top + plotHeight(box.value) / 2,
    }
  }

  const onBlur = () => {
    if (keyboard.value) active.value = -1
    keyboard.value = false
  }

  const readout = computed(() =>
    keyboard.value && active.value >= 0
      ? `${labels.value[active.value] ?? `${options.pointLabel()} ${active.value + 1}`}: ${tooltipRows.value
          .map((r) => `${r.name} ${r.text}`)
          .join(", ")}`
      : "",
  )

  return {
    active,
    crosshair,
    selectionBox,
    menuEntries,
    activeX,
    activePoints,
    tooltipRows,
    tooltipTarget,
    summary,
    readout,
    onPointerDown,
    onMove,
    onWheel,
    onLeave,
    onClick,
    onContextMenu,
    onKeydown,
    onBlur,
    resetZoom,
  }
}
