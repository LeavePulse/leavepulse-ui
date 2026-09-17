<script lang="ts">
// Opt out of auto attr inheritance: the template has two root branches (menu /
// no-menu), so fallthrough class/attrs/events are bound explicitly onto the
// inner <div> in both — keeping them on the card surface.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"

const card = tv({
  // break-words: a card is where text with no spaces in it ends up (a
  // hostname, a URL, a container id, a stack frame), and an unbreakable run
  // otherwise pushes straight out through the border, over whatever sits
  // beside it. Set here rather than on the components that go inside, so that
  // a paragraph written by hand behaves the same as one a kit component
  // renders: two lines that look identical must not wrap differently.
  // Anything that genuinely must not break (a code block, a log line) sets its
  // own overflow and scrolls instead.
  // min-w-0: a card is nearly always laid out by a grid or a flex row, and both
  // give their children `min-width: auto` — meaning "never narrower than your
  // contents". A card holding a form then refuses to shrink and pushes its own
  // column past the viewport: measured at 490px inside a 358px grid, with the
  // inputs ending up off-screen on a phone. The card is a container; it takes
  // the width it is given and wraps what is inside it.
  base: "min-w-0 rounded-card border bg-surface-raised break-words",
  variants: {
    variant: {
      // raised opts into the skin painter (.lp-skin-panel) so it follows the
      // active surface tokens (flat → glass) instead of a fixed shadow.
      raised: "lp-skin-panel border-line",
      flat: "border-line",
      ghost: "border-transparent bg-transparent",
    },
    padded: { true: "p-5", false: "" },
    // The stripe itself lives in .lp-card-accent (tokens.css), which composes
    // it with the skin painter's shadows instead of overwriting them.
    accent: { true: "lp-card-accent", false: "" },
    // Lift on hover with a BRAND-tinted glow + brand border (a black drop-shadow
    // was invisible on dark themes — it only showed on light). We write the glow
    // through `--surface-panel-shadow`, the very variable the skin-painter feeds
    // into .lp-skin-panel's box-shadow, AND set box-shadow directly — so the glow
    // lands on both the `raised` variant (skin panel, whose own box-shadow would
    // otherwise win, being declared outside @layer) and `flat`/`ghost`.
    // NOTE: in Tailwind v4 `translate-*` writes the native `translate` property
    // (not `transform`), so the transition list MUST name `translate` explicitly
    // or the lift snaps while the rest eases.
    //
    // `hover:shadow-*` sets box-shadow whole, which on an accented card dropped
    // the stripe on hover — the card lit up and its colour went with it.
    // .lp-card-accent is declared outside @layer, so it outranks the utility and
    // keeps the stripe; the `--surface-panel-shadow` swap on the same line is
    // what actually carries the glow there. See tokens.css.
    //
    // The glow reaches past the card, so a clipping ancestor (scroll area,
    // dialog body) will slice it unless the list reserves room — see the
    // `.lp-glow-room` helper in tokens.css, whose spread tokens describe exactly
    // the distance this shadow travels.
    interactive: {
      true: "cursor-pointer transition-[translate,box-shadow,border-color] duration-medium ease-[var(--ease-emphasized)] hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--lp-card-glow)] hover:[--surface-panel-shadow:var(--lp-card-glow)] [--lp-card-glow:0_8px_24px_-6px_color-mix(in_srgb,var(--color-brand)_38%,transparent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    },
  },
})

type CardVariants = VariantProps<typeof card>

// Defaults live on the props, not on tv() — passing `undefined` into tv
// overrides its defaultVariants and silently drops the padding.
const props = withDefaults(
  defineProps<{
    variant?: CardVariants["variant"]
    padded?: boolean
    interactive?: boolean
    /** Right-click menu for the card. Omit (or pass []) to keep the native one. */
    menuItems?: ContextMenuItemDef[]
    /** Element to render as. A card inside a <ul> has to be an `li` to be valid. */
    as?: string
    /**
     * Colour of a stripe down the card's leading edge. ANY CSS colour — this is
     * for sources that hand you an arbitrary value (a Discord role colour, a
     * per-project hex out of a config), which is why it is a string and not a
     * set of tonal variants. When the colour IS semantic, LpAlert's
     * info/success/warning/danger say so in a way a raw hex cannot.
     *
     * The stripe costs no layout: content starts in the same place with and
     * without it, and it rounds into `rounded-card` by itself.
     */
    accent?: string
    /** Width of the `accent` stripe. */
    accentWidth?: string
  }>(),
  { variant: "raised", padded: true, interactive: false, as: "div" },
)

// Merged rather than concatenated: binding the raw `$attrs` would otherwise put the
// consumer's `class` next to ours and leave the winner to stylesheet order —
// `class="p-1"` lost to the `p-5` of `padded`. useMergedAttrs merges it in and
// hands back the remaining attrs, so the class never arrives a second time.
const { class: classes, attrs: rest } = useMergedAttrs(() =>
  card({
    variant: props.variant,
    padded: props.padded,
    interactive: props.interactive,
    accent: Boolean(props.accent),
  }),
)

// Through custom properties rather than a box-shadow written here: the shadow
// list in .lp-card-accent also carries the skin painter's own shadows, and an
// inline box-shadow would replace all three — taking the card's elevation with
// it, and blocking the swap `interactive` makes on hover.
const accentStyle = computed(() =>
  props.accent
    ? {
        "--lp-card-accent": props.accent,
        ...(props.accentWidth ? { "--lp-card-accent-width": props.accentWidth } : {}),
      }
    : undefined,
)
</script>

<template>
  <!-- Fallthrough class/attrs/events are bound onto the <div> in both branches
       (inheritAttrs:false above), so the card surface looks identical whether or
       not it's wrapped in a context menu. -->
  <LpContextMenu v-if="menuItems?.length" :items="menuItems">
    <component :is="as" :class="classes" :style="accentStyle" v-bind="rest">
      <slot />
    </component>
  </LpContextMenu>
  <component :is="as" v-else :class="classes" :style="accentStyle" v-bind="rest">
    <slot />
  </component>
</template>
