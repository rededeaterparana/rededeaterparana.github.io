# -*- coding: utf-8 -*-
"""Apuracao final da enquete da identidade visual da Rede Paranaense de ATER.

Registro reproduzivel do calculo publicado em 24/08/2026. Os 40 registros abaixo
sao um snapshot das colunas nao sensiveis da aba `enquete_votos` da planilha da
Rede (data, proposta, entidade) — nome e e-mail ficam fora de proposito, e por
isso o script roda sem acesso a planilha.

Imprime os dois cenarios: todos os votos recebidos e apenas os votos ate o prazo
anunciado (13/08/2026). A proposta vencedora e a mesma nos dois.
"""
from collections import defaultdict, Counter

# (n, data, proposta, entidade_bruta)  -- 40 registros da aba enquete_votos
R = [
 (1,"06/08","05","IDR-Parana"),(2,"06/08","01","TESTE"),(3,"07/08","01","morumbi"),
 (4,"07/08","01","IDR-Parana"),(5,"07/08","01","IDR-Parana"),(6,"07/08","02","IDR-Parana"),
 (7,"07/08","05","IDR-Parana"),(8,"07/08","01","IDR-Parana"),(9,"07/08","01","RenovaPR"),
 (10,"07/08","01","IDR-Parana"),(11,"07/08","01","IDR-Parana"),(12,"07/08","01","IDR-Parana"),
 (13,"07/08","01","IDR-Parana"),(14,"07/08","01","IDR-Parana"),(15,"08/08","02","IDR-Cornelio"),
 (16,"08/08","03","IDR-Parana"),(17,"08/08","03","IDR-Parana"),(18,"10/08","01","IDR-Parana"),
 (19,"10/08","01","IDR-Parana"),(20,"11/08","01","IDR-Parana"),(21,"11/08","03","IDR-Parana"),
 (22,"11/08","01","IDR-Parana"),(23,"11/08","01","OCEPAR"),(24,"11/08","05","APEPA"),
 (25,"11/08","03","Sebrae PR"),(26,"11/08","01","AMP"),(27,"12/08","05","UNICAFES"),
 (28,"12/08","01","Cresol"),(29,"12/08","01","MDA/SFDA-PR"),(30,"12/08","03","Fetaep"),
 (31,"12/08","06","IDR"),(32,"12/08","01","Coopermais"),(33,"12/08","02","IDR-Parana"),
 (34,"13/08","01","ITAIPU Binacional"),(35,"13/08","01","RURALTEC"),(36,"17/08","05","IDR-Parana"),
 (37,"18/08","01","SEAB"),(38,"18/08","03","SEAB"),(39,"19/08","01","ADEOP"),(40,"20/08","02","IDR-Parana"),
]

# consolidacao humana herdada do documento interno de 19/08/2026
CONSOLIDA = {"IDR-Parana":"IDR-Parana","RenovaPR":"IDR-Parana","IDR-Cornelio":"IDR-Parana",
             "IDR":"IDR-Parana","morumbi":"APEPA"}
NOMES = {"01":"Proposta 1 - Folha & Rede","02":"Proposta 2 - Institucional",
         "03":"Proposta 3 - Territorio Vivo","04":"Proposta 4 - Pinha em escudo",
         "05":"Proposta 5 - Raiz e Araucaria","06":"Proposta 6 - Pinhoes em vinho e azul"}

def apurar(rows, rotulo):
    validos = [r for r in rows if r[3] != "TESTE"]
    simples = Counter(r[2] for r in validos)
    por_ent = defaultdict(Counter)
    for _, _, p, e in validos:
        por_ent[CONSOLIDA.get(e, e)][p] += 1
    ponderado, empates, detalhe = Counter(), [], []
    for ent, c in por_ent.items():
        top = max(c.values()); lider = [p for p, v in c.items() if v == top]
        if len(lider) == 1:
            ponderado[lider[0]] += 1; detalhe.append((ent, sum(c.values()), lider[0]))
        else:
            empates.append((ent, sum(c.values()), lider))
    print("="*68); print(rotulo)
    print("registros=%d  validos=%d  entidades=%d  decididas=%d  empates=%d"
          % (len(rows), len(validos), len(por_ent), len(por_ent)-len(empates), len(empates)))
    print("-- PONDERADO (1 voto por entidade) --")
    for p in sorted(NOMES, key=lambda k: (-ponderado[k], k)):
        print("  %-38s %d entid." % (NOMES[p], ponderado[p]))
    print("-- SIMPLES (%d votos) --" % len(validos))
    for p in sorted(NOMES, key=lambda k: (-simples[k], k)):
        print("  %-38s %2d  %4.1f%%" % (NOMES[p], simples[p], 100*simples[p]/len(validos)))
    if empates: print("-- EMPATES --"); [print("  %s (%d votos) %s" % (e,n,l)) for e,n,l in empates]
    print("-- POR ENTIDADE --")
    for ent, n, p in sorted(detalhe, key=lambda d: -d[1]):
        print("  %-22s %2d voto(s) -> %s" % (ent, n, NOMES[p]))
    return ponderado, simples, len(validos), por_ent, empates, detalhe

apurar(R, "A) TODOS OS VOTOS RECEBIDOS (criterio do doc interno de 19/08)")
apurar([r for r in R if r[1] in ("06/08","07/08","08/08","10/08","11/08","12/08","13/08")],
       "B) SOMENTE ATE O PRAZO ANUNCIADO (13/08/2026)")
