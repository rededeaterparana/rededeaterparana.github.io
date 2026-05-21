export interface EnderecoCEP {
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
}

export async function buscarCEP(cep: string): Promise<EnderecoCEP | null> {
  const s = (cep || '').replace(/\D/g, '');
  if (s.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${s}/json/`);
    if (!r.ok) return null;
    const j: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string } = await r.json();
    if (j.erro) return null;
    return {
      logradouro: j.logradouro || '',
      bairro: j.bairro || '',
      municipio: j.localidade || '',
      uf: j.uf || ''
    };
  } catch {
    return null;
  }
}

export function formatarCEP(v: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}
