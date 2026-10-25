<script setup lang="ts">
/*
 * A series' colour in a chart legend: a dot that swells while its legend
 * entry (the nearest `group`) is hovered. Internal; LpChart and LpPie draw
 * their legends with it so the two keep reading as one family.
 */
defineProps<{ color: string }>()
</script>

<template>
  <span
    class="size-2 shrink-0 rounded-full transition-transform duration-fast group-hover:scale-125"
    :style="{ backgroundColor: color }"
  />
</template>
