import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts';
import { diagnostico } from '../lib/diagnostico';
import type { Municipio } from '../lib/diagnostico';
import { decimal, indice, inteiro, porcentagem } from '../lib/formato';
import { TabelaMunicipios, FiltroMunicipios } from '../components/TabelaMunicipios';
import { PageHeader } from '../components/PageHeader';
import { GraficoTooltip } from '../components/GraficoTooltip';

const CORES = ['#6b5427', '#8f7743', '#b3a06b', '#d6cba8', '#ece5cf', '#c46f3f', '#a03024', '#4d6b9a'];
// Escala divergente do vermelho (índice baixo) ao marrom escuro (índice alto).
const CORES_FAIXA = ['#c0563a', '#d98e4a', '#e0c56a', '#a58a4a', '#6b5427'];
const CORES_CONSELHO = ['#6b5427', '#d98e4a', '#c0563a'];

// Intervalos semiabertos [min, max) de cada faixa — validados contra as
// contagens publicadas no agregado (6, 63, 159, 137, 34).
const FAIXA_INTERVALO: Record<string, [number, number]> = {
  'Até 0,40': [-Infinity, 0.4],
  '0,40 a 0,50': [0.4, 0.5],
  '0,50 a 0,60': [0.5, 0.6],
  '0,60 a 0,70': [0.6, 0.7],
  'Acima de 0,70': [0.7, Infinity],
};

const { meta, resumo, indice: idx, governanca, entidades, profissionais, analise, municipios } = diagnostico;

/** Extrai um campo string do payload de clique do Recharts. */
function campoDoClique(dados: unknown, campo: string): string | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown> & { payload?: Record<string, unknown> };
  const v = d[campo] ?? d.payload?.[campo];
  return typeof v === 'string' ? v : null;
}

export function Diagnostico() {
  const [faixaSel, setFaixaSel] = useState<string | null>(null);
  const [regionalSel, setRegionalSel] = useState<string | null>(null);

  const indicadores = [...idx.indicadores].sort((a, b) => b.aproveitamento - a.aproveitamento);
  const estrutura = [...governanca.estrutura].sort((a, b) => b.sim - a.sim);
  const constantes = meta.indicadoresConstantes;
  const notaConstantes = constantes.length > 0
    ? `${constantes.length} indicadores são constantes em todos os municípios (${porcentagem(meta.pesoConstante * 100, 0)} do peso): ${constantes.map((c) => c.nome).join(', ')}. Como não variam, o índice diferencia os municípios pelos demais indicadores.`
    : '';

  function irParaTabela() {
    document.getElementById('municipios')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function alternarFaixa(dados: unknown) {
    const faixa = campoDoClique(dados, 'faixa');
    if (!faixa || !FAIXA_INTERVALO[faixa]) return;
    const ativar = faixaSel !== faixa;
    setFaixaSel(ativar ? faixa : null);
    if (ativar) irParaTabela();
  }

  function alternarRegional(dados: unknown) {
    const regional = campoDoClique(dados, 'regional');
    if (!regional) return;
    const ativar = regionalSel !== regional;
    setRegionalSel(ativar ? regional : null);
    if (ativar) irParaTabela();
  }

  const filtros: FiltroMunicipios[] = [
    ...(faixaSel ? [{
      chave: 'faixa',
      rotulo: `Faixa de ID-ATER: ${faixaSel}`,
      predicado: (m: Municipio) => {
        const [min, max] = FAIXA_INTERVALO[faixaSel];
        return m.idAter >= min && m.idAter < max;
      },
    }] : []),
    ...(regionalSel ? [{
      chave: 'regional',
      rotulo: `Regional: ${regionalSel}`,
      predicado: (m: Municipio) => m.regional === regionalSel,
    }] : []),
  ];

  function removerFiltro(chave: string) {
    if (chave === 'faixa') setFaixaSel(null);
    if (chave === 'regional') setRegionalSel(null);
  }

  return (
    <>
      <PageHeader
        kicker="Diagnóstico estadual"
        titulo="Diagnóstico da ATER no Paraná"
        fonte={
          <>
            Levantamento da Capacidade Instalada de ATER, questionário elaborado pelo
            IDR-Paraná e aplicado por seus escritórios regionais nos {inteiro(resumo.municipios)}{' '}
            municípios, refeito a cada quatro anos. É uma pesquisa distinta do cadastro de
            adesão à rede (páginas "A rede") e da pesquisa de CNPJs (página Empresas).
          </>
        }
      >
        <p>
          O <strong>Índice de Desenvolvimento da ATER (ID-ATER)</strong> resume, numa escala de
          0,1 a 1,0, a capacidade instalada de assistência técnica em cada município, a partir de
          11 indicadores agrupados em três áreas — Situação da ATER (40%), Abrangência (20%) e
          Impacto da ATER (40%).
        </p>
      </PageHeader>

      <div className="cards">
        <Card label="Municípios" valor={inteiro(resumo.municipios)} />
        <Card label="ID-ATER médio" valor={indice(resumo.idAterMedio)} />
        <Card label="Profissionais de ATER" valor={inteiro(resumo.profissionais)} />
        <Card label="Equivalentes técnicos" valor={inteiro(resumo.equivalenteTecnico)} />
        <Card label="Estabelecimentos rurais" valor={inteiro(resumo.estabRurais)} />
        <Card label="Estab. por equiv. técnico" valor={decimal(resumo.estabPorEquivTecnico)} />
      </div>

      <section className="painel">
        <h2>Municípios por faixa de ID-ATER</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={idx.faixas}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="faixa" />
            <YAxis allowDecimals={false} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => inteiro(v)}
                descricao="Número de municípios cujo ID-ATER cai nesta faixa. O índice resume 11 indicadores de capacidade de ATER numa escala de 0,1 a 1,0."
                acao="Clique na barra para filtrar a tabela de municípios."
              />
            } />
            <Bar dataKey="municipios" name="Municípios" onClick={alternarFaixa} cursor="pointer">
              {idx.faixas.map((f, i) => (
                <Cell
                  key={i}
                  fill={CORES_FAIXA[i % CORES_FAIXA.length]}
                  fillOpacity={faixaSel && f.faixa !== faixaSel ? 0.35 : 1}
                  stroke={faixaSel === f.faixa ? '#29241a' : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">
          ID-ATER de {indice(resumo.idAterMinimo)} a {indice(resumo.idAterMaximo)};
          mediana de {indice(resumo.idAterMediana)}. Clique numa barra para ver os
          municípios da faixa na tabela ao final da página.
        </p>
      </section>

      <section className="painel">
        <h2>ID-ATER médio por regional</h2>
        <ResponsiveContainer width="100%" height={620}>
          <BarChart data={idx.porRegional} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => decimal(Number(v), 1)} />
            <YAxis type="category" dataKey="regional" width={140} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => indice(v)}
                descricao="Média simples do ID-ATER dos municípios atendidos pelo escritório regional do IDR-Paraná. A linha tracejada marca a média estadual."
                acao="Clique na barra para filtrar a tabela de municípios."
              />
            } />
            <ReferenceLine
              x={resumo.idAterMedio}
              stroke="#635b48"
              strokeDasharray="4 4"
              label={{ value: `média ${indice(resumo.idAterMedio)}`, position: 'top', fontSize: 11 }}
            />
            <Bar dataKey="media" name="ID-ATER médio" fill="#6b5427" onClick={alternarRegional} cursor="pointer">
              {idx.porRegional.map((r, i) => (
                <Cell
                  key={i}
                  fill="#6b5427"
                  fillOpacity={regionalSel && r.regional !== regionalSel ? 0.35 : 1}
                  stroke={regionalSel === r.regional ? '#29241a' : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">Clique numa barra para ver os municípios da regional na tabela ao final da página.</p>
      </section>

      <section className="painel">
        <h2>Composição do índice por área</h2>
        <table>
          <thead>
            <tr>
              <th>Área</th>
              <th style={{ textAlign: 'right' }}>Peso no índice</th>
              <th style={{ textAlign: 'right' }}>Contribuição média</th>
              <th style={{ textAlign: 'right' }}>Aproveitamento</th>
            </tr>
          </thead>
          <tbody>
            {idx.areas.map((a) => (
              <tr key={a.area}>
                <td>{a.area}</td>
                <td style={{ textAlign: 'right' }}>{porcentagem(a.peso * 100, 0)}</td>
                <td style={{ textAlign: 'right' }}>{indice(a.contribuicao)}</td>
                <td style={{ textAlign: 'right' }}>{porcentagem(a.aproveitamento * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="legenda">
          Aproveitamento é a fração do máximo que o estado alcança em cada área (fator médio ÷ 10).
        </p>
      </section>

      <section className="painel">
        <h2>Aproveitamento médio por indicador</h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={indicadores} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => porcentagem(Number(v) * 100, 0)} />
            <YAxis type="category" dataKey="nome" width={210} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => porcentagem(v * 100)}
                descricao="Fração do valor máximo possível (fator 10) que a média estadual atinge no indicador. Aproveitamento baixo mostra onde a capacidade de ATER está mais distante do teto."
              />
            } />
            <Bar dataKey="aproveitamento" name="Aproveitamento" fill="#8f7743" />
          </BarChart>
        </ResponsiveContainer>
        {notaConstantes && <p className="legenda">{notaConstantes}</p>}
      </section>

      <div className="dupla">
        <section className="painel">
          <h2>Conselho municipal (CMDRS)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={governanca.conselho}
                dataKey="municipios"
                nameKey="situacao"
                outerRadius={100}
                label={(p) => `${p.payload?.situacao}: ${p.payload?.municipios}`}
              >
                {governanca.conselho.map((_, i) => (
                  <Cell key={i} fill={CORES_CONSELHO[i % CORES_CONSELHO.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip content={
                <GraficoTooltip
                  formatador={(v) => `${inteiro(v)} municípios`}
                  descricao="Situação do Conselho Municipal de Desenvolvimento Rural Sustentável (CMDRS) declarada no levantamento do IDR-Paraná."
                />
              } />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="painel">
          <h2>Entidades por tipo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={entidades.tipos} dataKey="entidades" nameKey="tipo" outerRadius={100}>
                {entidades.tipos.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip content={
                <GraficoTooltip
                  formatador={(v) => `${inteiro(v)} entidades`}
                  descricao="Entidades prestadoras de ATER identificadas pelo levantamento nos municípios, agrupadas pela natureza da instituição."
                />
              } />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="painel">
        <h2>Estrutura de governança municipal</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={estrutura} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} domain={[0, resumo.municipios]} />
            <YAxis type="category" dataKey="item" width={210} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${inteiro(v)} de ${inteiro(resumo.municipios)} municípios`}
                descricao="Municípios que declararam possuir o item de estrutura de governança rural (conselho, plano, fundo etc.) no levantamento."
              />
            } />
            <Bar dataKey="sim" name="Municípios com" fill="#6b5427" />
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">Número de municípios (de {inteiro(resumo.municipios)}) que declararam ter cada item.</p>
      </section>

      <section className="painel">
        <h2>Profissionais por formação</h2>
        <ResponsiveContainer width="100%" height={440}>
          <BarChart data={profissionais.formacoes} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="formacao" width={180} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${inteiro(v)} profissionais`}
                descricao="Profissionais que prestam ATER nos municípios, por formação declarada no levantamento. Um profissional pode atender mais de um município."
              />
            } />
            <Bar dataKey="profissionais" name="Profissionais" fill="#8f7743" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="painel">
        <h2>Áreas de atuação das entidades</h2>
        <ResponsiveContainer width="100%" height={520}>
          <BarChart data={entidades.atuacao} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="area" width={230} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${inteiro(v)} entidades`}
                descricao="Número de entidades do levantamento que declararam atuar na área temática. Cada entidade pode atuar em várias áreas."
              />
            } />
            <Bar dataKey="entidades" name="Entidades" fill="#b3a06b" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="painel">
        <h2>Avaliação dos CMDRS por tema</h2>
        <ResponsiveContainer width="100%" height={460}>
          <BarChart data={analise} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 3]} tickCount={4} />
            <YAxis type="category" dataKey="tema" width={200} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${decimal(v, 2)} de 3,00`}
                descricao="Nota média atribuída pelos conselhos municipais: situação atual do tema versus relevância percebida. A lacuna entre as duas barras aponta onde a ATER é mais demandada do que atendida."
              />
            } />
            <Legend />
            <Bar dataKey="situacao" name="Situação atual" fill="#d98e4a" />
            <Bar dataKey="relevancia" name="Relevância" fill="#6b5427" />
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">
          Notas de 0 a 3 atribuídas pelos conselhos: a lacuna entre relevância e situação atual
          aponta onde a ATER é mais demandada do que atendida.
        </p>
      </section>

      <TabelaMunicipios municipios={municipios} filtros={filtros} aoRemoverFiltro={removerFiltro} />

      <section className="painel">
        <h2>Metodologia</h2>
        <p style={{ margin: 0 }}>
          O ID-ATER é cálculo próprio da rede, reconstruído e validado a partir dos insumos do
          levantamento. As funções de fator, a reconciliação com a fonte primária, as correções
          estruturais aplicadas e os indicadores constantes estão detalhados na{' '}
          <a href="#/metodologia">página de Metodologia</a>.
        </p>
      </section>

      <p className="fonte">
        Fonte: {meta.fonte}. O levantamento é refeito a cada quatro anos. Agregado gerado em{' '}
        {new Date(meta.geradoEm).toLocaleDateString('pt-BR')}.
      </p>
    </>
  );
}

function Card({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="valor">{valor}</div>
    </div>
  );
}
