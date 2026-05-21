export function limparCNPJ(v: string): string {
  return (v || '').replace(/\D/g, '');
}

export function formatarCNPJ(v: string): string {
  const s = limparCNPJ(v).slice(0, 14);
  return s
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function validarCNPJ(cnpj: string): boolean {
  const s = limparCNPJ(cnpj);
  if (s.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(s)) return false;
  const calc = (base: string): number => {
    const pesos = base.length === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(s.substring(0, 12));
  const d2 = calc(s.substring(0, 12) + d1);
  return d1 === parseInt(s[12], 10) && d2 === parseInt(s[13], 10);
}

export function validarCPF(cpf: string): boolean {
  const s = (cpf || '').replace(/\D/g, '');
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;
  const calc = (len: number): number => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += parseInt(s[i], 10) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(s[9], 10) && calc(10) === parseInt(s[10], 10);
}
