import { expect, test } from "bun:test"
import { parseCommandQuery, rankCommandItems, swapCommandTerms } from "../src/components/commandSearch"

const items = [
  { id: "logs", label: "Журнал", group: "Сервер", keywords: ["логи"] },
  { id: "archive", label: "Архив", group: "Сервер", description: "Сохранённые сообщения" },
  { id: "theme", label: "Тёмная тема", group: "Оформление" },
]

test("parses quoted phrases, exclusions and groups", () => {
  expect(parseCommandQuery('"тёмная тема" -архив in:"Оформление"')).toEqual({
    include: ["тёмная тема"],
    exclude: ["архив"],
    groups: ["оформление"],
  })
})

test("ranks a group scope and exclusion", () => {
  const terms = parseCommandQuery("in:сервер -архив")
  expect(rankCommandItems(items, terms).map((item) => item.id)).toEqual(["logs"])
})

test("swaps a keyboard-layout fallback for every query operator", () => {
  expect(swapCommandTerms(parseCommandQuery("cthdth -fh[bd in:uheggf"))).toEqual({
    include: ["сервер"],
    exclude: ["архив"],
    groups: ["группа"],
  })
})
