import { ref, shallowRef, type Ref } from "vue"
import { useAsyncTask } from "../composables/useAsyncTask"
import { parsePaletteQuery } from "./commandSearch"
import { settleFetched } from "./commandPalette"
import type { Command, CommandFetcher } from "./commandPaletteTypes"

/*
 * One in-flight request, shared by `search` at the root and by a fetching
 * `children` inside a mode — they differ only in which function to call. The
 * debounce, the abort and the stale-response guard live in `useAsyncTask`,
 * which the table's `load` uses too.
 */
export interface PaletteFetchOptions {
  /** The function to call: the open mode's fetcher, or `search` at the root. */
  fetcher: () => CommandFetcher | null
  /** Inside a mode, which fetches on an empty query too. */
  inMode: () => boolean
  query: Ref<string>
  minChars: () => number
  debounce: () => number
}

export function usePaletteFetch(options: PaletteFetchOptions) {
  const found = shallowRef<Command[]>([])
  const task = useAsyncTask<Command[]>()

  /*
   * A provider that threw used to leave the list as if it had answered "nothing
   * matches", which is a claim about the data the palette cannot make. A failure
   * says so and offers the same request again. Aborts never land here: the task
   * drops a superseded request before `fail` runs.
   */
  const failed = ref(false)
  /** The failure came after some batches had shown: those stay, the line says the rest is missing. */
  const incomplete = ref(false)

  function cancel() {
    task.cancel()
  }

  function refresh(keepRows = false) {
    cancel()
    if (!keepRows) found.value = []
    failed.value = false
    incomplete.value = false
    const run = options.fetcher()
    if (!run) return
    const parsed = parsePaletteQuery(options.query.value.trim())
    const q = parsed.text
    // A fetching mode runs on an empty query too: opening it should show the
    // first page, not an empty screen waiting for a keystroke. Root search does
    // not — ⌘K would fire a request at every open.
    if (!options.inMode() && q.length < Math.max(1, options.minChars())) return
    // A failing provider: the static commands still stand, with a line saying
    // that the rest could not be fetched.
    // Streamed batches go through `emit`, which drops them once this request
    // is superseded; `streamed` tells a failure after them from one before.
    let streamed = false
    task.run(
      (signal, emit) =>
        settleFetched(run(q, signal, parsed), signal, (rows) => {
          streamed = true
          emit(rows)
        }),
      {
        delay: options.debounce(),
        apply: (hits) => (found.value = hits),
        fail: () => {
          if (!streamed) found.value = []
          incomplete.value = streamed
          failed.value = true
        },
      },
    )
  }

  /* Forget the last answer: no rows, no failure. */
  function clear() {
    found.value = []
    failed.value = false
    incomplete.value = false
  }

  return { found, searching: task.pending, failed, incomplete, refresh, cancel, clear }
}
