import { onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from "vue"
import { confirm } from "../components/confirm"
import { useLabels } from "./useLpConfig"

/**
 * What stands between a window and closing it.
 *
 * - `true`: there is something unsaved. Closing asks "Discard changes?" through
 *   the kit's confirm, and leaving the page asks the browser's own question.
 * - a function: the app asks its own question (or saves first) and answers
 *   whether the window may close.
 * - `false` / unset: nothing to lose, the window closes as always.
 *
 * Usually bound straight to a form's state: `:guard="form.dirty"`.
 */
export type CloseGuard = boolean | (() => boolean | Promise<boolean>) | undefined

export interface CloseGuardLabels {
  title: string
  description: string
  discard: string
  keep: string
}

export function useCloseGuard(
  guard: MaybeRefOrGetter<CloseGuard>,
  open: MaybeRefOrGetter<boolean>,
  labelsOverride?: () => Partial<CloseGuardLabels> | undefined,
) {
  const labels = useLabels(
    "closeGuard",
    {
      title: "Discard changes?",
      description: "What you changed here has not been saved and will be lost.",
      discard: "Discard",
      keep: "Keep editing",
    },
    labelsOverride,
  )

  let asking = false

  /** Whether the window may close now. Asks at most once at a time. */
  async function allowClose(): Promise<boolean> {
    const current = toValue(guard)
    if (!current) return true
    if (asking) return false
    asking = true
    try {
      if (typeof current === "function") return await current()
      return await confirm({
        title: labels.value.title,
        description: labels.value.description,
        danger: true,
        icon: "lucide:triangle-alert",
        confirmLabel: labels.value.discard,
        cancelLabel: labels.value.keep,
      })
    } finally {
      asking = false
    }
  }

  /*
   * Closing the tab or reloading cannot wait for a dialog; the browser shows
   * its own generic question instead. Only for the plain `true` form: a
   * function cannot be asked synchronously, and a window that is not open
   * has nothing to lose.
   */
  function onBeforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault()
    event.returnValue = ""
  }
  let listening = false
  function listen(on: boolean) {
    if (on === listening || typeof window === "undefined") return
    listening = on
    if (on) window.addEventListener("beforeunload", onBeforeUnload)
    else window.removeEventListener("beforeunload", onBeforeUnload)
  }
  watch(() => toValue(open) && toValue(guard) === true, listen, { immediate: true })
  onBeforeUnmount(() => listen(false))

  /** Something is guarding right now (a drawer turns its swipe-to-close off). */
  const armed = () => !!toValue(guard)

  return { allowClose, armed }
}
