<script setup lang="ts">
/*
 * LpChart's data as a visually hidden table (`dataTable`), for screen readers:
 * every series, hidden ones included, against every label.
 */
defineProps<{
  title?: string
  labels: readonly string[]
  series: readonly { id: string; name: string; axis: "left" | "right"; values: readonly (number | null)[] }[]
  format: (series: { axis: "left" | "right" }, value: number) => string
}>()
</script>

<template>
  <div class="sr-only">
    <table>
      <caption v-if="title">{{ title }}</caption>
      <thead>
        <tr>
          <th scope="col"></th>
          <th v-for="s in series" :key="s.id" scope="col">{{ s.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(label, i) in labels" :key="i">
          <th scope="row">{{ label }}</th>
          <td v-for="s in series" :key="s.id">
            {{ s.values[i] == null ? "—" : format(s, s.values[i] as number) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
