<script setup lang="ts">
/*
 * The address field of LpDropzone's `links`, shared by its two homes: in place
 * of the zone's content, or in a popover under a zone too narrow to hold it.
 * The zone owns the draft and what Enter and Escape mean; this only draws.
 */
import { ref } from "vue"
import LpButton from "./LpButton.vue"
import LpInput from "./LpInput.vue"

defineProps<{
  invalid: boolean
  labels: { placeholder: string; done: string; keys: string; invalid: string }
}>()
const draft = defineModel<string>({ required: true })
const emit = defineEmits<{ (e: "add"): void; (e: "key", event: KeyboardEvent): void }>()

const field = ref<InstanceType<typeof LpInput> | null>(null)
defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <div class="flex items-center gap-2">
      <LpInput
        ref="field"
        v-model="draft"
        class="min-w-0 flex-1"
        size="sm"
        type="url"
        icon="lucide:link"
        :invalid="invalid"
        :placeholder="labels.placeholder"
        :aria-label="labels.placeholder"
        @keydown="(event: KeyboardEvent) => emit('key', event)"
      />
      <LpButton size="sm" @click="emit('add')">{{ labels.done }}</LpButton>
    </div>
    <span class="text-xs" :class="invalid ? 'text-danger' : 'text-muted'" aria-live="polite">{{ invalid ? labels.invalid : labels.keys }}</span>
  </div>
</template>
