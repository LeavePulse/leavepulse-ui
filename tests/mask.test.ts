import { describe, expect, test } from "bun:test"
import { applyMask, maskDelete } from "../src/composables/useInputMask"

const phone = "+7 (000) 000-00-00"

describe("applyMask", () => {
  test("formats digits typed one by one, writing literals only before a character", () => {
    expect(applyMask("9", { mask: phone }).masked).toBe("+7 (9")
    expect(applyMask("+7 (912", { mask: phone }).masked).toBe("+7 (912")
    expect(applyMask("+7 (9123", { mask: phone }).masked).toBe("+7 (912) 3")
  })

  test("a pasted value with or without its prefix lands in the same shape", () => {
    expect(applyMask("9121234567", { mask: phone }).masked).toBe("+7 (912) 123-45-67")
    expect(applyMask("+79121234567", { mask: phone })).toMatchObject({
      masked: "+7 (912) 123-45-67",
      raw: "9121234567",
      complete: true,
    })
  })

  test("drops characters no token accepts and anything past the mask", () => {
    expect(applyMask("12ab34 5678 9012 3456 99", { mask: "0000 0000 0000 0000" }).masked).toBe(
      "1234 5678 9012 3456",
    )
  })

  test("keeps the caret after the same accepted character", () => {
    const r = applyMask("+7 (91x2", { mask: phone, caret: 6 })
    expect(r.masked).toBe("+7 (912")
    expect(r.caret).toBe(6)
    const grown = applyMask("+7 (9124", { mask: phone, caret: 8 })
    expect(grown.masked).toBe("+7 (912) 4")
    expect(grown.caret).toBe(10)
  })

  test("closing literals appear once the mask is full", () => {
    expect(applyMask("123", { mask: "(000)" })).toMatchObject({ masked: "(123)", caret: 5, complete: true })
  })

  test("transforming and escaped tokens", () => {
    expect(applyMask("ab1234", { mask: "AA-0000" }).masked).toBe("AB-1234")
    expect(applyMask("5", { mask: "\\0-0" }).masked).toBe("0-5")
  })

  test("custom tokens", () => {
    expect(applyMask("ff00zz", { mask: "#HHHHHH", tokens: { H: /[0-9a-f]/i } }).masked).toBe("#ff00")
  })

  test("a list picks the first mask the value fits", () => {
    const masks = ["000-0000", "(000) 000-0000"]
    expect(applyMask("5551234", { mask: masks }).masked).toBe("555-1234")
    expect(applyMask("5551234567", { mask: masks }).masked).toBe("(555) 123-4567")
  })

  test("a function derives the mask from the raw value", () => {
    const card = (raw: string) => (raw.startsWith("34") || raw.startsWith("37") ? "0000 000000 00000" : "0000 0000 0000 0000")
    expect(applyMask("378282246310005", { mask: card }).masked).toBe("3782 822463 10005")
    expect(applyMask("4111111111111111", { mask: card }).masked).toBe("4111 1111 1111 1111")
  })

  test("raw input never matches mask literals", () => {
    expect(applyMask("79", { mask: phone, fromRaw: true }).masked).toBe("+7 (79")
  })

  test("letters outside the basic Latin range", () => {
    expect(applyMask("\u0436\u044912", { mask: "AA-00" }).masked).toBe("\u0416\u0429-12")
  })
})

describe("maskDelete", () => {
  test("Backspace right after a literal removes the character before it", () => {
    const r = maskDelete("+7 (912) 3", 9, "backward", { mask: phone })
    expect(r).toMatchObject({ masked: "+7 (913", caret: 6 })
  })

  test("Backspace over the prefix alone does nothing", () => {
    expect(maskDelete("+7 (9", 4, "backward", { mask: phone })).toBeNull()
  })

  test("Delete skips forward over literals", () => {
    const r = maskDelete("+7 (912) 345", 7, "forward", { mask: phone })
    expect(r).toMatchObject({ masked: "+7 (912) 45", caret: 7 })
  })
})
