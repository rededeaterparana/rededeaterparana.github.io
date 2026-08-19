import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { empresas } from '../lib/empresas';
import { regionalDoMunicipio } from '../lib/regionais';
import { inteiro, porcentagem } from '../lib/formato';
import { PageHeader } from '../components/PageHeader';
import { GraficoTooltip } from '../components/GraficoTooltip';
import { FiltroRegional } from '../components/FiltroRegional';

const CORES = ['#6b5427', '#8f7743', '#b3a06b', '#d6cba8', '#ece5cf', '#c46f3f', '#a03024', '#4d6b9a'];

const { meta, resumo, categorias, cnaes, portes, municipios, pontos } = empresas;

export function Empresas() {
  const geoFina = resumo.geocodificadasRua + resumo.geocodificadasCep;
  const [regionalSel, setRegionalSel] = useState<string | null>(null);

  // A junção com a regional do IDR é feita pelo código IBGE do município,
  // presente nos pontos (todos os 399 municípios têm regional).
  const pontosVisiveis = useMemo(
    () => regionalSel
      ? pontos.filter((p) => regionalDoMunicipio(Number(p.ibge)) === regionalSel)
      : pontos,
    [regionalSel],
  );

  const resumoRegional = useMemo(() => {
    if (!regionalSel) return null;
    const total = pontosVisiveis.reduce((t, p) => t + p.empresas, 0);
    return { empresas: total, municipios: pontosVisiveis.length };
  }, [regionalSel, pontosVisiveis]);

  const municipiosVisiveis = useMemo(
    () => regionalSel
      ? [...pontosVisiveis]
          .sort((a, b) => b.empresas - a.empresas)
          .slice(0, 25)
          .map((p) => ({ municipio: p.municipio, empresas: p.empresas }))
      : municipios,
    [regionalSel, pontosVisiveis],
  );

  return (
    <>
      <PageHeader
        kicker="Contexto rural"
        titulo="Empresas do meio rural no Paraná"
        fonte="Dados Abertos do CNPJ da Receita Federal, pesquisa própria da rede. É independente do Levantamento da Capacidade Instalada do IDR-Paraná (página Diagnóstico) e do cadastro de adesão à rede."
      >
        <p>
          Empresas e cooperativas com CNPJ <strong>ativo no Paraná</strong> cujas atividades (CNAEs)
          se relacionam ao meio rural: apoio à produção agrícola, pecuária e florestal, atividades
          veterinárias, crédito rural e a própria produção animal, geocodificadas com as camadas do
          banco geográfico da rede.
        </p>
        <p>
          Estas empresas <strong>não são, por si só, prestadoras de ATER</strong>. As entidades de
          ATER são as que aderem à rede pelo formulário de cadastro; elas podem estar neste
          universo, mas a pesquisa não se restringe a elas. O conjunto descreve o contexto
          empresarial rural em que a rede atua.
        </p>
      </PageHeader>

      <FiltroRegional
        valor={regionalSel}
        aoMudar={setRegionalSel}
        nota="Cards, mapa de pontos e ranking de municípios refletem a regional; categorias, porte e CNAEs seguem estaduais, pois a pesquisa só os agrega no estado."
      />

      {resumoRegional ? (
        <div className="cards">
          <Card label="Empresas ativas" valor={inteiro(resumoRegional.empresas)} />
          <Card label="Municípios" valor={inteiro(resumoRegional.municipios)} />
          <Card
            label="Participação no estado"
            valor={porcentagem(100 * resumoRegional.empresas / resumo.empresas, 1)}
          />
          <Card label="Categorias de atividade" valor={inteiro(categorias.length)} />
        </div>
      ) : (
        <div className="cards">
          <Card label="Empresas ativas" valor={inteiro(resumo.empresas)} />
          <Card label="Municípios" valor={inteiro(resumo.municipios)} />
          <Card label="Geocodif. rua/CEP" valor={porcentagem(100 * geoFina / resumo.empresas, 1)} />
          <Card label="Categorias de atividade" valor={inteiro(categorias.length)} />
        </div>
      )}

      <section className="painel">
        <h2>Distribuição espacial (por município){regionalSel ? ` — ${regionalSel}` : ''}</h2>
        <ResponsiveContainer width="100%" height={460}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="lon" name="Longitude" domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => Number(v).toFixed(1)} tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="lat" name="Latitude" domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => Number(v).toFixed(1)} tick={{ fontSize: 11 }} />
            <ZAxis type="number" dataKey="empresas" range={[10, 600]} name="Empresas" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={
              <GraficoTooltip
                campoTitulo="municipio"
                ocultar={['Longitude', 'Latitude']}
                formatador={(v) => inteiro(v)}
                descricao="Cada ponto é um município, posicionado pelo centroide; o tamanho do ponto reflete o número de empresas com CNAEs rurais ali sediadas."
              />
            } />
            <Scatter data={pontosVisiveis} fill="#6b5427" fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="legenda">
          Cada ponto é um município, posicionado pelo seu centroide (longitude × latitude); o tamanho
          reflete o número de empresas.
          {regionalSel
            ? ' Exibindo apenas os municípios da regional selecionada.'
            : ' O contorno formado aproxima o mapa do Paraná.'}
        </p>
      </section>

      <section className="painel">
        <h2>Empresas por categoria de atividade</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categorias} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="categoria" width={150} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${inteiro(v)} empresas`}
                descricao="Empresas ativas por categoria de atividade: agrupamento dos CNAEs pesquisados (apoio à produção, veterinária, crédito rural, produção animal etc.)."
              />
            } />
            <Bar dataKey="empresas" name="Empresas">
              {categorias.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="dupla">
        <section className="painel">
          <h2>Porte das empresas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={portes} dataKey="empresas" nameKey="porte" outerRadius={100}
                label={(p) => `${p.payload?.porte}: ${inteiro(Number(p.payload?.empresas))}`}>
                {portes.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>
              <Legend />
              <Tooltip content={
                <GraficoTooltip
                  formatador={(v) => `${inteiro(v)} empresas`}
                  descricao="Porte declarado no CNPJ segundo a classificação da Receita Federal (ME, EPP, demais)."
                />
              } />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="painel">
          <h2>Principais CNAEs</h2>
          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Atividade (CNAE)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Empresas</th>
                </tr>
              </thead>
              <tbody>
                {cnaes.map((c) => (
                  <tr key={c.cnae}>
                    <td>{c.descricao}</td>
                    <td style={{ textAlign: 'right' }}>{inteiro(c.empresas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="painel">
        <h2>Municípios com mais empresas{regionalSel ? ` — ${regionalSel}` : ''}</h2>
        <ResponsiveContainer width="100%" height={520}>
          <BarChart data={municipiosVisiveis} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="municipio" width={140} tick={{ fontSize: 11 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${inteiro(v)} empresas`}
                descricao="Empresas ativas com CNAEs rurais sediadas no município, segundo os Dados Abertos do CNPJ."
              />
            } />
            <Bar dataKey="empresas" name="Empresas" fill="#8f7743" />
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">
          {regionalSel
            ? `Municípios da regional ${regionalSel} com maior número de empresas com atividades ligadas ao meio rural (até 25).`
            : 'Os 25 municípios com maior número de empresas com atividades ligadas ao meio rural.'}
        </p>
      </section>

      <p className="fonte">
        Fonte: {meta.fonte}. {meta.observacaoLGPD} Geocodificação: {porcentagem(100 * resumo.geocodificadasRua / resumo.empresas, 1)} nível
        rua, {porcentagem(100 * resumo.geocodificadasCep / resumo.empresas, 1)} nível CEP,
        {' '}{porcentagem(100 * resumo.geocodificadasMunicipio / resumo.empresas, 1)} centroide municipal.
        Gerado em {new Date(meta.geradoEm).toLocaleDateString('pt-BR')}.
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
