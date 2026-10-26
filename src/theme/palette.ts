import { defineAsyncComponent, defineComponent, h, toValue, type MaybeRefOrGetter } from "vue"
import { usePaletteCommands, usePaletteScope, type PaletteScope } from "../composables/usePaletteCommands"
import type { PreviewableThemeStudio, ThemeStudio } from "./studio"
import { useLabels } from "../composables/useLpConfig"

const Editor = defineAsyncComponent(() => import("../components/LpPaletteTheme.vue"))

/** Registers the studio itself; no second list of theme options in the app. */
export function usePaletteTheme(studio: MaybeRefOrGetter<ThemeStudio | undefined>, options: { id?: string; label?: string; scope?: PaletteScope } = {}) {
  const scope = options.scope ?? usePaletteScope()
  const text = useLabels("paletteTheme", { title: "Theme" })
  const currentStudio = () => {
    const current = toValue(studio)
    return current && "preview" in current && typeof current.preview === "function" ? current as PreviewableThemeStudio : undefined
  }
  const preview = defineComponent({ setup: () => () => currentStudio() ? h(Editor, { studio: currentStudio()! }) : null })
  usePaletteCommands(() => {
    const current = currentStudio()
    if (!current) return []
    return [{
      id: `${scope?.id}/${options.id ?? "theme"}`, label: options.label ?? text.value.title, icon: "lucide:palette",
      description: current.theme.value.name, keywords: ["theme", "appearance", "accent", "density", "тема", "цвет", "плотность"],
      previewComponent: preview, editInPreview: true,
    }]
  }, { scope: options.scope })
}
