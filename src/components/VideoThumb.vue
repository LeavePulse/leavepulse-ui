<script setup lang="ts">
/*
 * A video's face in a grid or a strip (LpMediaGallery's tile, LpLightbox's
 * filmstrip): its poster, or without one its first frame, under a round play
 * badge and, when there is room and it is known, its length.
 *
 * Without a poster the frame comes from the video itself: metadata and the
 * one frame at a tenth of a second (a media fragment), never the whole file.
 * Its length comes along with the metadata when the item did not say it.
 */
import { computed, ref } from "vue"
import LpIcon from "./LpIcon.vue"
import type { LightboxItem } from "./lightbox"
import { formatClipTime } from "./videoBackdrop"

const props = defineProps<{
  item: LightboxItem
  /** Classes for the picture itself (the gallery's blur and dimming ride on it). */
  mediaClass?: string | (string | false | undefined)[]
  /** A small thumbnail: the badge shrinks and the length is left out. */
  compact?: boolean
  alt?: string
}>()

const measured = ref<number | null>(null)
const length = computed(() => props.item.duration ?? measured.value)
const still = computed(() => props.item.poster ?? props.item.thumb)
</script>

<template>
  <img
    v-if="still"
    :src="still"
    :alt="alt ?? ''"
    loading="lazy"
    decoding="async"
    class="size-full object-cover"
    :class="mediaClass"
    draggable="false"
  />
  <video
    v-else
    :src="`${item.src}#t=0.1`"
    preload="metadata"
    muted
    playsinline
    tabindex="-1"
    aria-hidden="true"
    class="pointer-events-none size-full object-cover"
    :class="mediaClass"
    @loadedmetadata="(e) => Number.isFinite((e.target as HTMLVideoElement).duration) && (measured = (e.target as HTMLVideoElement).duration)"
  />
  <span class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
    <span
      class="flex items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/25 transition-transform duration-(--duration-fast) ease-(--ease-emphasized) group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      :class="compact ? 'size-6' : 'size-10'"
    >
      <LpIcon name="lucide:play" :size="compact ? 12 : 18" class="translate-x-px" />
    </span>
  </span>
  <span
    v-if="!compact && length"
    class="pointer-events-none absolute right-1.5 bottom-1.5 rounded-pill bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums"
    aria-hidden="true"
  >{{ formatClipTime(length) }}</span>
</template>
