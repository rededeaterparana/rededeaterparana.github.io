# -*- coding: utf-8 -*-
"""Explora o banco PostGIS bdgeo para localizar as camadas que substituem as da
unidade I: no pipeline de geocodificação (municípios PR e faces de logradouros)."""
import sys

try:
    import psycopg2
except ImportError:
    print("psycopg2 nao instalado", file=sys.stderr); sys.exit(2)

DSN = dict(host="localhost", port=5432, user="bdgeo_user", password="bdgeo", dbname="bdgeo")


def main():
    try:
        con = psycopg2.connect(**DSN)
    except Exception as e:
        print(f"FALHA conexao ({DSN['dbname']}): {e}")
        # tenta dbname alternativos
        for db in ("postgres", "gis", "geo"):
            try:
                con = psycopg2.connect(**{**DSN, "dbname": db}); print(f"conectou em dbname={db}"); break
            except Exception as e2:
                print(f"  {db}: {e2}")
        else:
            return
    cur = con.cursor()

    print("== geometry_columns (tabelas espaciais) ==")
    cur.execute("""
        SELECT f_table_schema, f_table_name, f_geometry_column, type, srid
        FROM geometry_columns ORDER BY 1,2
    """)
    for s, t, gcol, gtype, srid in cur.fetchall():
        print(f"  {s}.{t} [{gcol} {gtype} srid={srid}]")

    print("\n== tabelas candidatas (municipio / logradouro / face / rua / cep) ==")
    cur.execute("""
        SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_type='BASE TABLE'
          AND (table_name ILIKE '%municip%' OR table_name ILIKE '%lograd%'
               OR table_name ILIKE '%face%' OR table_name ILIKE '%rua%'
               OR table_name ILIKE '%cep%' OR table_name ILIKE '%setor%'
               OR table_name ILIKE '%endereco%' OR table_name ILIKE '%malha%')
        ORDER BY 1,2
    """)
    cands = cur.fetchall()
    for s, t in cands:
        cur.execute("""SELECT column_name, data_type FROM information_schema.columns
                       WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""", (s, t))
        cols = cur.fetchall()
        cur.execute(f'SELECT count(*) FROM "{s}"."{t}"')
        n = cur.fetchone()[0]
        colnames = ", ".join(c for c, _ in cols)
        print(f"\n  {s}.{t}  ({n} linhas)")
        print(f"    colunas: {colnames[:400]}")

    con.close()


if __name__ == "__main__":
    main()
