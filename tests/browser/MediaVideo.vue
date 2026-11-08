<script setup lang="ts">
import { LpMediaGallery, type LightboxItem } from "../../src"
import picture from "../../preview/assets/avatar-sample.png"
import clip from "../../preview/assets/video-backdrop-sample.webm"

const items: LightboxItem[] = [
  { src: picture, title: "Avatar" },
  { src: clip, title: "Evidence clip" },
  { src: `${clip}?as=api`, kind: "video", title: "From an API route", duration: 6 },
]
</script>

<template>
  <div class="mx-auto max-w-3xl p-4">
    <LpMediaGallery :items="items" />
  </div>
</template>
