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
import { ref } from "vue"
import { useLabels } from "../composables/useLpConfig"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  // Field wrapping mirrors LpInput: passing any of these wraps the control in
  // LpFormField, so a password field labels itself like every other field.
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Control height, as on LpInput. */
  size?: "sm" | "md" | "lg"
  labels?: Partial<PasswordInputLabels>
}>()
defineEmits<{ (e: "update:modelValue", value: string): void }>()

const text = useLabels<PasswordInputLabels>(
  "passwordInput",
  { show: "Show password", hide: "Hide password" },
  () => props.labels,
)
const visible = ref(false)
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
    :type="visible ? 'text' : 'password'"
    :placeholder="placeholder"
    :invalid="invalid"
    :disabled="disabled"
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
    :size="size"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <template v-if="$slots.leading" #leading><slot name="leading" /></template>
    <template #trailing>
      <button
        type="button"
        class="group rounded-inner p-1 text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:text-ink"
        :aria-label="visible ? text.hide : text.show"
        @click="visible = !visible"
      >
        <LpIcon
          :name="visible ? 'lucide:eye-off' : 'lucide:eye'"
          :size="size === 'sm' ? 14 : 16"
          class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:scale-90 motion-reduce:group-active:scale-100"
        />
      </button>
    </template>
  </LpInput>
</template>
