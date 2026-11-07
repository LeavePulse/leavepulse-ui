import { expect, test } from "./fixtures"

const log = (page: import("@playwright/test").Page) => page.getByTestId("log")

test("the bell opens a feed with tabs, day groups, a sender's avatar and the row's own buttons", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=notifications")
  const bell = page.getByRole("button", { name: /Notifications, 2 unread/ })
  await bell.click()
  const feed = page.getByRole("dialog").getByRole("region", { name: "Notifications" })
  await expect(feed.getByRole("tab", { name: /Unread/ })).toBeVisible()
  await expect(feed.getByRole("heading", { name: "Today" })).toBeVisible()
  await expect(feed.getByRole("heading", { name: "Earlier" })).toBeVisible()
  await expect(feed.getByRole("button", { name: "Approve" })).toBeVisible()
  await expect(feed.getByRole("button", { name: "Notification settings" })).toBeVisible()
  await expect(feed.getByRole("link", { name: "View all notifications" })).toHaveAttribute("href", "#all")
  await page.screenshot({ path: "test-results/notifications-bell.png" })

  // The Unread tab leaves the read invoice out; Requests keeps only its category.
  await feed.getByRole("tab", { name: /Unread/ }).click()
  await expect(feed.getByText("Invoice available")).toHaveCount(0)
  await feed.getByRole("tab", { name: "Requests" }).click()
  await expect(feed.getByText("Certificate expiring")).toHaveCount(0)
  await expect(feed.getByText("Anna requested access")).toBeVisible()
})

test("a row's async action holds its buttons busy, marks the row read and then shows the outcome", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=notifications")
  const feed = page.getByTestId("page")
  await feed.getByRole("button", { name: "Approve" }).click()
  await expect(log(page)).toContainText("markRead:req action:req")
  await expect(feed.getByRole("button", { name: "Decline" })).toBeDisabled()
  await page.getByTestId("release").click()
  await expect(feed.getByText("Approved")).toBeVisible()
  await expect(feed.getByRole("button", { name: "Approve" })).toHaveCount(0)
})

test("quick actions show on hover, toggle read and dismiss; the arrows walk the rows and Delete dismisses", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=notifications")
  const feed = page.getByTestId("page")
  const cert = feed.locator('[data-lp-notification="cert"]')
  await cert.hover()
  await cert.getByRole("button", { name: "Mark as read" }).click()
  await expect(log(page)).toContainText("markRead:cert")
  await expect(cert).toHaveAttribute("data-read", "")
  await cert.getByRole("button", { name: "Mark as unread" }).click()
  await expect(log(page)).toContainText("markUnread:cert")

  await feed.locator('[data-lp-notification-main="req"]').focus()
  await page.keyboard.press("ArrowDown")
  await expect(feed.locator('[data-lp-notification-main="cert"]')).toBeFocused()
  await page.keyboard.press("End")
  await expect(feed.locator('[data-lp-notification-main="old"]')).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(log(page)).toContainText("dismiss:old")
  await expect(feed.locator('[data-lp-notification-main="cert"]')).toBeFocused()

  await feed.getByRole("button", { name: "Load more" }).click()
  await expect(log(page)).toContainText("loadMore")
})

test("picking a row marks it read, selects it and closes the bell's feed", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=notifications")
  await page.getByRole("button", { name: /Notifications/ }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /Certificate expiring/ }).click()
  await expect(log(page)).toContainText("markRead:cert select:cert")
  await expect(dialog).toHaveCount(0)
})
