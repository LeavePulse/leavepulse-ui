import { expect, test as base, type Locator, type Page } from "@playwright/test"

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
const RESOURCE_FAILED = "Failed to load resource"

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

/*
 * The box of something that has stopped moving. A page lays out after it
 * mounts: coordinates read before that land beside what they were read from.
 */
export async function settledBox(target: Locator) {
  let last = await target.boundingBox()
  await expect.poll(async () => {
    const now = await target.boundingBox()
    const still = JSON.stringify(now) === JSON.stringify(last)
    last = now
    return still
  }).toBe(true)
  return last!
}

export { expect }
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    // A resource that failed is the test's own business (some provoke it); what
    // is logged as an error by the code under test is a failure.
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith(RESOURCE_FAILED)) errors.push(`console: ${message.text()}`)
    })
    page.goto = retryingGoto(page, errors)
    page.reload = async (options) => page.goto(page.url(), options)
    await use(page)
    expect(errors).toEqual([])
  },
})
