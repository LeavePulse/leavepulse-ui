import { computed, ref, type ComputedRef } from "vue"

const STEP = 20

const stack = ref<number[]>([])
let nextId = 0

export function useModalLayer(): {
  claim: () => void
  release: () => void
  layer: ComputedRef<{ scrim: string; panel: string; nested: boolean }>
} {
  const id = nextId++

  const fromTop = computed(() => {
    const at = stack.value.indexOf(id)
    return at === -1 ? 0 : stack.value.length - 1 - at
  })

  return {
    claim: () => {
      if (!stack.value.includes(id)) stack.value = [...stack.value, id]
    },
    release: () => {
      stack.value = stack.value.filter((x) => x !== id)
    },
    layer: computed(() => {
      const drop = fromTop.value * STEP
      return {
        scrim: `calc(var(--z-overlay) - ${drop})`,
        panel: `calc(var(--z-modal) - ${drop})`,
        nested: stack.value.indexOf(id) > 0,
      }
    }),
  }
}

export function anyModalOpen(): boolean {
  return stack.value.length > 0
}
