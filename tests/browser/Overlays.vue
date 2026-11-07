<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { LpDropdownMenu, LpFrame, LpLightbox, LpModal } from "../../src"

const mode = new URLSearchParams(location.search).get("mode")
const open = ref(false)
const picked = ref("")
const search = ref("")
const copied = ref("")
const jpeg = ref("")

onMounted(() => {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 2
  canvas.getContext("2d")!.fillRect(0, 0, 2, 2)
  jpeg.value = canvas.toDataURL("image/jpeg")
})

const images = computed(() =>
  mode === "race"
    ? [{ src: "/overlays-slow.png", title: "Slow" }, { src: jpeg.value, title: "Quick" }]
    : [{ src: jpeg.value, title: "One" }, { src: `${jpeg.value}#2`, title: "Two" }],
)
const items = [{ label: "Pick", onSelect: () => (picked.value = "picked") }]
</script>

<template>
  <main class="flex flex-col items-start gap-4 p-6">
    <LpFrame v-if="mode === 'modal-frame'" :height="420" title="Frame">
      <div class="p-6">
        <button @click="open = true">Open</button>
        <LpModal v-model:open="open" title="Fields">
          <input aria-label="First" />
          <input aria-label="Second" />
        </LpModal>
      </div>
    </LpFrame>
    <template v-else-if="mode === 'modal-editor' || mode === 'modal-ring'">
      <button @click="open = true">Open</button>
      <LpModal v-model:open="open" title="Edit">
        <div v-if="mode === 'modal-editor'" contenteditable="true" aria-label="Editor">Text</div>
        <input v-else aria-label="Field" />
      </LpModal>
    </template>
    <template v-else-if="mode === 'dropdown'">
      <LpDropdownMenu :items="items" title="Row">
        <template #trigger><button>Actions</button></template>
      </LpDropdownMenu>
      <output aria-label="Picked">{{ picked }}</output>
    </template>
    <template v-else>
      <button @click="open = true">Open</button>
      <output aria-label="Copied">{{ copied }}</output>
      <LpLightbox v-model:open="open" :items="images" copyable rotatable @copy="(item, ok) => (copied = `${item.title}:${ok}`)">
        <template #actions><input v-model="search" aria-label="Search images" /></template>
      </LpLightbox>
    </template>
  </main>
</template>
