import { expect, test } from "bun:test"
import { effectScope } from "vue"
import { useAsyncTask } from "../src/composables/useAsyncTask"

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test("a late first answer does not overwrite a newer one, and its signal is aborted", async () => {
  const task = useAsyncTask<string>()
  const applied: string[] = []
  const first = deferred<string>()
  const second = deferred<string>()
  let firstSignal!: AbortSignal
  task.run((signal) => ((firstSignal = signal), first.promise), { apply: (v) => applied.push(v) })
  await tick()
  task.run(() => second.promise, { apply: (v) => applied.push(v) })
  await tick()
  second.resolve("new")
  await tick()
  first.resolve("old")
  await tick()
  expect(applied).toEqual(["new"])
  expect(firstSignal.aborted).toBe(true)
  expect(task.pending.value).toBe(false)
})

test("an error from a superseded run stays unseen", async () => {
  const task = useAsyncTask<string>()
  const failed: unknown[] = []
  const first = deferred<string>()
  task.run(() => first.promise, { apply: () => {}, fail: (e) => failed.push(e) })
  await tick()
  task.run(() => "fresh", { apply: () => {}, fail: (e) => failed.push(e) })
  await tick()
  first.reject(new Error("stale"))
  await tick()
  expect(failed).toEqual([])
})

test("the latest error reaches fail and clears pending", async () => {
  const task = useAsyncTask<string>()
  const failed: unknown[] = []
  const error = new Error("down")
  task.run(() => Promise.reject(error), { apply: () => {}, fail: (e) => failed.push(e) })
  expect(task.pending.value).toBe(true)
  await tick()
  await tick()
  expect(failed).toEqual([error])
  expect(task.pending.value).toBe(false)
})

test("cancel inside the debounce never starts the task", async () => {
  const task = useAsyncTask<string>()
  let started = false
  task.run(() => ((started = true), "x"), { delay: 1, apply: () => {} })
  task.cancel()
  await tick()
  await tick()
  expect(started).toBe(false)
  expect(task.pending.value).toBe(false)
})

test("leaving the scope aborts the running task and drops its answer", async () => {
  const scope = effectScope()
  const task = scope.run(() => useAsyncTask<string>())!
  const applied: string[] = []
  const pending = deferred<string>()
  let signal!: AbortSignal
  task.run((s) => ((signal = s), pending.promise), { apply: (v) => applied.push(v) })
  await tick()
  scope.stop()
  pending.resolve("late")
  await tick()
  expect(signal.aborted).toBe(true)
  expect(applied).toEqual([])
})

test("emit applies a partial value at once and pending holds until the task settles", async () => {
  const task = useAsyncTask<string>()
  const applied: string[] = []
  const rest = deferred<string>()
  task.run(
    async (_signal, emit) => {
      emit("first")
      return rest.promise
    },
    { apply: (v) => applied.push(v) },
  )
  await tick()
  expect(applied).toEqual(["first"])
  expect(task.pending.value).toBe(true)
  rest.resolve("done")
  await tick()
  expect(applied).toEqual(["first", "done"])
  expect(task.pending.value).toBe(false)
})

test("emit from a superseded run is dropped", async () => {
  const task = useAsyncTask<string>()
  const applied: string[] = []
  let emitOld!: (value: string) => void
  task.run((_s, emit) => ((emitOld = emit), new Promise<string>(() => {})), { apply: (v) => applied.push(v) })
  await tick()
  task.run(() => "new", { apply: (v) => applied.push(v) })
  await tick()
  emitOld("stale")
  expect(applied).toEqual(["new"])
})
