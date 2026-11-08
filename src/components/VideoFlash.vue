<script setup lang="ts">
/*
 * The answer to a play or pause on LpVideoPlayer and LpVideoTrim: a round
 * badge with what just happened, in the middle of the picture, that swells a
 * little and fades. A press on the picture, or Space with the eyes on it,
 * otherwise has only the motion itself to confirm it, and a pause on a still
 * scene shows nothing at all. Each new `flash` replays it; reduced motion has none.
 */
import LpIcon from "./LpIcon.vue"

defineProps<{
  /** What happened, and a count that changes on every press so the same icon twice still plays twice. */
  flash: { icon: string; n: number } | null
}>()
</script>

<template>
  <div class="pointer-events-none absolute inset-0 flex items-center justify-center motion-reduce:hidden" aria-hidden="true">
    <span
      v-if="flash"
      :key="flash.n"
      class="lp-video-flash flex size-16 items-center justify-center rounded-full bg-black/50 text-white opacity-0"
    >
      <LpIcon :name="flash.icon" :size="28" :class="flash.icon === 'lucide:play' ? 'translate-x-0.5' : ''" />
    </span>
  </div>
</template>

<style scoped>
/* Rises into view, holds a moment, then swells away: arriving at full strength in one frame read as a blink. */
.lp-video-flash {
  animation: lp-video-flash 700ms var(--ease-emphasized) both;
}
@keyframes lp-video-flash {
  0% {
    opacity: 0;
    scale: 0.8;
  }
  25% {
    opacity: 1;
    scale: 1;
  }
  45% {
    opacity: 1;
    scale: 1;
  }
  100% {
    opacity: 0;
    scale: 1.15;
  }
}
</style>
