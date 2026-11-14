<script setup lang="ts">
import { ref } from "vue"
import { LpButton, LpContextMenu, LpHoverCard, LpPopover, LpSwitch, LpTooltip } from "../../src"

const on = ref(true)

const menu = [{ label: "Copy", onSelect: () => {} }]
const menuState = ref(false)
const rowMenu = [{ label: "Row action", onSelect: () => {} }]
</script>

<!-- A popover's trigger around another kit trigger: the outer one's id, ARIA
     state and click must reach the button through the inner one. -->
<template>
  <main class="flex gap-4 p-6">
    <LpPopover>
      <template #trigger>
        <LpContextMenu :items="menu"><LpButton>Through a menu</LpButton></LpContextMenu>
      </template>
      <p>Body of the menu one</p>
    </LpPopover>
    <LpPopover>
      <template #trigger>
        <LpTooltip content="Tip"><LpButton>Through a tooltip</LpButton></LpTooltip>
      </template>
      <p>Body of the tooltip one</p>
    </LpPopover>
    <LpPopover>
      <template #trigger>
        <LpHoverCard><template #trigger><LpButton>Through a hover card</LpButton></template>Card</LpHoverCard>
      </template>
      <p>Body of the hover card one</p>
    </LpPopover>
    <LpTooltip content="Deploys on a new image">
      <LpSwitch v-model="on" label="Autopilot" />
    </LpTooltip>
    <LpHoverCard :open-delay="0">
      <template #trigger>
        <LpContextMenu :items="menu"><LpButton>Card over a menu</LpButton></LpContextMenu>
      </template>
      <p>Card over the menu</p>
    </LpHoverCard>
    <LpContextMenu :items="menu">
      <LpHoverCard :open-delay="0">
        <template #trigger><LpButton>Menu over a card</LpButton></template>
        <p>Card under the menu</p>
      </LpHoverCard>
    </LpContextMenu>
    <LpContextMenu :items="rowMenu">
      <div class="flex gap-2 p-2">
        <LpContextMenu :items="menu">
          <LpHoverCard :open-delay="0">
            <template #trigger><LpButton>Card in a menu row</LpButton></template>
            <p>Card in the row</p>
          </LpHoverCard>
        </LpContextMenu>
      </div>
    </LpContextMenu>
    <LpContextMenu :items="menu" @update:open="menuState = $event"><LpButton>Reports its state</LpButton></LpContextMenu>
    <p data-testid="menu-state">{{ menuState ? "open" : "closed" }}</p>
  </main>
</template>
