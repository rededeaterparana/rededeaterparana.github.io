// Regionais administrativas do IDR-Paraná, derivadas do agregado do
// diagnóstico (que traz a regional de cada um dos 399 municípios). O código
// IBGE é a chave de junção com as demais bases (ex.: empresas).

import { diagnostico } from './diagnostico';

const REGIONAL_POR_COD = new Map(diagnostico.municipios.map((m) => [m.cod, m.regional]));

export const REGIONAIS = [...new Set(diagnostico.municipios.map((m) => m.regional))]
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Regional do IDR-Paraná do município, pelo código IBGE (7 dígitos). */
export function regionalDoMunicipio(codIbge: number): string | null {
  return REGIONAL_POR_COD.get(codIbge) ?? null;
}
