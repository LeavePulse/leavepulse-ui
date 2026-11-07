// Fails when the packed tarball would ship without type declarations or with an
// export target that does not exist, so a broken publish is caught before npm.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const [pack] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8" }))
const files = new Set(pack.files.map((f) => f.path))
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

const missing = []
const want = (path) => {
  const clean = path.replace(/^\.\//, "")
  if (!clean.includes("*") && !files.has(clean)) missing.push(clean)
}
want(pkg.types)
want(pkg.main)
const walk = (value) => {
  if (typeof value === "string") want(value)
  else if (value && typeof value === "object") Object.values(value).forEach(walk)
}
walk(pkg.exports)

// The Nuxt module registers each component by this path. A wildcard export
// promises it and nothing above would notice it gone.
const names = readFileSync(new URL("../src/component-names.ts", import.meta.url), "utf8").match(/"(Lp|Layout)\w+"/g) ?? []
if (names.length === 0) missing.push("src/component-names.ts (no names read)")
for (const quoted of names) {
  const name = quoted.slice(1, -1)
  want(`dist/components/${name}.vue.js`)
  want(`dist/components/${name}.vue.d.ts`)
}

// Everything ./dist/*.js exposes has its code beside its types.
for (const path of files) {
  if (/^dist\/(theme|layout)\/.*\.d\.ts$/.test(path)) want(path.replace(/\.d\.ts$/, ".js"))
}

const declarations = [...files].filter((f) => f.startsWith("dist/") && f.endsWith(".d.ts")).length
if (declarations === 0) missing.push("dist/**/*.d.ts (no declarations at all)")

if (missing.length) {
  console.error(`check-pack: missing from the tarball:\n  ${missing.join("\n  ")}`)
  process.exit(1)
}
console.log(`check-pack: ${files.size} files, ${declarations} declarations, exports resolve`)
