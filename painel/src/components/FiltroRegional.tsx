import { REGIONAIS } from '../lib/regionais';

/**
 * Barra de filtro por regional do IDR-Paraná, compartilhada entre as páginas.
 * A `nota` aparece quando há regional selecionada, para explicar o alcance do
 * filtro (quais visões refletem a seleção e quais seguem estaduais).
 */
export function FiltroRegional({ valor, aoMudar, nota }: {
  valor: string | null;
  aoMudar: (regional: string | null) => void;
  nota?: string;
}) {
  return (
    <div className="filtro-regional" role="group" aria-label="Filtro por regional do IDR-Paraná">
      <label htmlFor="filtro-regional-select">Regional do IDR-Paraná</label>
      <select
        id="filtro-regional-select"
        value={valor ?? ''}
        onChange={(e) => aoMudar(e.target.value || null)}
      >
        <option value="">Todas as regionais ({REGIONAIS.length})</option>
        {REGIONAIS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {valor && (
        <button type="button" className="filtro-chip" onClick={() => aoMudar(null)}>
          Limpar <span aria-hidden="true">✕</span>
        </button>
      )}
      {valor && nota && <span className="filtro-regional-nota">{nota}</span>}
    </div>
  );
}
