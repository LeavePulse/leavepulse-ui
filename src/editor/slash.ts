/*
 * A trigger character turned into editor state. It only reports what is
 * typed after the character and where; the editor draws the menu from the
 * trigger's items, so "/", "@" and "#" share one menu, its keys and its search.
 */
import { Extension, type Range } from "@tiptap/core"
import { PluginKey } from "@tiptap/pm/state"
import Suggestion from "@tiptap/suggestion"

export interface TriggerState {
  trigger: string
  query: string
  range: Range
  rect: () => DOMRect | null
}

export interface TriggerOptions {
  id: string
  char: string
  onState: (state: TriggerState | null) => void
  onKey: (event: KeyboardEvent) => boolean
}

export const TriggerMenu = Extension.create<TriggerOptions>({
  name: "lpTrigger",
  addOptions() {
    return { id: "", char: "/", onState: () => undefined, onKey: () => false }
  },
  addProseMirrorPlugins() {
    const { id, char, onState, onKey } = this.options
    const report = (props: { query: string; range: Range; clientRect?: (() => DOMRect | null) | null }) =>
      onState({ trigger: id, query: props.query, range: props.range, rect: () => props.clientRect?.() ?? null })
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey(`lpTrigger:${id}`),
        char,
        allowSpaces: false,
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: () => [],
        render: () => ({
          onStart: report,
          onUpdate: report,
          onExit: () => onState(null),
          onKeyDown: ({ event }) => onKey(event),
        }),
      }),
    ]
  },
})
