/*
 * The add pipeline behind LpTagsInput, kept pure so its rules are testable:
 * split what was typed or pasted, normalise each part, then accept or reject
 * it against the limit, the duplicate policy and the consumer's validator.
 */

export type TagDuplicates = "reject" | "ignore" | "allow"

/** An error message for an invalid tag; anything else accepts it. */
export type TagValidator = (tag: string, tags: readonly string[]) => string | null | undefined | void

export type TagRejection = { value: string; reason: "max" | "duplicate" | "invalid"; message?: string }

export interface AddTagsOptions {
  max?: number
  duplicates?: TagDuplicates
  validate?: TagValidator
  normalize?: (tag: string) => string
}

export function splitTags(text: string, delimiter: string | RegExp | readonly string[]): string[] {
  const parts =
    delimiter instanceof RegExp
      ? text.split(new RegExp(delimiter.source, delimiter.flags.includes("g") ? delimiter.flags : `${delimiter.flags}g`))
      : (typeof delimiter === "string" ? [delimiter] : delimiter).reduce<string[]>(
          (acc, d) => (d ? acc.flatMap((p) => p.split(d)) : acc),
          [text],
        )
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function addTags(
  current: readonly string[],
  candidates: readonly string[],
  options: AddTagsOptions = {},
): { tags: string[]; rejected: TagRejection[]; ignored: string[] } {
  const tags = [...current]
  const rejected: TagRejection[] = []
  /** Repeats dropped under the "ignore" policy, as stored, so the UI can point at the original. */
  const ignored: string[] = []
  const duplicates = options.duplicates ?? "reject"
  for (const candidate of candidates) {
    const value = options.normalize ? options.normalize(candidate) : candidate
    if (!value) continue
    if (tags.includes(value) && duplicates !== "allow") {
      if (duplicates === "reject") rejected.push({ value: candidate, reason: "duplicate" })
      else ignored.push(value)
      continue
    }
    if (options.max && tags.length >= options.max) {
      rejected.push({ value: candidate, reason: "max" })
      continue
    }
    const message = options.validate?.(value, tags)
    if (typeof message === "string" && message) {
      rejected.push({ value: candidate, reason: "invalid", message })
      continue
    }
    tags.push(value)
  }
  return { tags, rejected, ignored }
}
