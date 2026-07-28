# -*- coding: utf-8 -*-
"""Escreve a camada geocodificada de empresas de ATER (dados-cnpj/cnpj-ater-pr-geo.csv)
no PostGIS bdgeo, como tabela de pontos para uso no QGIS.

Destino: web.cnpj_ater (schema das camadas publicadas). Substitui a tabela se existir.
Inserção em massa via COPY (rápida) + geometria criada com ST_MakePoint numa única
instrução. Índice espacial GiST. Sem PII de pessoas físicas (dado é nível empresa).
"""
from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

import psycopg2

CSV = Path(r"C:\Users\apgomes\gestaodeater\dados-cnpj\cnpj-ater-pr-geo.csv")
# Escrita exige o dono do banco (bdgeo); bdgeo_user é somente-leitura.
DSN = dict(host="localhost", port=5432, user="bdgeo", password="bdgeo", dbname="bdgeo")
SCHEMA, TABELA = "web", "cnpj_ater"

# Colunas mantidas na tabela (nível empresa; sem PII de sócios). `categoria` é
# derivada do CNAE principal (mesmo agrupamento da página do painel).
COLS = ["cnpj", "razao_social", "nome_fantasia", "porte", "situacao",
        "cnae_principal", "cnae_principal_desc", "categoria", "cnae_secundarias_alvo",
        "municipio_cod", "municipio", "tipo_logradouro", "logradouro", "numero",
        "bairro", "cep", "matriz_filial", "data_inicio", "ibge", "precisao",
        "lat", "lon", "lat_mun", "lon_mun"]
NUM = {"lat", "lon", "lat_mun", "lon_mun"}

_NUCLEO = {"0161001", "0161002", "0161003", "0161099", "0162801", "0162802",
           "0162803", "0162899", "0163600", "0230600"}
_PRODUCAO = {"0151201", "0151202", "0151203", "0152101", "0152102", "0152103",
             "0153901", "0153902", "0154700", "0155501", "0155502", "0155503",
             "0155504", "0155505", "0159801", "0159803", "0159804", "0159899"}
_CREDITO = {"6424703", "6499900"}
_VET = {"7500100"}
_AMPLOS = {"7020400", "7490199"}


def categoria(cnae: str) -> str:
    if cnae in _NUCLEO:
        return "Apoio à produção"
    if cnae in _PRODUCAO:
        return "Produção animal"
    if cnae in _VET:
        return "Veterinária"
    if cnae in _CREDITO:
        return "Crédito rural"
    if cnae in _AMPLOS:
        return "Consultoria/técnica"
    return "Outros"


def main() -> int:
    fq = f"{SCHEMA}.{TABELA}"
    con = psycopg2.connect(connect_timeout=10, **DSN)
    con.autocommit = False
    cur = con.cursor()
    # falha rápido se a tabela ainda estiver presa por conexão-zumbi (em vez de travar)
    cur.execute("SET lock_timeout = '15s'")
    cur.execute("SET statement_timeout = '180s'")
    cur.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    cur.execute(f"DROP TABLE IF EXISTS {fq}")
    coldefs = ",\n  ".join(f'"{c}" double precision' if c in NUM else f'"{c}" text' for c in COLS)
    cur.execute(f"CREATE TABLE {fq} (\n  {coldefs}\n)")

    # COPY em memória (buffer TSV), descartando linhas sem coordenada.
    buf = io.StringIO()
    w = csv.writer(buf, delimiter="\t", lineterminator="\n")
    n = 0
    with CSV.open("r", encoding="utf-8-sig", newline="") as fh:
        rd = csv.DictReader(fh)
        for r in rd:
            if not r.get("lat") or not r.get("lon"):
                continue
            r = dict(r)
            r["categoria"] = categoria(r.get("cnae_principal", ""))
            w.writerow([(r.get(c, "") or "").replace("\t", " ").replace("\r", " ") for c in COLS])
            n += 1
    buf.seek(0)
    cur.copy_expert(
        f"COPY {fq} ({', '.join(chr(34)+c+chr(34) for c in COLS)}) "
        f"FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '')", buf)

    # geometria de ponto (SRID 4326) numa única instrução + índices.
    cur.execute(f"ALTER TABLE {fq} ADD COLUMN geom geometry(Point, 4326)")
    cur.execute(f"UPDATE {fq} SET geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326)")
    cur.execute(f'CREATE INDEX {TABELA}_geom_gist ON {fq} USING GIST (geom)')
    cur.execute(f'CREATE INDEX {TABELA}_mun_idx ON {fq} (municipio)')
    # leitura para o papel só-leitura (mesma convenção das demais camadas web.*)
    try:
        cur.execute(f"GRANT USAGE ON SCHEMA {SCHEMA} TO bdgeo_user")
        cur.execute(f"GRANT SELECT ON {fq} TO bdgeo_user")
    except Exception:
        pass
    con.commit()

    cur.execute(f"SELECT count(*), count(geom) FROM {fq}")
    tot, geo = cur.fetchone()
    con.close()
    print(f">> gravado {fq}: {tot} linhas ({geo} com geometria, SRID 4326, GiST criado)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
