import { expect, test } from "bun:test"
import { splitChange } from "../src/components/rolling"

test("only the changed digit of a countdown rolls", () => {
  expect(splitChange("Valid for 2:54", "Valid for 2:53")).toEqual({ head: "Valid for 2:5", mid: "3", tail: "" })
})

test("a changed word rolls whole, not the letters that differ", () => {
  expect(splitChange("Online", "Offline")).toEqual({ head: "", mid: "Offline", tail: "" })
  expect(splitChange("работает 5 дней", "работает 6 дней")).toEqual({ head: "работает ", mid: "6", tail: " дней" })
})

test("a value that grows keeps its common ends", () => {
  expect(splitChange("9 left", "10 left")).toEqual({ head: "", mid: "10", tail: " left" })
})
