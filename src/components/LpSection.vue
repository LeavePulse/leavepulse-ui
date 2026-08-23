<script setup lang="ts">
/*
 * A section heading: a title, an optional line under it, and actions on the
 * right.
 *
 *   <LpSection title="Recent invoices">
 *     <template #actions><LpButton size="sm">Export</LpButton></template>
 *   </LpSection>
 *
 * This is the block every app rebuilt: ~140 hand-written headings across the
 * three of them, each picking its own size, its own gap, its own alignment.
 * LeaveHosting had already extracted its own `PageHeader.vue` — same title,
 * same description, same actions slot — which is the clearest evidence the
 * shape is shared rather than one app's habit.
 *
 * What it deliberately does NOT do:
 *
 * - It draws no container. In the panel these headings sit inside LpCard; in
 *   the cabinet they sit inside `glass rounded-3xl` blocks and, more often,
 *   directly on the page. Owning a border here would fight two of the three.
 * - It has no icon slot of its own beyond `icon`. The panel coloured each
 *   heading's icon from the raw palette — amber beside rose beside sky — in
 *   pages where none of those states were amber, rose or blue. One muted
 *   colour, or none.
 *
 * `level` is the visual size and is independent of `as`, the heading element:
 * a page's main heading may need to be an h1 rendered small, and a card's
 * heading an h3 rendered large. Tying them together is what made consumers
 * reach past the component for a raw <h2> again.
 */
import { computed } from "vue"
import { tv, type VariantProps } from "tailwind-variants"
import LpIcon from "./LpIcon.vue"

const section = tv({
  slots: {
    // items-start, not items-center: once a description is present the actions
    // must stay level with the TITLE, not drift to the middle of the block.
    root: "flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
    title: "font-semibold text-ink",
    description: "mt-1 text-sm text-muted",
    actions: "flex shrink-0 flex-wrap items-center gap-2",
  },
  variants: {
    level: {
      sm: { title: "text-sm" },
      md: { title: "text-base" },
      lg: { title: "text-lg tracking-tight" },
      xl: { title: "text-xl tracking-tight" },
    },
  },
  defaultVariants: { level: "md" },
})

type SectionVariants = VariantProps<typeof section>

const props = withDefaults(
  defineProps<{
    title?: string
    /** One line under the title. */
    description?: string
    /** Iconify name shown before the title, e.g. "lucide:server". */
    icon?: string
    /** Visual size. Independent of `as` — see the note above. */
    level?: SectionVariants["level"]
    /** The heading element to render. Pick it for the document outline. */
    as?: "h1" | "h2" | "h3" | "h4" | "p"
  }>(),
  { level: "md", as: "h2" },
)

defineSlots<{
  /** Title markup, when a plain string is not enough. */
  title?: () => unknown
  /** Right-aligned controls: buttons, filters, a count. */
  actions?: () => unknown
  /** Extra content beside the title — a badge, a count, a status dot. */
  meta?: () => unknown
}>()

const classes = computed(() => section({ level: props.level }))
</script>

<template>
  <div :class="classes.root()">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <LpIcon v-if="icon" :name="icon" :size="16" class="shrink-0 text-muted" />
        <component :is="as" :class="classes.title()">
          <slot name="title">{{ title }}</slot>
        </component>
        <slot name="meta" />
      </div>
      <p v-if="description" :class="classes.description()">{{ description }}</p>
    </div>

    <div v-if="$slots.actions" :class="classes.actions()">
      <slot name="actions" />
    </div>
  </div>
</template>
