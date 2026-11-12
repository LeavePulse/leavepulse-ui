<script setup lang="ts">
import { LpSkeleton } from "../../src"
</script>

<template>
  <div class="bg-surface p-6">
    <LpSkeleton class="space-y-3">
      <div data-test="plain" class="lp-skeleton-item h-4 w-32 rounded-control" />
      <div data-test="own" class="lp-skeleton-item h-4 w-32 rounded-control bg-surface-raised" />
    </LpSkeleton>
  </div>
</template>
