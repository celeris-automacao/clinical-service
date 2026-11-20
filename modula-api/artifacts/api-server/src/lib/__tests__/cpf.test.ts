import { describe, expect, it } from "vitest";
import { createCpfLookupKey, formatCpfMask, isValidCpf, normalizeCpf } from "../cpf";

describe("cpf helpers", () => {
  it("normalizes CPF strings", () => {
    expect(normalizeCpf("111.444.777-35")).toBe("11144477735");
  });

  it("validates a known valid CPF", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("rejects obvious invalid CPF values", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("masks CPF for safe responses", () => {
    expect(formatCpfMask("11144477735")).toBe("111.***.***-35");
  });

  it("builds a stable HMAC lookup key from the normalized CPF", () => {
    expect(createCpfLookupKey("111.444.777-35", "secret-a")).toBe(createCpfLookupKey("11144477735", "secret-a"));
    expect(createCpfLookupKey("111.444.777-35", "secret-a")).not.toBe(createCpfLookupKey("111.444.777-35", "secret-b"));
  });
});
