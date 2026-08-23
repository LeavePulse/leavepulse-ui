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
    root: "flex flex-wrap justify-between gap-x-4 gap-y-2",
    title: "font-semibold text-ink",
    description: "mt-1 text-sm text-muted",
    actions: "flex shrink-0 flex-wrap items-center gap-2",
  },
  variants: {
    // Where the actions sit against a two-line block. With a description the
    // heading is the top line, so the actions belong level with THAT rather
    // than floating to the middle of the pair. With no description there is
    // only one line, and pinning to the top instead misaligns anything taller
    // than the text — an input, a segmented control — by a couple of pixels.
    described: {
      true: { root: "items-start" },
      false: { root: "items-center" },
    },
    level: {
      sm: { title: "text-sm" },
      md: { title: "text-base" },
      lg: { title: "text-lg tracking-tight" },
      xl: { title: "text-xl tracking-tight" },
    },
  },
  defaultVariants: { level: "md", described: false },
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

/*
 * `title` and `description` each come in two forms, and they are one opening
 * rather than two: the prop is what the slot renders when nothing fills it.
 * Both are a plain string nine times out of ten — usually a t() call — and
 * making those pass through a <template> would tax the common case for the
 * sake of the rare one. But the rare one is real (a name with an id after it,
 * a description carrying a link), and without the slot it is what sends people
 * back to hand-writing the block the component exists to standardise.
 */
const slots = defineSlots<{
  /** Title markup, when a plain string is not enough. */
  title?: () => unknown
  /** Description markup, when a plain string is not enough. */
  description?: () => unknown
  /** Right-aligned controls: buttons, filters, a count. */
  actions?: () => unknown
  /** Extra content beside the title — a badge, a count, a status dot. */
  meta?: () => unknown
}>()

// Either form counts as "described": the actions align against a two-line
// block whether the second line came from the prop or the slot.
const hasDescription = computed(() => !!props.description || !!slots.description)

const classes = computed(() =>
  section({ level: props.level, described: hasDescription.value }),
)
</script>

<template>
  <div :class="classes.root()">
    <!-- `flex-1` matters as much as `min-w-0`: without it a long description
         stretches this column across the whole row, and the actions wrap to a
         line of their own even when they would have fitted beside the title.
         With it the column takes the space that is left and shrinks first.

         `break-words` covers the title AND the description in one place: both
         routinely carry something with no spaces in it — a hostname, a URL, a
         container id — and an unbreakable run pushes straight out through the
         side of whatever card the section sits in. min-w-0 lets the column
         shrink; only this lets the text inside it give way. -->
    <div class="min-w-0 flex-1 break-words">
      <div class="flex flex-wrap items-center gap-2">
        <LpIcon v-if="icon" :name="icon" :size="16" class="shrink-0 text-muted" />
        <component :is="as" :class="classes.title()">
          <slot name="title">{{ title }}</slot>
        </component>
        <slot name="meta" />
      </div>
      <p v-if="hasDescription" :class="classes.description()">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <div v-if="$slots.actions" :class="classes.actions()">
      <slot name="actions" />
    </div>
  </div>
</template>
