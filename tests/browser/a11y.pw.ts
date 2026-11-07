import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "./fixtures"

/*
 * axe over the fixture pages that put the most components on screen at once.
 * It catches what a component can get wrong on its own: a control without a
 * name, an ARIA attribute on a role that does not take it, a broken reference.
 * Page-level rules are left out, since a fixture is not a page: it has no
 * landmarks, title or heading outline to speak of. Colour contrast is left out
 * too: it depends on the app's theme, not on the component.
 */
const SCENARIOS = ["contracts", "fields", "table", "shell-features", "file-tree", "log-tools", "chart-toolkit", "data", "notifications"]
const PAGE_RULES = ["region", "landmark-one-main", "page-has-heading-one", "document-title", "html-has-lang", "color-contrast"]
/*
 * axe joins the text of side-by-side chips with no space between them
 * ("alphabetagamma"), so a multi-select whose name lists every chip still
 * reads to it as a name that misses its visible text. The single-select case
 * of the same rule stays checked.
 */
const MISREAD = ['button[aria-haspopup="listbox"][aria-label^="Chips"]']

for (const scenario of SCENARIOS) {
  test(`axe finds nothing wrong in the ${scenario} fixture`, async ({ page }) => {
    await page.goto(`/tests/browser/?scenario=${scenario}`)
    await page.locator("#app > *").first().waitFor()
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(PAGE_RULES)
      .exclude(MISREAD)
      .analyze()
    const found = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)
    expect(found).toEqual([])
  })
}
