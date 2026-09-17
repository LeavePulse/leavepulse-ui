<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

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
import { useMergedAttrs } from "../composables/useMergedClass"

defineProps<{
  label?: string
  hint?: string
  error?: string
  required?: boolean
}>()

const id = useId()

// The field stacks label and control with a fixed gap; a denser form needs that gap smaller.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex min-w-0 flex-col gap-1.5",
)
</script>

<template>
  <!-- `gap` covers label→control only; the message carries its own spacing.
       min-w-0 because a field is laid out by a form grid, whose children default
       to `min-width: auto` and so refuse to go narrower than the widest label or
       placeholder inside them — which is how a two-column form ended up wider
       than the phone holding it. -->
  <div
    :class="rootClass"
    v-bind="rest">
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
      <!-- The hint is a slot as well as a prop: most are a sentence, but some
           carry a link or a unit in <code>, and a prop can only be text. Callers
           had been reaching for `#hint` on the assumption it existed — it
           rendered nothing, so the explanation silently went missing. -->
      <p v-else-if="hint || $slots.hint" class="pt-1.5 text-xs text-muted">
        <slot name="hint">{{ hint }}</slot>
      </p>
    </LpShift>
  </div>
</template>
