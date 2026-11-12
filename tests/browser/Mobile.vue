<script setup lang="ts">
import { ref } from "vue"
import { LpAutocomplete, LpCodeBlock, LpEditable, LpInput, LpNumberField, LpPhoneInput, LpSelect, LpTagsInput, LpTextarea, LpTimeField } from "../../src"

const tags = ref(["alpha"])
const time = ref("09:30")
const name = ref("Ada")
const code = ref("let a = 1")
const picked = ref("a")
const typed = ref("")
const phone = ref("")
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
    <section aria-label="Entries" class="flex flex-col gap-3">
      <LpInput aria-label="Small input" size="sm" />
      <LpInput aria-label="Input" />
      <LpTextarea aria-label="Notes" />
      <LpNumberField aria-label="Count" size="sm" :model-value="2" />
      <LpTagsInput v-model="tags" aria-label="Tags" />
      <LpTimeField v-model="time" aria-label="Time" />
      <LpAutocomplete v-model="typed" aria-label="City" :options="['Kyiv', 'Lviv']" />
      <LpPhoneInput v-model="phone" aria-label="Phone" />
      <LpEditable v-model="name" label="Name" />
      <LpCodeBlock v-model="code" :locked="false" lang="ts" />
      <LpSelect v-model="picked" searchable aria-label="Searchable" :options="[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]" />
    </section>
  </main>
</template>
