# Repeater migration

`control-panel-repeater.patch` converts the ports and volumes in
`control-panel/src/components/infra/ServiceSpecCard.vue` to `LpRepeater`.
It removes the four add/remove handlers and the duplicated list controls,
while preserving the fields, validation, conflict warnings and DTO conversion.

The panel currently pins `@leavepulse/ui` to `0.29.4`. Apply this patch only
after upgrading it to a release containing `LpRepeater`; that installed version
does not export the new component. No package version or registry release is
changed by this migration.

From the control-panel repository:

```sh
git apply --check ../leavepulse-ui/docs/migrations/control-panel-repeater.patch
git apply ../leavepulse-ui/docs/migrations/control-panel-repeater.patch
bun run typecheck
```

The patch was checked against the current panel source and its Vue script and
template compiled locally. The same ports/volumes composition is available in
the kit preview at `/component/repeater`. The panel's complete type check still
needs to run after its dependency is upgraded and the patch is applied.
