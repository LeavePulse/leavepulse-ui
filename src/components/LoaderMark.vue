<script setup lang="ts">
/*
 * The drawing inside LpLoader: one of the three indicators plus its text.
 * Internal — it exists so LpLoader can show the same mark on its own and as a
 * placeholder swapped with content without writing it out twice. Its root
 * takes the class and attributes LpLoader merged for it.
 */
import type { LoaderSize, LoaderVariant } from "./LpLoader.vue"

defineProps<{
  variant: LoaderVariant
  size: LoaderSize
  track: boolean
  label?: string
  /** What a screen reader hears when there is no visible label. */
  spoken: string
}>()

const SPINNER = { inline: "size-[1em]", sm: "size-3.5", md: "size-5", lg: "size-8" }
const DOT = { inline: "size-[0.25em]", sm: "size-1.5", md: "size-2", lg: "size-2.5" }
const BAR = { inline: "h-[0.2em]", sm: "h-0.5", md: "h-[3px]", lg: "h-1" }
</script>

<template>
  <span role="status">
    <template v-if="variant === 'bar'">
      <span v-if="label" class="text-xs text-muted">{{ label }}</span>
      <span class="lp-loader-bar relative block w-full overflow-hidden rounded-pill bg-current/15" :class="BAR[size]" aria-hidden="true">
        <span class="lp-loader-bar__run absolute inset-y-0 left-0 w-2/5 rounded-pill bg-current" />
      </span>
    </template>
    <template v-else>
      <svg v-if="variant === 'spinner'" viewBox="0 0 24 24" fill="none" class="lp-loader-spin shrink-0" :class="SPINNER[size]" aria-hidden="true">
        <circle v-if="track" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.2" />
        <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span v-else class="inline-flex shrink-0 items-center gap-[0.3em]" aria-hidden="true">
        <span
          v-for="i in 3"
          :key="i"
          class="lp-loader-dot rounded-full bg-current"
          :class="DOT[size]"
          :style="{ animationDelay: `${(i - 1) * 160}ms` }"
        />
      </span>
      <span v-if="label" class="text-sm text-muted">{{ label }}</span>
    </template>
    <span v-if="!label" class="sr-only">{{ spoken }}</span>
  </span>
</template>

<style>
/*
 * Unscoped, namespaced under lp-loader: the keyframes are named in the
 * elements' own `animation`, which a scoped stylesheet would rename.
 */
.lp-loader-spin {
  animation: lp-loader-spin 0.8s linear infinite;
}
@keyframes lp-loader-spin {
  to { transform: rotate(360deg); }
}

/* Each dot swells and brightens in turn: a wave that reads as "still going". */
.lp-loader-dot {
  animation: lp-loader-dot 0.96s var(--ease-emphasized, ease-in-out) infinite both;
}
@keyframes lp-loader-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
  40% { transform: scale(1); opacity: 1; }
}

/* The run enters from the left edge and leaves past the right, wider in the
   middle of its travel, so the bar never sits still and never looks full. */
.lp-loader-bar__run {
  animation: lp-loader-run 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
@keyframes lp-loader-run {
  0% { transform: translateX(-100%) scaleX(0.6); }
  50% { transform: translateX(80%) scaleX(1); }
  100% { transform: translateX(260%) scaleX(0.6); }
}
.lp-loader-bar__run:dir(rtl) {
  animation-direction: reverse;
}

@media (prefers-reduced-motion: reduce) {
  .lp-loader-spin,
  .lp-loader-dot,
  .lp-loader-bar {
    animation: lp-loader-breathe 1.6s ease-in-out infinite;
    transform: none;
  }
  .lp-loader-dot { opacity: 1; }
  .lp-loader-bar__run {
    animation: none;
    transform: none;
    width: 100%;
    opacity: 0.6;
  }
  @keyframes lp-loader-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
}
</style>
