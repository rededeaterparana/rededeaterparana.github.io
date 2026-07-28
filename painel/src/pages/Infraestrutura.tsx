import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEntidades } from '../hooks/useEntidades';
import { somaInfra } from '../lib/agregacoes';
import { PageHeader } from '../components/PageHeader';
import { Carregando } from '../components/Carregando';

export function Infraestrutura() {
  const { dados, carregando, erro } = useEntidades();

  const cabecalho = (
    <PageHeader kicker="A rede" titulo="Infraestrutura da rede">
      <p>
        Capacidade instalada declarada pelas entidades no ato de adesão:
        veículos, imóveis e equipamentos disponíveis para o serviço de ATER.
      </p>
    </PageHeader>
  );

  if (carregando) return <>{cabecalho}<Carregando /></>;
  if (erro) return <>{cabecalho}<div className="erro">{erro}</div></>;
  if (!dados || dados.entidades.length === 0) {
    return <>{cabecalho}<div className="aviso-vazio">Sem dados.</div></>;
  }

  const totais = somaInfra(dados.entidades);

  return (
    <>
    {cabecalho}
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
      <p className="legenda">
        Totais somados a partir das declarações das entidades. Veículos, imóveis e
        equipamentos refletem a capacidade instalada declarada.
      </p>
    </section>
    </>
  );
}
