<script lang="ts">
// Opt out of auto attr inheritance: the root is LpContextMenu, so fallthrough
// class/attrs/events are bound explicitly onto AvatarRoot instead.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from "reka-ui"
import { tv, type VariantProps } from "tailwind-variants"
import { computed, onMounted, ref } from "vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import { useMergedAttrs } from "../composables/useMergedClass"

const avatar = tv({
  base: "inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-surface-soft font-medium text-muted-strong",
  variants: {
    size: {
      xs: "size-5 text-[10px]",
      sm: "size-7 text-xs",
      md: "size-9 text-sm",
      lg: "size-12 text-base",
      xl: "size-16 text-lg",
    },
    // People read as circles; things (servers, projects, orgs) read as
    // rounded squares — the same distinction platform icons make.
    shape: {
      circle: "rounded-pill",
      soft: "rounded-card",
      square: "rounded-control",
    },
    ring: { true: "ring-2 ring-line", false: "" },
  },
  defaultVariants: { size: "md", shape: "circle", ring: false },
})

type AvatarVariants = VariantProps<typeof avatar>

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    fallback?: string
    /**
     * An icon shown while there is no picture, instead of initials. For things
     * that have no name worth abbreviating (a world, a mod, a file), where two
     * letters read as noise. `fallback` text still wins when both are given.
     */
    icon?: string
    size?: AvatarVariants["size"]
    /** Explicit pixel size, wins over `size` — for avatars keyed to a layout. */
    pixelSize?: number
    /** Silhouette: circle for people, soft/square for servers and projects. */
    shape?: AvatarVariants["shape"]
    /** Draws a hairline ring, for avatars laid over imagery or other avatars. */
    ring?: boolean
    /** Right-click menu (e.g. account quick actions). Consumer-supplied. */
    menuItems?: ContextMenuItemDef[]
    /**
     * Heading of that menu. Defaults to `alt` with the picture beside it, so
     * the menu says whose avatar it acts on; an empty string drops it.
     */
    menuTitle?: string
    /** A muted line under the menu heading, e.g. a handle or a role. */
    menuSubtitle?: string
  }>(),
  { size: "md", shape: "circle", ring: false },
)

// The icon follows the box the way the initials do: about half of it.
const ICON_SIZE = { xs: 11, sm: 14, md: 18, lg: 24, xl: 30 } as const
const iconSize = computed(() =>
  props.pixelSize ? Math.max(10, Math.round(props.pixelSize * 0.55)) : ICON_SIZE[props.size ?? "md"],
)

// A pixel size drives both box and glyph, so the initials keep their
// proportion instead of staying at the preset's step.
const sizeStyle = computed(() =>
  props.pixelSize
    ? {
        width: `${props.pixelSize}px`,
        height: `${props.pixelSize}px`,
        fontSize: `${Math.max(10, Math.round(props.pixelSize * 0.4))}px`,
      }
    : undefined,
)

/* "John Doe" → "JD", "Ada" → "AD". Split by code point, so a name starting
   with an emoji or an astral letter is not cut in half. */
const initials = computed(() => {
  if (props.fallback) return props.fallback
  const words = (props.alt ?? "").trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "?"
  const first = Array.from(words[0])
  const letters =
    words.length > 1 ? [first[0], Array.from(words[words.length - 1])[0]] : first.slice(0, 2)
  return letters.join("").toUpperCase()
})

// A consumer's `size-20` must beat the preset's `size-9`, not race it.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  avatar({ size: props.pixelSize ? undefined : props.size, shape: props.shape, ring: props.ring }),
)

// reka's AvatarImage resolves the image load on the client, so SSR renders the
// fallback while the client swaps in <img> — a hydration mismatch for every
// consumer. Gate the image on mount: server and first client render both show
// the fallback (identical markup), then the image fades in post-hydration. This
// keeps the fix in one place instead of each call site wrapping us in
// <ClientOnly>.
const mounted = ref(false)

const menuHeading = computed(() => props.menuTitle ?? props.alt)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <!-- Always wrapped, even with no items: a v-if between a wrapped and a bare
       avatar remounted the whole subtree the moment items arrived (fetched
       after the first render), replaying the image fade and dropping focus.
       With an empty list LpContextMenu disables its trigger, so the browser's
       own menu stays. -->
  <LpContextMenu
    :items="menuItems ?? []"
    :title="menuHeading || undefined"
    :subtitle="menuSubtitle"
    :title-image="menuHeading && mounted ? src : undefined"
    :title-icon="menuHeading && !src ? icon : undefined"
  >
    <AvatarRoot :class="rootClass" :style="sizeStyle" v-bind="rest">
      <AvatarImage v-if="src && mounted" :src="src" :alt="alt" class="size-full object-cover animate-[fade-in_var(--duration-medium)_ease] motion-reduce:animate-none" />
      <AvatarFallback>
        <LpIcon v-if="icon && !fallback" :name="icon" :size="iconSize" />
        <template v-else>{{ initials }}</template>
      </AvatarFallback>
    </AvatarRoot>
  </LpContextMenu>
</template>
