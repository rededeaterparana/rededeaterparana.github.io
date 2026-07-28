import type { ReactNode } from 'react';

interface Props {
  kicker: string;
  titulo: string;
  children?: ReactNode;
}

/** Cabeçalho padrão de página: sobretítulo do grupo, título e texto de abertura. */
export function PageHeader({ kicker, titulo, children }: Props) {
  return (
    <header className="pagina-cabecalho">
      <p className="kicker">{kicker}</p>
      <h1>{titulo}</h1>
      {children && <div className="pagina-descricao">{children}</div>}
    </header>
  );
}
