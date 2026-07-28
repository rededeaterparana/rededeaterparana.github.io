# -*- coding: utf-8 -*-
"""Enriquece a lista de empresas de ATER com um LLM LOCAL (Ollama — custo zero).

Para cada empresa (deduplicada por CNPJ básico), a partir de razão social, nome
fantasia, CNAE e município, o modelo infere:
  - ater: "sim" | "nao" | "incerto"  (presta serviço ligado a ATER / apoio agropecuário?)
  - subarea: rótulo de um vocabulário fechado
  - conf: confiança 0..1

Batched (N por chamada), resumível (checkpoint em JSON), saída incremental em CSV.
Uso:
    python scripts/enriquecer_ollama.py --limite 25          # teste rápido
    python scripts/enriquecer_ollama.py --modelo qwen3.6:latest
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pandas as pd
import requests

BASE = Path(r"C:\Users\apgomes\gestaodeater\dados-cnpj")
ENTRADA = BASE / "cnpj-ater-pr.csv"
SAIDA = BASE / "cnpj-ater-pr-enriquecido.csv"
CACHE = BASE / "enriquecimento_cache.json"
OLLAMA = "http://localhost:11434/api/chat"

SUBAREAS = [
    "assistência técnica agrícola", "assistência técnica pecuária", "veterinária",
    "consultoria agronômica", "crédito rural", "produção animal", "produção agrícola",
    "insumos/comércio agropecuário", "serviços florestais", "cooperativa",
    "planejamento/projetos rurais", "não relacionado a ATER",
]

PROMPT = """Você é um classificador de empresas brasileiras quanto à ATER (Assistência Técnica e Extensão Rural) e ao apoio à produção agropecuária/florestal.

Para CADA empresa abaixo, decida:
- "ater": "sim" se a empresa presta/atua em ATER ou apoio direto à produção rural (assistência técnica, consultoria agronômica/veterinária, crédito rural, cooperativa rural, produção animal/agrícola, serviços florestais); "nao" se claramente não tem relação; "incerto" se não dá para saber.
- "subarea": escolha UMA de: {subareas}.
- "conf": confiança de 0.0 a 1.0.

Baseie-se em razão social, nome fantasia, CNAE e município. Responda SOMENTE JSON válido, sem texto extra, no formato:
{{"empresas": [{{"i": <numero>, "ater": "sim|nao|incerto", "subarea": "<uma das opções>", "conf": <0..1>}}]}}

Empresas:
{lista}"""


def linha_empresa(i: int, r: dict) -> str:
    return (f'{i}. RAZAO="{r["razao_social"]}" | FANTASIA="{r["nome_fantasia"]}" '
            f'| CNAE="{r["cnae_principal_desc"]}" | MUNICIPIO="{r["municipio"]}"')


def chamar_ollama(modelo: str, prompt: str, timeout: int) -> str:
    resp = requests.post(OLLAMA, json={
        "model": modelo,
        "messages": [{"role": "user", "content": prompt}],
        "format": "json", "stream": False,
        "options": {"temperature": 0, "num_ctx": 8192},
    }, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--modelo", default="gemma4:latest")
    ap.add_argument("--lote", type=int, default=20, help="empresas por chamada")
    ap.add_argument("--limite", type=int, default=0, help="0 = todas; N = só as primeiras N (teste)")
    ap.add_argument("--timeout", type=int, default=300)
    args = ap.parse_args()

    df = pd.read_csv(ENTRADA, dtype=str).fillna("")
    df["cnpj_basico"] = df["cnpj"].str[:8]
    unicas = df.drop_duplicates("cnpj_basico").reset_index(drop=True)
    if args.limite:
        unicas = unicas.head(args.limite)
    print(f">> {len(unicas)} empresas únicas (de {len(df)} estabelecimentos) | modelo {args.modelo}", file=sys.stderr)

    cache = json.loads(CACHE.read_text("utf-8")) if CACHE.exists() else {}
    prompt_sub = ", ".join(SUBAREAS)

    pendentes = [i for i in range(len(unicas)) if unicas.at[i, "cnpj_basico"] not in cache]
    print(f">> {len(pendentes)} a processar ({len(cache)} em cache)", file=sys.stderr)

    t0 = time.time()
    feitos = 0
    for k in range(0, len(pendentes), args.lote):
        grupo = pendentes[k:k + args.lote]
        linhas = "\n".join(linha_empresa(j + 1, unicas.loc[gi]) for j, gi in enumerate(grupo))
        prompt = PROMPT.format(subareas=prompt_sub, lista=linhas)
        try:
            txt = chamar_ollama(args.modelo, prompt, args.timeout)
            data = json.loads(txt)
            itens = {int(e["i"]): e for e in data.get("empresas", []) if "i" in e}
        except Exception as e:
            print(f"   lote {k}: falha ({str(e)[:80]}) — marcando incerto", file=sys.stderr)
            itens = {}
        for j, gi in enumerate(grupo):
            e = itens.get(j + 1, {})
            cache[unicas.at[gi, "cnpj_basico"]] = {
                "ater": e.get("ater", "incerto"),
                "subarea": e.get("subarea", ""),
                "conf": e.get("conf", 0),
            }
        feitos += len(grupo)
        if k % (args.lote * 10) == 0 or k + args.lote >= len(pendentes):
            CACHE.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")
            taxa = feitos / max(time.time() - t0, 1)
            print(f"   {feitos}/{len(pendentes)}  ({taxa:.1f}/s)", file=sys.stderr, flush=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")

    # aplica o enriquecimento a TODOS os estabelecimentos (join por cnpj_basico)
    enr = pd.DataFrame.from_dict(cache, orient="index").rename_axis("cnpj_basico").reset_index()
    enr.columns = ["cnpj_basico", "ater", "subarea", "conf"]
    out = df.merge(enr, on="cnpj_basico", how="left")
    out.to_csv(SAIDA, index=False, encoding="utf-8-sig")
    print(f"\n>> gerado {SAIDA} ({len(out)} linhas)", file=sys.stderr)
    print(">> distribuição ater:\n" + out["ater"].value_counts(dropna=False).to_string(), file=sys.stderr)
    print("\n>> top subáreas:\n" + out["subarea"].value_counts().head(12).to_string(), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
