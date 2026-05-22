import { useEffect, useMemo, useRef, useState } from 'react';
import { MUNICIPIOS_PR, normalizar, buscarPorNome } from '../data/municipios';

interface Props {
  /** Nome do município (controlado) */
  valorNome: string;
  /** Disparado ao escolher um item da lista; recebe nome canônico e código IBGE */
  aoEscolher: (nome: string, codigoIbge: string) => void;
  placeholder?: string;
}

const MAX_RESULTADOS = 50;

/**
 * Combobox de municípios paranaenses. Lista ordenada alfabeticamente,
 * filtra por substring ignorando acentos e maiúsculas/minúsculas.
 */
export function SeletorMunicipio({ valorNome, aoEscolher, placeholder }: Props) {
  const [filtro, setFiltro] = useState(valorNome);
  const [aberto, setAberto] = useState(false);
  const [destacado, setDestacado] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Mantém o input sincronizado quando o valor controlado muda externamente.
  useEffect(() => { setFiltro(valorNome); }, [valorNome]);

  const filtrados = useMemo(() => {
    const q = normalizar(filtro);
    if (!q) return MUNICIPIOS_PR.slice(0, MAX_RESULTADOS);
    return MUNICIPIOS_PR
      .filter((m) => normalizar(m.nome).includes(q))
      .slice(0, MAX_RESULTADOS);
  }, [filtro]);

  useEffect(() => { setDestacado(0); }, [filtro]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function aoCliqueFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', aoCliqueFora);
    return () => document.removeEventListener('mousedown', aoCliqueFora);
  }, []);

  function escolher(nome: string) {
    const m = buscarPorNome(nome);
    setFiltro(nome);
    aoEscolher(nome, m?.codigo_ibge || '');
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setDestacado((d) => Math.min(d + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestacado((d) => Math.max(d - 1, 0));
    } else if (e.key === 'Enter') {
      if (aberto && filtrados[destacado]) {
        e.preventDefault();
        escolher(filtrados[destacado].nome);
      }
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  }

  return (
    <div className="combo" ref={wrapperRef}>
      <input
        type="text"
        autoComplete="off"
        placeholder={placeholder || 'digite o nome do município'}
        value={filtro}
        onChange={(e) => { setFiltro(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
      />
      {aberto && filtrados.length > 0 && (
        <ul className="combo-lista" role="listbox">
          {filtrados.map((m, i) => (
            <li
              key={m.codigo_ibge}
              role="option"
              aria-selected={i === destacado}
              className={i === destacado ? 'destacado' : undefined}
              onMouseDown={(e) => { e.preventDefault(); escolher(m.nome); }}
              onMouseEnter={() => setDestacado(i)}
            >
              <span>{m.nome}</span>
              <span className="combo-meta">{m.codigo_ibge}</span>
            </li>
          ))}
          {filtrados.length === MAX_RESULTADOS && (
            <li className="combo-aviso">refine a busca ({MAX_RESULTADOS}+ resultados)</li>
          )}
        </ul>
      )}
      {aberto && filtrados.length === 0 && (
        <ul className="combo-lista">
          <li className="combo-aviso">nenhum município encontrado</li>
        </ul>
      )}
    </div>
  );
}
