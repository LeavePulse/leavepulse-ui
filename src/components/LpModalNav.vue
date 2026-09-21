<script setup lang="ts">
/*
 * A dialog whose sections stay visible while you read one — settings, a profile
 * with tabs' worth of detail, a wizard that lets you skip a step. The shape
 * these all reach for is a nav column that persists next to the body, and
 * without it they fall back to a row of tabs that runs out of width, or to a
 * back-and-forth between a list screen and a detail screen.
 *
 * The nav lives INSIDE the dialog. Standing it outside, as a sibling floating
 * beside the panel, is the arrangement this component deliberately does not
 * use: it then sits outside the focus trap, `interact-outside` reads a click on
 * it as a click on the scrim and closes the dialog under the pointer, and its
 * height has to be reconciled with a dialog height that changes as content
 * arrives. Inside, all three come out right for free, and `LpModal` keeps the
 * centring every other modal in the kit relies on.
 *
 * Width is the one cost: the rail comes out of the body's width, which is why
 * the default `size` is wider than a plain modal's. Below `mobileBreakpoint`
 * there is no width to spare at all, so the rail becomes a drawer — and since
 * LpSidebar leaves opening it to the app, the header grows the button for it
 * rather than leaving the sections unreachable on a phone.
 */
import { computed, ref } from "vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpModal from "./LpModal.vue"
import LpSidebar from "./LpSidebar.vue"
import type { SidebarItem, SidebarSection } from "./sidebar"

export type { SidebarItem, SidebarSection } from "./sidebar"

type Breakpoint = "sm" | "md" | "lg" | "xl"

const props = withDefaults(
  defineProps<{
    open?: boolean
    /** Active section id (v-model). */
    modelValue?: string
    /** Flat sections, or grouped ones — the shapes LpSidebar already takes. */
    items?: SidebarItem[]
    sections?: SidebarSection[]
    title?: string
    description?: string
    /**
     * Defaults wider than `LpModal`'s `md`: the rail comes out of the content's
     * width, and at `md` what is left is too narrow to be worth splitting.
     */
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
    width?: string
    /** Width of the nav rail (any CSS length). */
    navWidth?: string
    /** Put a filter above the nav — see LpSidebar's `searchable`. */
    searchable?: boolean
    searchPlaceholder?: string
    /** Skeleton rows in place of the nav while the sections load. */
    loading?: boolean
    /** Breakpoint below which the rail becomes a drawer. */
    mobileBreakpoint?: Breakpoint
    /** Label for the button that opens that drawer. */
    navLabel?: string
    /**
     * Let the body fill the height instead of scrolling itself. On by default,
     * unlike a plain modal: the rail is only a full-height column if the two
     * of them agree on a height to fill.
     */
    fillBody?: boolean
  }>(),
  {
    size: "2xl",
    navWidth: "13rem",
    mobileBreakpoint: "lg",
    navLabel: "Sections",
    fillBody: true,
  },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "update:modelValue", value: string): void
}>()

const navOpen = ref(false)

const active = computed({
  get: () => props.modelValue ?? "",
  set: (v: string) => emit("update:modelValue", v),
})

const hasNav = computed(
  () => Boolean(props.items?.length || props.sections?.length),
)

/*
 * Spelled out rather than built from the prop: a class assembled at runtime is
 * not in anyone's Tailwind scan and would never be generated. Mirrors the
 * rail's own visibility in LpSidebar — the button appears exactly where the
 * rail disappears.
 */
const TRIGGER_VISIBILITY: Record<Breakpoint, string> = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
  xl: "xl:hidden",
}
const triggerClass = computed(() => TRIGGER_VISIBILITY[props.mobileBreakpoint])
</script>

<template>
  <LpModal
    :open="open"
    :title="title"
    :description="description"
    :size="size"
    :width="width"
    :fill-body="fillBody"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <LpButton
          v-if="hasNav"
          variant="ghost"
          size="sm"
          square
          :aria-label="navLabel"
          :class="triggerClass"
          @click="navOpen = true"
        >
          <LpIcon name="lucide:menu" :size="18" />
        </LpButton>
        <slot name="title">{{ title }}</slot>
      </div>
    </template>

    <div class="flex min-h-0 flex-1 gap-4">
      <!-- `shrink-0`: a flex item's default is to give up width to a greedy
           sibling, so a wide table in the body would squeeze the rail down to
           its longest unbreakable word. -->
      <LpSidebar
        v-if="hasNav"
        v-model="active"
        v-model:open="navOpen"
        variant="panel"
        :items="items"
        :sections="sections"
        :width="navWidth"
        :searchable="searchable"
        :search-placeholder="searchPlaceholder"
        :loading="loading"
        responsive
        :mobile-breakpoint="mobileBreakpoint"
        class="shrink-0"
      >
        <template v-if="$slots.navHeader" #header>
          <slot name="navHeader" />
        </template>
        <template v-if="$slots.navItem" #item="slotProps">
          <slot name="navItem" v-bind="slotProps" />
        </template>
        <template v-if="$slots.navFooter" #footer>
          <slot name="navFooter" />
        </template>
      </LpSidebar>

      <!-- `min-w-0` is the same guard in the other direction: without it a wide
           child sets this column's minimum to its own width, and the dialog
           grows past its size instead of the content scrolling. -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <slot />
      </div>
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </LpModal>
</template>
