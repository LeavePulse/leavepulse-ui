<script setup lang="ts">
/*
 * A theme's colours as a strip of swatches on its own surface, for a palette
 * preview of a theme picker: the row says the name, this shows what picking
 * it would look like. Any CSS colour works.
 *
 *   <LpPaletteSwatches
 *     :background="theme.colors.surface"
 *     :colors="[theme.colors.ink, theme.colors.brand, theme.colors.accent]"
 *   />
 *
 * A swatch that changes (the same row after a keepOpen pick) eases to its
 * new colour.
 */
defineProps<{
  colors: string[]
  /** The surface the swatches sit on, usually the theme's own. */
  background?: string
  /** Accessible name of the strip, e.g. the theme's name. */
  label?: string
}>()
</script>

<template>
  <div
    class="lp-palette-swatches"
    role="img"
    :aria-label="label"
    :style="{ background, gridTemplateColumns: `repeat(${Math.max(colors.length, 1)}, minmax(0, 1fr))` }"
  >
    <span v-for="(color, index) in colors" :key="index" :title="color" :style="{ background: color }" />
  </div>
</template>

<style scoped>
.lp-palette-swatches {
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  transition: background-color var(--duration-medium, 240ms) ease;
}
.lp-palette-swatches span {
  height: 2rem;
  border-radius: var(--radius-control);
  box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.25);
  transition: background-color var(--duration-medium, 240ms) ease;
}
@media (prefers-reduced-motion: reduce) {
  .lp-palette-swatches,
  .lp-palette-swatches span {
    transition: none;
  }
}
</style>
