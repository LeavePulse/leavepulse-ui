<script setup lang="ts">
import { defineComponent, h } from "vue"
import { LpIcon, LpLoader, LpProgress, provideLpConfig } from "../../src"
import { pixelLook } from "../../src/look-pixel"

const Scope = defineComponent({
  props: { pixel: Boolean },
  setup(props, { slots }) {
    provideLpConfig(() => ({ look: props.pixel ? pixelLook : undefined }))
    return () => h("div", { "data-lp-motion": props.pixel ? pixelLook.motion : undefined }, slots.default?.())
  },
})
</script>

<template>
  <div class="flex flex-col gap-6 bg-surface p-6 text-ink">
    <Scope v-for="pixel in [false, true]" :key="String(pixel)" :pixel="pixel" :data-test="pixel ? 'pixel' : 'plain'">
      <div class="flex items-center gap-4">
        <LpIcon data-test="mapped" name="lucide:x" />
        <LpIcon data-test="unmapped" name="lucide:accessibility" />
        <LpLoader data-test="loader" :delay="0" />
        <LpLoader data-test="explicit" variant="dots" :delay="0" />
        <LpProgress data-test="progress" :value="50" :animate-on-mount="false" />
      </div>
    </Scope>
  </div>
</template>
