import { expect, test } from "bun:test"
import { createApp, effectScope, ref } from "vue"
import { useCloseGuard } from "../src/composables/useCloseGuard"

function guarded(answer: () => Promise<boolean>) {
  const open = ref(true)
  const guard = useInApp(() => useCloseGuard(() => answer, open))
  return { open, ...guard }
}

// onBeforeUnmount has no component here and says so; the watchers are what counts.
function useInApp<T>(setup: () => T): T {
  const warn = console.warn
  console.warn = () => {}
  try {
    return createApp({}).runWithContext(() => effectScope().run(setup)!)
  } finally {
    console.warn = warn
  }
}

function deferred() {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>((r) => (resolve = r))
  return { promise, resolve }
}

test("an answer given while the window stayed open stands", async () => {
  const answer = deferred()
  const { allowClose } = guarded(() => answer.promise)
  const asked = allowClose()
  answer.resolve(true)
  expect(await asked).toBe(true)
})

test("a yes about a window that closed and reopened does not close the new one", async () => {
  const answer = deferred()
  const { allowClose, open } = guarded(() => answer.promise)
  const asked = allowClose()
  open.value = false
  open.value = true
  answer.resolve(true)
  expect(await asked).toBe(false)
})

test("only one question at a time, and the next may ask again", async () => {
  let answer = deferred()
  const { allowClose } = guarded(() => answer.promise)
  const first = allowClose()
  expect(await allowClose()).toBe(false)
  answer.resolve(false)
  expect(await first).toBe(false)
  answer = deferred()
  const second = allowClose()
  answer.resolve(true)
  expect(await second).toBe(true)
})
