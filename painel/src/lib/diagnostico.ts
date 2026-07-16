// Carrega o agregado do diagnóstico estadual de ATER (gerado por
// scripts/gerar-diagnostico.py) e expõe os tipos derivados do próprio JSON,
// para que a página não repita a forma dos dados.

import dados from '../data/diagnostico.json';

export const diagnostico = dados;

export type Diagnostico = typeof dados;
export type Municipio = Diagnostico['municipios'][number];
export type Indicador = Diagnostico['indice']['indicadores'][number];
export type CorrecaoEstrutural = Diagnostico['meta']['correcoesEstruturais'][number];
export type PesoEfetivo = Diagnostico['meta']['pesosEfetivos'][number];
export type DadoEmRevisao = Diagnostico['meta']['dadosEmRevisao'][number];
export type IndicadorConstante = Diagnostico['meta']['indicadoresConstantes'][number];
