import { reactive } from "vue"
import {
  LpButton,
  LpChart,
  LpIcon,
  LpKeys,
  LpContextMenu,
  LpSkeleton,
  LpSparkline,
  LpTour,
  LpHintLayer,
  LpHints,
  LpHintExample,
  contextMenuTip,
  createHintSystem,
  HINT_SIGNALS,
  localHintStorage,
  paletteTip,
  hints,
  openContextMenu,
  type TourContext,
} from "../../../src"
import { type ComponentEntry } from "./shared"

export const onboarding: ComponentEntry[] = [
  {
    id: "tour",
    name: "Tour",
    description:
      "A guided walk over the real interface. Each step lights its target through the scrim and explains it in a card beside it; arrow keys and Enter step through, Escape closes. A target is a `v-hint` id, a selector or an element, and a step whose target is not on the page is skipped, so a tour built from the hinted controls only ever shows what this user can see. A `try` step waits for the user to press the control themselves (with an optional \"do it for me\"), and `enter` can open what the target lives in, registering its undo with `onLeave` (this step) or `onEnd` (the rest of the tour) so the page is left as it was found. On a phone the card becomes a sheet at the bottom.",
    components: { LpTour, LpButton, LpContextMenu, LpChart, LpIcon, LpKeys },
    state: () =>
      reactive({
        open: false,
        step: 0,
        log: "",
        steps: [
          { title: "A quick look around", text: "Three controls, one minute. Arrow keys work too." },
          { target: "demo.search", title: "Search", text: "Finds people, roles and channels.", keys: "Ctrl+K" },
          { target: "demo.export", title: "Export", text: "Downloads what the table shows, filters included.", try: true, perform: () => {} },
          { target: "demo.missing", title: "Not on this page", text: "Skipped: the target is not rendered for this user." },
          { target: "demo.chart", title: "Traffic", text: "Requests per hour. Empty here, so the chart draws an example while this step is on it." },
          {
            target: () => document.querySelector("[role=menu]"),
            title: "Row menu",
            text: "Right-click any row for its actions. The tour opened this one for you and closes it when you move on.",
            side: "right",
            enter: ({ onLeave }: TourContext) => {
              const row = hints.element("demo.row")
              if (!row) return
              onLeave(openContextMenu(row))
            },
          },
        ],
      }),
    template: `<div class="flex w-full max-w-md flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    <LpButton v-hint="'demo.search'" variant="outline" size="sm">Search</LpButton>
    <LpButton v-hint="'demo.export'" variant="outline" size="sm" @click="log = 'Exported'">Export</LpButton>
  </div>
  <div v-hint="'demo.chart'">
    <LpChart :series="[{ name: 'Requests', data: [] }, { name: 'Errors', data: [], axis: 'right' }]" :height="140" />
  </div>
  <LpContextMenu :items="[{ label: 'Open card' }, { label: 'Copy ID' }]">
    <div v-hint="'demo.row'" class="rounded-control border border-line px-3 py-2 text-sm">Row: right-click me</div>
  </LpContextMenu>
  <div class="flex items-center gap-3">
    <LpButton size="sm" @click="step = 0; open = true">Start the tour</LpButton>
    <span class="text-xs text-muted">{{ log }}</span>
  </div>
  <LpTour v-model:open="open" v-model:step="step" :steps="steps" @finish="log = 'Finished'" @dismiss="(at) => log = 'Closed on step ' + (at + 1)" />
</div>`,
    thumb: `<div class="flex items-center gap-3">
  <div class="rounded-control p-1 ring-2 ring-brand ring-offset-2 ring-offset-surface">
    <LpButton variant="outline" size="sm">{{ ["Search", "Filters", "Export"][tStep] }}</LpButton>
  </div>
  <div class="w-48 rounded-card border border-line bg-surface-overlay p-3 text-sm text-ink shadow-panel">
    <div class="flex items-start justify-between gap-2"><p class="m-0 font-medium">{{ ["Search", "Filters", "Export"][tStep] }}</p><LpIcon name="lucide:x" :size="14" class="text-muted" /></div>
    <p class="m-0 mt-1 text-xs text-muted">{{ ["Finds people, roles and channels.", "Narrows the list to what matters.", "Saves the table as a CSV file."][tStep] }}</p>
    <LpKeys :combo="['Ctrl+K', 'Ctrl+F', 'Ctrl+E'][tStep]" size="sm" class="mt-1.5" />
    <div class="mt-2 flex items-center justify-between"><span class="text-xs tabular-nums text-muted">{{ tStep + 2 }} / 5</span><LpButton size="xs">Next</LpButton></div>
  </div>
</div>`,
    thumbLoop: { every: 2000, frames: [{ tStep: 0 }, { tStep: 1 }, { tStep: 2 }] },
  },
  {
    id: "hints",
    thumbState: false,
    name: "Hints",
    description:
      "The whole onboarding in one component: hand <LpHints> a system made by createHintSystem (features tied to `v-hint` elements, the current page, a storage) and it offers a first-visit tour, shows quiet \"new\" dots, announces what changed and nudges toward unused features, spending one attention budget: at most one interruption per session, never over a dialog, while typing or right after navigation. State only climbs (seen, explained, used), so what someone uses is never explained again. A page met for the first time is baselined, so existing users do not get every control lit at rollout. Errors inside switch the layer off instead of breaking the page. Storage defaults to localStorage; pass your own to keep it per person on a server. Tips cover habits rather than features: contextMenuTip() speaks up for someone who keeps opening \"…\" menus marked `rightClickToo` but never right-clicks, paletteTip() for someone who walks the menu and never opens the palette; kit components report that usage themselves (HINT_SIGNALS). The command palette also lights up its Tab key for a user who never opened an item's actions. A feature that is absent right now (nothing flagged, nobody left) gets a sample the way LpSkeleton gets a layout: wrap the app's own markup with made-up data in <LpHintExample hint=\"id\">; it shows only while a tour step or \"what changed\" reaches that id with the real thing absent, eases in, is inert and tagged \"Example\", and leaves with the step. Nothing to add to the registry. One sample can cover several steps of one block (a list and its detail): pass the ids as an array; the real component inside keeps its v-hint marks, and inside a sample they mark its parts. A news item opened from a feed elsewhere (a notification bell) goes through showNews(id): it is marked read and shown as one tour step once the app is on its page and the feature, or its sample, is there. Data components need no wrapper at all: an LpChart or LpSparkline inside a `v-hint` element with nothing to draw shows made-up data on its own while a step is on that hint, tagged \"Example\"; `:sample=\"false\"` turns that off.",
    components: { LpHints, LpButton, LpContextMenu, LpHintExample, LpIcon },
    state: () => {
      const storage = localHintStorage("lp-preview-hints")
      const features = {
        "demo.inbox": { page: "demo", order: 1, title: "Inbox", text: "Everything waiting for you." },
        "demo.compose": { page: "demo", order: 2, title: "Compose", text: "Start a new message.", try: true },
        "demo.archive": { page: "demo", order: 3, title: "Archive", text: "Done items live here.", rev: 1 },
        "demo.flagged": {
          page: "demo", order: 4, conditional: true, title: "Flagged", text: "A message someone marked for you shows up here.",
        },
      }
      return reactive({
        system: createHintSystem({
          features,
          pages: { demo: { title: "this demo" } },
          news: [{ id: "archive-v2", date: "2026-10-25", page: "demo", feature: "demo.archive", text: "Archive now keeps a year." }],
          storage,
          page: () => "demo",
          sessionKey: "lp-preview-hints:session",
          timing: { settle: 600, offerAgain: 0 },
          tips: [contextMenuTip(), paletteTip()],
        }),
        reset() {
          localStorage.removeItem("lp-preview-hints")
          sessionStorage.removeItem("lp-preview-hints:session")
          location.reload()
        },
        habit(signal: string, times: number) {
          for (let i = 0; i < times; i++) hints.use(signal)
          sessionStorage.removeItem("lp-preview-hints:session")
        },
        signals: HINT_SIGNALS,
      })
    },
    template: `<div class="flex flex-col items-start gap-3">
  <div class="flex flex-wrap gap-2">
    <LpButton v-hint="'demo.inbox'" variant="outline" size="sm">Inbox</LpButton>
    <LpButton v-hint="'demo.compose'" variant="outline" size="sm">Compose</LpButton>
    <LpButton v-hint="'demo.archive'" variant="outline" size="sm">Archive</LpButton>
  </div>
  <LpHintExample hint="demo.flagged">
    <div class="w-72 rounded-control border border-line px-3 py-2 text-sm">Flagged: "Can you check the invoice?"</div>
  </LpHintExample>
  <LpContextMenu :items="[{ label: 'Reply', icon: 'lucide:reply' }, { label: 'Archive', icon: 'lucide:archive' }]">
    <div class="w-72 rounded-control border border-line px-3 py-2 text-sm">A message row: it has a right-click menu</div>
  </LpContextMenu>
  <div class="flex gap-2">
    <LpButton size="sm" @click="system.startTour('demo')">Take the tour</LpButton>
    <LpButton size="sm" variant="ghost" @click="reset">Reset as a new user</LpButton>
  </div>
  <p class="text-xs text-muted">Habit tips appear on their own after the usage below; these buttons fake it so you can see one now (dismiss the tour offer first, one interruption per session).</p>
  <div class="flex flex-wrap gap-2">
    <LpButton size="sm" variant="outline" @click="habit(signals.menuButton, 5)">Pretend I keep using "…" and never right-click</LpButton>
    <LpButton size="sm" variant="outline" @click="habit(signals.navigate, 15)">Pretend I walk the menu and never open the palette</LpButton>
  </div>
  <LpHints :system="system" />
</div>`,
    thumb: `<div class="flex flex-col items-center gap-3">
  <div class="flex gap-2">
    <LpButton variant="outline" size="sm">Inbox</LpButton>
    <span class="relative inline-flex">
      <LpButton variant="outline" size="sm">Archive</LpButton>
      <span class="absolute -right-1 -top-1 size-2 rounded-full bg-brand ring-2 ring-surface" />
    </span>
  </div>
  <div class="flex w-64 items-center gap-3 rounded-card border border-line bg-surface-overlay p-3 text-sm text-ink shadow-panel">
    <LpIcon name="lucide:sparkles" :size="16" class="shrink-0 text-brand" />
    <span class="min-w-0 flex-1 text-xs">New here? A quick tour of this page.</span>
    <LpButton size="xs">Start</LpButton>
  </div>
</div>`,
  },
  {
    id: "hint-layer",
    name: "HintLayer",
    description:
      "Quiet \"new\" dots over `v-hint` controls: something changed here, or the user just gained access to it. Nothing pops up by itself; the note opens when the pointer or focus reaches the control, and `read` fires when the user dismisses it or simply uses the control. At most `limit` dots show at once, most important first. The app decides what counts as new from the registry's `seen` and `used` events.",
    components: { LpHintLayer, LpButton },
    state: () =>
      reactive({
        fresh: ["demo.activity", "demo.remind"],
        notes: {
          "demo.activity": { title: "Activity column", text: "Weekly quota progress for each person." },
          "demo.remind": { title: "Remind everyone", text: "Messages everyone who has not set their hours." },
        },
      }),
    template: `<div class="flex flex-col items-start gap-3">
  <div class="flex flex-wrap gap-3">
    <LpButton v-hint="'demo.activity'" variant="outline" size="sm">Activity</LpButton>
    <LpButton v-hint="'demo.remind'" variant="outline" size="sm">Remind everyone</LpButton>
  </div>
  <LpButton size="sm" variant="ghost" @click="fresh = ['demo.activity', 'demo.remind']">Mark as new again</LpButton>
  <LpHintLayer :fresh="fresh" :notes="notes" @read="(id) => fresh = fresh.filter((x) => x !== id)" />
</div>`,
    thumb: `<div class="flex flex-col items-start gap-2">
  <span class="relative inline-flex">
    <LpButton variant="outline" size="sm">Activity</LpButton>
    <span class="absolute -right-1 -top-1 size-2 rounded-full bg-brand ring-2 ring-surface" />
  </span>
  <div class="w-60 rounded-card border border-line bg-surface-overlay p-3 text-sm text-ink shadow-panel">
    <p class="m-0 flex items-center gap-2 font-medium"><span class="rounded-full bg-brand/15 px-1.5 text-[11px] text-brand">New</span>Activity column</p>
    <p class="m-0 mt-1 text-xs text-muted">Weekly quota progress for each person.</p>
    <div class="mt-2 flex justify-end"><LpButton size="xs" variant="ghost">Got it</LpButton></div>
  </div>
</div>`,
  },
]
