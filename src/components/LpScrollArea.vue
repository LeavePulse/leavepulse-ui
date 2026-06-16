<script setup lang="ts">
/*
 * Drawn overlay scrollbar (reka ScrollArea). Floats over content — never
 * reserves layout width, so the viewport doesn't jump. Thin at rest, a touch
 * thicker on hover; fades in/out (reka Presence keeps it mounted through the
 * exit animation). Rounded only on the OUTER edge — the side flush to the wall
 * stays square. Themed via tokens; native scroll/keyboard/touch preserved.
 */
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "reka-ui"

// `fade` softens the top/bottom edges to hint more content.
// `contentClass` styles the scrollable CONTENT container (the viewport's inner
// wrapper) — put list layout here (display:grid / gap / padding), not on the
// component root, since items live inside reka's viewport.
defineProps<{ fade?: boolean; contentClass?: string }>()

const barFade =
  "data-[state=visible]:animate-[fade-in_180ms_ease] data-[state=hidden]:animate-[fade-out_240ms_ease]"
</script>

<template>
  <ScrollAreaRoot class="relative overflow-hidden" type="hover" :scroll-hide-delay="500">
    <ScrollAreaViewport
      class="size-full [&>div]:!block"
      :class="fade ? '[mask-image:linear-gradient(to_bottom,transparent_0,black_14px,black_calc(100%-14px),transparent_100%)]' : ''"
    >
      <div :class="contentClass">
        <slot />
      </div>
    </ScrollAreaViewport>

    <ScrollAreaScrollbar
      orientation="vertical"
      class="group flex w-1 touch-none select-none p-px transition-[width] duration-[var(--duration-fast)] hover:w-1.5"
      :class="barFade"
    >
      <ScrollAreaThumb
        class="flex-1 rounded-l-pill bg-brand/40 transition-colors group-hover:bg-brand"
      />
    </ScrollAreaScrollbar>

    <ScrollAreaScrollbar
      orientation="horizontal"
      class="group flex h-1 flex-col touch-none select-none p-px transition-[height] duration-[var(--duration-fast)] hover:h-1.5"
      :class="barFade"
    >
      <ScrollAreaThumb
        class="flex-1 rounded-t-pill bg-brand/40 transition-colors group-hover:bg-brand"
      />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
