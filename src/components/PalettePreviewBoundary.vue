<script setup lang="ts">
import { suppressPaletteDiscovery } from "../composables/usePaletteCommands"
suppressPaletteDiscovery()
</script>
<template><div data-lp-command-preview class="contents"><slot /></div></template>
