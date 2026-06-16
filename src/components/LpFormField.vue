<script setup lang="ts">
/*
 * Form-control wrapper: label + the control (default slot) + hint/error.
 * Error takes priority over hint. Uses reka Label for proper association.
 */
import { Label } from "reka-ui"
import { useId } from "vue"

defineProps<{
  label?: string
  hint?: string
  error?: string
  required?: boolean
}>()

const id = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label v-if="label" :for="id" class="text-sm font-medium text-ink">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </Label>

    <slot :id="id" />

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-muted">{{ hint }}</p>
  </div>
</template>
