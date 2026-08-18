<script setup lang="ts">
// Confirmation dialog built on LpModal. Resolves an action via confirm/cancel.
import LpButton from "./LpButton.vue"
import LpModal from "./LpModal.vue"

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    /**
     * The confirm action is in flight: the button disables and swaps to
     * `loadingLabel`, and confirming no longer closes the dialog — the owner
     * closes it once the work settles, so a failure can stay on screen.
     */
    loading?: boolean
    loadingLabel?: string
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel", loadingLabel: "Working…" },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "confirm"): void
  (e: "cancel"): void
}>()

function confirm() {
  emit("confirm")
  // An async confirm owns its own dismissal; closing here would tear the
  // dialog down before the caller knows whether the action succeeded.
  if (!props.loading) emit("update:open", false)
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
      <LpButton variant="ghost" :disabled="loading" @click="cancel">
        {{ cancelLabel }}
      </LpButton>
      <LpButton
        :variant="danger ? 'danger' : 'solid'"
        :disabled="loading"
        @click="confirm"
      >
        {{ loading ? loadingLabel : confirmLabel }}
      </LpButton>
    </template>
  </LpModal>
</template>
