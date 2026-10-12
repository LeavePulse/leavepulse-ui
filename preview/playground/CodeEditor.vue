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
const host = ref<HTMLElement | null>(null)

/* The textarea is the only scroller; the highlight below follows it. With two
   independent scrollers a long line scrolled the text and left the colours
   behind, so the caret and selection sat over different code. */
function follow(e: Event) {
  const area = e.target as HTMLTextAreaElement
  if (!host.value) return
  host.value.scrollLeft = area.scrollLeft
  host.value.scrollTop = area.scrollTop
}
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
    <div ref="host" class="shiki-host overflow-hidden p-4 text-[13px] leading-relaxed" v-html="html" />

    <!-- transparent editable layer on top, perfectly aligned -->
    <textarea
      :value="modelValue"
      spellcheck="false"
      class="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-[13px] leading-relaxed text-transparent caret-white outline-none"
      @input="onInput"
      @scroll="follow"
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
textarea::selection {
  background: rgb(255 255 255 / 0.18);
}
textarea {
  /* match shiki's font metrics so the overlay lines up */
  font-family: var(--font-mono);
  tab-size: 2;
}
</style>
