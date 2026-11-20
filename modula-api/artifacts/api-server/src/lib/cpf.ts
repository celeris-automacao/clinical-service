import { createHmac } from "crypto";

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i);
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calcCheckDigit(9) === digits[9] && calcCheckDigit(10) === digits[10];
}

export function formatCpfMask(value: string): string {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return "***.***.***-**";
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}

export function createCpfLookupKey(cpf: string, secret = process.env.CPF_LOOKUP_SECRET ?? process.env.AUTH_SECRET ?? process.env.JWT_SECRET ?? "cpf-lookup-fallback"): string {
  return createHmac("sha256", secret).update(normalizeCpf(cpf)).digest("hex");
}
