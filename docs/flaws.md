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
- **Kit props are loose in consumers.** A misspelt prop (`text` for
  `content` on LpTooltip, `categories` for `labels` on LpChart) falls through
  as an attribute with no error, and vue-tsc in the app does not catch it.
  Ship prop types consumers check, or warn in dev on an unknown prop of a kit
  component.
- **Palette browser tests time out now and then under the full run.** "a
  completed async action offers its declared undo", "sigils expose providers
  and preview actions are clickable" and "an input step validates before
  executing and keeps the query separate" each fail about one run in five with
  all workers busy and pass alone. Three tests of one component point at
  something they share (the debounce, the open animation, the example frame)
  waiting on time rather than on a state; find it, rather than raising the
  timeout.

## Ideas

- **Context switcher in the rail header**: server, workspace or machine, which
  every app now draws in the header slot itself.
- **Reorder pins** by dragging within the pinned block, and pin by dragging a
  row into it.
