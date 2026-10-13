import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEntidades } from '../hooks/useEntidades';
import { municipiosAtendidos, somaInfra, totalExtensionistas } from '../lib/agregacoes';
import { PageHeader } from '../components/PageHeader';
import { Carregando } from '../components/Carregando';
import { GraficoTooltip } from '../components/GraficoTooltip';
import { CardResumo } from '../components/CardResumo';

export function Infraestrutura() {
  const { dados, carregando, erro } = useEntidades();

  const cabecalho = (
    <PageHeader
      kicker="A rede"
      titulo="Infraestrutura da rede"
      fonte="cadastro de adesão à rede, preenchido pelas próprias entidades no formulário deste site."
    >
      <p>
        Capacidade instalada declarada pelas entidades no ato de adesão:
        extensionistas, veículos, imóveis e equipamentos disponíveis para o
        serviço de ATER.
      </p>
    </PageHeader>
  );

  if (carregando) return <>{cabecalho}<Carregando /></>;
  if (erro) return <>{cabecalho}<div className="erro">{erro}</div></>;
  if (!dados || dados.entidades.length === 0) {
    return <>{cabecalho}<div className="aviso-vazio">Sem dados.</div></>;
  }

  const totais = somaInfra(dados.entidades);
  const extensionistas = totalExtensionistas(dados.entidades);
  const atendidos = municipiosAtendidos(dados.entidades).size;

  return (
    <>
    {cabecalho}
    <div className="cards">
      <CardResumo
        label="Extensionistas"
        valor={extensionistas.toLocaleString('pt-BR')}
        nota="equipe técnica declarada"
      />
      <CardResumo label="Municípios atendidos" valor={atendidos} nota="área de atuação declarada" />
    </div>
    <section className="painel">
      <h2>Infraestrutura agregada da rede</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={totais}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="categoria" />
          <YAxis allowDecimals={false} />
          <Tooltip content={
            <GraficoTooltip
              formatador={(v) => `${v} ite${v === 1 ? 'm' : 'ns'}`}
              descricao="Soma dos itens declarados por todas as entidades no cadastro de adesão: veículos, imóveis e equipamentos de informática, rede e uso do extensionista."
            />
          } />
          <Bar dataKey="total" name="Itens declarados" fill="#8f7743" />
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
