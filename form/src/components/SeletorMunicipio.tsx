import { useId } from 'react';
import { MUNICIPIOS_PR, buscarPorNome } from '../data/municipios';

interface Props {
  /** Nome do município selecionado (controlado) */
  valorNome: string;
  /** Chamado com o município completo quando o usuário escolhe um da lista */
  aoEscolher: (nome: string, codigoIbge: string) => void;
  placeholder?: string;
}

/**
 * Input com datalist contendo os 399 municípios do Paraná.
 * Quando o usuário digita um nome que corresponde a um município conhecido,
 * dispara `aoEscolher` com nome e código IBGE preenchidos.
 */
export function SeletorMunicipio({ valorNome, aoEscolher, placeholder }: Props) {
  const listId = useId();
  return (
    <>
      <input
        type="text"
        list={listId}
        autoComplete="off"
        placeholder={placeholder || 'digite o nome do município'}
        value={valorNome}
        onChange={(e) => {
          const nome = e.target.value;
          const m = buscarPorNome(nome);
          aoEscolher(nome, m?.codigo_ibge || '');
        }}
      />
      <datalist id={listId}>
        {MUNICIPIOS_PR.map((m) => (
          <option key={m.codigo_ibge} value={m.nome} />
        ))}
      </datalist>
    </>
  );
}
