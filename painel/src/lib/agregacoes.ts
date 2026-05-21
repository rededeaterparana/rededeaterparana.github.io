import { EntidadePublica } from './api';

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
    { categoria: 'Extensionista', total: soma(entidades, 'eq_extensionista_total') },
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
