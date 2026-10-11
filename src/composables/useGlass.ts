import { computed, inject, provide, toValue, type ComputedRef, type InjectionKey, type MaybeRefOrGetter } from "vue"

/*
 * Frosted glass as an app-wide default for overlays (modals, drawers, dialogs,
 * the command palette). An app that wants every overlay frosted says so once
 * at its root instead of on each of dozens of call sites, where the next new
 * dialog would be the one that forgets. An explicit `glass` prop on a single
 * overlay still wins, either way.
 */
const GLASS: InjectionKey<MaybeRefOrGetter<boolean>> = Symbol("lp-glass")

/** Make `glass` the default for every overlay below the calling component. */
export function provideGlass(enabled: MaybeRefOrGetter<boolean> = true): void {
  provide(GLASS, enabled)
}

/**
 * The glass flag an overlay renders with: its own prop when set, otherwise the
 * nearest `provideGlass`, otherwise off. The prop must default to `undefined`,
 * not `false`, or an unset prop could not be told apart from an explicit off.
 */
export function useGlass(own: () => boolean | undefined): ComputedRef<boolean> {
  const inherited = inject(GLASS, false)
  return computed(() => own() ?? toValue(inherited))
}
