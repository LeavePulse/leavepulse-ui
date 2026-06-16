<script setup lang="ts">
// Confirmation dialog built on LpModal. Resolves an action via confirm/cancel.
import LpButton from "./LpButton.vue"
import LpModal from "./LpModal.vue"

withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel" },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "confirm"): void
  (e: "cancel"): void
}>()

function confirm() {
  emit("confirm")
  emit("update:open", false)
}
function cancel() {
  emit("cancel")
  emit("update:open", false)
}
</script>

<template>
  <LpModal
    :open="open"
    :title="title"
    :description="description"
    @update:open="(v) => $emit('update:open', v)"
  >
    <slot />
    <template #footer>
      <LpButton variant="ghost" @click="cancel">{{ cancelLabel }}</LpButton>
      <LpButton :variant="danger ? 'danger' : 'solid'" @click="confirm">
        {{ confirmLabel }}
      </LpButton>
    </template>
  </LpModal>
</template>
