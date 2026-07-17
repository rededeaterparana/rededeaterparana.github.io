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
DSN = dict(host="localhost", port=5432, user="bdgeo_user", password="bdgeo", dbname="bdgeo")
SCHEMA, TABELA = "web", "cnpj_ater"

# Colunas mantidas na tabela (nível empresa; sem PII de sócios).
COLS = ["cnpj", "razao_social", "nome_fantasia", "porte", "situacao",
        "cnae_principal", "cnae_principal_desc", "cnae_secundarias_alvo",
        "municipio_cod", "municipio", "tipo_logradouro", "logradouro", "numero",
        "bairro", "cep", "matriz_filial", "data_inicio", "ibge", "precisao",
        "lat", "lon", "lat_mun", "lon_mun"]
NUM = {"lat", "lon", "lat_mun", "lon_mun"}


def main() -> int:
    fq = f"{SCHEMA}.{TABELA}"
    con = psycopg2.connect(**DSN)
    con.autocommit = False
    cur = con.cursor()
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
    con.commit()

    cur.execute(f"SELECT count(*), count(geom) FROM {fq}")
    tot, geo = cur.fetchone()
    con.close()
    print(f">> gravado {fq}: {tot} linhas ({geo} com geometria, SRID 4326, GiST criado)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
