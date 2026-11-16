<script setup lang="ts">
import { LpRichEditor } from "../../../src/editor"
import { linkedCollaborations } from "./linked"

const [ann, ben] = linkedCollaborations([
  { id: "ann", name: "Ann", color: "#00bcff" },
  { id: "ben", name: "Ben", color: "#f0b35a" },
])
</script>

<template>
  <div class="grid gap-3 lg:grid-cols-2">
    <div v-for="link in [ann, ben]" :key="link!.user.id" class="overflow-hidden rounded-card border border-line">
      <p class="border-b border-line px-3 py-1.5 text-xs text-muted">{{ link!.user.name }}</p>
      <LpRichEditor :collaboration="link" class="max-h-[420px] overflow-y-auto" />
    </div>
  </div>
</template>
