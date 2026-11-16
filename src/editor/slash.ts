/*
 * The "/" trigger. It only reports what is being typed and where; the editor
 * renders the menu itself from its resolved blocks, so the list, its search
 * and its wording are the same as the insert menu's.
 */
import { Extension, type Range } from "@tiptap/core"
import { PluginKey } from "@tiptap/pm/state"
import Suggestion from "@tiptap/suggestion"

export interface SlashState {
  query: string
  range: Range
  rect: () => DOMRect | null
}

export interface SlashOptions {
  onState: (state: SlashState | null) => void
  onKey: (event: KeyboardEvent) => boolean
}

export const SLASH_KEY = new PluginKey("lpSlash")

export const SlashCommand = Extension.create<SlashOptions>({
  name: "lpSlash",
  addOptions() {
    return { onState: () => undefined, onKey: () => false }
  },
  addProseMirrorPlugins() {
    const { onState, onKey } = this.options
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: SLASH_KEY,
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: () => [],
        render: () => ({
          onStart: (props) => onState({ query: props.query, range: props.range, rect: () => props.clientRect?.() ?? null }),
          onUpdate: (props) => onState({ query: props.query, range: props.range, rect: () => props.clientRect?.() ?? null }),
          onExit: () => onState(null),
          onKeyDown: ({ event }) => onKey(event),
        }),
      }),
    ]
  },
})
