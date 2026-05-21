import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEntidades } from '../hooks/useEntidades';
import { somaInfra } from '../lib/agregacoes';

export function Infraestrutura() {
  const { dados, carregando, erro } = useEntidades();
  if (carregando) return <p>Carregando...</p>;
  if (erro) return <div className="erro">{erro}</div>;
  if (!dados || dados.entidades.length === 0) return <div className="aviso-vazio">Sem dados.</div>;

  const totais = somaInfra(dados.entidades);

  return (
    <section className="painel">
      <h2>Infraestrutura agregada da rede</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={totais}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="categoria" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="total" fill="#5aa66a" />
        </BarChart>
      </ResponsiveContainer>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>
        Totais somados a partir das declarações das entidades. Veículos, imóveis e
        equipamentos refletem a capacidade instalada declarada.
      </p>
    </section>
  );
}
