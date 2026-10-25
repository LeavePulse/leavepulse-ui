<script setup lang="ts">
/*
 * One row of LpThemeStudio: a small caps label over its controls. The studio
 * builds its own rows with it, and an app adding its own (a font, a density
 * of its own, a layout switch) through the studio's slots uses it too, so the
 * added row reads as part of the panel.
 */
defineProps<{ label: string }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-[11px] font-medium tracking-wide text-muted uppercase">{{ label }}</span>
    <slot />
  </div>
</template>
