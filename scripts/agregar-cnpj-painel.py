# -*- coding: utf-8 -*-
"""Gera painel/src/data/empresas-ater.json — agregado das empresas de ATER do PR para a
página do painel. SÓ dados agregados/anonimizados: contagens por município, CNAE, porte e
precisão de geocodificação. Não expõe CNPJ, razão social nem endereço individual (LGPD).

Fonte: dados-cnpj/cnpj-ater-pr-geo.csv (gerado por scrape-cnpj-ater.py + geocode_cnpj_bdgeo.py).
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

CSV = Path(r"C:\Users\apgomes\gestaodeater\dados-cnpj\cnpj-ater-pr-geo.csv")
SAIDA = Path(r"C:\Users\apgomes\gestaodeater\painel\src\data\empresas-ater.json")

# Agrupamento dos CNAEs em categorias legíveis para a página.
NUCLEO = {"0161001", "0161002", "0161003", "0161099", "0162801", "0162802", "0162803",
          "0162899", "0163600", "0230600"}
PRODUCAO = {"0151201", "0151202", "0151203", "0152101", "0152102", "0152103", "0153901",
            "0153902", "0154700", "0155501", "0155502", "0155503", "0155504", "0155505",
            "0159801", "0159803", "0159804", "0159899"}
CREDITO = {"6424703", "6499900"}
VET = {"7500100"}
AMPLOS = {"7020400", "7490199"}


def categoria(cnae: str) -> str:
    if cnae in NUCLEO:
        return "Apoio à produção"
    if cnae in PRODUCAO:
        return "Produção animal"
    if cnae in VET:
        return "Veterinária"
    if cnae in CREDITO:
        return "Crédito rural"
    if cnae in AMPLOS:
        return "Consultoria/técnica"
    return "Outros"


def main() -> None:
    df = pd.read_csv(CSV, dtype=str).fillna("")
    df["categoria"] = df["cnae_principal"].map(categoria)

    total = len(df)
    por_cat = (df.groupby("categoria").size().sort_values(ascending=False)
               .reset_index(name="n").to_dict("records"))
    por_cat = [{"categoria": r["categoria"], "empresas": int(r["n"])} for r in por_cat]

    por_porte = [{"porte": p or "Não informado", "empresas": int(n)}
                 for p, n in df.groupby("porte").size().sort_values(ascending=False).items()]

    por_prec = [{"precisao": p, "empresas": int(n)}
                for p, n in df.groupby("precisao").size().sort_values(ascending=False).items()]

    top_mun = (df.groupby("municipio").size().sort_values(ascending=False).head(25)
               .reset_index(name="n"))
    municipios = [{"municipio": r["municipio"], "empresas": int(r["n"])}
                  for _, r in top_mun.iterrows()]

    # CNAEs individuais (top) com descrição
    desc = df.drop_duplicates("cnae_principal").set_index("cnae_principal")["cnae_principal_desc"].to_dict()
    por_cnae = (df.groupby("cnae_principal").size().sort_values(ascending=False).head(20)
                .reset_index(name="n"))
    cnaes = [{"cnae": r["cnae_principal"], "descricao": desc.get(r["cnae_principal"], ""),
              "empresas": int(r["n"]), "categoria": categoria(r["cnae_principal"])}
             for _, r in por_cnae.iterrows()]

    # pontos para o mapa: um por município, no centroide municipal, com a contagem.
    df["lat_mun"] = pd.to_numeric(df["lat_mun"], errors="coerce")
    df["lon_mun"] = pd.to_numeric(df["lon_mun"], errors="coerce")
    dfg = df.dropna(subset=["lat_mun", "lon_mun"])
    pontos = []
    for (mun, ibge), g in dfg.groupby(["municipio", "ibge"]):
        pontos.append({
            "municipio": mun,
            "ibge": ibge,
            "lat": round(float(g["lat_mun"].iloc[0]), 5),
            "lon": round(float(g["lon_mun"].iloc[0]), 5),
            "empresas": int(len(g)),
        })
    pontos.sort(key=lambda p: p["empresas"], reverse=True)

    dados = {
        "meta": {
            "geradoEm": date.today().isoformat(),
            "fonte": "Dados Abertos do CNPJ — Receita Federal (2026-07); geocodificação bdgeo (base.municipios + raw.estradas) e AwesomeAPI (CEP)",
            "escopo": "Estabelecimentos ativos no Paraná em CNAEs de ATER, apoio à produção, produção animal, veterinária e crédito rural",
            "total": total,
            "observacaoLGPD": "Dados agregados; sem CNPJ, razão social ou endereço individual.",
        },
        "resumo": {
            "empresas": total,
            "municipios": int(df["municipio"].nunique()),
            "geocodificadasRua": int((df["precisao"] == "rua").sum()),
            "geocodificadasCep": int((df["precisao"] == "cep").sum()),
            "geocodificadasMunicipio": int((df["precisao"] == "municipio").sum()),
        },
        "categorias": por_cat,
        "cnaes": cnaes,
        "portes": por_porte,
        "precisao": por_prec,
        "municipios": municipios,
        "pontos": pontos,
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f">> gerado {SAIDA} ({SAIDA.stat().st_size/1024:.0f} KB)")
    print(f"   {total} empresas · {dados['resumo']['municipios']} municípios · {len(pontos)} pontos-município")


if __name__ == "__main__":
    main()
