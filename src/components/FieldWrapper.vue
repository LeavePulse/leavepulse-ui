<script setup lang="ts">
import { ref, useAttrs } from "vue"
import type { FieldNoticeOptions } from "../composables/useFieldNotice"
import LpFormField from "./LpFormField.vue"

defineOptions({ inheritAttrs: false })
defineProps<{
  wrapped: boolean
  id?: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
}>()

const attrs = useAttrs()
const field = ref<InstanceType<typeof LpFormField> | null>(null)
defineExpose({
  notify: (text: string, options?: FieldNoticeOptions) => field.value?.notify?.(text, options),
  clearNotice: () => field.value?.clearNotice?.(),
})
</script>

<template>
  <component
    :is="wrapped ? LpFormField : 'div'"
    ref="field"
    :id="wrapped ? id : undefined"
    :label="wrapped ? label : undefined"
    :hint="wrapped ? hint : undefined"
    :error="wrapped ? error : undefined"
    :required="wrapped ? required : undefined"
    :class="wrapped ? attrs.class : 'contents'"
    :style="wrapped ? attrs.style : undefined"
  >
    <slot />
  </component>
</template>
