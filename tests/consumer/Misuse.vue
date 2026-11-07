<script setup lang="ts">
// Each mistake here must stay an error: scripts/check-consumer.mjs asserts it.
import { LpChart, LpTooltip } from "@leavepulse/ui"
</script>

<template>
  <LpTooltip text="Delete server" />
  <LpChart :series="[]" :categories="['a']" />
  <LpTooltip :side="'nowhere'" />
</template>
