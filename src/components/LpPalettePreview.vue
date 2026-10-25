<script setup lang="ts">
/*
 * The body of LpCommandPalette's `#preview` slot. It spaces the blocks inside
 * it (LpPaletteHeader, LpPaletteFacts, LpPaletteStats, LpKeys, anything of the
 * app's own) and brings them in one after another, the way the palette's own
 * pane brings in paragraphs. Every app that filled the slot wrote this same
 * wrapper with the same stagger; it is one element here.
 *
 *   <template #preview="{ command, highlight }">
 *     <LpPalettePreview>
 *       <LpPaletteHeader :eyebrow="command.group" :title="highlight(command.label)" />
 *       <LpPaletteFacts :items="rows" />
 *     </LpPalettePreview>
 *   </template>
 *
 * The pane remounts its body for every highlighted row, so the entrance plays
 * per row; reduced motion shows the blocks at once.
 */
withDefaults(
  defineProps<{
    /** Space between blocks. */
    gap?: "sm" | "md" | "lg"
  }>(),
  { gap: "md" },
)
</script>

<template>
  <div class="lp-palette-preview" :class="`lp-palette-preview--${gap}`">
    <slot />
  </div>
</template>

<style>
.lp-palette-preview {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: var(--color-ink);
}
.lp-palette-preview--sm {
  gap: 0.6rem;
}
.lp-palette-preview--md {
  gap: 0.9rem;
}
.lp-palette-preview--lg {
  gap: 1.25rem;
}
.lp-palette-preview > * {
  min-width: 0;
  --rise: 4px;
  animation: rise-in 260ms var(--ease-emphasized, ease-out) both;
}
.lp-palette-preview > :nth-child(2) {
  animation-delay: 40ms;
}
.lp-palette-preview > :nth-child(3) {
  animation-delay: 80ms;
}
.lp-palette-preview > :nth-child(4) {
  animation-delay: 120ms;
}
.lp-palette-preview > :nth-child(n + 5) {
  animation-delay: 160ms;
}
@media (prefers-reduced-motion: reduce) {
  .lp-palette-preview > * {
    animation: none;
  }
}
</style>
