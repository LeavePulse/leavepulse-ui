import { getCurrentInstance, ref } from "vue"
import { useToast } from "./useToast"

type ToggleEmit = {
  (e: "update:modelValue", value: boolean): void
  (e: "done", value: boolean): void
  (e: "error", error: unknown): void
}

/**
 * A boolean control that saves itself: `action(value)` from the component's
 * props. The control shows the new value at once and `pending` while the work
 * runs; a failure puts the old value back and becomes an error toast, unless
 * the app listens to `error`. A second flip while saving is ignored: the
 * control is controlled, so it keeps showing what `modelValue` says.
 *
 * Shared by LpSwitch and LpCheckbox so a setting saved from either behaves
 * the same.
 */
export function useOptimisticToggle(action: () => ((value: boolean) => unknown) | undefined, emit: ToggleEmit) {
  const toast = useToast()
  const instance = getCurrentInstance()
  const pending = ref(false)

  async function set(value: boolean) {
    const work = action()
    if (!work) return emit("update:modelValue", value)
    if (pending.value) return
    emit("update:modelValue", value)
    pending.value = true
    try {
      await work(value)
      emit("done", value)
    } catch (error) {
      emit("update:modelValue", !value)
      if (instance?.vnode.props?.onError) emit("error", error)
      else toast.error(error instanceof Error ? error : String(error))
    } finally {
      pending.value = false
    }
  }

  return { pending, set }
}
