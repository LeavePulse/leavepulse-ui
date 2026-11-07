<script setup lang="ts">
/* The track of a slider and the filled part of it, one thumb or two. */
import { SliderRange, SliderTrack } from "reka-ui"
</script>

<template>
  <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-pill bg-surface-soft">
    <SliderRange class="absolute h-full rounded-pill bg-brand" />
  </SliderTrack>
</template>
