<script setup lang="ts">
import { computed, ref } from "vue"
import { LpAutocomplete } from "../../src"

const text = ref("")
const picked = ref("")
const people = ["Sunny", "Theroer", "Lighter"]
const options = computed(() => people.filter((name) => name.toLowerCase().includes(text.value.toLowerCase())))

function choose(value: string) {
  picked.value = value
  text.value = value
}

function settle() {
  if (text.value !== picked.value) text.value = picked.value
}
</script>

<template>
  <div class="w-80 p-4">
    <LpAutocomplete v-model="text" :options="options" :filter="false" aria-label="Person" @select="choose" @blur="settle" />
    <p data-testid="picked">{{ picked }}</p>
  </div>
</template>
