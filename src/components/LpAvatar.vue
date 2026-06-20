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
  base: "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-pill bg-surface-soft font-medium text-muted-strong",
  variants: {
    size: {
      sm: "size-7 text-xs",
      md: "size-9 text-sm",
      lg: "size-12 text-base",
    },
  },
  defaultVariants: { size: "md" },
})

type AvatarVariants = VariantProps<typeof avatar>

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    fallback?: string
    size?: AvatarVariants["size"]
    /** Right-click menu (e.g. account quick actions). Consumer-supplied. */
    menuItems?: ContextMenuItemDef[]
  }>(),
  { size: "md" },
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
    <AvatarRoot :class="avatar({ size })" v-bind="$attrs">
      <AvatarImage v-if="src && mounted" :src="src" :alt="alt" class="size-full object-cover" />
      <AvatarFallback>{{ initials }}</AvatarFallback>
    </AvatarRoot>
  </LpContextMenu>
  <AvatarRoot v-else :class="avatar({ size })" v-bind="$attrs">
    <AvatarImage v-if="src" :src="src" :alt="alt" class="size-full object-cover" />
    <AvatarFallback>{{ initials }}</AvatarFallback>
  </AvatarRoot>
</template>
