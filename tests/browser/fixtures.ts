import { expect, test as base } from "@playwright/test"

export { expect }
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await use(page)
    expect(errors).toEqual([])
  },
})
