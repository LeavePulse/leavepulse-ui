<script setup lang="ts">
// A correct use: must stay free of errors against the packed declarations.
import { LpChart, LpTooltip } from "@leavepulse/ui"
</script>

<template>
  <LpTooltip content="Delete server" side="top" />
  <LpChart :series="[]" :labels="['a']" />
</template>
