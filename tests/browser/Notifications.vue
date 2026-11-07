<script setup lang="ts">
import { reactive, ref } from "vue"
import { LpNotificationBell, LpNotificationFeed, type NotificationItem } from "../../src"

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const log = ref<string[]>([])
let release: (() => void) | undefined

const items = reactive<NotificationItem[]>([
  {
    id: "req",
    title: "Anna requested access",
    body: "Read-only access to ger-01-p.",
    actor: { name: "Anna Petrova" },
    icon: "lucide:key-round",
    tone: "warning",
    category: "requests",
    createdAt: ago(60_000),
    read: false,
    actions: [
      {
        label: "Approve",
        variant: "primary",
        onSelect: () =>
          new Promise<void>((done) => {
            release = () => {
              items[0]!.outcome = "Approved"
              done()
            }
          }),
      },
      { label: "Decline" },
    ],
  },
  { id: "cert", title: "Certificate expiring", body: "Renews in 3 days.", icon: "lucide:shield-alert", tone: "danger", createdAt: ago(2 * 3_600_000), read: false },
  { id: "old", title: "Invoice available", icon: "lucide:receipt-text", createdAt: ago(5 * 86_400_000), read: true },
])

function on(name: string) {
  return (arg?: unknown) => log.value.push(`${name}:${typeof arg === "string" ? arg : ((arg as NotificationItem | undefined)?.id ?? "")}`)
}
function markRead(id: string) {
  on("markRead")(id)
  const n = items.find((x) => x.id === id)
  if (n) n.read = true
}
function markUnread(id: string) {
  on("markUnread")(id)
  const n = items.find((x) => x.id === id)
  if (n) n.read = false
}
function dismiss(id: string) {
  on("dismiss")(id)
  const at = items.findIndex((x) => x.id === id)
  if (at >= 0) items.splice(at, 1)
}
</script>

<template>
  <div class="flex min-h-dvh items-start gap-8 bg-surface p-6 text-ink">
    <LpNotificationBell
      :items="items"
      :categories="[{ value: 'requests', label: 'Requests' }]"
      all-link="#all"
      @mark-read="markRead"
      @mark-unread="markUnread"
      @dismiss="dismiss"
      @select="on('select')($event)"
      @action="(item) => on('action')(item)"
      @settings="on('settings')()"
    />
    <div data-testid="page" class="ml-96 w-[26rem] rounded-card border border-line bg-surface-raised">
      <LpNotificationFeed
        :items="items"
        :max-height="false"
        has-more
        @mark-read="markRead"
        @mark-unread="markUnread"
        @dismiss="dismiss"
        @action="(item) => on('action')(item)"
        @load-more="on('loadMore')()"
      />
    </div>
    <button type="button" data-testid="release" @click="release?.()">release</button>
    <output data-testid="log">{{ log.join(" ") }}</output>
  </div>
</template>
