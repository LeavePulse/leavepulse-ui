import { computed, ref, watch, type MaybeRefOrGetter, toValue } from "vue"

/*
 * Arrow-key navigation over a list, with a roving tabindex.
 *
 * The problem it solves: Tab is navigation BETWEEN regions, not within one. A
 * list of two hundred mods is two hundred Tab presses, which is the same as
 * having no keyboard support at all. The standard answer — what every native
 * list does — is that the whole list is ONE Tab stop, and once you are in it
 * the arrows move a cursor.
 *
 *   Tab / Shift+Tab   in and out of the list
 *   ↑ ↓ (or ← →)      move within it
 *   Home / End        first / last
 *   typing letters    jump to the item that starts with them
 *
 * Only the focused item carries `tabindex="0"`; everything else is `-1`. That
 * is what keeps the list a single stop and what makes Tab return to wherever
 * the user left off rather than to the top.
 *
 * The caller owns rendering. This owns "which item is current" and translates
 * keys into moves; bind `itemProps(id)` on each row and `containerProps` on the
 * element that wraps them.
 */

export interface RovingItem {
  /** Stable identity of the row. */
  id: string
  /**
   * What typeahead matches against. Omit to opt this row out of typeahead —
   * a separator, say.
   */
  label?: string
  disabled?: boolean
}

export interface UseRovingFocusOptions {
  /**
   * Which axis the arrows follow. `vertical` (default) uses ↑↓, `horizontal`
   * uses ←→, `both` accepts either — for a grid whose wrapping the caller
   * cannot describe here.
   */
  orientation?: "vertical" | "horizontal" | "both"
  /** Wrap around at the ends instead of stopping. Default true. */
  loop?: boolean
  /** Jump to an item by typing its first letters. Default true. */
  typeahead?: boolean
  /** Called when the user activates the current item (Enter or Space). */
  onActivate?: (id: string) => void
  /**
   * Called when focus should leave the list without activating anything —
   * Escape. Lets a dialog close, or a filter field take focus back.
   */
  onEscape?: () => void
}

/** How long typed letters keep accumulating into one search string. */
const TYPEAHEAD_RESET_MS = 700

export function useRovingFocus(
  items: MaybeRefOrGetter<RovingItem[]>,
  options: UseRovingFocusOptions = {},
) {
  const {
    orientation = "vertical",
    loop = true,
    typeahead = true,
    onActivate,
    onEscape,
  } = options

  const activeId = ref<string | undefined>()
  const containerEl = ref<HTMLElement | null>(null)

  const enabled = computed(() => toValue(items).filter((item) => !item.disabled))

  // The cursor has to survive the list changing under it — a filter narrowing,
  // a row finishing loading. Falling back to the first row keeps the list
  // reachable by Tab before anything has been picked.
  watch(
    enabled,
    (list) => {
      if (list.length === 0) {
        activeId.value = undefined
        return
      }
      if (!activeId.value || !list.some((item) => item.id === activeId.value)) {
        activeId.value = list[0]!.id
      }
    },
    { immediate: true },
  )

  function indexOfActive(): number {
    return enabled.value.findIndex((item) => item.id === activeId.value)
  }

  function focus(id: string | undefined) {
    if (id) activeId.value = id
  }

  function move(delta: number) {
    const list = enabled.value
    if (list.length === 0) return
    const from = indexOfActive()
    if (from === -1) {
      focus(list[0]!.id)
      return
    }
    let next = from + delta
    if (next < 0) next = loop ? list.length - 1 : 0
    if (next >= list.length) next = loop ? 0 : list.length - 1
    focus(list[next]!.id)
  }

  function first() {
    focus(enabled.value[0]?.id)
  }

  function last() {
    focus(enabled.value.at(-1)?.id)
  }

  let typed = ""
  let typedAt = 0

  /**
   * Jump to the next item starting with what has been typed. Searching from
   * AFTER the current one is what makes repeated presses of the same letter
   * cycle through the items sharing it, the way a file manager does.
   */
  function typeaheadTo(character: string) {
    const now = Date.now()
    typed = now - typedAt > TYPEAHEAD_RESET_MS ? character : typed + character
    typedAt = now

    const list = enabled.value
    const needle = typed.toLowerCase()
    // A single repeated letter means "next one starting with it", not "the one
    // whose name is that letter twice over".
    const repeated = typed.length > 1 && [...typed].every((c) => c === typed[0])
    const query = repeated ? typed[0]!.toLowerCase() : needle

    const from = indexOfActive()
    const offset = repeated || typed.length === 1 ? 1 : 0
    for (let step = 0; step < list.length; step += 1) {
      const item = list[(from + offset + step) % list.length]!
      if (item.label?.toLowerCase().startsWith(query)) {
        focus(item.id)
        return
      }
    }
  }

  function onKeydown(event: KeyboardEvent) {
    const vertical = orientation === "vertical" || orientation === "both"
    const horizontal = orientation === "horizontal" || orientation === "both"

    switch (event.key) {
      case "ArrowDown":
        if (!vertical) return
        event.preventDefault()
        move(1)
        return
      case "ArrowUp":
        if (!vertical) return
        event.preventDefault()
        move(-1)
        return
      case "ArrowRight":
        if (!horizontal) return
        event.preventDefault()
        move(1)
        return
      case "ArrowLeft":
        if (!horizontal) return
        event.preventDefault()
        move(-1)
        return
      case "Home":
        event.preventDefault()
        first()
        return
      case "End":
        event.preventDefault()
        last()
        return
      case "Enter":
      case " ":
        if (!activeId.value) return
        event.preventDefault()
        onActivate?.(activeId.value)
        return
      case "Escape":
        if (!onEscape) return
        event.preventDefault()
        onEscape()
        return
    }

    // Anything else that produced a single printable character is typeahead.
    // Modifier combos are left alone — they belong to the app's own shortcuts.
    if (
      typeahead
      && event.key.length === 1
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && event.key !== " "
    ) {
      event.preventDefault()
      typeaheadTo(event.key)
    }
  }

  /**
   * Moving the cursor has to move real DOM focus, not just the styling — a
   * roving tabindex whose focus stays put means the next Tab leaves from the
   * wrong place and a screen reader never hears about the move. The element is
   * found by the id the caller stamped on it via `itemProps`.
   *
   * Only when the list already holds focus: stealing it because a filter
   * narrowed the rows would yank the user out of the field they are typing in.
   */
  watch(activeId, (id) => {
    if (!id || typeof document === "undefined") return
    const container = containerEl.value
    if (!container || !container.contains(document.activeElement)) return
    const target = container.querySelector<HTMLElement>(
      `[data-roving-id="${CSS.escape(id)}"]`,
    )
    target?.focus()
  })

  /**
   * Point the composable at the element wrapping the rows, so it can find them
   * to focus. Either bind `containerProps`, or call this from a `ref` when the
   * caller wants the keydown somewhere else — on the rows themselves, say.
   */
  function setContainer(el: HTMLElement | null) {
    containerEl.value = el
  }

  /** Bind on the element wrapping the rows. */
  const containerProps = computed(() => ({
    ref: (el: unknown) => setContainer(el instanceof HTMLElement ? el : null),
    onKeydown,
  }))

  /**
   * Bind on each row. Only the active row is tabbable, which is what makes the
   * whole list a single Tab stop.
   */
  function itemProps(id: string) {
    const active = activeId.value === id
    return {
      tabindex: active ? 0 : -1,
      "data-active": active ? "" : undefined,
      "data-roving-id": id,
      onFocus: () => focus(id),
    }
  }

  return {
    activeId,
    focus,
    move,
    first,
    last,
    onKeydown,
    setContainer,
    containerProps,
    itemProps,
  }
}
