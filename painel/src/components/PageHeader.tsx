import type { ReactNode } from 'react';

interface Props {
  kicker: string;
  titulo: string;
  /** Origem dos dados da página, destacada para diferenciar as pesquisas. */
  fonte?: ReactNode;
  children?: ReactNode;
}

/** Cabeçalho padrão de página: sobretítulo do grupo, título, abertura e origem dos dados. */
export function PageHeader({ kicker, titulo, fonte, children }: Props) {
  return (
    <header className="pagina-cabecalho">
      <p className="kicker">{kicker}</p>
      <h1>{titulo}</h1>
      {children && <div className="pagina-descricao">{children}</div>}
      {fonte && (
        <p className="pagina-origem">
          <strong>Origem dos dados:</strong> {fonte}
        </p>
      )}
    </header>
  );
}
