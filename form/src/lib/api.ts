import type { Entidade } from '../schema/entidade';
import { executarRecaptcha } from './recaptcha';

const API_URL = import.meta.env.VITE_API_URL as string;

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface AnexoPayload {
  tipo_documento: string;
  nome: string;
  mime: string;
  base64: string;
}

export async function arquivoParaAnexo(tipoDocumento: string, file: File): Promise<AnexoPayload> {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error(`Tipo de arquivo não permitido: ${file.type || 'desconhecido'}`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Arquivo "${file.name}" excede 5 MB`);
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return {
    tipo_documento: tipoDocumento,
    nome: file.name,
    mime: file.type,
    base64: btoa(bin)
  };
}

export interface RespostaCadastro {
  ok: boolean;
  protocolo?: string;
  mensagem?: string;
  erro?: string;
  campos?: string[];
  _status?: number;
}

export async function enviarCadastro(
  entidade: Entidade,
  anexos: AnexoPayload[]
): Promise<RespostaCadastro> {
  if (!API_URL) throw new Error('VITE_API_URL não configurado');

  const recaptcha_token = await executarRecaptcha('cadastro_entidade');

  const payload = {
    ...entidade,
    anexos,
    origin: window.location.origin,
    recaptcha_token
  };

  // text/plain evita preflight CORS — Apps Script aceita JSON cru.
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const txt = await r.text();
  try {
    return JSON.parse(txt) as RespostaCadastro;
  } catch {
    return { ok: false, erro: 'resposta inválida do servidor' };
  }
}
