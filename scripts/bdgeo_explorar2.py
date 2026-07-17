# -*- coding: utf-8 -*-
"""Lista TODAS as tabelas do bdgeo e inspeciona candidatas a logradouro/endereço."""
import psycopg2
DSN = dict(host="localhost", port=5432, user="bdgeo_user", password="bdgeo", dbname="bdgeo")

con = psycopg2.connect(**DSN); cur = con.cursor()
cur.execute("""SELECT table_schema, table_name FROM information_schema.tables
               WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')
               ORDER BY 1,2""")
todas = cur.fetchall()
print(f"== {len(todas)} tabelas ==")
for s, t in todas:
    print(f"  {s}.{t}")

# inspeciona colunas de algumas candidatas a endereço/rua
for s, t in [("raw", "estradas"), ("raw", "construcoes"), ("base", "municipios"), ("raw", "setores_censitarios")]:
    cur.execute("""SELECT column_name FROM information_schema.columns
                   WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""", (s, t))
    cols = [c for (c,) in cur.fetchall()]
    print(f"\n-- {s}.{t}: {cols}")
    # amostra de nomes textuais se houver coluna 'nome'-like
    txt = [c for c in cols if any(k in c.lower() for k in ("nome","nm_","logr","rua","desc","name"))]
    for c in txt[:3]:
        try:
            cur.execute(f'SELECT DISTINCT "{c}" FROM "{s}"."{t}" WHERE "{c}" IS NOT NULL LIMIT 5')
            print(f"     {c} ~ {[r[0] for r in cur.fetchall()]}")
        except Exception as e:
            print(f"     {c}: {e}")
con.close()
