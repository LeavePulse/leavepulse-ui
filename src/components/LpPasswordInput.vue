<script lang="ts">
export default { inheritAttrs: false }

export interface PasswordInputLabels extends Record<string, string> {
  show: string
  hide: string
}
</script>

<script setup lang="ts">
// Password field = LpInput + a show/hide toggle in its trailing slot.
// No duplicated field styling — the shell lives in LpInput.
// LpSecretField's input form is this same field: it drives `visible` (to hide
// again on a timer) and puts its copy button in `actions`.
import { ref } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import LpInput from "./LpInput.vue"
import RevealToggle from "./RevealToggle.vue"

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  /** Offer the show/hide button. When false, the field stays masked. */
  revealable?: boolean
  // Field wrapping mirrors LpInput: passing any of these wraps the control in
  // LpFormField, so a password field labels itself like every other field.
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Control height, as on LpInput. */
  size?: "sm" | "md" | "lg"
  labels?: Partial<PasswordInputLabels>
}>(), { revealable: true })
defineEmits<{ (e: "update:modelValue", value: string): void }>()
/** Whether the text shows; bind it to reveal or hide from outside. */
const visible = defineModel<boolean>("visible", { default: false })
const field = useFieldControl(() => ({ wrapped: false, disabled: props.disabled }))

const text = useLabels<PasswordInputLabels>(
  "passwordInput",
  { show: "Show password", hide: "Hide password" },
  () => props.labels,
)
const inner = ref<InstanceType<typeof LpInput> | null>(null)
defineExpose({
  focus: (options?: FocusOptions) => inner.value?.focus(options),
  blur: () => inner.value?.blur(),
  select: () => inner.value?.select(),
})
</script>

<template>
  <LpInput
    ref="inner"
    v-bind="$attrs"
    :model-value="modelValue"
    :type="revealable && visible ? 'text' : 'password'"
    :placeholder="placeholder"
    :invalid="invalid"
    :disabled="field.disabled"
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
    :size="size"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <template v-if="$slots.leading" #leading><slot name="leading" /></template>
    <template #trailing>
      <slot name="actions" />
      <!-- Sized to the icon with a hair of padding, as the field's other
           trailing controls are, rather than to a full square button. -->
      <RevealToggle
        v-if="revealable"
        v-model="visible"
        :icon-size="size === 'sm' ? 14 : 16"
        :show-label="text.show"
        :hide-label="text.hide"
        :disabled="field.disabled"
        class="size-auto rounded-inner p-1 hover:bg-transparent"
      />
    </template>
  </LpInput>
</template>
