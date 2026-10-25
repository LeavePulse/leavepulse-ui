/*
 * Pseudo-localisation: English text made to look like a translation, so a
 * screen can be checked for translation problems before any translation exists.
 *
 *   "Save changes" → "[Šååṽéé çĥååñĝééš]"
 *
 * What each part catches:
 *
 * - Accents. A string that still reads as plain ASCII on a pseudo screen was
 *   never routed through the label system: it is hard-coded and would stay
 *   English in every language.
 * - Length. Translations run longer than English, German and Finnish by a
 *   third and more. Vowels are stretched by `expand`, so a label that only fits
 *   in English overflows, wraps or truncates right here.
 * - Brackets. A clipped end bracket is truncation that would otherwise go
 *   unnoticed; a bracket in the middle of a sentence is two strings glued
 *   together, which no language with a different word order can translate.
 *
 * Placeholders (`{name}`, `{{ name }}`, `%s`, `%1$d`), tags and entities are
 * left exactly as they are: they are code the label is filled through, and an
 * accented `{ñåmé}` would no longer be replaced.
 */

export interface PseudoOptions {
  /**
   * Extra length as a share of the text's letters: 0.35 adds about a third.
   * Spread over the vowels, so the text grows the way a longer word does
   * rather than gaining a tail that wraps somewhere convenient.
   */
  expand?: number
  /**
   * Markers around the whole string. `true` uses square brackets, a pair of
   * strings picks others, `false` drops them.
   */
  brackets?: boolean | readonly [string, string]
}

const ACCENTED: Record<string, string> = {
  a: "å", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
}

const VOWEL = /[aeiouyAEIOUY]/

/*
 * Everything that is code rather than text. Order matters only in that the
 * double-brace form must be tried before the single one, or `{{ x }}` would
 * be read as `{` + `{ x }` + `}`.
 */
const PROTECTED = /\{\{[^}]*\}\}|\{[^{}]*\}|%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?[sdifoxXeEgGc%]|<[^>]+>|&[a-zA-Z#0-9]+;/g

/** English text made to look translated and longer; see the module comment. */
export function pseudoLocalize(text: string, options: PseudoOptions = {}): string {
  if (!text.trim()) return text
  const expand = Math.max(0, options.expand ?? 0.35)
  const brackets = options.brackets ?? true
  const [open, close] = brackets === true ? ["[", "]"] : brackets === false ? ["", ""] : brackets

  // Split into text runs and protected runs, keeping both.
  const runs: { text: string; code: boolean }[] = []
  let last = 0
  for (const match of text.matchAll(PROTECTED)) {
    const at = match.index ?? 0
    if (at > last) runs.push({ text: text.slice(last, at), code: false })
    runs.push({ text: match[0], code: true })
    last = at + match[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), code: false })

  const letters = runs.reduce((n, run) => (run.code ? n : n + (run.text.match(/[a-zA-Z]/g)?.length ?? 0)), 0)
  const vowels = runs.reduce((n, run) => (run.code ? n : n + (run.text.match(/[aeiouyAEIOUY]/g)?.length ?? 0)), 0)
  let extra = Math.round(letters * expand)

  /*
   * Every vowel repeats `per` more times, and the first `rest` once more on
   * top, so the growth is spread over the whole string instead of piling up
   * in its first word.
   */
  const per = vowels ? Math.floor(extra / vowels) : 0
  let rest = vowels ? extra % vowels : 0
  if (vowels) extra = 0

  const out = runs
    .map((run) => {
      if (run.code) return run.text
      let s = ""
      for (const ch of run.text) {
        const mapped = ACCENTED[ch] ?? ch
        s += mapped
        if (VOWEL.test(ch)) {
          const times = per + (rest > 0 ? 1 : 0)
          if (rest > 0) rest--
          s += mapped.toLowerCase().repeat(times)
        }
      }
      return s
    })
    .join("")

  // No vowels to stretch (an abbreviation, a code): the length goes at the end.
  const tail = extra > 0 ? "·".repeat(extra) : ""
  return `${open}${out}${tail}${close}`
}
