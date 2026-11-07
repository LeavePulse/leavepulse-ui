<script setup lang="ts">
import { ref } from "vue"
import { LpEditable, LpFormField, LpFrame, LpMasonry, LpPie, LpSegmented, LpShift, LpTableOfContents, LpTabs, LpTour } from "../../src"

const tab = ref("one")
const segment = ref("a")
const extra = ref(false)
const touring = ref(false)
const name = ref("Old")
const links = [
  { id: "sweep-first", text: "First" },
  { id: "sweep-second", text: "Second" },
]
const slices = [
  { label: "Alpha", value: 3 },
  { label: "Beta", value: 2 },
]
const cards = [{ id: "c1" }, { id: "c2" }]
const steps = [{ target: "[data-sweep-target]", title: "Sweep step" }]
const picked = ref(0)
</script>

<template>
  <LpFrame :height="900" title="Realm sweep">
    <div class="flex flex-col gap-4 p-4">
      <LpTabs v-model="tab" :items="[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }]" />
      <LpSegmented v-model="segment" :options="[{ value: 'a', label: 'Seg A' }, { value: 'b', label: 'Seg B' }]" aria-label="Segments" />
      <button data-sweep-toggle @click="extra = !extra">Toggle child</button>
      <LpShift data-sweep-shift><span>Base</span><span v-if="extra">Extra</span></LpShift>
      <LpFormField label="Named field"><div tabindex="0" data-sweep-control>Control</div></LpFormField>
      <LpEditable v-model="name" aria-label="Name" />
      <LpMasonry :items="cards" item-key="id" :columns="2">
        <template #default="{ item }"><div data-sweep-card>{{ item.id }}</div></template>
      </LpMasonry>
      <LpPie :slices="slices" :animate="false" @selection-change="picked = $event.length" />
      <output data-sweep-picked>{{ picked }}</output>
      <button data-sweep-target @click="touring = true">Start tour</button>
      <LpTour v-model:open="touring" :steps="steps" />
      <LpTableOfContents :links="links" title="Contents" />
      <div class="h-96 overflow-auto">
        <h2 id="sweep-first">First</h2>
        <div class="h-[60rem]" />
        <h2 id="sweep-second">Second</h2>
        <div class="h-[60rem]" />
      </div>
    </div>
  </LpFrame>
</template>
