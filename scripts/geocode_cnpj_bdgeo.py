# -*- coding: utf-8 -*-
"""Geocodifica os estabelecimentos de ATER (dados-cnpj/cnpj-ater-pr.csv) em cascata de
precisão, replicando a técnica do estudo ILPF — mas lendo as camadas do PostGIS bdgeo
em vez da unidade I: (que não está conectada).

Cascata:
  1) MUNICÍPIO  — centroide (ST_PointOnSurface) de base.municipios, join por nome normalizado.
  2) RUA        — centroide da via de mesmo nome em raw.estradas (OSM), por município.
                  Substitui as "faces de logradouros 2021" do I:.
  3) CEP        — (opcional, --cep) AwesomeAPI para CEPs específicos ainda no centroide.

Saída: dados-cnpj/cnpj-ater-pr-geo.csv (+ .gpkg se geopandas disponível), com lat/lon,
lat_mun/lon_mun (fallback preservado) e `precisao` ∈ {municipio, rua, cep}.
"""
from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import pandas as pd
import psycopg2

DSN = dict(host="localhost", port=5432, user="bdgeo_user", password="bdgeo", dbname="bdgeo")
BASE = Path(r"C:\Users\apgomes\gestaodeater\dados-cnpj")

# Prefixos de tipo de logradouro que o OSM já embute em `name` (ex.: "Rua X").
_TIPOS = {"RUA", "AVENIDA", "AV", "TRAVESSA", "RODOVIA", "ESTRADA", "ALAMEDA",
          "PRACA", "LARGO", "LINHA", "SERVIDAO", "VILA", "BECO", "RUELA"}


def norm(s: object) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^A-Z0-9 ]", " ", s.upper())
    return re.sub(r"\s+", " ", s).strip()


def rua_key(tipo: object, log: object) -> str:
    """Chave normalizada da rua a partir do tipo + logradouro do RF.

    O RF traz o tipo separado (TLOG) e o nome (LOG); o OSM concatena em `name`.
    Removemos a faixa de numeração do RF ('- DE 10 A 20') antes de normalizar.
    """
    log = str(log).split(" - ")[0]
    return norm(f"{tipo or ''} {log or ''}")


def centroides_municipios(cur) -> dict[str, tuple[float, float, str]]:
    """norm(municipio) -> (lat, lon, codibge). Centroide interno ao polígono."""
    cur.execute("""
        SELECT municipio, codibge,
               ST_Y(ST_PointOnSurface(geom)), ST_X(ST_PointOnSurface(geom))
        FROM base.municipios
    """)
    return {norm(m): (float(lat), float(lon), str(cod)) for m, cod, lat, lon in cur.fetchall()}


def indice_ruas(cur) -> dict[str, dict[str, tuple[float, float]]]:
    """norm(municipio) -> { norm(nome_rua) -> (lat, lon) } dos trechos OSM agregados."""
    cur.execute("""
        SELECT nm_mun, name,
               ST_Y(ST_Centroid(ST_Collect(geom))), ST_X(ST_Centroid(ST_Collect(geom)))
        FROM raw.estradas
        WHERE name IS NOT NULL AND name <> '' AND nm_mun IS NOT NULL
        GROUP BY nm_mun, name
    """)
    idx: dict[str, dict[str, tuple[float, float]]] = defaultdict(dict)
    for mun, name, lat, lon in cur.fetchall():
        if lat is None or lon is None:
            continue
        idx[norm(mun)][norm(name)] = (float(lat), float(lon))
    return idx


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entrada", type=Path, default=BASE / "cnpj-ater-pr.csv")
    ap.add_argument("--saida", type=Path, default=BASE / "cnpj-ater-pr-geo.csv")
    ap.add_argument("--cep", action="store_true", help="refina por CEP via AwesomeAPI (online)")
    args = ap.parse_args()

    df = pd.read_csv(args.entrada, dtype=str).fillna("")
    print(f">> {len(df)} estabelecimentos a geocodificar", file=sys.stderr)

    con = psycopg2.connect(**DSN)
    cur = con.cursor()
    cent = centroides_municipios(cur)
    print(f">> {len(cent)} centroides municipais (base.municipios)", file=sys.stderr)
    ruas = indice_ruas(cur)
    print(f">> ruas indexadas em {len(ruas)} municípios (raw.estradas)", file=sys.stderr)
    con.close()

    lat = [None] * len(df)
    lon = [None] * len(df)
    ibge = [""] * len(df)
    prec = ["municipio"] * len(df)
    sem_centroide: set[str] = set()
    n_rua = 0

    muni = df["municipio"].map(norm).tolist()
    chaves = [rua_key(t, l) for t, l in zip(df["tipo_logradouro"], df["logradouro"])]

    for i in range(len(df)):
        c = cent.get(muni[i])
        if not c:
            sem_centroide.add(df["municipio"].iloc[i])
            continue
        lat[i], lon[i], ibge[i] = c[0], c[1], c[2]
        rmap = ruas.get(muni[i])
        if rmap and chaves[i] and chaves[i] in rmap:
            lat[i], lon[i] = rmap[chaves[i]]
            prec[i] = "rua"
            n_rua += 1

    df["lat_mun"] = [cent.get(m, (None, None, None))[0] for m in muni]
    df["lon_mun"] = [cent.get(m, (None, None, None))[1] for m in muni]
    df["ibge"] = ibge
    df["lat"] = lat
    df["lon"] = lon
    df["precisao"] = prec

    if args.cep:
        n_cep = refinar_cep(df)
        print(f">> {n_cep} refinados para nível CEP", file=sys.stderr)

    antes = len(df)
    df = df[df["lat"].notna()].copy()
    if sem_centroide:
        print(f"!! {len(sem_centroide)} municípios sem centroide (grafia/não-PR): "
              f"{sorted(sem_centroide)[:10]}", file=sys.stderr)
        print(f"   {antes - len(df)} linhas sem coordenada descartadas", file=sys.stderr)

    df.to_csv(args.saida, index=False, encoding="utf-8-sig")
    try:
        import geopandas as gpd
        g = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326")
        g.to_file(args.saida.with_suffix(".gpkg"), driver="GPKG")
        gpkg = f" + {args.saida.with_suffix('.gpkg').name}"
    except Exception as e:
        gpkg = f" (gpkg pulado: {e})"

    tot = len(df)
    n_mun = (df["precisao"] == "municipio").sum()
    n_ruaf = (df["precisao"] == "rua").sum()
    n_cepf = (df["precisao"] == "cep").sum()
    print(f"\n>> geocodificados {tot}: rua {n_ruaf} ({100*n_ruaf/tot:.1f}%), "
          f"cep {n_cepf} ({100*n_cepf/tot:.1f}%), município {n_mun} ({100*n_mun/tot:.1f}%)")
    print(f"salvo: {args.saida.name}{gpkg}")
    return 0


def refinar_cep(df: pd.DataFrame) -> int:
    """Refina por CEP específico (não -000) via AwesomeAPI, para os que estão no município.

    Paraleliza as consultas (a rede da EMATER usa o proxy local px na 3128; requests
    respeita HTTPS_PROXY/HTTP_PROXY se definidos). Cache em dados-cnpj/cep_cache.json.
    """
    import json
    import os
    import threading
    import time
    from concurrent.futures import ThreadPoolExecutor, as_completed

    import requests

    cache_path = BASE / "cep_cache.json"
    cache = json.loads(cache_path.read_text("utf-8")) if cache_path.exists() else {}
    LAT0, LAT1, LON0, LON1 = -26.95, -22.30, -55.05, -47.75
    proxies = None
    px = os.environ.get("HTTPS_PROXY") or os.environ.get("PX")
    if px:
        proxies = {"http": px, "https": px}
    lock = threading.Lock()

    ceps_norm = df["cep"].str.replace(r"\D", "", regex=True)
    alvo_pos = [p for p, (prec, c) in enumerate(zip(df["precisao"], ceps_norm))
                if prec == "municipio" and len(c) == 8 and not c.endswith("000")]
    ceps_unicos = sorted({ceps_norm.iloc[p] for p in alvo_pos})
    faltam = [c for c in ceps_unicos if c not in cache]
    print(f"   CEP: {len(alvo_pos)} alvo | {len(ceps_unicos)} únicos | {len(faltam)} a consultar", file=sys.stderr)

    def consulta(cep: str):
        val = None
        for tent in range(3):
            try:
                r = requests.get(f"https://cep.awesomeapi.com.br/json/{cep}", timeout=20,
                                 headers={"User-Agent": "gestaodeater-ater/1.0"}, proxies=proxies)
                if r.status_code == 200:
                    j = r.json()
                    if j.get("lat") and j.get("lng"):
                        la, lo = float(j["lat"]), float(j["lng"])
                        if LAT0 < la < LAT1 and LON0 < lo < LON1:
                            val = [la, lo]
                    break
                if r.status_code in (400, 404):
                    break
            except Exception:
                time.sleep(0.4 * (tent + 1))
        with lock:
            cache[cep] = val
        return cep

    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(consulta, c) for c in faltam]
        for _ in as_completed(futs):
            done += 1
            if done % 500 == 0:
                cache_path.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")
                print(f"      ...{done}/{len(faltam)}", file=sys.stderr, flush=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")

    n = 0
    idx_list = df.index.tolist()
    for p in alvo_pos:
        v = cache.get(ceps_norm.iloc[p])
        if v:
            i = idx_list[p]
            df.at[i, "lat"], df.at[i, "lon"], df.at[i, "precisao"] = v[0], v[1], "cep"
            n += 1
    return n


if __name__ == "__main__":
    sys.exit(main())
