<script setup lang="ts">
import { LpCard, LpStat } from "../../src"
</script>

<template>
  <div class="flex gap-3 p-4">
    <LpCard class="w-44" data-testid="short"><LpStat compact label="Messages" value="12" /></LpCard>
    <LpCard class="w-44" data-testid="long"><LpStat compact label="In voice" value="200 h 23 min" /></LpCard>
    <LpCard class="w-44" data-testid="huge"><LpStat compact label="Nothing" value="Nothing received from any source" /></LpCard>
  </div>
</template>
