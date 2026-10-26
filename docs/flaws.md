# Flaws and ideas

What working with the kit in its consumers (the BotEco panel, Cursio, the
launcher) turned up and is not fixed yet, and what would make it stronger.
Each entry says where it showed, what goes wrong and what the fix is. A fixed
entry is deleted, not ticked: the commit says what changed.

## Flaws

- **LpRollingText rolls the whole string when part of it changed.** A badge
  reading "Valid for 2:54" re-rolled every word once a second (Cursio pairing
  countdown), so the whole badge flickered. Roll only what differs: keep the
  common prefix and suffix still and roll the middle. LpBadge feeds plain text
  through it, so every badge with a counter in its text has this.
- **LpContextMenu and LpHoverCard cannot wrap each other.** Both render a
  fragment, and an `as-child` trigger cannot take a fragment, so a row with a
  menu and a card needs a wrapping element (LpSidebarRow, LpColorPicker carry
  one). Let one of them forward `as-child` to its own trigger, or offer an
  element root.
- **The palette hides its commands while an async search runs.** With
  `search` set, typing showed only "Searching…" until the search answered
  (several seconds in the BotEco panel), though the static commands already
  matched. Show the command matches at once and append the async hits.
- **LpStat does not pass `animateOnMount` to its LpNumberFlow.** A tile always
  counts up from zero, so a screenshot taken right after render shows 0.
- **Kit props are loose in consumers.** A misspelt prop (`text` for
  `content` on LpTooltip, `categories` for `labels` on LpChart) falls through
  as an attribute with no error, and vue-tsc in the app does not catch it.
  Ship prop types consumers check, or warn in dev on an unknown prop of a kit
  component.
- **LpSegmented stretches to its parent in a column.** In a `flex-col` it
  fills the width and leaves its options on the left of an empty bar (the
  theme studio had to add `self-start`). Its natural width should be its
  content's.
- **LpOtpInput has no group separator.** An eight-character code shown as
  ABCD-EFGH is entered into eight cells with nothing between the halves
  (Cursio pairing). A `group` prop (4 → a gap or dash every four cells).
- **The compact sidebar loses its search.** `searchable` hides the field in
  the icon rail with nothing in its place.
- **Two palette browser tests time out now and then under the full run.**
  "a completed async action offers its declared undo" and "sigils expose
  providers and preview actions are clickable" fail about one run in five with
  all workers busy and pass alone. Something in them waits on timing rather
  than on a state; find it, rather than raising the timeout.

## Ideas

- **Busy rows**: a row shows a thin progress bar or spinner while work started
  on its page runs (a publish, a deploy), so leaving the page does not hide it.
- **Context switcher in the rail header**: server, workspace or machine, which
  every app now draws in the header slot itself.
- **Reorder pins** by dragging within the pinned block, and pin by dragging a
  row into it.
