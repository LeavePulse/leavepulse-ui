<script setup lang="ts">
/*
 * The live miniature on an index card: the entry's `thumb` template, compiled
 * like the full example but mounted only once the card scrolls into view
 * (useReveal), and inert, so the index stays one tab stop per card.
 */
import { computed, defineComponent, onErrorCaptured, reactive, ref, type Component } from "vue"
import { LpIcon, useReveal } from "../../src"
import type { ComponentEntry } from "./registry"

const props = defineProps<{ entry: ComponentEntry; icon?: string }>()

const { el, revealed } = useReveal({ threshold: 0.05, rootMargin: "200px 0px" })
// Made when the card first shows, not for all the cards at once on load.
const state = computed(() =>
  revealed.value ? reactive(props.entry.thumbState === false ? {} : (props.entry.state?.() ?? {})) : {},
)
const failed = ref(false)

const View = computed<Component | null>(() =>
  props.entry.thumb
    ? { components: props.entry.components, setup: () => state.value, template: props.entry.thumb.trim() }
    : null,
)

const Boundary = defineComponent({
  setup(_, { slots }) {
    onErrorCaptured(() => {
      failed.value = true
      return false
    })
    return () => slots.default?.()
  },
})
</script>

<template>
  <div ref="el" inert class="relative flex h-48 items-center justify-center overflow-hidden bg-surface p-4 [justify-content:safe_center]">
    <Boundary v-if="revealed && View && !failed">
      <component :is="View" />
    </Boundary>
    <LpIcon v-else-if="!View || failed" :name="icon ?? 'lucide:box'" :size="28" class="text-muted" />
  </div>
</template>
