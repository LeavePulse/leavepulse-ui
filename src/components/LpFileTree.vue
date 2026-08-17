<script setup lang="ts">
/*
 * File/folder tree — the kit convention for browsing a hierarchy of files so
 * apps stop re-implementing indent math, chevron state and tree keyboard rules.
 * Data-driven: pass a `FileNode[]`; it renders directories-first rows with
 * type-derived icons, expand/collapse, single selection, and optional per-row
 * context menus.
 *
 * Read-only by design — it navigates, it doesn't mutate. Renames/uploads belong
 * to the caller, reachable through `node.menu`.
 *
 * Lazy loading: a directory whose `children` is undefined is treated as
 * not-yet-loaded — it stays expandable, shows a spinner while the caller fetches
 * (`loadingIds`), and emits `expand` once. An empty array means genuinely empty.
 *
 * Keyboard (role="tree" conventions): ↑/↓ move through visible rows, → opens a
 * directory or steps into it, ← collapses or steps out to the parent, Home/End
 * jump to the ends, Enter/Space activates. A roving tabindex keeps the tree a
 * single tab stop.
 */
import { computed, ref, watch } from "vue"
import {
  ancestorIds,
  computeStats,
  formatSize,
  sortNodes,
  subtreeIds,
  type FileNode,
} from "./fileTree"
import LpEmptyState from "./LpEmptyState.vue"
import LpFileTreeNode from "./LpFileTreeNode.vue"
import LpScrollArea from "./LpScrollArea.vue"

export type { FileNode } from "./fileTree"

/** Rolled-up stats for the ticked entries — what a backup picker summarises. */
export interface FileTreeSummary {
  /** Ticked files (directories excluded — they're containers, not payload). */
  files: number
  /** Ticked directories. */
  dirs: number
  /** Total bytes across ticked files, or undefined when no size is known. */
  bytes?: number
  /** `bytes` pre-formatted ("2.4 GB"), or "—". */
  sizeLabel: string
}

const props = withDefaults(
  defineProps<{
    nodes: FileNode[]
    /** Selected node id (v-model:selected). */
    selected?: string
    /** Expanded directory ids (v-model:expanded). Omit to let the tree own it. */
    expanded?: string[]
    /** Directory ids currently fetching children — shows a spinner on the row. */
    loadingIds?: string[]
    /**
     * Multi-select mode: every row gets a tri-state checkbox and ticking a
     * directory cascades to its loaded subtree. This is the mode for "pick what
     * to back up" — `selected` stays independent (it's the highlighted row).
     */
    checkable?: boolean
    /** Ticked node ids (v-model:checked). */
    checked?: string[]
    /** Right-aligned size column (directories roll up their subtree). */
    showSize?: boolean
    /** Right-aligned last-modified column. */
    showModified?: boolean
    /** Directories first, then by name. Turn off to keep the caller's order. */
    sort?: boolean
    /** Row icon size in px. */
    iconSize?: number
    /** Skeleton rows while the initial listing loads. */
    loading?: boolean
    skeletonRows?: number
    /** Empty-state copy when `nodes` is empty. */
    emptyLabel?: string
    emptyDescription?: string
  }>(),
  {
    sort: true,
    iconSize: 15,
    checkable: false,
    showSize: false,
    showModified: false,
    loading: false,
    skeletonRows: 8,
    emptyLabel: "No files",
    emptyDescription: "This folder is empty.",
  },
)

const emit = defineEmits<{
  (e: "update:selected", id: string): void
  (e: "update:expanded", ids: string[]): void
  /** Any row activated (file or directory). */
  (e: "select", node: FileNode): void
  /** A file row activated — the common case for opening a preview. */
  (e: "open", node: FileNode): void
  /** A directory opened for the first time: fetch its children here. */
  (e: "expand", node: FileNode): void
  (e: "collapse", node: FileNode): void
  (e: "update:checked", ids: string[]): void
  /** Ticked set changed, with the rolled-up stats already computed. */
  (e: "summary", summary: FileTreeSummary): void
  /* Not prevented here: a caller that wants the native menu on some rows needs
     the event intact to decide. */
  (e: "contextmenu", node: FileNode, event: MouseEvent): void
}>()

defineSlots<{
  /** Replace the row's label (icons, chevron and indent stay). */
  row(props: { node: FileNode; depth: number; expanded: boolean; selected: boolean }): unknown
  /** Footer under the tree, handed the live selection stats. */
  summary(props: FileTreeSummary): unknown
}>()

// Expansion is optionally controlled: with the `expanded` prop bound we mirror
// it, otherwise the tree owns the set. Either way the internal ref is the single
// source the rows read, so uncontrolled use needs no wiring from the caller.
const openIds = ref<Set<string>>(new Set(props.expanded ?? []))
watch(
  () => props.expanded,
  (ids) => {
    if (ids) openIds.value = new Set(ids)
  },
)

const loadingSet = computed(() => new Set(props.loadingIds ?? []))

// Same controlled/uncontrolled deal as `expanded`.
const checkedIds = ref<Set<string>>(new Set(props.checked ?? []))
watch(
  () => props.checked,
  (ids) => {
    if (ids) checkedIds.value = new Set(ids)
  },
)

/**
 * Index every node by id, plus each node's parent id, in one pass per data
 * change. The parent map turns "reconcile my ancestors" into a walk up the
 * chain instead of a search through the whole tree on every tick.
 */
const index = computed(() => {
  const byId = new Map<string, FileNode>()
  const parentOfId = new Map<string, string>()
  function walk(list: FileNode[], parent?: string) {
    for (const node of list) {
      byId.set(node.id, node)
      if (parent !== undefined) parentOfId.set(node.id, parent)
      if (node.children) walk(node.children, node.id)
    }
  }
  walk(props.nodes)
  return { byId, parentOfId }
})

const byId = computed(() => index.value.byId)

// One pass for the whole tree; every row reads its entry by id instead of
// walking its own subtree on each render. Declared before `summary`, which
// reads it and is watched eagerly — a `const` below that watcher is still in
// its temporal dead zone when the watcher first runs.
const stats = computed(() => computeStats(props.nodes, checkedIds.value))

/**
 * What the ticked set adds up to. Directories are counted but not sized — their
 * bytes arrive through the files inside them, so summing both would double-count.
 * A ticked-but-unexpanded directory contributes its own `size` when it has one,
 * since none of its files are in the set yet.
 */
const summary = computed<FileTreeSummary>(() => {
  let files = 0
  let dirs = 0
  let bytes = 0
  let sized = false

  // Walk the tree, not the ticked set: a fully ticked directory can be counted
  // whole and its subtree skipped, which keeps this linear in what's selected
  // rather than in the size of the instance.
  function walk(list: FileNode[]) {
    for (const node of list) {
      const stat = stats.value.get(node.id)
      if (!stat || stat.state === "unchecked") continue

      if (node.kind === "file") {
        files++
        if (node.size !== undefined) {
          bytes += node.size
          sized = true
        }
        continue
      }

      dirs++
      if (stat.state === "checked" && stat.size !== undefined) {
        // Whole directory: take its rolled-up size and don't descend.
        bytes += stat.size
        sized = true
        files += stat.total
        countDirs(node.children ?? [])
        continue
      }
      walk(node.children ?? [])
    }
  }

  // A fully ticked directory still contributes its nested folders to the count.
  function countDirs(list: FileNode[]) {
    for (const node of list) {
      if (node.kind !== "dir") continue
      dirs++
      countDirs(node.children ?? [])
    }
  }

  walk(props.nodes)
  return {
    files,
    dirs,
    bytes: sized ? bytes : undefined,
    sizeLabel: sized ? formatSize(bytes) : "—",
  }
})

watch(summary, (value) => emit("summary", value), { deep: false })

function setChecked(next: Set<string>) {
  checkedIds.value = next
  emit("update:checked", [...next])
}

/**
 * Tick/untick a node and its loaded subtree, then reconcile ancestors: a parent
 * is in the set only while every one of its children is, so the derived
 * tri-state and the emitted id list agree.
 */
function onCheck(node: FileNode, value: boolean) {
  if (node.disabled) return
  const next = new Set(checkedIds.value)
  for (const id of subtreeIds(node)) {
    const target = byId.value.get(id)
    if (target?.disabled) continue // never tick an entry the caller locked
    if (value) next.add(id)
    else next.delete(id)
  }
  // Walk straight up the parent chain, re-deriving each ancestor from its
  // children — nearest first, so each one sees the level below already settled.
  let ancestorId = index.value.parentOfId.get(node.id)
  while (ancestorId !== undefined) {
    const ancestor = byId.value.get(ancestorId)
    if (ancestor?.children?.length) {
      const all = ancestor.children.every((c) => c.disabled || next.has(c.id))
      if (all) next.add(ancestorId)
      else next.delete(ancestorId)
    }
    ancestorId = index.value.parentOfId.get(ancestorId)
  }
  setChecked(next)
}

/** Tick every node in the tree (skipping disabled ones). */
function checkAll() {
  const next = new Set<string>()
  for (const [id, node] of byId.value) if (!node.disabled) next.add(id)
  setChecked(next)
}

function clearChecked() {
  setChecked(new Set())
}

// Directories we've already emitted `expand` for, so a collapse/re-expand cycle
// doesn't refetch. Callers that want a refresh can drop `children` again.
const requested = new Set<string>()

const roots = computed(() => (props.sort ? sortNodes(props.nodes) : props.nodes))

/** Rows currently visible, in render order — the axis the arrow keys walk. */
const visible = computed(() => {
  const out: FileNode[] = []
  function walk(list: FileNode[]) {
    for (const node of props.sort ? sortNodes(list) : list) {
      out.push(node)
      if (node.kind === "dir" && openIds.value.has(node.id) && node.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(props.nodes)
  return out
})

// The roving-tabindex row. Follows selection when the caller sets one; falls
// back to the first row so the tree is reachable by Tab before any click.
const focusedId = ref<string | undefined>(props.selected)
watch(
  () => props.selected,
  (id) => {
    if (id) focusedId.value = id
  },
)
watch(
  visible,
  (rows) => {
    if (!rows.length) {
      focusedId.value = undefined
    } else if (!rows.some((n) => n.id === focusedId.value)) {
      // The focused row scrolled out of existence (parent collapsed, data
      // changed) — fall back to the first visible row.
      focusedId.value = rows[0].id
    }
  },
  { immediate: true },
)

const root = ref<HTMLElement | null>(null)

function focusRow(id: string) {
  focusedId.value = id
  // Rows are plain divs keyed by data-node-id; query rather than hold refs
  // through the recursion.
  const el = root.value?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
  el?.focus()
  el?.scrollIntoView({ block: "nearest" })
}

function setExpanded(next: Set<string>) {
  openIds.value = next
  emit("update:expanded", [...next])
}

function expand(node: FileNode) {
  if (node.kind !== "dir" || openIds.value.has(node.id)) return
  const next = new Set(openIds.value)
  next.add(node.id)
  setExpanded(next)
  // Fetch on first open only when the children aren't loaded yet.
  if (node.children === undefined && !requested.has(node.id)) {
    requested.add(node.id)
    emit("expand", node)
  }
}

function collapse(node: FileNode) {
  if (!openIds.value.has(node.id)) return
  const next = new Set(openIds.value)
  next.delete(node.id)
  setExpanded(next)
  emit("collapse", node)
}

function onToggle(node: FileNode) {
  if (openIds.value.has(node.id)) collapse(node)
  else expand(node)
}

function onSelect(node: FileNode) {
  if (node.disabled) return
  // Clicking the highlighted row again clears it — a selection you can't undo
  // without picking something else is a trap.
  if (props.selected === node.id) {
    emit("update:selected", "")
    return
  }
  emit("update:selected", node.id)
  emit("select", node)
  if (node.kind === "file") emit("open", node)
}

/** Nearest expanded ancestor of `id`, or undefined at the top level. */
function parentOf(id: string): FileNode | undefined {
  const parentId = index.value.parentOfId.get(id)
  return parentId ? visible.value.find((n) => n.id === parentId) : undefined
}

function move(delta: number) {
  const rows = visible.value
  if (!rows.length) return
  const i = rows.findIndex((n) => n.id === focusedId.value)
  const next = rows[Math.min(rows.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta))]
  if (next) focusRow(next.id)
}

function current(): FileNode | undefined {
  return visible.value.find((n) => n.id === focusedId.value)
}

function onKeydown(e: KeyboardEvent) {
  const node = current()
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault()
      move(1)
      break
    case "ArrowUp":
      e.preventDefault()
      move(-1)
      break
    case "ArrowRight": {
      if (!node) return
      e.preventDefault()
      // Closed directory opens; already-open one steps to its first child.
      if (node.kind === "dir" && !openIds.value.has(node.id)) expand(node)
      else if (node.kind === "dir" && node.children?.length) move(1)
      break
    }
    case "ArrowLeft": {
      if (!node) return
      e.preventDefault()
      // Open directory closes; anything else steps out to the parent row.
      if (node.kind === "dir" && openIds.value.has(node.id)) collapse(node)
      else {
        const parent = parentOf(node.id)
        if (parent) focusRow(parent.id)
      }
      break
    }
    case "Home":
      e.preventDefault()
      if (visible.value[0]) focusRow(visible.value[0].id)
      break
    case "End": {
      e.preventDefault()
      const last = visible.value.at(-1)
      if (last) focusRow(last.id)
      break
    }
    case " ": {
      if (!node) return
      e.preventDefault()
      // In checkable mode Space is the tick — the standard tree behaviour for a
      // multi-select tree — and Enter stays "open/activate".
      if (props.checkable) {
        onCheck(node, stats.value.get(node.id)?.state !== "checked")
        break
      }
      onSelect(node)
      if (node.kind === "dir") onToggle(node)
      break
    }
    case "Enter": {
      if (!node) return
      e.preventDefault()
      onSelect(node)
      if (node.kind === "dir") onToggle(node)
      break
    }
  }
}

/** Expand every ancestor of `id`, focus it and make it the selection. */
function reveal(id: string) {
  const next = new Set(openIds.value)
  for (const ancestor of ancestorIds(props.nodes, id)) next.add(ancestor)
  setExpanded(next)
  emit("update:selected", id)
  // Wait a frame so the newly expanded rows exist before we query for one.
  requestAnimationFrame(() => focusRow(id))
}

function expandAll() {
  const next = new Set(openIds.value)
  function walk(list: FileNode[]) {
    for (const node of list) {
      if (node.kind === "dir" && node.children?.length) {
        next.add(node.id)
        walk(node.children)
      }
    }
  }
  walk(props.nodes)
  setExpanded(next)
}

function collapseAll() {
  setExpanded(new Set())
}

defineExpose({ reveal, expandAll, collapseAll, checkAll, clearChecked, summary })
</script>

<template>
  <div v-if="loading" class="flex h-full w-full min-w-0 flex-col gap-1 overflow-hidden">
    <div
      v-for="n in skeletonRows"
      :key="n"
      class="h-7 animate-pulse rounded-control bg-surface-soft"
      :style="{ marginLeft: `${(n % 3) * 14}px` }"
    />
  </div>

  <LpEmptyState
    v-else-if="!roots.length"
    icon="lucide:folder-search"
    :title="emptyLabel"
    :description="emptyDescription"
  />

  <!-- h-full so the tree fills whatever box the caller gave it and the scroll
       area below gets a bounded height; without it the rows just grow past the
       container and nothing ever scrolls. min-w-0/w-full for the same reason
       sideways: a long path must truncate inside the box rather than widen it. -->
  <div v-else class="flex h-full w-full min-w-0 flex-col">
    <LpScrollArea class="min-h-0 w-full min-w-0 flex-1">
      <ul
        ref="root"
        role="tree"
        :aria-multiselectable="checkable"
        class="flex min-w-0 flex-col"
        @keydown="onKeydown"
      >
        <LpFileTreeNode
          v-for="node in roots"
          :key="node.id"
          :node="node"
          :depth="0"
          :expanded="openIds"
          :loading="loadingSet"
          :selected-id="selected"
          :focused-id="focusedId"
          :sort="sort"
          :icon-size="iconSize"
          :checkable="checkable"
          :checked="checkedIds"
          :stats="stats"
          :show-size="showSize"
          :show-modified="showModified"
          @select="onSelect"
          @toggle="onToggle"
          @focus="focusedId = $event.id"
          @check="onCheck"
          @contextmenu="(n, e) => emit('contextmenu', n, e)"
        >
          <template #row="slotProps">
            <slot name="row" v-bind="slotProps" />
          </template>
        </LpFileTreeNode>
      </ul>
    </LpScrollArea>

    <!-- Selection stats. The default is a plain status line; pass #summary to
         render your own, or ignore both and read the `summary` event. -->
    <div
      v-if="checkable && ($slots.summary || summary.files || summary.dirs)"
      class="shrink-0 border-t border-line px-2 py-1.5 text-xs text-muted"
    >
      <slot name="summary" v-bind="summary">
        {{ summary.files }} {{ summary.files === 1 ? "file" : "files" }}<template
          v-if="summary.dirs"
        >, {{ summary.dirs }} {{ summary.dirs === 1 ? "folder" : "folders" }}</template>
        <template v-if="summary.bytes !== undefined"> · {{ summary.sizeLabel }}</template>
      </slot>
    </div>
  </div>
</template>
