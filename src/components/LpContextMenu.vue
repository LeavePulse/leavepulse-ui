<script setup lang="ts">
/*
 * Right-click context menu (reka ContextMenu). Same item shape as
 * LpDropdownMenu, plus nested submenus (`children`) and a shortcut hint. The
 * trigger is whatever you put in the default slot — right-clicking it (or
 * long-press on touch) opens the menu at the pointer. Shares the floating-panel
 * surface + option-row look with the rest of the kit via dropdown.ts.
 */
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "reka-ui"
import { computed, ref } from "vue"
import { POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"

export interface ContextMenuItemDef {
  label: string
  icon?: string
  /** Right-aligned hint, e.g. "⌘C". */
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
  onSelect?: () => void
  /** Nested submenu. When present, onSelect is ignored. */
  children?: ContextMenuItemDef[]
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
   * Trigger-less mode: DON'T wrap the slot in a ContextMenuTrigger. reka's
   * trigger binds a pointerdown handler that captures the drag and so kills text
   * selection under it — fatal for selectable content like log lines. Instead the
   * caller catches `contextmenu` itself and calls `openAt(x, y)` (exposed); the
   * menu positions against a virtual anchor at that point. The slot stays a plain
   * element, so mouse-drag selection works. Implies `always`.
   */
  anchor?: boolean
}>()

// With no items, render just the trigger slot — no reka machinery — so the
// element keeps the browser's native context menu. Lets callers wrap
// unconditionally and pass [] to opt out per element. `always` overrides this so
// a late-populated menu is ready on the very first click.
const enabled = computed(() => props.always || props.anchor || props.items.length > 0)

// ── trigger-less (anchor) mode ────────────────────────────────────────────
// Controlled open + a virtual reference element positioned at the click point.
const open = ref(false)
const point = ref({ x: 0, y: 0 })
// A minimal virtual element (getBoundingClientRect) reka/floating-ui can anchor
// to — a zero-size rect at the cursor.
const virtualRef = computed(() => ({
  getBoundingClientRect: () => {
    const { x, y } = point.value
    return { x, y, top: y, left: x, right: x, bottom: y, width: 0, height: 0, toJSON() {} } as DOMRect
  },
}))
function openAt(x: number, y: number) {
  point.value = { x, y }
  // Re-open even if already open (click on a different row): close then reopen so
  // the anchor moves. nextTick isn't needed — reka reads the reference on open.
  open.value = false
  requestAnimationFrame(() => { open.value = true })
}
defineExpose({ openAt })

const PANEL = `${POPOVER_PANEL} z-(--z-popover) min-w-48 p-1 outline-none`
const ITEM =
  "group/item flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-[background-color,color] duration-[var(--duration-fast)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-brand-soft"
const ICON =
  "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[highlighted]/item:translate-x-0.5"
</script>

<template>
  <slot v-if="!enabled" />

  <!-- anchor (trigger-less) mode: the slot is a plain element (no reka trigger,
       so selection/drag underneath works); open is controlled via openAt() and
       the menu anchors to a virtual reference at the click point. -->
  <template v-else-if="anchor">
    <slot />
    <ContextMenuRoot v-model:open="open">
      <ContextMenuPortal v-if="items.length">
        <ContextMenuContent :class="PANEL" :reference="virtualRef">
          <template v-for="(item, i) in items" :key="i">
            <ContextMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />
            <ContextMenuSub v-if="item.children?.length">
              <ContextMenuSubTrigger
                :class="[ITEM, 'justify-between text-ink data-[highlighted]:text-brand data-[state=open]:bg-brand-soft data-[state=open]:text-brand']"
              >
                <span class="flex items-center gap-2">
                  <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
                  {{ item.label }}
                </span>
                <LpIcon name="lucide:chevron-right" :size="14" class="text-muted" />
              </ContextMenuSubTrigger>
              <ContextMenuPortal>
                <ContextMenuSubContent :class="PANEL" :side-offset="2" :align-offset="-4">
                  <template v-for="(sub, j) in item.children" :key="j">
                    <ContextMenuSeparator v-if="sub.separatorBefore" class="my-1 h-px bg-line" />
                    <ContextMenuItem
                      :class="[ITEM, 'justify-between', sub.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
                      :disabled="sub.disabled"
                      @select="sub.onSelect?.()"
                    >
                      <span class="flex items-center gap-2">
                        <LpIcon v-if="sub.icon" :name="sub.icon" :size="15" :class="ICON" />
                        {{ sub.label }}
                      </span>
                      <kbd v-if="sub.shortcut" class="text-xs text-muted">{{ sub.shortcut }}</kbd>
                    </ContextMenuItem>
                  </template>
                </ContextMenuSubContent>
              </ContextMenuPortal>
            </ContextMenuSub>
            <ContextMenuItem
              v-else
              :class="[ITEM, 'justify-between', item.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
              :disabled="item.disabled"
              @select="item.onSelect?.()"
            >
              <span class="flex items-center gap-2">
                <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
                {{ item.label }}
              </span>
              <kbd v-if="item.shortcut" class="text-xs text-muted">{{ item.shortcut }}</kbd>
            </ContextMenuItem>
          </template>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
  </template>

  <ContextMenuRoot v-else>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal v-if="items.length">
      <ContextMenuContent :class="PANEL">
        <template v-for="(item, i) in items" :key="i">
          <ContextMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />

          <!-- Submenu branch -->
          <ContextMenuSub v-if="item.children?.length">
            <ContextMenuSubTrigger
              :class="[ITEM, 'justify-between text-ink data-[highlighted]:text-brand data-[state=open]:bg-brand-soft data-[state=open]:text-brand']"
            >
              <span class="flex items-center gap-2">
                <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
                {{ item.label }}
              </span>
              <LpIcon name="lucide:chevron-right" :size="14" class="text-muted" />
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent :class="PANEL" :side-offset="2" :align-offset="-4">
                <template v-for="(sub, j) in item.children" :key="j">
                  <ContextMenuSeparator v-if="sub.separatorBefore" class="my-1 h-px bg-line" />
                  <ContextMenuItem
                    :class="[ITEM, 'justify-between', sub.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
                    :disabled="sub.disabled"
                    @select="sub.onSelect?.()"
                  >
                    <span class="flex items-center gap-2">
                      <LpIcon v-if="sub.icon" :name="sub.icon" :size="15" :class="ICON" />
                      {{ sub.label }}
                    </span>
                    <kbd v-if="sub.shortcut" class="text-xs text-muted">{{ sub.shortcut }}</kbd>
                  </ContextMenuItem>
                </template>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>

          <!-- Leaf item -->
          <ContextMenuItem
            v-else
            :class="[ITEM, 'justify-between', item.danger ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger' : 'text-ink data-[highlighted]:text-brand']"
            :disabled="item.disabled"
            @select="item.onSelect?.()"
          >
            <span class="flex items-center gap-2">
              <LpIcon v-if="item.icon" :name="item.icon" :size="15" :class="ICON" />
              {{ item.label }}
            </span>
            <kbd v-if="item.shortcut" class="text-xs text-muted">{{ item.shortcut }}</kbd>
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
