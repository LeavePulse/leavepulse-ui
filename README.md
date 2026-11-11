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

#### Ukrainian label pack

The kit ships a complete Ukrainian pack, `uk`, with an entry for every label
scope. Pass it once at the root instead of a `labels` prop on each use:

```ts
import { lpConfig, uk } from "@leavepulse/ui"

app.use(lpConfig({ labels: uk }))
// or, inside a component's setup: provideLpConfig({ labels: uk })
```

English stays the components' built-in default, so an app without the pack is
unchanged. To adjust a few strings, layer them on top: a nested
`provideLpConfig({ labels: { table: { empty: "Порожньо" } } })` refines the
scope rather than replacing it, and a component's `labels` prop still wins.

The pack is typed as `KitLabels`, which requires every key of every scope, so a
new label that lacks a translation fails the type check. A test also fails when
a `useLabels("scope", ...)` call has no entry in the pack. Writing a pack for
another language against `KitLabels` gets the same checks.

### Back and Forward for overlays

`provideOverlayHistory()` (at the app root, like `provideGlass()`) makes the
browser's Back button close overlays instead of leaving the page:

```ts
import { provideOverlayHistory } from "@leavepulse/ui"

// in App.vue's setup; pass the router so a Back that only closes a dialog is not a navigation
provideOverlayHistory(true, { router })
```

- Opening an `LpModal` or `LpDrawer` (and what is built on them:
  `LpConfirmDialog`, `LpShortcutsDialog`) adds one history entry. Back closes
  the topmost overlay; nested ones close one per press, top first.
- Closing through the UI (close button, Escape, the scrim, the app setting
  `open` to false) takes the entry back out, so Back is never spent on a step
  that shows nothing. A `guard` that keeps the overlay open on Back keeps its
  entry too.
- `LpTabs` inside an open overlay record each switch: Back returns to the
  previous tab before it closes the overlay. Page-level tabs stay out (an app
  keeps those in its URL); `history` on `LpTabs` opts out inside an overlay or
  in on a page without a router.
- Forward after Back does nothing by default: the step is undone at once, so
  no dead entry is left. The kit only sees a boolean `open`, and what the app
  put into the overlay may be gone by then. `history="reopen"` (or
  `provideOverlayHistory("reopen")`) re-opens it on Forward by emitting
  `update:open` true while the overlay is still mounted.
- `history` on a single overlay wins over the app-wide mode: `false` keeps an
  overlay out of history, for one the app already opens from its route query
  (it would otherwise take two entries for one dialog). An overlay the app
  writes into the query with `router.replace` needs nothing: when it closes,
  the address the app left is kept, and the overlay does not open again from
  the entry under it.
- A real navigation (a link, `router.push` to another path) closes the open
  overlays, and the entries they leave under the new page are skipped, so Back
  from it lands on the page in one press. A push that keeps the path (a query
  or hash, such as an overlay driven by the route query) leaves them open.

The URL never changes and the router's own `history.state` data is copied into
each entry. The `router` option is vue-router's instance (anything with a
`listening` switch works): without it the router sees each Back that closes an
overlay as a visit to the page it is already on (guards and `afterEach` run
again, nothing remounts). A Forward onto a kit entry still reaches it that
way, because the entry it starts from belongs to the router. Plain
`pushState` and `popstate` only, so WebKit (Safari, WebKitGTK) works too.

### Module format

The package is ESM only: `require("@leavepulse/ui")` is not supported. Import
from the package root; `@leavepulse/ui/dist/*.js` also resolves, for a tool
that needs one file (the Nuxt module does), and covers `components`,
`composables`, `layout` and `theme`.

### Catching a misspelt prop

A prop a component does not declare falls through as an attribute with no
error, so `<LpTooltip text="...">` renders with no tip. `lpPropCheck` warns in
development, and knows `data-*`, `aria-*` and anything the rendered element
takes. The Nuxt module installs it in `nuxt dev` (`propCheck: false` turns it off).

```ts
import { lpPropCheck } from "@leavepulse/ui"
if (import.meta.env.DEV) app.use(lpPropCheck, { ignore: [/^x-/] })
```

vue-tsc also skips unknown props by default. `vueCompilerOptions.checkUnknownProps`
in the app's tsconfig turns that on, but it also reports attributes passed
through on purpose (`id`, `title`, `aria-*`), so it suits a one-off sweep better
than a standing gate.

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

### Linked views

A monitoring screen shares one selection, one stretch of time and one followed
trace. `provideLinkedView()` holds them, and each `link*` binder turns them into
the props and listeners of a component it already has, for `v-bind`:

```ts
const view = provideLinkedView()
const canvas = ref()
const table = linkTable(view, { kind: "server" })
const graph = linkTopology(view, canvas, { kind: "server" })
const log = linkLog(view, { kind: "server" })
const chart = linkChart(view, { times })
const pipeline = linkPipeline(view, { kind: "deployment", steps })
```

Picking a row focuses the node and filters the log to its source; a picked log
line becomes a chart annotation; a clicked trace id fills the log search; the
chart's window is the time range the log shows; selecting a deployment opens its
failed steps. A binder with a `kind` answers only to that kind. The log needs
`selectable` and `link-ids`, a chart `zoomable` or `range-selector` to change
the range. `useLinkedView()` reads the view from a child; with none provided it
is private to that panel. The table link holds one row at a time.

### Workspaces, inspector and windows

`useWorkspaces` keeps several named layouts over one `useLayout`; bind
`spaces.controller.layout` to `LayoutCanvas` as usual. Edits save to the active
workspace on their own, and `persist` keeps them across visits. A switch clears
undo: history belongs to one workspace. `LpWorkspaceSwitcher` is the menu for it.

`LpInspector` is the panel beside a table or graph for the selected thing:
`sections` of facts, `#section-<key>` for editing fields, `#empty` with nothing
selected. It sits in the layout. On a phone, put it in an `LpDrawer`.

`LpWindow` is a floating panel the page keeps working under: move, resize, dock
on a screen edge, snap to other windows, `persist` for its place. It stays out
of the modal stack and under dropdowns; it is not a window manager (no
minimising, no taskbar).

### Repeatable form rows

`LpRepeater` supplies add/remove controls and stable row identity. Its slot owns
the fields and validation; internal keys never become part of the saved model.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { LpInput, LpRepeater } from "@leavepulse/ui"

const volumes = ref([{ name: "data", mount: "/var/lib/app" }])
const emptyVolume = () => ({ name: "", mount: "" })
</script>

<template>
  <LpRepeater v-model="volumes" :create-item="emptyVolume" label="Volumes">
    <template #default="{ item, disabled }">
      <div class="flex gap-2">
        <LpInput v-model="item.name" label="Name" :disabled="disabled" />
        <LpInput v-model="item.mount" label="Mount path" :disabled="disabled" />
      </div>
    </template>
  </LpRepeater>
</template>
```

For immutable reloads, pass `item-key="id"` (or a function returning a unique
string/number). Without a business key, rows retain identity while the same
objects are edited, reordered or removed. The slot also provides `index`,
`update(nextItem)` for immutable edits and `remove()`. `labels` overrides
`add`, `remove` (`{index}` is one-based) and `empty`; app-wide labels use the
`repeater` scope. The `empty` slot replaces the empty-list text.

`LpInput clearable` adds a clear button that keeps focus in the input, respects
disabled/read-only state, and can be combined with the `trailing` slot. Its
button text comes from `labels.clear` or the app-wide `input` label scope.

### Staying in the right window

`tests/realmGuard.test.ts` fails on `instanceof Element`, a bare `new ResizeObserver`, `getComputedStyle` or `document.activeElement`: inside an LpFrame those are another realm's. Use `composables/realm.ts`.

### Browser regression tests

```sh
bunx playwright install chromium
bun run test:browser
```

Playwright starts an isolated Vite server on port 4501. The suite covers field
locking, secret reveal controls, date/select focus boundaries and a mobile
form inside a guarded drawer. These checks run in CI and before npm publishing.
Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to run an existing Chromium installation.

### Contextual command palette

Wrap the application (or a page and its palette) in `LpCommandScope`. Nested
scopes share a registry, prioritise page commands, and unregister on unmount.
`isolated` starts a separate registry for an embedded application or demo.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  LpCommandScope, LpCommandPalette, LpFormField, LpNumberField,
  useThemeStudio,
} from '@leavepulse/ui'

const studio = useThemeStudio()
const open = ref(false)
const cpu = ref(4)
</script>

<template>
  <LpCommandScope id="settings" label="Settings" :theme="studio">
    <LpFormField label="CPU limit">
      <LpNumberField v-model="cpu" :min="1" :max="128" :palette="{ id: 'cpu' }" />
    </LpFormField>
    <LpCommandPalette v-model:open="open" preview-pane recent-key="my-app-palette" />
  </LpCommandScope>
</template>
```

Named kit fields, buttons, tabs and disclosures register automatically in a
scope. A field uses its own label, its `LpFormField` label or `aria-label`.
`palette` metadata (`id`, `label`, `description`, `keywords`) refines its metadata;
`:palette="false"` excludes it. Passwords and secrets are excluded even when
revealed. Previews reuse the original component's model bindings and constraints;
Enter opens an editor on narrow screens too. Escape returns to results.
Preview components and compound control internals are excluded from discovery.

Tables take `:palette="{ id: 'services', label: 'Services', labelKey: 'name' }"`.
They publish the currently loaded/filtered rows and their existing `rowMenu`
actions. Searching an entire remote dataset still needs a search provider.
Menus with a title reuse their existing item definitions. `discover=false` on a
scope disables automatic component discovery while retaining manual commands and
an explicitly supplied Theme studio. `context=false` on the palette excludes
contextual commands.

Inside a descendant page component, `usePaletteCommands(() => [...])` registers
reactive manual commands for that page's lifetime. Alternatively pass `commands`
to `LpCommandScope` directly. Manual `commands` passed to the palette replace a
registered command with the same ID. `previewComponent` provides a rich preview;
`editInPreview` makes Enter focus it. Native markup can opt in with the locally
imported `vPalette` directive:

```vue
<button v-palette="{ id: 'refresh', label: 'Refresh servers', action: 'click' }"
        @click="refresh">Refresh</button>
```

The directive defaults to focusing its target. `afterClose` on a manual command
runs after the palette releases its focus trap, suitable for focusing a field
or a lazily revealed section. Page hints can prepare that section in `onSelect`
and locate its existing `v-hint` target in `afterClose`.

Theme uses the same `ThemeStudio` as `LpThemeSwitcher` / `LpThemeStudio`; these
components also register it when inside a scope. The palette editor keeps a
local draft, shows it through `LpThemeProvider`, and commits only on Apply.
Revert or closing the editor discards pending edits. `usePaletteTheme(studio)`
registers a studio explicitly from a descendant component.

`modes` accepts providers under `people`, `channels`, `roles`, `commands`, `help`.
Their sigils are `@`, `#`, `&`, `>`, `?`. People/channels/roles appear when supplied;
commands and keyboard help are provided by default. Each provider is the same
static array or abortable `CommandFetcher` used by `children`.

Pin the highlighted leaf with the star button or Alt+P in the search box.
Pins have their own group and storage (`pinnedKey`, defaulting to
`${recentKey}:pinned`) and do not expire from recent history. Bind `pinned` /
`update:pinned` for external storage. Persistence uses the kit's configured
storage adapter.

A `prompt` command accepts `{ placeholder, initial, validate, submit }`.
Validation may be asynchronous; errors keep the input open, and changing the
value or leaving the step invalidates an outstanding validation. Async actions
are awaited, duplicate execution is blocked, and failures remain visible.
`undo(result)` adds an Undo toast only after successful execution; the application
supplies the actual inverse operation. Preview actions have visible buttons as
well as the Tab menu, including an Actions button on phones.

`LpPaletteFacts` and `LpPaletteStats` accept `loading`. Known labels retain their
place, values become skeletons; empty item lists receive placeholder rows.
Try the complete example at `/component/context-palette` in the preview.
