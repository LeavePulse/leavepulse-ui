<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A video with the kit's own controls instead of each browser's: the same
 * look in Chromium, Firefox and the launcher's WebKitGTK, in both themes.
 *
 *   <LpVideoPlayer :src="url" :poster="thumb" title="Report #42" />
 *
 * - A seek bar with what is buffered, and under the pointer the time and a
 *   still of that moment (taken from a second element only once someone
 *   hovers, so a video nobody scrubs costs nothing extra).
 * - Volume and speed, remembered between videos on this device and shared
 *   with LpVideoTrim (`remember`).
 * - Fullscreen of the whole player, so the controls come along; menus open
 *   inside it there, since a page-level popup would sit behind it. An iPhone,
 *   which fullscreens only a bare video, gets the system player.
 * - Picture in picture where the browser has it; captions from <track>
 *   children (the default slot goes inside the <video>).
 * - Controls step aside while it plays and come back on any movement, key or
 *   focus; they stay while paused, while a menu is open or a pointer is on them.
 * - Keys, with the player focused: Space or K play, J/L skip, ←/→ nudge, ↑/↓
 *   volume, M mute, F fullscreen, C captions, 0–9 a tenth of the way, < and >
 *   speed. A double tap at either side of a touch screen skips. A skip is ten
 *   seconds and a nudge five on a long video, less on a short one.
 * - A narrow player keeps its bar on one line by dropping, in turn, the skip
 *   buttons, picture in picture and speed: all three stay in the right-click
 *   menu and on the keys.
 * - It plays by range requests from its address, so a long file costs what is
 *   watched, and a same-origin address keeps the session cookie.
 * - `#actions` puts the app's buttons over the picture's top right corner,
 *   `#controls` into the bar before the speed; both get `buttonClass` so they
 *   look like the player's own:
 *
 *     <template #actions="{ buttonClass }">
 *       <LpButton variant="ghost" size="sm" square :class="buttonClass" aria-label="Remove" @click="clear">
 *         <LpIcon name="lucide:trash-2" :size="16" />
 *       </LpButton>
 *     </template>
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { isHTMLElement, nodeWindow } from "../composables/realm"
import { useClipboard } from "../composables/useClipboard"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useToast } from "../composables/useToast"
import { useVideoMedia, type VideoErrorCause } from "../composables/useVideoMedia"
import { provideView, useView } from "../composables/useView"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpDropdownMenu from "./LpDropdownMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import SteadyText from "./SteadyText.vue"
import VideoFlash from "./VideoFlash.vue"
import VideoVolume from "./VideoVolume.vue"
import { formatClipTime, widestClipTime } from "./videoBackdrop"
import { FrameSampler } from "./videoFrames"
import { FADE, FADE_SCALE, ICON_SWAP, OVERLAY_BUTTON } from "./videoMotion"

/** Wording of the video player. `{n}` is seconds, `{time}` the playhead's time. */
export type VideoPlayerLabels = {
  player: string
  play: string
  pause: string
  replay: string
  mute: string
  unmute: string
  volume: string
  speed: string
  normalSpeed: string
  fullscreen: string
  exitFullscreen: string
  pip: string
  exitPip: string
  captions: string
  seek: string
  failed: string
  unsupported: string
  back: string
  forward: string
  rewind: string
  fastForward: string
  menuAt: string
  copyTime: string
  copyFrame: string
  copiedTime: string
  copiedFrame: string
  copyFailed: string
}

const props = withDefaults(
  defineProps<{
    src: string
    poster?: string
    /** Names the player for assistive tech: what the video is. */
    title?: string
    /** Starts on its own; a browser that refuses sound-on autoplay leaves the play button. */
    autoplay?: boolean
    loop?: boolean
    /** Starts muted (and so lets autoplay through). */
    muted?: boolean
    /** Seconds to start from. */
    startAt?: number
    /** Speeds offered in the menu. */
    rates?: number[]
    /** Keep volume and speed between videos on this device; false forgets them. */
    remember?: boolean
    /** A still of the moment under the pointer on the seek bar. */
    preview?: boolean
    /**
     * Fit inside the box the player is given (a lightbox's stage) at the
     * video's own proportions, as a picture with object-fit: contain does,
     * instead of taking the full width at its own height. The parent sets the
     * size; a portrait phone video stands tall and narrow in a wide box.
     */
    fit?: boolean
    /** More items for the right-click menu. */
    menuItems?: () => ContextMenuItemDef[]
    labels?: Partial<VideoPlayerLabels>
  }>(),
  {
    poster: undefined,
    title: undefined,
    startAt: 0,
    rates: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
    remember: true,
    preview: true,
    menuItems: undefined,
    labels: () => ({}),
  },
)

const emit = defineEmits<{
  (e: "play"): void
  (e: "pause"): void
  (e: "ended"): void
  (e: "error", error: { cause: VideoErrorCause; message: string }): void
}>()

const text = useLabels<VideoPlayerLabels>(
  "videoPlayer",
  {
    player: "Video player — Space plays, arrows seek, F fullscreen",
    play: "Play",
    pause: "Pause",
    replay: "Play again",
    mute: "Mute",
    unmute: "Unmute",
    volume: "Volume",
    speed: "Speed",
    normalSpeed: "Normal",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    pip: "Picture in picture",
    exitPip: "Exit picture in picture",
    captions: "Captions",
    seek: "Seek",
    failed: "This video couldn't be loaded.",
    unsupported: "This browser can't play this video's format.",
    /** `{n}` is replaced by seconds. */
    back: "−{n} s",
    forward: "+{n} s",
    /** `{n}` is replaced by seconds. */
    rewind: "Back {n} seconds",
    fastForward: "Forward {n} seconds",
    /** `{time}` is replaced by the playhead's time. */
    menuAt: "At {time}",
    copyTime: "Copy time",
    copyFrame: "Copy frame",
    copiedTime: "Time copied",
    copiedFrame: "Frame copied",
    copyFailed: "Couldn't copy",
  },
  () => props.labels,
)

const rootEl = ref<HTMLElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)

const media = useVideoMedia(videoEl, {
  src: () => props.src,
  remember: () => props.remember,
  onError: (cause) => emit("error", { cause, message: cause === "unsupported" ? text.value.unsupported : text.value.failed }),
})
const { duration, time, playing, wantsPlay, waiting, ended, muted, rate, buffered, failure, size } = media
const ready = computed(() => duration.value > 0 && !failure.value)
const started = ref(false)
const widest = computed(() => widestClipTime(duration.value))

let prepared = ""
watch(ready, (ok) => {
  if (!ok || prepared === props.src) return
  prepared = props.src
  if (props.startAt > 0) media.seek(props.startAt)
  if (props.autoplay) media.play()
})
watch(() => props.src, () => {
  started.value = false
})
watch(playing, (on) => {
  if (on) {
    started.value = true
    emit("play")
  } else emit("pause")
})
watch(ended, (on) => {
  if (on) emit("ended")
})

/* ---------- controls coming and going ---------- */

const HIDE_AFTER_MS = 2500
const awake = ref(true)
const menuOpen = ref(false)
const overControls = ref(false)
const scrubbing = ref(false)
let sleepTimer: ReturnType<typeof setTimeout> | undefined
const showControls = computed(
  () => !playing.value || awake.value || menuOpen.value || overControls.value || scrubbing.value || !!failure.value,
)
function wake() {
  awake.value = true
  clearTimeout(sleepTimer)
  sleepTimer = setTimeout(() => (awake.value = false), HIDE_AFTER_MS)
}
watch(playing, (on) => on && wake())

/* A word over the picture for a key that has nothing else to show (a skip, the volume, the speed). */
const osd = ref("")
let osdTimer: ReturnType<typeof setTimeout> | undefined
function say(message: string) {
  osd.value = message
  clearTimeout(osdTimer)
  osdTimer = setTimeout(() => (osd.value = ""), 700)
}

/* ---------- actions ---------- */

/* A press that plays or pauses is answered in the middle of the picture too (VideoFlash). */
const flash = ref<{ icon: string; n: number } | null>(null)
function togglePlayback() {
  if (!ready.value) return
  media.toggle()
  flash.value = { icon: wantsPlay.value ? "lucide:play" : "lucide:pause", n: (flash.value?.n ?? 0) + 1 }
}

/**
 * How far a skip goes (the buttons, J and L, a double tap at a side) and an
 * arrow, by the video's length: ten seconds through a six-second clip only
 * ever lands on its start or its end, and five per arrow skips most of it.
 */
const SKIP = computed(() => (duration.value >= 30 ? 10 : duration.value >= 10 ? 5 : 2))
const NUDGE = computed(() => (duration.value >= 30 ? 5 : duration.value >= 10 ? 2 : 1))
function skip(seconds: number) {
  if (!ready.value) return
  media.seek(time.value + seconds)
  say((seconds < 0 ? text.value.back : text.value.forward).replace("{n}", String(Math.abs(seconds))))
}
function setVolumeBy(delta: number) {
  media.setVolume(media.volume.value + delta)
  say(`${Math.round(media.volume.value * 100)}%`)
}
const rateLabel = (r: number) => (r === 1 ? text.value.normalSpeed : `${r}×`)
function setRate(r: number) {
  media.setRate(r)
  say(`${r}×`)
}
function stepRate(direction: 1 | -1) {
  const list = [...props.rates].sort((a, b) => a - b)
  const at = list.findIndex((r) => r >= rate.value - 1e-6)
  const next = list[Math.min(list.length - 1, Math.max(0, (at < 0 ? list.length - 1 : at) + direction))]
  if (next !== undefined) setRate(next)
}

const { copy } = useClipboard()
const { error: toastError } = useToast()
function copyTime() {
  void copy(formatClipTime(time.value, "fixed"), { toast: text.value.copiedTime, errorToast: text.value.copyFailed })
}
async function copyFrame() {
  const blob = await media.captureFrame()
  if (blob) void copy(blob, { toast: text.value.copiedFrame, errorToast: text.value.copyFailed })
  else toastError(text.value.copyFailed)
}

/* ---------- fullscreen, picture in picture, captions ---------- */

type FullscreenHost = HTMLElement & { webkitRequestFullscreen?: () => void }
type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
type AppleVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitSupportsPresentationMode?: (mode: string) => boolean
  webkitSetPresentationMode?: (mode: string) => void
  webkitPresentationMode?: string
}

const fullscreen = ref(false)
const canFullscreen = ref(false)
const pip = ref(false)
const canPip = ref(false)
const hasCaptions = ref(false)
const captionsOn = ref(false)

/*
 * While the player fills the screen the browser shows nothing outside it, so
 * the kit's menus and tips, which open at the page's body, would be hidden.
 * They open inside the player then.
 */
const outer = useView()
provideView(
  computed(() => {
    const root = rootEl.value
    if (!fullscreen.value || !root) return outer.value
    return { window: nodeWindow(root), document: root.ownerDocument, portal: root }
  }),
)

function syncFullscreen() {
  const doc = rootEl.value?.ownerDocument as FullscreenDoc | undefined
  fullscreen.value = !!doc && (doc.fullscreenElement ?? doc.webkitFullscreenElement) === rootEl.value
}
function toggleFullscreen() {
  const root = rootEl.value as FullscreenHost | null
  const video = videoEl.value as AppleVideo | null
  if (!root || !video) return
  const doc = root.ownerDocument as FullscreenDoc
  if (fullscreen.value) {
    if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {})
    else doc.webkitExitFullscreen?.()
  } else if (root.requestFullscreen) void root.requestFullscreen().catch(() => {})
  else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen()
  else video.webkitEnterFullscreen?.()
}

function syncPip() {
  const video = videoEl.value as AppleVideo | null
  if (!video) return
  pip.value = video.ownerDocument.pictureInPictureElement === video || video.webkitPresentationMode === "picture-in-picture"
}
function togglePip() {
  const video = videoEl.value as AppleVideo | null
  if (!video) return
  if (!video.requestPictureInPicture && video.webkitSetPresentationMode) {
    video.webkitSetPresentationMode(pip.value ? "inline" : "picture-in-picture")
  } else if (pip.value) void video.ownerDocument.exitPictureInPicture().catch(() => {})
  else void video.requestPictureInPicture().catch(() => {})
}

function captionTrack(): TextTrack | null {
  const tracks = videoEl.value?.textTracks
  if (!tracks) return null
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!
    if (track.kind === "subtitles" || track.kind === "captions") return track
  }
  return null
}
function syncCaptions() {
  const track = captionTrack()
  hasCaptions.value = !!track
  captionsOn.value = track?.mode === "showing"
}
function toggleCaptions() {
  const track = captionTrack()
  if (!track) return
  track.mode = track.mode === "showing" ? "disabled" : "showing"
  syncCaptions()
}

/* ---------- seek bar ---------- */

const barEl = ref<HTMLElement | null>(null)
/** Fraction of the bar under the pointer, or null when it is not over it. */
const hover = ref<number | null>(null)
const pct = (t: number) => `${duration.value ? (t / duration.value) * 100 : 0}%`

function fractionAt(clientX: number): number {
  const box = barEl.value?.getBoundingClientRect()
  if (!box || !box.width) return 0
  return Math.min(1, Math.max(0, (clientX - box.left) / box.width))
}
function onBarDown(event: PointerEvent) {
  if (!ready.value || event.button !== 0) return
  const wasPlaying = media.wantsPlay.value
  media.pause({ instant: true })
  scrubbing.value = true
  media.seek(fractionAt(event.clientX) * duration.value)
  startPointerDrag(event, {
    move: (e) => {
      hover.value = fractionAt(e.clientX)
      media.seek(hover.value * duration.value)
    },
    end: () => {
      scrubbing.value = false
      if (wasPlaying) media.play()
    },
  })
}
function onBarHover(event: PointerEvent) {
  if (!ready.value) return
  hover.value = fractionAt(event.clientX)
  if (props.preview && event.pointerType === "mouse") wantPreview(hover.value * duration.value)
}

/* The still under the pointer: a second, hidden element, mounted the first time someone hovers. */
const PREVIEW = { width: 160, height: 90 }
const samplerEl = ref<HTMLVideoElement | null>(null)
const previewWanted = ref(false)
const previewFrame = shallowRef<HTMLCanvasElement | null>(null)
let sampler: FrameSampler | null = null
let previewKey = ""
function wantPreview(t: number) {
  if (!previewWanted.value) {
    previewWanted.value = true
    void nextTick(() => {
      if (!samplerEl.value) return
      sampler = new FrameSampler(samplerEl.value, () => PREVIEW, (key, canvas) => {
        if (key === previewKey) previewFrame.value = canvas
      })
      wantPreview(t)
    })
    return
  }
  // A still a second (or a two-hundredth of a long video) apart is the same still: the cache answers it.
  const grain = Math.max(1, duration.value / 200)
  const at = Math.round(t / grain) * grain
  previewKey = String(at)
  const hit = sampler?.cached(previewKey)
  if (hit) previewFrame.value = hit
  else sampler?.want([{ key: previewKey, time: at }])
}
function mountPreview(el: Element | null) {
  if (isHTMLElement(el) && previewFrame.value && previewFrame.value.parentElement !== el) el.replaceChildren(previewFrame.value)
}
const previewSize = computed(() => {
  const { width, height } = size.value
  return width && height ? { width: PREVIEW.width, height: Math.round((PREVIEW.width * height) / width) } : PREVIEW
})

/* ---------- keys and taps ---------- */

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  if (target.closest("input, textarea, select, [contenteditable='true']")) return
  // The volume slider and the seek bar's own keys stay theirs.
  if (target.getAttribute("role") === "slider" && target !== barEl.value) return
  const key = event.key
  const actions: Record<string, () => void> = {
    " ": togglePlayback,
    k: togglePlayback,
    j: () => skip(-SKIP.value),
    l: () => skip(SKIP.value),
    ArrowLeft: () => skip(-NUDGE.value),
    ArrowRight: () => skip(NUDGE.value),
    ArrowUp: () => setVolumeBy(0.1),
    ArrowDown: () => setVolumeBy(-0.1),
    m: () => media.setMuted(!muted.value),
    f: () => toggleFullscreen(),
    c: () => toggleCaptions(),
    Home: () => media.seek(0),
    End: () => media.seek(duration.value),
    "<": () => stepRate(-1),
    ">": () => stepRate(1),
  }
  const digit = /^[0-9]$/.test(key) ? () => media.seek((Number(key) / 10) * duration.value) : undefined
  const run = actions[key.length === 1 ? key.toLowerCase() : key] ?? actions[key] ?? digit
  // A button's own Space and Enter stay the button's.
  if (!run || (key === " " && target.tagName === "BUTTON") || (!ready.value && key !== " ")) return
  event.preventDefault()
  run()
  wake()
}

/*
 * A mouse click plays and pauses, a double click fills the screen. On a touch
 * screen a tap shows or hides the controls, and a double tap at either side
 * skips ten seconds, as phone players do.
 */
let lastTap = { at: 0, side: 0 }
let tapTimer: ReturnType<typeof setTimeout> | undefined
function onPictureUp(event: PointerEvent) {
  if (event.pointerType !== "touch" || !ready.value) return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width
  const side = x < 1 / 3 ? -1 : x > 2 / 3 ? 1 : 0
  const now = event.timeStamp
  if (now - lastTap.at < 300 && side !== 0 && side === lastTap.side) {
    clearTimeout(tapTimer)
    skip(side * SKIP.value)
    lastTap = { at: 0, side: 0 }
    return
  }
  lastTap = { at: now, side }
  clearTimeout(tapTimer)
  tapTimer = setTimeout(() => {
    if (showControls.value && playing.value) awake.value = false
    else wake()
  }, 300)
}
function onPictureClick(event: MouseEvent) {
  if ((event as PointerEvent).pointerType === "touch") return
  togglePlayback()
}

/* ---------- menus ---------- */

const rateItems = computed<ContextMenuItemDef[]>(() =>
  props.rates.map((r) => ({ label: rateLabel(r), icon: Math.abs(r - rate.value) < 1e-6 ? "lucide:check" : undefined, onSelect: () => setRate(r) })),
)
const menu = computed<ContextMenuItemDef[]>(() => {
  if (!ready.value) return []
  const items: ContextMenuItemDef[] = [
    { label: wantsPlay.value ? text.value.pause : text.value.play, icon: wantsPlay.value ? "lucide:pause" : "lucide:play", shortcut: "Space", onSelect: () => media.toggle() },
    { label: muted.value ? text.value.unmute : text.value.mute, icon: muted.value ? "lucide:volume-2" : "lucide:volume-x", shortcut: "M", onSelect: () => media.setMuted(!muted.value) },
    { label: text.value.rewind.replace("{n}", String(SKIP.value)), icon: "lucide:rewind", shortcut: "J", separatorBefore: true, onSelect: () => skip(-SKIP.value) },
    { label: text.value.fastForward.replace("{n}", String(SKIP.value)), icon: "lucide:fast-forward", shortcut: "L", onSelect: () => skip(SKIP.value) },
    { label: text.value.speed, icon: "lucide:gauge", separatorBefore: true, children: rateItems.value },
  ]
  if (hasCaptions.value) items.push({ label: text.value.captions, icon: "lucide:captions", shortcut: "C", checked: captionsOn.value, onSelect: toggleCaptions })
  if (canPip.value) items.push({ label: pip.value ? text.value.exitPip : text.value.pip, icon: "lucide:picture-in-picture-2", onSelect: togglePip })
  if (canFullscreen.value) items.push({ label: fullscreen.value ? text.value.exitFullscreen : text.value.fullscreen, icon: fullscreen.value ? "lucide:minimize" : "lucide:maximize", shortcut: "F", onSelect: toggleFullscreen })
  items.push(
    { label: text.value.copyTime, icon: "lucide:clock", separatorBefore: true, onSelect: copyTime },
    { label: text.value.copyFrame, icon: "lucide:image", onSelect: () => void copyFrame() },
  )
  const extra = props.menuItems?.() ?? []
  return [...items, ...extra.map((item, i) => (i === 0 ? { ...item, separatorBefore: true } : item))]
})
const menuTitle = computed(() => text.value.menuAt.replace("{time}", formatClipTime(time.value, "fixed")))

/* ---------- mount ---------- */

onMounted(() => {
  const root = rootEl.value as FullscreenHost | null
  const video = videoEl.value as AppleVideo | null
  if (!root || !video) return
  const doc = root.ownerDocument
  canFullscreen.value = !!(root.requestFullscreen || root.webkitRequestFullscreen || video.webkitEnterFullscreen)
  canPip.value = (!!doc.pictureInPictureEnabled && !video.disablePictureInPicture) || !!video.webkitSupportsPresentationMode?.("picture-in-picture")
  doc.addEventListener("fullscreenchange", syncFullscreen)
  doc.addEventListener("webkitfullscreenchange", syncFullscreen)
  video.textTracks.addEventListener?.("addtrack", syncCaptions)
  video.textTracks.addEventListener?.("change", syncCaptions)
  syncCaptions()
})
onBeforeUnmount(() => {
  clearTimeout(sleepTimer)
  clearTimeout(osdTimer)
  clearTimeout(tapTimer)
  sampler?.dispose()
  const doc = rootEl.value?.ownerDocument
  doc?.removeEventListener("fullscreenchange", syncFullscreen)
  doc?.removeEventListener("webkitfullscreenchange", syncFullscreen)
  const stills = samplerEl.value
  if (stills) {
    stills.removeAttribute("src")
    stills.load()
  }
})

defineExpose({
  play: media.play,
  pause: media.pause,
  toggle: togglePlayback,
  seek: media.seek,
  currentTime: () => time.value,
  /** The frame on screen as a PNG, or null where it cannot be read back. */
  captureFrame: media.captureFrame,
})

/* The frame: the root itself, or under `fit` a box inside it sized to the video's proportions. */
const FRAME = "overflow-hidden rounded-card bg-black"
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  props.fit
    ? "group/player relative flex size-full items-center justify-center text-white outline-none select-none [container-type:size] focus-visible:ring-2 focus-visible:ring-ring"
    : `group/player relative block w-full ${FRAME} text-white outline-none select-none focus-visible:ring-2 focus-visible:ring-ring`,
)
const ratio = computed(() => (size.value.width && size.value.height ? size.value.width / size.value.height : 16 / 9))
const aspect = computed(() => (size.value.width && size.value.height ? `${size.value.width} / ${size.value.height}` : "16 / 9"))
/*
 * Under `fit`, as large as the box allows at the video's proportions, but not
 * past its own size, as the lightbox does with a picture: a 320 × 180 clip
 * blown up to a screen is a smear. Never narrower than the controls need.
 */
const frameStyle = computed(() => {
  if (!props.fit || fullscreen.value) return undefined
  const natural = size.value.width ? `max(${size.value.width}px, 28rem)` : "100cqw"
  return { width: `min(100cqw, calc(100cqh * ${ratio.value}), ${natural})` }
})
</script>

<template>
  <div
    ref="rootEl"
    :class="[rootClass, fullscreen ? 'rounded-none' : '', playing && !showControls ? 'cursor-none' : '']"
    v-bind="rest"
    tabindex="0"
    role="region"
    :aria-label="title ?? text.player"
    :data-fullscreen="fullscreen || undefined"
    @keydown="onKeydown"
    @pointermove="wake"
    @focusin="wake"
  >
    <!-- The menu's trigger is a wrapper of its own: reka's as-child puts its ref on the element it wraps. -->
    <LpContextMenu :items="menu" :title="menuTitle" always>
    <!-- A size container, so the bar gives up what does not fit a narrow player (see the controls below). -->
    <div class="@container" :class="fit && !fullscreen ? FRAME : ''" :style="frameStyle" data-lp-video-frame>
    <div class="relative w-full" :class="fullscreen ? 'h-dvh' : ''" :style="fullscreen ? undefined : { aspectRatio: aspect }">
      <video
        ref="videoEl"
        class="absolute inset-0 size-full object-contain"
        :src="src"
        :poster="poster"
        :loop="loop"
        :muted="$props.muted"
        preload="metadata"
        playsinline
        v-on="media.listeners"
        @enterpictureinpicture="syncPip"
        @leavepictureinpicture="syncPip"
        @webkitpresentationmodechanged="syncPip"
        @click="onPictureClick"
        @dblclick="canFullscreen && toggleFullscreen()"
        @pointerup="onPictureUp"
      ><slot /></video>
      <VideoFlash :flash="flash" />
      <video
        v-if="previewWanted"
        ref="samplerEl"
        class="pointer-events-none absolute size-px opacity-0"
        :src="src"
        preload="metadata"
        muted
        playsinline
        aria-hidden="true"
        tabindex="-1"
      />

      <!-- The big play button: before the first play and after the end, where a click anywhere is not yet obvious. -->
      <Transition v-bind="FADE_SCALE">
        <button
          v-if="ready && (!started || ended) && !wantsPlay"
          type="button"
          class="absolute top-1/2 left-1/2 flex size-16 -translate-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/20 outline-none transition-[background-color,scale] duration-(--duration-fast) ease-(--ease-emphasized) hover:scale-105 hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
          :aria-label="ended ? text.replay : text.play"
          tabindex="-1"
          @click.stop="togglePlayback"
        >
          <LpIcon :name="ended ? 'lucide:rotate-ccw' : 'lucide:play'" :size="28" :class="ended ? '' : 'translate-x-0.5'" />
        </button>
      </Transition>

      <Transition v-bind="FADE">
        <div v-if="waiting && playing" class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LpLoader size="lg" class="text-white" />
        </div>
      </Transition>

      <Transition v-bind="FADE">
        <span
          v-if="osd"
          :key="osd"
          class="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-pill bg-black/55 px-3 py-1 text-sm font-medium tabular-nums text-white"
          aria-live="polite"
        >{{ osd }}</span>
      </Transition>

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

      <!--
        The app's own actions over the picture's top right corner (a bin that
        takes the video back out of a dropzone, a download): they come and go
        with the controls, over a shade of their own.
      -->
      <div
        v-if="$slots.actions"
        class="absolute inset-x-0 top-0 flex justify-end gap-0.5 bg-linear-to-b from-black/55 to-transparent px-2 pt-2 pb-8 transition-opacity duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
        :class="showControls ? '' : 'pointer-events-none opacity-0'"
        @pointerenter="overControls = true"
        @pointerleave="overControls = false"
      >
        <slot name="actions" :button-class="OVERLAY_BUTTON" />
      </div>

      <!-- Controls, over a shade that keeps them readable on a bright frame. -->
      <div
        class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/35 to-transparent px-3 pt-12 pb-2 transition-opacity duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
        :class="showControls && !failure ? '' : 'pointer-events-none opacity-0'"
        data-lp-player-controls
        @pointerenter="overControls = true"
        @pointerleave="overControls = false; hover = null"
      >
        <!-- Seek bar: a taller strip than it looks, so it is easy to catch; it thickens under the pointer. -->
        <div
          ref="barEl"
          class="group/seek relative flex h-4 cursor-pointer touch-none items-center outline-none"
          role="slider"
          tabindex="0"
          :aria-label="text.seek"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration * 10) / 10"
          :aria-valuenow="Math.round(time * 10) / 10"
          :aria-valuetext="formatClipTime(time, 'fixed')"
          :aria-disabled="!ready || undefined"
          @pointerdown="onBarDown"
          @pointermove="onBarHover"
          @pointerleave="!scrubbing && (hover = null)"
        >
          <div class="relative h-1 w-full overflow-hidden rounded-pill bg-white/25 transition-[height] duration-(--duration-fast) ease-(--ease-emphasized) group-hover/seek:h-1.5 group-focus-visible/seek:h-1.5 motion-reduce:transition-none">
            <span v-for="(b, i) in buffered" :key="i" class="absolute inset-y-0 bg-white/35" :style="{ left: `${b[0] * 100}%`, width: `${(b[1] - b[0]) * 100}%` }" />
            <span
              v-if="hover !== null"
              class="absolute inset-y-0 left-0 bg-white/25"
              :style="{ width: `${hover * 100}%` }"
            />
            <span class="absolute inset-y-0 left-0 bg-white" :style="{ width: pct(time) }" />
          </div>
          <span
            class="pointer-events-none absolute top-1/2 size-3 -translate-1/2 scale-0 rounded-full bg-white shadow transition-transform duration-(--duration-fast) ease-(--ease-emphasized) group-hover/seek:scale-100 group-focus-visible/seek:scale-100 group-focus-visible/seek:ring-2 group-focus-visible/seek:ring-ring motion-reduce:transition-none"
            :class="scrubbing ? 'scale-100' : ''"
            :style="{ left: pct(time) }"
          />
          <Transition v-bind="FADE">
            <div
              v-if="hover !== null && ready"
              class="pointer-events-none absolute bottom-full mb-2 flex -translate-x-1/2 flex-col items-center gap-1"
              :style="{ left: `clamp(${preview && previewFrame ? previewSize.width / 2 : 28}px, ${hover * 100}%, calc(100% - ${preview && previewFrame ? previewSize.width / 2 : 28}px))` }"
            >
              <div
                v-if="preview && previewFrame"
                :ref="(el) => mountPreview(el as Element | null)"
                class="overflow-hidden rounded-control bg-black shadow-lg ring-1 ring-white/20 [&>canvas]:size-full [&>canvas]:object-cover"
                :style="{ width: `${previewSize.width}px`, height: `${previewSize.height}px` }"
              />
              <span class="rounded-pill bg-black/70 px-2 py-0.5 font-mono text-xs text-white">{{ formatClipTime(hover * duration, "fixed") }}</span>
            </div>
          </Transition>
        </div>

        <div class="mt-1 flex items-center gap-0.5">
          <LpButton size="sm" variant="ghost" square :class="OVERLAY_BUTTON" :disabled="!ready" :aria-label="wantsPlay ? text.pause : ended ? text.replay : text.play" :title="wantsPlay ? text.pause : text.play" @click="media.toggle()">
            <Transition v-bind="ICON_SWAP">
              <LpIcon :key="wantsPlay ? 'pause' : ended ? 'replay' : 'play'" :name="wantsPlay ? 'lucide:pause' : ended ? 'lucide:rotate-ccw' : 'lucide:play'" :size="16" />
            </Transition>
          </LpButton>
          <!-- On a narrow player the bar sheds, in this order, what the right-click menu and the keys also give: skips, picture in picture, speed. -->
          <LpButton size="sm" variant="ghost" square :class="[OVERLAY_BUTTON, '@max-[26rem]:hidden']" :disabled="!ready" :aria-label="text.rewind.replace('{n}', String(SKIP))" :title="text.rewind.replace('{n}', String(SKIP))" @click="skip(-SKIP)">
            <LpIcon name="lucide:rewind" :size="16" />
          </LpButton>
          <LpButton size="sm" variant="ghost" square :class="[OVERLAY_BUTTON, '@max-[26rem]:hidden']" :disabled="!ready" :aria-label="text.fastForward.replace('{n}', String(SKIP))" :title="text.fastForward.replace('{n}', String(SKIP))" @click="skip(SKIP)">
            <LpIcon name="lucide:fast-forward" :size="16" />
          </LpButton>
          <VideoVolume :media="media" :labels="text" :disabled="!ready" overlay />
          <span class="min-w-0 truncate px-1.5 font-mono text-xs text-white/70">
            <SteadyText class="text-white" :text="formatClipTime(time, 'fixed')" :widest="widest" /> / {{ formatClipTime(duration, "fixed") }}
          </span>
          <span class="flex-1" />
          <Transition v-bind="FADE_SCALE">
            <LpButton v-if="hasCaptions" size="sm" variant="ghost" square :class="[OVERLAY_BUTTON, captionsOn ? 'bg-white/15 text-white' : '']" :aria-label="text.captions" :title="text.captions" :aria-pressed="captionsOn" @click="toggleCaptions">
              <LpIcon name="lucide:captions" :size="16" />
            </LpButton>
          </Transition>
          <slot name="controls" :button-class="OVERLAY_BUTTON" />
          <LpDropdownMenu :items="rateItems" :title="text.speed" @update:open="(open: boolean) => (menuOpen = open)">
            <template #trigger>
              <LpButton size="sm" variant="ghost" :class="['min-w-12 px-2 font-mono text-xs @max-[18rem]:hidden', OVERLAY_BUTTON]" :disabled="!ready" :aria-label="text.speed" :title="text.speed">
                <SteadyText :text="`${rate}×`" :widest="`${Math.max(...rates)}×`.replace(/\d/g, '0')" />
              </LpButton>
            </template>
          </LpDropdownMenu>
          <LpButton v-if="canPip" size="sm" variant="ghost" square :class="[OVERLAY_BUTTON, '@max-[22rem]:hidden']" :disabled="!ready" :aria-label="pip ? text.exitPip : text.pip" :title="pip ? text.exitPip : text.pip" :aria-pressed="pip" @click="togglePip">
            <LpIcon name="lucide:picture-in-picture-2" :size="16" />
          </LpButton>
          <LpButton v-if="canFullscreen" size="sm" variant="ghost" square :class="OVERLAY_BUTTON" :aria-label="fullscreen ? text.exitFullscreen : text.fullscreen" :title="fullscreen ? text.exitFullscreen : text.fullscreen" @click="toggleFullscreen">
            <Transition v-bind="ICON_SWAP">
              <LpIcon :key="fullscreen ? 'min' : 'max'" :name="fullscreen ? 'lucide:minimize' : 'lucide:maximize'" :size="16" />
            </Transition>
          </LpButton>
        </div>
      </div>
    </div>
    </div>
    </LpContextMenu>
  </div>
</template>
