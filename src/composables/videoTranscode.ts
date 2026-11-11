/*
 * Re-encoding a video in the browser before it is uploaded: cut to a range,
 * scale down, squeeze to a bitrate or a target size. WebCodecs does the work
 * (hardware encoders where the device has them) through mediabunny, which is
 * loaded only when a video is actually probed or encoded, so pages that never
 * touch a video don't download it.
 */
import type { TimeRange } from "../components/videoTrim"

export interface VideoInfo {
  /** Seconds. */
  duration: number
  /** Display size, after rotation. */
  width: number
  height: number
  /** Bytes of the file as given. */
  size: number
  hasAudio: boolean
}

export interface TranscodeVideoOptions {
  /** `[start, end]` in seconds; the whole video when unset. */
  range?: TimeRange | null
  /** Scale down to this height when the video is taller; never scales up. */
  maxHeight?: number | null
  /** Aim the result at this many bytes; the video bitrate is derived from it. */
  targetBytes?: number | null
  /** Video bitrate in bits per second; ignored when `targetBytes` is set. */
  videoBitrate?: number | null
  /** 0..1 as encoding goes. */
  onProgress?: (fraction: number) => void
  /** Aborting stops the encoders and rejects with an `AbortError`. */
  signal?: AbortSignal
}

/** Audio rate the estimate and the encoder share. */
export const TRANSCODE_AUDIO_BITRATE = 96_000
const MIN_VIDEO_BITRATE = 250_000
/* Container and key-frame overhead, kept off a target so the result lands under it. */
const TARGET_HEADROOM = 0.92

const loadLib = () => import("mediabunny")

/** A sensible video bitrate for a height, bits per second. */
export function bitrateForHeight(height: number): number {
  if (height <= 480) return 1_200_000
  if (height <= 720) return 2_500_000
  if (height <= 1080) return 5_000_000
  return 8_000_000
}

/** The height the output will have: the source's, or `maxHeight` when the source is taller, always even. */
export function outputHeight(sourceHeight: number, maxHeight?: number | null): number {
  const height = maxHeight && sourceHeight > maxHeight ? maxHeight : sourceHeight
  return Math.max(2, Math.round(height / 2) * 2)
}

/** Length of the clip that will be encoded, seconds. */
export function clipLength(duration: number, range?: TimeRange | null): number {
  if (!range) return duration
  const start = Math.max(0, Math.min(range[0], range[1]))
  const end = Math.min(duration, Math.max(range[0], range[1]))
  return Math.max(0, end - start)
}

type Planned = Pick<VideoInfo, "duration" | "height" | "hasAudio"> & Partial<Pick<VideoInfo, "size">>

/** The source's own video bitrate, from its size and length; null when unknown. */
function sourceBitrate(info: Planned): number | null {
  if (!info.size || info.duration <= 0) return null
  const audio = info.hasAudio ? TRANSCODE_AUDIO_BITRATE : 0
  return Math.max(MIN_VIDEO_BITRATE, Math.floor((info.size * 8) / info.duration - audio))
}

/**
 * The video bitrate an encode will use, bits per second. Never above the
 * source's own: re-encoding adds no detail, only bytes.
 */
export function plannedVideoBitrate(info: Planned, options: TranscodeVideoOptions = {}): number {
  const length = clipLength(info.duration, options.range)
  const ceiling = sourceBitrate(info) ?? Infinity
  if (options.targetBytes && length > 0) {
    const audio = info.hasAudio ? TRANSCODE_AUDIO_BITRATE : 0
    return Math.min(ceiling, Math.max(MIN_VIDEO_BITRATE, Math.floor((options.targetBytes * 8 * TARGET_HEADROOM) / length - audio)))
  }
  return Math.min(ceiling, options.videoBitrate ?? bitrateForHeight(outputHeight(info.height, options.maxHeight)))
}

/** Roughly how many bytes an encode with these options will produce. */
export function estimateTranscodedBytes(info: Planned, options: TranscodeVideoOptions = {}): number {
  const length = clipLength(info.duration, options.range)
  const audio = info.hasAudio ? TRANSCODE_AUDIO_BITRATE : 0
  return Math.round(((plannedVideoBitrate(info, options) + audio) * length) / 8)
}

/** Whether this browser can encode video at all (WebCodecs with an H.264, VP9 or AV1 encoder). */
export async function canTranscodeVideo(): Promise<boolean> {
  if (typeof globalThis.VideoEncoder === "undefined" || typeof globalThis.VideoDecoder === "undefined") return false
  try {
    const lib = await loadLib()
    return (await lib.getFirstEncodableVideoCodec(["avc", "vp9", "av1"])) !== null
  } catch {
    return false
  }
}

/** Length, size and whether there is sound, read from the file's headers without decoding it. */
export async function probeVideo(file: Blob): Promise<VideoInfo> {
  const lib = await loadLib()
  const input = new lib.Input({ source: new lib.BlobSource(file), formats: lib.ALL_FORMATS })
  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new Error("The file has no video track")
    const [duration, width, height, audio] = await Promise.all([
      input.computeDuration(),
      video.getDisplayWidth(),
      video.getDisplayHeight(),
      input.getPrimaryAudioTrack(),
    ])
    return { duration, width, height, size: file.size, hasAudio: audio !== null }
  } finally {
    input.dispose()
  }
}

function abortError(): DOMException {
  return new DOMException("The video encode was aborted", "AbortError")
}

/** The file name with an `.mp4` extension, which is what comes out. */
export function transcodedName(name: string): string {
  const dot = name.lastIndexOf(".")
  return `${dot > 0 ? name.slice(0, dot) : name || "video"}.mp4`
}

/**
 * An MP4 with the range cut out, scaled down to `maxHeight` and encoded at the
 * planned bitrate. Sound is kept and re-encoded (AAC, or Opus where the
 * browser has no AAC encoder); a browser that can encode neither the picture
 * nor the sound rejects instead of returning a silent or broken file.
 */
export async function transcodeVideo(file: File, options: TranscodeVideoOptions = {}): Promise<File> {
  if (options.signal?.aborted) throw abortError()
  const lib = await loadLib()
  const info = await probeVideo(file)
  const height = outputHeight(info.height, options.maxHeight)
  const width = Math.max(2, Math.round((info.width * height) / info.height / 2) * 2)
  const bitrate = plannedVideoBitrate(info, options)
  const videoCodec = await lib.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width, height, quality: new lib.Quality({ bitrate }) })
  if (!videoCodec) throw new Error("This browser can't encode video of this size")
  const audioCodec = info.hasAudio ? await lib.getFirstEncodableAudioCodec(["aac", "opus"], { quality: new lib.Quality({ bitrate: TRANSCODE_AUDIO_BITRATE }) }) : null
  if (info.hasAudio && !audioCodec) throw new Error("This browser can't encode this video's sound")

  const input = new lib.Input({ source: new lib.BlobSource(file), formats: lib.ALL_FORMATS })
  const target = new lib.BufferTarget()
  const output = new lib.Output({ format: new lib.Mp4OutputFormat({ fastStart: "in-memory" }), target })
  try {
    const range = options.range ?? null
    const conversion = await lib.Conversion.init({
      input,
      output,
      trim: range ? { start: Math.min(range[0], range[1]), end: Math.max(range[0], range[1]) } : undefined,
      video: {
        height: height === info.height ? undefined : height,
        codec: videoCodec,
        quality: new lib.Quality({ bitrate }),
        forceTranscode: true,
      },
      audio: audioCodec ? { codec: audioCodec, quality: new lib.Quality({ bitrate: TRANSCODE_AUDIO_BITRATE }) } : { discard: true },
    })
    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map((t) => t.reason).join(", ")
      throw new Error(`This video can't be re-encoded here (${reasons || "unknown reason"})`)
    }
    const onAbort = () => void conversion.cancel()
    options.signal?.addEventListener("abort", onAbort, { once: true })
    conversion.onProgress = (progress) => options.onProgress?.(progress)
    try {
      await conversion.execute()
    } catch (error) {
      if (options.signal?.aborted) throw abortError()
      throw error
    } finally {
      options.signal?.removeEventListener("abort", onAbort)
    }
    if (!target.buffer) throw new Error("The encoder produced no file")
    options.onProgress?.(1)
    return new File([target.buffer], transcodedName(file.name), { type: "video/mp4", lastModified: Date.now() })
  } finally {
    input.dispose()
  }
}
