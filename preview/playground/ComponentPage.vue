<script setup lang="ts">
import { ref, watch } from "vue"
import CodeEditor from "./CodeEditor.vue"
import LivePreview from "./LivePreview.vue"
import type { ComponentEntry } from "./registry"

const props = defineProps<{ entry: ComponentEntry }>()

const code = ref(props.entry.template)
const scopeState = ref(props.entry.state?.() ?? {})

// Re-init when switching component.
watch(
  () => props.entry.id,
  () => {
    code.value = props.entry.template
    scopeState.value = props.entry.state?.() ?? {}
  },
)
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-6 p-8">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold text-ink">{{ entry.name }}</h1>
      <p class="text-sm text-muted">{{ entry.description }}</p>
    </div>

    <LivePreview
      :key="entry.id"
      :template="code"
      :components="entry.components"
      :state="scopeState"
    />

    <div class="flex flex-col gap-2">
      <span class="text-[11px] font-medium uppercase tracking-wider text-muted">
        Example — edit it live
      </span>
      <CodeEditor v-model="code" />
    </div>
  </div>
</template>
