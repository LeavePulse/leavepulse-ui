<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  href?: string
  external?: boolean
  muted?: boolean
}>()

const rel = computed(() => (props.external ? "noopener noreferrer" : undefined))
const target = computed(() => (props.external ? "_blank" : undefined))
</script>

<template>
  <a
    :href="href"
    :target="target"
    :rel="rel"
    class="inline-flex items-center gap-1 underline-offset-2 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    :class="muted ? 'text-muted hover:text-ink' : 'text-brand hover:text-brand-hover'"
  >
    <slot />
  </a>
</template>
