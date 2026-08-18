<script lang="ts">
// Opt out of auto attr inheritance: the template has two root branches (menu /
// no-menu), so fallthrough class/attrs/events are bound explicitly onto
// AvatarRoot via v-bind="$attrs" in both.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from "reka-ui"
import { tv, type VariantProps } from "tailwind-variants"
import { computed, onMounted, ref } from "vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"

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
    size?: AvatarVariants["size"]
    /** Explicit pixel size, wins over `size` — for avatars keyed to a layout. */
    pixelSize?: number
    /** Silhouette: circle for people, soft/square for servers and projects. */
    shape?: AvatarVariants["shape"]
    /** Draws a hairline ring, for avatars laid over imagery or other avatars. */
    ring?: boolean
    /** Right-click menu (e.g. account quick actions). Consumer-supplied. */
    menuItems?: ContextMenuItemDef[]
  }>(),
  { size: "md", shape: "circle", ring: false },
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

const initials = computed(
  () => props.fallback ?? props.alt?.slice(0, 2).toUpperCase() ?? "?",
)

// reka's AvatarImage resolves the image load on the client, so SSR renders the
// fallback while the client swaps in <img> — a hydration mismatch for every
// consumer. Gate the image on mount: server and first client render both show
// the fallback (identical markup), then the image fades in post-hydration. This
// keeps the fix in one place instead of each call site wrapping us in
// <ClientOnly>.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <LpContextMenu v-if="menuItems?.length" :items="menuItems">
    <AvatarRoot :class="avatar({ size: pixelSize ? undefined : size, shape, ring })" :style="sizeStyle" v-bind="$attrs">
      <AvatarImage v-if="src && mounted" :src="src" :alt="alt" class="size-full object-cover" />
      <AvatarFallback>{{ initials }}</AvatarFallback>
    </AvatarRoot>
  </LpContextMenu>
  <AvatarRoot v-else :class="avatar({ size: pixelSize ? undefined : size, shape, ring })" :style="sizeStyle" v-bind="$attrs">
    <AvatarImage v-if="src" :src="src" :alt="alt" class="size-full object-cover" />
    <AvatarFallback>{{ initials }}</AvatarFallback>
  </AvatarRoot>
</template>
