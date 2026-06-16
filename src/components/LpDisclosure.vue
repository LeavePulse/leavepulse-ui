<script setup lang="ts">
/*
 * Collapsible "show more" section built on reka Collapsible. The trigger is a
 * full-width row with a chevron that rotates open; the body animates its height
 * via the collapsible-down/up keyframes (driven by reka's content-height var).
 *
 * `scrollIntoView` opts the block into auto-revealing itself: when it opens, the
 * root is smoothly scrolled into the nearest scroll container so the freshly
 * shown content isn't left below the fold.
 */
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui"
import { type ComponentPublicInstance, nextTick, ref } from "vue"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Controlled open state. Omit to let the component own it (with `defaultOpen`). */
    open?: boolean
    defaultOpen?: boolean
    /** Trigger label (or use the #trigger slot for richer content). */
    label?: string
    /** Optional iconify name shown left of the label. */
    icon?: string
    /**
     * On open, smooth-scroll the block to the top of the nearest scroll
     * container so its content isn't left below the fold. Fires immediately,
     * in parallel with the expand.
     */
    scrollIntoView?: boolean
  }>(),
  { defaultOpen: false, scrollIntoView: false },
)

const emit = defineEmits<{ (e: "update:open", value: boolean): void }>()

// reka's CollapsibleRoot renders a real element but exposes it as a component
// instance, so reach through $el for the DOM node we scroll into view.
const root = ref<ComponentPublicInstance | null>(null)

function onToggle(value: boolean) {
  emit("update:open", value)
  if (value && props.scrollIntoView) {
    // Scroll immediately, in parallel with the expand. nextTick only waits for
    // reka to flip data-state; the header's position is stable while the body
    // grows, so pinning the block's top to the viewport top with a smooth scroll
    // feels instant and reveals the content as it animates open.
    nextTick(() => {
      const el = root.value?.$el as HTMLElement | undefined
      el?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }
}
</script>

<template>
  <CollapsibleRoot
    ref="root"
    :open="open"
    :default-open="defaultOpen"
    class="overflow-hidden rounded-control border border-line bg-surface-soft"
    @update:open="onToggle"
  >
    <CollapsibleTrigger
      class="group flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LpIcon v-if="icon" :name="icon" :size="14" class="text-muted" />
      <span class="min-w-0 flex-1 text-left">
        <slot name="trigger">{{ label }}</slot>
      </span>
      <LpIcon
        name="lucide:chevron-down"
        :size="16"
        class="text-muted transition-transform duration-[var(--duration-fast)] group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>

    <CollapsibleContent
      class="group/content overflow-hidden data-[state=open]:animate-[collapsible-down_260ms_var(--ease-emphasized)] data-[state=closed]:animate-[collapsible-up_200ms_var(--ease-emphasized)]"
    >
      <!--
        The height animation lives on the wrapper; the inner panel fades + drifts
        up so the content eases in rather than snapping at full opacity. The slide
        is short (4px) and runs slightly behind the expand for a settled feel.
      -->
      <div
        class="grid gap-2.5 px-3 pt-1 pb-3.5 group-data-[state=open]/content:animate-[disclosure-body-in_300ms_var(--ease-emphasized)] motion-reduce:animate-none"
      >
        <slot />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
