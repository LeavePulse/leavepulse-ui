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
 * - `#actions` puts the app's buttons over the picture's top right corner (a
 *   bin, a download), with `buttonClass` to look like the editor's own.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { isHTMLElement, nodeWindow } from "../composables/realm"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useResizeObserver } from "../composables/useResizeObserver"
import { usePrefersReducedMotion } from "../composables/useReducedMotion"
import { useVideoMedia } from "../composables/useVideoMedia"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpInput from "./LpInput.vue"
import SteadyText from "./SteadyText.vue"
import VideoFlash from "./VideoFlash.vue"
import VideoVolume from "./VideoVolume.vue"
import { FADE, FADE_SCALE, ICON_SWAP, OVERLAY_BUTTON } from "./videoMotion"
import { useClipboard } from "../composables/useClipboard"
import { useToast } from "../composables/useToast"
import { formatClipTime, widestClipTime } from "./videoBackdrop"
import { FrameSampler, stillSpan } from "./videoFrames"
import {
  adjustRegion,
  containRect,
  dragEnd,
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
    /** More items for the right-click menu, given the time it was opened at (under the pointer on the timeline, the playhead elsewhere). */
    menuItems?: (at: number) => ContextMenuItemDef[]
    disabled?: boolean
    labels?: Partial<Record<
      | "play" | "pause" | "stepBack" | "stepForward" | "mute" | "unmute" | "zoomIn" | "zoomOut" | "zoomFit"
      | "start" | "end" | "position" | "length" | "left" | "overview" | "timeline"
      | "region" | "regionHint" | "regionClear" | "failed" | "unsupported" | "invalidTime"
      | "menuAt" | "setStart" | "setEnd" | "goStart" | "goEnd" | "zoomHere" | "volume"
      | "copyTime" | "copyFrame" | "copiedTime" | "copiedFrame" | "copyFailed",
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
    /** `{time}` is replaced by the time the menu was opened at. */
    menuAt: "At {time}",
    setStart: "Start here",
    setEnd: "End here",
    goStart: "Go to the clip's start",
    goEnd: "Go to the clip's end",
    zoomHere: "Zoom in here",
    volume: "Volume",
    copyTime: "Copy time",
    copyFrame: "Copy frame",
    copiedTime: "Time copied",
    copiedFrame: "Frame copied",
    copyFailed: "Couldn't copy",
  },
  () => props.labels,
)

const { class: rootClass, attrs: rest } = useMergedAttrs("flex w-full min-w-0 flex-col gap-3 select-none")
const reduced = usePrefersReducedMotion()

const videoEl = ref<HTMLVideoElement | null>(null)
const samplerEl = ref<HTMLVideoElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const trackEl = ref<HTMLElement | null>(null)

const media = useVideoMedia(videoEl, {
  src: () => props.src,
  onFrame: followPlayback,
  onError: (cause) => emit("error", { cause, message: cause === "unsupported" ? text.value.unsupported : text.value.failed }),
})
const { duration, failure, time, playing, wantsPlay, muted, size: videoSize, seek } = media
/* Every pause the editor makes itself is for a seek, a step or a drag, where the frame must be exact: no easing. */
const pause = () => media.pause({ instant: true })
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

/* ---------- playback ---------- */

/** Playback that began inside the range ends at its end, so Play previews the clip. */
let stopAtEnd = false
function followPlayback() {
  if (stopAtEnd && time.value >= local.value[1]) {
    pause()
    seek(local.value[1])
    return
  }
  if (zoomed.value) view.value = revealTime(view.value, time.value, duration.value, 0.05)
}

/* A press that plays or pauses is answered in the middle of the picture too (VideoFlash). */
const flash = ref<{ icon: string; n: number } | null>(null)
function togglePlay() {
  if (!videoEl.value || off.value) return
  flash.value = { icon: wantsPlay.value ? "lucide:pause" : "lucide:play", n: (flash.value?.n ?? 0) + 1 }
  if (wantsPlay.value) {
    media.pause()
    return
  }
  const [a, b] = local.value
  let from = time.value
  if (from >= b - 1e-3 && from <= b + 1e-3) from = a
  stopAtEnd = from >= a - 1e-3 && from < b
  if (from !== time.value) seek(from)
  media.play()
}
function step(seconds: number) {
  if (off.value) return
  pause()
  seek(time.value + seconds)
  if (zoomed.value) view.value = revealTime(view.value, time.value, duration.value)
}
function toggleMute() {
  media.setMuted(!muted.value)
}

const frameStep = computed(() => 1 / Math.max(1, props.frameRate))

/* The window the component renders in: an LpFrame's own, inside one. */
const frameWindow = () => nodeWindow(trackEl.value ?? videoEl.value!)

/*
 * Positions on the timeline glide to a value set from elsewhere and follow at
 * once while something moves them continuously: the same split as the kit's
 * sliders (SLIDER_GLIDE), over `left` and `width` here.
 */
const TRACK_GLIDE =
  "[&_[data-glide]]:transition-[left,width] [&_[data-glide]]:duration-(--duration-medium) [&_[data-glide]]:ease-(--ease-emphasized) data-[live]:[&_[data-glide]]:transition-none motion-reduce:[&_[data-glide]]:transition-none"
/* The first placement, once the length is known, is not a change: it lands where it belongs instead of travelling there from zero. */
const placed = ref(false)
watch(ready, (ok) => {
  placed.value = false
  if (ok) frameWindow().requestAnimationFrame(() => frameWindow().requestAnimationFrame(() => (placed.value = true)))
})
const live = computed(() => !placed.value || dragging.value !== null || scrubbing.value || pinching.value || wheeling.value || playing.value)

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

/** Zoom around the playhead while it is in sight, else around the middle: a zoom must never carry the view off to somewhere else. */
function zoomAnchor(): number {
  const { start, end } = view.value
  return time.value >= start && time.value <= end ? time.value : (start + end) / 2
}
function zoomBy(factor: number, anchor = zoomAnchor()) {
  if (!duration.value) return
  view.value = zoomView(view.value, anchor, factor, duration.value, MIN_SPAN)
}
function fit() {
  view.value = { start: 0, end: duration.value }
}

/* A wheel or touchpad sends a stream of small steps: each follows at once, as a drag does, rather than easing after the last. */
const wheeling = ref(false)
let wheelTimer: ReturnType<typeof setTimeout> | undefined
function markWheel() {
  wheeling.value = true
  clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => (wheeling.value = false), 160)
}

function onWheel(event: WheelEvent) {
  if (!ready.value) return
  const dx = event.shiftKey ? event.deltaY : event.deltaX
  // A sideways scroll (or Shift+wheel) pans; an upright one, and a pinch on a touchpad, zooms.
  if (Math.abs(dx) > Math.abs(event.deltaY) || event.shiftKey) {
    if (!zoomed.value) return
    event.preventDefault()
    markWheel()
    view.value = shiftView(view.value, (dx / Math.max(1, trackWidth.value)) * span.value, duration.value)
    return
  }
  event.preventDefault()
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
  const delta = event.deltaY * unit
  /*
   * A mouse wheel moves in notches (a line at a time, or a hundred pixels or
   * so): each notch glides to its zoom like a button press. A touchpad or a
   * pinch sends a stream of small steps that the view follows at once.
   */
  const notch = event.deltaMode !== 0 || (!event.ctrlKey && Math.abs(delta) >= 50)
  if (!notch) markWheel()
  zoomBy(Math.exp(-delta / (event.ctrlKey ? 100 : 300)), timeAt(event.clientX))
}

const marks = computed(() => (ready.value ? ticks(view.value, tickStep(span.value, trackWidth.value)) : []))
const markDigits = computed(() => tickStep(span.value, trackWidth.value) < 1)

/* ---------- timeline pointers ---------- */

const pointers = new Map<number, number>()
let pinch: { distance: number; anchor: number } | null = null
const pinching = ref(false)
let edgeFrame = 0
let lastX = 0
const scrubbing = ref(false)

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
      if (edgeFrame) frameWindow().cancelAnimationFrame(edgeFrame)
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
  if (!over || (dragging.value === null && !scrubbing.value)) return
  edgeFrame = frameWindow().requestAnimationFrame(() => {
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
    scrubbing.value = false
    const [a, b] = [...pointers.values()] as [number, number]
    pinch = { distance: Math.max(8, Math.abs(a - b)), anchor: timeAt((a + b) / 2) }
    pinching.value = true
    return
  }
  if (pointers.size > 2) return
  event.preventDefault()
  trackEl.value?.querySelector<HTMLElement>("[data-lp-playhead]")?.focus({ preventScroll: true })
  pause()
  scrubbing.value = true
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
  if (!scrubbing.value) return
  lastX = event.clientX
  seek(timeAt(event.clientX))
  edgeScroll()
}
function onTrackUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) {
    pinch = null
    pinching.value = false
  }
  if (!pointers.size) scrubbing.value = false
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

/*
 * A still in its tile. Until its own frame is taken, the tile shows a copy of
 * the nearest one already taken (from any zoom), so zooming never empties the
 * strip; the real frame then fades in over that stand-in.
 */
function mountFrame(still: { key: string; time: number }, el: Element | null) {
  if (!isHTMLElement(el)) return
  const canvas = frames.value.get(still.key) ?? sampler?.cached(still.key)
  if (canvas) {
    if (canvas.parentElement === el) return
    const standIns = [...el.children]
    el.append(canvas)
    if (!standIns.length || reduced.value) standIns.forEach((c) => c.remove())
    else canvas.addEventListener("animationend", () => standIns.forEach((c) => c.remove()), { once: true })
    return
  }
  if (el.children.length) return
  const near = nearestFrame(still.time)
  if (!near) return
  const copy = el.ownerDocument.createElement("canvas")
  copy.width = near.width
  copy.height = near.height
  copy.getContext("2d")?.drawImage(near, 0, 0)
  copy.dataset.lpStandIn = ""
  el.append(copy)
}
const frameTimes = new Map<string, number>()
function nearestFrame(t: number): HTMLCanvasElement | undefined {
  let best: HTMLCanvasElement | undefined
  let gap = Infinity
  for (const [key, canvas] of frames.value) {
    const d = Math.abs((frameTimes.get(key) ?? Infinity) - t)
    if (d < gap) {
      gap = d
      best = canvas
    }
  }
  return best
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
  // Another slider inside (the volume) owns its arrows.
  if (target.getAttribute("role") === "slider" && end === null && target.dataset.lpPlayhead === undefined) return
  if ((event.key === "m" || event.key === "M") && !event.altKey) {
    if (!ready.value) return
    event.preventDefault()
    toggleMute()
    return
  }
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
const fieldText = (end: 0 | 1) => drafts.value[end] ?? formatClipTime(local.value[end], "fixed")
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
        const still = stills.value.find((s) => s.key === key)
        if (still) frameTimes.set(key, still.time)
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
    frames.value = new Map()
    void nextTick(startSampler)
  },
)

onMounted(startSampler)
onBeforeUnmount(() => {
  sampler?.dispose()
  clearTimeout(stillTimer)
  if (edgeFrame) frameWindow().cancelAnimationFrame(edgeFrame)
  // The stills' element too: one merely detached keeps its connection open.
  const stillsEl = samplerEl.value
  if (stillsEl) {
    stillsEl.removeAttribute("src")
    stillsEl.load()
  }
})

defineExpose({
  play: () => (videoEl.value?.paused ? togglePlay() : undefined),
  pause,
  seek,
  /** The playhead, in seconds. */
  currentTime: () => time.value,
})

/* ---------- right-click ---------- */

const { copy } = useClipboard()
const { error: toastError } = useToast()

/* The picture's own menu: what is done to the video and to the frame on screen. */
const videoMenu = computed<ContextMenuItemDef[]>(() => {
  if (!ready.value || props.disabled) return []
  const items: ContextMenuItemDef[] = [
    { label: wantsPlay.value ? text.value.pause : text.value.play, icon: wantsPlay.value ? "lucide:pause" : "lucide:play", shortcut: "Space", onSelect: togglePlay },
    { label: muted.value ? text.value.unmute : text.value.mute, icon: muted.value ? "lucide:volume-2" : "lucide:volume-x", shortcut: "M", onSelect: toggleMute },
    { label: text.value.stepBack, icon: "lucide:step-back", shortcut: "ArrowLeft", separatorBefore: true, onSelect: () => step(-frameStep.value) },
    { label: text.value.stepForward, icon: "lucide:step-forward", shortcut: "ArrowRight", onSelect: () => step(frameStep.value) },
    { label: text.value.copyTime, icon: "lucide:clock", separatorBefore: true, onSelect: () => void copy(formatClipTime(time.value, "fixed"), { toast: text.value.copiedTime, errorToast: text.value.copyFailed }) },
    { label: text.value.copyFrame, icon: "lucide:image", onSelect: copyFrame },
  ]
  if (props.regionSelect && props.region) items.push({ label: text.value.regionClear, icon: "lucide:x", separatorBefore: true, onSelect: () => emit("update:region", null) })
  return items
})
const clockTitle = computed(() => text.value.menuAt.replace("{time}", formatClipTime(time.value, "fixed")))

async function copyFrame() {
  const blob = await media.captureFrame()
  if (blob) void copy(blob, { toast: text.value.copiedFrame, errorToast: text.value.copyFailed })
  else toastError(text.value.copyFailed)
}

/** Where the timeline's menu was opened: the moment under the pointer. */
const menuAt = ref(0)
function onTimeContextMenu(event: MouseEvent) {
  const overview = (event.target as Element).closest?.("[data-lp-overview]")
  if (overview) {
    const box = overview.getBoundingClientRect()
    menuAt.value = ((event.clientX - box.left) / Math.max(1, box.width)) * duration.value
  } else menuAt.value = timeAt(event.clientX)
  menuAt.value = Math.min(duration.value, Math.max(0, menuAt.value))
}
/* The timeline's menu: what is done at a moment. */
const timeMenu = computed<ContextMenuItemDef[]>(() => {
  if (!ready.value || props.disabled) return []
  const at = menuAt.value
  const items: ContextMenuItemDef[] = [
    {
      label: text.value.setStart,
      icon: "lucide:arrow-left-to-line",
      shortcut: "I",
      onSelect: () => {
        put(setEnd(local.value, 0, at, limits.value), true)
        seek(at)
      },
    },
    {
      label: text.value.setEnd,
      icon: "lucide:arrow-right-to-line",
      shortcut: "O",
      onSelect: () => {
        put(setEnd(local.value, 1, at, limits.value), true)
        seek(at)
      },
    },
    { label: text.value.goStart, separatorBefore: true, onSelect: () => seek(local.value[0]) },
    { label: text.value.goEnd, onSelect: () => seek(local.value[1]) },
    zoomed.value
      ? { label: text.value.zoomFit, icon: "lucide:maximize-2", separatorBefore: true, onSelect: fit }
      : { label: text.value.zoomHere, icon: "lucide:zoom-in", separatorBefore: true, disabled: !canZoomIn.value, onSelect: () => zoomBy(4, at) },
  ]
  const extra = props.menuItems?.(at) ?? []
  return [...items, ...extra.map((item, i) => (i === 0 ? { ...item, separatorBefore: true } : item))]
})
const menuTitle = computed(() => text.value.menuAt.replace("{time}", formatClipTime(menuAt.value, "fixed")))

const handleText = (t: number) => formatClipTime(t, "fixed")
const widest = computed(() => widestClipTime(duration.value))
const leftOf = (left: string, max: string) => text.value.left.replace("{left}", left).replace("{max}", max)
const leftText = computed(() =>
  Number.isFinite(limits.value.maxClip)
    ? leftOf(formatClipTime(Math.max(0, limits.value.maxClip - clipLength.value), "fixed"), formatClipTime(limits.value.maxClip, "fixed"))
    : "",
)
const widestLeft = computed(() => leftOf(widestClipTime(limits.value.maxClip), widestClipTime(limits.value.maxClip)))
</script>

<template>
  <div :class="rootClass" v-bind="rest" :data-disabled="disabled || undefined" @keydown="onKeydown">
    <!--
      The picture. Its own controls are off: the region is drawn on it, and the
      keys are the editor's. A right-click here is about the picture (play, the
      sound, the frame); one on the timeline below is about a moment.
    -->
    <!-- The menu's trigger is a wrapper of its own: reka's as-child puts its ref on the element it wraps, which would take the stage's. -->
    <LpContextMenu :items="videoMenu" :title="clockTitle" always>
    <div>
    <div ref="stageEl" class="relative aspect-video w-full overflow-hidden rounded-card bg-black">
      <video
        ref="videoEl"
        class="absolute inset-0 size-full object-contain"
        :src="src"
        :poster="poster"
        preload="metadata"
        playsinline
        v-on="media.listeners"
        @click="!regionSelect && togglePlay()"
      />
      <VideoFlash :flash="flash" />
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
      <Transition v-bind="FADE">
        <div
          v-if="regionSelect && ready"
          class="absolute cursor-crosshair touch-none"
          :style="{ left: `${picture.x}px`, top: `${picture.y}px`, width: `${picture.width}px`, height: `${picture.height}px` }"
          data-lp-region-layer
          @pointerdown="onRegionDown('draw', $event)"
        >
          <!-- Comes in under the pointer that draws it (no growing in: the drag already does that) and leaves with the dimming around it. -->
          <Transition v-bind="FADE_SCALE" :enter-from-class="draft ? 'opacity-0' : FADE_SCALE.enterFromClass">
            <div
              v-if="shownRegion"
              class="absolute cursor-move rounded-inner border-2 border-dashed border-white/90 bg-white/10 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)] outline-none transition-[left,top,width,height] duration-(--duration-medium) ease-(--ease-emphasized) focus-visible:ring-2 focus-visible:ring-ring data-[live]:transition-none motion-reduce:transition-none"
              :data-live="draft ? '' : undefined"
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
                <span class="size-3 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.35)]" />
              </span>
            </div>
          </Transition>
        </div>
      </Transition>
      <Transition v-bind="FADE">
        <span
          v-if="regionSelect && ready && !shownRegion && !playing && !disabled"
          class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-black/55 px-3 py-1 text-xs whitespace-nowrap text-white/85"
        >{{ text.regionHint }}</span>
      </Transition>
      <!-- The app's own actions over the picture's top right corner: a bin that takes the video back out of a dropzone, say. -->
      <div v-if="$slots.actions" class="absolute top-2 right-2 flex gap-0.5 rounded-control bg-black/45">
        <slot name="actions" :button-class="OVERLAY_BUTTON" />
      </div>
      <Transition v-bind="FADE">
        <div
          v-if="failure"
          role="alert"
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/80"
        >
          <LpIcon name="lucide:video-off" :size="32" />
          <p>{{ failure === "unsupported" ? text.unsupported : text.failed }}</p>
        </div>
      </Transition>
    </div>
    </div>
    </LpContextMenu>

    <!-- Transport, sound and zoom. One line at every width: a row that wraps re-wraps as its numbers change. -->
    <div class="flex items-center gap-0.5">
      <LpButton size="sm" variant="ghost" square :disabled="off" :aria-label="wantsPlay ? text.pause : text.play" :title="wantsPlay ? text.pause : text.play" @click="togglePlay">
        <Transition v-bind="ICON_SWAP">
          <LpIcon :key="wantsPlay ? 'pause' : 'play'" :name="wantsPlay ? 'lucide:pause' : 'lucide:play'" :size="16" />
        </Transition>
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off" :aria-label="text.stepBack" :title="text.stepBack" @click="step(-frameStep)">
        <LpIcon name="lucide:step-back" :size="16" />
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off" :aria-label="text.stepForward" :title="text.stepForward" @click="step(frameStep)">
        <LpIcon name="lucide:step-forward" :size="16" />
      </LpButton>
      <span class="min-w-0 truncate px-1.5 font-mono text-xs text-muted" data-lp-clock>
        <SteadyText class="text-ink" :text="formatClipTime(time, 'fixed')" :widest="widest" /> / {{ formatClipTime(duration, "fixed") }}
      </span>
      <VideoVolume :media="media" :labels="text" :disabled="!ready" />
      <span class="flex-1" />
      <Transition v-bind="FADE_SCALE">
        <LpButton v-if="zoomed" size="sm" variant="ghost" square :disabled="off" :aria-label="text.zoomFit" :title="text.zoomFit" @click="fit">
          <LpIcon name="lucide:maximize-2" :size="16" />
        </LpButton>
      </Transition>
      <LpButton size="sm" variant="ghost" square :disabled="off || !zoomed" :aria-label="text.zoomOut" :title="text.zoomOut" @click="zoomBy(0.5)">
        <LpIcon name="lucide:zoom-out" :size="16" />
      </LpButton>
      <LpButton size="sm" variant="ghost" square :disabled="off || !canZoomIn" :aria-label="text.zoomIn" :title="text.zoomIn" @click="zoomBy(2)">
        <LpIcon name="lucide:zoom-in" :size="16" />
      </LpButton>
    </div>

    <!--
      Ruler, stills, range and playhead. Positions glide when they are set from
      elsewhere (a key, a typed time, a zoom button) and follow the pointer with
      no delay while it moves them, as the kit's sliders do. Marks and stills
      that come into view or leave it fade rather than blink.
    -->
    <LpContextMenu :items="timeMenu" :title="menuTitle" always>
    <div class="relative" :class="TRACK_GLIDE" :data-live="live || undefined" @wheel="onWheel" @contextmenu="onTimeContextMenu">
      <TransitionGroup tag="div" class="relative h-4 overflow-hidden text-[10px] text-muted tabular-nums" aria-hidden="true" v-bind="FADE">
        <span
          v-for="m in marks"
          :key="m"
          class="absolute top-0 whitespace-nowrap"
          :class="xOf(m) < 16 ? '' : xOf(m) > trackWidth - 16 ? '-translate-x-full' : '-translate-x-1/2'"
          :style="{ left: pct(m) }"
          data-glide
        >{{ formatClipTime(m, markDigits) }}</span>
      </TransitionGroup>
      <div
        ref="trackEl"
        class="relative h-14 touch-none rounded-control bg-surface-soft transition-opacity duration-(--duration-fast) motion-reduce:transition-none"
        :class="off ? 'opacity-60' : 'cursor-text'"
        :aria-label="text.timeline"
        role="group"
        @pointerdown="onTrackDown"
        @pointermove="onTrackMove"
        @pointerup="onTrackUp"
        @pointercancel="onTrackUp"
      >
        <div class="absolute inset-0 overflow-hidden rounded-control">
          <TransitionGroup v-bind="FADE">
            <div
              v-for="s in stills"
              :key="s.key"
              :ref="(el) => mountFrame(s, el as Element | null)"
              class="absolute inset-y-0 overflow-hidden [&>canvas]:absolute [&>canvas]:inset-0 [&>canvas]:size-full [&>canvas]:object-cover"
              :class="{ 'lp-trim-still-in': !reduced }"
              :style="{ left: s.left, width: s.width }"
              :data-lp-still="frames.has(s.key) ? 'ready' : 'pending'"
              data-glide
            />
          </TransitionGroup>
          <!-- What falls outside the clip is dimmed, not hidden: it is still where the clip could move. -->
          <div class="absolute inset-y-0 left-0 bg-black/55" :style="{ width: pct(local[0]) }" data-glide />
          <div class="absolute inset-y-0 right-0 bg-black/55" :style="{ left: pct(local[1]) }" data-glide />
        </div>
        <!-- The range and its grips arrive with the video's length, faded in rather than popped onto the strip. -->
        <div
          class="pointer-events-none absolute inset-0 transition-opacity duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
          :class="ready ? '' : 'opacity-0'"
        >
          <div
            class="absolute inset-y-0 rounded-control border-y-2 border-white/85 shadow-[0_0_0_1px_rgb(0_0_0/0.25)]"
            :style="{ left: pct(local[0]), width: `${(clipLength / span) * 100}%` }"
            data-lp-range
            data-glide
          />
          <!-- A grip as on LpChart's overview: narrow and neutral, lit only while it is held, hovered or focused. -->
          <div
            v-for="end in ([0, 1] as const)"
            :key="end"
            class="group/handle absolute inset-y-0 z-10 flex w-6 -translate-x-1/2 touch-none justify-center outline-none pointer-coarse:w-11"
            :class="[off ? '' : 'cursor-ew-resize', ready ? 'pointer-events-auto' : '']"
            :style="{ left: pct(local[end]) }"
            role="slider"
            :tabindex="off ? -1 : 0"
            :aria-label="end === 0 ? text.start : text.end"
            :aria-valuemin="0"
            :aria-valuemax="Math.round(duration * 1000) / 1000"
            :aria-valuenow="local[end]"
            :aria-valuetext="handleText(local[end])"
            :aria-disabled="off || undefined"
            :aria-hidden="ready ? undefined : 'true'"
            :data-lp-handle="end"
            :data-active="dragging === end || undefined"
            data-glide
            @pointerdown="onHandleDown(end, $event)"
          >
            <span
              class="my-1 flex w-2 items-center justify-center rounded-inner bg-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.35)] transition-[background-color,scale] duration-(--duration-fast) ease-(--ease-emphasized) group-hover/handle:bg-white group-data-active/handle:scale-x-125 group-data-active/handle:bg-white group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-ring motion-reduce:transition-none motion-reduce:group-data-active/handle:scale-x-100"
            >
              <span class="h-4 w-px rounded-pill bg-black/35" />
            </span>
          </div>
        </div>
        <div
          class="group/playhead absolute -top-4 bottom-0 z-20 w-0 outline-none"
          :style="{ left: pct(time) }"
          role="slider"
          :tabindex="off ? -1 : 0"
          :aria-label="text.position"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration * 1000) / 1000"
          :aria-valuenow="Math.round(time * 1000) / 1000"
          :aria-valuetext="handleText(time)"
          data-lp-playhead
          :data-glide="playing ? undefined : ''"
        >
          <!-- Fades out past either edge of a zoomed view instead of vanishing there. -->
          <span
            class="pointer-events-none absolute inset-0 transition-opacity duration-(--duration-fast) motion-reduce:transition-none"
            :class="ready && time >= view.start && time <= view.end ? '' : 'opacity-0'"
          >
            <span class="absolute inset-y-0 -left-px w-0.5 rounded-pill bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.35)]" />
            <span class="absolute -top-0.5 -left-1.5 size-3 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.35)] group-focus-visible/playhead:ring-2 group-focus-visible/playhead:ring-ring" />
          </span>
        </div>
      </div>
      <!-- The whole video while zoomed in, drawn like LpChart's overview: the window it shows, the clip within it. -->
      <Transition v-bind="FADE">
        <div
          v-if="zoomed"
          class="relative mt-1.5 h-2.5 cursor-pointer touch-none rounded-pill bg-surface-soft"
          :aria-label="text.overview"
          role="presentation"
          data-lp-overview
          @pointerdown="onOverviewDown"
        >
          <span class="absolute inset-y-0.5 rounded-pill bg-line-strong" :style="{ left: `${(local[0] / duration) * 100}%`, width: `${(clipLength / duration) * 100}%` }" data-glide />
          <span class="absolute inset-y-0 rounded-pill border border-ink/60" :style="{ left: `${(view.start / duration) * 100}%`, width: `${(span / duration) * 100}%` }" data-glide />
        </div>
      </Transition>
    </div>
    </LpContextMenu>

    <!-- Exact times, typed, and the clip's length. Every value holds its width, so nothing on the line moves as they change. -->
    <div class="flex flex-wrap items-end gap-x-3 gap-y-2">
      <LpInput
        v-for="end in ([0, 1] as const)"
        :key="end"
        size="sm"
        class="w-28"
        :label="end === 0 ? text.start : text.end"
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
      <div class="flex flex-col gap-0.5 pb-0.5 text-xs">
        <span class="text-muted">{{ text.length }}</span>
        <span class="font-mono text-sm text-ink" data-lp-length><SteadyText :text="formatClipTime(clipLength, 'fixed')" :widest="widest" /></span>
      </div>
      <Transition v-bind="FADE">
        <span v-if="leftText" class="pb-1 font-mono text-xs text-muted" data-lp-left><SteadyText :text="leftText" :widest="widestLeft" /></span>
      </Transition>
      <span class="flex-1" />
      <Transition v-bind="FADE_SCALE">
        <LpButton v-if="regionSelect" size="sm" variant="outline" :disabled="disabled || !region" @click="emit('update:region', null)">
          <LpIcon name="lucide:x" :size="14" />{{ text.regionClear }}
        </LpButton>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.lp-trim-still-in > :deep(canvas:not([data-lp-stand-in])) {
  animation: lp-trim-still var(--duration-medium) var(--ease-emphasized);
}
@keyframes lp-trim-still {
  from { opacity: 0; }
}
</style>
