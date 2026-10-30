<script setup lang="ts">
// Confirmation dialog built on LpModal. Resolves an action via confirm/cancel.
import { computed, nextTick, ref, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpModal from "./LpModal.vue"
import type { OverlayHistoryMode } from "../composables/useOverlayHistory"

export type ConfirmLabels = {
  confirm: string
  cancel: string
  loading: string
  failed: string
}

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
     * Setting it from the `confirm` handler is enough; the dialog waits a tick
     * for it before deciding to close.
     */
    loading?: boolean
    loadingLabel?: string
    /**
     * The work behind the confirm button. When given, the dialog runs it,
     * shows the loading state itself, closes once it resolves and stays open
     * with the error's message when it rejects.
     */
    action?: () => unknown
    /** Frosted glass panel, passed to LpModal. Follows `provideGlass` when unset. */
    glass?: boolean
    /** Browser history for the dialog, passed to LpModal. Follows `provideOverlayHistory` when unset. */
    history?: OverlayHistoryMode
    labels?: Partial<ConfirmLabels>
  }>(),
  { glass: undefined, history: undefined },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "confirm"): void
  (e: "cancel"): void
}>()

const text = useLabels<ConfirmLabels>(
  "confirm",
  { confirm: "Confirm", cancel: "Cancel", loading: "Working…", failed: "Something went wrong." },
  () => props.labels,
)

/*
 * Only a destructive prompt is marked by default. A routine confirmation
 * ("Save these changes?") with a warning badge cries wolf, and the badge stops
 * meaning anything on the dialog where it matters.
 */
const marker = computed<string>(() => {
  if (props.icon !== undefined) return props.icon
  return props.danger ? "lucide:triangle-alert" : ""
})

const running = ref(false)
const error = ref("")
const busy = computed(() => props.loading || running.value)

watch(
  () => props.open,
  (open) => {
    if (open) error.value = ""
  },
)

async function confirm() {
  if (busy.value) return
  error.value = ""
  emit("confirm")
  if (props.action) {
    running.value = true
    try {
      await props.action()
    } catch (e) {
      error.value = e instanceof Error && e.message ? e.message : text.value.failed
      return
    } finally {
      running.value = false
    }
    emit("update:open", false)
    return
  }
  // A handler that sets `loading` does so through the parent, whose new props
  // reach this component only on the next render.
  await nextTick()
  if (!props.loading) emit("update:open", false)
}

// Every way out that is not the confirm button counts as a cancel: Escape, the
// scrim, the close button. None of them may close it while work is in flight.
function dismiss(open: boolean) {
  if (open) return emit("update:open", true)
  if (busy.value) return
  emit("cancel")
  emit("update:open", false)
}
</script>

<template>
  <LpModal
    :glass="glass"
    :history="history"
    :open="open"
    :title="title"
    :description="description"
    role="alertdialog"
    @update:open="dismiss"
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
    <p v-if="error" role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
    <template #footer>
      <LpButton variant="ghost" :disabled="busy" @click="dismiss(false)">
        {{ cancelLabel ?? text.cancel }}
      </LpButton>
      <LpButton
        :variant="danger ? 'danger' : 'solid'"
        :disabled="busy"
        @click="confirm"
      >
        {{ busy ? (loadingLabel ?? text.loading) : (confirmLabel ?? text.confirm) }}
      </LpButton>
    </template>
  </LpModal>
</template>
