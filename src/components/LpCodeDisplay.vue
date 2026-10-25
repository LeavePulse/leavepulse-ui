<script lang="ts">
export default { inheritAttrs: false }

export interface CodeDisplayLabels extends Record<string, string> {
  show: string
  hide: string
  hidden: string
  expiresIn: string
  expired: string
  saved: string
}
</script>

<script setup lang="ts">
/*
 * A short code a person reads off the screen, types somewhere else or writes
 * down: a one-time sign-in code, a pairing code for a device, a recovery key,
 * a licence key. Not a field (that is LpOtpInput) and not source code (that is
 * LpCodeBlock): it is shown to be transcribed.
 *
 *   <LpCodeDisplay code="482913" :expires-at="expires" />
 *   <LpCodeDisplay code="K7QF-29XM-PL4D-8WNA" masked ack v-model:saved="saved" />
 *
 * What makes a code easy to transcribe: big monospace characters, every one
 * the same width, broken into groups of 3–4 the eye can hold (`groupCode`).
 * The separators are drawn, not text — selecting or copying the code gives
 * the characters alone, which is what the place it is pasted into expects.
 *
 * A new code (regenerated, refreshed) turns over character by character
 * rather than being swapped, so it is plain that it changed; revealing a
 * masked code turns the dots over the same way.
 *
 * `expiresAt` adds a countdown with a draining bar; at zero the code dims and
 * can no longer be copied, and `expired` fires so the app can fetch a new one.
 * `ack` adds "I've saved this", for codes shown once (recovery keys) where the
 * app should not let the person continue before they have kept it.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpCheckbox from "./LpCheckbox.vue"
import LpCopyButton from "./LpCopyButton.vue"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import LpTooltip from "./LpTooltip.vue"
import { formatRemaining, groupCode } from "./fieldText"

const props = withDefaults(
  defineProps<{
    code: string
    /** One size for every group, or exact sizes in order. Unset picks 3s or 4s by length. */
    groups?: number | number[]
    /** Drawn between groups: `""` (a gap, the default), `"-"`, `"·"`, `" "`. */
    separator?: string
    /** Copy with separators (`grouped`) or the characters alone (`raw`, default). */
    copyAs?: "raw" | "grouped"
    /** Hidden until revealed (v-model:revealed). Copy still works while hidden. */
    masked?: boolean
    copyable?: boolean
    /** When the code stops working; shows a countdown. */
    expiresAt?: Date | number | string
    /**
     * When it was issued, for the countdown bar's full length. Unset, the bar
     * starts full at the moment it first appears.
     */
    issuedAt?: Date | number | string
    /** Add the "I've saved this" confirmation (v-model:saved). */
    ack?: boolean
    size?: "sm" | "md" | "lg"
    labels?: Partial<CodeDisplayLabels>
  }>(),
  { separator: "", copyAs: "raw", copyable: true, size: "md" },
)

const emit = defineEmits<{
  (e: "expired"): void
  (e: "copied", text: string): void
}>()

const revealed = defineModel<boolean>("revealed", { default: false })
const saved = defineModel<boolean>("saved", { default: false })

const text = useLabels<CodeDisplayLabels>(
  "codeDisplay",
  {
    show: "Show code",
    hide: "Hide code",
    hidden: "Code hidden",
    expiresIn: "Expires in",
    expired: "Expired",
    saved: "I've saved this code",
  },
  () => props.labels,
)

const parts = computed(() => groupCode(props.code, props.groups))
const hidden = computed(() => props.masked && !revealed.value)
const copyText = computed(() =>
  props.copyAs === "grouped" ? parts.value.join(props.separator || " ") : parts.value.join(""),
)
// Spelled out with spaces so a screen reader reads characters, not a "word".
const spoken = computed(() => parts.value.map((g) => Array.from(g).join(" ")).join(", "))

// ── countdown ────────────────────────────────────────────────
const toMs = (t: Date | number | string | undefined) => (t === undefined ? undefined : new Date(t).getTime())
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
const end = computed(() => toMs(props.expiresAt))
const start = ref<number | undefined>(undefined)
watch(
  [end, () => props.issuedAt],
  ([until]) => {
    clearInterval(ticker)
    now.value = Date.now()
    start.value = toMs(props.issuedAt) ?? now.value
    if (until === undefined) return
    ticker = setInterval(() => {
      now.value = Date.now()
      if (now.value >= until) clearInterval(ticker)
    }, 1000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(ticker))

const remaining = computed(() => (end.value === undefined ? undefined : Math.max(0, end.value - now.value)))
const expired = computed(() => remaining.value === 0)
const fraction = computed(() => {
  if (end.value === undefined || start.value === undefined) return 1
  const total = end.value - start.value
  return total > 0 ? Math.min(1, (remaining.value ?? 0) / total) : 0
})
watch(expired, (out) => out && emit("expired"))

const SIZE = {
  sm: { text: "text-lg", gap: "gap-2", icon: 14 },
  md: { text: "text-2xl", gap: "gap-3", icon: 16 },
  lg: { text: "text-4xl", gap: "gap-4", icon: 18 },
} as const

const { class: rootClass, attrs: rest } = useMergedAttrs(() => "inline-flex max-w-full flex-col gap-3")
</script>

<template>
  <div :class="rootClass" v-bind="rest">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div
        class="flex flex-wrap items-center font-mono font-semibold tracking-normal text-ink tabular-nums transition-opacity duration-(--duration-medium)"
        :class="[SIZE[size].text, SIZE[size].gap, expired ? 'opacity-35' : '']"
      >
        <span class="sr-only">{{ hidden ? text.hidden : spoken }}</span>
        <template v-for="(group, g) in parts" :key="g">
          <span
            v-if="g > 0 && separator"
            aria-hidden="true"
            class="-mx-1 select-none text-muted/70"
          >{{ separator }}</span>
          <span aria-hidden="true" class="inline-flex">
            <!-- One cell per character, each exactly 1ch, so dots and
                 characters take the same room and nothing shifts on reveal. -->
            <LpRollingText
              v-for="(char, c) in Array.from(group)"
              :key="c"
              :value="hidden ? '•' : char"
              mode="flip"
              :duration="260 + (g * 4 + c) * 28"
              class="w-[1ch]"
            />
          </span>
        </template>
      </div>

      <div class="flex items-center gap-0.5">
        <LpTooltip v-if="masked" :content="revealed ? text.hide : text.show" label>
          <button
            type="button"
            :aria-pressed="revealed"
            class="grid size-8 place-items-center rounded-control text-muted outline-none transition-colors duration-(--duration-fast) hover:bg-ink/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            @click="revealed = !revealed"
          >
            <span class="grid place-items-center">
              <LpIcon name="lucide:eye" :size="SIZE[size].icon" class="lp-glyph-swap col-start-1 row-start-1" :data-on="!revealed || undefined" />
              <LpIcon name="lucide:eye-off" :size="SIZE[size].icon" class="lp-glyph-swap col-start-1 row-start-1" :data-on="revealed || undefined" />
            </span>
          </button>
        </LpTooltip>
        <LpCopyButton
          v-if="copyable"
          :value="copyText"
          size="sm"
          class="text-muted hover:text-ink"
          :disabled="expired"
          @copied="(t: string) => emit('copied', t)"
        />
      </div>
    </div>

    <slot
      v-if="remaining !== undefined"
      name="expiry"
      :remaining="remaining"
      :formatted="formatRemaining(remaining)"
      :expired="expired"
      :fraction="fraction"
    >
      <div class="flex max-w-64 flex-col gap-1.5">
        <span role="timer" class="flex items-center gap-1.5 text-xs" :class="expired ? 'text-danger' : 'text-muted'">
          <LpIcon :name="expired ? 'lucide:timer-off' : 'lucide:timer'" :size="12" />
          <LpRollingText :value="expired ? text.expired : text.expiresIn" align="start" />
          <span v-if="!expired" class="tabular-nums text-ink">{{ formatRemaining(remaining) }}</span>
        </span>
        <span class="h-1 overflow-hidden rounded-pill bg-ink/[0.08]" aria-hidden="true">
          <!-- One second per step, eased linearly across it, so the bar drains
               continuously rather than ticking. -->
          <span
            class="block h-full origin-left rounded-pill transition-[scale,background-color] duration-1000 ease-linear motion-reduce:transition-none"
            :class="fraction < 0.2 ? 'bg-danger' : 'bg-brand'"
            :style="{ scale: `${fraction} 1` }"
          />
        </span>
      </div>
    </slot>

    <LpCheckbox v-if="ack" v-model="saved" :label="text.saved" />
  </div>
</template>
