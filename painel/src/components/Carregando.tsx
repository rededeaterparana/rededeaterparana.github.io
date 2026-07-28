/** Esqueleto de carregamento: mantém a estrutura da página enquanto os dados chegam. */
export function Carregando() {
  return (
    <div className="esqueleto" role="status" aria-live="polite" aria-label="Carregando dados">
      <div className="esqueleto-cards">
        {[0, 1, 2, 3].map((i) => <div className="esqueleto-bloco esqueleto-card" key={i} />)}
      </div>
      <div className="esqueleto-bloco esqueleto-painel" />
      <div className="esqueleto-bloco esqueleto-painel" />
      <span className="sr-only">Carregando dados…</span>
    </div>
  );
}
