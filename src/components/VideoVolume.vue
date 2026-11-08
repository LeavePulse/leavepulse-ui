<script setup lang="ts">
/*
 * Sound for LpVideoPlayer and LpVideoTrim: the mute button, and beside it a
 * volume slider that opens while the pointer or the focus is on either, the
 * way most players keep it out of the way until it is reached for. On a touch
 * screen the slider stays closed: a phone's own buttons set the volume, and a
 * thin slider under a thumb only gets in the way.
 */
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpSlider from "./LpSlider.vue"
import type { VideoMedia } from "../composables/useVideoMedia"
import { ICON_SWAP, OVERLAY_BUTTON } from "./videoMotion"

const props = defineProps<{
  media: VideoMedia
  labels: { mute: string; unmute: string; volume: string }
  disabled?: boolean
  /** Over the picture (white on the video) rather than on the page. */
  overlay?: boolean
}>()

const icon = () => {
  const { muted, volume } = props.media
  if (muted.value || volume.value === 0) return "lucide:volume-x"
  return volume.value < 0.5 ? "lucide:volume-1" : "lucide:volume-2"
}
</script>

<template>
  <div class="group/volume flex items-center">
    <LpButton
      size="sm"
      variant="ghost"
      square
      :class="overlay ? OVERLAY_BUTTON : ''"
      :disabled="disabled"
      :aria-label="media.muted.value ? labels.unmute : labels.mute"
      :title="media.muted.value ? labels.unmute : labels.mute"
      :aria-pressed="media.muted.value"
      @click="media.setMuted(!media.muted.value)"
    >
      <!-- Muting, and the volume crossing a half, hand the icon over instead of swapping it in one frame. -->
      <Transition v-bind="ICON_SWAP">
        <LpIcon :key="icon()" :name="icon()" :size="16" />
      </Transition>
    </LpButton>
    <div
      class="w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-(--duration-medium) ease-(--ease-emphasized) group-hover/volume:w-20 group-hover/volume:opacity-100 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 pointer-coarse:hidden motion-reduce:transition-none"
    >
      <LpSlider
        class="mx-2 w-16"
        :model-value="media.muted.value ? 0 : Math.round(media.volume.value * 100)"
        :min="0"
        :max="100"
        :step="5"
        :disabled="disabled"
        :aria-label="labels.volume"
        @update:model-value="(v: number) => media.setVolume(v / 100)"
      />
    </div>
  </div>
</template>
