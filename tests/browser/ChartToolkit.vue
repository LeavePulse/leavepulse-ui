<script setup lang="ts">
import { ref } from "vue"
import { LpChart, type ChartPointEvent, type ChartRange } from "../../src"

const POINTS = 5_000
const SPIKE_AT = 3_210
const labels = Array.from({ length: POINTS }, (_, i) => `t${i}`)
const data = Array.from({ length: POINTS }, (_, i) => (i === SPIKE_AT ? 1_000 : Math.sin(i / 50) * 10))
const series = [{ name: "Latency", data }]
const short = [{ name: "CPU", data: [1, 5, 3, 8, 2, 6, 4, 7, 3, 5] }]
const shortLabels = Array.from({ length: 10 }, (_, i) => `t${i}`)

const range = ref<ChartRange | null>(null)
const clicked = ref<ChartPointEvent | null>(null)
const chart = ref<InstanceType<typeof LpChart> | null>(null)
const csvLines = ref(0)
</script>

<template>
  <main class="flex max-w-2xl flex-col gap-6 p-6">
    <section data-test="big">
      <LpChart
        ref="chart"
        v-model:range="range"
        title="Latency"
        :series="series"
        :labels="labels"
        :animate="false"
        downsample="minmax"
        range-selector
        zoomable
        :bands="[{ from: 't100', to: 't200', label: 'Maintenance' }]"
        :annotations="[{ at: SPIKE_AT, label: 'Spike' }]"
        @point-click="clicked = $event"
      />
    </section>
    <output aria-label="Range">{{ range ? `${range.start}-${range.end}` : "all" }}</output>
    <output aria-label="Clicked">{{ clicked?.index ?? "none" }}</output>
    <button @click="csvLines = (chart?.exportCsv({ download: false }) ?? '').trim().split('\n').length">Export</button>
    <output aria-label="Csv lines">{{ csvLines }}</output>
    <button @click="range = { start: 3000, end: 3400 }">Set range</button>

    <section data-test="first"><LpChart :series="short" :labels="shortLabels" :animate="false" sync-group="g" /></section>
    <section data-test="second"><LpChart :series="short" :labels="shortLabels" :animate="false" sync-group="g" /></section>
  </main>
</template>
