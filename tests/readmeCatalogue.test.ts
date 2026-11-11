import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { withCatalogue } from "../scripts/readme-catalogue.mjs"

test("the README's component catalogue matches the exported components", () => {
  const readme = readFileSync(join(import.meta.dir, "..", "README.md"), "utf8")
  expect(withCatalogue(readme), "run: node scripts/readme-catalogue.mjs").toBe(readme)
})
