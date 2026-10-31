<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue"
import { LpShift } from "../../src"

const seconds = ref(8)
const shown = ref(false)
const timer = setInterval(() => { seconds.value += 1 }, 200)
const appear = setTimeout(() => { shown.value = true }, 500)
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(appear)
})
</script>

<template>
  <div class="w-96 p-4">
    <LpShift axis="height" data-testid="box">
      <div v-if="shown" data-testid="banner" class="mb-4 rounded border border-line px-3 py-2 text-sm">Paused for {{ seconds }} s</div>
    </LpShift>
    <p data-testid="below">Below</p>
  </div>
</template>
