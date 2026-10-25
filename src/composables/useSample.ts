/*
 * Made-up data for a tour step that lands on an empty chart. A data component
 * inside a `v-hint` element with nothing to draw offers a sample of that hint;
 * when a tour step (or "Show me" on news) reaches it, the component draws
 * plausible data instead of its empty state, inert and tagged, and goes back
 * when the step leaves. The app adds nothing: the hint id is the nearest
 * `v-hint` around the component, and `:sample="false"` opts out.
 */
import { computed, watch, type Ref } from "vue"
import { hints } from "./useHints"

export function useSample(root: Ref<Element | null>, empty: () => boolean, enabled: () => boolean) {
  // Read again whenever a hint attaches: a parent's directive mounts after
  // its children, so on the component's own mount the mark is not there yet.
  const id = computed(() => {
    hints.ids()
    return enabled() ? ((root.value?.closest("[data-hint]") as HTMLElement | null)?.dataset.hint ?? null) : null
  })
  const offered = computed(() => (id.value && empty() ? id.value : null))

  watch(offered, (value, _, onCleanup) => {
    if (value) onCleanup(hints.registerExample(value))
  }, { immediate: true })

  return computed(() => !!offered.value && hints.showingExample(offered.value))
}
