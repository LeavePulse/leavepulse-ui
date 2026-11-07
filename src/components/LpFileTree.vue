<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }

/* One text-sm line with the row's own vertical padding. */
const DEFAULT_ROW_HEIGHT = 28
/* Rows rendered past each end of the view, so a fast scroll shows no gap. */
const OVERSCAN_ROWS = 8
</script>

<script setup lang="ts">
/*
 * File/folder tree — the kit convention for browsing a hierarchy of files so
 * apps stop re-implementing indent math, chevron state and tree keyboard rules.
 * Data-driven: pass a `FileNode[]`; it renders directories-first rows with
 * type-derived icons, expand/collapse, single selection, and optional per-row
 * context menus.
 *
 * Read-only by design — it navigates, it doesn't mutate. Renames/uploads belong
 * to the caller, reachable through `node.menu`, and `renamable` and `movable`
 * only ask: the tree emits `rename` and `move`, the app changes `nodes`.
 *
 * Lazy loading: a directory whose `children` is undefined is treated as
 * not-yet-loaded — it stays expandable, shows a spinner while the caller fetches
 * (`loadingIds`), and emits `expand` once. An empty array means genuinely empty.
 *
 * Keyboard (role="tree" conventions): ↑/↓ move through visible rows, → opens a
 * directory or steps into it, ← collapses or steps out to the parent, Home/End
 * jump to the ends, Enter/Space activates. A roving tabindex keeps the tree a
 * single tab stop. `renamable` adds F2; `multiple` adds Shift+↑/↓ and Ctrl+A.
 *
 * Optional, and off unless asked for:
 * - `searchable`, `filter`: only the matches and the folders leading to them.
 *   Only loaded entries can be found. A ticked folder ticks what is shown.
 * - `breadcrumb`: the path of the selected (or focused) row, each step a way back.
 * - `load`: the tree fetches a folder itself, aborting if it is closed meanwhile.
 * - `multiple`: Ctrl/Cmd and Shift pick rows into `selection`, by id, so a pick
 *   outlives its folder being closed or filtered away.
 * - `movable`: drag rows onto a folder (mouse only, HTML drag and drop).
 * - `virtual`: renders only the rows in view, for directories of thousands. The
 *   DOM is flat, so rows state aria-level, aria-setsize and aria-posinset instead
 *   of nesting in role="group"; aria-setsize stays true for rows not rendered.
 *   The focused row always stays mounted, so the tab stop never goes. Rows need
 *   one height (`rowHeight`), and folders open at once, with no fold.
 */
import { clamp } from "../composables/clamp"
import { computed, h, nextTick, onBeforeUnmount, ref, shallowRef, watch, type FunctionalComponent } from "vue"
import { useLocale } from "../composables/useLocale"
import { isElement } from "../composables/useView"
import {
  ancestorIds,
  canDrop,
  computeStats,
  filterTree,
  flattenVisible,
  formatSize,
  isFilterEmpty,
  nodeTrail,
  rangeIds,
  renameProblem,
  rowWindow,
  sortNodes,
  subtreeIds,
  topmostIds,
  withLoadedChildren,
  type FileNode,
  type FileTreeFilter,
} from "./fileTree"
import LpBreadcrumbs from "./LpBreadcrumbs.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpFileTreeNode from "./LpFileTreeNode.vue"
import LpInput from "./LpInput.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpSkeleton from "./LpSkeleton.vue"
import { usePersisted } from "../composables/usePersisted"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useLabels } from "../composables/useLpConfig"
import { useResizeObserver } from "../composables/useResizeObserver"

export type { FileNode, FileTreeFilter } from "./fileTree"

/** Rolled-up stats for the ticked entries — what a backup picker summarises. */
export interface FileTreeLabels {
  [key: string]: string
  empty: string
  emptyDescription: string
  file: string
  files: string
  folder: string
  folders: string
  search: string
  noMatches: string
  rename: string
  path: string
}

/** `move`: what was dropped (a moved folder carries its content) and where. */
export interface FileTreeMove {
  nodes: FileNode[]
  target: FileNode
}

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
    /**
     * Expanded directory ids (v-model:expanded). Omit to let the tree own it.
     * Unbinding it later keeps the last set shown; it does not go back to `persist`.
     */
    expanded?: string[]
    /**
     * Remember which folders are open across visits under this key (the
     * kit's storage, see `usePersisted`), when the tree owns its expansion.
     */
    persist?: string
    /** Directory ids currently fetching children — shows a spinner on the row. */
    loadingIds?: string[]
    /**
     * Multi-select mode: every row gets a tri-state checkbox and ticking a
     * directory cascades to its loaded subtree. This is the mode for "pick what
     * to back up" — `selected` stays independent (it's the highlighted row).
     */
    checkable?: boolean
    /**
     * Ticked node ids (v-model:checked). An id no longer in `nodes` stays ticked:
     * with lazy children it may only be unloaded, so dropping a deleted one is
     * the app's call.
     */
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
    labels?: Partial<FileTreeLabels>
    /** Narrow the tree by name, path, type, size or date. Combined with `searchable`. */
    filter?: FileTreeFilter
    /** A search field above the tree. */
    searchable?: boolean
    /** The search text (v-model:query). Omit to let the tree own it. */
    query?: string
    /** The path of the selected row above the tree, each step a way back to it. */
    breadcrumb?: boolean
    /**
     * Fetch a folder when it first opens; the result is kept by the tree and
     * `children` in `nodes` win over it. `signal` aborts when the folder is
     * closed first. Rejecting emits `load-error` and the next open tries again.
     * `expand` still fires. Without this, `expand` is yours to answer.
     */
    load?: (node: FileNode, signal: AbortSignal) => Promise<FileNode[]>
    /** Ctrl/Cmd and Shift pick several rows into `selection`. */
    multiple?: boolean
    /** Picked ids (v-model:selection), kept while their folders close or filter away. */
    selection?: string[]
    /** Drag rows onto a folder. Emits `move`; the app changes `nodes`. Mouse only. */
    movable?: boolean
    /** F2 renames the focused row in place. Emits `rename`; the app changes `nodes`. */
    renamable?: boolean
    /** Render only the rows in view. See the note above on what it changes. */
    virtual?: boolean
    /** Height of every row in `virtual` mode, in px. */
    rowHeight?: number
  }>(),
  {
    rowHeight: DEFAULT_ROW_HEIGHT,
    sort: true,
    iconSize: 15,
    checkable: false,
    showSize: false,
    showModified: false,
    loading: false,
    skeletonRows: 8,
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
  (e: "update:query", value: string): void
  (e: "update:selection", ids: string[]): void
  /** Rows dropped on a folder. Nothing moves until the app changes `nodes`. */
  (e: "move", move: FileTreeMove): void
  /** A row given a new, valid name. Nothing changes until the app changes `nodes`. */
  (e: "rename", node: FileNode, name: string): void
  (e: "load-error", node: FileNode, error: unknown): void
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
const storedOpen = usePersisted<string[] | null>(
  () => props.expanded === undefined && props.persist && `lp-file-tree:${props.persist}`,
  null,
  { validate: (value): value is string[] | null => value === null || (Array.isArray(value) && value.every((id) => typeof id === "string")) },
)
const openIds = ref<Set<string>>(new Set(props.expanded ?? storedOpen.value ?? []))
watch(
  () => props.expanded,
  (ids) => {
    if (ids) openIds.value = new Set(ids)
  },
)
watch(openIds, (ids) => {
  if (props.expanded === undefined && props.persist) storedOpen.value = [...ids]
})

const text = useLabels<FileTreeLabels>(
  "fileTree",
  {
    empty: "No files",
    emptyDescription: "This folder is empty.",
    file: "file",
    files: "files",
    folder: "folder",
    folders: "folders",
    search: "Search files",
    noMatches: "No matching files",
    rename: "Rename",
    path: "Path",
  },
  () => props.labels,
)

// What `load` brought back, laid over `nodes`. Everything below reads `source`.
const loadedChildren = shallowRef<ReadonlyMap<string, FileNode[]>>(new Map())
const source = computed(() => withLoadedChildren(props.nodes, loadedChildren.value))

const ownLoading = ref<Set<string>>(new Set())
const loadingSet = computed(() => new Set([...(props.loadingIds ?? []), ...ownLoading.value]))

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
  walk(source.value)
  return { byId, parentOfId }
})

const byId = computed(() => index.value.byId)

// One pass for the whole tree; every row reads its entry by id instead of
// walking its own subtree on each render. Declared before `summary`, which
// reads it and is watched eagerly — a `const` below that watcher is still in
// its temporal dead zone when the watcher first runs.
const stats = computed(() => computeStats(source.value, checkedIds.value))

// Read by `summary` below, so declared ahead of it for the same reason.
const locale = useLocale()

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

  walk(source.value)
  return {
    files,
    dirs,
    bytes: sized ? bytes : undefined,
    sizeLabel: sized ? formatSize(bytes, locale.value) : "—",
  }
})

watch(summary, (value) => emit("summary", value), { immediate: true })

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

// The search text: the bound `query`, else the tree's own.
const ownQuery = ref("")
const queryText = computed(() => props.query ?? ownQuery.value)
function setQuery(value: string) {
  ownQuery.value = value
  emit("update:query", value)
}

const activeFilter = computed<FileTreeFilter>(() => ({ ...props.filter, query: queryText.value || props.filter?.query }))
const filtering = computed(() => !isFilterEmpty(activeFilter.value))
const filtered = computed(() => filterTree(source.value, activeFilter.value))

// A filter opens the folders holding a match without touching the user's own
// expansion. Closing one of those lasts until the filter changes.
const closedWhileFiltering = ref<Set<string>>(new Set())
watch([() => props.filter, queryText], () => {
  closedWhileFiltering.value = new Set()
})
const shownOpen = computed(() => {
  if (!filtering.value) return openIds.value
  const open = new Set([...openIds.value, ...filtered.value.openIds])
  for (const id of closedWhileFiltering.value) open.delete(id)
  return open
})

const roots = computed(() => (props.sort ? sortNodes(filtered.value.nodes) : filtered.value.nodes))

const rows = computed(() => flattenVisible(filtered.value.nodes, shownOpen.value, props.sort))

/** Rows currently visible, in render order — the axis the arrow keys walk. */
const visible = computed(() => rows.value.map((row) => row.node))

// The roving-tabindex row. Follows selection when the caller sets one; falls
// back to the first row so the tree is reachable by Tab before any click.
const root = ref<HTMLElement | null>(null)
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
      // changed) — fall back to the first visible row. Runs before the DOM
      // update, so it can still see whether that row held the keyboard, which
      // would otherwise drop to the page with the row.
      const active = root.value?.ownerDocument.activeElement
      const hadFocus = isElement(active) && active.getAttribute("data-node-id") === focusedId.value
      focusedId.value = rows[0].id
      if (hadFocus) void nextTick(() => focusRow(rows[0].id))
    }
  },
  { immediate: true },
)

function focusRowElement(id: string) {
  // Rows are plain divs keyed by data-node-id; query rather than hold refs
  // through the recursion.
  const el = root.value?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
  el?.focus()
  el?.scrollIntoView({ block: "nearest" })
}

function focusRow(id: string) {
  focusedId.value = id
  if (!props.virtual) {
    focusRowElement(id)
    return
  }
  // A row out of the window has no element yet: bring it in, then reach for it.
  scrollToRow(id)
  void nextTick(() => focusRowElement(id))
}

// `virtual`: which rows exist, from the viewport's scroll position and height.
const scrollArea = ref<{ viewportEl: HTMLElement | null } | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

useResizeObserver(
  () => (props.virtual ? scrollArea.value?.viewportEl : null),
  (_, el) => {
    viewportHeight.value = el.clientHeight
  },
  { immediate: true },
)

function onScroll(event: Event) {
  if (props.virtual) scrollTop.value = (event.target as HTMLElement).scrollTop
}

function scrollToRow(id: string) {
  const viewport = scrollArea.value?.viewportEl
  const at = rows.value.findIndex((row) => row.node.id === id)
  if (!viewport || at < 0) return
  const top = at * props.rowHeight
  const bottom = top + props.rowHeight
  if (top < viewport.scrollTop) viewport.scrollTop = top
  else if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = bottom - viewport.clientHeight
  scrollTop.value = viewport.scrollTop
}

/** The rows to mount. The focused one stays out of view too: it holds the tab stop. */
const mountedRows = computed(() => {
  const { start, end } = rowWindow(scrollTop.value, viewportHeight.value, props.rowHeight, rows.value.length, OVERSCAN_ROWS)
  const mounted: { row: (typeof rows.value)[number]; index: number }[] = []
  for (let index = start; index < end; index++) mounted.push({ row: rows.value[index], index })
  const focused = rows.value.findIndex((row) => row.node.id === focusedId.value)
  if (focused >= 0 && (focused < start || focused >= end)) mounted.push({ row: rows.value[focused], index: focused })
  return mounted
})

function setExpanded(next: Set<string>) {
  openIds.value = next
  emit("update:expanded", [...next])
}

function expand(node: FileNode) {
  if (closedWhileFiltering.value.has(node.id)) {
    const closed = new Set(closedWhileFiltering.value)
    closed.delete(node.id)
    closedWhileFiltering.value = closed
    if (filtered.value.openIds.has(node.id)) return
  }
  if (node.kind !== "dir" || openIds.value.has(node.id)) return
  const next = new Set(openIds.value)
  next.add(node.id)
  setExpanded(next)
  // Fetch on first open only when the children aren't loaded yet.
  if (node.children === undefined && !requested.has(node.id)) {
    requested.add(node.id)
    emit("expand", node)
    void fetchChildren(node)
  }
}

// One request per folder. A controller that is no longer in the map lost its
// place, so its answer is dropped even if the fetch ignored the signal.
const fetches = new Map<string, AbortController>()

function setFetching(id: string, on: boolean) {
  const next = new Set(ownLoading.value)
  if (on) next.add(id)
  else next.delete(id)
  ownLoading.value = next
}

async function fetchChildren(node: FileNode) {
  if (!props.load) return
  const controller = new AbortController()
  fetches.set(node.id, controller)
  setFetching(node.id, true)
  try {
    const children = await props.load(node, controller.signal)
    if (fetches.get(node.id) !== controller) return
    loadedChildren.value = new Map(loadedChildren.value).set(node.id, children)
  } catch (error) {
    if (fetches.get(node.id) !== controller) return
    requested.delete(node.id)
    emit("load-error", node, error)
  } finally {
    if (fetches.get(node.id) === controller) {
      fetches.delete(node.id)
      setFetching(node.id, false)
    }
  }
}

function cancelFetch(id: string) {
  const controller = fetches.get(id)
  if (!controller) return
  fetches.delete(id)
  controller.abort()
  setFetching(id, false)
  requested.delete(id)
}

onBeforeUnmount(() => {
  for (const controller of fetches.values()) controller.abort()
  fetches.clear()
})

function collapse(node: FileNode) {
  if (filtered.value.openIds.has(node.id)) {
    closedWhileFiltering.value = new Set(closedWhileFiltering.value).add(node.id)
  }
  if (!openIds.value.has(node.id)) return
  cancelFetch(node.id)
  // A fetch that failed left `children` unset; collapsing lets the next open
  // ask again instead of showing an empty folder forever.
  if (node.children === undefined && !loadingSet.value.has(node.id)) requested.delete(node.id)
  const next = new Set(openIds.value)
  next.delete(node.id)
  setExpanded(next)
  emit("collapse", node)
}

function onToggle(node: FileNode) {
  if (shownOpen.value.has(node.id)) collapse(node)
  else expand(node)
}

function onSelect(node: FileNode) {
  if (node.disabled) return
  // Clicking the highlighted row again clears it — a selection you can't undo
  // without picking something else is a trap.
  if (props.selected === node.id) {
    emit("update:selected", "")
    if (props.multiple) setPicked(new Set())
    return
  }
  emit("update:selected", node.id)
  if (props.multiple) {
    pickAnchor = node.id
    setPicked(new Set([node.id]))
  }
  emit("select", node)
  if (node.kind === "file") emit("open", node)
}

// `multiple`. Ids, not rows, so a pick outlives its folder closing or a filter
// hiding it. Same controlled/uncontrolled deal as `expanded`.
const pickedIds = ref<Set<string>>(new Set(props.selection ?? []))
watch(
  () => props.selection,
  (ids) => {
    if (ids) pickedIds.value = new Set(ids)
  },
)
let pickAnchor: string | undefined

function setPicked(next: Set<string>) {
  pickedIds.value = next
  emit("update:selection", [...next])
}

function onPick(node: FileNode, mode: "toggle" | "range") {
  const next = new Set(pickedIds.value)
  if (mode === "range") {
    for (const id of rangeIds(visible.value, pickAnchor, node.id)) next.add(id)
  } else {
    pickAnchor = node.id
    if (!next.delete(node.id)) next.add(node.id)
  }
  setPicked(next)
}

function extendPick(delta: number) {
  pickAnchor ??= focusedId.value
  move(delta)
  if (!focusedId.value) return
  const next = new Set(pickedIds.value)
  for (const id of rangeIds(visible.value, pickAnchor, focusedId.value)) next.add(id)
  setPicked(next)
}

// `movable`. Drags inside this tree only: `moving` is empty for anything else.
let moving: string[] = []
const dropTargetId = ref<string>()

function onMoveStart(node: FileNode) {
  const ids = props.multiple && pickedIds.value.has(node.id) ? [...pickedIds.value] : [node.id]
  moving = topmostIds(ids.filter((id) => byId.value.has(id)), index.value.parentOfId)
}

function onMoveOver(node: FileNode, event: DragEvent) {
  const allowed = canDrop(moving, node, index.value.parentOfId)
  dropTargetId.value = allowed ? node.id : undefined
  if (!allowed) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
}

function onMoveLeave(node: FileNode) {
  if (dropTargetId.value === node.id) dropTargetId.value = undefined
}

function onMoveEnd() {
  moving = []
  dropTargetId.value = undefined
}

function onMoveDrop(node: FileNode) {
  const target = byId.value.get(node.id)
  if (target && canDrop(moving, target, index.value.parentOfId)) {
    emit("move", { nodes: moving.flatMap((id) => byId.value.get(id) ?? []), target })
  }
  onMoveEnd()
}

// `renamable`. The tree holds only the text being typed.
const renaming = ref<{ node: FileNode; value: string } | null>(null)

const siblingsOf = (node: FileNode) => {
  const parent = index.value.parentOfId.get(node.id)
  return (parent === undefined ? source.value : byId.value.get(parent)?.children) ?? []
}

const renameInvalid = computed(() => {
  const edit = renaming.value
  return !!edit && renameProblem(edit.value, edit.node, siblingsOf(edit.node)) !== null
})

function startRename(id: string) {
  const node = byId.value.get(id)
  if (!props.renamable || !node || node.disabled) return
  focusedId.value = id
  renaming.value = { node, value: node.name }
}

function endRename(refocus: boolean) {
  const id = renaming.value?.node.id
  renaming.value = null
  if (refocus && id) void nextTick(() => focusRow(id))
}

// Enter on a bad name stays and says so. Leaving the field gives it up instead:
// the user has gone elsewhere, and a field that holds them there is a trap.
function commitRename(blurred = false) {
  const edit = renaming.value
  if (!edit) return
  if (renameInvalid.value) {
    if (blurred) endRename(false)
    return
  }
  const name = edit.value.trim()
  if (name !== edit.node.name) emit("rename", edit.node, name)
  endRename(!blurred)
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
  const next = rows[clamp((i < 0 ? 0 : i) + delta, 0, rows.length - 1)]
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
      if (props.multiple && e.shiftKey) extendPick(1)
      else move(1)
      break
    case "ArrowUp":
      e.preventDefault()
      if (props.multiple && e.shiftKey) extendPick(-1)
      else move(-1)
      break
    case "F2":
      if (!node || !props.renamable) return
      e.preventDefault()
      startRename(node.id)
      break
    case "a":
      if (!props.multiple || !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setPicked(new Set([...pickedIds.value, ...visible.value.filter((row) => !row.disabled).map((row) => row.id)]))
      break
    case "ArrowRight": {
      if (!node) return
      e.preventDefault()
      // Closed directory opens; already-open one steps to its first child.
      if (node.kind === "dir" && !shownOpen.value.has(node.id)) expand(node)
      else if (node.kind === "dir" && node.children?.length) move(1)
      break
    }
    case "ArrowLeft": {
      if (!node) return
      e.preventDefault()
      // Open directory closes; anything else steps out to the parent row.
      if (node.kind === "dir" && shownOpen.value.has(node.id)) collapse(node)
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
  for (const ancestor of ancestorIds(source.value, id)) next.add(ancestor)
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
  walk(source.value)
  setExpanded(next)
}

function collapseAll() {
  setExpanded(new Set())
}

/** Fetch a folder again through `load`. */
function reload(id: string) {
  const node = byId.value.get(id)
  if (!node || !props.load) return
  cancelFetch(id)
  void fetchChildren(node)
}

defineExpose({ reveal, expandAll, collapseAll, checkAll, clearChecked, summary, rename: startRename, reload })

// LpBreadcrumbs clicks through a link component; a step here goes nowhere but a row.
const CrumbButton: FunctionalComponent<{ to?: string }> = (_, { slots }) => h("button", { type: "button" }, slots.default?.())
CrumbButton.props = ["to"]

const trail = computed(() => {
  const id = props.selected || focusedId.value
  return props.breadcrumb && id ? nodeTrail(id, byId.value, index.value.parentOfId) : []
})
const crumbs = computed(() => trail.value.map((node) => ({ label: node.name, to: node.id })))

// What every row takes, whichever way the rows are laid out.
const rowProps = computed(() => ({
  expanded: shownOpen.value,
  loading: loadingSet.value,
  selectedId: props.selected,
  focusedId: focusedId.value,
  sort: props.sort,
  iconSize: props.iconSize,
  checkable: props.checkable,
  checked: checkedIds.value,
  stats: stats.value,
  showSize: props.showSize,
  showModified: props.showModified,
  selectedIds: props.multiple ? pickedIds.value : undefined,
  multiple: props.multiple,
  movable: props.movable,
  dropTargetId: dropTargetId.value,
  renamingId: renaming.value?.node.id,
  renameValue: renaming.value?.value,
  renameInvalid: renameInvalid.value,
  renameLabel: text.value.rename,
}))

const rowEvents = {
  select: onSelect,
  toggle: onToggle,
  focus: (node: FileNode) => (focusedId.value = node.id),
  check: onCheck,
  pick: onPick,
  moveStart: onMoveStart,
  moveOver: onMoveOver,
  moveLeave: onMoveLeave,
  moveDrop: onMoveDrop,
  moveEnd: onMoveEnd,
  renameInput: (value: string) => {
    if (renaming.value) renaming.value = { ...renaming.value, value }
  },
  renameCommit: commitRename,
  renameCancel: () => endRename(true),
}

// The tree fills its container; a consumer giving it a fixed height or width in a split pane must be able to say so.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex h-full w-full min-w-0 flex-col gap-1 overflow-hidden",
)
</script>

<template>
  <div v-if="loading"
    :class="rootClass"
    v-bind="rest">
    <LpSkeleton
      v-for="n in skeletonRows"
      :key="n"
      class="h-7 shrink-0"
      :style="{ marginLeft: `${(n % 3) * 14}px` }"
    />
  </div>

  <LpEmptyState
    v-else-if="!roots.length && !filtering"
    icon="lucide:folder-search"
    :title="emptyLabel ?? text.empty"
    :description="emptyDescription ?? text.emptyDescription"
  />

  <!-- h-full so the tree fills whatever box the caller gave it and the scroll
       area below gets a bounded height; without it the rows just grow past the
       container and nothing ever scrolls. min-w-0/w-full for the same reason
       sideways: a long path must truncate inside the box rather than widen it. -->
  <div v-else class="flex h-full w-full min-w-0 flex-col">
    <LpInput
      v-if="searchable"
      type="search"
      class="mb-1 shrink-0"
      :model-value="queryText"
      :placeholder="text.search"
      :aria-label="text.search"
      @update:model-value="setQuery($event ?? '')"
    />
    <LpBreadcrumbs
      v-if="crumbs.length"
      class="mb-1 shrink-0 text-xs"
      :items="crumbs"
      :as="CrumbButton"
      :labels="{ nav: text.path }"
      @navigate="(_, i) => reveal(trail[i].id)"
    />
    <LpEmptyState
      v-if="!roots.length"
      icon="lucide:search-x"
      :title="text.noMatches"
    />
    <LpScrollArea v-else ref="scrollArea" class="min-h-0 w-full min-w-0 flex-1" @scroll="onScroll">
      <ul
        ref="root"
        role="tree"
        :aria-multiselectable="checkable || multiple"
        class="flex min-w-0 flex-col"
        :class="virtual ? 'relative' : ''"
        :style="virtual ? { height: `${rows.length * rowHeight}px` } : undefined"
        @keydown="onKeydown"
      >
        <!-- Flat and windowed: each row says its own level and place, and sits at
             its own offset, so a row kept for focus needs no filler around it. -->
        <template v-if="virtual">
          <LpFileTreeNode
            v-for="{ row, index: at } in mountedRows"
            :key="row.node.id"
            class="absolute inset-x-0 top-0"
            :style="{ height: `${rowHeight}px`, transform: `translateY(${at * rowHeight}px)` }"
            :node="row.node"
            :depth="row.depth"
            flat
            :set-size="row.setSize"
            :pos-in-set="row.posInSet"
            v-bind="rowProps"
            v-on="rowEvents"
          >
            <template #row="slotProps">
              <slot name="row" v-bind="slotProps" />
            </template>
          </LpFileTreeNode>
        </template>
        <template v-else>
          <LpFileTreeNode
            v-for="node in roots"
            :key="node.id"
            :node="node"
            :depth="0"
            v-bind="rowProps"
            v-on="rowEvents"
          >
            <template #row="slotProps">
              <slot name="row" v-bind="slotProps" />
            </template>
          </LpFileTreeNode>
        </template>
      </ul>
    </LpScrollArea>

    <!-- Selection stats. The default is a plain status line; pass #summary to
         render your own, or ignore both and read the `summary` event. -->
    <div
      v-if="checkable && ($slots.summary || summary.files || summary.dirs)"
      class="shrink-0 border-t border-line px-2 py-1.5 text-xs text-muted"
    >
      <slot name="summary" v-bind="summary">
        {{ summary.files }} {{ summary.files === 1 ? text.file : text.files }}<template
          v-if="summary.dirs"
        >, {{ summary.dirs }} {{ summary.dirs === 1 ? text.folder : text.folders }}</template>
        <template v-if="summary.bytes !== undefined"> · {{ summary.sizeLabel }}</template>
      </slot>
    </div>
  </div>
</template>
