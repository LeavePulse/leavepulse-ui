/*
 * Where two versions of a line differ, for LpRollingText: the common start
 * and end stay put and only the middle rolls. A split never lands inside a
 * word, so "Online" to "Offline" rolls the word rather than "n" to "ff";
 * digits may split, so "2:54" to "2:53" rolls just the last one.
 */
const LETTER = /\p{L}/u

function letter(ch: string | undefined): boolean {
  return ch !== undefined && LETTER.test(ch)
}

export function splitChange(before: string, after: string): { head: string; mid: string; tail: string } {
  if (before === after) return { head: "", mid: after, tail: "" }
  const a = [...before]
  const b = [...after]
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  while (head > 0 && letter(b[head - 1]) && (letter(b[head]) || letter(a[head]))) head--
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  while (tail > 0 && letter(b[b.length - tail]) && (letter(b[b.length - tail - 1]) || letter(a[a.length - tail - 1]))) tail--
  return {
    head: b.slice(0, head).join(""),
    mid: b.slice(head, b.length - tail).join(""),
    tail: b.slice(b.length - tail).join(""),
  }
}
