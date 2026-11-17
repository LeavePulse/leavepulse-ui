import { expect, test } from "bun:test"
import { effectScope } from "vue"
import * as Y from "yjs"
import { useCollaboration, type Collaboration, type CollaborationFallback } from "../src/editor/collaboration"

const user = { id: "ann", name: "Ann", color: "#00bcff" }
const settle = (ms: number) => new Promise((done) => setTimeout(done, ms))

function server(text: string) {
  const doc = new Y.Doc()
  doc.getText("t").insert(0, text)
  const fallback: CollaborationFallback = {
    pull: async (vector) => Y.encodeStateAsUpdate(doc, vector),
    push: async (update) => Y.applyUpdate(doc, update),
    after: 30,
    every: 20,
  }
  return { doc, fallback }
}

function open(fallback: CollaborationFallback): Collaboration {
  let made: Collaboration | undefined
  effectScope().run(() => {
    made = useCollaboration({ url: "ws://127.0.0.1:9", room: "doc", user, offline: false, fallback })
  })
  return made!
}

test("without a websocket the text still loads over the fallback", async () => {
  const { fallback } = server("hello")
  const link = open(fallback)
  await settle(120)
  expect(link.synced.value).toBe(true)
  expect(link.status.value).toBe("polling")
  expect(link.document.getText("t").toString()).toBe("hello")
  link.destroy()
})

test("edits made while polling reach the server, and the server's reach the viewer", async () => {
  const { doc, fallback } = server("ab")
  const link = open(fallback)
  await settle(120)
  link.document.getText("t").insert(2, "c")
  doc.getText("t").insert(0, ">")
  await settle(120)
  expect(doc.getText("t").toString()).toBe(">abc")
  expect(link.document.getText("t").toString()).toBe(">abc")
  link.destroy()
})

test("a viewer without push only reads", async () => {
  const { doc, fallback } = server("x")
  const link = open({ ...fallback, push: undefined })
  await settle(120)
  link.document.getText("t").insert(1, "y")
  await settle(80)
  expect(doc.getText("t").toString()).toBe("x")
  link.destroy()
})

test("a failed push is kept and sent on the next tick", async () => {
  const { doc, fallback } = server("")
  let fail = true
  const link = open({ ...fallback, push: async (update) => { if (fail) throw new Error("down"); Y.applyUpdate(doc, update) } })
  await settle(80)
  link.document.getText("t").insert(0, "kept")
  await settle(80)
  expect(link.status.value).toBe("offline")
  fail = false
  await settle(120)
  expect(doc.getText("t").toString()).toBe("kept")
  link.destroy()
})
