import { expect, test } from "bun:test"
import { createSSRApp, defineComponent, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { reportHintUse } from "../src/composables/hintSignals"
import { useOptionalPaletteAction } from "../src/composables/paletteAction"
import { hints } from "../src/composables/useHints"
import { createPaletteRegistry, providePaletteScope } from "../src/composables/usePaletteCommands"

/*
 * LpButton reports its hotkey use and registers its palette command through
 * hooks rather than importing the hint system and the palette registry. Once
 * those modules are loaded (imported above, as an app that has a palette scope
 * or a hint listener has them), the hooks must reach them.
 */

test("a control's usage report reaches hint listeners", () => {
  const body = {} as HTMLElement
  const hadDocument = "document" in globalThis
  if (!hadDocument) (globalThis as { document?: unknown }).document = { body }
  const heard: string[] = []
  const stop = hints.on("used", (id) => heard.push(id))
  try {
    reportHintUse("lp.hotkey")
    expect(heard).toEqual(["lp.hotkey"])
  } finally {
    stop()
    if (!hadDocument) delete (globalThis as { document?: unknown }).document
  }
})

test("a control's palette action registers in the enclosing scope", async () => {
  const registry = createPaletteRegistry()
  let registered: string[] = []
  const Control = defineComponent({
    setup() {
      useOptionalPaletteAction({ label: () => "Save", element: () => null })
      // Read while rendering: a server render disposes the component's scope afterwards.
      return () => {
        registered = registry.commands.value.map((c) => c.label)
        return h("button")
      }
    },
  })
  const Scope = defineComponent({
    setup() {
      providePaletteScope({ registry, id: "page", label: "Page", depth: 1, enabled: true, discover: true })
      return () => h(Control)
    },
  })
  await renderToString(createSSRApp(Scope))
  expect(registered).toEqual(["Save"])
})
