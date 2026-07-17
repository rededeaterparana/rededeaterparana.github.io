import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { empresas } from '../lib/empresas';
import { inteiro, porcentagem } from '../lib/formato';

const CORES = ['#2e6e3a', '#5aa66a', '#88c596', '#b7e0c0', '#d9efde', '#f4a261', '#e76f51', '#4d6b9a'];

const { meta, resumo, categorias, cnaes, portes, municipios, pontos } = empresas;

export function Empresas() {
  const geoFina = resumo.geocodificadasRua + resumo.geocodificadasCep;

  return (
    <>
      <p className="intro">
        Empresas e cooperativas com CNPJ <strong>ativo no Paraná</strong> cujas atividades se ligam
        à assistência técnica e extensão rural: apoio à produção agrícola, pecuária e florestal,
        atividades veterinárias, crédito rural e a própria produção animal. Base: Dados Abertos do
        CNPJ da Receita Federal, geocodificados com as camadas do banco geográfico da rede.
      </p>

      <div className="cards">
        <Card label="Empresas ativas" valor={inteiro(resumo.empresas)} />
        <Card label="Municípios" valor={inteiro(resumo.municipios)} />
        <Card label="Geocodif. rua/CEP" valor={porcentagem(100 * geoFina / resumo.empresas, 1)} />
        <Card label="Categorias de atividade" valor={inteiro(categorias.length)} />
      </div>

      <section className="painel">
        <h2>Distribuição espacial (por município)</h2>
        <ResponsiveContainer width="100%" height={460}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="lon" name="Longitude" domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => Number(v).toFixed(1)} tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="lat" name="Latitude" domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => Number(v).toFixed(1)} tick={{ fontSize: 11 }} />
            <ZAxis type="number" dataKey="empresas" range={[10, 600]} name="Empresas" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }}
              formatter={(v, n) => [n === 'Empresas' ? inteiro(Number(v)) : Number(v).toFixed(3), n]}
              labelFormatter={() => ''} />
            <Scatter data={pontos} fill="#2e6e3a" fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="legenda">
          Cada ponto é um município, posicionado pelo seu centroide (longitude × latitude); o tamanho
          reflete o número de empresas. O contorno formado aproxima o mapa do Paraná.
        </p>
      </section>

      <section className="painel">
        <h2>Empresas por categoria de atividade</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categorias} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="categoria" width={150} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => inteiro(Number(v))} />
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
              <Tooltip formatter={(v) => inteiro(Number(v))} />
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
        <h2>Municípios com mais empresas</h2>
        <ResponsiveContainer width="100%" height={520}>
          <BarChart data={municipios} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="municipio" width={140} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => inteiro(Number(v))} />
            <Bar dataKey="empresas" name="Empresas" fill="#5aa66a" />
          </BarChart>
        </ResponsiveContainer>
        <p className="legenda">Os 25 municípios com maior número de empresas de ATER.</p>
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
