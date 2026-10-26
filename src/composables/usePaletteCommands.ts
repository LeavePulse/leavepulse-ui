import { computed, getCurrentInstance, h, inject, onMounted, onUpdated, onScopeDispose, provide, ref, shallowReactive, shallowRef, toValue, useId, type Component, type Directive, type InjectionKey, type MaybeRefOrGetter } from "vue"
import type { Command } from "../components/LpCommandPalette.vue"
import { provideField, useField } from "./useField"
import { useLabels } from "./useLpConfig"

export interface PaletteRegistration {
  commands: () => readonly Command[]
  priority: number
  /** Discovered from a component rather than written by the app: an id clash numbers it instead of hiding it. */
  automatic?: boolean
}

function uniqueCommands(commands: readonly Command[]): Command[] {
  const found = new Map<string, Command>()
  for (const command of commands) if (!found.has(command.id)) found.set(command.id, command)
  return [...found.values()]
}

/*
 * A discovered command is keyed by its scope and label, not by a generated id:
 * `useId` follows mount order, so a pin or a recent entry on a field pointed at
 * another field (or nothing) once the page mounted its parts differently. Two
 * fields with one label in one scope would then share an id, so the second and
 * later get `~2`, `~3` in mount order instead of the second vanishing. A manual
 * definition with the same id still replaces the discovered one.
 */
function numbered(entries: readonly PaletteRegistration[]): Command[] {
  const manual = new Set<string>()
  const seen = new Map<string, number>()
  const out: Command[] = []
  for (const entry of entries) {
    for (const command of entry.commands()) {
      if (!entry.automatic) {
        // Two mounts of one component (a header switcher and its phone twin)
        // register the same command: it is one command, listed once.
        if (manual.has(command.id)) continue
        manual.add(command.id)
        out.push(command)
        continue
      }
      if (manual.has(command.id)) continue
      const count = (seen.get(command.id) ?? 0) + 1
      seen.set(command.id, count)
      if (count === 1) {
        out.push(command)
        continue
      }
      const id = `${command.id}~${count}`
      out.push({ ...command, id, actions: command.actions?.map(action => ({ ...action, id: action.id.replace(command.id, id) })) })
    }
  }
  return uniqueCommands(out)
}

/** One registry per application/provider; never shared between SSR requests. */
export function createPaletteRegistry() {
  const entries = shallowReactive(new Map<symbol, PaletteRegistration>())
  const commands = computed(() => numbered([...entries.values()].sort((a, b) => b.priority - a.priority)))
  return {
    commands,
    register(entry: PaletteRegistration) {
      const key = Symbol()
      entries.set(key, entry)
      return () => { entries.delete(key) }
    },
  }
}
export type PaletteRegistry = ReturnType<typeof createPaletteRegistry>

export interface PaletteScope {
  registry: PaletteRegistry
  id: string
  label: string
  depth: number
  enabled: boolean
  discover: boolean
}
const SCOPE: InjectionKey<PaletteScope> = Symbol.for("lp-palette-scope")
const BLOCKED: InjectionKey<boolean> = Symbol.for("lp-palette-blocked")
const scopeElements = new WeakMap<Element, PaletteScope>()
export function bindPaletteScopeElement(element: Element, scope: PaletteScope) { scopeElements.set(element, scope) }
export const usePaletteScope = () => inject(SCOPE, null)
export const providePaletteScope = (scope: PaletteScope) => provide(SCOPE, scope)
/** Preview controls and compound controls must not discover their own implementation. */
export function suppressPaletteDiscovery() { provide(BLOCKED, true) }

export function usePaletteCommands(commands: MaybeRefOrGetter<readonly Command[]>, options: { automatic?: boolean; scope?: PaletteScope } = {}) {
  const scope = options.scope ?? usePaletteScope()
  const blocked = inject(BLOCKED, false)
  if (!scope || blocked) return
  const unregister = scope.registry.register({
    automatic: options.automatic,
    priority: scope.depth * 100 + (options.automatic ? 0 : 10),
    commands: () => scope.enabled && (!options.automatic || scope.discover)
      ? toValue(commands).map(command => ({
        ...command,
        group: command.group ?? scope.label,
        // A discovered "Save" or "Restart" says nothing on its own: typing the
        // page or card it sits in ("settings save") has to find it.
        keywords: options.automatic ? [...(command.keywords ?? []), scope.label] : command.keywords,
      })) : [],
  })
  onScopeDispose(unregister)
}

/** Manual definitions override a discovered command without changing its place. */
export function mergePaletteCommands(discovered: readonly Command[], manual: readonly Command[]): Command[] {
  const overrides = new Map(manual.map(command => [command.id, command]))
  return uniqueCommands([...discovered.map(command => overrides.get(command.id) ?? command), ...manual])
}

export type PaletteControlOptions = false | { id?: string; label?: string; description?: string; keywords?: string[] }

export interface PaletteTargetOptions { id: string; label: string; description?: string; keywords?: string[]; action?: "click" | "focus" }
const targets = new WeakMap<HTMLElement, { update: (value: PaletteTargetOptions) => void; stop: () => void }>()
/** Native/custom markup opt-in; editing values still goes through the component's own binding. */
export const vPalette: Directive<HTMLElement, PaletteTargetOptions> = {
  mounted(el, binding) {
    if (el.closest("[data-lp-command-preview]")) return
    const owner = binding.instance?.$ as { provides?: Record<symbol, unknown> } | undefined
    const ancestor = el.closest("[data-lp-command-scope]")
    const scope = (ancestor && scopeElements.get(ancestor)) ?? owner?.provides?.[SCOPE as symbol] as PaletteScope | undefined
    if (!scope) return
    const value = shallowRef(binding.value)
    const stop = scope.registry.register({ priority: scope.depth * 100 + 10, commands: () => scope.enabled ? [{
      id: `${scope.id}/${value.value.id}`, label: value.value.label,
      description: value.value.description, keywords: value.value.keywords, group: scope.label,
      disabled: el.matches(":disabled,[aria-disabled=true]"),
      afterClose: () => {
        if (!el.isConnected || el.matches(":disabled,[aria-disabled=true]")) return
        el.scrollIntoView({ block: "nearest" })
        if (value.value.action === "click") el.click()
        else el.focus({ preventScroll: true })
      },
    }] : [] })
    targets.set(el, { stop, update: next => { value.value = { ...next } } })
  },
  updated(el, binding) { targets.get(el)?.update(binding.value) },
  unmounted(el) { targets.get(el)?.stop(); targets.delete(el) },
}

export function usePaletteAction(options: { label?: () => string | undefined; element: () => HTMLElement | null | undefined; disabled?: () => boolean }) {
  const instance = getCurrentInstance()
  const scope = usePaletteScope()
  if (!instance || !scope || inject(BLOCKED, false)) return
  const domLabel = ref("")
  const syncLabel = () => { domLabel.value = options.element()?.textContent?.trim() ?? "" }
  onMounted(syncLabel)
  onUpdated(syncLabel)
  usePaletteCommands(() => {
    const config = instance.props.palette as PaletteControlOptions | undefined
    const label = (config || {}).label ?? options.label?.() ?? domLabel.value
    if (config === false || !label) return []
    return [{
      id: `${scope.id}/${config?.id ?? label}`, label, description: config?.description,
      keywords: config?.keywords, disabled: options.disabled?.(),
      afterClose: () => { if (!options.disabled?.()) options.element()?.click() },
    }]
  }, { automatic: true })
}

export function usePaletteControl(options: {
  label?: () => string | undefined
  disabled?: () => boolean
  invalid?: () => boolean
  available?: () => boolean
  ownsChildren?: boolean
  editorProps?: () => Record<string, unknown>
} = {}) {
  const instance = getCurrentInstance()
  const scope = usePaletteScope()
  const blocked = inject(BLOCKED, false)
  if (options.ownsChildren) suppressPaletteDiscovery()
  if (!instance || !scope || blocked) return
  const text = useLabels("paletteControl", { focus: "Go to field" })
  const field = useField()
  const settings = () => (instance.attrs.palette ?? instance.props.palette) as PaletteControlOptions | undefined
  const label = () => (settings() || {}).label ?? options.label?.() ?? field?.value.label
    ?? instance.attrs["aria-label"] as string | undefined
  const error = () => instance.props.error as string | undefined ?? field?.value.error
  const hint = () => instance.props.hint as string | undefined ?? field?.value.hint
  const writable = () => !!(instance.vnode.props?.["onUpdate:modelValue"] || instance.vnode.props?.["onUpdate:model-value"] || instance.props.action)
  const focus = () => {
    const el = instance.proxy?.$el as HTMLElement | undefined
    const target = el?.matches?.('input,button,textarea,select,[tabindex="0"]') ? el
      : el?.querySelector<HTMLElement>('input:not([type="hidden"]),button,textarea,select,[tabindex="0"]')
    target?.scrollIntoView({ block: "nearest" })
    target?.focus({ preventScroll: true })
  }
  const Editor: Component = {
    name: "PaletteControlEditor",
    setup() {
      suppressPaletteDiscovery()
      const editorId = `lp-palette-editor-${useId()}`
      provideField(computed(() => ({
        id: editorId, label: label(), labelId: `${editorId}-label`,
        describedBy: error() || hint() ? `${editorId}-message` : undefined,
        required: !!(field?.value.required ?? instance.props.required),
        disabled: !!options.disabled?.(), invalid: !!options.invalid?.(),
      })))
      return () => {
        const raw = { ...instance.vnode.props, ...instance.props, ...options.editorProps?.() }
        for (const key of Object.keys(raw)) if (key === "ref" || key === "key" || key.startsWith("onVnode")) delete raw[key]
        return h("div", { class: "flex flex-col gap-3" }, [
          h(raw.label ? "h3" : "label", { id: `${editorId}-label`, for: raw.label ? undefined : editorId, class: "text-sm font-semibold text-ink" }, label()),
          h(instance.type as Component, {
            ...raw, id: undefined, name: undefined, form: undefined, autofocus: undefined, palette: false,
            disabled: options.disabled?.() || !writable(), invalid: options.invalid?.(),
            required: field?.value.required ?? instance.props.required,
            "aria-label": label(), class: "w-full", style: undefined,
          }, instance.slots),
          error() || hint() ? h("p", { id: `${editorId}-message`, class: error() ? "text-xs text-danger" : "text-xs text-muted", role: error() ? "alert" : undefined }, error() || hint()) : null,
        ])
      }
    },
  }
  usePaletteCommands(() => {
    const config = settings()
    const name = label()
    if (config === false || !name || options.available?.() === false) return []
    const id = `${scope.id}/${config?.id ?? (instance.attrs.id as string | undefined) ?? name}`
    return [{
      id, label: name, description: config?.description, keywords: config?.keywords,
      disabled: options.disabled?.(), previewComponent: Editor, editInPreview: writable(),
      afterClose: writable() ? undefined : focus,
      actions: [{ id: `${id}/focus`, label: text.value.focus, description: name, icon: "lucide:focus", afterClose: focus }],
    }]
  }, { automatic: true })
}
