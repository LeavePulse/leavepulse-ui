<script setup lang="ts">
import { ref } from "vue"
import { LpScrollStrip, LpTabs } from "../../src"

const clicked = ref<string[]>([])
const items = Array.from({ length: 24 }, (_, i) => `Branch ${i + 1}`)
const tab = ref(new URLSearchParams(location.search).get("tab") ?? "t1")
const allTabs = Array.from({ length: 12 }, (_, i) => ({ value: `t${i + 1}`, label: `Section ${i + 1}` }))
const late = new URLSearchParams(location.search).has("late")
const tabs = ref(late ? [] : allTabs)
if (late) setTimeout(() => { tabs.value = allTabs }, 600)
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <div class="h-[40vh]" />
    <div data-testid="strip">
    <LpScrollStrip class="w-80 rounded-control border border-line" content-class="gap-2 p-2" aria-label="Branches">
      <button
        v-for="item in items"
        :key="item"
        type="button"
        class="shrink-0 rounded-full border border-line px-3 py-1 text-sm"
        @click="clicked.push(item)"
      >
        {{ item }}
      </button>
    </LpScrollStrip>
    </div>
    <p data-testid="clicked">{{ clicked.join(",") }}</p>
    <div class="w-72" data-testid="tabs">
      <LpTabs v-model="tab" :items="tabs" />
    </div>
    <p data-testid="tab">{{ tab }}</p>
    <button type="button" data-testid="pick-last" @click="tab = 't12'">Pick last</button>
    <div class="h-[150vh]" />
  </div>
</template>
