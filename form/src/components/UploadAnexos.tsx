import { useEffect, useState } from 'react';
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
  anexo?: AnexoPayload;
  erro?: string;
}

export function UploadAnexos({ tipos, onChange }: Props) {
  const [itens, setItens] = useState<ItemEstado[]>(
    tipos.map((t) => ({ tipo: t.chave }))
  );

  // Deriva os anexos do estado já commitado. Evita calcular a lista a partir do
  // `itens` capturado no closure — origem da condição de corrida quando vários
  // arquivos eram selecionados em sequência rápida e os updates se sobrescreviam.
  useEffect(() => {
    const anexos = itens
      .map((it) => it.anexo)
      .filter((a): a is AnexoPayload => Boolean(a));
    onChange(anexos);
  }, [itens, onChange]);

  async function aoSelecionar(idx: number, f: File | null) {
    const tipo = tipos[idx].chave;
    let novoItem: ItemEstado = { tipo };
    if (f) {
      try {
        novoItem = { tipo, anexo: await arquivoParaAnexo(tipo, f) };
      } catch (e) {
        novoItem = { tipo, erro: (e as Error).message };
      }
    }
    // Update funcional: compõe sobre o estado mais recente, não sobre o closure.
    setItens((prev) => {
      const novos = [...prev];
      novos[idx] = novoItem;
      return novos;
    });
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
