import { useMemo, useState } from 'react';
import type { Municipio } from '../lib/diagnostico';
import { decimal, indice, inteiro, porcentagem } from '../lib/formato';

type Coluna = keyof Pick<
  Municipio,
  'nome' | 'regional' | 'idAter' | 'taxaAter' | 'estabRurais' | 'estabAgf' | 'tecnicos' | 'equivTecnico'
>;

const COLUNAS: { chave: Coluna; rotulo: string; numerica: boolean }[] = [
  { chave: 'nome', rotulo: 'Município', numerica: false },
  { chave: 'regional', rotulo: 'Regional', numerica: false },
  { chave: 'idAter', rotulo: 'ID-ATER', numerica: true },
  { chave: 'taxaAter', rotulo: 'Taxa de ATER', numerica: true },
  { chave: 'estabRurais', rotulo: 'Estab. rurais', numerica: true },
  { chave: 'estabAgf', rotulo: 'Agric. familiar', numerica: true },
  { chave: 'tecnicos', rotulo: 'Técnicos', numerica: true },
  { chave: 'equivTecnico', rotulo: 'Equiv. técnico', numerica: true },
];

function celula(m: Municipio, coluna: Coluna): string {
  switch (coluna) {
    case 'nome': return m.nome;
    case 'regional': return m.regional;
    case 'idAter': return indice(m.idAter);
    case 'taxaAter': return porcentagem(m.taxaAter);
    case 'estabRurais': return inteiro(m.estabRurais);
    case 'estabAgf': return inteiro(m.estabAgf);
    case 'tecnicos': return inteiro(m.tecnicos);
    case 'equivTecnico': return decimal(m.equivTecnico, 2);
  }
}

export function TabelaMunicipios({ municipios }: { municipios: Municipio[] }) {
  const [filtro, setFiltro] = useState('');
  const [coluna, setColuna] = useState<Coluna>('idAter');
  const [descendente, setDescendente] = useState(true);

  const linhas = useMemo(() => {
    const f = filtro.toLowerCase().trim();
    const filtradas = f
      ? municipios.filter((m) => `${m.nome} ${m.regional} ${m.meso}`.toLowerCase().includes(f))
      : municipios;
    const ordenadas = [...filtradas].sort((a, b) => {
      const va = a[coluna];
      const vb = b[coluna];
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR');
      return descendente ? -cmp : cmp;
    });
    return ordenadas;
  }, [municipios, filtro, coluna, descendente]);

  function ordenarPor(alvo: Coluna, numerica: boolean) {
    if (alvo === coluna) {
      setDescendente((d) => !d);
    } else {
      setColuna(alvo);
      setDescendente(numerica); // números começam do maior; textos, de A a Z
    }
  }

  return (
    <section className="painel">
      <h2>Municípios ({linhas.length})</h2>
      <input
        className="busca"
        aria-label="Buscar municípios"
        placeholder="buscar por município, regional ou mesorregião..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {COLUNAS.map((c) => (
                <th
                  key={c.chave}
                  scope="col"
                  aria-sort={coluna === c.chave ? (descendente ? 'descending' : 'ascending') : 'none'}
                  style={{ textAlign: c.numerica ? 'right' : 'left' }}
                >
                  <button type="button" className="ordenar" onClick={() => ordenarPor(c.chave, c.numerica)}>
                    {c.rotulo}
                    {coluna === c.chave && <span aria-hidden="true">{descendente ? ' ▾' : ' ▴'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => (
              <tr key={m.cod}>
                {COLUNAS.map((c) => (
                  <td key={c.chave} style={{ textAlign: c.numerica ? 'right' : 'left' }}>
                    {celula(m, c.chave)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
