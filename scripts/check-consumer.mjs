// Installs what npm would ship and type-checks an app against it: a misspelt
// prop and a wrong value must both be errors in an app that turns the check on,
// and a correct use must not be. Needs a fresh `dist`.
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"

const PACK = ".pack"
const EXPECTED = [/'text' does not exist/, /'categories' does not exist/, /"nowhere"/]

rmSync(PACK, { recursive: true, force: true })
mkdirSync(PACK)
const shell = { encoding: "utf8", shell: true }
const [{ filename }] = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", PACK], shell))
execFileSync("tar", ["-xzf", filename], { ...shell, cwd: PACK })

const { stdout, stderr } = spawnSync("bunx vue-tsc --noEmit -p tests/consumer/tsconfig.json", shell)
const output = `${stdout}${stderr}`
const missing = EXPECTED.filter((pattern) => !pattern.test(output))
const unexpected = output.split("\n").filter((line) => /error TS/.test(line) && !/Misuse\.vue/.test(line))

if (missing.length || unexpected.length) {
  console.error(`check-consumer: not reported: ${missing.join(", ")}\nunexpected:\n${unexpected.join("\n")}\n${output}`)
  process.exit(1)
}
console.log(`check-consumer: tarball types OK, ${EXPECTED.length} misuses reported`)
