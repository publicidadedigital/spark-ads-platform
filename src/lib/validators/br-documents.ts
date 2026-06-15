export function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  for (const [length, expectedIndex] of [[9, 9], [10, 10]] as const) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== digits[expectedIndex]) return false;
  }
  return true;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split("").map(Number);
  const calc = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * weights[i];
    const check = sum % 11;
    return check < 2 ? 0 : 11 - check;
  };

  return calc(12) === digits[12] && calc(13) === digits[13];
}

export function isValidBrazilianPhone(value: string): boolean {
  const phone = value.replace(/\D/g, "");
  if (phone.length !== 10 && phone.length !== 11) return false;
  const ddd = Number(phone.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return true;
}

export async function fetchAddressByCep(cep: string): Promise<{ cidade: string; estado: string } | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.erro) return null;
    return { cidade: data.localidade ?? "", estado: data.uf ?? "" };
  } catch {
    return null;
  }
}
