# @leavepulse/ui

Token-driven Vue 3 component kit for LeavePulse — components on [reka-ui](https://reka-ui.com)
and [Tailwind CSS v4](https://tailwindcss.com), a runtime theme engine (themes are
JSON token sets), and a composable block-layout canvas.

## Install

Published to the public npm registry:

```bash
npm install @leavepulse/ui
```

Peer dependencies to install alongside: `vue` 3.5+, `reka-ui` 2.9+, `tailwindcss` 4,
`tailwind-variants` 3, `motion-v` 2, `@iconify/vue` 5, `@iconify-json/lucide` and
`@internationalized/date`. `@nuxt/kit` is only needed for the Nuxt module.

## Usage

Styling follows the `@nuxt/ui` model: **the consuming app owns Tailwind**, the kit
contributes its `@theme` tokens and a `@source` over its own components. In your
app's main CSS:

```css
@import "tailwindcss";
@import "@leavepulse/ui/css";
```

Then use the components:

```vue
<script setup lang="ts">
import { LpButton, LpModal } from "@leavepulse/ui"
</script>
```

The kit does **not** ship a precompiled stylesheet — your Tailwind build emits the
utilities its components use, scoped via the `@source` globs in the CSS entry.

Apps using the topology canvas (`LpTopologyCanvas`) also import its stylesheet:

```css
@import "@leavepulse/ui/canvas.css";
```

### Theme before mount (plain Vue)

Themes are JSON token sets applied at runtime. Paint the saved one before the
app mounts, so the first frame already has the right colours:

```ts
import { bootstrapTheme, dark, light, nord, useTheme } from "@leavepulse/ui"

bootstrapTheme(dark)
createApp(App).mount("#app")

// later, from a switcher or settings page
useTheme().setTheme(nord)
useTheme().setSystem({ light, dark }) // follow the OS colour scheme
```

`LpThemeProvider` applies a theme to one subtree only (a dark sidebar in a light
app, a live preview). With `transition`, changing its `theme` reveals the new one
with the same circular transition as the page switch, from where the user last
pressed. `revealTransition(update, origin)` runs any repaint behind that reveal.

### App-wide configuration

`provideLpConfig` (or `app.use(lpConfig({...}))`) sets the link component that
internal links render (`LpLink`, `LpButton` with `to`/`href`, `LpBreadcrumbs`,
`LpSidebar` items) and overrides the English text the kit renders, per scope:

```ts
import { RouterLink } from "vue-router"
import { lpConfig } from "@leavepulse/ui"

app.use(lpConfig({
  linkComponent: RouterLink,
  labels: { sidebar: { search: "Suche" }, appShell: { openMenu: "Menü öffnen" } },
}))
```

A component's own `labels` prop wins over the configuration.

### Nuxt

```ts
export default defineNuxtConfig({
  modules: ["@leavepulse/ui/nuxt"],
  leavepulseUi: {
    defaultTheme: "Nord",  // fallback when nothing is saved
    themes: "~/themes",    // optional: module whose default export is your TokenSet[]
  },
})
```

The module registers every exported component, paints the saved theme during
SSR (from the `lp-theme` cookie, no flash), and provides `NuxtLink` as the link
component. `theme: false`, `link: false` and `exclude: ["Name"]` opt out.

### Icons

`<LpIcon name="lucide:check">` renders offline, never through the iconify API.
The kit registers only the icons its own components use (about 20 KB instead of
the whole ~540 KB lucide set). Any other lucide name still renders: the full
collection loads as a separate chunk of your bundle the first time one is
needed, and an empty box of the same size holds the place until then.

Register icons up front when they must be in the server render or must not wait
for a chunk:

```ts
import { registerIcons, registerIconCollection } from "@leavepulse/ui"

await registerIcons(["lucide:rocket", "lucide:server"])  // from the bundled lucide set
registerIconCollection(myIconsJson)                      // any iconify collection
import "@leavepulse/ui/icons-all"                        // the whole lucide set, as before
```

In Nuxt the module does it for you: `icons: "scan"` (default) registers every
`lucide:*` literal found in the app's source, so they are in the SSR markup;
`"all"` registers the whole set, `"kit"` only the kit's own, or pass a list.

### Glass on WebKitGTK (Tauri on Linux)

WebKitGTK reports `backdrop-filter` as supported and then draws nothing, and on
some GPUs (NVIDIA with the proprietary driver) it runs without hardware
acceleration at all. Call `detectBackdropFilter()` once at startup: glass
panels then turn solid instead of showing the page unblurred.

An app that paints its own wallpaper can keep the frosted look there: hand the
kit the same `background` value and glass panels draw a blurred copy of it,
aligned to the screen, under their tint.

```ts
import { detectBackdropFilter, setGlassBackdrop } from "@leavepulse/ui"

detectBackdropFilter()
setGlassBackdrop("url(/wallpaper.jpg) center / cover no-repeat, #0b0f14")
// A wallpaper blurred ahead of time is cheaper on an engine that blurs on the CPU:
// setGlassBackdrop("url(/wallpaper-blurred.jpg) center / cover", { filter: "none" })
```

Only the wallpaper is softened; live content under a panel stays sharp behind
its tint. Nothing changes in engines where the real blur works.

### Native scrollbar skin (opt-in)

`LpScrollArea` skins the scroll it owns. For everything it can't — the page
itself, sticky panels, code blocks — opt the whole app into the same look by
importing the native scrollbar skin. It styles the browser's own scrollbars
(brand thumb, thin, rounded) **without** a container, so sticky positioning,
scroll restoration and anchor jumps keep working:

```css
@import "tailwindcss";
@import "@leavepulse/ui/css";
@import "@leavepulse/ui/scrollbar.css"; /* after the tokens — reads --color-brand */
```

Hide a specific scrollbar with the `lp-scrollbar-none` class.

Selected text takes the operating system's accent unless told otherwise (on
Linux that is the GTK theme, so it can come out red or green next to the kit
palette). Opt into the theme's colour the same way:

```css
@import "@leavepulse/ui/selection.css"; /* after the tokens — reads --color-brand */
```

## Develop

```bash
bun install
bun run dev          # live preview/playground on http://127.0.0.1:4500
bun test             # unit tests
bun run build        # type-check + build the library and declarations to dist/
npm run check:pack   # the tarball has its declarations and every export target
bun run dev:dist     # rebuild dist on change (for a linked consumer)
```

`dist/` is generated, not committed. Releases: `npm run release` (or
`release:minor`) bumps the version and pushes the tag; CI tests, builds and
publishes it.
