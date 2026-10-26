<script setup lang="ts">
/*
 * One row of LpThemeStudio: a label and its controls. The studio builds its
 * own rows with it, and an app adding its own (a font, a density of its own,
 * a layout switch) through the studio's slots uses it too, so the added row
 * reads as part of the panel.
 *
 * `inline` puts a single control beside its label, as a settings row does: a
 * three-way switch under a label of its own read as three loose rows of
 * buttons, and on a wide page it sat in the corner of an empty stripe.
 */
defineProps<{ label: string; inline?: boolean }>()
</script>

<template>
  <div v-if="inline" class="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
    <span class="text-xs font-medium text-muted-strong">{{ label }}</span>
    <slot />
  </div>
  <div v-else class="flex flex-col gap-2">
    <span class="text-xs font-medium text-muted-strong">{{ label }}</span>
    <slot />
  </div>
</template>
