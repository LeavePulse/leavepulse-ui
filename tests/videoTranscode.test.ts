import { describe, expect, test } from "bun:test"

import {
  bitrateForHeight,
  clipLength,
  estimateTranscodedBytes,
  outputHeight,
  plannedVideoBitrate,
  transcodedName,
  TRANSCODE_AUDIO_BITRATE,
} from "../src/composables/videoTranscode"

const info = { duration: 120, height: 1080, hasAudio: true }

describe("videoTranscode", () => {
  test("scales down only, to an even height", () => {
    expect(outputHeight(1080, 720)).toBe(720)
    expect(outputHeight(480, 720)).toBe(480)
    expect(outputHeight(1081, null)).toBe(1082)
  })

  test("the clip is the range inside the video, either way round", () => {
    expect(clipLength(120)).toBe(120)
    expect(clipLength(120, [30, 10])).toBe(20)
    expect(clipLength(120, [100, 200])).toBe(20)
  })

  test("a target size sets the bitrate so the file lands under it", () => {
    const target = 10 * 1024 * 1024
    const bitrate = plannedVideoBitrate(info, { targetBytes: target, range: [0, 60] })
    expect(((bitrate + TRANSCODE_AUDIO_BITRATE) * 60) / 8).toBeLessThan(target)
    expect(plannedVideoBitrate(info, { targetBytes: 1000, range: [0, 60] })).toBe(250_000)
  })

  test("without a target the bitrate follows the output height", () => {
    expect(plannedVideoBitrate(info, { maxHeight: 720 })).toBe(bitrateForHeight(720))
    expect(estimateTranscodedBytes(info, { maxHeight: 720, range: [0, 8] })).toBe(Math.round(((2_500_000 + 96_000) * 8) / 8))
  })

  test("the bitrate never exceeds the source's own", () => {
    const small = { duration: 6, height: 360, hasAudio: false, size: 36_994 }
    expect(plannedVideoBitrate(small, {})).toBe(250_000)
    expect(estimateTranscodedBytes({ ...info, size: 300 * 1024 * 1024 }, { maxHeight: 720 })).toBeLessThan(300 * 1024 * 1024)
  })

  test("the result is an mp4", () => {
    expect(transcodedName("clip.MOV")).toBe("clip.mp4")
    expect(transcodedName("noext")).toBe("noext.mp4")
  })
})
