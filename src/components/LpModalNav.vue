<script setup lang="ts">
/*
 * A dialog whose sections stand BESIDE it rather than inside it — settings, a
 * profile with tabs' worth of detail, a wizard you can skip around in. Put the
 * list inside the panel and it takes the width the content already wants; a row
 * of tabs across the top runs out of room at about five.
 *
 * This is LpModal's `aside` slot plus LpSidebar, wired together: the pair
 * shares one centring row, so the list lines up with the dialog at any window
 * width and neither has to measure the other. What is added on top is the part
 * that only matters here — below `mobileBreakpoint` there is no room beside the
 * dialog at all, so the rail folds into a drawer and the header grows the
 * button that opens it. LpSidebar leaves that button to the app, and without
 * one the sections are simply unreachable on a phone.
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
    /** Stand the rail to the right of the dialog instead of the left. */
    navSide?: "start" | "end"
    /**
     * Let the body fill the height instead of scrolling itself. Off by default,
     * as in a plain modal: it existed here to make the rail a full-height
     * column inside the body, and the rail is no longer in the body.
     */
    fillBody?: boolean
  }>(),
  {
    size: "2xl",
    navWidth: "13rem",
    mobileBreakpoint: "lg",
    navLabel: "Sections",
    navSide: "start",
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

const hasNav = computed(() => Boolean(props.items?.length || props.sections?.length))

/*
 * Both halves of the responsive switch are spelled out rather than built from
 * the prop: a class assembled at runtime is in nobody's Tailwind scan and would
 * never be generated. The rail hides exactly where the button appears.
 *
 * `responsive` on LpSidebar hides its own rail below the breakpoint and draws
 * the drawer as a SIBLING of it, so wrapping the whole thing in a `hidden`
 * element takes the drawer with it — and the sections are then unreachable at
 * exactly the width where the drawer is the only way to them. What is left here
 * is the gap, which has to disappear along with the rail: an aside that is
 * empty but still spaced pushes the dialog off centre.
 */
const RAIL_GAP: Record<Breakpoint, string> = {
  sm: "sm:mr-3",
  md: "md:mr-3",
  lg: "lg:mr-3",
  xl: "xl:mr-3",
}
const RAIL_GAP_END: Record<Breakpoint, string> = {
  sm: "sm:ml-3",
  md: "md:ml-3",
  lg: "lg:ml-3",
  xl: "xl:ml-3",
}
const TRIGGER_VISIBILITY: Record<Breakpoint, string> = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
  xl: "xl:hidden",
}
const railClass = computed(() =>
  (props.navSide === "end" ? RAIL_GAP_END : RAIL_GAP)[props.mobileBreakpoint],
)
const triggerClass = computed(() => TRIGGER_VISIBILITY[props.mobileBreakpoint])

/*
 * The rail carries the dialog's own ceiling, so a long list scrolls with the
 * dialog instead of running past the bottom of the window. Inline because it
 * mirrors LpModal's max-height, which is not a class this file can put in the
 * consuming app's scan.
 */
const railStyle = { maxHeight: "min(90vh, calc(100dvh - 2rem))" }
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
    <!-- The gap sits on a wrapper rather than on LpSidebar itself: LpSidebar
         splits its `class` between its root and the inner `nav`, so a margin
         given to it lands on both. -->
    <template v-if="hasNav && navSide === 'start'" #aside>
      <div :class="railClass">
        <LpSidebar
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
          :style="railStyle"
          class="rounded-card border border-line bg-surface-raised p-2 shadow-panel"
        />
      </div>
    </template>

    <template v-if="hasNav && navSide === 'end'" #asideEnd>
      <div :class="railClass">
        <LpSidebar
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
          :style="railStyle"
          class="rounded-card border border-line bg-surface-raised p-2 shadow-panel"
        />
      </div>
    </template>

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

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </LpModal>
</template>
