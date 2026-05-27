import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useEntidades } from '../hooks/useEntidades';
import { porChave, serieAdesoes } from '../lib/agregacoes';

const CORES = ['#2e6e3a', '#5aa66a', '#88c596', '#b7e0c0', '#d9efde', '#f4a261', '#e76f51'];

export function Visao() {
  const { dados, carregando, erro } = useEntidades();
  if (carregando) return <p>Carregando...</p>;
  if (erro) return <div className="erro">Falha ao carregar: {erro}</div>;
  if (!dados || dados.entidades.length === 0) {
    return <div className="aviso-vazio">Nenhuma entidade cadastrada ainda.</div>;
  }

  const porMunicipio = porChave<string>(dados.entidades, 'municipio');
  const porTipo = porChave<string>(dados.entidades, 'tipo_entidade');
  const serie = serieAdesoes(dados.entidades);

  return (
    <>
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
            <Tooltip />
            <Bar dataKey="valor" fill="#2e6e3a" />
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
            <Tooltip />
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
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#2e6e3a" strokeWidth={2} />
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
