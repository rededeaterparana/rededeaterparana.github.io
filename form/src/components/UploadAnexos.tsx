import { useState } from 'react';
import { arquivoParaAnexo, AnexoPayload } from '../lib/api';

export interface TipoDocumento {
  chave: string;
  rotulo: string;
  obrigatorio: boolean;
}

interface Props {
  tipos: TipoDocumento[];
  onChange: (anexos: AnexoPayload[]) => void;
}

interface ItemEstado {
  tipo: string;
  arquivo?: File;
  erro?: string;
}

export function UploadAnexos({ tipos, onChange }: Props) {
  const [itens, setItens] = useState<ItemEstado[]>(
    tipos.map((t) => ({ tipo: t.chave }))
  );

  async function aplicar(novos: ItemEstado[]) {
    setItens(novos);
    const anexos: AnexoPayload[] = [];
    for (const it of novos) {
      if (!it.arquivo) continue;
      try {
        anexos.push(await arquivoParaAnexo(it.tipo, it.arquivo));
      } catch (e) {
        // erro mostrado no próprio item
      }
    }
    onChange(anexos);
  }

  async function aoSelecionar(idx: number, f: File | null) {
    const novos = [...itens];
    if (!f) {
      novos[idx] = { tipo: novos[idx].tipo };
    } else {
      try {
        await arquivoParaAnexo(novos[idx].tipo, f);
        novos[idx] = { tipo: novos[idx].tipo, arquivo: f };
      } catch (e) {
        novos[idx] = { tipo: novos[idx].tipo, erro: (e as Error).message };
      }
    }
    await aplicar(novos);
  }

  return (
    <div>
      {tipos.map((t, i) => (
        <div key={t.chave} style={{ marginBottom: 10 }}>
          <label className={t.obrigatorio ? 'obrigatorio' : ''}>{t.rotulo}</label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => aoSelecionar(i, e.target.files?.[0] || null)}
          />
          {itens[i]?.erro && <div className="erro-msg">{itens[i].erro}</div>}
        </div>
      ))}
      <p style={{ fontSize: '0.8rem', color: '#666' }}>
        PDF, JPG ou PNG. Máximo 5 MB por arquivo.
      </p>
    </div>
  );
}
