export function normalizeCpfCnpj(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export function isValidCpf(cpf: string): boolean {
  const cleanCpf = normalizeCpfCnpj(cpf);
  if (cleanCpf.length !== 11) return false;
  
  // Exclude known invalid CPFs
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cleanCpf.substring(i - 1, i), 10) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.substring(9, 10), 10)) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cleanCpf.substring(i - 1, i), 10) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.substring(10, 11), 10)) return false;
  
  return true;
}

export function isValidCnpj(cnpj: string): boolean {
  const cleanCnpj = normalizeCpfCnpj(cnpj);
  if (cleanCnpj.length !== 14) return false;
  
  // Exclude known invalid CNPJs
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;
  
  let size = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, size);
  const digits = cleanCnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;
  
  size = size + 1;
  numbers = cleanCnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;
  
  return true;
}

export function detectDocumentType(value: string): "CPF" | "CNPJ" | null {
  const cleanValue = normalizeCpfCnpj(value);
  if (cleanValue.length === 11) return "CPF";
  if (cleanValue.length === 14) return "CNPJ";
  return null;
}
