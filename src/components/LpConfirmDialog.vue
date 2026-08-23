<script setup lang="ts">
// Confirmation dialog built on LpModal. Resolves an action via confirm/cancel.
import { computed } from "vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpModal from "./LpModal.vue"

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    /**
     * The action destroys something. Colours the confirm button, and marks the
     * title with a warning glyph — a destructive prompt should be recognisable
     * before the words are read, since it is the one dialog people dismiss on
     * reflex.
     */
    danger?: boolean
    /**
     * Override the marker: any iconify name, or `""` to leave the title plain —
     * for a `danger` action whose dialog body already carries the warning and
     * would otherwise state it twice.
     *
     * A string rather than `string | false`, deliberately: a union including
     * Boolean makes Vue boolean-cast the prop, so an absent `icon` would arrive
     * as `false` and be indistinguishable from a caller suppressing the marker.
     */
    icon?: string
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

/*
 * Only a destructive prompt is marked by default. A routine confirmation
 * ("Save these changes?") with a warning badge cries wolf, and the badge stops
 * meaning anything on the dialog where it matters.
 *
 * "Not given" cannot be tested with `undefined` here. A prop whose type union
 * includes Boolean is boolean-cast by Vue, so an absent `icon` arrives as
 * `false` — the same value the caller passes to suppress the marker — and the
 * default silently never applied. A string is an override, and everything else
 * (absent, or an explicit false) falls through to the danger default.
 */
const marker = computed<string>(() => {
  if (props.icon !== undefined) return props.icon
  return props.danger ? "lucide:triangle-alert" : ""
})

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
    <template v-if="marker" #title>
      <span class="inline-flex items-center gap-2.5">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-full"
          :class="
            danger
              ? 'border border-danger/30 bg-danger-soft text-danger'
              : 'border border-line bg-surface-soft text-muted-strong'
          "
        >
          <LpIcon :name="marker" :size="20" />
        </span>
        {{ title }}
      </span>
    </template>
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
