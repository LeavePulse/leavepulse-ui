# @leavepulse/ui

Token-driven Vue 3 component kit for LeavePulse — components on [reka-ui](https://reka-ui.com)
and [Tailwind CSS v4](https://tailwindcss.com), a runtime theme engine (themes are
JSON token sets), and a composable block-layout canvas.

## Contents

- [Install](#install) and [Usage](#usage)
- [Configuration](#configuration): theme, labels and languages, icons, Nuxt, overlays and Back, prop check, WebKitGTK glass, scrollbars
- [Components](#components): every component by group, with what it is for
- [Guides](#guides): linked views, workspaces, forms, tables, clipboard, video, command palette
- [Develop](#develop) and [Releasing](#releasing)

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

### Module format

The package is ESM only: `require("@leavepulse/ui")` is not supported. Import
from the package root; `@leavepulse/ui/dist/*.js` also resolves, for a tool
that needs one file (the Nuxt module does), and covers `components`,
`composables`, `layout` and `theme`.

## Configuration

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

### Labels and languages

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

#### Another language

Every piece of text a component renders belongs to a label scope (`table`,
`videoTrim`, `copyButton`…), and `KitLabels` lists them all with every key.
A pack written as `const de: KitLabels = { ... }` is checked the same way as
`uk`: a scope or a key it misses fails the type check, and a new label in a
later version shows up as an error instead of a stray English word. Partial
overrides need no type: pass only the scopes and keys you change.

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

## Components

The list below is generated from the sources (`bun run gen:readme`),
so it always matches what the package exports. The first line of each comes
from the comment that opens the component.

<!-- catalogue:start -->

142 components. The preview (`bun run dev`) shows each one live, with its props, events and slots.

<details>
<summary><b>Basics</b> (24)</summary>

- `LpAlert`: A notice in the page's flow: info, success, warning or danger, easing between them when it changes.
- `LpAvatar`: A person's picture, or their initials on a colour of their own when there is none.
- `LpBadge`: A short label or count on a tone: a status, a tag, a number of new items.
- `LpButton`: The button, in solid, soft, outline, ghost and danger looks, with loading, an icon-only square and a link mode.
- `LpCard`: The surface most content sits on, with an optional header, footer and right-click menu.
- `LpCodeBlock`: Code block with lightweight, theme-aware syntax highlighting (codeHighlight.ts — zero deps, synchronous).
- `LpCopyButton`: The one copy button: an icon that turns into a tick for a moment, a tip that says "Copy" and then "Copied", and nothing thrown when the clipboard refuses.
- `LpDivider`: A rule between blocks, optionally with a label in the middle.
- `LpDock`: A row (or column) of icon buttons that swell under the pointer, their neighbours less with distance: the launcher's quick bar of apps, instances or tools.
- `LpEmptyState`: What a list or page shows when there is nothing in it yet: an icon, a line and an action.
- `LpIcon`: Icon — wrapper over @iconify/vue.
- `LpIdenticon`: A face for something that has no picture: a mirrored pixel pattern and a colour, both derived from `seed` (an id, a username, a key's fingerprint).
- `LpLink`: A link that renders the app's router link for internal targets and a plain anchor for external ones.
- `LpLoader`: The kit's loading indicator: a spinner, three dots or an indeterminate bar.
- `LpMasonry`: Items of different heights packed into columns without the ragged gaps a grid leaves: memo cards, screenshots, mod tiles.
- `LpPopover`: A floating panel anchored to a trigger, for content that is more than a tip.
- `LpRelativeTime`: A date said the way people say it ("3 min ago", "in 2 h"), kept true as time passes, with the exact date one hover away.
- `LpScrollArea`: Drawn overlay scrollbar (reka ScrollArea).
- `LpSection`: A section heading with no default slot: a title, an optional line under it and actions on the right; the section's content goes after it, not inside.
- `LpSkeleton`: Loading placeholder, in two shapes.
- `LpStatus`: What state something is in, as a light and a word: a server online, a bot starting, a region degraded.
- `LpTooltip`: Tooltip for controls whose meaning is not written on them — an icon button, a truncated value, a disabled action that owes an explanation.
- `LpTooltipProvider`: Shared timing for every LpTooltip below it: once one tip is showing, moving to the next opens it without waiting the delay again.
- `LpTruncate`: Text that may not fit: cut with an ellipsis, and the whole of it in a tip — but only when something was actually cut.

</details>

<details>
<summary><b>Forms</b> (34)</summary>

- `LpAddressInput`: Postal address form — street, optional second line, city, postcode and country — with live suggestions on the text fields and a button that opens a map to drop a pin instead of typing.
- `LpAutocomplete`: Free-text autocomplete — a text field that suggests as you type but never forces a choice.
- `LpCalendar`: Inline month calendar (reka Calendar).
- `LpCheckbox`: A checkbox with a label, including the indeterminate state.
- `LpCodeDisplay`: A short code a person reads off the screen, types somewhere else or writes down: a one-time sign-in code, a pairing code for a device, a recovery key, a licence key.
- `LpColorPicker`: Colour picker — a trigger showing the current colour, and a popover holding a saturation/value field, a hue rail, an optional alpha rail, a hex field and a row of presets.
- `LpDatePicker`: Date field + calendar popover.
- `LpDateRangePicker`: Range field + popover: presets on one side, a range calendar on the other.
- `LpDropzone`: A place to put files: drop them, click to browse, or paste from the clipboard.
- `LpEditable`: Text that is edited where it stands: a server's name in its header, a channel's topic, a note on a row.
- `LpFormField`: Form-control wrapper: label + the control (default slot) + hint/error.
- `LpImageEditor`: Straighten-and-crop for a picture on its way to being uploaded.
- `LpInput`: A text field with a label, hint, error, icons, a clear button and leading or trailing slots.
- `LpMapPicker`: Point picker on a raster tile map — drag to pan, wheel or the buttons to zoom, click to drop the pin, arrows and +/−/0 from the keyboard.
- `LpNumberField`: A number field with steppers, limits and locale-aware formatting.
- `LpOtpInput`: One-time-code input (TOTP / 2FA).
- `LpPasswordInput`: A password field with a show/hide button.
- `LpPhoneInput`: Phone number field — a country picker (flag + dial code) fused with a free-text number input.
- `LpRadio`: One radio button; LpRadioGroup holds a set of them.
- `LpRadioGroup`: A set of radio buttons for one choice among a few.
- `LpRangeCalendar`: Inline range calendar (reka RangeCalendar).
- `LpRangeSlider`: Two thumbs on one track: a range rather than a value.
- `LpRepeater`: Repeatable form rows with add and remove buttons and a stable identity per row.
- `LpSecretField`: A value someone must be able to read and copy but should not have on screen by default: an API key, a bot token, a webhook secret, a recovery code.
- `LpSegmented`: Segmented control — a compact bar of mutually-exclusive options with a sliding pill marking the selection (iOS-style).
- `LpSelect`: One select to rule them all — built on reka-ui Combobox.
- `LpSlider`: One value on a track, dragged or stepped with the keys.
- `LpSwitch`: An on/off switch with a label.
- `LpTagsInput`: Free-form list of short values: emails, labels, hostnames.
- `LpTextarea`: A multi-line text field that can grow with its content.
- `LpTimeField`: Time-of-day field: hour and minute segments, typed or stepped with the arrow keys (reka TimeField).
- `LpVideoCompress`: Trim and shrink a video on the person's own machine before it is uploaded.
- `LpVideoPlayer`: A video with the kit's own controls instead of each browser's: the same look in Chromium, Firefox and the launcher's WebKitGTK, in both themes.
- `LpVideoTrim`: Pick a stretch of a video, and optionally a rectangle on its picture, for a server to cut (ffmpeg) or blur.

</details>

<details>
<summary><b>Data</b> (21)</summary>

- `LpActivityLine`: A hairline along the edge of a card, table or page that says "something is happening here": a sweep while the length of the work is unknown, a fill once it is, a quick run to the end and a fade whe…
- `LpChart`: Token-driven SVG chart: line, area and bar off one data shape.
- `LpCountdown`: Time left until something: "resend the code in 0:42", "maintenance in 2d 3h", "the lobby closes in 4:59".
- `LpDataList`: Facts about one thing, as label and value pairs: a server's address, region, uptime and version; an account's id, plan and creation date.
- `LpFileTree`: File/folder tree — the kit convention for browsing a hierarchy of files so apps stop re-implementing indent math, chevron state and tree keyboard rules.
- `LpGauge`: One reading within a range, drawn as a dial: CPU load, disk use, a score.
- `LpLightbox`: Full-screen image viewer — the Discord-style lightbox: click a thumbnail, the image fills the screen, arrows step through the set, the wheel zooms toward the cursor over the picture and pages throu…
- `LpLogViewer`: Terminal-flavoured log stream.
- `LpMediaGallery`: A grid of thumbnails that opens into the lightbox.
- `LpNumberFlow`: A number whose DIGITS roll, like an odometer.
- `LpPagination`: Page navigator.
- `LpPie`: Shares of a whole, as a pie or a donut.
- `LpPipeline`: A run of jobs and the state each one is in: a deploy, a CI workflow, a server being provisioned.
- `LpProgress`: One determinate value, drawn as a bar or as a ring.
- `LpQuota`: "Used of limit": storage, seats, API calls.
- `LpRollingText`: Text that CHANGES rather than being replaced.
- `LpSparkline`: A trend, inline.
- `LpStat`: One headline figure with its label, a change against before and an optional sparkline.
- `LpStepMark`: The state of one job as a round glyph: hollow while it waits, spinning while it runs, a tick, a cross, a dash for skipped, a slash for cancelled.
- `LpTable`: A data table: sorting, column filters, selection, row menus, a toolbar with the page's controls, export and paging.
- `LpUptimeBar`: Uptime over a period as a row of slices, each coloured by the state it was in.

</details>

<details>
<summary><b>Navigation</b> (15)</summary>

- `LpActionBar`: A bar that rises from the bottom of the window to ask for one decision, then leaves.
- `LpBreadcrumbs`: Where the page sits in the app, as a trail of links.
- `LpCommandPalette`: Command palette (⌘K).
- `LpContextMenu`: Right-click context menu (reka ContextMenu).
- `LpDropdownMenu`: A menu opened from a button (usually a row's "…").
- `LpKeys`: A key combination drawn as keycaps: "Ctrl+K" is two caps, "G I" is G then I.
- `LpPaletteFacts`: A short list of facts in a palette preview: a label, and what it is set to now.
- `LpPaletteHeader`: The head of a palette preview: what kind of thing this is (eyebrow), its name, a line under the name, and a lead paragraph.
- `LpPalettePreview`: The body of LpCommandPalette's `#preview` slot.
- `LpPaletteStats`: A few figures in a palette preview, as tiles: mods and worlds in an instance, downloads and follows of a project, members online.
- `LpPaletteSwatches`: A theme's colours as a strip of swatches on its own surface, for a palette preview of a theme picker: the row says the name, this shows what picking it would look like.
- `LpSidebar`: App-shell side navigation.
- `LpStepper`: The steps of a flow, with where the person is and which are done.
- `LpTableOfContents`: On-this-page table of contents with scroll-spy.
- `LpTabs`: Tabs with a sliding indicator, counts and dots, and keyboard movement.

</details>

<details>
<summary><b>Overlays and feedback</b> (7)</summary>

- `LpConfirmDialog`: A dialog that asks to confirm an action, with a danger look for destructive ones.
- `LpDrawer`: Side / bottom panel built on vaul-vue (drag-driven drawer over reka's Dialog primitive — same base as the rest of the kit, so accessibility and the token theming carry over).
- `LpHoverCard`: A preview card that opens when the pointer rests on something: a username that shows the profile, a server name that shows its status, a link that shows where it goes.
- `LpModal`: A dialog over the page, stacking above the one that opened it, with a guard against losing unsaved input.
- `LpModalNav`: A dialog whose sections stand BESIDE it rather than inside it — settings, a profile with tabs' worth of detail, a wizard you can skip around in.
- `LpNotificationBell`: Notification bell: an icon button with an unread badge that opens the notification feed (LpNotificationFeed) in a popover on left-click and a quick-action menu on right-click.
- `LpShortcutsDialog`: A keyboard reference, conventionally opened with F1.

</details>

<details>
<summary><b>Motion</b> (15)</summary>

- `LpCollapse`: Shows and hides content by folding it open and shut: the box grows from nothing to the content's own height (or width), and back.
- `LpDisclosure`: Collapsible "show more" section built on reka Collapsible.
- `LpGlowBorder`: A gradient that runs round the edge of whatever it wraps.
- `LpMagnetic`: Leans what it wraps toward a nearby pointer and lets it spring back when the pointer leaves.
- `LpRevealOnScroll`: Content that arrives when it is first scrolled into view.
- `LpScramble`: A value that "decrypts" into place: each character churns through random glyphs and settles, left to right or all at once.
- `LpShaderBackdrop`: A slowly moving decorative background, drawn on the GPU: behind a sign-in screen, a hero, an empty state, a launcher's home.
- `LpShift`: Wraps content whose size is derived from what's inside it, so that everything around it shifts smoothly instead of jumping.
- `LpShinyText`: Accent text with light moving through it.
- `LpSpotlight`: A soft glow that follows the pointer inside whatever it wraps.
- `LpSwap`: One piece of content standing in for another: the section picked in a side nav, the step of a wizard, the view chosen in a segmented control.
- `LpTextReveal`: Text that arrives word by word (or letter by letter): each piece fades in, rises a few pixels and comes into focus, one after another.
- `LpTilt`: A tactile 3D-tilt wrapper.
- `LpTypewriter`: Text typed out a character at a time, optionally cycling through several strings: type, hold, erase, type the next.
- `LpVideoBackdrop`: A muted, looping video behind something: a page's hero, a panel, an app's wallpaper.

</details>

<details>
<summary><b>Tours and hints</b> (4)</summary>

- `LpHintExample`: A sample of something that is absent right now, for the tour and "what changed" to point at: nobody left the server, no flag to show.
- `LpHintLayer`: Quiet "new" markers over `v-hint` elements, with a short note when the user reaches for one.
- `LpHints`: Drop-in onboarding: put it once next to the app's root, hand it a hint system, and the tour offer, the "new" dots, "what changed" and nudges all work.
- `LpTour`: A guided walk over the real interface: the target is lit through a dim scrim, a card beside it says what it is, and the user steps through with the buttons or the arrow keys.

</details>

<details>
<summary><b>Theming</b> (3)</summary>

- `LpThemeProvider`: Applies a theme to a subtree instead of the whole page: a dark sidebar in a light app, a live preview of a theme being edited, an embedded widget that keeps its own look.
- `LpThemeStudio`: The theme, tuned in place: a base theme, any brand colour, corners, control size and motion speed, all applied live, and the result ready to take away as code, JSON or CSS.
- `LpThemeSwitcher`: Theme switcher.

</details>

<details>
<summary><b>Shell, layout and other</b> (19)</summary>

- `LpAppShell`: Full application shell: the side navigation rail, a top header bar and the page, which is what scrolls.
- `LpBottomNav`: A phone app's bottom navigation: the main pages along the bottom edge, each a real link (or a button that emits `select`), the current one marked by a bar that slides between them, and "More" last…
- `LpCommandScope`: A registry of commands for LpCommandPalette: what the page and its fields offer, nested scopes first.
- `LpConfirmHost`: Renders the requests made through `confirm()` / `useConfirm()`.
- `LpContextSwitcher`: Which of an app's contexts the rail is showing — a server, a workspace, a machine, a part of the product — and the menu to change it.
- `LpFieldNotice`: The floating note from useFieldNotice: anchored under the nearest `relative` box, over whatever sits below it (usually the hint), so it never moves the layout.
- `LpFrame`: A window of its own inside the page, as LpThemeProvider is a theme of its own: what is rendered in it behaves as if it were the whole screen.
- `LpInfraNode`: A host or service card on LpTopologyCanvas.
- `LpInspector`: The panel beside a table, graph or canvas that shows the selected thing and lets it be edited: one place and one shape for "what is this, and change it".
- `LpLogInspector`: One log entry read closely: a structured payload as a tree, a stack trace with its frames set apart from the error above them.
- `LpNotificationFeed`: A notification feed: the list behind LpNotificationBell, usable on its own for a full "All notifications" page.
- `LpPageScrollbar`: The kit's overlay scrollbar for the document itself, for a page that scrolls the window (LpAppShell's default): the same bar as LpScrollArea's, drawn by the kit over the content instead of the brow…
- `LpPaletteTheme`: The theme editor inside LpCommandPalette's preview.
- `LpServiceNode`: Custom Vue Flow node for a SERVICE inside a host frame on LpTopologyCanvas.
- `LpThemeStudioSection`: One row of LpThemeStudio: a label and its controls.
- `LpToaster`: Where toasts appear; mount it once near the app root.
- `LpTopologyCanvas`: A declarative infra topology graph on Vue Flow (the engine n8n & NetBird use), themed with kit tokens.
- `LpWindow`: A floating panel over the page that the page keeps working under: a log tail beside a dashboard, a console, a reference next to a form.
- `LpWorkspaceSwitcher`: The menu for useWorkspaces: which layout is showing, the others, and making, copying, renaming and deleting them.

</details>

<!-- catalogue:end -->

## Guides

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

### Forms: repeatable rows and clearable inputs

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

### Tables: the page's own controls in the toolbar

`LpTable` keeps one bar above the rows: the filter chips, the row count and
Export (`exportable`) sit there, and the `#toolbar` slot puts the page's own
controls (a search box, segmented filters, selects) on the same line, instead
of a second bar of the page's above the table's.

```vue
<LpTable :columns="columns" :rows="rows" exportable>
  <template #toolbar>
    <LpInput v-model="query" placeholder="Search" />
    <LpSegmented v-model="status" :options="statuses" />
  </template>
</LpTable>
```

### Clipboard feedback

`useClipboard().copy(text, { toast: true, errorToast: true })` says the kit's
own "Copied" and "Couldn't copy" through the toaster, taken from the
`copyButton` label scope, so a translated app (or the `uk` pack) covers them
without every call passing its own strings. A string instead of `true` says
that string. `COPY_LABELS` is the shared English default.

### Video: playing, trimming and shrinking before upload

- `LpVideoPlayer` is a video with the kit's own controls, the same in Chromium,
  Firefox and WebKitGTK. Its full screen takes the whole player, so the controls
  and menus come along. With `fit` it sizes itself to a box (a lightbox stage, a
  card of fixed height) without upscaling past the video's own size; a height
  cap belongs on that box, not on the player.
- `LpVideoTrim` picks a stretch (`v-model:range`, seconds) and optionally an area
  of the picture (`v-model:region`, fractions of the frame) for a server to cut
  or blur. Nothing is cut in the browser.
- `LpVideoCompress` trims and shrinks a video on the person's own device before
  it is uploaded, so the upload costs only the part that matters. A preset picks
  the height and bitrate, or a target size, and the estimate shows the ceiling
  against the original. `done` hands back an MP4; `skip` keeps the original.
  Encoding uses WebCodecs (hardware encoders where the device has them) through
  `mediabunny`, which is loaded only when a video is first encoded. A browser
  without a video encoder only offers the original.

```ts
import { canTranscodeVideo, estimateTranscodedBytes, probeVideo, transcodeVideo } from "@leavepulse/ui"

if (await canTranscodeVideo()) {
  const out = await transcodeVideo(file, { range: [12, 40], maxHeight: 720, onProgress: (f) => (progress.value = f) })
}
```

Re-encoding never raises the bitrate above the source's, and the sound is kept
(AAC, or Opus where the browser has no AAC encoder).

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

## Develop

```bash
bun install
bun run dev          # live preview/playground on http://127.0.0.1:4500
bun test             # unit tests
bun run build        # type-check + build the library and declarations to dist/
npm run check:pack   # the tarball has its declarations and every export target
bun run dev:dist     # rebuild dist on change (for a linked consumer)
```

`dist/` is generated, not committed.

After adding, renaming or exporting a component, run
`bun run gen:readme`: a test fails while the catalogue above is
out of date.

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

## Releasing

`npm run release` (patch) or `npm run release:minor` bumps the version, commits
it, tags it and pushes; CI tests, builds and publishes the tag to npm. Run it on
a clean tree whose code has a green CI run. CI on `main` cancels a run in
progress when a new commit arrives, so nothing else should be pushed to `main`
while a release commit's run is going. When more than one person or agent works
on the kit at once, agree on who releases before running the script, so two
versions don't race for `latest`. npm can take a few minutes after the publish
job before the new version shows as `latest`.
