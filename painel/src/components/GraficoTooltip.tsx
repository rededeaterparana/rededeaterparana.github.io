interface ItemPayload {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface Props {
  active?: boolean;
  payload?: ItemPayload[];
  label?: string | number;
  /** Explicação da métrica exibida, mostrada abaixo dos valores. */
  descricao?: string;
  /** Dica de interação (ex.: clique para filtrar), destacada ao final. */
  acao?: string;
  /** Formata o valor numérico; recebe também o nome da série. */
  formatador?: (valor: number, nome: string) => string;
  /** Campo do dado usado como título (ex.: "municipio" no gráfico de dispersão). */
  campoTitulo?: string;
  /** Nomes de séries a omitir das linhas de valor (ex.: eixos de coordenada). */
  ocultar?: string[];
}

/** Tooltip padrão dos gráficos: título, valores formatados e descrição da métrica. */
export function GraficoTooltip({ active, payload: bruto, label, descricao, acao, formatador, campoTitulo, ocultar }: Props) {
  if (!active || !bruto || bruto.length === 0) return null;

  const payload = ocultar ? bruto.filter((p) => !ocultar.includes(String(p.name ?? ''))) : bruto;
  if (payload.length === 0) return null;

  const doPayload = campoTitulo ? payload[0].payload?.[campoTitulo] : undefined;
  const titulo = typeof doPayload === 'string'
    ? doPayload
    : label !== undefined && label !== null && String(label) !== ''
      ? String(label)
      : String(payload[0].name ?? '');
  const tituloRepetido = payload.length === 1 && titulo === String(payload[0].name ?? '');

  return (
    <div className="grafico-tooltip" role="status">
      {titulo && <p className="grafico-tooltip-titulo">{titulo}</p>}
      {payload.map((p, i) => {
        const nome = String(p.name ?? '');
        const valor = typeof p.value === 'number' && formatador
          ? formatador(p.value, nome)
          : String(p.value ?? '');
        return (
          <p className="grafico-tooltip-valor" key={`${nome}-${i}`}>
            {p.color && <span className="grafico-tooltip-cor" style={{ background: p.color }} aria-hidden="true" />}
            {tituloRepetido ? <strong>{valor}</strong> : <>{nome}: <strong>{valor}</strong></>}
          </p>
        );
      })}
      {descricao && <p className="grafico-tooltip-descricao">{descricao}</p>}
      {acao && <p className="grafico-tooltip-acao">{acao}</p>}
    </div>
  );
}
