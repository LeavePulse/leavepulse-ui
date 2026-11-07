import { computed, inject, provide, ref, shallowRef, toValue, watch, type InjectionKey, type MaybeRefOrGetter, type Ref, type ShallowRef } from "vue"
import type { ChartAnnotation } from "../components/chart"
import type { ChartRange } from "../components/chartWindow"
import { inTimeRange, nearestByTime, type LogId, type LogTimeRange } from "../components/logTools"
import { stepKey, type PipelineStep } from "../components/pipeline"

/*
 * What a monitoring screen shares: which thing is selected, which stretch of
 * time is on show, which request is being followed. The table, the graph, the
 * log and the chart each keep their own API; a `link*` binder turns this state
 * into the props and listeners of one of them, for `v-bind`:
 *
 *   const view = provideLinkedView()
 *   const table = linkTable(view, { kind: "server" })
 *   const log = linkLog(view, { kind: "server" })
 *
 *   <LpTable v-bind="table" :rows row-key="id" selectable />
 *   <LpLogViewer v-bind="log" :lines selectable />
 *
 * Set a kind when a screen holds several sorts of thing: a binder only answers
 * to its own, so picking a deployment leaves the server graph where it was.
 */
export type LinkedId = string | number

export interface LinkedEntity {
  id: LinkedId
  kind?: string
}

/** A point of interest on the shared timeline, such as a log line. */
export interface LinkedMoment {
  time: number | string
  label: string
}

export interface LinkedView {
  entity: ShallowRef<LinkedEntity | null>
  timeRange: ShallowRef<LogTimeRange | null>
  moment: ShallowRef<LinkedMoment | null>
  traceId: Ref<string | null>
  select(entity: LinkedEntity | null): void
  clear(): void
}

export function createLinkedView(): LinkedView {
  const entity = shallowRef<LinkedEntity | null>(null)
  const timeRange = shallowRef<LogTimeRange | null>(null)
  const moment = shallowRef<LinkedMoment | null>(null)
  const traceId = ref<string | null>(null)
  return {
    entity,
    timeRange,
    moment,
    traceId,
    // The same thing again is no change, so a binder echoing a selection back
    // (a focused node reports itself selected) cannot start a loop.
    select(next) {
      const now = entity.value
      if (next?.id !== now?.id || next?.kind !== now?.kind) entity.value = next
    },
    clear() {
      entity.value = null
      timeRange.value = null
      moment.value = null
      traceId.value = null
    },
  }
}

const LP_LINKED_VIEW: InjectionKey<LinkedView> = Symbol.for("lp-linked-view")

/** Shares a view with everything below the calling component. */
export function provideLinkedView(view: LinkedView = createLinkedView()): LinkedView {
  provide(LP_LINKED_VIEW, view)
  return view
}

/** The view provided above; a private one with none, so a panel works alone. */
export function useLinkedView(): LinkedView {
  return inject(LP_LINKED_VIEW, null) ?? createLinkedView()
}

interface LinkOptions {
  /** The sort of entity this component shows. Unset answers to any. */
  kind?: string
}

const answersTo = (entity: LinkedEntity | null, kind: string | undefined): entity is LinkedEntity =>
  !!entity && (kind === undefined || entity.kind === kind)

/** v-bind for LpTable: single selection, whatever the table's `selected` held before. */
export function linkTable(view: LinkedView, options: LinkOptions = {}) {
  return computed(() => {
    const entity = view.entity.value
    const current = answersTo(entity, options.kind) ? entity.id : null
    return {
      selected: current === null ? [] : [current],
      "onUpdate:selected": (keys: LinkedId[]) => {
        const picked = keys.find((key) => key !== current) ?? keys[0]
        view.select(picked === undefined ? null : { id: picked, kind: options.kind })
      },
    }
  })
}

/** What linkTopology drives: LpTopologyCanvas's exposed `focusNode`. */
export interface LinkedCanvas {
  focusNode(id: string, options?: { keepFocus?: boolean }): Promise<boolean>
}

/** v-bind for LpTopologyCanvas; `canvas` is its template ref, focused on a selection from elsewhere. */
export function linkTopology(view: LinkedView, canvas: Ref<LinkedCanvas | null>, options: LinkOptions = {}) {
  watch(
    view.entity,
    (entity) => {
      if (answersTo(entity, options.kind)) void canvas.value?.focusNode(String(entity.id), { keepFocus: true })
    },
    { flush: "post" },
  )
  return computed(() => ({
    onNodeSelect: (id: string) => view.select({ id, kind: options.kind }),
  }))
}

export interface LinkLogOptions extends LinkOptions {
  /** The log sources of an entity. Defaults to its id. */
  sourcesOf?: (entity: LinkedEntity) => string[]
}

/**
 * v-bind for LpLogViewer. The filters the selection and the trace set stay
 * local, so the viewer's own chips and search box go on working; typing over a
 * followed trace stops following it. Picking a line marks it on the timeline.
 */
export function linkLog(view: LinkedView, options: LinkLogOptions = {}) {
  const sourcesOf = options.sourcesOf ?? ((entity: LinkedEntity) => [String(entity.id)])
  const sources = shallowRef<string[]>([])
  const search = ref("")
  watch(view.entity, (entity) => (sources.value = answersTo(entity, options.kind) ? sourcesOf(entity) : []))
  watch(view.traceId, (id, old) => {
    if (id !== null) search.value = id
    else if (search.value === old) search.value = ""
  })
  return computed(() => ({
    sources: sources.value,
    search: search.value,
    // A viewer with no toolbar reads its term from here instead.
    highlight: search.value,
    // A search only marks its hits; a followed trace is meant to leave just its lines.
    filterMatches: view.traceId.value !== null,
    timeRange: view.timeRange.value ?? undefined,
    "onUpdate:sources": (next: string[]) => (sources.value = next),
    "onUpdate:search": (next: string) => {
      search.value = next
      if (next !== view.traceId.value) view.traceId.value = null
    },
    onSelect: ({ line }: { line: { time?: number | string; message: string } }) => {
      view.moment.value = line.time === undefined ? null : { time: line.time, label: line.message }
    },
    onIdClick: ({ value }: { kind: LogId["kind"]; value: string }) => (view.traceId.value = value),
  }))
}

export interface LinkChartOptions {
  /** The time of each point, oldest first, in step with the chart's `labels`. */
  times: MaybeRefOrGetter<readonly (number | string)[]>
  /** The chart's own annotations, kept beside the linked one. */
  annotations?: MaybeRefOrGetter<readonly ChartAnnotation[] | undefined>
}

/** v-bind for LpChart: the shared time range is its window, the marked moment an annotation. */
export function linkChart(view: LinkedView, options: LinkChartOptions) {
  const rows = computed(() => toValue(options.times).map((time) => ({ time })))
  return computed(() => {
    const times = toValue(options.times)
    const last = times.length - 1
    const shared = view.timeRange.value
    const moment = view.moment.value
    const onChart = !!moment && last >= 0 && inTimeRange(moment.time, { from: times[0], to: times[last] })
    const range: ChartRange | null = shared && last >= 0
      ? {
          start: shared.from === undefined ? 0 : Math.max(0, nearestByTime(rows.value, shared.from)),
          end: shared.to === undefined ? last : Math.max(0, nearestByTime(rows.value, shared.to)),
        }
      : null
    return {
      range,
      annotations: [
        ...(toValue(options.annotations) ?? []),
        ...(onChart ? [{ at: nearestByTime(rows.value, moment.time), label: moment.label }] : []),
      ],
      "onUpdate:range": (next: ChartRange | null) => {
        view.timeRange.value = next && { from: times[next.start], to: times[next.end] }
      },
    }
  })
}

export interface LinkPipelineOptions extends LinkOptions {
  /** The steps on show; a getter, as they usually follow the selection. */
  steps: MaybeRefOrGetter<readonly PipelineStep[]>
}

/** v-bind for LpPipeline: selecting opens what failed, and the rows stay the reader's to toggle. */
export function linkPipeline(view: LinkedView, options: LinkPipelineOptions) {
  const expanded = shallowRef<string[]>([])
  const failedKeys = (): string[] =>
    toValue(options.steps).flatMap((step, index) => (step.status === "failed" ? [stepKey(step, index)] : []))
  watch(
    [view.entity, () => failedKeys().join("\0")],
    ([entity]) => {
      if (!answersTo(entity, options.kind)) return
      expanded.value = [...new Set([...expanded.value, ...failedKeys()])]
    },
    { flush: "post" },
  )
  return computed(() => ({
    expanded: expanded.value,
    "onUpdate:expanded": (next: string[]) => (expanded.value = next),
  }))
}

