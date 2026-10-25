<script lang="ts">
// Opt out of auto attr inheritance: the root is the context menu's trigger, so
// fallthrough class/attrs/events are bound explicitly onto the inner surface.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed, ref, watch } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import { MenuWhen } from "./menuWhen"
import LpSkeleton from "./LpSkeleton.vue"
import LpSwap from "./LpSwap.vue"
import { useSpotlight } from "../composables/useSpotlight"

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
    /** Heading of the right-click menu: what the card stands for (its name). */
    menuTitle?: string
    /** A muted second line under `menuTitle`. */
    menuSubtitle?: string
    /**
     * Content is still on its way. The card keeps its surface (border, padding,
     * accent) and shows a skeleton in place of the slot: the `#loading` slot when
     * given, written as the real layout with `.lp-skeleton-item` blocks, else a
     * few text lines. The swap to the content eases its height.
     */
    loading?: boolean
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
    /**
     * A soft glow follows the mouse inside the card. For a grid of cards the
     * user scans with the pointer (a launcher's library, a gallery of builds):
     * the lit one is the one about to be clicked. Same effect as LpSpotlight.
     */
    spotlight?: boolean
    /**
     * A gradient runs round the edge — for the one card that must be noticed
     * first ("new", "recommended"). Same effect as LpGlowBorder; static where
     * the browser cannot animate it, still under reduced motion.
     */
    glow?: boolean
  }>(),
  { variant: "raised", padded: true, interactive: false, as: "div", loading: false },
)

// Merged rather than concatenated: binding the raw `$attrs` would otherwise put the
// consumer's `class` next to ours and leave the winner to stylesheet order —
// `class="p-1"` lost to the `p-5` of `padded`. useMergedAttrs merges it in and
// hands back the remaining attrs, so the class never arrives a second time.
// The effect classes are plain CSS (tokens/effects.css) painted on pseudo
// elements, so the card's children stay exactly what the app put there.
const { class: classes, attrs: rest } = useMergedAttrs(() =>
  [
    card({
      variant: props.variant,
      padded: props.padded,
      interactive: props.interactive,
      accent: Boolean(props.accent),
    }),
    props.spotlight && "lp-spotlight",
    props.glow && "lp-glow-border",
  ]
    .filter(Boolean)
    .join(" "),
)

const { el: spotlightEl } = useSpotlight({ disabled: () => !props.spotlight })

// Remembers that this card has been through a loading state, so the swap
// wrapper stays once content arrives instead of being torn down (which would
// remount the content right after it faded in).
const everLoaded = ref(props.loading)
watch(
  () => props.loading,
  (value) => {
    if (value) everLoaded.value = true
  },
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
  <!-- The menu wraps the card only when it has items, so a directive the app
       puts on the card (`v-hint`) reaches its element: see menuWhen.ts. -->
  <MenuWhen :items="menuItems" :title="menuTitle" :subtitle="menuSubtitle">
    <component :is="as" ref="spotlightEl" :class="classes" :style="accentStyle" :aria-busy="loading || undefined" v-bind="rest">
      <!-- The swap only once loading has been asked for: a card that never
           loads keeps its slot as a direct child, so layouts that style the
           card's children (grids, `space-y-*`) are left exactly as they were. -->
      <LpSwap v-if="loading || everLoaded" :swap-key="loading ? 'loading' : 'content'">
        <!-- The wrapper form: the app's `#loading` markup only names its
             blocks `.lp-skeleton-item`, and is hidden from assistive tech. -->
        <LpSkeleton v-if="loading">
          <slot name="loading">
            <div class="flex flex-col gap-3">
              <div class="lp-skeleton-item h-4 w-2/5 rounded-control" />
              <div class="lp-skeleton-item h-3 w-full rounded-control" />
              <div class="lp-skeleton-item h-3 w-4/5 rounded-control" />
            </div>
          </slot>
        </LpSkeleton>
        <slot v-else />
      </LpSwap>
      <slot v-else />
    </component>
  </MenuWhen>
</template>
