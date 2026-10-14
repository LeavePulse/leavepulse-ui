<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A muted, looping video behind something: a page's hero, a panel, an app's
 * wallpaper. It fills the box it is put in (position it, the backdrop is
 * `absolute inset-0` inside it) and keeps out of the way of what sits on top:
 * no controls, no pointer events, no sound.
 *
 * Over a plain `<video loop muted autoplay>` it adds what a backdrop needs:
 *
 * - A stretch of the clip to loop (`start`, `end`), so a recording's dull
 *   opening or closing seconds never show.
 * - A seam without a jump (`crossfade`): a second element starts the next
 *   pass at `start` shortly before the current one ends and fades in over it,
 *   paced on its own media clock, so a clip whose last frame does not match
 *   its first still loops without a visible cut.
 * - Speed (`rate`) and a darkening veil (`dim`) for text laid over it.
 * - Pausing where motion is unwanted: `paused`, a hidden tab, and the
 *   system's reduced-motion setting, which shows the first frame of the
 *   stretch instead (`playWithReducedMotion` overrides it).
 * - Easing in and out of a pause (`easePlayback`): the picture slows to a
 *   standstill and gathers speed again instead of freezing and lurching. A
 *   hidden tab and reduced motion still stop at once.
 *
 * The second element exists only while there is a seam to blend, so a plain
 * loop decodes one stream. Both play the same `src`: a URL the media element
 * fetches by range, or an object URL of a file already in memory.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { easeTravel, prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { isNativeLoop, planLoop, seamProgress, seamReached } from "./videoBackdrop"

const props = withDefaults(
  defineProps<{
    src: string
    /** Shown until the first frame decodes, and instead of motion when it is unwanted. */
    poster?: string
    /** Where the looped stretch begins, in seconds. */
    start?: number
    /** Where it ends, in seconds; the clip's end when unset. */
    end?: number
    /** Seconds of media over which the next pass fades in at the seam; 0 cuts straight back. */
    crossfade?: number
    /** Playback rate: 0.5 is half speed. */
    rate?: number
    /** A dark veil over the picture, 0 to 1, for text laid on top. */
    dim?: number
    fit?: "cover" | "contain" | "fill" | "none"
    paused?: boolean
    /** Keep playing when the system asks for reduced motion (it shows a still otherwise). */
    playWithReducedMotion?: boolean
    /** Milliseconds over which a pause slows the picture to a halt and a resume brings it back up; 0 stops dead. */
    easePlayback?: number
  }>(),
  {
    start: 0,
    crossfade: 0,
    rate: 1,
    dim: 0,
    fit: "cover",
    paused: false,
    playWithReducedMotion: false,
    easePlayback: 600,
  },
)

const emit = defineEmits<{
  /** The clip's length and picture size, once known: what a trim control needs. */
  (e: "loaded", info: { duration: number; width: number; height: number }): void
  /** The clip could not be played (missing file, a codec this engine lacks). */
  (e: "error"): void
}>()

const first = ref<HTMLVideoElement | null>(null)
const second = ref<HTMLVideoElement | null>(null)
const duration = ref(Number.NaN)
const ready = ref(false)
/** Which element carries the current pass. */
const active = ref<0 | 1>(0)
/** The element fading in over it at the seam, and how far it has come. */
const incoming = ref<0 | 1 | null>(null)
const incomingOpacity = ref(0)

/** The elements are playing, which includes slowing down into a pause. */
const running = ref(false)
/** Share of `rate` played at, 0 to 1: below 1 while easing into or out of a pause. */
const throttle = ref(1)

/**
 * The slowest rate a pause eases down to before the element is paused.
 * Chromium refuses a rate below a sixteenth; past that point the picture is
 * all but still anyway.
 */
const SLOWEST_RATE = 1 / 16

const reducedMotion = ref(prefersReducedMotion())
const pageHidden = ref(typeof document !== "undefined" && document.hidden)

const plan = computed(() =>
  planLoop(duration.value, { start: props.start, end: props.end, crossfade: props.crossfade }),
)
const native = computed(() => isNativeLoop(plan.value, duration.value))
const blended = computed(() => plan.value.fade > 0)
const still = computed(() => reducedMotion.value && !props.playWithReducedMotion)
const playing = computed(() => ready.value && !props.paused && !pageHidden.value && !still.value)

function element(index: 0 | 1) {
  return index === 0 ? first.value : second.value
}

function setRate(video: HTMLVideoElement | null) {
  if (!video) return
  // `defaultPlaybackRate` too: a reload of the source resets the rate to it.
  video.defaultPlaybackRate = props.rate
  video.playbackRate = Math.max(SLOWEST_RATE, props.rate * throttle.value)
}

function applyRate() {
  setRate(first.value)
  setRate(second.value)
}

let ramp = 0
/** Move `throttle` to `target` over `ms`, eased, then call `done`. */
function rampTo(target: number, ms: number, done?: () => void) {
  if (ramp) cancelAnimationFrame(ramp)
  ramp = 0
  const from = throttle.value
  const span = ms * Math.abs(target - from)
  if (span <= 0) {
    throttle.value = target
    applyRate()
    done?.()
    return
  }
  const began = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - began) / span)
    throttle.value = from + (target - from) * easeTravel(k)
    applyRate()
    if (k < 1) ramp = requestAnimationFrame(step)
    else {
      ramp = 0
      done?.()
    }
  }
  ramp = requestAnimationFrame(step)
}

function onMetadata(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video !== first.value) return
  duration.value = video.duration
  emit("loaded", { duration: video.duration, width: video.videoWidth, height: video.videoHeight })
}

function onFirstFrame(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video !== first.value || ready.value) return
  // A clip whose stretch starts later is moved there before it shows.
  if (video.currentTime < plan.value.from) video.currentTime = plan.value.from
  ready.value = true
}

function onError(event: Event) {
  if (event.target === first.value) emit("error")
}

/** The pass ran out without the seam being caught (frames are not watched in a hidden tab). */
function onEnded(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video !== element(active.value)) return
  video.currentTime = plan.value.from
  if (playing.value) void video.play().catch(() => {})
}

function finishSeam() {
  const done = incoming.value
  if (done === null) return
  const old = element(active.value)
  active.value = done
  incoming.value = null
  incomingOpacity.value = 0
  if (old) {
    old.pause()
    // Parked at the start, so the next seam begins on a decoded frame.
    old.currentTime = plan.value.from
  }
}

let frame = 0
function watchFrames() {
  frame = 0
  if (!running.value) return
  const current = element(active.value)
  const loop = plan.value
  if (current && !native.value) {
    if (current.currentTime < loop.from - 0.05) current.currentTime = loop.from
    if (!blended.value) {
      if (current.currentTime >= loop.to) current.currentTime = loop.from
    } else if (incoming.value === null && seamReached(loop, current.currentTime)) {
      const next: 0 | 1 = active.value === 0 ? 1 : 0
      const video = element(next)
      if (video) {
        setRate(video)
        if (Math.abs(video.currentTime - loop.from) > 0.05) video.currentTime = loop.from
        incoming.value = next
        incomingOpacity.value = 0
        void video.play().catch(() => {})
      }
    }
    if (incoming.value !== null) {
      const video = element(incoming.value)
      incomingOpacity.value = video ? seamProgress(loop, video.currentTime) : 1
      if (incomingOpacity.value >= 1) finishSeam()
    }
  }
  frame = requestAnimationFrame(watchFrames)
}

function startElements() {
  running.value = true
  applyRate()
  void element(active.value)?.play().catch(() => {})
  if (incoming.value !== null) void element(incoming.value)?.play().catch(() => {})
  if (!frame) frame = requestAnimationFrame(watchFrames)
}

function stopElements() {
  running.value = false
  first.value?.pause()
  second.value?.pause()
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  // A still shows the stretch's first frame, not wherever the clip stopped.
  const current = element(active.value)
  if (still.value && current && ready.value) current.currentTime = plan.value.from
}

function sync() {
  const easing = props.easePlayback > 0 && !prefersReducedMotion() ? props.easePlayback : 0
  if (playing.value) {
    // A resume from a standstill gathers speed from the slowest rate.
    if (!running.value) throttle.value = easing ? 0 : 1
    startElements()
    rampTo(1, easing)
    return
  }
  // Nobody sees a hidden tab, and a still is asked for outright: both stop at once.
  if (!running.value || pageHidden.value || still.value || !easing) {
    rampTo(throttle.value, 0)
    stopElements()
    return
  }
  rampTo(0, easing, () => {
    if (!playing.value) stopElements()
  })
}

watch(playing, sync, { flush: "post" })
watch(() => props.rate, applyRate)
watch(
  () => props.src,
  () => {
    ready.value = false
    duration.value = Number.NaN
    active.value = 0
    incoming.value = null
    incomingOpacity.value = 0
  },
)
// With the seam turned off the second element unmounts; if it was carrying
// the pass, the first takes over from the same moment before it goes.
watch(blended, (on) => {
  if (on) return
  const carrier = second.value
  if (active.value === 1 && carrier && first.value) first.value.currentTime = carrier.currentTime
  active.value = 0
  incoming.value = null
  incomingOpacity.value = 0
  sync()
})

// A new stretch takes effect at once rather than at the next seam.
watch(
  () => [plan.value.from, plan.value.to] as const,
  ([from, to]) => {
    finishSeam()
    const current = element(active.value)
    if (current && (current.currentTime < from || current.currentTime > to)) current.currentTime = from
  },
)

function onMotionChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches
}
function onVisibility() {
  pageHidden.value = document.hidden
}
let motionQuery: MediaQueryList | null = null

onMounted(() => {
  applyRate()
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  motionQuery.addEventListener("change", onMotionChange)
  document.addEventListener("visibilitychange", onVisibility)
})

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  if (ramp) cancelAnimationFrame(ramp)
  motionQuery?.removeEventListener("change", onMotionChange)
  document.removeEventListener("visibilitychange", onVisibility)
})

function layerStyle(index: 0 | 1) {
  const fading = incoming.value === index
  return {
    objectFit: props.fit,
    zIndex: fading ? 1 : 0,
    opacity: fading ? incomingOpacity.value : index === active.value ? 1 : 0,
  }
}

// `isolate`: the element fading in at the seam is raised over the one going
// out with a z-index, and without a stacking context of its own here that
// z-index lifted it over the page's content too, so text laid on the backdrop
// faded away at every seam.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "pointer-events-none absolute inset-0 isolate overflow-hidden",
)
</script>

<template>
  <div :class="rootClass" aria-hidden="true" v-bind="rest">
    <!-- Under the video, which fades in over it: removing a still laid on top
         would flash the page between the two. -->
    <img v-if="poster" class="absolute inset-0 size-full" :style="{ objectFit: fit }" :src="poster" alt="" />
    <div
      class="absolute inset-0 transition-opacity duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      :class="ready ? 'opacity-100' : 'opacity-0'"
    >
      <video
        ref="first"
        class="absolute inset-0 size-full"
        :style="layerStyle(0)"
        :src="src"
        :poster="poster"
        :loop="native"
        muted
        playsinline
        preload="auto"
        disablepictureinpicture
        @loadedmetadata="onMetadata"
        @loadeddata="onFirstFrame"
        @ended="onEnded"
        @error="onError"
      />
      <video
        v-if="blended"
        ref="second"
        class="absolute inset-0 size-full"
        :style="layerStyle(1)"
        :src="src"
        muted
        playsinline
        preload="auto"
        disablepictureinpicture
        @ended="onEnded"
      />
    </div>
    <div
      class="absolute inset-0 bg-black transition-opacity duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      :style="{ opacity: Math.min(1, Math.max(0, dim)) }"
    />
  </div>
</template>
