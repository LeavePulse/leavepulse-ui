/*
 * Two in-page collaborators wired to each other without a server: document
 * updates and presence are relayed between them, the way a websocket room
 * would. Only for the preview, where there is no backend to join.
 */
import { onBeforeUnmount, readonly, ref, shallowRef } from "vue"
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"
import { collaboratorsOf, type Collaboration, type CollaboratorIdentity } from "../../../src/editor"

export function linkedCollaborations(users: CollaboratorIdentity[], seed?: (document: Y.Doc) => void): Collaboration[] {
  const docs = users.map(() => new Y.Doc())
  const presences = docs.map((document) => new Awareness(document))
  docs.forEach((document, index) => {
    document.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "relay") return
      docs.forEach((other, at) => at !== index && Y.applyUpdate(other, update, "relay"))
    })
    presences[index]!.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === "relay") return
      const update = encodeAwarenessUpdate(presences[index]!, [...added, ...updated, ...removed])
      presences.forEach((other, at) => at !== index && applyAwarenessUpdate(other, update, "relay"))
    })
  })
  if (seed) seed(docs[0]!)
  const out = users.map((user, index) => {
    const awareness = presences[index]!
    const peers = shallowRef(collaboratorsOf(awareness, docs[index]!.clientID))
    awareness.on("change", () => (peers.value = collaboratorsOf(awareness, docs[index]!.clientID)))
    awareness.setLocalStateField("user", user)
    return {
      document: docs[index]!,
      provider: { awareness },
      user,
      status: readonly(ref("connected" as const)),
      synced: readonly(ref(true)),
      peers: readonly(peers),
      destroy: () => {
        awareness.destroy()
        docs[index]!.destroy()
      },
    } as Collaboration
  })
  onBeforeUnmount(() => out.forEach((link) => link.destroy()))
  return out
}
