<script setup lang="ts">
import { ref } from "vue"
import { LpVideoTrim, type FrameRegion, type TimeRange } from "../../src"
import sample from "../../preview/assets/video-backdrop-sample.webm"

const params = new URLSearchParams(location.search)
const range = ref<TimeRange | null>(null)
const region = ref<FrameRegion | null>(null)
const changes = ref<TimeRange[]>([])
const limit = ref(true)
const errors = ref<string[]>([])
const src = params.get("src") ?? sample
</script>

<template>
  <div class="mx-auto max-w-3xl p-4">
    <LpVideoTrim
      v-model:range="range"
      v-model:region="region"
      :src="src"
      :max-clip="limit ? 2 : undefined"
      :min-clip="0.5"
      region-select
      @change="(r) => changes.push(r)"
      @error="(e) => errors.push(e.cause)"
    />
    <button type="button" data-test="limit" @click="limit = !limit">limit</button>
    <output data-test="range">{{ range ? range.join("–") : "none" }}</output>
    <output data-test="changes">{{ changes.length }}</output>
    <output data-test="region">{{ region ? [region.x, region.y, region.w, region.h].map((n) => n.toFixed(2)).join(",") : "none" }}</output>
    <output data-test="errors">{{ errors.join(",") }}</output>
  </div>
</template>
