<script setup lang="ts">
/*
 * Trim and shrink a video on the person's own machine before it is uploaded.
 *
 *   <LpVideoCompress :file="file" @done="(out) => upload(out)" @skip="upload(file)" />
 *
 * - The picture plays from a local object URL, so nothing is sent while the
 *   person trims; LpVideoTrim does the trimming.
 * - A preset picks the height and bitrate, or a target size ("fit for a chat"),
 *   and the line under it estimates the result against the original.
 * - "Shrink" encodes with `transcodeVideo` (WebCodecs, hardware where there is
 *   some) with a progress bar and a cancel; `done` hands the new MP4 back.
 *   "Upload as is" emits `skip`: the original goes, untouched.
 * - A browser without a video encoder only offers `skip`, and says why.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"

import { useLocale } from "../composables/useLocale"
import { useLabels } from "../composables/useLpConfig"
import {
  canTranscodeVideo,
  clipLength,
  estimateTranscodedBytes,
  probeVideo,
  transcodeVideo,
  type TranscodeVideoOptions,
  type VideoInfo,
} from "../composables/videoTranscode"
import { formatBytes } from "./format"
import LpButton from "./LpButton.vue"
import LpCollapse from "./LpCollapse.vue"
import LpProgress from "./LpProgress.vue"
import LpSegmented from "./LpSegmented.vue"
import LpVideoTrim from "./LpVideoTrim.vue"
import type { TimeRange } from "./videoTrim"

/** Wording of the compressor. `{size}`, `{original}`, `{percent}` and `{error}` are filled in. */
export type VideoCompressLabels = {
  original: string
  p1080: string
  p720: string
  p480: string
  fit: string
  quality: string
  estimate: string
  probing: string
  shrink: string
  skip: string
  encoding: string
  cancel: string
  unsupported: string
  failed: string
  bigger: string
}

export interface VideoCompressPreset {
  key: string
  label: string
  maxHeight?: number | null
  targetBytes?: number | null
  videoBitrate?: number | null
}

const props = withDefaults(
  defineProps<{
    file: File
    /** The presets offered; the default set is original, 1080p, 720p, 480p and "fits 10 MB". */
    presets?: VideoCompressPreset[]
    /** The longest clip allowed, in seconds. */
    maxClip?: number
    disabled?: boolean
    labels?: Partial<VideoCompressLabels>
  }>(),
  { presets: undefined, maxClip: undefined, labels: () => ({}) },
)

const preset = defineModel<string>("preset", { default: "p720" })

const emit = defineEmits<{
  (e: "done", file: File, info: { range: TimeRange; preset: string }): void
  (e: "skip"): void
  (e: "busy", value: boolean): void
}>()

const text = useLabels<VideoCompressLabels>(
  "videoCompress",
  {
    original: "Original",
    p1080: "1080p",
    p720: "720p",
    p480: "480p",
    /** `{size}` is replaced by the target size. */
    fit: "Fits {size}",
    quality: "Quality",
    /** `{size}` and `{original}` are replaced by sizes; the size is a ceiling, simple pictures come out smaller. */
    estimate: "Up to about {size} instead of {original}",
    probing: "Reading the video…",
    shrink: "Shrink",
    skip: "Upload as is",
    /** `{percent}` is replaced by a number. */
    encoding: "Encoding on this device… {percent}%",
    cancel: "Cancel",
    unsupported: "This browser can't encode video, so the original will be uploaded.",
    /** `{error}` is replaced by the reason. */
    failed: "Couldn't encode: {error}",
    bigger: "The result wouldn't be smaller, so the original is better.",
  },
  () => props.labels,
)

const FIT_BYTES = 10 * 1024 * 1024
const locale = useLocale()
const size = (bytes: number) => formatBytes(bytes, locale.value)

const choices = computed<VideoCompressPreset[]>(() => props.presets ?? [
  { key: "original", label: text.value.original },
  { key: "p1080", label: text.value.p1080, maxHeight: 1080 },
  { key: "p720", label: text.value.p720, maxHeight: 720 },
  { key: "p480", label: text.value.p480, maxHeight: 480 },
  { key: "fit", label: text.value.fit.replace("{size}", size(FIT_BYTES)), maxHeight: 720, targetBytes: FIT_BYTES },
])

const url = ref("")
const info = shallowRef<VideoInfo | null>(null)
const supported = ref<boolean | null>(null)
const range = ref<TimeRange | null>(null)
const progress = ref<number | null>(null)
const error = ref("")
let controller: AbortController | null = null

function load(file: File): void {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = URL.createObjectURL(file)
  info.value = null
  range.value = null
  error.value = ""
  void probeVideo(file).then(
    (found) => { if (props.file === file) info.value = found },
    (cause: unknown) => { if (props.file === file) error.value = text.value.failed.replace("{error}", cause instanceof Error ? cause.message : String(cause)) },
  )
}

onMounted(() => {
  void canTranscodeVideo().then((ok) => (supported.value = ok))
})
watch(() => props.file, load, { immediate: true })
onBeforeUnmount(() => {
  controller?.abort()
  if (url.value) URL.revokeObjectURL(url.value)
})

const chosen = computed(() => choices.value.find((p) => p.key === preset.value) ?? choices.value[0])

const options = computed<TranscodeVideoOptions>(() => ({
  range: range.value,
  maxHeight: chosen.value?.maxHeight ?? null,
  targetBytes: chosen.value?.targetBytes ?? null,
  videoBitrate: chosen.value?.videoBitrate ?? null,
}))

const estimate = computed(() => (info.value ? estimateTranscodedBytes(info.value, options.value) : null))

const trimmed = computed(() => {
  const found = info.value
  return !!found && clipLength(found.duration, range.value) < found.duration - 0.05
})

const worthIt = computed(() => estimate.value !== null && (estimate.value < props.file.size * 0.95 || trimmed.value))

const estimateLine = computed(() => {
  if (estimate.value === null) return text.value.probing
  if (!worthIt.value) return text.value.bigger
  return text.value.estimate.replace("{size}", size(estimate.value)).replace("{original}", size(props.file.size))
})

const busy = computed(() => progress.value !== null)
watch(busy, (value) => emit("busy", value))

async function shrink(): Promise<void> {
  if (busy.value || !info.value) return
  controller = new AbortController()
  progress.value = 0
  error.value = ""
  try {
    const out = await transcodeVideo(props.file, {
      ...options.value,
      onProgress: (fraction) => (progress.value = fraction),
      signal: controller.signal,
    })
    emit("done", out, { range: range.value ?? [0, info.value.duration], preset: preset.value })
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === "AbortError")) {
      error.value = text.value.failed.replace("{error}", cause instanceof Error ? cause.message : String(cause))
    }
  } finally {
    progress.value = null
    controller = null
  }
}

function cancel(): void {
  controller?.abort()
}

const percent = computed(() => Math.round((progress.value ?? 0) * 100))
</script>

<template>
  <div class="flex flex-col gap-4" data-lp-video-compress>
    <LpVideoTrim v-model:range="range" :src="url" :max-clip="maxClip" :disabled="disabled || busy" />
    <div v-if="supported !== false" class="flex flex-col gap-2">
      <span class="text-xs font-medium text-muted">{{ text.quality }}</span>
      <LpSegmented
        v-model="preset"
        :options="choices.map((p) => ({ value: p.key, label: p.label }))"
        :disabled="disabled || busy"
        size="sm"
        class="max-w-full overflow-x-auto"
      />
      <p class="text-sm text-muted" aria-live="polite">{{ estimateLine }}</p>
    </div>
    <p v-else class="text-sm text-muted">{{ text.unsupported }}</p>
    <LpCollapse :open="!!error">
      <p class="text-sm text-danger" role="alert">{{ error }}</p>
    </LpCollapse>
    <LpCollapse :open="busy">
      <div class="flex flex-col gap-1.5">
        <LpProgress :value="percent" :max="100" />
        <span class="text-xs text-muted" aria-live="polite">{{ text.encoding.replace("{percent}", String(percent)) }}</span>
      </div>
    </LpCollapse>
    <div class="flex flex-wrap justify-end gap-2">
      <LpButton v-if="busy" variant="ghost" @click="cancel">{{ text.cancel }}</LpButton>
      <template v-else>
        <LpButton variant="ghost" :disabled="disabled" @click="emit('skip')">{{ text.skip }}</LpButton>
        <LpButton v-if="supported !== false" :disabled="disabled || !info || !worthIt" @click="shrink">{{ text.shrink }}</LpButton>
      </template>
    </div>
  </div>
</template>
