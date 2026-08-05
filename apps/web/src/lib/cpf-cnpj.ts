/** CNPJ tem 14 dígitos, CPF tem 11 — mesma derivação por tamanho usada no backend (ver cpfCnpj.util.ts), já que o campo guarda os dois tipos de documento sem distinção. */
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}
