<script lang="ts">
export default { inheritAttrs: false }

export interface SecretFieldLabels extends Record<string, string> {
  show: string
  hide: string
  regenerate: string
  hidden: string
  empty: string
  hidesIn: string
}
</script>

<script setup lang="ts">
import { suppressPaletteDiscovery } from "../composables/usePaletteCommands"
/*
 * A value someone must be able to read and copy but should not have on screen
 * by default: an API key, a bot token, a webhook secret, a recovery code.
 *
 *   <LpSecretField label="Bot token" :value="token" :auto-hide="20" :regenerate="rotate" />
 *   <LpSecretField v-model="secret" input label="Webhook secret" />
 *
 * Masked by default, so a screen share or a shoulder sees dots. The mask is a
 * fixed run of dots rather than one per character: the length of a secret is
 * itself a hint about what it is. Copy works while masked — copying is the
 * common reason to open the page, and the value need not appear to do it.
 *
 * `autoHide` folds the value away again after N seconds, with a thin bar
 * running down so the person sees it is about to go; the page going to the
 * background hides it at once, since nobody is looking at a tab they left.
 *
 * Two forms. The default is a read-only display: the value may wrap, can be
 * selected, and fades between dots and text. `input` makes it an editable
 * field — that one IS LpPasswordInput (same shell, same eye button), driven
 * through its `visible` model so the timer and the copy button live here.
 */
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useScramble } from "../composables/useScramble"
import { useLabels } from "../composables/useLpConfig"
import { useFieldControl } from "../composables/useField"
import { mergeClass } from "../composables/useMergedClass"
import FieldWrapper from "./FieldWrapper.vue"
import LpButton from "./LpButton.vue"
import LpCopyButton from "./LpCopyButton.vue"
import LpIcon from "./LpIcon.vue"
import LpPasswordInput from "./LpPasswordInput.vue"
import LpShift from "./LpShift.vue"
import LpTooltip from "./LpTooltip.vue"
import RevealToggle from "./RevealToggle.vue"

const props = withDefaults(
  defineProps<{
    /** The secret, for the read-only display. */
    value?: string
    /** The secret, for the `input` form (v-model). */
    modelValue?: string
    /** Editable field instead of a display. */
    input?: boolean
    label?: string
    hint?: string
    error?: string
    placeholder?: string
    size?: "sm" | "md" | "lg"
    /** Show the copy button. On by default: copying is what a secret is shown for. */
    copyable?: boolean
    /** Offer the eye button. Off for a value that should only ever be copied, never shown. */
    revealable?: boolean
    /**
     * Seconds after which a revealed value hides itself again. Unset keeps it
     * shown until the person hides it.
     */
    autoHide?: number
    /**
     * Rotates the secret. The button spins while it runs and a failure is
     * toasted (LpButton's `action`); the new value arrives through `value`.
     * For a custom action (with a confirm, say) use the `actions` slot.
     */
    regenerate?: () => unknown
    /** Let a long value wrap onto more lines instead of staying on one. Display form only. */
    wrap?: boolean
    disabled?: boolean
    /** How many dots stand for the value while hidden. */
    maskLength?: number
    labels?: Partial<SecretFieldLabels>
  }>(),
  { size: "md", copyable: true, revealable: true, maskLength: 24 },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "copied", text: string): void
}>()

/** Shown or hidden; bind it to drive the reveal from outside. */
const revealedModel = defineModel<boolean>("revealed", { default: false })
const revealed = computed({
  get: () => props.revealable && revealedModel.value,
  set: (value: boolean) => { revealedModel.value = value },
})

const text = useLabels<SecretFieldLabels>(
  "secretField",
  {
    show: "Show",
    hide: "Hide",
    regenerate: "Regenerate",
    hidden: "Hidden",
    empty: "Not set",
    hidesIn: "Hides automatically",
  },
  () => props.labels,
)

const secret = computed(() => (props.input ? props.modelValue : props.value) ?? "")
const control = useFieldControl(() => ({ wrapped: false, disabled: props.disabled }))

// Revealing decrypts the value into place, and a new value (a regenerated key)
// decrypts over the old one: the change is seen happening, not just swapped.
// Fed nothing while hidden, so every reveal plays from empty again.
const decrypt = useScramble(() => (revealed.value ? secret.value : ""), { onChange: true, duration: 650 })
const mask = computed(() => "•".repeat(props.maskLength))

// ── auto-hide ────────────────────────────────────────────────
let hideTimer: ReturnType<typeof setTimeout> | undefined
// Bumped on every reveal so the countdown bar restarts its run.
const run = ref(0)
watch(
  [revealed, () => props.autoHide],
  ([on, seconds]) => {
    clearTimeout(hideTimer)
    if (!on || !seconds) return
    run.value++
    hideTimer = setTimeout(() => (revealed.value = false), seconds * 1000)
  },
  { immediate: true },
)
// A new value (just regenerated) restarts the window rather than hiding it mid-read.
watch(secret, () => {
  if (revealed.value && props.autoHide) {
    clearTimeout(hideTimer)
    run.value++
    hideTimer = setTimeout(() => (revealed.value = false), props.autoHide * 1000)
  }
})

function onVisibility() {
  if (document.visibilityState === "hidden") revealed.value = false
}
onMounted(() => document.addEventListener("visibilitychange", onVisibility))
onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  document.removeEventListener("visibilitychange", onVisibility)
})

// ── input form: the field's text is not a node we can fade, so it gets a
// short blur-in on every switch instead of snapping between dots and text.
const field = ref<{ $el?: Element } | null>(null)
watch(revealed, () => {
  if (!props.input || prefersReducedMotion()) return
  const el = field.value?.$el
  const input = el instanceof Element ? el.querySelector("input") : null
  input?.animate([{ filter: "blur(4px)", opacity: 0.35 }, { filter: "blur(0)", opacity: 1 }], {
    duration: 260,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  })
})

const id = useId()
const iconSize = computed(() => (props.size === "sm" ? 14 : 16))
const copySize = computed(() => (props.size === "lg" ? "sm" : "xs"))

const shell = computed(() =>
  mergeClass(
    "relative flex w-full items-center gap-1 overflow-hidden rounded-control border bg-surface-soft text-ink transition-colors duration-(--duration-fast)",
    props.error ? "border-danger" : "border-line",
    control.value.disabled ? "opacity-55" : "",
    props.wrap ? "py-1.5" : "",
    { sm: "min-h-(--size-control-sm) pl-2.5 pr-1 text-xs", md: "min-h-(--size-control-md) pl-3 pr-1.5 text-sm", lg: "min-h-(--size-control-lg) pl-3.5 pr-1.5 text-sm" }[props.size],
  ),
)

suppressPaletteDiscovery()
</script>

<template>
  <!-- Input form: LpPasswordInput itself, with the copy button beside its eye. -->
  <LpPasswordInput
    v-if="input"
    ref="field"
    v-bind="$attrs"
    v-model:visible="revealed"
    class="[&_input]:font-mono"
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="control.disabled"
    :revealable="revealable"
    :label="label"
    :hint="hint"
    :error="error"
    :size="size"
    :labels="{ show: text.show, hide: text.hide }"
    @update:model-value="(v: string) => emit('update:modelValue', v)"
  >
    <template v-if="$slots.leading" #leading><slot name="leading" /></template>
    <template #actions>
      <LpCopyButton
        v-if="copyable && secret"
        :value="secret"
        size="xs"
        class="size-7"
        :disabled="control.disabled"
        @copied="(t: string) => emit('copied', t)"
      />
      <slot name="actions" />
      <LpButton
        v-if="regenerate"
        variant="ghost"
        size="xs"
        square
        class="size-7"
        :aria-label="text.regenerate"
        :title="text.regenerate"
        :action="regenerate"
        :disabled="control.disabled"
      >
        <LpIcon name="lucide:refresh-cw" :size="iconSize" />
      </LpButton>
    </template>
  </LpPasswordInput>

  <!-- Display form. -->
  <FieldWrapper
    v-else
    :wrapped="!!(label || hint || error)"
    :id="id"
    :label="label"
    :hint="hint"
    :error="error"
    :class="$attrs.class"
    :style="$attrs.style"
  >
    <div :class="mergeClass(shell, label || hint || error ? '' : ($attrs.class as string))" data-lp-secret>
      <LpShift axis="height" class="min-w-0 flex-1">
        <!-- `aria-labelledby` would need the label's id; the field context
             gives the control `id`, which LpFormField points its label at. -->
        <div :id="id" class="relative min-w-0 font-mono" :aria-label="label" role="group">
          <Transition
            mode="out-in"
            enter-active-class="transition-[opacity,filter] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
            leave-active-class="transition-[opacity,filter] duration-(--duration-fast) ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0 blur-[4px]"
            leave-to-class="opacity-0 blur-[4px]"
          >
            <span
              v-if="!secret"
              key="empty"
              class="block truncate font-sans text-muted"
            >{{ placeholder ?? text.empty }}</span>
            <span v-else-if="revealed" key="shown" class="block select-all" :class="wrap ? 'break-all whitespace-pre-wrap' : 'truncate'">
              <span aria-hidden="true">{{ decrypt.running.value ? decrypt.text.value : secret }}</span>
              <span class="sr-only">{{ secret }}</span>
            </span>
            <span v-else key="hidden" class="block truncate tracking-[0.12em] text-muted select-none" aria-hidden="true">{{ mask }}</span>
          </Transition>
          <span v-if="secret && !revealed" class="sr-only">{{ text.hidden }}</span>
        </div>
      </LpShift>

      <div class="flex shrink-0 items-center gap-0.5" :class="wrap ? 'self-start' : 'self-center'">
        <RevealToggle
          v-if="revealable && secret"
          v-model="revealed"
          :icon-size="iconSize"
          :show-label="text.show"
          :hide-label="text.hide"
          :disabled="control.disabled"
          :controls="id"
          class="size-7"
        />
        <LpCopyButton
          v-if="copyable && secret"
          :value="secret"
          :size="copySize"
          class="size-7 text-muted hover:text-ink"
          :disabled="control.disabled"
          @copied="(t: string) => emit('copied', t)"
        />
        <slot name="actions" />
        <LpTooltip v-if="regenerate" :content="text.regenerate" label>
          <LpButton
            variant="ghost"
            size="xs"
            square
            class="size-7 text-muted hover:text-ink"
            :action="regenerate"
            :disabled="control.disabled"
          >
            <LpIcon name="lucide:refresh-cw" :size="iconSize" />
          </LpButton>
        </LpTooltip>
      </div>

      <!-- The auto-hide window running out, as a hairline along the bottom. -->
      <Transition
        enter-active-class="transition-opacity duration-(--duration-fast)"
        leave-active-class="transition-opacity duration-(--duration-fast)"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <span
          v-if="revealed && autoHide"
          :key="run"
          class="lp-drain pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-brand/70"
          :style="{ animationDuration: `${autoHide}s` }"
          :title="text.hidesIn"
          aria-hidden="true"
        />
      </Transition>
    </div>
  </FieldWrapper>
</template>

