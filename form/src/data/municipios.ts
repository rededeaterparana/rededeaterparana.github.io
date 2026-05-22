import dados from './municipios.json';

export interface Municipio {
  codigo_ibge: string;
  nome: string;
  regional_codigo: string;
  regional_nome: string;
  mesorregiao: string;
}

export const MUNICIPIOS_PR: Municipio[] = (dados as Municipio[])
  .slice()
  .sort((a, b) => normalizarSort(a.nome).localeCompare(normalizarSort(b.nome), 'pt-BR'));

function normalizarSort(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const porCodigo = new Map(MUNICIPIOS_PR.map((m) => [m.codigo_ibge, m]));
const porNome = new Map(
  MUNICIPIOS_PR.map((m) => [normalizar(m.nome), m])
);

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function buscarPorCodigo(codigo: string): Municipio | undefined {
  return porCodigo.get(codigo);
}

export function buscarPorNome(nome: string): Municipio | undefined {
  return porNome.get(normalizar(nome));
}
