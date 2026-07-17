// Carrega o agregado de empresas de ATER (gerado por scripts/agregar-cnpj-painel.py).
// Dados agregados/anonimizados — sem CNPJ, razão social ou endereço individual.

import dados from '../data/empresas-ater.json';

export const empresas = dados;

export type Empresas = typeof dados;
export type PontoMunicipio = Empresas['pontos'][number];
export type CnaeEmpresa = Empresas['cnaes'][number];
