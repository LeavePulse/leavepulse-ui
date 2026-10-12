<script setup lang="ts">
/*
 * Renders the requests made through `confirm()` / `useConfirm()`. Mount one
 * near the app root, next to LpToaster.
 */
import { computed, ref, watch } from "vue"
import { confirmQueue, settleConfirm } from "./confirm"
import LpConfirmDialog from "./LpConfirmDialog.vue"

withDefaults(
  defineProps<{
    /** Frosted glass panel. Follows `provideGlass` when unset. */
    glass?: boolean
  }>(),
  { glass: undefined },
)

const current = computed(() => confirmQueue[0])
const open = ref(false)
let confirmed = false
const answer = (value: boolean) => (confirmed = value)

watch(
  () => current.value?.id,
  (id) => {
    confirmed = false
    open.value = id !== undefined
  },
  { immediate: true },
)

// The dialog closes itself after a successful action, or straight away for a
// plain confirmation; a failed action keeps it open and never gets here.
function onOpen(value: boolean) {
  open.value = value
  const request = current.value
  if (!value && request) settleConfirm(request.id, confirmed)
}
</script>

<template>
  <LpConfirmDialog
    v-if="current"
    :key="current.id"
    :open="open"
    :glass="glass"
    :title="current.title"
    :description="current.description"
    :danger="current.danger"
    :icon="current.icon"
    :confirm-label="current.confirmLabel"
    :cancel-label="current.cancelLabel"
    :loading-label="current.loadingLabel"
    :action="current.action"
    @confirm="answer(true)"
    @cancel="answer(false)"
    @update:open="onOpen"
  />
</template>
