<script setup lang="ts">
import { ref } from "vue"
import { LpSkeleton } from "../../src"

const loading = ref(false)
</script>

<template>
  <div class="bg-surface p-6">
    <LpSkeleton class="space-y-3">
      <div data-test="plain" class="lp-skeleton-item h-4 w-32 rounded-control" />
      <div data-test="own" class="lp-skeleton-item h-4 w-32 rounded-control bg-surface-raised" />
    </LpSkeleton>
    <button data-test="load" type="button" @click="loading = true">load</button>
    <template v-if="loading">
      <LpSkeleton data-test="delayed" class="h-4 w-32" />
      <LpSkeleton data-test="immediate" immediate class="h-4 w-32" />
    </template>
  </div>
</template>
