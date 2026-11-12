<script setup lang="ts">
import { ref } from "vue"
import { LpMediaGallery, type LightboxItem } from "../../src"
import picture from "../../preview/assets/avatar-sample.png"
import clip from "../../preview/assets/video-backdrop-sample.webm"

const items: LightboxItem[] = [
  { src: picture, title: "Avatar" },
  { src: clip, title: "Evidence clip" },
  { src: `${clip}?as=api`, kind: "video", title: "From an API route", duration: 6 },
  { src: picture + "?full", thumb: "/missing-thumb.png", title: "Thumb gone" },
  { src: "/missing-image.png", title: "Gone for good" },
]
const broken = ref<string[]>([])
</script>

<template>
  <div class="mx-auto max-w-3xl p-4">
    <LpMediaGallery :items="items" @broken="(item) => broken.push(item.title ?? '')" />
    <output data-testid="broken">{{ broken.join(",") }}</output>
  </div>
</template>
