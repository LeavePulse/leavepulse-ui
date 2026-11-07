import { computed, onScopeDispose, shallowRef, toValue, type MaybeRefOrGetter, type ShallowRef } from "vue"

/*
 * One crosshair across charts of the same period: the x label hovered in one is
 * marked in the others. Matched by label rather than by index, because two
 * charts can hold different points or different windows of the same timeline.
 *
 * Pinned to a global symbol so a barrel and a deep import share the groups.
 */
interface Hovered {
  owner: symbol
  label: string
}

const SYNC_KEY = Symbol.for("@leavepulse/ui:chart-sync")
type GlobalWithSync = typeof globalThis & { [SYNC_KEY]?: Map<string, ShallowRef<Hovered | null>> }
const groups = ((globalThis as GlobalWithSync)[SYNC_KEY] ??= new Map())

function groupOf(name: string): ShallowRef<Hovered | null> {
  let group = groups.get(name)
  if (!group) {
    group = shallowRef<Hovered | null>(null)
    groups.set(name, group)
  }
  return group
}

export function useChartSync(group: MaybeRefOrGetter<string | undefined>) {
  const owner = Symbol("chart")
  const shared = computed(() => {
    const name = toValue(group)
    return name ? groupOf(name) : null
  })

  /** The label another chart of the group is hovering. */
  const peerLabel = computed(() => {
    const hovered = shared.value?.value
    return hovered && hovered.owner !== owner ? hovered.label : null
  })

  /** Tell the group what this chart hovers; null when the pointer left. */
  function publish(label: string | null) {
    const target = shared.value
    if (!target) return
    if (label != null) target.value = { owner, label }
    else if (target.value?.owner === owner) target.value = null
  }

  onScopeDispose(() => publish(null))

  return { peerLabel, publish }
}
