const API_URL = import.meta.env.VITE_API_URL as string;

export interface EntidadePublica {
  cnpj_mascarado: string;
  razao_social: string;
  nome_fantasia: string;
  municipio: string;
  uf: string;
  tipo_entidade: string;
  criado_em: string;
  area_atuacao: number;
  equipe_total: number;
  veiculos_total: number;
  eq_informatica_total: number;
  eq_rede_total: number;
  eq_extensionista_total: number;
  imoveis_total: number;
}

export interface RespostaListagem {
  entidades: EntidadePublica[];
  total: number;
  gerado_em: string;
  _status?: number;
}

export async function listar(): Promise<RespostaListagem> {
  if (!API_URL) throw new Error('VITE_API_URL não configurado');
  const r = await fetch(`${API_URL}?action=listar`, { method: 'GET', redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as RespostaListagem;
}
