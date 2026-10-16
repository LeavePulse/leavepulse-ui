<script setup lang="ts">
/*
 * Right-click context menu (reka ContextMenu). Same item shape as
 * LpDropdownMenu, plus nested submenus (`children`) and a shortcut hint. The
 * trigger is whatever you put in the default slot — right-clicking it (or
 * long-press on touch) opens the menu at the pointer. Shares the floating-panel
 * surface + option-row look with the rest of the kit via dropdown.ts.
 */
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from "reka-ui"
import { computed } from "vue"
import ContextMenuItems from "./ContextMenuItems.vue"
import MenuTitle from "./MenuTitle.vue"
import { POPOVER_PANEL } from "./dropdown"

export interface ContextMenuItemDef {
  label: string
  icon?: string
  /** Right-aligned hint, e.g. "⌘C". */
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
  onSelect?: () => void
  /** Nested submenu, to any depth. When present, onSelect is ignored. */
  children?: ContextMenuItemDef[]
  /**
   * Renders as a tick-box rather than a plain item, and the menu stays open on
   * select. For the lists where the point is to set several at once — which
   * columns to show, which values to filter by — and closing after each one
   * would mean reopening the menu for every tick.
   */
  checked?: boolean
}

const props = defineProps<{
  items: ContextMenuItemDef[]
  /**
   * Keep the reka menu mounted even while `items` is momentarily empty. Use when
   * the items are resolved on the right-click itself (e.g. a list that figures
   * out which row was clicked): without this the trigger would still be in
   * native-menu mode on that first click and swallow it.
   */
  always?: boolean
  /**
   * What the menu acts on, shown as a heading above the items: the row's name
   * in a list of similar rows, so the user sees which one the right-click hit.
   * Also names the menu for assistive tech.
   */
  title?: string
  /** A muted second line under `title`, e.g. a version or a path. */
  subtitle?: string
  /** An icon beside the title, or `titleImage` for a picture (an avatar, a logo). */
  titleIcon?: string
  titleImage?: string
}>()

// With no items the trigger is disabled, so the element keeps the browser's
// native context menu. Lets callers wrap unconditionally and pass [] to opt out
// per element. `always` overrides this so a late-populated menu is ready on the
// very first click.
const enabled = computed(() => props.always || props.items.length > 0)

const PANEL = `${POPOVER_PANEL} z-(--z-popover) min-w-48 p-1 outline-none`

// A menu opened over a text field takes focus, and on close reka hands it to the
// trigger, so the caret and the selection the user right-clicked are gone — the
// next keystroke goes nowhere. Hand focus back to the field instead, with its
// selection if the menu action left the text as it was.
type TextField = HTMLInputElement | HTMLTextAreaElement
const SELECTABLE = new Set(["text", "search", "url", "tel", "password"])
let field: { el: TextField; value: string; start: number; end: number } | null = null

function rememberField() {
  const el = document.activeElement
  const text =
    el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && SELECTABLE.has(el.type))
  field = text
    ? { el: el as TextField, value: (el as TextField).value, start: (el as TextField).selectionStart ?? 0, end: (el as TextField).selectionEnd ?? 0 }
    : null
}

/*
 * A right-click the menu answers goes no further than its trigger. reka opens
 * the menu a tick later, and only if nothing has called preventDefault by then;
 * an app that silences the browser's own menu with a window listener (most
 * desktop shells do) got there first, so the menu never opened while a long
 * press, which reka times itself, still did. reka cancels the native menu on
 * its own once it opens.
 */
function keepContextMenu(event: Event) {
  if (enabled.value) event.stopPropagation()
}

function returnFocus(event: Event) {
  const saved = field
  field = null
  if (!saved || !saved.el.isConnected) return
  event.preventDefault()
  saved.el.focus()
  if (saved.el.value === saved.value) saved.el.setSelectionRange(saved.start, saved.end)
}
</script>

<template>
  <!-- One tree whether or not there are items: swapping between a bare slot and
       the reka trigger remounted the wrapped content whenever items arrived
       late, losing its state and focus. A disabled trigger leaves the browser's
       own menu in place. -->
  <ContextMenuRoot>
    <ContextMenuTrigger
      as-child
      :disabled="!enabled"
      @contextmenu.capture="rememberField"
      @contextmenu="keepContextMenu"
    >
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal v-if="items.length">
      <ContextMenuContent
        :collision-padding="8"
        :class="PANEL"
        :aria-label="title"
        @close-auto-focus="returnFocus"
      >
        <MenuTitle v-if="title" :title="title" :subtitle="subtitle" :icon="titleIcon" :image="titleImage" />
        <ContextMenuItems :items="items" :panel="PANEL" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
