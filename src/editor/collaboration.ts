/*
 * One shared document over the standard Yjs websocket protocol, the one
 * y-websocket and pycrdt-websocket speak, so any of their servers will do.
 * Edits made offline are kept in IndexedDB and merged when the link returns:
 * Yjs merges, nothing is overwritten.
 */
import { onBeforeUnmount, readonly, ref, shallowRef, type Ref } from "vue"
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

export type CollaborationStatus = "connecting" | "connected" | "offline"

export interface CollaborationOptions {
  /** Websocket base, `wss://host/path`; the room name is appended as a path segment. */
  url: string
  room: string
  user: CollaboratorIdentity
  /** Query parameters the server reads (a token, a document version). */
  params?: Record<string, string>
  /** Keep a local copy in IndexedDB (on by default). */
  offline?: boolean
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

  provider.awareness.setLocalStateField("user", options.user)
  provider.on("status", ({ status: next }: { status: string }) => {
    status.value = next === "connected" ? "connected" : next === "connecting" ? "connecting" : "offline"
  })
  provider.on("sync", (done: boolean) => {
    if (done) synced.value = true
  })
  const refresh = () => (peers.value = collaboratorsOf(provider.awareness, document.clientID))
  provider.awareness.on("change", refresh)
  refresh()

  let destroyed = false
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    provider.awareness.off("change", refresh)
    provider.destroy()
    void local?.destroy()
    document.destroy()
  }
  onBeforeUnmount(destroy)
  return { document, provider, user: options.user, status: readonly(status), synced: readonly(synced), peers: readonly(peers) as Readonly<Ref<Collaborator[]>>, destroy }
}
