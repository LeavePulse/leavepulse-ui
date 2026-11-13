# LpShift: `resizing` leaves the slot (0.96.0)

`LpShift` no longer passes `resizing` to its default slot. Reading it in the
template made the start and the end of every tween render the whole slot
again, which around a table re-rendered every row and had TransitionGroup
measure each one (7117c12).

A consumer that read it from the slot reads it through a ref instead; the
component still exposes it with `defineExpose({ resizing })`:

```vue
<!-- before -->
<LpShift v-slot="{ resizing }" axis="width">
  <div :class="resizing ? 'flex-nowrap' : 'flex-wrap'">…</div>
</LpShift>

<!-- after -->
<script setup lang="ts">
const shift = useTemplateRef<InstanceType<typeof LpShift>>("shift")
</script>
<LpShift ref="shift" axis="width">
  <div :class="shift?.resizing ? 'flex-nowrap' : 'flex-wrap'">…</div>
</LpShift>
```

Read that way, only the consumer's own render follows the tween, as it chose
to; content that does not read it is no longer rendered again.

Known consumer at the time of the change: BotEco panel `views/Branches.vue`.
