import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useEntidades } from '../hooks/useEntidades';
import { atendimentoPorRegional, municipiosAtendidos, porChave, serieAdesoes } from '../lib/agregacoes';
import { diagnostico } from '../lib/diagnostico';
import { PageHeader } from '../components/PageHeader';
import { Carregando } from '../components/Carregando';
import { GraficoTooltip } from '../components/GraficoTooltip';
import { CardResumo as Card } from '../components/CardResumo';

const CORES = ['#6b5427', '#8f7743', '#b3a06b', '#d6cba8', '#ece5cf', '#c46f3f', '#a03024'];

export function Visao() {
  const { dados, carregando, erro } = useEntidades();

  const cabecalho = (
    <PageHeader
      kicker="A rede"
      titulo="Visão geral da rede"
      fonte="cadastro de adesão à rede, preenchido pelas próprias entidades no formulário deste site. Não se confunde com o Levantamento do IDR-Paraná (página Diagnóstico) nem com a pesquisa de CNPJs (página Empresas)."
    >
      <p>
        Entidades que aderiram à Rede Paranaense de ATER pelo formulário público:
        quantas são, onde estão e como as adesões evoluem ao longo do tempo.
      </p>
    </PageHeader>
  );

  if (carregando) return <>{cabecalho}<Carregando /></>;
  if (erro) return <>{cabecalho}<div className="erro">Falha ao carregar: {erro}</div></>;
  if (!dados || dados.entidades.length === 0) {
    return <>{cabecalho}<div className="aviso-vazio">Nenhuma entidade cadastrada ainda.</div></>;
  }

  const atendidos = municipiosAtendidos(dados.entidades).size;
  const totalMunicipios = diagnostico.municipios.length;
  const coberturaRegional = atendimentoPorRegional(dados.entidades).map((r) => ({
    ...r,
    cobertura: r.total ? Math.round((r.atendidos / r.total) * 1000) / 10 : 0
  }));
  const porTipo = porChave<string>(dados.entidades, 'tipo_entidade');
  const serie = serieAdesoes(dados.entidades);

  return (
    <>
      {cabecalho}
      <div className="cards">
        <Card label="Entidades cadastradas" valor={dados.total} />
        <Card
          label="Municípios atendidos"
          valor={atendidos}
          nota={`de ${totalMunicipios} no Paraná`}
        />
        <Card label="Tipos de entidade" valor={porTipo.length} />
        <Card label="Atualizado em" valor={new Date(dados.gerado_em).toLocaleString('pt-BR')} pequeno />
      </div>

      <section className="painel">
        <h2>Municípios atendidos por regional do IDR</h2>
        <ResponsiveContainer width="100%" height={Math.max(320, coberturaRegional.length * 28)}>
          <BarChart data={coberturaRegional} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="regional" width={140} tick={{ fontSize: 12 }} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v, _nome) => `${v.toLocaleString('pt-BR')}% dos municípios`}
                descricao="Parcela dos municípios da regional em que ao menos uma entidade da rede declarou atuar no cadastro de adesão — não só a sede."
              />
            } />
            <Bar dataKey="cobertura" name="Municípios atendidos" fill="#6b5427" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">
          Conta os municípios de atuação declarados pelas entidades, não apenas o
          município da sede. Passe o mouse para ver o percentual de cada regional.
        </p>
      </section>

      <section className="painel">
        <h2>Distribuição por tipo de entidade</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={porTipo}
              dataKey="valor"
              nameKey="nome"
              outerRadius={110}
              label={(p) => `${p.payload?.nome}: ${p.payload?.valor}`}
            >
              {porTipo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
            </Pie>
            <Legend />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${v} entidade${v === 1 ? '' : 's'}`}
                descricao="Distribuição das entidades cadastradas por tipo declarado na adesão (cooperativa, associação, empresa privada etc.)."
              />
            } />
          </PieChart>
        </ResponsiveContainer>
      </section>

      <section className="painel">
        <h2>Adesões ao longo do tempo</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis allowDecimals={false} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${v} adesão${v === 1 ? '' : 'ões'}`}
                descricao="Número de entidades que enviaram o cadastro de adesão em cada mês."
              />
            } />
            <Line type="monotone" dataKey="total" name="Adesões no mês" stroke="#6b5427" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}
