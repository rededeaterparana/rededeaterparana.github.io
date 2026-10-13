import { EntidadePublica, MunicipioAtuacao } from './api';
import { diagnostico } from './diagnostico';
import { REGIONAIS } from './regionais';

export function porChave<T extends string>(entidades: EntidadePublica[], chave: keyof EntidadePublica) {
  const m = new Map<T, number>();
  for (const e of entidades) {
    const k = String(e[chave] || '—') as T;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
}

export function somaInfra(entidades: EntidadePublica[]) {
  return [
    { categoria: 'Veículos', total: soma(entidades, 'veiculos_total') },
    { categoria: 'Informática', total: soma(entidades, 'eq_informatica_total') },
    { categoria: 'Rede', total: soma(entidades, 'eq_rede_total') },
    { categoria: 'Equip. do extensionista', total: soma(entidades, 'eq_extensionista_total') },
    { categoria: 'Imóveis', total: soma(entidades, 'imoveis_total') }
  ];
}

function soma(arr: EntidadePublica[], chave: keyof EntidadePublica): number {
  return arr.reduce((acc, e) => acc + (Number(e[chave]) || 0), 0);
}

export function serieAdesoes(entidades: EntidadePublica[]) {
  const m = new Map<string, number>();
  for (const e of entidades) {
    if (!e.criado_em) continue;
    const d = new Date(e.criado_em);
    if (isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    m.set(ym, (m.get(ym) || 0) + 1);
  }
  return Array.from(m, ([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes));
}

export function totalExtensionistas(entidades: EntidadePublica[]): number {
  return soma(entidades, 'equipe_total');
}

const COD_POR_NOME = new Map(diagnostico.municipios.map((m) => [normalizar(m.nome), m.cod]));

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Municípios onde a entidade atua. Sem a lista (API antiga ou cadastro sem
 * área de atuação), cai para o município da sede.
 */
function municipiosDaEntidade(e: EntidadePublica): MunicipioAtuacao[] {
  if (e.municipios_atuacao && e.municipios_atuacao.length > 0) return e.municipios_atuacao;
  return e.municipio ? [{ codigo_ibge: '', municipio: e.municipio }] : [];
}

function codigoDe(m: MunicipioAtuacao): number | null {
  const cod = Number(m.codigo_ibge);
  if (cod) return cod;
  return COD_POR_NOME.get(normalizar(m.municipio)) ?? null;
}

/** Municípios distintos atendidos por ao menos uma entidade da rede (por código IBGE). */
export function municipiosAtendidos(entidades: EntidadePublica[]): Set<number> {
  const atendidos = new Set<number>();
  for (const e of entidades) {
    for (const m of municipiosDaEntidade(e)) {
      const cod = codigoDe(m);
      if (cod) atendidos.add(cod);
    }
  }
  return atendidos;
}

/** Por regional do IDR: municípios atendidos pela rede e total de municípios da regional. */
export function atendimentoPorRegional(entidades: EntidadePublica[]) {
  const atendidos = municipiosAtendidos(entidades);
  return REGIONAIS.map((regional) => {
    const daRegional = diagnostico.municipios.filter((m) => m.regional === regional);
    const comEntidade = daRegional.filter((m) => atendidos.has(m.cod)).length;
    return { regional, atendidos: comEntidade, total: daRegional.length };
  });
}

