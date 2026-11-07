<script setup lang="ts">
import { defineComponent, h, ref } from "vue"
import { LpFrame, LpKeys, LpShortcutsDialog, useHotkeys } from "../../src"

const fired = ref<string[]>([])
const log = (name: string) => { fired.value.push(name) }
const dialog = ref(false)

// Registered on the page; the focus sits in the frame when they are pressed.
useHotkeys(() => [
  { key: "p", handler: () => log("page-letter") },
  { sequence: "g i", handler: () => log("page-sequence") },
  { key: "F2", allowInInput: true, handler: () => log("page-allow-in-input") },
])

// Registered by a component rendered inside the frame.
const Inner = defineComponent({
  setup() {
    const box = ref<HTMLElement | null>(null)
    useHotkeys(() => [{ key: "k", handler: () => log("frame-letter"), help: { label: "Frame key", group: "Frame" } }])
    useHotkeys(() => [{ key: "s", handler: () => log("frame-scoped") }], { scope: box })
    return () => [
      h("button", { "data-test-plain": "" }, "Plain"),
      h("div", { ref: box }, [h("button", { "data-test-scoped": "" }, "Scoped")]),
      h("input", { "data-test-field": "", "aria-label": "Field" }),
    ]
  },
})
</script>

<template>
  <main class="flex flex-col gap-4 p-6">
    <output aria-label="Fired">{{ fired.join(",") }}</output>
    <LpFrame :height="360" title="Hotkeys">
      <div class="flex flex-col items-start gap-3 p-4">
        <Inner />
        <LpKeys combo="Ctrl+K" />
        <button data-test-open @click="dialog = true">Open reference</button>
        <LpShortcutsDialog v-model:open="dialog" live hotkey="F1" />
      </div>
    </LpFrame>
  </main>
</template>
