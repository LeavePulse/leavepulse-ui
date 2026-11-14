<script setup lang="ts">
import { onMounted, ref } from "vue"
import { LpTour } from "../../src"

const open = ref(false)
const moved = ref(false)
const steps = [{ target: "#swapped", title: "Moving target", text: "Follows the element." }]

onMounted(() => {
  Object.assign(window, { swapTarget: () => (moved.value = true) })
})
</script>

<template>
  <main class="flex flex-col gap-4 p-6">
    <button type="button" class="self-start rounded border px-3 py-1" @click="open = true">Start tour</button>
    <div :style="{ height: moved ? '400px' : '40px' }" />
    <button id="swapped" :key="moved ? 'after' : 'before'" type="button" class="self-start rounded border px-3 py-1">{{ moved ? "After" : "Before" }}</button>
    <LpTour v-model:open="open" :steps="steps" />
  </main>
</template>
