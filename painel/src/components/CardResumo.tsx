/** Número de destaque com rótulo, usado nas faixas de resumo das páginas. */
export function CardResumo({ label, valor, nota, pequeno }: {
  label: string;
  valor: number | string;
  nota?: string;
  pequeno?: boolean;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="valor" style={pequeno ? { fontSize: '0.95rem' } : undefined}>{valor}</div>
      {nota && <div className="nota">{nota}</div>}
    </div>
  );
}
