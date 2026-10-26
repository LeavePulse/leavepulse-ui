<script setup lang="ts">
import { ref } from "vue"
import { LpButton, LpShift } from "../../src"

const extra = ref(false)
</script>

<template>
  <div class="flex w-[640px] flex-wrap items-center justify-between gap-2 p-4">
    <input class="w-72 border" placeholder="Search" />
    <LpShift axis="width" data-testid="shift">
      <div class="flex flex-wrap items-center gap-1.5" data-testid="row">
        <LpButton size="sm" variant="ghost" @click="extra = !extra">Toggle</LpButton>
        <LpButton v-if="extra" size="sm" variant="ghost">Remind everyone without a schedule</LpButton>
        <LpButton size="sm" variant="ghost">CSV</LpButton>
      </div>
    </LpShift>
  </div>
</template>
