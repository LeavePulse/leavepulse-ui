<script setup lang="ts">
import { computed, ref } from "vue"
import { LpButton, LpFrame, LpInspector, LpWindow, LpWorkspaceSwitcher, useWorkspaces } from "../../src"

const mode = new URLSearchParams(location.search).get("mode")
const first = ref(mode !== "closed")
const second = ref(true)
const selected = ref<{ name: string } | null>(null)
const inspecting = ref(true)
const spaces = useWorkspaces({ initial: ["a", "b"], persist: "browser-test" })
const blocks = computed(() => JSON.stringify(spaces.controller.serialize()))
const sections = computed(() =>
  selected.value ? [{ key: "facts", title: "Overview", items: [{ label: "Name", value: selected.value.name }] }] : [],
)
</script>

<template>
  <div v-if="mode === 'frame'">
    <LpFrame :height="500" title="Frame">
      <LpWindow v-model:open="first" title="Framed" :default-rect="{ x: 40, y: 40, width: 300, height: 200 }" />
    </LpFrame>
  </div>
  <div v-else class="flex h-screen">
    <main class="flex flex-1 flex-col items-start gap-2 p-4">
      <LpButton data-test-open @click="first = true">Open first</LpButton>
      <LpButton @click="selected = { name: 'alpha' }">Select</LpButton>
      <LpButton @click="selected = null">Clear</LpButton>
      <LpWorkspaceSwitcher :workspaces="spaces" />
      <output aria-label="Layout">{{ blocks }}</output>
    </main>
    <LpInspector
      v-model:open="inspecting"
      :subject="selected"
      :title="selected?.name ?? 'Inspector'"
      :sections="sections"
      resizable
      persist="browser-test"
    />
    <LpWindow v-model:open="first" title="First" persist="first" :default-rect="{ x: 100, y: 120, width: 300, height: 200 }">
      <p>First body</p>
    </LpWindow>
    <LpWindow v-model:open="second" title="Second" :default-rect="{ x: 160, y: 180, width: 300, height: 200 }" :snap="false">
      <p>Second body</p>
    </LpWindow>
  </div>
</template>
