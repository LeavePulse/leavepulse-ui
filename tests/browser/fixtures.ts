import { expect, test as base, type Page } from "@playwright/test"

/*
 * Chromium drops every request in flight when the machine's network changes,
 * and a host running Docker changes it whenever a container starts or stops
 * (its veth interface comes and goes). A page caught loading then never gets
 * its modules: it stays blank and the test times out on its first locator,
 * which looked like a flaky component. A navigation that lost a request to
 * exactly that is made again; any other failure still fails the test.
 */
const NETWORK_CHANGED = "net::ERR_NETWORK_CHANGED"
const NAVIGATION_TRIES = 3

function retryingGoto(page: Page, errors: string[]) {
  const goto = page.goto.bind(page)
  return async (...args: Parameters<Page["goto"]>) => {
    for (let attempt = 1; ; attempt++) {
      let dropped = false
      const watch = (request: { failure(): { errorText: string } | null }) => {
        if (request.failure()?.errorText === NETWORK_CHANGED) dropped = true
      }
      page.on("requestfailed", watch)
      const before = errors.length
      try {
        const response = await goto(...args)
        await page.waitForLoadState("load")
        if (!dropped || attempt === NAVIGATION_TRIES) return response
        // What the half-loaded page threw is the drop, not the code under test.
        errors.splice(before)
      } finally {
        page.off("requestfailed", watch)
      }
    }
  }
}

export { expect }
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.goto = retryingGoto(page, errors)
    page.reload = async (options) => page.goto(page.url(), options)
    await use(page)
    expect(errors).toEqual([])
  },
})
