/**
 * Validação de CPF/CNPJ com dígito verificador real — não é só checar a
 * quantidade de dígitos. Compartilhado entre frontend (feedback em tempo
 * real no formulário) e backend (validação de verdade antes de gravar).
 */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isAllSameDigit(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function calcCpfDigit(base: string, weights: number[]): number {
  const sum = base.split("").reduce((acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || isAllSameDigit(cpf)) return false;

  const digit1 = calcCpfDigit(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calcCpfDigit(cpf.slice(0, 9) + digit1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cpf === cpf.slice(0, 9) + String(digit1) + String(digit2);
}

function calcCnpjDigit(base: string, weights: number[]): number {
  const sum = base.split("").reduce((acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14 || isAllSameDigit(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digit1 = calcCnpjDigit(cnpj.slice(0, 12), weights1);
  const digit2 = calcCnpjDigit(cnpj.slice(0, 12) + digit1, weights2);

  return cnpj === cnpj.slice(0, 12) + String(digit1) + String(digit2);
}

export type DocumentType = "cpf" | "cnpj";

/** Detecta o tipo pelo tamanho (sem validar dígito) — usado pra escolher a máscara enquanto o usuário digita. */
export function detectDocumentType(raw: string): DocumentType | null {
  const digits = onlyDigits(raw);
  if (digits.length <= 11) return "cpf";
  if (digits.length <= 14) return "cnpj";
  return null;
}

export function isValidCpfOuCnpj(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function normalizeCpfCnpj(raw: string): string {
  return onlyDigits(raw);
}

export function formatCpfCnpj(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return raw;
}
