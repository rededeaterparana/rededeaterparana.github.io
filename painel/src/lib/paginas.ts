export interface Pagina {
  caminho: string;
  rotulo: string;
  titulo: string;
  descricao: string;
  grupo: string;
}

/**
 * Registro único das páginas do painel. Alimenta a navegação superior,
 * o rodapé, os títulos de documento e a navegação anterior/próxima —
 * a ordem aqui define a ordem de leitura do painel.
 */
export const PAGINAS: Pagina[] = [
  {
    caminho: '/',
    rotulo: 'Visão geral',
    titulo: 'Visão geral da rede',
    descricao: 'Entidades cadastradas, distribuição por município e evolução das adesões.',
    grupo: 'A rede',
  },
  {
    caminho: '/infraestrutura',
    rotulo: 'Infraestrutura',
    titulo: 'Infraestrutura da rede',
    descricao: 'Capacidade instalada declarada: veículos, imóveis e equipamentos.',
    grupo: 'A rede',
  },
  {
    caminho: '/lista',
    rotulo: 'Entidades',
    titulo: 'Entidades cadastradas',
    descricao: 'Lista pesquisável das entidades que aderiram à rede.',
    grupo: 'A rede',
  },
  {
    caminho: '/diagnostico',
    rotulo: 'Diagnóstico',
    titulo: 'Diagnóstico estadual da ATER',
    descricao: 'O ID-ATER e a capacidade instalada nos 399 municípios do Paraná.',
    grupo: 'Diagnóstico estadual',
  },
  {
    caminho: '/metodologia',
    rotulo: 'Metodologia',
    titulo: 'Metodologia do ID-ATER',
    descricao: 'Indicadores, pesos, correções aplicadas e análise de sensibilidade.',
    grupo: 'Diagnóstico estadual',
  },
  {
    caminho: '/empresas',
    rotulo: 'Empresas',
    titulo: 'Empresas do meio rural no Paraná',
    descricao: 'CNPJs ativos com atividades ligadas ao meio rural; inclui potenciais prestadoras de ATER, mas não se restringe a elas.',
    grupo: 'Contexto rural',
  },
];

export const GRUPOS: { rotulo: string; paginas: Pagina[] }[] = PAGINAS.reduce(
  (grupos, pagina) => {
    const existente = grupos.find((g) => g.rotulo === pagina.grupo);
    if (existente) {
      return grupos.map((g) =>
        g.rotulo === pagina.grupo ? { ...g, paginas: [...g.paginas, pagina] } : g,
      );
    }
    return [...grupos, { rotulo: pagina.grupo, paginas: [pagina] }];
  },
  [] as { rotulo: string; paginas: Pagina[] }[],
);

export function paginaAtual(caminho: string): Pagina | undefined {
  return PAGINAS.find((p) => p.caminho === caminho);
}

export function vizinhas(caminho: string): { anterior?: Pagina; proxima?: Pagina } {
  const i = PAGINAS.findIndex((p) => p.caminho === caminho);
  if (i === -1) return {};
  return { anterior: PAGINAS[i - 1], proxima: PAGINAS[i + 1] };
}
