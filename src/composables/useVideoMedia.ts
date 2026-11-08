import { onBeforeUnmount, ref, watch, type Ref } from "vue"
import { SLOWEST_RATE } from "../components/videoBackdrop"
import { nodeWindow } from "./realm"
import { usePersisted } from "./usePersisted"
import { usePrefersReducedMotion } from "./useReducedMotion"
import { useTween } from "./useTween"

/*
 * The state of a <video> as a component that draws its own controls needs it,
 * shared by LpVideoPlayer and LpVideoTrim so both know the same things about
 * a video the same way:
 *
 * - One seek at a time, the latest wins: a drag asks for a position on every
 *   pointer move, and WebKitGTK's pipeline stalls on a seek started inside
 *   another.
 * - A MediaRecorder WebM carries no duration until its end has been seen: it
 *   is found by seeking far past it once.
 * - Chromium answers a 404, or a login page served in place of an expired
 *   session's video, with "format not supported", the same code as a real
 *   codec problem; one byte of the address tells the two apart.
 * - The playhead follows the picture every frame while playing, not the four
 *   `timeupdate`s a second.
 *
 * Bind `listeners` on the element with `v-on`.
 */

/**
 * Why there is no video to show:
 * - "load": the address did not answer (network, 404, an expired session);
 * - "decode": the file arrived but is damaged;
 * - "unsupported": a format or codec this browser cannot play (H.265 in
 *   Chromium without hardware support, ProRes anywhere).
 */
export type VideoErrorCause = "load" | "decode" | "unsupported"

export function mediaErrorCause(error: MediaError | null): VideoErrorCause {
  if (error?.code === 3) return "decode"
  if (error?.code === 4) return "unsupported"
  return "load"
}

export interface UseVideoMediaOptions {
  src: () => string
  /** Every frame while playing, after `time` is updated. */
  onFrame?: () => void
  onError?: (cause: VideoErrorCause) => void
  /** Ease starts and stops (true by default); false cuts in and out at once. */
  ease?: () => boolean
  /**
   * Keep volume, mute and speed between videos on this device, shared by every
   * player and editor of the kit: someone who turned the sound down turned it
   * down, whichever component the next video is in. False forgets.
   */
  remember?: () => boolean
}

interface Sound {
  volume: number
  muted: boolean
  rate: number
}
/*
 * A kept record is used only when it is one a person could have chosen: a
 * speed outside what the menus offer, or a volume outside 0..1, is a record
 * written by an easing caught mid-way (a sixteenth speed and silence, once),
 * and restoring it would start every video stuck.
 */
const isSound = (v: unknown): v is Sound => {
  if (!v || typeof v !== "object") return false
  const { volume, muted, rate } = v as Sound
  return typeof muted === "boolean" && typeof volume === "number" && volume >= 0 && volume <= 1 && typeof rate === "number" && rate >= 0.25 && rate <= 4
}

export function useVideoMedia(el: Ref<HTMLVideoElement | null>, options: UseVideoMediaOptions) {
  const duration = ref(0)
  const time = ref(0)
  const playing = ref(false)
  /** Playback stalled for data. */
  const waiting = ref(false)
  const ended = ref(false)
  const muted = ref(false)
  const volume = ref(1)
  const rate = ref(1)
  /** Buffered stretches as fractions of the duration. */
  const buffered = ref<[number, number][]>([])
  const failure = ref<VideoErrorCause | null>(null)
  const size = ref({ width: 0, height: 0 })

  const sound = usePersisted<Sound>(() => (options.remember?.() ?? true) && "lp-video:sound", { volume: 1, muted: false, rate: 1 }, { validate: isSound })
  /* Applied once per address, when it first knows its duration; saved only after, so a fresh element's defaults never overwrite what was kept. */
  let applied = ""

  let seekBusy = false
  let seekTarget: number | null = null
  let probingDuration = false
  let frame = 0

  function seek(t: number) {
    const video = el.value
    const target = Math.min(Math.max(0, t), duration.value || t)
    time.value = target
    ended.value = false
    if (!video) return
    if (seekBusy) {
      seekTarget = target
      return
    }
    seekBusy = true
    video.currentTime = target
  }

  /*
   * `currentTime` moves in steps, one per decoded frame: at a few frames a
   * second (a screen recording, a slideshow) a bar or a playhead driven by it
   * jumps along. Between steps the position runs on the clock from the last
   * one, at the playback rate; it never goes back (a step that lands a hair
   * behind the estimate is held), and never runs more than a moment ahead of
   * the video, so a stall shows as a stop, not as a bar that keeps going.
   */
  const AHEAD_LIMIT = 0.25
  let lastMedia = -1
  let lastAt = 0
  function smoothTime(video: HTMLVideoElement, now: number): number {
    const t = video.currentTime
    if (t !== lastMedia) {
      lastMedia = t
      lastAt = now
    }
    const estimate = Math.min(lastMedia + ((now - lastAt) / 1000) * video.playbackRate, lastMedia + AHEAD_LIMIT, duration.value || Infinity)
    return Math.max(estimate, Math.min(time.value, lastMedia + AHEAD_LIMIT))
  }

  function tick(now: number) {
    frame = 0
    const video = el.value
    if (!video || !playing.value) return
    if (!seekBusy) time.value = smoothTime(video, now)
    options.onFrame?.()
    if (playing.value) frame = nodeWindow(video).requestAnimationFrame(tick)
  }
  function stopTicking() {
    if (frame && el.value) nodeWindow(el.value).cancelAnimationFrame(frame)
    frame = 0
  }

  function readBuffered(video: HTMLVideoElement) {
    const d = duration.value
    if (!d) return
    const out: [number, number][] = []
    for (let i = 0; i < video.buffered.length; i++) out.push([video.buffered.start(i) / d, video.buffered.end(i) / d])
    buffered.value = out
  }

  async function probe(src: string): Promise<VideoErrorCause> {
    try {
      const res = await fetch(src, { headers: { Range: "bytes=0-0" }, credentials: "same-origin" })
      void res.body?.cancel()
      const type = res.headers.get("content-type") ?? ""
      return res.ok && !/^text\/|json|xml/.test(type) ? "unsupported" : "load"
    } catch {
      // Another origin without CORS: there is no telling, so the browser's word stands.
      return "unsupported"
    }
  }

  const listeners = {
    loadedmetadata() {
      const video = el.value
      if (!video) return
      size.value = { width: video.videoWidth, height: video.videoHeight }
      if (applied !== options.src()) {
        applied = options.src()
        volume.value = sound.value.volume
        rate.value = sound.value.rate
        video.muted = video.muted || sound.value.muted
        muted.value = video.muted
        video.volume = volume.value
        video.playbackRate = rate.value
      }
      if (Number.isFinite(video.duration)) {
        duration.value = video.duration
        return
      }
      probingDuration = true
      video.currentTime = 1e101
    },
    durationchange() {
      const video = el.value
      if (!video || !Number.isFinite(video.duration) || !video.duration) return
      duration.value = video.duration
      if (probingDuration) {
        probingDuration = false
        video.currentTime = 0
      }
    },
    seeked() {
      seekBusy = false
      lastMedia = -1
      if (seekTarget !== null) {
        const next = seekTarget
        seekTarget = null
        seek(next)
      } else if (el.value && !playing.value) time.value = el.value.currentTime
    },
    play() {
      lastMedia = -1
      // Started from outside (media keys, the picture-in-picture window): it wants to play now.
      wantsPlay.value = true
      playing.value = true
      ended.value = false
      if (!frame && el.value) frame = nodeWindow(el.value).requestAnimationFrame(tick)
    },
    pause() {
      wantsPlay.value = false
      playing.value = false
      stopTicking()
      if (el.value && !seekBusy) time.value = el.value.currentTime
    },
    ended() {
      instant = true
      wantsPlay.value = false
      ended.value = true
    },
    waiting() {
      waiting.value = true
    },
    playing() {
      waiting.value = false
    },
    canplay() {
      waiting.value = false
    },
    timeupdate() {
      if (el.value && !playing.value && !seekBusy) time.value = el.value.currentTime
    },
    progress() {
      if (el.value) readBuffered(el.value)
    },
    volumechange() {
      const video = el.value
      if (!video) return
      // Firefox reports itself muted below a quarter speed: during the easing that is the easing's.
      if (!easing()) muted.value = video.muted
      if (easing() || video.volume === written.volume) return
      volume.value = video.volume
      remember()
    },
    ratechange() {
      const video = el.value
      if (!video || easing() || video.playbackRate === written.rate) return
      rate.value = video.playbackRate
      remember()
    },
    async error() {
      const video = el.value
      if (!video?.error) return
      const src = options.src()
      let cause = mediaErrorCause(video.error)
      if (cause === "unsupported") cause = await probe(src)
      if (src !== options.src()) return
      failure.value = cause
      waiting.value = false
      options.onError?.(cause)
    },
  }

  /*
   * Start and stop are eased, as LpVideoBackdrop's `easePlayback` is: a play
   * gathers speed and sound from a standstill over a moment, a pause slows and
   * quietens to one, instead of the picture and the sound cutting in and out
   * in a single frame (and the sound with a click). `wantsPlay` turns at once,
   * so a button's icon answers the press; the element follows. A pause for a
   * seek or a drag, or at a clip's end, is `instant`: there the exact frame
   * matters more than the glide. Reduced motion has no easing at all.
   */
  const wantsPlay = ref(false)
  let instant = false
  const reducedMotion = usePrefersReducedMotion()
  const throttle = useTween<number>(
    () => (wantsPlay.value ? 1 : 0),
    (from, to, k) => from + (to - from) * k,
    { enabled: () => !instant && !reducedMotion.value && (options.ease?.() ?? true) },
  )
  /*
   * Only around playback: a paused element keeps its real rate and volume.
   * Firefox silences sound below a quarter speed and reports the element as
   * muted meanwhile, so a paused video held at the slowest rate came up muted
   * and would not be unmuted. While the rate eases, what the element reports
   * about its sound is the easing's, not a choice, and is not taken as one.
   */
  /* What the easing itself last wrote: the element's later report of the same value is an echo, not a choice. */
  const written = { rate: Number.NaN, volume: Number.NaN }
  function applyThrottle(video: HTMLVideoElement, k: number) {
    written.rate = video.playbackRate = k >= 1 ? rate.value : Math.max(SLOWEST_RATE, rate.value * k)
    written.volume = video.volume = k >= 1 ? volume.value : volume.value * k
  }
  watch(throttle, (k) => {
    const video = el.value
    if (!video) return
    if (k === 0 && !wantsPlay.value) {
      if (!video.paused) video.pause()
      applyThrottle(video, 1)
      instant = false
      return
    }
    applyThrottle(video, k)
    if (k === 1) instant = false
  })
  /*
   * Whether the element's rate and volume are the easing's rather than the
   * chosen ones: from the press of play until full speed, and from the press
   * of pause until the stop. The element reports a change a moment after it
   * is made, so the bounds are the intent, not the throttle alone: a start
   * reported while the throttle still read 0 was taken for a choice of a
   * sixteenth speed and silence.
   */
  const easing = () => (wantsPlay.value ? throttle.value < 1 : throttle.value > 0)

  function remember() {
    if (applied) sound.value = { volume: volume.value, muted: muted.value, rate: rate.value }
  }

  /** Play, quietly: a browser that refuses (autoplay with sound) just leaves it paused. */
  function play() {
    const video = el.value
    if (!video || failure.value) return
    if (ended.value) seek(0)
    wantsPlay.value = true
    // From a standstill the first frame already plays slow and quiet, not at full speed for one frame.
    if (!instant && !reducedMotion.value && (options.ease?.() ?? true) && throttle.value === 0) applyThrottle(video, 0)
    void video.play().catch(() => {
      wantsPlay.value = false
    })
  }
  /** Pause, easing to a stop unless `instant` (a seek, a drag, a clip's end, where the frame must be exact). */
  function pause(options: { instant?: boolean } = {}) {
    if (options.instant) instant = true
    wantsPlay.value = false
  }
  function toggle() {
    if (wantsPlay.value) pause()
    else play()
  }
  function setMuted(value: boolean) {
    if (el.value) el.value.muted = value
    muted.value = value
    remember()
  }
  function setVolume(value: number) {
    const v = Math.min(1, Math.max(0, value))
    volume.value = v
    if (el.value) {
      el.value.volume = easing() ? v * throttle.value : v
      // Turning the sound up is asking to hear it.
      if (v > 0 && el.value.muted) el.value.muted = false
    }
    // Said now, not on the element's event: a slider bound to "muted ? 0 : volume" would spring back to 0 meanwhile.
    if (v > 0) muted.value = false
    remember()
  }
  function setRate(value: number) {
    rate.value = value
    if (el.value) el.value.playbackRate = easing() ? Math.max(SLOWEST_RATE, value * throttle.value) : value
    remember()
  }

  /**
   * The frame on screen as a PNG, for "copy frame". Null when there is none
   * yet, or when the video came from another origin without CORS and the
   * browser will not let it be read back.
   */
  function captureFrame(): Promise<Blob | null> {
    const video = el.value
    if (!video?.videoWidth) return Promise.resolve(null)
    const canvas = video.ownerDocument.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    try {
      canvas.getContext("2d")?.drawImage(video, 0, 0)
      return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"))
    } catch {
      return Promise.resolve(null)
    }
  }

  watch(options.src, () => {
    duration.value = 0
    time.value = 0
    failure.value = null
    buffered.value = []
    ended.value = false
    waiting.value = false
    seekBusy = false
    seekTarget = null
    probingDuration = false
  })

  onBeforeUnmount(() => {
    stopTicking()
    const video = el.value
    if (!video) return
    // Stop the stream from fetching on: an element that is merely detached keeps its connection.
    video.pause()
    video.removeAttribute("src")
    video.load()
  })

  return { duration, time, playing, wantsPlay, waiting, ended, muted, volume, rate, buffered, failure, size, listeners, seek, play, pause, toggle, setMuted, setVolume, setRate, captureFrame }
}

export type VideoMedia = ReturnType<typeof useVideoMedia>
