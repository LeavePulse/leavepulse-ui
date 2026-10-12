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
  return { ...outer, ...inner, linkComponent: inner.linkComponent ?? outer.linkComponent, labels }
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
  return computed(() => ({ ...defaults, ...config.value.labels?.[scope], ...own?.() }) as T)
}

/** The link component to render for an internal destination. */
export function useLinkComponent(): ComputedRef<Component | string> {
  const config = useLpConfig()
  return computed(() => config.value.linkComponent ?? "a")
}
