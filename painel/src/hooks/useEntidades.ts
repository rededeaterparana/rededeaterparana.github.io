import { useEffect, useState } from 'react';
import { listar, RespostaListagem } from '../lib/api';

interface Estado {
  dados: RespostaListagem | null;
  carregando: boolean;
  erro: string | null;
}

export function useEntidades(): Estado {
  const [estado, setEstado] = useState<Estado>({ dados: null, carregando: true, erro: null });
  useEffect(() => {
    let ativo = true;
    listar()
      .then((d) => { if (ativo) setEstado({ dados: d, carregando: false, erro: null }); })
      .catch((e: Error) => { if (ativo) setEstado({ dados: null, carregando: false, erro: e.message }); });
    return () => { ativo = false; };
  }, []);
  return estado;
}
