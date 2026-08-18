<script setup lang="ts">
/*
 * One row of LpFileTree plus its recursively rendered children. Split out so the
 * tree can recurse without LpFileTree importing itself, and so the row's
 * indent/expand/selection logic lives in one place. Not exported on its own; an
 * LpFileTree detail.
 *
 * Roving tabindex: exactly one row in the whole tree is focusable at a time
 * (the one matching `focusedId`), which is what a11y expects of role="tree" —
 * Tab enters the tree once, arrows move within it. The parent owns that state.
 */
import { computed } from "vue"
import {
  fileIcon,
  formatModified,
  formatSize,
  sortNodes,
  type FileNode,
  type NodeStats,
} from "./fileTree"
import LpCheckbox from "./LpCheckbox.vue"
import LpContextMenu from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"

const props = defineProps<{
  node: FileNode
  /** Nesting depth, 0 at the root — drives the indent guide and aria-level. */
  depth: number
  expanded: Set<string>
  loading: Set<string>
  selectedId?: string
  focusedId?: string
  sort: boolean
  /** Rendered size of the row's icon, in px. */
  iconSize: number
  /** Render a tri-state checkbox per row (multi-select mode). */
  checkable: boolean
  checked: Set<string>
  /** Per-node state, derived once by the root for the whole tree. */
  stats: Map<string, NodeStats>
  showSize: boolean
  showModified: boolean
}>()

const emit = defineEmits<{
  (e: "select", node: FileNode): void
  (e: "toggle", node: FileNode): void
  (e: "focus", node: FileNode): void
  (e: "check", node: FileNode, value: boolean): void
}>()

// Declared explicitly: the component renders itself, so an inferred slot type
// would reference its own initializer (TS7022).
defineSlots<{
  row(props: { node: FileNode; depth: number; expanded: boolean; selected: boolean }): unknown
}>()

const isDir = computed(() => props.node.kind === "dir")
const isOpen = computed(() => isDir.value && props.expanded.has(props.node.id))
const isLoading = computed(() => props.loading.has(props.node.id))
const isSelected = computed(() => props.selectedId === props.node.id)
const isFocused = computed(() => props.focusedId === props.node.id)

// A directory with no `children` array hasn't been loaded yet — we can't know if
// it's empty, so it stays expandable and the caller fills it on `expand`.
const hasChildren = computed(() => isDir.value && (props.node.children?.length ?? 0) > 0)
const canExpand = computed(() => isDir.value && (props.node.children === undefined || hasChildren.value))

const children = computed(() => {
  const list = props.node.children ?? []
  return props.sort ? sortNodes(list) : list
})

const stat = computed(() => props.stats.get(props.node.id))

const checkState = computed(() =>
  props.checkable ? (stat.value?.state ?? "unchecked") : "unchecked",
)

// A directory shows the rolled-up size of what's under it, so a backup picker
// can answer "how much is this folder" without expanding it.
const sizeLabel = computed(() => {
  if (!props.showSize) return ""
  const bytes = stat.value?.size
  return bytes === undefined ? "" : formatSize(bytes)
})

/**
 * "3 / 12" on a directory whose subtree is partly ticked. Only shown while it
 * actually differs from the whole — a fully ticked or untouched folder reads
 * fine from the checkbox alone, and a count on every row would be noise.
 */
const countLabel = computed(() => {
  if (!props.checkable || !isDir.value) return ""
  const { checked = 0, total = 0 } = stat.value ?? {}
  return total && checked && checked < total ? `${checked} / ${total}` : ""
})

const modifiedLabel = computed(() =>
  props.showModified && props.node.modified !== undefined
    ? formatModified(props.node.modified)
    : "",
)

/**
 * Per-row stagger for the reveal animation. Capped so a large directory doesn't
 * spend a second unfolding — past the cap every remaining row comes in together.
 */
function rowDelay(index: number): string {
  return `${Math.min(index * 18, 180)}ms`
}

/** Respect the OS setting — skip the height animation entirely. */
function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

// Expand/collapse the branch by animating from 0 to its measured height. The
// Web Animations API is used directly (rather than a CSS class) because the
// target height isn't known until the rows are in the DOM.
function onBranchEnter(el: Element, done: () => void) {
  if (reducedMotion()) return done()
  const height = (el as HTMLElement).scrollHeight
  el.animate(
    [
      { height: "0px", opacity: 0 },
      { height: `${height}px`, opacity: 1 },
    ],
    { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  ).onfinish = () => done()
}

function onBranchLeave(el: Element, done: () => void) {
  if (reducedMotion()) return done()
  const height = (el as HTMLElement).scrollHeight
  el.animate(
    [
      { height: `${height}px`, opacity: 1 },
      { height: "0px", opacity: 0 },
    ],
    { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  ).onfinish = () => done()
}

function onActivate() {
  if (props.node.disabled) return
  emit("focus", props.node)
  // A directory row toggles; a file row selects. Directories still emit select
  // so callers can drive a details panel off the highlighted entry.
  emit("select", props.node)
  if (isDir.value) emit("toggle", props.node)
}
</script>

<template>
  <li
    role="treeitem"
    class="min-w-0"
    :aria-level="depth + 1"
    :aria-selected="isSelected"
    :aria-expanded="canExpand ? isOpen : undefined"
    :aria-disabled="node.disabled || undefined"
  >
    <!-- Passthrough when the node has no menu, so the row keeps the native one. -->
    <LpContextMenu :items="node.menu ?? []">
      <div
        :data-node-id="node.id"
        :tabindex="isFocused ? 0 : -1"
        class="group/row relative flex min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-control py-1 pr-2 text-sm outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          node.disabled
            ? 'cursor-not-allowed text-muted/50'
            : isSelected
              ? 'bg-brand-soft text-ink'
              : 'text-muted hover:bg-surface-soft hover:text-ink',
        ]"
        :style="{ paddingLeft: `${depth * 14 + 6}px` }"
        @click.stop="onActivate"
      >
        <!-- Chevron sits in a fixed-width slot so names line up whether or not
             the row can expand. Leaves get the same gutter, left empty.

             It is its own hit target, like the checkbox: opening a folder to
             see what is in it is a different intent from selecting it, and on
             a tree that drives a details pane the two must not be the same
             click. The row as a whole still does both. -->
        <span
          class="flex size-4 shrink-0 items-center justify-center"
          :class="canExpand ? 'cursor-pointer rounded-sm hover:bg-line' : ''"
          @click.stop="canExpand && !node.disabled ? emit('toggle', node) : undefined"
        >
          <LpIcon
            v-if="isLoading"
            name="lucide:loader-circle"
            :size="13"
            class="animate-spin text-muted"
          />
          <LpIcon
            v-else-if="canExpand"
            name="lucide:chevron-right"
            :size="14"
            class="text-muted transition-transform duration-[var(--duration-fast)]"
            :class="isOpen ? 'rotate-90' : ''"
          />
        </span>

        <!-- Checkbox is its own hit target: ticking a folder must not also
             expand it (and vice versa), so the click stops here. -->
        <LpCheckbox
          v-if="checkable"
          :model-value="checkState === 'checked'"
          :indeterminate="checkState === 'indeterminate'"
          :disabled="node.disabled"
          class="shrink-0"
          :aria-label="node.name"
          @click.stop
          @update:model-value="emit('check', node, $event)"
        />

        <LpIcon
          :name="fileIcon(node, isOpen)"
          :size="iconSize"
          class="shrink-0"
          :class="node.disabled ? '' : isDir ? 'text-brand' : 'text-muted'"
        />

        <span class="min-w-0 flex-1 shrink-[2] truncate">
          <slot name="row" :node="node" :depth="depth" :expanded="isOpen" :selected="isSelected">
            {{ node.name }}
          </slot>
        </span>

        <!-- Partial-selection counter: says outright how much of the folder is
             ticked, which a half-state checkbox alone doesn't convey. -->
        <span
          v-if="countLabel"
          class="shrink-0 rounded-pill bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-brand"
        >
          {{ countLabel }}
        </span>

        <!-- Metadata columns: tabular figures so sizes line up down the tree.
             `meta` is free text, so it truncates rather than pushing the size
             column off the row. -->
        <span v-if="node.meta" class="min-w-0 shrink truncate text-xs text-muted">
          {{ node.meta }}
        </span>
        <span
          v-if="modifiedLabel"
          class="shrink-0 text-xs tabular-nums text-muted/80"
        >
          {{ modifiedLabel }}
        </span>
        <span
          v-if="sizeLabel"
          class="w-16 shrink-0 text-right text-xs tabular-nums text-muted"
        >
          {{ sizeLabel }}
        </span>
      </div>
    </LpContextMenu>

    <!-- Height is only known at runtime, so the expand/collapse is measured in
         JS hooks rather than a keyframe. Rows inside stagger themselves in. -->
    <Transition
      :css="false"
      @enter="onBranchEnter"
      @leave="onBranchLeave"
    >
      <ul v-if="isOpen && hasChildren" role="group" class="flex min-w-0 flex-col overflow-hidden">
        <LpFileTreeNode
          v-for="(child, i) in children"
          :key="child.id"
          :style="{ '--row-delay': rowDelay(i) }"
          class="animate-[tree-row-in_var(--duration-medium)_var(--ease-emphasized)_both] [animation-delay:var(--row-delay)] motion-reduce:animate-none"
          :node="child"
          :depth="depth + 1"
          :expanded="expanded"
          :loading="loading"
          :selected-id="selectedId"
          :focused-id="focusedId"
          :sort="sort"
          :icon-size="iconSize"
          :checkable="checkable"
          :checked="checked"
          :stats="stats"
          :show-size="showSize"
          :show-modified="showModified"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
          @focus="emit('focus', $event)"
          @check="(n, v) => emit('check', n, v)"
        >
          <template #row="slotProps">
            <slot name="row" v-bind="slotProps" />
          </template>
        </LpFileTreeNode>
      </ul>
    </Transition>
  </li>
</template>
