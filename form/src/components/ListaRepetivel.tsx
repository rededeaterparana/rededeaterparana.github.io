import { ReactNode } from 'react';
import { useFieldArray, Control, FieldValues, ArrayPath } from 'react-hook-form';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: ArrayPath<T>;
  titulo: string;
  // Tipado como `any` porque o union de todos os field arrays do schema
  // não estreita por `name` — a validação real acontece via Zod no submit.
  itemPadrao: Record<string, unknown>;
  textoAdicionar?: string;
  renderItem: (index: number) => ReactNode;
}

export function ListaRepetivel<T extends FieldValues>({
  control, name, titulo, itemPadrao, textoAdicionar, renderItem
}: Props<T>) {
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div>
      <h3 style={{ fontSize: '1rem', margin: '4px 0 12px' }}>{titulo}</h3>
      {fields.map((f, i) => (
        <div key={f.id} className="lista-item">
          {renderItem(i)}
          <div className="acoes">
            <button type="button" className="remover" onClick={() => remove(i)}>Remover</button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="secundario"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={() => append(itemPadrao as any)}
      >
        {textoAdicionar || `+ Adicionar ${titulo.toLowerCase()}`}
      </button>
    </div>
  );
}
