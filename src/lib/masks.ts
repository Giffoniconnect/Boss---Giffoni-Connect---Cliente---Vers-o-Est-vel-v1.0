export const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .slice(0, 14);
};

export const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .slice(0, 18);
};

export const formatCEP = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
};

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  } else {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{1})(\d{4})(\d)/, '$1 $2-$3')
      .slice(0, 16);
  }
};

export const formatDate = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

export const fetchCEP = async (cep: string) => {
  const cleanedCep = cep.replace(/\D/g, '');
  if (cleanedCep.length !== 8) return null;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanedCep}`);
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim()) {
        try {
          return JSON.parse(text);
        } catch {
          // Continue to fallback
        }
      }
    }
    // Fallback to viacep if BrasilAPI fails or returns empty/non-JSON
    const viaRes = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
    if (viaRes.ok) {
      const viaText = await viaRes.text();
      if (viaText && viaText.trim()) {
        const viaData = JSON.parse(viaText);
        if (!viaData.erro) {
          return {
            street: viaData.logradouro,
            neighborhood: viaData.bairro,
            city: viaData.localidade,
            state: viaData.uf
          };
        }
      }
    }
  } catch (error) {
    console.error('Error fetching CEP:', error);
  }
  return null;
};

export const fetchCNPJ = async (cnpj: string) => {
  const cleanedCnpj = cnpj.replace(/\D/g, '');
  if (cleanedCnpj.length !== 14) return null;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim()) {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching CNPJ:', error);
  }
  return null;
};
