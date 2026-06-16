<script setup lang="ts">
/*
 * Editable code panel: a transparent <textarea> sits over shiki-highlighted
 * output. Typing edits the model (drives the live preview); the highlight
 * re-renders underneath. Copy button included.
 */
import { ref, watch } from "vue"
import { getHighlighter } from "./highlighter"

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>()

const html = ref("")
const copied = ref(false)

async function render(code: string) {
  const hl = await getHighlighter()
  html.value = hl.codeToHtml(code, { lang: "vue-html", theme: "vitesse-dark" })
}
watch(() => props.modelValue, render, { immediate: true })

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLTextAreaElement).value)
}

async function copy() {
  await navigator.clipboard.writeText(props.modelValue)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="relative overflow-hidden rounded-card border border-line bg-[#121212]">
    <button
      type="button"
      class="absolute right-2 top-2 z-10 rounded-control border border-line bg-surface-soft px-2.5 py-1 text-xs text-ink hover:border-line-strong"
      @click="copy"
    >
      {{ copied ? "Copied" : "Copy" }}
    </button>

    <!-- highlighted layer -->
    <div class="shiki-host overflow-auto p-4 text-[13px] leading-relaxed" v-html="html" />

    <!-- transparent editable layer on top, perfectly aligned -->
    <textarea
      :value="modelValue"
      spellcheck="false"
      class="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-[13px] leading-relaxed text-transparent caret-white outline-none"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.shiki-host :deep(pre) {
  margin: 0;
  background: transparent !important;
  font-family: var(--font-mono);
  white-space: pre;
}
textarea {
  /* match shiki's font metrics so the overlay lines up */
  font-family: var(--font-mono);
  tab-size: 2;
}
</style>
