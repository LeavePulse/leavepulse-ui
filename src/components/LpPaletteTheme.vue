<script setup lang="ts">
import { computed, ref } from "vue"
import type { StudioState, PreviewableThemeStudio } from "../theme/studio"
import { useLabels } from "../composables/useLpConfig"
import { suppressPaletteDiscovery } from "../composables/usePaletteCommands"
import LpThemeStudio from "./LpThemeStudio.vue"
import LpThemeProvider from "./LpThemeProvider.vue"
import LpButton from "./LpButton.vue"
import LpInput from "./LpInput.vue"

const props = defineProps<{ studio: PreviewableThemeStudio }>()
suppressPaletteDiscovery()
const text = useLabels("paletteTheme", { title: "Theme", apply: "Apply theme", revert: "Revert draft", sample: "Preview", action: "Continue", placeholder: "A field in this theme" })
const snapshot = ref({ ...props.studio.state.value })
const state = ref<StudioState>({ ...snapshot.value })
const preview = computed(() => props.studio.preview(state.value))
const changed = computed(() => JSON.stringify(state.value) !== JSON.stringify(snapshot.value))
const draft: PreviewableThemeStudio = {
  state, themes: props.studio.themes, system: props.studio.system,
  theme: computed(() => preview.value.theme), exported: computed(() => preview.value.exported), changed,
  brand: computed({ get: () => preview.value.theme.colors.brand, set: brand => { state.value = { ...state.value, brand } } }),
  pickTheme: theme => { state.value = { ...state.value, theme } },
  tune: patch => { state.value = { ...state.value, ...patch } },
  reset: () => { state.value = { ...snapshot.value } },
  preview: props.studio.preview,
}
function apply() {
  const { theme, ...tuning } = state.value
  props.studio.pickTheme(theme)
  props.studio.tune(tuning)
  snapshot.value = { ...state.value }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4">
    <div class="sticky top-0 z-10 flex gap-2 border-b border-line bg-surface-overlay pb-3">
      <LpButton :disabled="!changed" @click="apply">{{ text.apply }}</LpButton>
      <LpButton variant="ghost" :disabled="!changed" @click="draft.reset()">{{ text.revert }}</LpButton>
    </div>
    <LpThemeProvider :theme="preview.theme" class="flex flex-col gap-3 rounded-card border border-line p-4">
      <span class="text-sm font-semibold">{{ text.sample }}</span>
      <LpInput :placeholder="text.placeholder" readonly :tabindex="-1" />
      <LpButton :tabindex="-1">{{ text.action }}</LpButton>
    </LpThemeProvider>
    <LpThemeStudio :studio="draft" :labels="{ reset: text.revert }" />
  </div>
</template>
