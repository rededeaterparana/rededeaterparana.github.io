import { useMemo, useState } from 'react';
import { useEntidades } from '../hooks/useEntidades';

export function Lista() {
  const { dados, carregando, erro } = useEntidades();
  const [filtro, setFiltro] = useState('');

  const filtradas = useMemo(() => {
    if (!dados) return [];
    const f = filtro.toLowerCase().trim();
    if (!f) return dados.entidades;
    return dados.entidades.filter((e) =>
      [e.razao_social, e.nome_fantasia, e.municipio, e.uf, e.tipo_entidade]
        .join(' ').toLowerCase().includes(f)
    );
  }, [dados, filtro]);

  if (carregando) return <p>Carregando...</p>;
  if (erro) return <div className="erro">{erro}</div>;
  if (!dados) return null;

  return (
    <section className="painel">
      <h2>Entidades da rede ({filtradas.length})</h2>
      <input
        className="busca"
        aria-label="Buscar entidades"
        placeholder="buscar por nome, município, UF..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Razão social</th>
              <th>Nome fantasia</th>
              <th>Tipo</th>
              <th>Município</th>
              <th>UF</th>
              <th>Equipe</th>
              <th>Municípios atendidos</th>
              <th>Adesão</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((e) => (
              <tr key={e.cnpj_mascarado + e.razao_social}>
                <td>{e.razao_social}</td>
                <td>{e.nome_fantasia}</td>
                <td>{e.tipo_entidade}</td>
                <td>{e.municipio}</td>
                <td>{e.uf}</td>
                <td>{e.equipe_total}</td>
                <td>{e.area_atuacao}</td>
                <td>{e.criado_em ? new Date(e.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
