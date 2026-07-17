# -*- coding: utf-8 -*-
"""Encerra conexões travadas/ociosas-em-transação no bdgeo que seguram a tabela
web.cnpj_ater (resquício de um to_postgis interrompido), liberando o lock."""
import psycopg2
DSN = dict(host="localhost", port=5432, user="bdgeo_user", password="bdgeo", dbname="bdgeo")

con = psycopg2.connect(**DSN); con.autocommit = True; cur = con.cursor()
cur.execute("""
    SELECT pid, state, age(clock_timestamp(), state_change),
           left(coalesce(query,''), 60)
    FROM pg_stat_activity
    WHERE datname='bdgeo' AND pid <> pg_backend_pid()
      AND (state = 'idle in transaction' OR query ILIKE '%cnpj_ater%')
""")
alvos = cur.fetchall()
print(f"conexoes candidatas: {len(alvos)}")
for pid, state, idade, q in alvos:
    print(f"  pid {pid} [{state}] idade={idade} :: {q}")
    try:
        cur.execute("SELECT pg_terminate_backend(%s)", (pid,))
        print(f"    terminado: {cur.fetchone()[0]}")
    except Exception as e:
        print(f"    erro: {e}")
con.close()
print("ok")
