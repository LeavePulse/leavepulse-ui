import { expect, test } from "@playwright/test"
import { createServer } from "vite"
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"

test("an open palette on a link row renders on the server", async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error", optimizeDeps: { noDiscovery: true } })
  try {
    const { LpCommandPalette } = await server.ssrLoadModule("/src/index.ts")
    const commands = [{ id: "docs", label: "Docs", href: "/docs" }, { id: "broken", label: "Broken", href: "http://[" }]
    const app = createSSRApp({ render: () => h(LpCommandPalette, { open: true, commands }) })
    app.config.errorHandler = (error) => { throw error }
    app.config.warnHandler = () => {}
    expect(typeof (await renderToString(app, {}))).toBe("string")
  } finally {
    await server.close()
  }
})
