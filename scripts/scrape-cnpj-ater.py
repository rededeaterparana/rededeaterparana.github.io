#!/usr/bin/env python3
"""Extrai, dos Dados Abertos do CNPJ (Receita Federal), as empresas do Paraná nos
CNAEs de assistência técnica / crédito rural / apoio à produção agrícola-pecuária-
florestal. Análise à parte, para avaliar uma possível página.

Entrada: uma pasta com os .zip da Receita (Estabelecimentos*.zip, Empresas*.zip,
Cnaes.zip, Municipios.zip). O download é externo — a rede da EMATER bloqueia o
acesso direto (proxy); ver instruções no README/na conversa.

Saída: <saida>/cnpj-ater-pr.csv (nível empresa; SEM dados de sócios/PII) e um
resumo por CNAE no stderr.

Uso:
    python scripts/scrape-cnpj-ater.py --fonte dados-cnpj --saida dados-cnpj [--somente-ativas]
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
import zipfile
from pathlib import Path

# CNAEs-alvo (7 dígitos, sem pontuação), com rótulo para o resumo.
CNAES = {
    "0161001": "Serviço de pulverização e controle de pragas agrícolas",
    "0161002": "Serviço de poda de árvores para lavouras",
    "0161003": "Serviço de preparação de terreno, cultivo e proteção de plantas",
    "0161099": "Atividades de apoio à agricultura n.e.",
    "0162801": "Serviço de inseminação artificial em animais",
    "0162802": "Serviço de tosquiamento de ovinos",
    "0162803": "Serviço de manejo de animais",
    "0162899": "Atividades de apoio à pecuária n.e.",
    "0163600": "Atividades de pós-colheita",
    "0230600": "Atividades de apoio à produção florestal",
    "7490199": "Outras atividades profissionais/técnicas n.e. (assist. técnica)",
    "7020400": "Atividades de consultoria em gestão empresarial",
    "6424703": "Cooperativas de crédito rural",
    "6499900": "Outras atividades de serviços financeiros n.e.",
    "7500100": "Atividades veterinárias",
    # Produção animal / pecuária (grupo CNAE 01.5), incl. apicultura (mel).
    "0151201": "Criação de bovinos para corte",
    "0151202": "Criação de bovinos para leite",
    "0151203": "Criação de bovinos, exceto para corte e leite",
    "0152101": "Criação de bufalinos",
    "0152102": "Criação de equinos",
    "0152103": "Criação de asininos e muares",
    "0153901": "Criação de caprinos",
    "0153902": "Criação de ovinos, inclusive para produção de lã",
    "0154700": "Criação de suínos",
    "0155501": "Criação de frangos para corte",
    "0155502": "Produção de pintos de um dia",
    "0155503": "Criação de outros galináceos, exceto para corte",
    "0155504": "Criação de aves, exceto galináceos",
    "0155505": "Produção de ovos",
    "0159801": "Apicultura",
    "0159803": "Criação de escargô",
    "0159804": "Criação de bicho-da-seda",
    "0159899": "Criação de outros animais n.e.",
}
UF = "PR"
SITUACAO = {"01": "Nula", "02": "Ativa", "03": "Suspensa", "04": "Inapta", "08": "Baixada"}
PORTE = {"01": "Micro (ME)", "03": "Pequeno (EPP)", "05": "Demais"}


def _linhas_csv(zip_path: Path):
    """Itera as linhas de todos os CSV dentro de um .zip da Receita (latin-1, ';')."""
    with zipfile.ZipFile(zip_path) as z:
        for nome in z.namelist():
            with z.open(nome) as fh:
                texto = io.TextIOWrapper(fh, encoding="latin-1", newline="")
                yield from csv.reader(texto, delimiter=";", quotechar='"')


def carregar_ref(zip_path: Path) -> dict[str, str]:
    ref: dict[str, str] = {}
    if zip_path.exists():
        for linha in _linhas_csv(zip_path):
            if len(linha) >= 2:
                ref[linha[0].strip()] = linha[1].strip()
    return ref


def filtrar_estabelecimentos(fonte: Path):
    arquivos = sorted(fonte.glob("Estabelecimentos*.zip"))
    if not arquivos:
        raise SystemExit(f"nenhum Estabelecimentos*.zip em {fonte}")
    for zp in arquivos:
        print(f"  lendo {zp.name}...", file=sys.stderr)
        for r in _linhas_csv(zp):
            # layout: 0 cnpj_basico,1 ordem,2 dv,3 matriz/filial,4 nome_fantasia,
            # 5 situacao,...,10 data_inicio,11 cnae_principal,12 cnae_secundaria,
            # ...,18 cep,19 uf,20 municipio(cod RF)
            if len(r) < 21 or r[19].strip() != UF:
                continue
            principal = r[11].strip()
            secundarias = {c.strip() for c in r[12].split(",") if c.strip()}
            if principal not in CNAES and not (secundarias & CNAES.keys()):
                continue
            yield {
                "cnpj_basico": r[0].strip(),
                "cnpj": f"{r[0].strip()}{r[1].strip()}{r[2].strip()}",
                "matriz_filial": "Matriz" if r[3].strip() == "1" else "Filial",
                "nome_fantasia": r[4].strip(),
                "situacao": SITUACAO.get(r[5].strip(), r[5].strip()),
                "data_inicio": r[10].strip(),
                "cnae_principal": principal,
                "cnae_secundarias_alvo": ";".join(sorted(secundarias & CNAES.keys())),
                "municipio_cod": r[20].strip(),
                # endereço (para geocodificação): tipo/logradouro/número/bairro/CEP
                "tipo_logradouro": r[13].strip(),
                "logradouro": r[14].strip(),
                "numero": r[15].strip(),
                "bairro": r[17].strip(),
                "cep": r[18].strip(),
            }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fonte", type=Path, default=Path("dados-cnpj"))
    p.add_argument("--saida", type=Path, default=Path("dados-cnpj"))
    p.add_argument("--somente-ativas", action="store_true", help="mantém apenas situação Ativa")
    args = p.parse_args()

    cnaes_desc = carregar_ref(args.fonte / "Cnaes.zip")
    munic_desc = carregar_ref(args.fonte / "Municipios.zip")

    args.saida.mkdir(parents=True, exist_ok=True)
    saida_csv = args.saida / "cnpj-ater-pr.csv"
    temp_csv = args.saida / "cnpj-ater-pr.tmp.csv"
    colunas = ["cnpj", "razao_social", "nome_fantasia", "porte", "situacao",
               "cnae_principal", "cnae_principal_desc", "cnae_secundarias_alvo",
               "municipio_cod", "municipio", "tipo_logradouro", "logradouro", "numero",
               "bairro", "cep", "matriz_filial", "data_inicio"]

    # 1ª passada (streaming): grava estabelecimentos-alvo direto no CSV temporário e
    # coleta só o conjunto de CNPJs básicos + contagens em memória. Evita segurar
    # centenas de milhares de registros em RAM (a produção animal é volumosa).
    por_principal: dict[str, int] = {c: 0 for c in CNAES}
    por_alvo: dict[str, int] = {c: 0 for c in CNAES}
    bases: set[str] = set()
    total = 0
    with temp_csv.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        for e in filtrar_estabelecimentos(args.fonte):
            if args.somente_ativas and e["situacao"] != "Ativa":
                continue
            total += 1
            bases.add(e["cnpj_basico"])
            if e["cnae_principal"] in CNAES:
                por_principal[e["cnae_principal"]] += 1
                por_alvo[e["cnae_principal"]] += 1
            for c in e["cnae_secundarias_alvo"].split(";"):
                if c and c != e["cnae_principal"]:
                    por_alvo[c] += 1
            w.writerow([
                e["cnpj_basico"], e["cnpj"], e["nome_fantasia"], e["situacao"],
                e["cnae_principal"], cnaes_desc.get(e["cnae_principal"], CNAES.get(e["cnae_principal"], "")),
                e["cnae_secundarias_alvo"], e["municipio_cod"],
                munic_desc.get(e["municipio_cod"], e["municipio_cod"]),
                e["tipo_logradouro"], e["logradouro"], e["numero"], e["bairro"],
                e["cep"], e["matriz_filial"], e["data_inicio"],
            ])
    print(f"estabelecimentos PR nos CNAEs-alvo{' (ativas)' if args.somente_ativas else ''}: {total}", file=sys.stderr)

    # 2ª passada: razão social/porte das empresas casadas, pelo CNPJ básico
    razao: dict[str, str] = {}
    porte: dict[str, str] = {}
    for zp in sorted(args.fonte.glob("Empresas*.zip")):
        print(f"  lendo {zp.name}...", file=sys.stderr)
        for r in _linhas_csv(zp):
            b = r[0].strip() if r else ""
            if len(r) >= 6 and b in bases:
                razao[b] = r[1].strip()
                porte[b] = PORTE.get(r[5].strip(), r[5].strip())

    # 3ª passada (streaming): relê o temporário, injeta razão social/porte, grava final.
    with temp_csv.open("r", encoding="utf-8", newline="") as fin, \
         saida_csv.open("w", encoding="utf-8", newline="") as fout:
        rd = csv.reader(fin)
        w = csv.writer(fout)
        w.writerow(colunas)
        for r in rd:
            b = r[0]  # cnpj_basico
            w.writerow([
                r[1], razao.get(b, ""), r[2], porte.get(b, ""), r[3],
                r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[14], r[15],
            ])
    temp_csv.unlink(missing_ok=True)

    print(f"\ngerado {saida_csv} ({total} estabelecimentos distintos no PR)", file=sys.stderr)
    print("resumo por CNAE-alvo (principal + secundária; empresa pode contar em mais de um):", file=sys.stderr)
    print(f"  {'cnae':9s} {'descrição':50s} {'total':>7s} {'(princ.)':>9s}", file=sys.stderr)
    for c in sorted(por_alvo, key=lambda k: por_alvo[k], reverse=True):
        if por_alvo[c]:
            print(f"  {c:9s} {CNAES[c][:50]:50s} {por_alvo[c]:>7d} {por_principal[c]:>9d}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
