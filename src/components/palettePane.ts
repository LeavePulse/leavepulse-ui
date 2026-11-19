import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue"
import { commandHasPreview } from "./commandPalette"
import type { Command } from "./commandPaletteTypes"

/*
 * Which row LpCommandPalette's preview pane shows, and when it is open: for
 * the highlighted row while it has something to show (`previewPane`), or for
 * the row being edited in it (`editInPreview`).
 */
export interface PalettePaneOptions {
  previewPane: () => boolean
  hasPreview: () => ((command: Command) => boolean) | undefined
  /** The app supplied a `#preview` slot. */
  slot: () => boolean
  editing: Ref<Command | undefined>
  active: Ref<Command | undefined>
  prompting: () => boolean
}

const PANE_LINGER_MS = 160

export function usePalettePane(options: PalettePaneOptions) {
  const { editing, active } = options
  const previewRef = ref<{ viewportEl: HTMLElement | null } | null>(null)

  /*
   * The pane opens only for a row that has something to show: an empty pane
   * beside a list of commands is a column of dead space. With the slot the app
   * decides what to show, so any highlighted row opens it.
   */
  const previewable = computed(() =>
    (options.previewPane() || !!editing.value) && commandHasPreview(active.value, { slot: options.slot(), hasPreview: options.hasPreview() }),
  )

  /*
   * The row the pane shows. It follows the highlight while the highlight has a
   * preview, and lingers for a moment when it lands on a row without one:
   * arrowing through a list where every other row has a preview would
   * otherwise widen and narrow the dialog on every keystroke. Only when the
   * highlight stays on such rows does the pane fold.
   */
  const paneCommand = shallowRef<Command | undefined>()
  let lingerTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    [() => editing.value ?? active.value, previewable],
    ([command, show]) => {
      clearTimeout(lingerTimer)
      if (show) {
        paneCommand.value = command
        return
      }
      if (!paneCommand.value) return
      lingerTimer = setTimeout(() => (paneCommand.value = undefined), PANE_LINGER_MS)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => clearTimeout(lingerTimer))

  const paneOpen = computed(() => !options.prompting() && (!!editing.value || (options.previewPane() && !!paneCommand.value)))

  // What the pane draws: the last row it showed, kept while the pane slides out
  // so it leaves with its content instead of emptying first. Immediate: the
  // first row is already highlighted when the palette opens, and the pane
  // opened beside it empty until the highlight moved.
  const paneBody = shallowRef<Command | undefined>()
  watch(
    paneCommand,
    (command) => {
      if (command) paneBody.value = command
    },
    { immediate: true },
  )

  /*
   * A preview is opened for the match, so the pane lands on it: the first
   * highlighted word is brought into view, and a result without one starts
   * from the top rather than wherever the previous result was scrolled to.
   */
  watch(
    () => paneCommand.value?.id,
    async () => {
      if (!paneOpen.value) return
      await nextTick()
      const viewport = previewRef.value?.viewportEl
      if (!viewport) return
      const mark = viewport.querySelector("mark")
      if (mark) mark.scrollIntoView({ block: "center" })
      else viewport.scrollTop = 0
    },
  )

  return { previewRef, paneCommand, paneOpen, paneBody }
}
