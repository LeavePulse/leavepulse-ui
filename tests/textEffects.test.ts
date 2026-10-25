import { describe, expect, test } from "bun:test"
import { graphemes } from "../src/components/scramble"
import { keystrokeDelay, sharedPrefix, typewriterNext, typewriterStart, type TypewriterState } from "../src/components/typewriter"
import { splitText } from "../src/components/textSplit"

const opts = { speed: 50, eraseSpeed: 20, hold: 1000, loop: false }

function run(strings: string[], options = opts, max = 500) {
  const split = strings.map(graphemes)
  let state: TypewriterState = typewriterStart()
  const shown: string[] = []
  const typed: number[] = []
  for (let i = 0; i < max; i++) {
    const step = typewriterNext(state, split, options, () => 0.5)
    state = step.state
    shown.push((split[state.index] ?? []).slice(0, state.length).join(""))
    if (step.typed !== undefined) typed.push(step.typed)
    if (!Number.isFinite(step.wait)) break
  }
  return { state, shown, typed }
}

describe("typewriter", () => {
  test("types a single string once and stops", () => {
    const { state, shown, typed } = run(["Hey"])
    expect(shown).toEqual(["H", "He", "Hey"])
    expect(typed).toEqual([0])
    expect(state.phase).toBe("done")
  })

  test("cycles strings, erasing only what the next one does not share", () => {
    const { shown, typed, state } = run(["Search logs", "Search people"])
    expect(typed).toEqual([0, 1])
    const lowest = Math.min(...shown.slice(shown.indexOf("Search logs")).map((s) => s.length))
    expect(lowest).toBe("Search ".length)
    expect(shown.at(-1)).toBe("Search people")
    expect(state.phase).toBe("done")
  })

  test("loop keeps going back to the first string", () => {
    const { typed } = run(["ab", "cd"], { ...opts, loop: true }, 60)
    expect(typed.slice(0, 4)).toEqual([0, 1, 0, 1])
  })

  test("holds after a typed string and pauses after punctuation", () => {
    const split = [graphemes("ab")]
    const step = typewriterNext({ index: 0, length: 1, phase: "typing", to: 0 }, split, { ...opts, loop: true })
    expect(step.typed).toBe(0)
    expect(step.wait).toBe(1000)
    expect(keystrokeDelay(".", 50, () => 0.5)).toBeGreaterThan(keystrokeDelay("a", 50, () => 0.5) * 3)
    expect(sharedPrefix(graphemes("abc"), graphemes("abd"))).toBe(2)
  })
})

describe("splitText", () => {
  test("keeps spaces as their own pieces and keys repeated words by occurrence", () => {
    const pieces = splitText("go go  now", "word")
    expect(pieces.map((p) => p.kind)).toEqual(["word", "space", "word", "space", "word"])
    expect(pieces.filter((p) => p.kind === "word").map((p) => p.key)).toEqual(["go#0", "go#1", "now#0"])
    expect(pieces[3]!.text).toBe("  ")
  })

  test("letters stay grouped by word, and unchanged words keep their key", () => {
    const [word] = splitText("héllo", "letter")
    expect(word!.kind === "word" && word!.parts).toEqual(["h", "é", "l", "l", "o"])
    const keys = (s: string) => splitText(s, "word").filter((p) => p.kind === "word").map((p) => p.key)
    expect(keys("3 builds running")).toContain("builds#0")
    expect(keys("4 builds running")).toContain("builds#0")
  })
})
