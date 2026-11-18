/*
 * Text styling beyond on/off marks: a font from the app's list, a size, a
 * text colour, a background colour and alignment, as toolbar menus.
 *
 *   plugins: [...defaultEditorPlugins(), stylingPlugin({ fonts: [{ name: "Caveat", family: "Caveat, cursive" }] })]
 *
 * Choices are deliberately few. Colours default to the theme's tokens and are
 * stored as `var(--color-…)`, so a coloured word stays readable when the theme
 * flips from dark to light; a hex pasted from elsewhere would not. Sizes are
 * steps relative to the text (`em`), not points, so a heading keeps its scale.
 * Fonts are whatever the app lists: it serves them, the editor only names them.
 */
import type { Editor } from "@tiptap/core"
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style"
import { parseColor } from "../components/color"
import type { EditorMenu, EditorMenuItem, EditorPlugin } from "./blocks"

export interface EditorFont {
  /** As the menu shows it. */
  name: string
  /** CSS font-family value, fallbacks included. */
  family: string
}

export interface EditorSwatch {
  name: string
  /** Any CSS colour; theme tokens keep it readable in every theme. */
  value: string
}

export interface StylingLabels {
  font: string
  defaultFont: string
  size: string
  small: string
  normal: string
  large: string
  huge: string
  color: string
  defaultColor: string
  background: string
  noBackground: string
  custom: string
  align: string
  left: string
  center: string
  right: string
  justify: string
  brand: string
  accent: string
  action: string
  danger: string
  muted: string
  orange: string
  purple: string
  pink: string
}

export interface StylingOptions {
  /** Fonts to offer; the menu is left out when there are none. */
  fonts?: EditorFont[]
  /** Text colours; `editorColors()` by default. */
  colors?: EditorSwatch[]
  /** Background colours; the tints of `editorColors()` by default. */
  backgrounds?: EditorSwatch[]
  labels?: Partial<StylingLabels>
  /** Offer "Custom colour…" after the presets. A picked colour is stored exactly, not adapted to the theme. */
  custom?: boolean
}

const LABELS: StylingLabels = {
  font: "Font",
  defaultFont: "Default",
  size: "Size",
  small: "Small",
  normal: "Normal",
  large: "Large",
  huge: "Huge",
  color: "Text colour",
  defaultColor: "Default",
  background: "Background",
  noBackground: "None",
  custom: "Custom colour…",
  align: "Alignment",
  left: "Left",
  center: "Centre",
  right: "Right",
  justify: "Justify",
  brand: "Brand",
  accent: "Accent",
  action: "Green",
  danger: "Red",
  muted: "Grey",
  orange: "Orange",
  purple: "Purple",
  pink: "Pink",
}

export type EditorColorKey = "danger" | "orange" | "accent" | "action" | "brand" | "purple" | "pink" | "muted"

/** One colour of the editor palette: its text value and the soft tint used to highlight with it. */
export interface EditorColor {
  key: EditorColorKey
  name: string
  text: string
  background: string
}

const TOKENS = new Set<EditorColorKey>(["brand", "accent", "action", "danger", "muted"])
const HUES: Partial<Record<EditorColorKey, string>> = { orange: "249, 115, 22", purple: "168, 85, 247", pink: "236, 72, 153" }
const ORDER: EditorColorKey[] = ["danger", "orange", "accent", "action", "brand", "purple", "pink", "muted"]

/*
 * The palette the colour menus offer by default: the theme's five tokens, which
 * follow the theme on their own, and three hues the tokens lack, mixed with the
 * ink colour so they stay readable on dark and light pages alike. Every value
 * keeps a var() inside, so the browser stores the style exactly as written and
 * the menu can tell which swatch a piece of text carries. An app that maps
 * outside colours onto the palette (an import) builds the same list with it.
 */
export function editorColors(names: Partial<Record<EditorColorKey, string>> = {}): EditorColor[] {
  return ORDER.map((key) => {
    const text = TOKENS.has(key) ? `var(--color-${key})` : `color-mix(in oklab, rgb(${HUES[key]}) 80%, var(--color-ink))`
    return { key, name: names[key] ?? LABELS[key], text, background: `color-mix(in srgb, ${text} 24%, transparent)` }
  })
}

const plain = (value: string | undefined) => (value && parseColor(value) ? value.trim() : null)

const style = (editor: Editor) => editor.getAttributes("textStyle") as { fontFamily?: string; fontSize?: string; color?: string; backgroundColor?: string }

export function stylingPlugin(options: StylingOptions = {}): EditorPlugin {
  const text = { ...LABELS, ...options.labels }
  const fonts = options.fonts ?? []
  const palette = editorColors(text)
  const colors = options.colors ?? palette.map((color) => ({ name: color.name, value: color.text }))
  const backgrounds = options.backgrounds ?? palette.map((color) => ({ name: color.name, value: color.background }))
  const custom = options.custom ?? true
  const sizes = [
    { id: "small", label: text.small, value: "0.875em" },
    { id: "normal", label: text.normal, value: null },
    { id: "large", label: text.large, value: "1.25em" },
    { id: "huge", label: text.huge, value: "1.6em" },
  ]
  const aligns = [
    { id: "left", label: text.left, icon: "lucide:align-left" },
    { id: "center", label: text.center, icon: "lucide:align-center" },
    { id: "right", label: text.right, icon: "lucide:align-right" },
    { id: "justify", label: text.justify, icon: "lucide:align-justify" },
  ]
  const menus: EditorMenu[] = []
  if (fonts.length) {
    menus.push({
      id: "font",
      label: text.font,
      icon: "lucide:type",
      items: (editor) => [
        { id: "default", label: text.defaultFont, active: () => !style(editor).fontFamily, apply: (chain) => chain.unsetFontFamily() },
        ...fonts.map<EditorMenuItem>((font) => ({
          id: font.name,
          label: font.name,
          labelStyle: { fontFamily: font.family },
          active: () => style(editor).fontFamily === font.family,
          apply: (chain) => chain.setFontFamily(font.family),
        })),
      ],
    })
  }
  menus.push(
    {
      id: "size",
      label: text.size,
      icon: "lucide:a-large-small",
      items: (editor) =>
        sizes.map((size) => ({
          id: size.id,
          label: size.label,
          active: () => (style(editor).fontSize ?? null) === size.value,
          apply: (chain) => (size.value ? chain.setFontSize(size.value) : chain.unsetFontSize()),
        })),
    },
    {
      id: "color",
      label: text.color,
      icon: "lucide:baseline",
      items: (editor) => [
        { id: "default", label: text.defaultColor, swatch: "var(--color-ink)", active: () => !style(editor).color, apply: (chain) => chain.unsetColor() },
        ...colors.map<EditorMenuItem>((color) => ({
          id: color.name,
          label: color.name,
          swatch: color.value,
          active: () => style(editor).color === color.value,
          apply: (chain) => chain.setColor(color.value),
        })),
      ],
      custom: custom
        ? { label: text.custom, read: (editor) => plain(style(editor).color), apply: (chain, value) => chain.setColor(value) }
        : undefined,
    },
    {
      id: "background",
      label: text.background,
      icon: "lucide:paint-bucket",
      items: (editor) => [
        { id: "none", label: text.noBackground, icon: "lucide:circle-off", active: () => !style(editor).backgroundColor, apply: (chain) => chain.unsetBackgroundColor() },
        ...backgrounds.map<EditorMenuItem>((color) => ({
          id: color.name,
          label: color.name,
          swatch: color.value,
          active: () => style(editor).backgroundColor === color.value,
          apply: (chain) => chain.setBackgroundColor(color.value),
        })),
      ],
      custom: custom
        ? { label: text.custom, read: (editor) => plain(style(editor).backgroundColor), apply: (chain, value) => chain.setBackgroundColor(value) }
        : undefined,
    },
    {
      id: "align",
      label: text.align,
      icon: "lucide:align-left",
      items: (editor) =>
        aligns.map((align) => ({
          id: align.id,
          label: align.label,
          icon: align.icon,
          active: () => editor.isActive({ textAlign: align.id }),
          apply: (chain) => chain.setTextAlign(align.id),
        })),
    },
  )
  return {
    id: "styling",
    extensions: [TextStyle, FontFamily, FontSize, Color, BackgroundColor],
    menus,
  }
}
