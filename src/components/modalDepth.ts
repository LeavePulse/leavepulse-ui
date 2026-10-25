import { computed, ref, type ComputedRef, type Ref } from "vue"

const STEP = 20

/*
 * One opening-order stack for every modal surface. Pinned to a global symbol
 * like the toast queue: a barrel import and a deep import can load this module
 * twice, and two stacks would put a deep-imported dialog's scrim under a
 * barrel-imported drawer's panel.
 */
const STATE_KEY = Symbol.for("@leavepulse/ui:modal-stack")
type GlobalWithStack = typeof globalThis & {
  [STATE_KEY]?: {
    stack: Ref<number[]>
    nextId: number
    elements: Map<number, () => HTMLElement | null | undefined>
  }
}
const g = globalThis as GlobalWithStack
const state = (g[STATE_KEY] ??= { stack: ref<number[]>([]), nextId: 0, elements: new Map() })
const stack = state.stack

export interface ModalLayer {
  /** Join the stack on top. Ignored on the server, where nothing would ever release it. */
  claim: () => void
  release: () => void
  /**
   * z-index values for this surface's scrim and panel, whether another modal
   * is under it (`nested`) and whether another is open above it (`covered`).
   */
  layer: ComputedRef<{ scrim: string; panel: string; nested: boolean; covered: boolean }>
  /** Whether this surface is the topmost open one. */
  top: ComputedRef<boolean>
}

export interface ModalLayerOptions {
  /** The surface's panel, so keyboard handling can tell what sits inside the top modal. */
  element?: () => HTMLElement | null | undefined
}

/**
 * Put an overlay on the shared modal stack, so a surface opened from another
 * one (a dialog from a drawer, a lightbox from a dialog) lands above it with
 * its scrim, whatever component either of them is.
 */
export function useModalLayer(options: ModalLayerOptions = {}): ModalLayer {
  const id = state.nextId++

  const fromTop = computed(() => {
    const at = stack.value.indexOf(id)
    return at === -1 ? 0 : stack.value.length - 1 - at
  })

  return {
    claim: () => {
      if (typeof window === "undefined") return
      if (options.element) state.elements.set(id, options.element)
      if (!stack.value.includes(id)) stack.value = [...stack.value, id]
    },
    release: () => {
      state.elements.delete(id)
      stack.value = stack.value.filter((x) => x !== id)
    },
    layer: computed(() => {
      const drop = fromTop.value * STEP
      return {
        scrim: `calc(var(--z-overlay) - ${drop})`,
        panel: `calc(var(--z-modal) - ${drop})`,
        nested: stack.value.indexOf(id) > 0,
        covered: fromTop.value > 0 && stack.value.includes(id),
      }
    }),
    top: computed(() => stack.value[stack.value.length - 1] === id),
  }
}

export function anyModalOpen(): boolean {
  return stack.value.length > 0
}

/** The panel of the topmost modal, when it registered one. */
export function topModalElement(): HTMLElement | null {
  const id = stack.value[stack.value.length - 1]
  if (id === undefined) return null
  return state.elements.get(id)?.() ?? null
}
