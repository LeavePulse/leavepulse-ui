import { computed, getCurrentScope, onScopeDispose, watch, type ComputedRef } from "vue"
import { useKitStorage, usePersisted } from "../composables/usePersisted"
import { deserializeLayout, makeLayout, serializeLayout } from "./tree"
import { useLayout, type UseLayout } from "./useLayout"

/*
 * useWorkspaces — several named layouts over one useLayout.
 *
 * `controller` is the plain useLayout, so a <LayoutCanvas> binds to it as to
 * any other and never learns workspaces exist. This adds the shelf around it:
 * the saved layouts, which one is showing, and keeping both across a restart.
 * Edits land on the active workspace by themselves, debounced, because a
 * divider drag changes the tree on every frame.
 *
 * What comes back from storage or an import goes through `deserializeLayout`,
 * so a broken record costs that workspace its layout, not the page. Undo
 * history belongs to one workspace: a switch clears it, or Undo would walk
 * back into a layout from another one.
 */

const STORE_VERSION = 1
const SAVE_DELAY_MS = 300
const DEFAULT_NAME = "Workspace"

export interface WorkspaceSeed {
  id?: string
  name: string
  blocks: string[]
}

export interface WorkspaceEntry {
  id: string
  name: string
  layout: unknown
}

export interface WorkspaceSummary {
  id: string
  name: string
}

/** One workspace as a file: what export gives and import takes. */
export interface WorkspaceExport {
  name: string
  layout: unknown
}

interface WorkspaceStore {
  version: number
  active: string
  items: WorkspaceEntry[]
}

export interface UseWorkspacesOptions {
  /** Block ids of a new or unreadable workspace. */
  initial: string[]
  /** The workspaces a first visit starts with. One from `initial` when unset. */
  defaults?: WorkspaceSeed[]
  /** Keep them across visits under this key (see `usePersisted`). In memory without one. */
  persist?: string
  historyLimit?: number
}

export interface UseWorkspaces {
  /** The live layout of the active workspace, for <LayoutCanvas v-model>. */
  controller: UseLayout
  workspaces: ComputedRef<WorkspaceSummary[]>
  activeId: ComputedRef<string>
  switchTo: (id: string) => void
  /** Add one and show it. From `blocks`, else from `initial`. Returns its id. */
  create: (name: string, blocks?: string[]) => string
  /** Copy a workspace (the active one by default) and show the copy. */
  duplicate: (id?: string, name?: string) => string | null
  rename: (id: string, name: string) => void
  /** The last workspace stays: there is always one to show. */
  remove: (id: string) => void
  /** Back to `initial`, for the active workspace. */
  resetActive: () => void
  exportWorkspace: (id?: string) => WorkspaceExport | null
  /** Add a workspace from an export. Null, and nothing added, when it does not read as a layout. */
  importWorkspace: (data: unknown) => string | null
  /** Write pending edits now instead of after the debounce. */
  save: () => void
}

function isStore(value: unknown): value is WorkspaceStore {
  const store = value as WorkspaceStore | null
  if (!store || store.version !== STORE_VERSION || typeof store.active !== "string") return false
  if (!Array.isArray(store.items) || store.items.length === 0) return false
  const ids = new Set<string>()
  for (const item of store.items) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || ids.has(item.id)) return false
    ids.add(item.id)
  }
  return true
}

let idCount = 0
const newId = () => `ws-${Date.now().toString(36)}-${(idCount++).toString(36)}`

export function useWorkspaces(options: UseWorkspacesOptions): UseWorkspaces {
  const seed = (blocks: string[]) => serializeLayout(makeLayout(blocks))
  const seeds = options.defaults?.length ? options.defaults : [{ name: DEFAULT_NAME, blocks: options.initial }]
  const items = seeds.map((s, i) => ({ id: s.id ?? `ws-default-${i}`, name: s.name, layout: seed(s.blocks) }))

  const store = usePersisted<WorkspaceStore>(
    () => options.persist && `lp-workspaces:${options.persist}`,
    { version: STORE_VERSION, active: items[0]!.id, items },
    { validate: isStore },
  )
  const controller = useLayout({ initial: options.initial, historyLimit: options.historyLimit })

  const entry = (id: string) => store.value.items.find((item) => item.id === id)
  const activeId = computed(() => (entry(store.value.active) ? store.value.active : store.value.items[0]!.id))
  const workspaces = computed(() => store.value.items.map(({ id, name }) => ({ id, name })))

  let timer: ReturnType<typeof setTimeout> | undefined

  function save() {
    clearTimeout(timer)
    timer = undefined
    const current = entry(activeId.value)
    if (!current) return
    const layout = controller.serialize()
    if (JSON.stringify(layout) !== JSON.stringify(current.layout)) current.layout = layout
  }

  function show(id: string) {
    const target = entry(id)
    if (!target) return
    try {
      controller.hydrate(target.layout)
    } catch {
      // Unreadable: this workspace starts over, the others are untouched.
      controller.reset()
    }
    controller.clearHistory()
  }

  function switchTo(id: string) {
    if (!entry(id) || id === activeId.value) return
    save()
    store.value.active = id
    show(id)
  }

  function add(name: string, layout: unknown): string {
    save()
    const id = newId()
    store.value.items.push({ id, name: name.trim() || DEFAULT_NAME, layout })
    store.value.active = id
    show(id)
    return id
  }

  function duplicate(id = activeId.value, name?: string): string | null {
    save()
    const source = entry(id)
    if (!source) return null
    return add(name ?? source.name, JSON.parse(JSON.stringify(source.layout)))
  }

  function rename(id: string, name: string) {
    const target = entry(id)
    const trimmed = name.trim()
    if (target && trimmed) target.name = trimmed
  }

  function remove(id: string) {
    if (store.value.items.length <= 1) return
    const at = store.value.items.findIndex((item) => item.id === id)
    if (at === -1) return
    const wasActive = id === activeId.value
    if (!wasActive) save()
    store.value.items.splice(at, 1)
    if (!wasActive) return
    clearTimeout(timer)
    const next = store.value.items[Math.min(at, store.value.items.length - 1)]!
    store.value.active = next.id
    show(next.id)
  }

  function exportWorkspace(id = activeId.value): WorkspaceExport | null {
    save()
    const source = entry(id)
    return source ? JSON.parse(JSON.stringify({ name: source.name, layout: source.layout })) : null
  }

  function importWorkspace(data: unknown): string | null {
    const candidate = data as WorkspaceExport | null
    if (!candidate || typeof candidate.name !== "string") return null
    try {
      return add(candidate.name, serializeLayout(deserializeLayout(candidate.layout as Parameters<typeof deserializeLayout>[0])))
    } catch {
      return null
    }
  }

  show(activeId.value)

  watch(
    () => JSON.stringify(controller.serialize()),
    () => {
      clearTimeout(timer)
      timer = setTimeout(save, SAVE_DELAY_MS)
    },
  )
  // Direct: by now the persisted ref's own watcher has stopped with the scope.
  const storage = useKitStorage()
  if (getCurrentScope()) {
    onScopeDispose(() => {
      save()
      if (options.persist) storage.set(`lp-workspaces:${options.persist}`, JSON.stringify(store.value))
    })
  }

  return {
    controller,
    workspaces,
    activeId,
    switchTo,
    create: (name, blocks) => add(name, seed(blocks ?? options.initial)),
    duplicate,
    rename,
    remove,
    resetActive: () => {
      controller.reset()
      save()
    },
    exportWorkspace,
    importWorkspace,
    save,
  }
}
