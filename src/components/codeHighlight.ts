/*
 * Tiny, dependency-free syntax highlighter for LpCodeBlock. NOT a full parser —
 * a single regex tokenizer that covers strings, comments, annotations, numbers,
 * keywords, booleans and punctuation well enough for snippets (config, API
 * examples, CLI, JVM build files). Languages are just extra keyword sets over
 * the same tokenizer; JS/TS, Python, Rust, and the JVM trio (Kotlin/Java/Groovy)
 * share most of it. For pixel-perfect IDE highlighting a consumer can pass
 * pre-highlighted HTML instead; this keeps the kit zero-dependency and
 * synchronous (shiki is heavy and async). Tokens map to kit colour classes so
 * highlighting follows the theme.
 */

export type CodeLang =
  | "ts"
  | "js"
  | "json"
  | "bash"
  | "html"
  | "python"
  | "rust"
  | "yaml"
  | "toml"
  | "kotlin"
  | "java"
  | "groovy"
  | "plain"

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
  // kotlin
  "fun", "val", "object", "companion", "data", "sealed", "override", "open",
  "internal", "lateinit", "init", "when", "is", "vararg", "inline", "reified",
  "suspend", "operator", "infix", "tailrec", "external", "annotation",
  "constructor", "by", "get", "set", "field", "it", "run", "let", "apply",
  "also", "with",
  // java (extra, beyond shared C-family already above)
  "package", "implements", "abstract", "final", "synchronized", "volatile",
  "transient", "native", "strictfp", "protected", "throws", "boolean", "int",
  "long", "short", "byte", "char", "float", "double", "String", "record",
  // groovy adds few over java: def, trait already covered; add its extras
  "def", "each", "closure",
])

const BOOLEANS = new Set([
  "true", "false", "null", "undefined", // js
  "None", "True", "False", // python
  "Some", "Ok", "Err", // rust common variants read as constants
])

/*
 * Comment syntax is the one thing the shared tokenizer cannot guess: `#` opens
 * a comment in shell, Python, YAML and TOML but is a private field in
 * TypeScript, and `//` is a comment in C-family code but part of every URL in a
 * YAML file. So each language names its own comment forms.
 */
type CommentStyle = "c" | "hash" | "html" | "none"

const COMMENTS: Record<CodeLang, CommentStyle> = {
  ts: "c",
  js: "c",
  json: "none",
  bash: "hash",
  html: "html",
  python: "hash",
  rust: "c",
  yaml: "hash",
  toml: "hash",
  kotlin: "c",
  java: "c",
  groovy: "c",
  plain: "none",
}

const COMMENT_PATTERN: Record<CommentStyle, string> = {
  c: "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/",
  // A `#` only starts a comment at the start of a word, so `a#b` in a URL or
  // `${#arr[@]}` in shell stay code.
  hash: "(?<![\\w$])#[^\\n]*",
  html: "<!--[\\s\\S]*?-->",
  none: "(?!)",
}

/** Where an unterminated block comment opens on a line, and what closes it. */
const BLOCK: Partial<Record<CommentStyle, { open: string; close: string }>> = {
  c: { open: "/*", close: "*/" },
  html: { open: "<!--", close: "-->" },
}

const masters = new Map<CommentStyle, RegExp>()

// One master regex per comment style, alternation ordered so longer/greedier
// rules win first. Order: comments → strings → numbers → identifiers → punctuation.
function masterFor(style: CommentStyle): RegExp {
  let re = masters.get(style)
  if (!re) {
    re = new RegExp(
      [
        `(${COMMENT_PATTERN[style]})`, // 1 comment
        "(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)", // 2 string
        "(@[A-Za-z_$][\\w$]*)", // 3 annotation (@Override, @ConfigSerializable — JVM)
        "(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?[fFlLdD]?\\b)", // 4 number (JVM suffixes)
        "(#?[A-Za-z_$][\\w$]*)", // 5 identifier (keyword/bool/func/prop/plain), incl. #private
        "([{}()\\[\\];:,.<>=+\\-*/%!&|?]+)", // 6 punctuation
      ].join("|"),
      "g",
    )
    masters.set(style, re)
  }
  return re
}

function classifyIdent(name: string, before: string, after: string): string {
  if (KEYWORDS.has(name)) return C.keyword
  if (BOOLEANS.has(name)) return C.boolean
  if (after.startsWith("(")) return C.func // call/def
  if (before.endsWith(".")) return C.property // member access
  return ""
}

/** Tokenize one line into coloured spans. JSON keys get the property colour. */
export function tokenizeLine(line: string, lang: CodeLang): Token[] {
  if (lang === "plain") return line ? [{ text: line, cls: "" }] : []
  const out: Token[] = []
  let last = 0
  let m: RegExpExecArray | null
  const master = masterFor(COMMENTS[lang])
  master.lastIndex = 0
  while ((m = master.exec(line)) !== null) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), cls: "" })
    const [full, comment, str, annotation, num, ident, punct] = m
    if (comment != null) out.push({ text: full, cls: C.comment })
    else if (annotation != null) out.push({ text: full, cls: C.func })
    else if (str != null) {
      // JSON: a quoted token immediately followed by ":" is a key.
      const isKey = lang === "json" && line.slice(m.index + full.length).trimStart().startsWith(":")
      out.push({ text: full, cls: isKey ? C.property : C.string })
    } else if (num != null) out.push({ text: full, cls: C.number })
    else if (ident != null) {
      const after = line.slice(m.index + full.length).trimStart()
      const before = line.slice(0, m.index).trimEnd()
      // YAML (`key:`) / TOML (`key =`) leading key gets the property colour, like
      // JSON keys — only when it's the first token of the line (the key position).
      const isConfigKey =
        (lang === "yaml" && before === "" && after.startsWith(":")) ||
        (lang === "toml" && before === "" && after.startsWith("="))
      out.push({
        text: full,
        cls: isConfigKey ? C.property : classifyIdent(ident, before, after),
      })
    } else if (punct != null) out.push({ text: full, cls: C.punct })
    last = m.index + full.length
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: "" })
  return out
}

/**
 * Tokenize a whole snippet, carrying a block comment (`/* … *\/`, `<!-- … -->`)
 * across the lines it spans. `tokenizeLine` alone sees each line in isolation
 * and coloured the middle of a doc comment as code.
 */
export function tokenizeLines(lines: string[], lang: CodeLang): Token[][] {
  const block = BLOCK[COMMENTS[lang]]
  if (!block) return lines.map((line) => tokenizeLine(line, lang))
  const out: Token[][] = []
  let open = false
  for (const line of lines) {
    let rest = line
    const tokens: Token[] = []
    if (open) {
      const end = rest.indexOf(block.close)
      if (end === -1) {
        out.push(rest ? [{ text: rest, cls: C.comment }] : [])
        continue
      }
      tokens.push({ text: rest.slice(0, end + block.close.length), cls: C.comment })
      rest = rest.slice(end + block.close.length)
      open = false
    }
    const lineTokens = tokenizeLine(rest, lang)
    // A closed comment is already a comment token, so an opener left in plain
    // code is one the line never closes: from there on, the line is comment.
    const at = lineTokens.findIndex(
      (t) => t.cls !== C.comment && t.cls !== C.string && t.text.includes(block.open),
    )
    if (at >= 0) {
      const cut = lineTokens[at].text.indexOf(block.open)
      const tail = lineTokens
        .slice(at)
        .map((t) => t.text)
        .join("")
        .slice(cut)
      tokens.push(...lineTokens.slice(0, at))
      if (cut > 0) tokens.push({ text: lineTokens[at].text.slice(0, cut), cls: lineTokens[at].cls })
      tokens.push({ text: tail, cls: C.comment })
      open = true
    } else tokens.push(...lineTokens)
    out.push(tokens)
  }
  return out
}
