import { computed, onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue"
import { useHotkeys } from "../composables/useHotkeys"
import { nodeWindow } from "../composables/useView"
import { ringWindow } from "./logSearch"
import type { LogLine } from "./logViewerTypes"

/*
 * Hold a key, the stream stops.
 *
 * Not a toggle. A stream worth freezing is one that is scrolling past faster
 * than it can be read, and in that state you are looking at a line you want to
 * keep in sight — reaching for a button means moving your eyes off it, and a
 * toggle you must remember to switch back leaves the viewer dead until you do.
 * The gesture is Task Manager's: press to hold, let go to resume, and nothing
 * is lost either way because the lines were never the viewer's to begin with.
 *
 * The freeze bites at the SOURCE rather than at the scroll position. Pinning
 * the scroll only stops it moving; the rows underneath still re-render, so
 * whatever you were reading is replaced in place while it appears to stand
 * still — which is worse than either state on its own.
 */
export interface LogFreezeOptions {
  /** The viewer's root, whose hover or focus says the stream is being read. */
  root: Ref<HTMLElement | null>
  lines: () => LogLine[]
  maxLines: () => number | undefined
}

export function useLogFreeze(options: LogFreezeOptions) {
  const { root } = options
  const frozen = ref(false)
  const frozenLines = shallowRef<LogLine[] | null>(null)

  const windowed = computed(() => ringWindow(frozenLines.value ?? options.lines(), options.maxLines()))
  const sourceLines = computed<LogLine[]>(() => windowed.value.lines as LogLine[])
  // Line numbers keep counting from the start of the stream after the cap trims it.
  const lineOffset = computed(() => windowed.value.offset)

  /*
   * Held while the pointer is over the stream, or while it holds the focus.
   *
   * Not scoped to focus alone: nobody clicks a log before reading it, and a
   * modifier held over an unfocused viewer would have gone to the page instead.
   * Not global either — two viewers side by side would both freeze, and Ctrl is
   * pressed for a hundred other reasons on a page that happens to contain logs.
   * Pointing at the thing is the intent.
   */
  const hovered = ref(false)

  function focusWithin() {
    const el = root.value
    return !!el && el.contains(el.ownerDocument.activeElement)
  }

  // `when` rather than a bare decline: several viewers on one page all bind these
  // keys, and only the one being looked at should claim them.
  const lookedAt = () => hovered.value || focusWithin()

  function freeze(): boolean {
    // Declining unless the stream is being looked at: `false` hands Ctrl back
    // untouched, which matters because Ctrl is half of every shortcut on the
    // page and swallowing it would break them all.
    if (!hovered.value && !focusWithin()) return false
    if (frozen.value) return true
    // Copied, whatever the cap: a stream pushed into in place would move under a
    // reference. This runs once per hold, not per keypress or per line.
    const lines = options.lines()
    const max = options.maxLines()
    frozenLines.value = max ? lines.slice(-max) : lines.slice()
    frozen.value = true
    return true
  }

  function thaw() {
    frozen.value = false
    frozenLines.value = null
  }

  useHotkeys(() => [
    { key: "control", allowInInput: true, when: lookedAt, handler: freeze },
    { key: "meta", allowInInput: true, when: lookedAt, handler: freeze },
  ])

  // Released on keyup anywhere, and on blur: a window that loses focus mid-hold
  // never delivers the keyup, and the viewer would stay frozen with no visible
  // reason and no key to press.
  function onKeyup(event: KeyboardEvent) {
    if (event.key === "Control" || event.key === "Meta") thaw()
  }

  // Inside an LpFrame the keyup lands in whichever window holds the focus: the
  // frame's, or the page's, which is where a hold over the frame can start.
  let keyWindows: Window[] = []
  onMounted(() => {
    keyWindows = [...new Set<Window>([window, root.value ? nodeWindow(root.value) : window])]
    for (const win of keyWindows) {
      win.addEventListener("keyup", onKeyup as EventListener)
      win.addEventListener("blur", thaw)
    }
  })
  onBeforeUnmount(() => {
    for (const win of keyWindows) {
      win.removeEventListener("keyup", onKeyup as EventListener)
      win.removeEventListener("blur", thaw)
    }
  })

  return { frozen, sourceLines, lineOffset, hovered, lookedAt }
}
