import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import { injectConfigProviderContext } from "reka-ui"

/*
 * The locale a date is written in: the component's own `locale`, else the one
 * the app gave reka's ConfigProvider, else undefined, which lets Intl use the
 * browser's. The calendars already followed ConfigProvider while the field
 * that shows the picked date did not, so a French app showed a French
 * calendar under "Oct 8, 2026".
 */
export function useLocale(own?: MaybeRefOrGetter<string | undefined>): ComputedRef<string | undefined> {
  const context = injectConfigProviderContext({})
  return computed(() => toValue(own) || context.locale?.value || undefined)
}
