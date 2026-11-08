/*
 * Stills for LpVideoTrim's timeline, taken from a second, hidden <video> of the
 * same address: seek, wait for the frame, draw it on a small canvas.
 *
 * - One seek at a time. A seek started while another runs is dropped by some
 *   engines and freezes WebKitGTK's GStreamer pipeline (WebKit bug 194499);
 *   a seek that never answers is given up after a while, so one bad spot does
 *   not stop the strip.
 * - A seek lands on a key frame where the engine can (`fastSeek`, WebKit and
 *   Firefox): a thumbnail needs a nearby frame, not the exact one, and a key
 *   frame needs no decoding forward from the previous one.
 * - Asking again replaces what is still queued: zooming or panning should not
 *   wait for stills of a stretch already scrolled away.
 * - The canvas is only ever drawn, never read back, so a video from another
 *   origin without CORS still gives stills (a tainted canvas still shows).
 */

const SEEK_TIMEOUT_MS = 4000
const FRAME_TIMEOUT_MS = 250
const CACHE_LIMIT = 240

export interface FrameRequest {
  key: string
  time: number
}

type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number
  fastSeek?: (time: number) => void
}

export class FrameSampler {
  private queue: FrameRequest[] = []
  private running = false
  private disposed = false
  private cache = new Map<string, HTMLCanvasElement>()

  constructor(
    private readonly video: VideoWithFrames,
    private readonly size: () => { width: number; height: number },
    private readonly onFrame: (key: string, canvas: HTMLCanvasElement) => void,
  ) {}

  /** A frame taken earlier, if it is still kept. */
  cached(key: string): HTMLCanvasElement | undefined {
    const hit = this.cache.get(key)
    if (hit) {
      // Least recently used goes first: refresh this one's place.
      this.cache.delete(key)
      this.cache.set(key, hit)
    }
    return hit
  }

  /** The frames wanted now, most wanted first; whatever was queued before is dropped. */
  want(requests: FrameRequest[]): void {
    this.queue = requests.filter((r) => !this.cache.has(r.key))
    void this.pump()
  }

  dispose(): void {
    this.disposed = true
    this.queue = []
    this.cache.clear()
  }

  private async pump() {
    if (this.running) return
    this.running = true
    try {
      while (!this.disposed && this.queue.length) {
        const next = this.queue.shift()!
        if (this.cache.has(next.key)) continue
        const canvas = await this.take(next.time)
        if (this.disposed) return
        if (!canvas) continue
        this.cache.set(next.key, canvas)
        if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value as string)
        this.onFrame(next.key, canvas)
      }
    } finally {
      this.running = false
    }
  }

  private async take(time: number): Promise<HTMLCanvasElement | null> {
    const video = this.video
    if (video.readyState < 1) {
      const ready = await this.once("loadedmetadata", SEEK_TIMEOUT_MS)
      if (!ready) return null
    }
    const target = Math.min(Math.max(0, time), Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : time)
    const seeked = this.once("seeked", SEEK_TIMEOUT_MS)
    if (video.fastSeek) video.fastSeek(target)
    else video.currentTime = target
    if (!(await seeked)) return null
    await this.framePresented()
    if (this.disposed || !video.videoWidth) return null
    const { width, height } = this.size()
    const ratio = Math.min(2, video.ownerDocument.defaultView?.devicePixelRatio ?? 1)
    const canvas = video.ownerDocument.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    // Cover the tile, as object-fit: cover would: a strip of letterboxes reads as broken.
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
    const w = video.videoWidth * scale
    const h = video.videoHeight * scale
    try {
      ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
    } catch {
      return null
    }
    return canvas
  }

  /*
   * `seeked` says the position moved, not that its picture is ready to draw:
   * Chromium can still hand the previous frame for a moment. Wait for the
   * frame where the engine reports it, and a couple of paints where not.
   */
  private framePresented(): Promise<void> {
    const video = this.video
    const win = video.ownerDocument.defaultView
    return new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(finish)
        win?.setTimeout(finish, FRAME_TIMEOUT_MS)
      } else if (win) {
        win.requestAnimationFrame(() => win.requestAnimationFrame(finish))
      } else finish()
    })
  }

  private once(event: string, timeout: number): Promise<boolean> {
    const video = this.video
    const win = video.ownerDocument.defaultView
    return new Promise((resolve) => {
      const finish = (ok: boolean) => {
        video.removeEventListener(event, onEvent)
        video.removeEventListener("error", onError)
        if (timer) win?.clearTimeout(timer)
        resolve(ok)
      }
      const onEvent = () => finish(true)
      const onError = () => finish(false)
      video.addEventListener(event, onEvent)
      video.addEventListener("error", onError)
      const timer = win?.setTimeout(() => finish(false), timeout)
    })
  }
}

/**
 * Seconds one still stands for at this zoom: the shortest power of two that
 * keeps a still at least `minPx` wide. Stills sit at fixed points in time, so
 * panning reuses the ones already taken and a zoom step of two keeps half.
 */
export function stillSpan(secondsPerPx: number, minPx: number): number {
  const wanted = secondsPerPx * minPx
  let span = 1 / 8
  while (span < wanted && span < 8192) span *= 2
  return span
}
