<script lang="ts">
// The root class is merged with the consumer's (useMergedClass), so the raw
// `class` must not also land on the span unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { useSlots } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedClass } from "../composables/useMergedClass"
import { BADGE_REMOVE } from "./badge"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import { slotText } from "./slotText"
import { TONES } from "./tone"

const badge = tv({
  /*
   * `align-middle` and a line-height pinned to the box, because the default
   * `inline-flex` baseline is the one thing a badge must not bring with it: a
   * badge dropped next to a text-sm heading sat a pixel or two off the text's
   * baseline and pushed the whole row taller, so a section title grew a step
   * the moment it gained a status. The badge now occupies the height it says it
   * does and leaves the line it sits on alone.
   */
  /*
   * A status changes while it is watched, so the change shows as one: the
   * colours ease between tones, the width eases (LpShift) and plain text rolls
   * to the new word (LpRollingText). The outline tone draws its edge as an
   * inset ring rather than a border, so switching to it neither adds a pixel
   * nor snaps: the ring is there in every tone, transparent.
   */
  base: "inline-flex shrink-0 items-center rounded-pill align-middle font-medium leading-[1.2] ring-1 ring-transparent ring-inset transition-[color,background-color,box-shadow] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
  variants: {
    size: {
      // Fits inside a text-sm line without growing it — for a badge beside a
      // heading, in a table cell, or anywhere a row's height is already set.
      sm: "h-[18px] px-1.5 text-[11px]",
      md: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
    },
    /*
     * The kit's tones (tone.ts) under every name they go by, so a badge and a
     * tinted row in one tone are one colour. `warning` is partial trouble,
     * which every status surface eventually needs: without it a half-failed
     * thing has to render as either fine or broken.
     */
    tone: {
      neutral: TONES.neutral.chip,
      muted: TONES.neutral.chip,
      brand: TONES.brand.chip,
      info: TONES.brand.chip,
      action: TONES.success.chip,
      success: TONES.success.chip,
      ok: TONES.success.chip,
      warning: TONES.warning.chip,
      accent: TONES.warning.chip,
      danger: TONES.danger.chip,
      error: TONES.danger.chip,
      outline: "text-ink ring-line",
    },
    // A chip that can be taken away (a tag, a filter in force): the ✕ sits
    // tight to the trailing edge, so that side keeps only a hair of padding.
    removable: {
      true: "gap-1 pr-1",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
})

type BadgeVariants = VariantProps<typeof badge>

const props = defineProps<{
  tone?: BadgeVariants["tone"]
  /** `sm` is the one that does not disturb a text-sm line it sits on. */
  size?: BadgeVariants["size"]
  dot?: boolean
  /** A ✕ after the content that emits `remove`: a tag, a filter chip. */
  removable?: boolean
  /** Accessible name of the ✕, e.g. "Remove tag alpha". */
  removeLabel?: string
}>()

const emit = defineEmits<{
  /** The ✕ was pressed. */
  (e: "remove"): void
}>()

defineSlots<{
  default?: () => unknown
  /** Replaces the ✕ (with `removable`), for a chip whose remove control is another primitive's. */
  remove?: () => unknown
}>()

const text = useLabels("badge", { remove: "Remove" })

const classes = useMergedClass(() => badge({ tone: props.tone, size: props.size, removable: props.removable }))

// Plain words roll to the new ones; richer content only eases its width.
const slots = useSlots()
const plainText = () => slotText(slots.default)
</script>

<template>
  <span v-bind="$attrs" :class="classes">
    <!-- min-w-0 / max-w-full: a chip given a max width truncates its words
         instead of spilling them past its edge. -->
    <LpShift axis="width" class="min-w-0">
      <span class="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap">
        <span v-if="dot" class="size-1.5 shrink-0 rounded-full bg-current" />
        <LpRollingText v-if="plainText() !== null" :value="plainText()!" align="start" />
        <slot v-else />
      </span>
    </LpShift>
    <template v-if="removable">
      <slot name="remove">
        <button type="button" :class="BADGE_REMOVE" :aria-label="removeLabel ?? text.remove" @click="emit('remove')">
          <LpIcon name="lucide:x" :size="12" />
        </button>
      </slot>
    </template>
  </span>
</template>
