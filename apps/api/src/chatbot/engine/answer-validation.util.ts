import type { ValidationType } from "../flow-definition.types";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (base.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const digit1 = calcDigit(cpf.slice(0, 9));
  const digit2 = calcDigit(cpf.slice(0, 9) + digit1);
  return cpf === cpf.slice(0, 9) + String(digit1) + String(digit2);
}

function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string): number => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (weights[i] as number);
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const digit1 = calcDigit(cnpj.slice(0, 12));
  const digit2 = calcDigit(cnpj.slice(0, 12) + digit1);
  return cnpj === cnpj.slice(0, 12) + String(digit1) + String(digit2);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

export function validateAnswer(tipo: ValidationType | undefined, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  switch (tipo) {
    case "numero":
      return !Number.isNaN(Number(trimmed.replace(",", ".")));
    case "email":
      return EMAIL_REGEX.test(trimmed);
    case "cpf":
      return isValidCpf(trimmed);
    case "cnpj":
      return isValidCnpj(trimmed);
    case "telefone":
      return onlyDigits(trimmed).length >= 10 && onlyDigits(trimmed).length <= 13;
    case "data":
      return DATE_REGEX.test(trimmed);
    case "texto":
    default:
      return true;
  }
}
