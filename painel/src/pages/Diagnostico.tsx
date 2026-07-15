import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts';
import { diagnostico } from '../lib/diagnostico';
import { decimal, indice, inteiro, porcentagem } from '../lib/formato';
import { TabelaMunicipios } from '../components/TabelaMunicipios';

const CORES = ['#2e6e3a', '#5aa66a', '#88c596', '#b7e0c0', '#d9efde', '#f4a261', '#e76f51', '#4d6b9a'];
// Escala divergente do vermelho (índice baixo) ao verde (índice alto).
const CORES_FAIXA = ['#e76f51', '#f4a261', '#e9c46a', '#88c596', '#2e6e3a'];
const CORES_CONSELHO = ['#2e6e3a', '#f4a261', '#e76f51'];

const { meta, resumo, indice: idx, governanca, entidades, profissionais, analise, municipios } = diagnostico;

export function Diagnostico() {
  const indicadores = [...idx.indicadores].sort((a, b) => b.aproveitamento - a.aproveitamento);
  const estrutura = [...governanca.estrutura].sort((a, b) => b.sim - a.sim);
  const constantes = meta.indicadoresConstantes;
  const notaConstantes = constantes.length > 0
    ? `${constantes.length} indicadores são constantes em todos os municípios (${porcentagem(meta.pesoConstante * 100, 0)} do peso): ${constantes.map((c) => c.nome).join(', ')}. Como não variam, o índice diferencia os municípios pelos demais indicadores.`
    : '';

  return (
    <>
      <p className="intro">
        O <strong>Índice de Desenvolvimento da ATER (ID-ATER)</strong> resume, numa escala de
        0,1 a 1,0, a capacidade instalada de assistência técnica em cada município, a partir de
        11 indicadores agrupados em três áreas — Situação da ATER (40%), Abrangência (20%) e
        Impacto da ATER (40%). Os números vêm do Levantamento da Capacidade Instalada de ATER,
        realizado pelas Unidades Regionais do IDR-Paraná nos {inteiro(resumo.municipios)} municípios.
      </p>

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
            <Tooltip />
            <Bar dataKey="municipios" name="Municípios">
              {idx.faixas.map((_, i) => (
                <Cell key={i} fill={CORES_FAIXA[i % CORES_FAIXA.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">
          ID-ATER de {indice(resumo.idAterMinimo)} a {indice(resumo.idAterMaximo)};
          mediana de {indice(resumo.idAterMediana)}.
        </p>
      </section>

      <section className="painel">
        <h2>ID-ATER médio por regional</h2>
        <ResponsiveContainer width="100%" height={620}>
          <BarChart data={idx.porRegional} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => decimal(Number(v), 1)} />
            <YAxis type="category" dataKey="regional" width={140} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => indice(Number(v))} />
            <ReferenceLine
              x={resumo.idAterMedio}
              stroke="#57606a"
              strokeDasharray="4 4"
              label={{ value: `média ${indice(resumo.idAterMedio)}`, position: 'top', fontSize: 11 }}
            />
            <Bar dataKey="media" name="ID-ATER médio" fill="#2e6e3a" />
          </BarChart>
        </ResponsiveContainer>
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
            <Tooltip formatter={(v) => porcentagem(Number(v) * 100)} />
            <Bar dataKey="aproveitamento" name="Aproveitamento" fill="#5aa66a" />
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
              <Tooltip />
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
              <Tooltip />
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
            <Tooltip />
            <Bar dataKey="sim" name="Municípios com" fill="#2e6e3a" />
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
            <Tooltip formatter={(v) => inteiro(Number(v))} />
            <Bar dataKey="profissionais" name="Profissionais" fill="#5aa66a" />
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
            <Tooltip formatter={(v) => inteiro(Number(v))} />
            <Bar dataKey="entidades" name="Entidades" fill="#88c596" />
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
            <Tooltip formatter={(v) => decimal(Number(v), 2)} />
            <Legend />
            <Bar dataKey="situacao" name="Situação atual" fill="#f4a261" />
            <Bar dataKey="relevancia" name="Relevância" fill="#2e6e3a" />
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">
          Notas de 0 a 3 atribuídas pelos conselhos: a lacuna entre relevância e situação atual
          aponta onde a ATER é mais demandada do que atendida.
        </p>
      </section>

      <TabelaMunicipios municipios={municipios} />

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
