<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { LpTour } from "../../src"

/*
 * A desktop app with rounded window corners clips the whole page: the
 * launcher puts `clip-path: inset(0 round 12px)` on body, and a rounded
 * `overflow: hidden` wrapper does the same job elsewhere. Chromium ignored
 * the tour scrim's own clip-path hole for its backdrop-filter under such an
 * ancestor, so the lit target came out blurred. `?clip=path` and
 * `?clip=overflow` set the two up; without it the page is plain.
 */
const clip = new URLSearchParams(location.search).get("clip")
const open = ref(false)
const steps = [
  { target: "#sharp", title: "Sharp target", text: "The hole shows it as it is." },
  { target: "#second", title: "Second target", text: "The hole glides here." },
]

onMounted(() => {
  const { body, documentElement: html } = document
  if (clip === "path") Object.assign(body.style, { clipPath: "inset(0 round 12px)", minHeight: "100vh", margin: "0" })
  if (clip === "overflow") {
    html.style.overflow = "hidden"
    Object.assign(body.style, { overflow: "hidden", borderRadius: "12px", height: "100vh", margin: "0", contain: "paint" })
  }
})

onBeforeUnmount(() => {
  document.body.removeAttribute("style")
  document.documentElement.removeAttribute("style")
})
</script>

<template>
  <main class="flex flex-col gap-6 p-6">
    <button type="button" class="self-start rounded border px-3 py-1" @click="open = true">Start tour</button>
    <!-- Hard black-and-white stripes: any blur over them greys the edges out. -->
    <div
      id="sharp"
      class="h-24 w-64"
      style="background: repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 4px)"
    />
    <button id="second" type="button" class="self-start rounded border px-3 py-1">Second</button>
    <LpTour v-model:open="open" :steps="steps" />
  </main>
</template>
