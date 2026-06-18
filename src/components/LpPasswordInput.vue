<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
// Password field = LpInput + a show/hide toggle in its trailing slot.
// No duplicated field styling — the shell lives in LpInput.
import { ref } from "vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"

defineProps<{ modelValue?: string; placeholder?: string; invalid?: boolean; disabled?: boolean }>()
defineEmits<{ (e: "update:modelValue", value: string): void }>()

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
    :model-value="modelValue"
    :type="visible ? 'text' : 'password'"
    :placeholder="placeholder"
    :invalid="invalid"
    :disabled="disabled"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <template v-if="$slots.leading" #leading><slot name="leading" /></template>
    <template #trailing>
      <button
        type="button"
        class="rounded-md p-1 text-muted hover:text-ink"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        @click="visible = !visible"
      >
        <LpIcon :name="visible ? 'lucide:eye-off' : 'lucide:eye'" :size="16" />
      </button>
    </template>
  </LpInput>
</template>
