<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Pick a stretch of a video, and optionally a rectangle on its picture, for a
 * server to cut (ffmpeg) or blur. Nothing is cut here: the component reports
 * `[start, end]` in seconds and a region in fractions of the frame.
 *
 *   <LpVideoTrim v-model:range="range" :src="url" :max-clip="60" @change="save" />
 *
 * - The video plays from its address the way a <video> does: by range
 *   requests, never downloaded whole, so an hour or a gigabyte costs what is
 *   watched. A same-origin address keeps the session cookie (no `crossorigin`
 *   is set: it would drop it), and the timeline's stills need no CORS either.
 * - The timeline zooms (wheel, pinch, the buttons) down to a few seconds
 *   across, so an hour-long recording still trims to the frame; when zoomed, a
 *   thin overview under it shows and moves the visible part.
 * - Keys, wherever focus is inside: Space plays, ←/→ step a frame (Shift: a
 *   second), I and O set the start and end at the playhead. On a focused
 *   handle the arrows move that handle.
 * - `update:range` follows every move; `change` fires once a move is done (a
 *   handle let go, a key, a typed time), for the save.
 * - `maxClip` and `minClip` bound the length: a dragged handle stops at the
 *   limit, while I, O and a typed time move the other end along.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { isHTMLElement } from "../composables/realm"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useResizeObserver } from "../composables/useResizeObserver"
import { usePrefersReducedMotion } from "../composables/useReducedMotion"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"
import { formatClipTime } from "./videoBackdrop"
import { FrameSampler, stillSpan } from "./videoFrames"
import {
  adjustRegion,
  containRect,
  dragEnd,
  mediaErrorCause,
  normalizeRange,
  parseClipTime,
  regionBetween,
  revealTime,
  setEnd,
  shiftView,
  tickStep,
  ticks,
  zoomView,
  type FrameRegion,
  type RegionHandle,
  type TimeRange,
  type TimeView,
  type VideoTrimErrorCause,
} from "./videoTrim"

const props = withDefaults(
  defineProps<{
    src: string
    poster?: string
    /** `[start, end]` in seconds; the whole video (or the first `maxClip`) when unset. */
    range?: TimeRange | null
    /** The longest clip allowed, in seconds (a chat's upload limit). */
    maxClip?: number
    /** The shortest clip allowed, in seconds. */
    minClip?: number
    /** Lets a rectangle be drawn on the picture (`v-model:region`), for a part to blur. */
    regionSelect?: boolean
    /** The marked rectangle, fractions of the frame (0..1); null when none. */
    region?: FrameRegion | null
    /** Frames per second, for the size of a frame step. */
    frameRate?: number
    disabled?: boolean
    labels?: Partial<Record<
      | "play" | "pause" | "stepBack" | "stepForward" | "mute" | "unmute" | "zoomIn" | "zoomOut" | "zoomFit"
      | "start" | "end" | "position" | "length" | "left" | "overview" | "timeline"
      | "region" | "regionHint" | "regionClear" | "failed" | "unsupported" | "invalidTime",
      string
    >>
  }>(),
  { poster: undefined, range: undefined, maxClip: undefined, minClip: 0.1, region: null, frameRate: 30, labels: () => ({}) },
)

const emit = defineEmits<{
  (e: "update:range", value: TimeRange): void
  /** The range after a finished move: a handle let go, a key, a typed time. */
  (e: "change", value: TimeRange): void
  (e: "update:region", value: FrameRegion | null): void
  (e: "error", error: { cause: VideoTrimErrorCause; message: string }): void
}>()

const text = useLabels(
  "videoTrim",
  {
    play: "Play",
    pause: "Pause",
    stepBack: "Previous frame",
    stepForward: "Next frame",
    mute: "Mute",
    unmute: "Unmute",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomFit: "Show whole video",
    start: "Start",
    end: "End",
    position: "Position",
    length: "Length",
    /** `{left}` and `{max}` are replaced by times. */
    left: "{left} left of {max}",
    overview: "Visible part of the timeline",
    timeline: "Timeline — Space plays, arrows step, I and O set start and end",
    region: "Marked area — arrows move it, Shift+arrows resize, Delete removes",
    regionHint: "Drag on the picture to mark an area",
    regionClear: "Remove area",
    failed: "This video couldn't be loaded.",
    unsupported: "This browser can't play this video's format.",
    invalidTime: "Type a time like 1:05.5",
  },
  () => props.labels,
)

const { class: rootClass, attrs: rest } = useMergedAttrs("flex flex-col gap-3 select-none")
const reduced = usePrefersReducedMotion()

const videoEl = ref<HTMLVideoElement | null>(null)
const samplerEl = ref<HTMLVideoElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const trackEl = ref<HTMLElement | null>(null)

const duration = ref(0)
const failure = ref<VideoTrimErrorCause | null>(null)
const time = ref(0)
const playing = ref(false)
const muted = ref(false)
const videoSize = ref({ width: 0, height: 0 })
const stageSize = ref({ width: 0, height: 0 })
const trackWidth = ref(0)
const ready = computed(() => duration.value > 0 && !failure.value)
const off = computed(() => props.disabled || !ready.value)

const limits = computed(() => ({
  duration: duration.value,
  minClip: Math.max(0, props.minClip ?? 0),
  maxClip: props.maxClip && props.maxClip > 0 ? props.maxClip : Infinity,
}))

/* ---------- range ---------- */

const local = ref<TimeRange>([0, 0])
/** Which handle a pointer holds, so the prop echoing back mid-drag does not fight it. */
const dragging = ref<0 | 1 | null>(null)

const same = (a: TimeRange | null | undefined, b: TimeRange) => !!a && a[0] === b[0] && a[1] === b[1]

watch(
  [() => props.range, limits],
  () => {
    if (dragging.value !== null || !duration.value) return
    const next = normalizeRange(props.range, limits.value)
    local.value = next
    // An unset or impossible range is replaced by the one the editor shows, so the model never disagrees with it.
    if (!same(props.range, next)) emit("update:range", next)
  },
  { deep: true },
)

function put(next: TimeRange, commit: boolean) {
  const changed = !same(local.value, next)
  local.value = next
  if (changed) emit("update:range", next)
  if (commit) emit("change", next)
}

const clipLength = computed(() => local.value[1] - local.value[0])

/* ---------- media ---------- */

let seekTarget: number | null = null
let seekBusy = false
/*
 * One seek at a time, the latest wins: a drag asks for a position each pointer
 * move, and WebKitGTK's pipeline stalls on a seek started inside another.
 */
function seek(t: number) {
  const video = videoEl.value
  const target = Math.min(Math.max(0, t), duration.value || t)
  time.value = target
  if (!video) return
  if (seekBusy) {
    seekTarget = target
    return
  }
  seekBusy = true
  video.currentTime = target
}
function onSeeked() {
  seekBusy = false
  if (seekTarget !== null) {
    const next = seekTarget
    seekTarget = null
    seek(next)
  } else if (videoEl.value && !playing.value) time.value = videoEl.value.currentTime
}

let probingDuration = false
function onMetadata() {
  const video = videoEl.value
  if (!video) return
  videoSize.value = { width: video.videoWidth, height: video.videoHeight }
  if (Number.isFinite(video.duration)) {
    duration.value = video.duration
    return
  }
  // A MediaRecorder WebM carries no duration until its end has been seen: seek far past it once to learn it.
  probingDuration = true
  video.currentTime = 1e101
}
function onDurationChange() {
  const video = videoEl.value
  if (!video || !Number.isFinite(video.duration) || !video.duration) return
  duration.value = video.duration
  if (probingDuration) {
    probingDuration = false
    video.currentTime = 0
  }
}
async function onError() {
  const video = videoEl.value
  if (!video?.error) return
  const src = props.src
  let cause = mediaErrorCause(video.error)
  // Chromium answers a 404, or a login page served in place of an expired session's video, with "format not supported" too.
  if (cause === "unsupported") cause = await probeSource(src)
  if (src !== props.src) return
  failure.value = cause
  emit("error", { cause, message: cause === "unsupported" ? text.value.unsupported : text.value.failed })
}
/* One byte of the address: whether it answers with media at all. Unknown (another origin without CORS) stays "unsupported". */
async function probeSource(src: string): Promise<VideoTrimErrorCause> {
  try {
    const res = await fetch(src, { headers: { Range: "bytes=0-0" }, credentials: "same-origin" })
    void res.body?.cancel()
    const type = res.headers.get("content-type") ?? ""
    return res.ok && !/^text\/|json|xml/.test(type) ? "unsupported" : "load"
  } catch {
    return "unsupported"
  }
}

/** Playback that began inside the range ends at its end, so Play previews the clip. */
let stopAtEnd = false
let frame = 0
function tick() {
  frame = 0
  const video = videoEl.value
  if (!video || !playing.value) return
  time.value = video.currentTime
  if (stopAtEnd && video.currentTime >= local.value[1]) {
    video.pause()
    seek(local.value[1])
    return
  }
  if (zoomed.value) view.value = revealTime(view.value, time.value, duration.value, 0.05)
  frame = requestAnimationFrame(tick)
}
function onPlay() {
  playing.value = true
  if (!frame) frame = requestAnimationFrame(tick)
}
function onPause() {
  playing.value = false
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  if (videoEl.value && !seekBusy) time.value = videoEl.value.currentTime
}

function togglePlay() {
  const video = videoEl.value
  if (!video || off.value) return
  if (!video.paused) {
    video.pause()
    return
  }
  const [a, b] = local.value
  let from = time.value
  if (from >= b - 1e-3 && from <= b + 1e-3) from = a
  stopAtEnd = from >= a - 1e-3 && from < b
  if (from !== time.value) seek(from)
  void video.play().catch(() => {})
}
function pause() {
  videoEl.value?.pause()
}
function step(seconds: number) {
  if (off.value) return
  pause()
  seek(time.value + seconds)
  if (zoomed.value) view.value = revealTime(view.value, time.value, duration.value)
}
function toggleMute() {
  muted.value = !muted.value
  if (videoEl.value) videoEl.value.muted = muted.value
}

const frameStep = computed(() => 1 / Math.max(1, props.frameRate))

/* ---------- timeline view ---------- */

/* The narrowest view: a couple of seconds across still leaves frames a few pixels apart. */
const MIN_SPAN = 2
const view = ref<TimeView>({ start: 0, end: 0 })
const span = computed(() => Math.max(1e-6, view.value.end - view.value.start))
const zoomed = computed(() => duration.value > 0 && span.value < duration.value - 1e-6)
const canZoomIn = computed(() => span.value > Math.min(MIN_SPAN, duration.value) + 1e-6)

watch(duration, (d) => {
  view.value = { start: 0, end: d }
})

const xOf = (t: number) => ((t - view.value.start) / span.value) * trackWidth.value
const pct = (t: number) => `${((t - view.value.start) / span.value) * 100}%`
function timeAt(clientX: number): number {
  const box = trackEl.value?.getBoundingClientRect()
  if (!box || !box.width) return 0
  return view.value.start + ((clientX - box.left) / box.width) * span.value
}

function zoomBy(factor: number, anchor = time.value) {
  if (!duration.value) return
  view.value = zoomView(view.value, anchor, factor, duration.value, MIN_SPAN)
}
function fit() {
  view.value = { start: 0, end: duration.value }
}

function onWheel(event: WheelEvent) {
  if (!ready.value) return
  const dx = event.shiftKey ? event.deltaY : event.deltaX
  // A sideways scroll (or Shift+wheel) pans; an upright one, and a pinch on a touchpad, zooms.
  if (Math.abs(dx) > Math.abs(event.deltaY) || event.shiftKey) {
    if (!zoomed.value) return
    event.preventDefault()
    view.value = shiftView(view.value, (dx / Math.max(1, trackWidth.value)) * span.value, duration.value)
    return
  }
  event.preventDefault()
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
  zoomBy(Math.exp((-event.deltaY * unit) / (event.ctrlKey ? 100 : 300)), timeAt(event.clientX))
}

const marks = computed(() => (ready.value ? ticks(view.value, tickStep(span.value, trackWidth.value)) : []))
const markDigits = computed(() => tickStep(span.value, trackWidth.value) < 1)

/* ---------- timeline pointers ---------- */

const pointers = new Map<number, number>()
let pinch: { distance: number; anchor: number } | null = null
let edgeFrame = 0
let lastX = 0
let scrubbing = false

function onHandleDown(end: 0 | 1, event: PointerEvent) {
  if (off.value || event.button !== 0) return
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
  pause()
  dragging.value = end
  lastX = event.clientX
  startPointerDrag(event, {
    cursor: "ew-resize",
    move: (e) => {
      lastX = e.clientX
      moveHandle()
      edgeScroll()
    },
    end: () => {
      dragging.value = null
      if (edgeFrame) cancelAnimationFrame(edgeFrame)
      edgeFrame = 0
      emit("change", local.value)
    },
  })
}
function moveHandle() {
  const end = dragging.value
  if (end === null) return
  const next = dragEnd(local.value, end, timeAt(lastX), limits.value)
  put(next, false)
  // The picture shows the frame being cut at.
  seek(next[end])
}
/* Held past either edge of a zoomed timeline, the view travels, faster the further out. */
function edgeScroll() {
  if (edgeFrame || !zoomed.value) return
  const box = trackEl.value?.getBoundingClientRect()
  if (!box) return
  const over = lastX < box.left ? lastX - box.left : lastX > box.right ? lastX - box.right : 0
  if (!over || (dragging.value === null && !scrubbing)) return
  edgeFrame = requestAnimationFrame(() => {
    edgeFrame = 0
    view.value = shiftView(view.value, (Math.max(-60, Math.min(60, over)) / 6 / Math.max(1, box.width)) * span.value, duration.value)
    if (dragging.value !== null) moveHandle()
    else seek(timeAt(lastX))
    edgeScroll()
  })
}

function onTrackDown(event: PointerEvent) {
  if (off.value || (event.pointerType === "mouse" && event.button !== 0)) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, event.clientX)
  if (pointers.size === 2) {
    scrubbing = false
    const [a, b] = [...pointers.values()] as [number, number]
    pinch = { distance: Math.max(8, Math.abs(a - b)), anchor: timeAt((a + b) / 2) }
    return
  }
  if (pointers.size > 2) return
  event.preventDefault()
  trackEl.value?.querySelector<HTMLElement>("[data-lp-playhead]")?.focus({ preventScroll: true })
  pause()
  scrubbing = true
  lastX = event.clientX
  seek(timeAt(event.clientX))
}
function onTrackMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, event.clientX)
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()] as [number, number]
    const distance = Math.max(8, Math.abs(a - b))
    zoomBy(distance / pinch.distance, pinch.anchor)
    pinch.distance = distance
    return
  }
  if (!scrubbing) return
  lastX = event.clientX
  seek(timeAt(event.clientX))
  edgeScroll()
}
function onTrackUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) pinch = null
  if (!pointers.size) scrubbing = false
}

/* The overview: press or drag to centre the view there. */
function onOverviewDown(event: PointerEvent) {
  if (off.value || event.button !== 0) return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const centreAt = (clientX: number) => {
    const centre = ((clientX - box.left) / Math.max(1, box.width)) * duration.value
    view.value = shiftView(view.value, centre - (view.value.start + view.value.end) / 2, duration.value)
  }
  centreAt(event.clientX)
  startPointerDrag(event, { move: (e) => centreAt(e.clientX), end: () => {} })
}

/* ---------- stills ---------- */

const STILL_HEIGHT = 56
const stillWidth = computed(() => {
  const { width, height } = videoSize.value
  return Math.round(Math.min(160, Math.max(40, width && height ? (STILL_HEIGHT * width) / height : STILL_HEIGHT * (16 / 9))))
})
const stillSeconds = computed(() => stillSpan(span.value / Math.max(1, trackWidth.value), stillWidth.value))
const stills = computed(() => {
  if (!ready.value || !trackWidth.value) return []
  const step = stillSeconds.value
  const first = Math.floor(view.value.start / step)
  const last = Math.min(Math.ceil(view.value.end / step), Math.ceil(duration.value / step))
  const out: { key: string; time: number; left: string; width: string }[] = []
  for (let k = first; k < last && out.length < 200; k++) {
    out.push({ key: `${step}:${k}`, time: Math.min(duration.value, k * step + step / 2), left: pct(k * step), width: `${(step / span.value) * 100}%` })
  }
  return out
})
const frames = shallowRef(new Map<string, HTMLCanvasElement>())
let sampler: FrameSampler | null = null
let stillTimer: ReturnType<typeof setTimeout> | undefined

watch(stills, (list) => {
  clearTimeout(stillTimer)
  // Wait for a zoom or a pan to come to rest before asking for stills of a view that may be gone in a moment.
  stillTimer = setTimeout(() => {
    if (!sampler) return
    const centre = (view.value.start + view.value.end) / 2
    sampler.want([...list].sort((a, b) => Math.abs(a.time - centre) - Math.abs(b.time - centre)))
  }, 120)
})

function mountFrame(key: string, el: Element | null) {
  if (!isHTMLElement(el)) return
  const canvas = frames.value.get(key) ?? sampler?.cached(key)
  if (canvas && canvas.parentElement !== el) el.replaceChildren(canvas)
}

/* ---------- region ---------- */

const picture = computed(() => containRect(stageSize.value.width, stageSize.value.height, videoSize.value.width, videoSize.value.height))
const draft = ref<FrameRegion | null>(null)
const shownRegion = computed(() => draft.value ?? props.region ?? null)

function fractionAt(event: PointerEvent) {
  const box = stageEl.value?.getBoundingClientRect()
  const p = picture.value
  if (!box || !p.width || !p.height) return { x: 0, y: 0 }
  return { x: (event.clientX - box.left - p.x) / p.width, y: (event.clientY - box.top - p.y) / p.height }
}
function onRegionDown(handle: RegionHandle | "draw", event: PointerEvent) {
  if (props.disabled || !props.regionSelect || (event.pointerType === "mouse" && event.button !== 0)) return
  event.stopPropagation()
  pause()
  const start = fractionAt(event)
  const from = props.region ?? null
  startPointerDrag(event, {
    move: (e) => {
      const at = fractionAt(e)
      draft.value = handle === "draw" || !from ? regionBetween(start.x, start.y, at.x, at.y) : adjustRegion(from, handle, at.x - start.x, at.y - start.y)
    },
    end: (completed) => {
      const next = draft.value
      draft.value = null
      // A press without a drag is not a region: a stray click must not leave a sliver to blur.
      if (!completed || !next || (handle === "draw" && (next.w < 0.01 || next.h < 0.01))) return
      emit("update:region", next)
    },
  })
}
function onRegionKey(event: KeyboardEvent) {
  const r = props.region
  if (!r || props.disabled) return
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault()
    emit("update:region", null)
    return
  }
  const d = event.altKey ? 0.002 : 0.01
  const moves: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  event.stopPropagation()
  emit("update:region", adjustRegion(r, event.shiftKey ? "se" : "move", move[0], move[1]))
}

/* ---------- keys ---------- */

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || target.closest("input, textarea, select, [contenteditable='true']")) return
  const handle = target.dataset.lpHandle
  const end = handle === "0" ? 0 : handle === "1" ? 1 : null
  const big = event.shiftKey ? 1 : frameStep.value
  const delta: Record<string, number> = { ArrowLeft: -big, ArrowRight: big, ArrowDown: -big, ArrowUp: big, PageDown: -10, PageUp: 10 }
  if (event.key === " " && target.tagName !== "BUTTON") {
    event.preventDefault()
    togglePlay()
  } else if (event.key in delta || event.key === "Home" || event.key === "End") {
    if (off.value) return
    event.preventDefault()
    if (end !== null) {
      const from = local.value[end]
      const to = event.key === "Home" ? 0 : event.key === "End" ? duration.value : from + delta[event.key]!
      const next = dragEnd(local.value, end, to, limits.value)
      put(next, true)
      pause()
      seek(next[end])
    } else if (event.key === "Home" || event.key === "End") {
      pause()
      seek(event.key === "Home" ? 0 : duration.value)
    } else step(delta[event.key]!)
    if (zoomed.value) view.value = revealTime(view.value, time.value, duration.value)
  } else if ((event.key === "i" || event.key === "I" || event.key === "o" || event.key === "O") && !event.altKey) {
    if (off.value) return
    event.preventDefault()
    put(setEnd(local.value, event.key.toLowerCase() === "i" ? 0 : 1, time.value, limits.value), true)
  }
}

/* ---------- typed times ---------- */

const drafts = ref<[string | null, string | null]>([null, null])
const invalid = ref<[boolean, boolean]>([false, false])
const fieldText = (end: 0 | 1) => drafts.value[end] ?? formatClipTime(local.value[end], true)
function onFieldInput(end: 0 | 1, value: string) {
  drafts.value[end] = value
  invalid.value[end] = false
}
function commitField(end: 0 | 1) {
  const typed = drafts.value[end]
  if (typed === null) return
  const t = parseClipTime(typed)
  if (t === null) {
    invalid.value[end] = true
    return
  }
  drafts.value[end] = null
  put(setEnd(local.value, end, t, limits.value), true)
  seek(local.value[end])
  if (zoomed.value) view.value = revealTime(view.value, local.value[end], duration.value)
}
function revertField(end: 0 | 1) {
  drafts.value[end] = null
  invalid.value[end] = false
}

/* ---------- mount ---------- */

useResizeObserver(trackEl, (_, el) => (trackWidth.value = (el as HTMLElement).clientWidth), { immediate: true })
useResizeObserver(stageEl, (_, el) => (stageSize.value = { width: (el as HTMLElement).clientWidth, height: (el as HTMLElement).clientHeight }), { immediate: true })

function startSampler() {
  sampler?.dispose()
  sampler = samplerEl.value
    ? new FrameSampler(samplerEl.value, () => ({ width: stillWidth.value, height: STILL_HEIGHT }), (key, canvas) => {
        const next = new Map(frames.value)
        next.set(key, canvas)
        if (next.size > 240) next.delete(next.keys().next().value as string)
        frames.value = next
      })
    : null
}

watch(
  () => props.src,
  () => {
    duration.value = 0
    failure.value = null
    time.value = 0
    frames.value = new Map()
    seekBusy = false
    seekTarget = null
    void nextTick(startSampler)
  },
)

onMounted(startSampler)
onBeforeUnmount(() => {
  sampler?.dispose()
  clearTimeout(stillTimer)
  if (frame) cancelAnimationFrame(frame)
  if (edgeFrame) cancelAnimationFrame(edgeFrame)
  // Stop both streams from fetching on: an element that is merely detached keeps its connection.
  for (const el of [videoEl.value, samplerEl.value]) {
    if (!el) continue
    el.pause()
    el.removeAttribute("src")
    el.load()
  }
})

defineExpose({
  play: () => (videoEl.value?.paused ? togglePlay() : undefined),
  pause,
  seek,
  /** The playhead, in seconds. */
  currentTime: () => time.value,
})

const handleText = (t: number) => formatClipTime(t, true)
const leftText = computed(() =>
  Number.isFinite(limits.value.maxClip)
    ? text.value.left
        .replace("{left}", formatClipTime(Math.max(0, limits.value.maxClip - clipLength.value), true))
        .replace("{max}", formatClipTime(limits.value.maxClip, true))
    : "",
)
</script>

<template>
  <div :class="rootClass" v-bind="rest" :data-disabled="disabled || undefined" @keydown="onKeydown">
    <!-- The picture. Its own controls are off: the region is drawn on it, and the keys are the editor's. -->
    <div
      ref="stageEl"
      class="relative aspect-video w-full overflow-hidden rounded-card bg-black"
    >
      <video
        ref="videoEl"
        class="absolute inset-0 size-full object-contain"
        :src="src"
        :poster="poster"
        preload="metadata"
        playsinline
        :muted="muted"
        @loadedmetadata="onMetadata"
        @durationchange="onDurationChange"
        @seeked="onSeeked"
        @play="onPlay"
        @pause="onPause"
        @error="onError"
        @click="!regionSelect && togglePlay()"
      />
      <!-- Stills come from a second element: seeking this one would move the picture under the person. -->
      <video
        ref="samplerEl"
        class="pointer-events-none absolute size-px opacity-0"
        :src="src"
        preload="metadata"
        muted
        playsinline
        aria-hidden="true"
        tabindex="-1"
      />
      <div
        v-if="regionSelect && ready"
        class="absolute cursor-crosshair touch-none"
        :style="{ left: `${picture.x}px`, top: `${picture.y}px`, width: `${picture.width}px`, height: `${picture.height}px` }"
        data-lp-region-layer
        @pointerdown="onRegionDown('draw', $event)"
      >
        <div
          v-if="shownRegion"
          class="absolute cursor-move rounded-inner border-2 border-dashed border-white bg-brand/25 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :style="{ left: `${shownRegion.x * 100}%`, top: `${shownRegion.y * 100}%`, width: `${shownRegion.w * 100}%`, height: `${shownRegion.h * 100}%` }"
          tabindex="0"
          role="group"
          :aria-label="text.region"
          data-lp-region
          @pointerdown="onRegionDown('move', $event)"
          @keydown="onRegionKey"
        >
          <span
            v-for="corner in (['nw', 'ne', 'sw', 'se'] as const)"
            :key="corner"
            class="absolute grid size-6 place-items-center pointer-coarse:size-11"
            :class="[
              corner[0] === 'n' ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2',
              corner[1] === 'w' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
              corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
            ]"
            :data-lp-corner="corner"
            @pointerdown="onRegionDown(corner, $event)"
          >
            <span class="size-3 rounded-pill border-2 border-white bg-brand shadow" />
          </span>
        </div>
      </div>
      <div
        v-if="failure"
        role="alert"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/80"
      >
        <LpIcon name="lucide:video-off" :size="32" />
        <p>{{ failure === "unsupported" ? text.unsupported : text.failed }}</p>
      </div>
    </div>

    <!-- Transport and zoom. -->
    <div class="flex flex-wrap items-center gap-1">
      <LpButton size="sm" variant="ghost" square :disabled="off" :aria-label="playing ? text.pause : text.play" :title="playing ? text.pause : text.play" @click="togglePlay">
        <LpIcon :name="playing ? 'lucide:pause' : 'lucide:play'" :size="16" />
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off" :aria-label="text.stepBack" :title="text.stepBack" @click="step(-frameStep)">
        <LpIcon name="lucide:step-back" :size="16" />
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off" :aria-label="text.stepForward" :title="text.stepForward" @click="step(frameStep)">
        <LpIcon name="lucide:step-forward" :size="16" />
      </LpButton>
      <span class="px-1.5 font-mono text-xs text-muted tabular-nums" data-lp-clock>
        <span class="text-ink">{{ formatClipTime(time, true) }}</span> / {{ formatClipTime(duration, true) }}
      </span>
      <LpButton size="sm" variant="ghost" square :disabled="!ready" :aria-label="muted ? text.unmute : text.mute" :title="muted ? text.unmute : text.mute" :aria-pressed="muted" @click="toggleMute">
        <LpIcon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" :size="16" />
      </LpButton>
      <span class="flex-1" />
      <LpButton size="sm" variant="ghost" square :disabled="off || !zoomed" :aria-label="text.zoomOut" :title="text.zoomOut" @click="zoomBy(0.5)">
        <LpIcon name="lucide:zoom-out" :size="16" />
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off || !canZoomIn" :aria-label="text.zoomIn" :title="text.zoomIn" @click="zoomBy(2)">
        <LpIcon name="lucide:zoom-in" :size="16" />
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off || !zoomed" :aria-label="text.zoomFit" :title="text.zoomFit" @click="fit">
        <LpIcon name="lucide:maximize-2" :size="16" />
      </LpButton>
    </div>

    <!-- Ruler, stills, range and playhead. -->
    <div class="relative" @wheel="onWheel">
      <div class="relative h-4 overflow-hidden text-[10px] text-muted tabular-nums" aria-hidden="true">
        <span
          v-for="m in marks"
          :key="m"
          class="absolute top-0 whitespace-nowrap"
          :class="xOf(m) < 16 ? '' : xOf(m) > trackWidth - 16 ? '-translate-x-full' : '-translate-x-1/2'"
          :style="{ left: pct(m) }"
        >{{ formatClipTime(m, markDigits) }}</span>
      </div>
      <div
        ref="trackEl"
        class="relative h-14 touch-none rounded-control bg-surface-soft"
        :class="off ? 'opacity-60' : 'cursor-text'"
        :aria-label="text.timeline"
        role="group"
        @pointerdown="onTrackDown"
        @pointermove="onTrackMove"
        @pointerup="onTrackUp"
        @pointercancel="onTrackUp"
      >
        <div class="absolute inset-0 overflow-hidden rounded-control">
          <div
            v-for="s in stills"
            :key="s.key"
            :ref="(el) => mountFrame(s.key, el as Element | null)"
            class="lp-trim-still absolute inset-y-0 overflow-hidden border-r border-black/20 [&>canvas]:size-full [&>canvas]:object-cover"
            :class="{ 'lp-trim-still-in': !reduced }"
            :style="{ left: s.left, width: s.width }"
            :data-lp-still="frames.has(s.key) ? 'ready' : 'pending'"
          />
          <!-- What falls outside the clip is dimmed, not hidden: it is still where the clip could move. -->
          <div class="absolute inset-y-0 left-0 bg-black/55" :style="{ width: `${Math.max(0, xOf(local[0]))}px` }" />
          <div class="absolute inset-y-0 right-0 bg-black/55" :style="{ left: `${Math.min(trackWidth, Math.max(0, xOf(local[1])))}px` }" />
        </div>
        <div
          v-if="ready"
          class="pointer-events-none absolute inset-y-0 border-y-2 border-brand"
          :style="{ left: pct(local[0]), width: `${(clipLength / span) * 100}%` }"
          data-lp-range
        />
        <div
          v-for="end in ([0, 1] as const)"
          v-show="ready"
          :key="end"
          class="group/handle absolute inset-y-0 z-10 flex w-6 touch-none items-stretch outline-none pointer-coarse:w-11"
          :class="[end === 0 ? 'justify-start' : '-translate-x-full justify-end', off ? '' : 'cursor-ew-resize']"
          :style="{ left: pct(local[end]) }"
          role="slider"
          :tabindex="off ? -1 : 0"
          :aria-label="end === 0 ? text.start : text.end"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration * 1000) / 1000"
          :aria-valuenow="local[end]"
          :aria-valuetext="handleText(local[end])"
          :aria-disabled="off || undefined"
          :data-lp-handle="end"
          @pointerdown="onHandleDown(end, $event)"
        >
          <span
            class="flex w-3 items-center justify-center bg-brand transition-[width] duration-(--duration-fast) group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-ring motion-reduce:transition-none"
            :class="end === 0 ? 'rounded-l-control' : 'rounded-r-control'"
          >
            <span class="h-5 w-0.5 rounded-pill bg-white/85" />
          </span>
        </div>
        <div
          v-show="ready && time >= view.start && time <= view.end"
          class="absolute -top-4 bottom-0 z-20 w-0 outline-none"
          :style="{ left: pct(time) }"
          role="slider"
          :tabindex="off ? -1 : 0"
          :aria-label="text.position"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration * 1000) / 1000"
          :aria-valuenow="Math.round(time * 1000) / 1000"
          :aria-valuetext="handleText(time)"
          data-lp-playhead
        >
          <span class="pointer-events-none absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.45)]" />
          <span class="pointer-events-none absolute -top-0.5 -left-1.5 size-3 rounded-pill border-2 border-white bg-ink shadow [[data-lp-playhead]:focus-visible_&]:ring-2 [[data-lp-playhead]:focus-visible_&]:ring-ring" />
        </div>
      </div>
      <!-- The whole video, for finding the way back while zoomed in. -->
      <div
        v-if="zoomed"
        class="relative mt-1.5 h-2 cursor-pointer touch-none rounded-pill bg-surface-soft"
        :aria-label="text.overview"
        role="presentation"
        data-lp-overview
        @pointerdown="onOverviewDown"
      >
        <span class="absolute inset-y-0 rounded-pill bg-brand/45" :style="{ left: `${(local[0] / duration) * 100}%`, width: `${(clipLength / duration) * 100}%` }" />
        <span class="absolute -inset-y-0.5 rounded-pill border-2 border-ink/70" :style="{ left: `${(view.start / duration) * 100}%`, width: `${(span / duration) * 100}%` }" />
      </div>
    </div>

    <!-- Exact times, typed. -->
    <div class="flex flex-wrap items-end gap-x-3 gap-y-2 text-xs">
      <label v-for="end in ([0, 1] as const)" :key="end" class="flex flex-col gap-1">
        <span class="text-muted">{{ end === 0 ? text.start : text.end }}</span>
        <LpInput
          size="sm"
          class="w-28 font-mono tabular-nums"
          :model-value="fieldText(end)"
          :disabled="off"
          :invalid="invalid[end]"
          :title="invalid[end] ? text.invalidTime : undefined"
          inputmode="decimal"
          spellcheck="false"
          autocomplete="off"
          :data-lp-time="end"
          @update:model-value="onFieldInput(end, $event)"
          @blur="commitField(end)"
          @keydown.enter.prevent="commitField(end)"
          @keydown.esc="revertField(end)"
        />
      </label>
      <div class="flex flex-col gap-1 pb-1.5">
        <span class="text-muted">{{ text.length }}</span>
        <span class="font-mono text-sm text-ink tabular-nums" data-lp-length>{{ formatClipTime(clipLength, true) }}</span>
      </div>
      <span v-if="leftText" class="pb-2 text-muted" data-lp-left>{{ leftText }}</span>
      <span class="flex-1" />
      <template v-if="regionSelect">
        <LpButton v-if="region" size="sm" variant="outline" :disabled="disabled" @click="emit('update:region', null)">
          <LpIcon name="lucide:x" :size="14" />{{ text.regionClear }}
        </LpButton>
        <span v-else class="pb-2 text-muted">{{ text.regionHint }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lp-trim-still-in > :deep(canvas) {
  animation: lp-trim-still var(--duration-medium) var(--ease-emphasized);
}
@keyframes lp-trim-still {
  from { opacity: 0; }
}
</style>
