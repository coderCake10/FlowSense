import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  sanitizeCode,
  validateCode,
  validateEmail,
} from "./authValidation";

describe("validateEmail", () => {
  it.each([
    "admin@auf.edu.ph",
    "  Admin@AUF.edu.ph  ",
    "registrar@ccs.auf.edu.ph",
  ])("accepts institutional address %j", email => {
    expect(validateEmail(email)).toBeNull();
  });

  it.each([
    ["", "Enter your institutional email address."],
    ["   ", "Enter your institutional email address."],
    ["admin", "Enter a valid email address."],
    ["admin@", "Enter a valid email address."],
    ["admin @auf.edu.ph", "Enter a valid email address."],
    ["admin@gmail.com", "Use your @auf.edu.ph email address."],
    ["admin@notauf.edu.ph", "Use your @auf.edu.ph email address."],
    ["admin@auf.edu.ph.evil.com", "Use your @auf.edu.ph email address."],
  ])("rejects %j", (email, message) => {
    expect(validateEmail(email)).toBe(message);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Admin@AUF.edu.PH ")).toBe("admin@auf.edu.ph");
  });
});

describe("validateCode", () => {
  it("accepts a 6-digit code, including leading zeros", () => {
    expect(validateCode("004821")).toBeNull();
  });

  it.each([
    ["", "Enter the code from your email."],
    ["12345", "The code is 6 digits long."],
    ["1234567", "The code is 6 digits long."],
    ["12a456", "The code contains numbers only."],
  ])("rejects %j", (code, message) => {
    expect(validateCode(code)).toBe(message);
  });
});

describe("sanitizeCode", () => {
  it("strips non-digits and caps at 6", () => {
    expect(sanitizeCode("12-34 56 78")).toBe("123456");
    expect(sanitizeCode("abc")).toBe("");
  });
});
