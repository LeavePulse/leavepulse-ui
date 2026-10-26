import {
  LpThemeProvider,
  presets,
  useTheme,
  LpBadge,
  LpButton,
  LpThemeSwitcher,
  LpThemeStudio,
} from "../../../src"
import { type ComponentEntry } from "./shared"

export const theming: ComponentEntry[] = [
  {
    id: "theme-switcher",
    name: "ThemeSwitcher",
    description:
      "Theme picker wired to the token engine — swatch / icon / pill triggers, circular-reveal transition on change, and the choice persisted across reloads. `system` adds a \"System\" entry that follows the OS colour scheme with a light/dark pair (`useTheme().setSystem({ light, dark })` does the same in code). LpThemeProvider paints one subtree in another theme, derived tokens included. Selected text follows the theme too once the app imports the opt-in `@leavepulse/ui/selection.css` (this preview does: select any text here and switch themes); without it the browser paints selection in the OS accent, which on Linux comes from the GTK theme. The switcher's right-click menu ends in the theme studio; LpThemeStudio puts the same studio on a page, as a settings section, and lays its themes out to the width it is given.",
    components: { LpThemeSwitcher, LpThemeStudio, LpThemeProvider, LpButton, LpBadge },
    state: () => {
      const theme = useTheme()
      return {
        theme,
        light: presets.light,
        rose: presets.rose,
        nord: presets.nord,
        scoped: presets.rose,
        followSystem: () => theme.setSystem({ light: presets.light, dark: presets.dark }),
      }
    },
    template: `<div class="flex w-full max-w-2xl flex-col gap-6">
  <div class="flex flex-wrap items-center gap-6">
    <LpThemeSwitcher variant="swatch" />
    <LpThemeSwitcher variant="icon" />
    <LpThemeSwitcher variant="pill" :system="{ light: 'Light', dark: 'Dark' }" />
    <LpButton size="sm" variant="outline" @click="followSystem">Follow the OS</LpButton>
    <span class="text-xs text-muted">{{ theme.system ? 'Following the OS' : 'Fixed theme' }}</span>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <LpThemeProvider :theme="light" class="flex flex-col gap-3 rounded-card border border-line p-4">
      <p class="text-sm font-medium">Always Light</p>
      <p class="text-xs text-muted">This panel keeps its theme whatever the page uses.</p>
      <div class="flex gap-2"><LpButton size="sm" variant="action">Save</LpButton><LpBadge tone="success">online</LpBadge></div>
    </LpThemeProvider>
    <LpThemeProvider :theme="scoped" transition class="flex flex-col gap-3 rounded-card border border-line p-4">
      <p class="text-sm font-medium">{{ scoped.name }}, switchable</p>
      <p class="text-xs text-muted">With transition, a new theme reveals from the button that changed it.</p>
      <div class="flex gap-2">
        <LpButton size="sm" variant="action" @click="scoped = scoped.name === rose.name ? nord : rose">Switch theme</LpButton>
        <LpBadge tone="danger">failed</LpBadge>
      </div>
    </LpThemeProvider>
  </div>
  <div class="rounded-card border border-line bg-surface-raised p-4">
    <LpThemeStudio :hide="['export']" />
  </div>
</div>`,
    thumb: `<div class="flex flex-col items-center gap-3">
  <div class="flex items-center gap-4">
    <LpThemeSwitcher variant="swatch" />
    <LpThemeSwitcher variant="icon" />
  </div>
  <LpThemeProvider :theme="tTheme" class="flex items-center gap-2 rounded-card border border-line p-3">
    <span class="text-sm font-medium">{{ tTheme.name }}</span>
    <LpButton size="sm" variant="action">Save</LpButton>
    <LpBadge tone="success">online</LpBadge>
  </LpThemeProvider>
</div>`,
    thumbLoop: { every: 2200, frames: [{ tTheme: presets.rose }, { tTheme: presets.nord }, { tTheme: presets.light }] },
  },
]
