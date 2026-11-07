// Renders every public component on the server, twice. A browser global reached
// during setup or render throws here, and two renders that differ (a random id)
// are what a hydration mismatch is made of.
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { createServer } from "vite"

const BROWSER_GLOBAL = /\b(window|document|navigator|localStorage|sessionStorage|matchMedia|HTMLElement|Element|Node) is not defined/
const silent = () => {}

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error", optimizeDeps: { noDiscovery: true } })
const failures = []
// A setup that runs an async job throws outside the render that started it.
process.on("unhandledRejection", (error) => failures.push(`unhandled: ${error?.message ?? error}`))
process.on("uncaughtException", (error) => failures.push(`uncaught: ${error?.message ?? error}`))
let rendered = 0
try {
  const kit = await server.ssrLoadModule("/src/index.ts")
  const { COMPONENT_NAMES } = await server.ssrLoadModule("/src/component-names.ts")
  const render = async (component) => {
    const app = createSSRApp({ render: () => h(component) })
    app.config.warnHandler = silent
    app.config.errorHandler = (error) => {
      throw error
    }
    return renderToString(app)
  }
  for (const name of COMPONENT_NAMES) {
    const component = kit[name]
    if (!component) continue
    try {
      const first = await render(component)
      const second = await render(component)
      await new Promise((resolve) => setImmediate(resolve))
      rendered++
      if (first !== second) failures.push(`${name}: two renders differ`)
    } catch (error) {
      // A component handed no props may fail on them; only a browser global is the finding.
      if (BROWSER_GLOBAL.test(String(error))) failures.push(`${name}: ${error.message}`)
    }
  }
} finally {
  await server.close()
}

if (failures.length) {
  console.error(`check-ssr: ${failures.length} failed\n  ${failures.join("\n  ")}`)
  process.exit(1)
}
console.log(`check-ssr: ${rendered} components render stably on the server`)
