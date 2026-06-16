# @leavepulse/ui

Token-driven Vue 3 component kit for LeavePulse — components on [reka-ui](https://reka-ui.com)
and [Tailwind CSS v4](https://tailwindcss.com), a runtime theme engine (themes are
JSON token sets), and a composable block-layout canvas.

## Install

The kit is consumed by the LeavePulse apps via a `file:`/git dependency. It needs
the peer deps it declares (`vue`, `reka-ui`, `tailwindcss`, `tailwind-variants`,
`tailwind-merge`, `motion-v`, `@iconify/vue`).

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

## Develop

```bash
bun install          # also builds dist via the prepare hook
bun run dev          # live preview/playground on http://127.0.0.1:4500
bun run build        # type-check + build the library to dist/
bun run dev:dist     # rebuild dist on change (for a linked consumer)
```

`dist/` is generated, not committed — the `prepare` hook rebuilds it on install so
any consumer gets a fresh build.
