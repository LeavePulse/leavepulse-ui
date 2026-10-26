# Flaws and ideas

What working with the kit in its consumers (the BotEco panel, Cursio, the
launcher) turned up and is not fixed yet, and what would make it stronger.
Each entry says where it showed, what goes wrong and what the fix is. A fixed
entry is deleted, not ticked: the commit says what changed.

## Flaws

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

## Ideas

- **Context switcher in the rail header**: server, workspace or machine, which
  every app now draws in the header slot itself.
- **Reorder pins** by dragging within the pinned block, and pin by dragging a
  row into it.
