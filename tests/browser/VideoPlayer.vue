<script setup lang="ts">
import { ref } from "vue"
import { LpButton, LpIcon, LpVideoPlayer } from "../../src"
import sample from "../../preview/assets/video-backdrop-sample.webm"

const events = ref<string[]>([])
</script>

<template>
  <div class="mx-auto max-w-3xl p-4">
    <LpVideoPlayer :src="sample" title="Sample clip" :remember="false" @play="events.push('play')" @pause="events.push('pause')" @ended="events.push('ended')">
      <template #actions="{ buttonClass }">
        <LpButton size="sm" variant="ghost" square :class="buttonClass" aria-label="Remove video" @click="events.push('removed')">
          <LpIcon name="lucide:trash-2" :size="16" />
        </LpButton>
      </template>
    </LpVideoPlayer>
    <output data-test="events">{{ events.join(",") }}</output>
  </div>
</template>
