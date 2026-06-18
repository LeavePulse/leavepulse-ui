/*
 * Tiny, dependency-free syntax highlighter for LpCodeBlock. NOT a full parser —
 * a single regex tokenizer that covers strings, comments, numbers, keywords,
 * booleans and punctuation well enough for snippets (config, API examples, CLI).
 * For pixel-perfect IDE highlighting a consumer can pass pre-highlighted HTML
 * instead; this keeps the kit zero-dependency and synchronous (shiki is heavy
 * and async). Tokens map to kit colour classes so highlighting follows the theme.
 */

export type CodeLang = "ts" | "js" | "json" | "bash" | "html" | "python" | "rust" | "plain"

export interface Token {
  text: string
  /** CSS class for this token, or "" for plain text. */
  cls: string
}

// Token colours (kit semantic tokens). Kept muted so code reads calmly.
const C = {
  comment: "text-muted italic",
  string: "text-action",
  number: "text-accent",
  keyword: "text-brand",
  boolean: "text-accent",
  property: "text-muted-strong",
  func: "text-brand",
  punct: "text-muted",
}

const KEYWORDS = new Set([
  // JS/TS
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "import", "export", "from", "default", "class", "extends", "new", "await",
  "async", "type", "interface", "enum", "public", "private", "readonly",
  "as", "in", "of", "try", "catch", "finally", "throw", "switch", "case",
  "break", "continue", "typeof", "instanceof", "void", "yield",
  // shell
  "echo", "cd", "sudo", "npm", "npx", "git", "curl",
  // python
  "def", "elif", "lambda", "pass", "with", "global", "nonlocal", "del",
  "raise", "except", "and", "or", "not", "is", "assert", "yield", "match",
  // rust
  "fn", "mut", "impl", "trait", "struct", "mod", "pub", "use", "crate",
  "self", "Self", "move", "ref", "where", "dyn", "unsafe", "loop", "macro",
  "use", "super", "static",
])

const BOOLEANS = new Set([
  "true", "false", "null", "undefined", // js
  "None", "True", "False", // python
  "Some", "Ok", "Err", // rust common variants read as constants
])

// One master regex, alternation ordered so longer/greedier rules win first.
// Order: comments → strings → numbers → identifiers → punctuation.
const MASTER = new RegExp(
  [
    "(\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)", // 1 comment
    "(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)", // 2 string
    "(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)", // 3 number
    "([A-Za-z_$][\\w$]*)", // 4 identifier (keyword/bool/func/prop/plain)
    "([{}()\\[\\];:,.<>=+\\-*/%!&|?]+)", // 5 punctuation
  ].join("|"),
  "g",
)

function classifyIdent(name: string, before: string, after: string): string {
  if (KEYWORDS.has(name)) return C.keyword
  if (BOOLEANS.has(name)) return C.boolean
  if (after.startsWith("(")) return C.func // call/def
  if (before.endsWith(".")) return C.property // member access
  return ""
}

/** Tokenize one line into coloured spans. JSON keys get the property colour. */
export function tokenizeLine(line: string, lang: CodeLang): Token[] {
  const out: Token[] = []
  let last = 0
  let m: RegExpExecArray | null
  MASTER.lastIndex = 0
  while ((m = MASTER.exec(line)) !== null) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), cls: "" })
    const [full, comment, str, num, ident, punct] = m
    if (comment != null) out.push({ text: full, cls: C.comment })
    else if (str != null) {
      // JSON: a quoted token immediately followed by ":" is a key.
      const isKey = lang === "json" && line.slice(m.index + full.length).trimStart().startsWith(":")
      out.push({ text: full, cls: isKey ? C.property : C.string })
    } else if (num != null) out.push({ text: full, cls: C.number })
    else if (ident != null) {
      const after = line.slice(m.index + full.length).trimStart()
      const before = line.slice(0, m.index).trimEnd()
      out.push({ text: full, cls: classifyIdent(ident, before, after) })
    } else if (punct != null) out.push({ text: full, cls: C.punct })
    last = m.index + full.length
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: "" })
  return out
}
