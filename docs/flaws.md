# Flaws and ideas

What working with the kit in its consumers (the BotEco panel, Cursio, the
launcher) turned up and is not fixed yet, and what would make it stronger.
Each entry says where it showed, what goes wrong and what the fix is. A fixed
entry is deleted, not ticked: the commit says what changed.

## Flaws

- **A height cap on `LpVideoPlayer` hides its controls.** Without `fit` the
  frame takes the full width at the video's own proportions, so a
  `max-h-96` on the player (the BotEco case evidence did this) cuts the
  frame's bottom off together with the bar: no play, volume or seek, and
  nothing says why. The consumer switched to `fit` inside a sized box. The
  kit should either honour a max height in the default mode (cap the frame
  and letterbox the picture) or say in the docs that a height belongs to
  `fit`.

- **Forward onto an overlay entry is a router visit.** With overlay history
  on, Back from a kit entry mutes the router, but Forward starts from the
  router's own entry, so vue-router runs its guards and `afterEach` for the
  page it is already on (nothing remounts). Engines differ on listener order
  on `window`, so the kit cannot stop that pop before the router sees it.
  Marking the router's entry as well would let the kit mute it there too,
  but Back from that entry to an earlier page would then reach the router
  replayed, with its scroll key off by one.

- **`shift.pw.ts` › "a header action leaving fades where it stood" failed
  once on CI** (run for 80c5bd6): the ghost was first seen 8 px from where
  the action stood, at the test's limit of under 8; the rerun passed, and 20
  local runs passed. The page's MutationObserver reads the ghost a frame or two
  into its fade on a slow runner. Read its place from the clone's own style
  (it is placed there, then animated) rather than its box, or widen the limit.

- **`patterns.pw.ts` › "loading example reserves the content and action
  geometry" fails on CI now and then:** the action button is caught at x 16
  instead of 707 for one read, then the rerun passes. It failed on both the
  v0.77.0 and v0.77.1 runs and never locally against the preview. Likely the
  button is measured mid-mount of the example frame, before the row lays out.

- **`LpTopologyCanvas` and its parts, found redrawing control-panel's
  network map:**
  - `LpWaypointEdge` does not declare Vue Flow's edge props, so Vue warns in
    dev for every edge; the app falls back to plain beziers.
  - The lane node takes the pointer, so an edge inside a lane cannot be
    right-clicked; the app turns pointer events off on lanes by class.
  - The canvas cancels `contextmenu` and has no node/edge menu prop, so
    LpContextMenu cannot open on a node or edge; the app replays the event.
  - The built-in search cannot be controlled (no v-model, no initial query)
    and does not match edge labels, so a linkable `?q=` needs its own box.
  - Neighbour highlight cannot be cleared from outside and stays on a node
    that is no longer drawn.
  - `minZoom` (fixed 0.3) and zoom on double click are not props; a wide
    graph cannot be framed on a phone.
  - `layeredLayout` does not route long edges around nodes, and edge labels
    are placed without avoiding each other, so where edges bunch their
    labels overprint ("e wireguard e").

- **The nightly Firefox and WebKit run is red on its own.** WebKit fails
  about 45 tests and Firefox about 12 every night, so a new failure there
  hides among old ones. Most of the WebKit ones are the page-error fixture
  catching "ResizeObserver loop completed with undelivered notifications",
  which WebKit raises where Chromium does not; which table or sidebar tests
  it hits changes from run to run. The fix is to ignore that one message in
  `tests/browser/fixtures.ts` (it is not a kit error) and then fix or mark
  the rest, so the run goes green and a new failure stands out. On the
  0.88.0 run Firefox also failed "a fitted player in full screen fills the
  screen instead of going black" once; whether it repeats is unknown.
- **The phone pass left open items.** LpTable's column-resize handle is 6px
  wide, and a wider hit area would take taps from the header sort buttons.
  LpDrawer's top and bottom size is `94vh`, where `dvh` is safer on iOS.
  The LayoutCanvas splitter has no `touch-action`. LpVideoPlayer's seek bar
  is 16px tall on touch. Search, tags and palette fields have no
  `enterkeyhint` or `inputmode`. None of the kit has been tried on a real
  iPhone or Android.

- **Two gestures are still the libraries', not the kit's.** Bottom and top
  sheets (`LpDrawer` with `direction="bottom"`/`"top"`) drag to close and snap
  through vaul, and toasts swipe away through reka's toast. Both decide
  thresholds and velocity their own way, so a sheet and a side drawer do not
  close alike. Moving sheets onto the gesture engine means doing snap points
  ourselves (vaul's `--snap-point-height` maths); the toast needs its swipe
  replaced while keeping reka's announcements and timers.
- **The touch "hold, then drag" in `LpRangeCalendar` and `usePaintSelect` is
  still two copies.** They share the engine's constants (`HOLD_TO_DRAG_MS`,
  `TOUCH_SLOP`) but each keeps its own timer, slop check and non-passive
  touchmove. A `holdToDrag` option on `useGesture` (hold, then capture and stop
  the page scrolling) would cover both.
- **A touch's pointer capture moved to another element was dropped a frame
  later in Chromium** (seen on the drawer panel, whose `touch-action` is none
  while the text under the finger is `pan-y`). `useGesture` therefore leaves a
  touch on its implicit capture and only captures a mouse or pen. If a gesture
  on a touch ever needs to follow the finger off its element, find out why.
- **The header actions of `LpAppShell` scroll and fade but have no edge
  buttons**: they are an `LpShift`, which animates its width, so they take
  `useScrollStrip` directly rather than the `LpScrollStrip` frame.
- **The scroll strip's wheel on a snapping row is the browser's smooth
  `scrollBy`**, so quick notches there restart rather than add up as they do on
  a row without snap; adding them up means choosing the snap point ourselves.
- **WebKit was not run locally for the gesture and strip tests** (Playwright's
  WebKit does not start on this machine); CI's nightly cross-browser run is the
  first to see them there.

## Ideas

- **A group order on `LpTable`.** Groups follow the first row of each after
  sorting, so a table grouped by kind (control-panel's services) shows its
  sections in whatever order the sort leaves them, and the app can only
  pre-sort the rows and drop the default sort to get its order back. A
  `groupOrder` (a list, or a compare on the group values) would let the
  sections stay put while rows sort inside them.
- **Context switcher in the rail header**: server, workspace or machine, which
  every app now draws in the header slot itself.
- **Reorder pins** by dragging within the pinned block, and pin by dragging a
  row into it.
- **Call the viewer back to a hidden tab** (`useAttention`): a system
  notification when permission is granted plus a flashing tab title until the
  tab regains focus, nothing while it is focused. BotEco's panel has it as
  `lib/attention.ts` for a resumed quiz; any app with a live wait wants it.
- **No windowed list outside LpTable** (`LpVirtualList`): only the `rowWindow`
  maths is exported, and LpTable with `virtualRowHeight` is a paged table, not a
  list with infinite load. BotEco's inbox (thousands of dialogs) builds its list on
  `rowWindow` and draws skeleton rows for the unloaded tail by hand; a list
  component with fixed row height, a `total`, a slot per row and an
  "unloaded row" slot would cover it. LpSelect also renders every option (1000
  account options open fine, but there is no windowing either).
