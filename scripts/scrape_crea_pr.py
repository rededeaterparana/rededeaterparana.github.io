# -*- coding: utf-8 -*-
"""Scrape do CONFEA/CREA-PR: força de trabalho registrada por título, com marcação
de relevância "rural" (rede ampla, conforme pedido — inclui o não óbvio).

Fonte: relatório público agregado do CONFEA (sem PII), endpoint descoberto via
navegador: POST /Profissional/RegistrosPorGrupo/Buscar (form-urlencoded), devolve
JSON {Crea, Grupo, Modalidade, Nivel, Titulo, Genero, Total}. Acesso via px (proxy
local 3128; ver memória emater-network-proxy).

Saídas em dados-cnpj/:
  crea_pr_raw.json          — resposta bruta do endpoint
  crea-pr-forca-rural.csv   — por título/modalidade/nível/gênero + coluna `rural`
  crea-pr-rural-resumo.csv  — consolidado por título (total, F, M, relevância)
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

import pandas as pd
import requests

BASE = Path(r"C:\Users\apgomes\gestaodeater\dados-cnpj")
RAW = BASE / "crea_pr_raw.json"
URL = "https://relatorio.confea.org.br/Profissional/RegistrosPorGrupo/Buscar"
PX = "http://127.0.0.1:3128"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

# Classificação de relevância rural por palavras-chave no título (após normalizar).
# nucleo = atividade-fim rural; forte = fortemente relacionada; possivel = pode tocar
# o rural mesmo sem parecer (rede ampla, como pedido).
NUCLEO = ["agronom", "agricol", "florestal", "pesca", "aquicultura", "aqicultura",
          "agropecuar", "agroecolog", "agroneg", "pecuaria", "fruticultura",
          "horticultura", "viticultura", "enologia", "administracao rural",
          "irrigacao", "drenagem", "zootec", "agricultura", "cafe", "acucar e alcool",
          "sucroalcool", "cervejeira", "paisagismo e jardinagem"]
FORTE = ["ambient", "sanitar", "alimento", "bioproces", "biotecnolog", "bioquimic",
         "madeira", "madeireiro", "agroindustria", "hidric", "recursos hidricos",
         "saneamento", "geograf", "cartograf", "agrimensor", "geodesia",
         "geoprocessamento", "meteorolog", "gestao ambiental", "processos ambientais",
         "energias renovaveis", "energia"]
# "possível" = pode tocar o rural sem parecer, MAS sem varrer a engenharia urbana
# genérica (civil/elétrica/mecânica pura). Marcamos títulos com plausível interface
# rural: química (defensivos/fertilizantes/solos), segurança do trabalho (NR31 rural),
# produção/agroindústria, energia (biomassa/bioenergia), geologia/minas (recursos
# naturais), automação (agricultura de precisão).
POSSIVEL = ["quimic", "bioquimic", "seguranca do trabalho", "producao",
            "agroindustria", "geolog", "minas", "mineracao", "automacao",
            "controle e automacao", "energia", "energias", "petroleo e gas",
            "biomedic", "textil", "materiais"]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def relevancia(titulo: str, modalidade: str) -> str:
    t = norm(titulo)
    m = norm(modalidade)
    # toda a modalidade AGRONOMIA é núcleo rural
    if m == "agronomia" or any(k in t for k in NUCLEO):
        return "nucleo"
    if any(k in t for k in FORTE):
        return "forte"
    if any(k in t for k in POSSIVEL):
        return "possivel"
    return "nao_rural"


def baixar() -> list[dict]:
    r = requests.post(
        URL,
        data={"Crea": "CREA-PR", "Grupo": "", "Modalidade": "", "Nivel": "", "Genero": "", "Titulo": ""},
        headers={"X-Requested-With": "XMLHttpRequest",
                 "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": UA},
        proxies={"http": PX, "https": PX}, timeout=90,
    )
    r.raise_for_status()
    data = r.json()["data"]
    RAW.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    return data


def main() -> int:
    if RAW.exists() and "--rebaixar" not in sys.argv:
        data = json.loads(RAW.read_text("utf-8"))
        data = data["data"] if isinstance(data, dict) else data
        print(f">> usando cache {RAW.name} ({len(data)} linhas)", file=sys.stderr)
    else:
        data = baixar()
        print(f">> baixado do CONFEA: {len(data)} linhas", file=sys.stderr)

    df = pd.DataFrame([{
        "titulo": r["Titulo"], "modalidade": r["Modalidade"], "nivel": r["Nivel"],
        "genero": r["Genero"], "total": int(r["Total"]),
    } for r in data])
    df["rural"] = [relevancia(t, m) for t, m in zip(df["titulo"], df["modalidade"])]
    df.to_csv(BASE / "crea-pr-forca-rural.csv", index=False, encoding="utf-8-sig")

    # resumo por título (F/M, relevância)
    piv = df.pivot_table(index=["rural", "modalidade", "titulo"], columns="genero",
                         values="total", aggfunc="sum", fill_value=0).reset_index()
    piv["total"] = piv.get("Feminino", 0) + piv.get("Masculino", 0)
    piv = piv.sort_values(["rural", "total"], ascending=[True, False])
    piv.to_csv(BASE / "crea-pr-rural-resumo.csv", index=False, encoding="utf-8-sig")

    ordem = ["nucleo", "forte", "possivel", "nao_rural"]
    resumo = df.groupby("rural")["total"].sum().reindex(ordem).fillna(0).astype(int)
    print("\n>> força de trabalho CREA-PR por relevância rural:", file=sys.stderr)
    tot = int(df["total"].sum())
    for k in ordem:
        print(f"   {k:10s}: {resumo[k]:6d} ({100*resumo[k]/tot:.1f}%)", file=sys.stderr)
    rural_ampla = int(resumo[["nucleo", "forte", "possivel"]].sum())
    print(f"   {'RURAL(lato)':10s}: {rural_ampla:6d} ({100*rural_ampla/tot:.1f}%)  | total geral {tot}", file=sys.stderr)
    print(f"\nsalvos: crea-pr-forca-rural.csv, crea-pr-rural-resumo.csv", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
