import { expect, test } from "bun:test"
import { parseCommandQuery, rankCommandItems, swapCommandTerms } from "../src/components/commandSearch"

const ru = {
  logs: "\u0416\u0443\u0440\u043D\u0430\u043B",
  server: "\u0421\u0435\u0440\u0432\u0435\u0440",
  log: "\u043B\u043E\u0433\u0438",
  archive: "\u0410\u0440\u0445\u0438\u0432",
  saved: "\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F",
  darkTheme: "\u0422\u0451\u043C\u043D\u0430\u044F \u0442\u0435\u043C\u0430",
  design: "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435",
  group: "\u0433\u0440\u0443\u043F\u043F\u0430",
}

const items = [
  { id: "logs", label: ru.logs, group: ru.server, keywords: [ru.log] },
  { id: "archive", label: ru.archive, group: ru.server, description: ru.saved },
  { id: "theme", label: ru.darkTheme, group: ru.design },
]

test("parses quoted phrases, exclusions and groups", () => {
  expect(parseCommandQuery(`"${ru.darkTheme}" -${ru.archive} in:"${ru.design}"`)).toEqual({
    include: [ru.darkTheme.toLowerCase()],
    exclude: [ru.archive.toLowerCase()],
    groups: [ru.design.toLowerCase()],
  })
})

test("ranks a group scope and exclusion", () => {
  const terms = parseCommandQuery(`in:${ru.server} -${ru.archive}`)
  expect(rankCommandItems(items, terms).map((item) => item.id)).toEqual(["logs"])
})

test("swaps a keyboard-layout fallback for every query operator", () => {
  expect(swapCommandTerms(parseCommandQuery("cthdth -fh[bd in:uheggf"))).toEqual({
    include: [ru.server.toLowerCase()],
    exclude: [ru.archive.toLowerCase()],
    groups: [ru.group],
  })
})
