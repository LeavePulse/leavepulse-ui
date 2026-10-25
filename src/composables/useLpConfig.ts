import {
  computed,
  inject,
  provide,
  toValue,
  type App,
  type Component,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
} from "vue"
import { pseudoLocalize, type PseudoOptions } from "./pseudoLocale"

/*
 * App-wide kit configuration, said once at the root instead of on every call
 * site: the router link component that navigation pieces render, and the text
 * the kit would otherwise hard-code in English.
 *
 * Labels are grouped by scope (one scope per component, e.g. "lightbox",
 * "toast") so each component owns its own keys and defaults. The precedence is
 * always: the component's own `labels` prop, then the nearest config, then the
 * component's English defaults.
 */
export type LabelScope = Record<string, string>

export interface LpConfig {
  /** Component rendered for internal links (RouterLink, NuxtLink). Plain `<a>` when unset. */
  linkComponent?: Component | string
  /** Text overrides by scope: `{ lightbox: { previous: "Back" } }`. */
  labels?: Partial<Record<string, Partial<LabelScope>>>
  /**
   * Where components remember things between visits (a table's sort, a
   * sidebar folded away, a drawer's width). Browser storage when unset; a
   * desktop shell can hand in its own store. See `usePersisted`.
   */
  storage?: KitStorage
  /**
   * Show every kit label pseudo-localised ("Next" → "[Ñééẋţ]"): accented,
   * about a third longer, and bracketed. A development switch for checking a
   * screen before any translation exists: plain English left on it is text
   * that never went through the labels, and anything clipped or overflowing
   * will be in a real language too. `true` uses the defaults; an object tunes
   * them (see `pseudoLocalize`).
   */
  pseudoLocale?: boolean | PseudoOptions
}

/**
 * Synchronous key/value store, the shape of `localStorage`. Synchronous on
 * purpose: a remembered width has to be there on the first frame, or the
 * panel opens at its default and jumps. An app with an async store keeps a
 * copy in memory and writes it through in the background.
 */
export interface KitStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export const LP_CONFIG: InjectionKey<MaybeRefOrGetter<LpConfig>> = Symbol.for("lp-config")

/** Provide kit configuration to every component below the caller. */
export function provideLpConfig(config: MaybeRefOrGetter<LpConfig>): void {
  provide(LP_CONFIG, layered(inject(LP_CONFIG, {}), config))
}

/** Install the configuration app-wide: `app.use(lpConfig({ ... }))`. */
export function lpConfig(config: MaybeRefOrGetter<LpConfig>) {
  return {
    install: (app: App) => {
      const outer = app.runWithContext(() => inject(LP_CONFIG, {}))
      app.provide(LP_CONFIG, layered(outer, config))
    },
  }
}

/*
 * A nested config refines the one above it rather than replacing it: an app's
 * own labels must not drop the link component a framework plugin provided.
 */
function layered(outer: MaybeRefOrGetter<LpConfig>, inner: MaybeRefOrGetter<LpConfig>): () => LpConfig {
  return () => mergeConfig(toValue(outer), toValue(inner))
}

export function mergeConfig(outer: LpConfig, inner: LpConfig): LpConfig {
  const labels: Partial<Record<string, Partial<LabelScope>>> = { ...outer.labels }
  for (const [scope, values] of Object.entries(inner.labels ?? {})) {
    labels[scope] = { ...labels[scope], ...values }
  }
  return {
    ...outer,
    ...inner,
    linkComponent: inner.linkComponent ?? outer.linkComponent,
    storage: inner.storage ?? outer.storage,
    pseudoLocale: inner.pseudoLocale ?? outer.pseudoLocale,
    labels,
  }
}

export function useLpConfig(): ComputedRef<LpConfig> {
  const config = inject(LP_CONFIG, {})
  return computed(() => toValue(config))
}

/**
 * The labels a component renders: its own `labels` prop over the configured
 * scope over its defaults.
 */
export function useLabels<T extends LabelScope>(
  scope: string,
  defaults: T,
  own?: () => Partial<T> | undefined,
): ComputedRef<T> {
  const config = useLpConfig()
  return computed(() => {
    const labels = { ...defaults, ...config.value.labels?.[scope], ...own?.() } as T
    const pseudo = config.value.pseudoLocale
    if (!pseudo) return labels
    const options = pseudo === true ? undefined : pseudo
    return Object.fromEntries(
      Object.entries(labels).map(([key, text]) => [key, typeof text === "string" ? pseudoLocalize(text, options) : text]),
    ) as T
  })
}

/** The link component to render for an internal destination. */
export function useLinkComponent(): ComputedRef<Component | string> {
  const config = useLpConfig()
  return computed(() => config.value.linkComponent ?? "a")
}
