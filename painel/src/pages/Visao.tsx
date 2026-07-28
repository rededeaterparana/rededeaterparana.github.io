import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useEntidades } from '../hooks/useEntidades';
import { porChave, serieAdesoes } from '../lib/agregacoes';
import { PageHeader } from '../components/PageHeader';
import { Carregando } from '../components/Carregando';
import { GraficoTooltip } from '../components/GraficoTooltip';

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

  const porMunicipio = porChave<string>(dados.entidades, 'municipio');
  const porTipo = porChave<string>(dados.entidades, 'tipo_entidade');
  const serie = serieAdesoes(dados.entidades);

  return (
    <>
      {cabecalho}
      <div className="cards">
        <Card label="Entidades cadastradas" valor={dados.total} />
        <Card label="Municípios com entidades" valor={porMunicipio.length} />
        <Card label="Tipos de entidade" valor={porTipo.length} />
        <Card label="Atualizado em" valor={new Date(dados.gerado_em).toLocaleString('pt-BR')} pequeno />
      </div>

      <section className="painel">
        <h2>Entidades por município</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porMunicipio}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome" />
            <YAxis allowDecimals={false} />
            <Tooltip content={
              <GraficoTooltip
                formatador={(v) => `${v} entidade${v === 1 ? '' : 's'}`}
                descricao="Entidades cadastradas na rede com sede neste município, segundo o formulário de adesão."
              />
            } />
            <Bar dataKey="valor" name="Entidades" fill="#6b5427" />
          </BarChart>
        </ResponsiveContainer>
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

function Card({ label, valor, pequeno }: { label: string; valor: number | string; pequeno?: boolean }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="valor" style={pequeno ? { fontSize: '0.95rem' } : undefined}>{valor}</div>
    </div>
  );
}
