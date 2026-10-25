<script setup lang="ts">
/*
 * Right-click context menu (reka ContextMenu). Same items as LpDropdownMenu,
 * drawn by the same renderer: nested submenus (`children`), tick-box items and
 * shortcut hints (drawn with LpKeys, so they follow the keyboard). The
 * trigger is whatever you put in the default slot — right-clicking it (or
 * long-press on touch) opens the menu at the pointer. Shares the floating-panel
 * surface + option-row look with the rest of the kit via dropdown.ts.
 */
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from "reka-ui"
import { computed } from "vue"
import { hints } from "../composables/useHints"
import { HINT_SIGNALS, noteContextTarget } from "../composables/useHintSystem"
import ContextMenuItems from "./ContextMenuItems.vue"
import MenuTitle from "./MenuTitle.vue"
import { POPOVER_PANEL } from "./dropdown"
import { useOutsideGuard, usePortalTarget, useView, viewDocument } from "../composables/useView"

export interface ContextMenuItemDef {
  label: string
  icon?: string
  /**
   * Right-aligned hint, written as LpKeys reads it: "Ctrl+C" (shown as ⌘C on
   * an Apple keyboard), "Shift+Del", "G I".
   */
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
  /**
   * Do not count this element as "has a right-click menu" for hint tips: for
   * menus that only hold generic items (a whole table without row actions).
   */
  noHint?: boolean
}>()

// With no items the trigger is disabled, so the element keeps the browser's
// native context menu. Lets callers wrap unconditionally and pass [] to opt out
// per element. `always` overrides this so a late-populated menu is ready on the
// very first click.
const enabled = computed(() => props.always || props.items.length > 0)
const hinted = computed(() => enabled.value && !props.noHint)

const PANEL = `${POPOVER_PANEL} z-(--z-popover) min-w-48 p-1 outline-none`

// A menu opened over a text field takes focus, and on close reka hands it to the
// trigger, so the caret and the selection the user right-clicked are gone — the
// next keystroke goes nowhere. Hand focus back to the field instead, with its
// selection if the menu action left the text as it was.
type TextField = HTMLInputElement | HTMLTextAreaElement
const SELECTABLE = new Set(["text", "search", "url", "tel", "password"])
const view = useView()
let field: { el: TextField; value: string; start: number; end: number } | null = null

function rememberField() {
  const el = viewDocument(view.value).activeElement
  const text =
    el?.tagName === "TEXTAREA" || (el?.tagName === "INPUT" && SELECTABLE.has((el as HTMLInputElement).type))
  field = text
    ? { el: el as TextField, value: (el as TextField).value, start: (el as TextField).selectionStart ?? 0, end: (el as TextField).selectionEnd ?? 0 }
    : null
}

// A menu a tour opens (openContextMenu dispatches an untrusted event) is not
// the user's habit, so it must not switch off the right-click tip.
let synthetic = false

/*
 * A right-click the menu answers goes no further than its trigger. reka opens
 * the menu a tick later, and only if nothing has called preventDefault by then;
 * an app that silences the browser's own menu with a window listener (most
 * desktop shells do) got there first, so the menu never opened while a long
 * press, which reka times itself, still did. reka cancels the native menu on
 * its own once it opens.
 */
function keepContextMenu(event: Event) {
  synthetic = !event.isTrusted
  if (enabled.value) event.stopPropagation()
}

function opened(open: boolean) {
  if (open && !synthetic) hints.use(HINT_SIGNALS.contextMenu)
  synthetic = false
}

/*
 * One click is one signal, however many hinted menus it sits inside. And where
 * the menu is really the rows' (a table marks them data-lp-context-row), only
 * a click on a row counts: a header or the pager has nothing on right click.
 */
const counted = new WeakSet<Event>()

function leftClick(event: MouseEvent) {
  if (!hinted.value || counted.has(event)) return
  const el = event.currentTarget as Element
  const row = (event.target as Element).closest?.("[data-lp-context-row]")
  if (!row && el.querySelector("[data-lp-context-row]")) return
  counted.add(event)
  hints.use(HINT_SIGNALS.contextTarget)
  noteContextTarget(row ?? el)
}

function returnFocus(event: Event) {
  const saved = field
  field = null
  if (!saved || !saved.el.isConnected) return
  event.preventDefault()
  saved.el.focus()
  if (saved.el.value === saved.value) saved.el.setSelectionRange(saved.start, saved.end)
}

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()
</script>

<template>
  <!-- One tree whether or not there are items: swapping between a bare slot and
       the reka trigger remounted the wrapped content whenever items arrived
       late, losing its state and focus. A disabled trigger leaves the browser's
       own menu in place. -->
  <ContextMenuRoot @update:open="opened">
    <ContextMenuTrigger
      as-child
      :disabled="!enabled"
      :data-lp-context-menu="hinted ? '' : undefined"
      @click.capture="leftClick"
      @contextmenu.capture="rememberField"
      @contextmenu="keepContextMenu"
    >
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal :to="portalTo" v-if="items.length">
      <ContextMenuContent
        @interact-outside="guardOutside"
        @escape-key-down="guardOutside"
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
