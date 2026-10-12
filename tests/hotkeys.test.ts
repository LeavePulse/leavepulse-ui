import { expect, test } from "bun:test"
import {
  findHotkeyConflicts,
  hotkeySteps,
  sequenceProgress,
  type HotkeyBinding,
} from "../src/composables/useHotkeys"

function press(key: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key, ...init } as KeyboardEvent
}
const bind = (b: Partial<HotkeyBinding>): HotkeyBinding => ({ handler: () => {}, ...b })

test("a plain binding is one step and a sequence string splits on spaces", () => {
  expect(hotkeySteps(bind({ key: "k", ctrl: true }))).toEqual([
    { key: "k", code: undefined, ctrl: true, shift: undefined, alt: undefined },
  ])
  expect(hotkeySteps(bind({ sequence: " g  i " }))).toEqual([{ key: "g" }, { key: "i" }])
  expect(hotkeySteps(bind({ sequence: ["g", { key: "s", ctrl: true }] }))).toEqual([
    { key: "g" },
    { key: "s", ctrl: true },
  ])
  expect(hotkeySteps(bind({}))).toEqual([])
})

test("sequence progress reads prefix, full and miss", () => {
  const gi = bind({ sequence: "g i" })
  expect(sequenceProgress([press("g")], gi)).toBe("prefix")
  expect(sequenceProgress([press("g"), press("i")], gi)).toBe("full")
  expect(sequenceProgress([press("g"), press("x")], gi)).toBeNull()
  expect(sequenceProgress([press("g"), press("i"), press("t")], gi)).toBeNull()
  expect(sequenceProgress([press("g")], bind({ key: "g" }))).toBe("full")
})

test("sequence steps match by physical key on other layouts", () => {
  const gi = bind({ sequence: [{ key: "g", code: "KeyG" }, { key: "i", code: "KeyI" }] })
  expect(sequenceProgress([press("\u043f", { code: "KeyG" }), press("\u0448", { code: "KeyI" })], gi)).toBe("full")
})

test("the same keys from two calls at one priority and scope conflict", () => {
  const conflicts = findHotkeyConflicts([
    { bindings: [bind({ key: "k", ctrl: true, help: { group: "A", label: "Palette" } })], priority: 0, scope: null },
    { bindings: [bind({ key: "K", ctrl: true, help: { group: "B", label: "Search" } })], priority: 0, scope: null },
  ])
  expect(conflicts).toEqual([{ combo: "Ctrl+K", labels: ["Palette", "Search"], priority: 0 }])
})

test("priority, scope, when and repeats within one call are not conflicts", () => {
  const k = () => bind({ key: "k", ctrl: true })
  const scope = {}
  expect(findHotkeyConflicts([{ bindings: [k()], priority: 0, scope: null }, { bindings: [k()], priority: 1, scope: null }])).toEqual([])
  expect(findHotkeyConflicts([{ bindings: [k()], priority: 0, scope: null }, { bindings: [k()], priority: 0, scope }])).toEqual([])
  expect(findHotkeyConflicts([{ bindings: [k(), k()], priority: 0, scope: null }])).toEqual([])
  expect(
    findHotkeyConflicts([
      { bindings: [k()], priority: 0, scope: null },
      { bindings: [bind({ key: "k", ctrl: true, when: () => true })], priority: 0, scope: null },
    ]),
  ).toEqual([])
})

test("a sequence and its own first key are not a conflict, two equal sequences are", () => {
  expect(
    findHotkeyConflicts([
      { bindings: [bind({ key: "g" })], priority: 0, scope: null },
      { bindings: [bind({ sequence: "g i" })], priority: 0, scope: null },
    ]),
  ).toEqual([])
  expect(
    findHotkeyConflicts([
      { bindings: [bind({ sequence: "g i" })], priority: 0, scope: null },
      { bindings: [bind({ sequence: ["g", "i"] })], priority: 0, scope: null },
    ]).map((c) => c.combo),
  ).toEqual(["G I"])
})
