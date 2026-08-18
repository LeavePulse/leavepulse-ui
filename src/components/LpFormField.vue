<script setup lang="ts">
/*
 * Form-control wrapper: label + the control (default slot) + hint/error.
 * Error takes priority over hint. Uses reka Label for proper association.
 *
 * The message line eases its height (LpShift): validation messages arrive
 * and clear as the user types, and each one appearing under the control shoved
 * every field below it down a line. The control itself is left outside the
 * eased box, so the thing being typed into never moves.
 */
import { Label } from "reka-ui"
import { useId } from "vue"
import LpShift from "./LpShift.vue"

defineProps<{
  label?: string
  hint?: string
  error?: string
  required?: boolean
}>()

const id = useId()
</script>

<template>
  <!-- `gap` covers label→control only; the message carries its own spacing. -->
  <div class="flex flex-col gap-1.5">
    <Label v-if="label" :for="id" class="text-sm font-medium text-ink">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </Label>

    <slot :id="id" />

    <!-- Swapping hint→error changes the text but not the height, so the eased
         box only ever moves when a message appears or clears.

         The gap that used to separate the message from the control is carried
         INSIDE the eased box as padding, not by the parent's `gap`: a flex gap
         applies to the wrapper whether or not it holds a message, which would
         leave every message-less field a row taller than before — and would be
         a step the easing could not cover, since it exists even at height 0. -->
    <LpShift axis="height">
      <p v-if="error" class="pt-1.5 text-xs text-danger">{{ error }}</p>
      <p v-else-if="hint" class="pt-1.5 text-xs text-muted">{{ hint }}</p>
    </LpShift>
  </div>
</template>
