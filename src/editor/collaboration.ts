/*
 * One shared document over the standard Yjs websocket protocol, the one
 * y-websocket and pycrdt-websocket speak, so any of their servers will do.
 * Edits made offline are kept in IndexedDB and merged when the link returns:
 * Yjs merges, nothing is overwritten. Where websockets are blocked (a proxy,
 * a corporate network), an optional HTTP fallback polls the same document, so
 * the text still loads and edits still reach the server.
 */
import { onScopeDispose, readonly, ref, shallowRef, type Ref } from "vue"
import type { Awareness } from "y-protocols/awareness"
import { IndexeddbPersistence } from "y-indexeddb"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

export interface CollaboratorIdentity {
  /** Stable id (an account id): one person in two tabs is shown once. */
  id: string
  name: string
  color: string
  avatar?: string
}

export interface Collaborator extends CollaboratorIdentity {
  clientId: number
  self: boolean
}

export type CollaborationStatus = "connecting" | "connected" | "polling" | "offline"

/** Plain HTTP stand-in for the websocket: the text loads and edits are saved, presence is not shared. */
export interface CollaborationFallback {
  /** The server's changes this copy lacks, given its state vector (an empty update when there are none). */
  pull: (stateVector: Uint8Array) => Promise<Uint8Array>
  /** Send local changes. Leave it out for a read-only viewer. */
  push?: (update: Uint8Array) => Promise<void>
  /** How long the websocket gets to sync before polling starts, ms. */
  after?: number
  /** Polling interval, ms. */
  every?: number
}

export interface CollaborationOptions {
  /** Websocket base, `wss://host/path`; the room name is appended as a path segment. */
  url: string
  room: string
  user: CollaboratorIdentity
  /** Query parameters the server reads (a token, a document version). */
  params?: Record<string, string>
  /** Keep a local copy in IndexedDB (on by default). */
  offline?: boolean
  /** Poll over HTTP while the websocket cannot sync. */
  fallback?: CollaborationFallback
}

/** What the editor needs from a transport: the presence channel. A WebsocketProvider is one. */
export interface CollaborationProvider {
  awareness: Awareness
}

export interface Collaboration {
  document: Y.Doc
  provider: CollaborationProvider
  user: CollaboratorIdentity
  status: Readonly<Ref<CollaborationStatus>>
  /** The server's copy has been received at least once. */
  synced: Readonly<Ref<boolean>>
  /** Everyone in the document, the viewer first, one entry per person. */
  peers: Readonly<Ref<Collaborator[]>>
  destroy: () => void
}

/** Collaborators in a presence channel, one entry per person, the viewer first. */
export function collaboratorsOf(awareness: Awareness, self: number): Collaborator[] {
  const seen = new Map<string, Collaborator>()
  for (const [clientId, state] of awareness.getStates()) {
    const user = (state as { user?: CollaboratorIdentity }).user
    if (!user) continue
    const mine = clientId === self
    if (!seen.has(user.id) || mine) seen.set(user.id, { ...user, clientId, self: mine })
  }
  return [...seen.values()].sort((a, b) => Number(b.self) - Number(a.self))
}

export function useCollaboration(options: CollaborationOptions): Collaboration {
  const document = new Y.Doc()
  const local = options.offline === false ? null : new IndexeddbPersistence(`lp-editor:${options.room}`, document)
  const provider = new WebsocketProvider(options.url, options.room, document, { params: options.params })
  const status = ref<CollaborationStatus>("connecting")
  const synced = ref(false)
  const peers = shallowRef<Collaborator[]>([])

  let destroyed = false
  const fallback = options.fallback
  const polled = Symbol("fallback")
  let live = false
  let polling = false
  let busy = false
  let pending: Uint8Array[] = []
  let poller: ReturnType<typeof setInterval> | undefined
  let waiter: ReturnType<typeof setTimeout> | undefined

  const tick = async () => {
    if (!fallback || busy || destroyed || !polling) return
    busy = true
    try {
      if (pending.length && fallback.push) {
        const batch = Y.mergeUpdates(pending)
        pending = []
        try {
          await fallback.push(batch)
        } catch (error) {
          pending.unshift(batch)
          throw error
        }
      }
      const update = await fallback.pull(Y.encodeStateVector(document))
      if (destroyed || !polling) return
      if (update.byteLength > 2) Y.applyUpdate(document, update, polled)
      synced.value = true
      status.value = "polling"
    } catch {
      if (polling && !destroyed) status.value = "offline"
    } finally {
      busy = false
    }
  }
  const startPolling = () => {
    if (!fallback || polling || live || destroyed) return
    polling = true
    if (fallback.push) pending.push(Y.encodeStateAsUpdate(document))
    void tick()
    poller = setInterval(() => void tick(), fallback.every ?? 3000)
  }
  const stopPolling = () => {
    polling = false
    pending = []
    clearInterval(poller)
  }
  const wait = () => {
    if (!fallback || polling || waiter !== undefined) return
    waiter = setTimeout(() => {
      waiter = undefined
      startPolling()
    }, fallback.after ?? 5000)
  }
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (polling && fallback?.push && origin !== polled && origin !== provider) pending.push(update)
  }
  document.on("update", onUpdate)

  provider.awareness.setLocalStateField("user", options.user)
  provider.on("status", ({ status: next }: { status: string }) => {
    if (next !== "connected") {
      live = false
      wait()
    }
    if (polling) return
    status.value = next === "connected" ? "connected" : next === "connecting" ? "connecting" : "offline"
  })
  provider.on("sync", (done: boolean) => {
    if (!done) return
    live = true
    synced.value = true
    clearTimeout(waiter)
    waiter = undefined
    stopPolling()
    status.value = "connected"
  })
  wait()
  const refresh = () => (peers.value = collaboratorsOf(provider.awareness, document.clientID))
  provider.awareness.on("change", refresh)
  refresh()

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    stopPolling()
    clearTimeout(waiter)
    document.off("update", onUpdate)
    provider.awareness.off("change", refresh)
    provider.destroy()
    void local?.destroy()
    document.destroy()
  }
  onScopeDispose(destroy)
  return { document, provider, user: options.user, status: readonly(status), synced: readonly(synced), peers: readonly(peers) as Readonly<Ref<Collaborator[]>>, destroy }
}
