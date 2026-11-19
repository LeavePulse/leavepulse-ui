import type { TourStep } from "../components/LpTour.vue"
import { HINT_SIGNALS, notedTargets } from "./hintSignals"

/*
 * Tips the kit ships ready-made for the hint system (`tips` of
 * createHintSystem): each a better way to do something the kit can see the
 * user doing the slow way, built from the signals its controls report.
 */

/**
 * A better way to do something the user keeps doing the slow way: shown now
 * and then (at most `max` times, `nudgeAgain` apart) and never again once the
 * better way is used. `when` reads usage counters — kit components report
 * their own (see HINT_SIGNALS), and `hints.use(name)` adds any of the app's.
 */
export interface HintTip {
  id: string
  title: string
  text: string
  keys?: string
  max?: number
  when: (count: (signal: string) => number) => boolean
  /** What "show me" lights up on the current screen; without it the tip only informs. */
  step?: () => TourStep | null
}

const onScreen = (el: Element) => {
  const box = el.getBoundingClientRect()
  return el.isConnected && box.width > 0 && box.bottom > 0 && box.top < window.innerHeight
}

/*
 * What the tip lights up: the thing the user keeps clicking, while it is still
 * on screen; otherwise a row with a menu, then any menu target. Rows first,
 * because a page's first target in document order is usually chrome (a
 * sidebar account card), not the content the habit is about.
 */
function rightClickTarget(): Element | null {
  const last = notedTargets.context()
  if (last && onScreen(last)) return last
  const visible = (selector: string) => [...document.querySelectorAll(selector)].find(onScreen) ?? null
  return visible("[data-lp-context-row]") ?? visible("main [data-lp-context-menu]") ?? visible("[data-lp-context-menu]")
}

/** Right click instead of the "…" button. */
export function contextMenuTip(text: Partial<Pick<HintTip, "title" | "text"> & { stepText: string }> = {}): HintTip {
  return {
    id: "lp.tip.context-menu",
    title: text.title ?? "Right-click works here",
    text: text.text ?? "Rows and cards open their actions on right-click, even where no … button shows it.",
    when: (count) =>
      count(HINT_SIGNALS.contextMenu) === 0
      && (count(HINT_SIGNALS.menuButton) >= 5 || count(HINT_SIGNALS.contextTarget) >= 25),
    step: () => {
      const target = rightClickTarget()
      return target ? { target, title: text.title ?? "Right-click works here", text: text.stepText ?? "Right-click this to see what it can do.", try: true } : null
    },
  }
}

/** The palette instead of walking the menu. */
export function paletteTip(keys = "Ctrl+K", text: Partial<Pick<HintTip, "title" | "text">> = {}): HintTip {
  return {
    id: "lp.tip.palette",
    title: text.title ?? "Jump anywhere",
    text: text.text ?? "Search pages, people and settings from anywhere instead of the menu.",
    keys,
    when: (count) => count(HINT_SIGNALS.navigate) >= 15 && count(HINT_SIGNALS.palette) === 0,
  }
}

/** The button's key instead of the pointer. */
export function hotkeyTip(text: Partial<Pick<HintTip, "title" | "text"> & { stepText: string }> = {}): HintTip {
  const title = text.title ?? "There is a key for this"
  return {
    id: "lp.tip.hotkey",
    title,
    text: text.text ?? "Buttons you keep clicking have a keyboard shortcut; it is in the button's tooltip and in the key reference (F1).",
    when: (count) => count(HINT_SIGNALS.hotkey) === 0 && count(HINT_SIGNALS.hotkeyTarget) >= 10,
    step: () => {
      const last = notedTargets.hotkey()
      const target = last?.el
      return last && target && onScreen(target)
        ? { target, title, text: text.stepText ?? "Next time, press this instead of clicking:", keys: last.combo }
        : null
    },
  }
}

/** Dropping or pasting instead of the file dialog. */
export function dropzoneTip(text: Partial<Pick<HintTip, "title" | "text"> & { stepText: string }> = {}): HintTip {
  const title = text.title ?? "Drop or paste here"
  return {
    id: "lp.tip.dropzone",
    title,
    text: text.text ?? "Files can be dragged straight onto the upload area, and a screenshot pasted with Ctrl+V, without the file dialog.",
    when: (count) => count(HINT_SIGNALS.dropzoneDirect) === 0 && count(HINT_SIGNALS.dropzoneBrowse) >= 4,
    step: () => {
      const target = notedTargets.dropzone()
      return target && onScreen(target)
        ? { target, title, text: text.stepText ?? "Drag a file onto this, or copy a picture and paste it while this is focused.", keys: "Ctrl+V" }
        : null
    },
  }
}
