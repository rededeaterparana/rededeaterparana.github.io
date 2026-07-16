#!/usr/bin/env python3
"""Gera painel/src/data/diagnostico.json a partir das planilhas do levantamento.

Fonte: Levantamento da Capacidade Instalada de ATER, executado pelas Unidades
Regionais do IDR-Paraná nos 399 municípios. As planilhas ficam fora do Git
(ver .gitignore); só o agregado gerado aqui vai para o ar.

Uso:
    python scripts/gerar-diagnostico.py [--fonte dados] [--saida painel/src/data/diagnostico.json]

O script falha se algum invariante do ID-ATER não fechar — é preferível não
gerar nada a publicar número errado num painel oficial.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

import pandas as pd

PLANILHA_FORM_I = "CAPACIDADE INSTALADA DE ATER - LEVANTAMENTO INFORMAÇÕES - FORMULÁRIO I.xlsx"
PLANILHA_FORM_II = "CAPACIDADE INSTALADA DE ATER - ANÁLISES - FORMULÁRIO II.xlsx"
PLANILHA_INDICE = "ÍNDICE DE ATER.xlsx"

MUNICIPIOS_PR = 399

# Os 11 indicadores do ID-ATER. `peso` é o peso específico definido na aba
# "DESCRIÇÃO DE INDICADORES"; os pesos somam 1,0 e cada fator vai de 1 a 10,
# então o índice = soma(fator * peso) / 10 e cai sempre em [0,1; 1,0].
INDICADORES = [
    (1, "Taxa de ATER", "Situação da ATER", 0.20, "F 1", "TAXA  ATER"),
    (9, "Avaliação da ATER pelo CMDRS", "Situação da ATER", 0.10, "F 9", "Situação da ATER"),
    (5, "Estabelecimentos por equivalente técnico", "Situação da ATER", 0.10, "F 5", "Est. por Equv. Téc."),
    (3, "Estabelecimentos rurais", "Abrangência", 0.05, "F 3", "Estab. Rurais"),
    (2, "Estabelecimentos da agricultura familiar", "Abrangência", 0.05, "F 2", "Estab.  AgriFamiliar"),
    (4, "Estabelecimentos com CAF", "Abrangência", 0.05, "F 4", "CAF"),
    (10, "Propriedades com CAR", "Abrangência", 0.05, "F 10", "CAR"),
    (7, "Desenvolvimento humano (IDH-M)", "Impacto da ATER", 0.10, "F 7", "IDH-M"),
    (6, "Valor bruto da produção por hectare", "Impacto da ATER", 0.10, "F 6", "VBP/ha 2024"),
    (11, "Disponibilidade hídrica", "Impacto da ATER", 0.10, "F 11", "Dis Hid"),
    (8, "Crédito rural", "Impacto da ATER", 0.10, "F 8", "Crédito Rural"),
]

AREAS = [
    ("Situação da ATER", 0.40),
    ("Abrangência", 0.20),
    ("Impacto da ATER", 0.40),
]

FAIXAS = [
    ("Até 0,40", 0.00, 0.40),
    ("0,40 a 0,50", 0.40, 0.50),
    ("0,50 a 0,60", 0.50, 0.60),
    ("0,60 a 0,70", 0.60, 0.70),
    ("Acima de 0,70", 0.70, 1.01),
]

TIPOS_ENTIDADE = [
    ("Entidade pública de ATER", "Tipo de Entidade - Entidade Publica de ATER"),
    ("Cooperativa", "Tipo de Entidade - Cooperativa"),
    ("Empresa", "Tipo de Entidade - Empresa"),
    ("Empresa de planejamento", "Tipo de Entidade - Empresa Planejamento"),
    ("ONG", "Tipo de Entidade - ONG"),
    ("Sistema S", "Tipo de Entidade - Sistema S"),
    ("Profissional liberal", "Tipo de Entidade - Profissional Liberal"),
    ("Outro", "Tipo de Entidade - Outro"),
]

FORMACOES = [
    ("Técnico em agropecuária", "P Técnico em Agropecuária (total)"),
    ("Agronomia", "P Agronomia (total)"),
    ("Medicina veterinária", "P Medicina Veterinária (total)"),
    ("Zootecnia", "P Zootecnia (total)"),
    ("Assistência social", "P Assistência Social (total)"),
    ("Engenharia florestal", "P Engenharia Florestal (total)"),
    ("Engenharia ambiental", "P Engenharia Ambiental (total)"),
    ("Engenharia de alimentos", "P Engenharia de Alimentos (total)"),
    ("Engenharia de produção", "P Engenharia de Produção (total)"),
    ("Administração", "P Administração (total)"),
    ("Economia", "P Economia (total)"),
    ("Pedagogia", "P Pedagogia (total)"),
    ("Tecnólogo ambiental", "P Tecnólogo Ambiental (total)"),
    ("Gestão de cooperativas", "P Gestão de Cooperativas (total)"),
    ("Técnico em meio ambiente", "P Técnico em Meio Ambiente (total)"),
]

AREAS_ATUACAO = [
    ("Assistência técnica para produção", "Assistência Técnica para Produção"),
    ("Assistência gerencial para produção", "Assistência Gerencial para Produção"),
    ("Planejamento agropecuário e crédito rural", "Assistência em Planejamento Agropecuário e Crédito Rural"),
    ("Acesso a políticas públicas", "Assistência para acesso e execução de Politicas Públicas"),
    ("Assessoria para cooperativas", "Assessoria para Cooperativas"),
    ("Assessoria para associações", "Assessoria para Associações"),
    ("Assessoria para entidades representativas", "Assessoria para entidades representativas"),
    ("Preservação e recuperação ambiental", "Assistência Técnica para Preservação e Recuperação Ambiental"),
    ("Agroecologia e orgânicos", "Assistência Técnica em Agroecologia e Orgânicos"),
    ("Sistemas de integração", "Assistência Técnica em Sistema de Integração"),
    ("Mercado e comercialização", "Assessoria em mercado e comercialização"),
    ("Insumos e produtos agropecuários", "Orientação sobre insumos e produtos agropecuários"),
    ("Máquinas e equipamentos", "Orientação sobre uso de máquinas e equipamentos"),
    ("Agroindústrias", "Assessoria para Agroindústrias"),
    ("Turismo rural", "Assessoria em turismo rural"),
    ("Inclusão socioprodutiva", "Assistência Técnica para Inclusão Socioprodutiva"),
    ("Outras áreas", "Atuação em Outras áreas"),
]

# Formulário II: cada tema recebe do CMDRS uma nota de situação e uma de
# relevância, ambas de 0 a 3. As colunas "S ..." e "I ..." não têm grafia
# simétrica na planilha, por isso o par é declarado explicitamente.
TEMAS_ANALISE = [
    ("Quantidade de entidades", "S Quantid. Entidade", "I Quantid. entidade"),
    ("Quantidade de profissionais", "S Quantid. Profiss.", "I Quantid. Profiss."),
    ("Formação dos profissionais", "S Formação Profiss", "I Formação Profiss"),
    ("Qualidade dos serviços", "S Qual. serviços", "I Qual. serviços"),
    ("Continuidade dos serviços", "S Continui. Serviços", "I Continui. Serviços"),
    ("Abrangência de produtores", "S Abrang. Produtores", "I Abrang. Produtores"),
    ("Abrangência de área", "S Abrang. Área", "I Abrang. Área"),
    ("Estrutura", "S Estrutura", "I Estrutura"),
    ("Rede e parcerias", "S Rede e Parcerias", "I Rede e Parcerias"),
    ("Integração com a pesquisa", "S Integração Pesquisa", "I Integração Pesquisa"),
    ("Integração com o ensino", "S Integração Ensino", "I Integração Ensino"),
    ("Resultados", "S Resultado", "I Resultado"),
    ("Planejamento", "S Planej.", "I Planej."),
]

GOVERNANCA_SIM_NAO = [
    ("Serviço municipal de ATER", "SERVIÇO MUNICIPAL"),
    ("Profissionais de ATER no município", "PROFISSIONAIS ATER MUNICÍPIO"),
    ("Plano de desenvolvimento rural", "Plano Des"),
    ("Plano municipal de ATER", "Plano ATER"),
    ("Fundo municipal", "Fundo"),
    ("Programas e projetos de ATER", "Prog e Proj ATER"),
    ("Contratos de ATER", "Contratos de ATER"),
    ("Parcerias formais", "Parceria Formal"),
    ("Parcerias informais", "Parceria Informal"),
]


class ErroDeDados(Exception):
    """Invariante do levantamento não fechou — abortar antes de gerar o JSON."""


def normalizar(nome: object) -> str:
    """Achata acentos, quebras de linha e espaços repetidos de um cabeçalho.

    As planilhas trazem cabeçalhos com \n embutido, espaços duplos e nomes que
    chegaram com mojibake do Google Forms; comparar pela forma normalizada é o
    único jeito estável de casar coluna.
    """
    texto = unicodedata.normalize("NFKD", str(nome))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texto).strip().lower()


def coluna(df: pd.DataFrame, alvo: str) -> pd.Series:
    """Devolve a coluna cujo cabeçalho normalizado casa com `alvo`."""
    procurado = normalizar(alvo)
    for nome in df.columns:
        if normalizar(nome) == procurado:
            return df[nome]
    raise ErroDeDados(f"coluna ausente na planilha: {alvo!r}")


def numero(serie: pd.Series) -> pd.Series:
    """Converte para número tratando o decimal com vírgula das planilhas."""
    if serie.dtype == object:
        serie = serie.astype(str).str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    return pd.to_numeric(serie, errors="coerce")


def carregar(caminho: Path, aba: str) -> pd.DataFrame:
    """Lê uma aba e descarta as linhas de padding (sem município)."""
    if not caminho.exists():
        raise ErroDeDados(f"planilha não encontrada: {caminho}")
    df = pd.read_excel(caminho, sheet_name=aba)
    df = df[df["Municipio"].notna() & df["CodIbge"].notna()].copy()
    df["CodIbge"] = pd.to_numeric(df["CodIbge"], errors="coerce").astype("Int64")
    df = df.drop_duplicates(subset="CodIbge")
    if len(df) != MUNICIPIOS_PR:
        raise ErroDeDados(
            f"{caminho.name} / {aba}: {len(df)} municípios, esperados {MUNICIPIOS_PR}"
        )
    return df


def soma_flags(df: pd.DataFrame, alvo: str) -> int:
    """Conta municípios com a flag marcada (a planilha usa 1 ou célula vazia)."""
    return int(numero(coluna(df, alvo)).fillna(0).sum())


def validar_indice(idx: pd.DataFrame) -> None:
    """Confere, município a município, que o ID-ATER fecha com seus 11 fatores.

    Esta é a checagem que impede de publicar um índice errado: se a planilha
    mudar de metodologia, o script para aqui em vez de gerar um JSON silencioso.
    """
    pesos = sum(peso for _, _, _, peso, _, _ in INDICADORES)
    if abs(pesos - 1.0) > 1e-9:
        raise ErroDeDados(f"os pesos dos indicadores somam {pesos}, deveriam somar 1,0")

    total = pd.Series(0.0, index=idx.index)
    for n, nome, _area, peso, col_fator, _col_valor in INDICADORES:
        fator = numero(coluna(idx, col_fator))
        contrib = numero(coluna(idx, f"Ind {n}"))
        if fator.isna().any():
            raise ErroDeDados(f"indicador {n} ({nome}): fator ausente em algum município")
        if (fator < 1).any() or (fator > 10).any():
            fora = int(((fator < 1) | (fator > 10)).sum())
            raise ErroDeDados(f"indicador {n} ({nome}): fator fora de 1..10 em {fora} municípios")
        desvio = (contrib - fator * peso).abs().max()
        if desvio > 1e-6:
            raise ErroDeDados(
                f"indicador {n} ({nome}): Ind {n} != F {n} x {peso} (desvio máximo {desvio})"
            )
        total += contrib

    indice = numero(coluna(idx, "Índice de ATER"))
    desvio = (indice - total / 10).abs().max()
    if desvio > 1e-6:
        raise ErroDeDados(f"o índice não fecha com a soma dos 11 indicadores (desvio {desvio})")
    if (indice < 0).any() or (indice > 1).any():
        raise ErroDeDados("índice fora de [0, 1]")


# ─── Correção da estrutura do índice (reconciliação e edição) ───────────────
#
# O ID-ATER é cálculo próprio da Rede/IDR-Paraná, então as discrepâncias
# estruturais da planilha derivada são corrigidas aqui — não apenas ressalvadas.
# A técnica segue a prática de edição de dados em estatística oficial:
#   1. Reprodutibilidade — a função fator do indicador é reconstruída em código e
#      validada contra a planilha; se não reproduzir, aborta (não entendemos a
#      estrutura, não publicamos).
#   2. Reconciliação entre fontes — o valor de agricultura familiar é conferido
#      contra o Formulário I (fonte primária, concorda com o Censo) pela chave do
#      IBGE; onde diverge, a fonte primária prevalece. Isso desfaz a rotação da
#      coluna entre municípios vizinhos.
#   3. Edição lógica (parte <= todo) — municípios em que a agricultura familiar
#      ainda supera o total de estabelecimentos são SINALIZADOS, não imputados: o
#      defeito está no total (subcontagem) e depende de nova coleta na fonte.

def fator_agf(valor: float) -> int:
    """Fator do indicador 2 (estabelecimentos da agricultura familiar).

    Menos estabelecimentos => situação de ATER melhor. Regra por limiar absoluto
    de 100, reconstruída dos 399 municípios: F = clamp(11 - ceil(valor/100), 1, 10).
    """
    return max(1, min(10, 11 - math.ceil(valor / 100)))


def reconciliar(
    idx: pd.DataFrame,
    ent: pd.DataFrame,
    indice_oficial: pd.Series,
    estab_rurais: pd.Series,
    agf_oficial: pd.Series,
) -> tuple[pd.Series, pd.Series, list[dict], list[dict]]:
    """Reconcilia a agricultura familiar com o Formulário I e corrige o índice.

    Devolve (agf_corrigido, indice_corrigido, correcoes, em_revisao).
    """
    peso_agf = next(peso for n, _, _, peso, _, _ in INDICADORES if n == 2)

    # 1. Reprodutibilidade: a regra do fator tem de reproduzir a planilha.
    f2_planilha = numero(coluna(idx, "F 2"))
    valido = agf_oficial.notna() & f2_planilha.notna()
    reproduzido = agf_oficial[valido].map(fator_agf).astype(int)
    if not reproduzido.equals(f2_planilha[valido].astype(int)):
        divergentes = int((reproduzido != f2_planilha[valido].astype(int)).sum())
        raise ErroDeDados(
            f"a regra do fator de agricultura familiar não reproduz a planilha "
            f"({divergentes} divergências) — estrutura do índice não confirmada"
        )

    # 2. Fonte primária (Formulário I) pela chave do IBGE.
    ref = pd.DataFrame(
        {"cod": ent["CodIbge"], "agf": numero(coluna(ent, "Estab. Agri Fam"))}
    ).set_index("cod")["agf"]
    nomes = coluna(idx, "Municipio").astype(str)

    agf_corrigido = agf_oficial.copy()
    indice_corrigido = indice_oficial.copy()
    correcoes: list[dict] = []
    for pos, cod in enumerate(idx["CodIbge"]):
        v_idx = agf_oficial.iloc[pos]
        if pd.isna(cod) or pd.isna(v_idx):
            continue
        v_form = ref.get(int(cod))
        if v_form is None or pd.isna(v_form) or int(v_form) == int(v_idx):
            continue
        f2_de, f2_para = fator_agf(v_idx), fator_agf(v_form)
        novo_indice = round(indice_oficial.iloc[pos] + (f2_para - f2_de) * peso_agf / 10, 3)
        agf_corrigido.iloc[pos] = v_form
        indice_corrigido.iloc[pos] = novo_indice
        correcoes.append({
            "municipio": nomes.iloc[pos],
            "cod": int(cod),
            "campo": "Estabelecimentos da agricultura familiar",
            "de": int(v_idx),
            "para": int(v_form),
            "fatorDe": f2_de,
            "fatorPara": f2_para,
            "indiceDe": round(float(indice_oficial.iloc[pos]), 3),
            "indicePara": novo_indice,
            "motivo": "coluna rotacionada na planilha derivada; adotado o valor do Formulário I (concorda com o Censo)",
        })

    # 3. Edição lógica: agricultura familiar não pode superar o total rural.
    em_revisao: list[dict] = []
    for pos, cod in enumerate(idx["CodIbge"]):
        agf = agf_corrigido.iloc[pos]
        rur = estab_rurais.iloc[pos]
        if pd.notna(agf) and pd.notna(rur) and agf > rur:
            em_revisao.append({
                "municipio": nomes.iloc[pos],
                "cod": int(cod) if pd.notna(cod) else None,
                "problema": "agricultura familiar maior que o total de estabelecimentos rurais",
                "detalhe": f"{int(agf)} familiares para {int(rur)} estabelecimentos — total provavelmente subcontado na coleta",
            })
    return agf_corrigido, indice_corrigido, correcoes, em_revisao


def indicadores_constantes(idx: pd.DataFrame) -> list[dict]:
    """Indicadores cujo fator é o mesmo em todos os municípios (variância zero).

    Não discriminam municípios: entram no índice como deslocamento fixo. São
    reportados para transparência, não corrigidos (dependem de nova coleta).
    """
    constantes = []
    for n, nome, _area, peso, col_fator, _col_valor in INDICADORES:
        fator = numero(coluna(idx, col_fator)).dropna()
        if fator.nunique() == 1:
            constantes.append({"n": n, "nome": nome, "fator": int(fator.iloc[0]), "peso": peso})
    return constantes


def pesos_efetivos(idx: pd.DataFrame, indice: pd.Series) -> list[dict]:
    """Peso efetivo de cada indicador: a importância real, medida pela correlação
    de Pearson entre o fator e o índice, e não pelo peso nominal.

    Em agregação linear ponderada o peso mede substituibilidade, não importância;
    a importância efetiva é a razão de correlação (Paruolo, Saisana & Saltelli,
    2013). Indicadores de variância zero têm correlação e peso efetivo ~0, ainda
    que detenham peso nominal.
    """
    correlacoes = {}
    for n, _nome, _area, _peso, col_fator, _col_valor in INDICADORES:
        fator = numero(coluna(idx, col_fator))
        correlacoes[n] = 0.0 if fator.std() == 0 else float(fator.corr(indice))
    soma = sum(c * c for c in correlacoes.values())
    efetivos = [
        {
            "n": n,
            "nome": nome,
            "pesoNominal": peso,
            "correlacao": round(correlacoes[n], 3),
            "pesoEfetivo": round(correlacoes[n] ** 2 / soma, 3) if soma > 0 else 0.0,
        }
        for n, nome, _area, peso, _col_fator, _col_valor in INDICADORES
    ]
    efetivos.sort(key=lambda e: e["pesoEfetivo"], reverse=True)
    return efetivos


def montar(fonte: Path) -> dict:
    idx = carregar(fonte / PLANILHA_INDICE, "ATER - ÍNDICE ID-ATER")
    gov = carregar(fonte / PLANILHA_FORM_I, "ATER - GOVERNANÇA")
    ent = carregar(fonte / PLANILHA_FORM_I, "ATER - ENTIDADES E PROFISSIONAL")
    ana = carregar(fonte / PLANILHA_FORM_II, "ATER - FORMULÁRIO II")

    validar_indice(idx)

    indice_oficial = numero(coluna(idx, "Índice de ATER"))
    estab_rurais = numero(coluna(idx, "Estab. Rurais"))
    agf_oficial = numero(coluna(idx, "Estab.  AgriFamiliar"))
    estab_agf, indice, correcoes, em_revisao = reconciliar(
        idx, ent, indice_oficial, estab_rurais, agf_oficial
    )
    constantes = indicadores_constantes(idx)
    peso_constante = round(sum(c["peso"] for c in constantes), 2)
    efetivos = pesos_efetivos(idx, indice)

    taxa = numero(coluna(idx, "TAXA  ATER"))
    tecnicos = numero(coluna(ent, "Total Técnicos"))
    equiv = numero(coluna(ent, "Equivalente Técnico (total)"))

    # As três tabelas são independentes; alinhá-las pelo código do IBGE evita
    # depender da ordem das linhas, que difere entre as planilhas.
    base = pd.DataFrame({
        "cod": idx["CodIbge"],
        "nome": coluna(idx, "Municipio").astype(str),
        "regional": coluna(idx, "RegIdr").astype(str),
        "meso": coluna(idx, "MesoIdr").astype(str),
        "idAter": indice,
        "taxaAter": taxa,
        "estabRurais": estab_rurais,
        "estabAgf": estab_agf,
    }).set_index("cod")
    pessoal = pd.DataFrame({
        "cod": ent["CodIbge"],
        "tecnicos": tecnicos,
        "equivTecnico": equiv,
    }).set_index("cod")
    base = base.join(pessoal, how="inner")
    if len(base) != MUNICIPIOS_PR:
        raise ErroDeDados(f"junção por CodIbge resultou em {len(base)} municípios")

    total_estab = float(base["estabRurais"].sum())
    total_equiv = float(base["equivTecnico"].sum())
    if total_equiv <= 0:
        raise ErroDeDados("soma de equivalentes técnicos é zero — planilha suspeita")

    municipios = [
        {
            "cod": int(cod),
            "nome": r["nome"],
            "regional": r["regional"],
            "meso": r["meso"],
            "idAter": round(float(r["idAter"]), 3),
            "taxaAter": round(float(r["taxaAter"]), 1),
            "estabRurais": int(r["estabRurais"]),
            "estabAgf": int(r["estabAgf"]),
            "tecnicos": int(r["tecnicos"]),
            "equivTecnico": round(float(r["equivTecnico"]), 2),
        }
        for cod, r in base.sort_values("nome").iterrows()
    ]

    faixas = [
        {"faixa": rotulo, "municipios": int(((indice >= lo) & (indice < hi)).sum())}
        for rotulo, lo, hi in FAIXAS
    ]
    if sum(f["municipios"] for f in faixas) != MUNICIPIOS_PR:
        raise ErroDeDados("as faixas do índice não cobrem os 399 municípios")

    por_regional = [
        {
            "regional": nome,
            "media": round(float(g["idAter"].mean()), 3),
            "municipios": int(len(g)),
        }
        for nome, g in base.groupby("regional")
    ]
    por_regional.sort(key=lambda r: r["media"], reverse=True)

    # Contribuição média de cada área para o índice: quanto dos 0,40 possíveis
    # em "Situação da ATER" o estado de fato alcança, e assim por diante.
    contrib_area = {area: 0.0 for area, _ in AREAS}
    indicadores = []
    for n, nome, area, peso, col_fator, col_valor in INDICADORES:
        fator = numero(coluna(idx, col_fator))
        media_fator = float(fator.mean())
        contrib = media_fator * peso / 10
        contrib_area[area] += contrib
        indicadores.append({
            "n": n,
            "nome": nome,
            "area": area,
            "peso": peso,
            "fatorMedio": round(media_fator, 2),
            "aproveitamento": round(media_fator / 10, 3),
            "valorMedio": round(float(numero(coluna(idx, col_valor)).mean()), 2),
        })

    areas = [
        {
            "area": area,
            "peso": peso,
            "contribuicao": round(contrib_area[area], 3),
            "aproveitamento": round(contrib_area[area] / peso, 3),
        }
        for area, peso in AREAS
    ]

    conselho = [
        {"situacao": "Ativo", "municipios": soma_flags(gov, "Conselho. Sim, ativo")},
        {"situacao": "Inativo", "municipios": soma_flags(gov, "Conselho. Sim, inativo")},
        {"situacao": "Não existe", "municipios": soma_flags(gov, "Conselho. Não")},
    ]
    if sum(c["municipios"] for c in conselho) != MUNICIPIOS_PR:
        raise ErroDeDados("as respostas sobre o conselho não somam 399 municípios")

    estrutura = [
        {"item": rotulo, "sim": soma_flags(gov, col), "nao": MUNICIPIOS_PR - soma_flags(gov, col)}
        for rotulo, col in GOVERNANCA_SIM_NAO
    ]

    orc_total = numero(coluna(gov, "ORÇ. TOTAL (R$)")).clip(lower=0).sum()
    orc_ater = numero(coluna(gov, "ORÇ. ATER (R$)")).clip(lower=0).sum()

    tipos = [
        {"tipo": rotulo, "entidades": int(numero(coluna(ent, col)).fillna(0).sum())}
        for rotulo, col in TIPOS_ENTIDADE
    ]
    tipos.sort(key=lambda t: t["entidades"], reverse=True)

    formacoes = [
        {"formacao": rotulo, "profissionais": int(numero(coluna(ent, col)).fillna(0).sum())}
        for rotulo, col in FORMACOES
    ]
    formacoes.sort(key=lambda f: f["profissionais"], reverse=True)

    atuacao = [
        {"area": rotulo, "entidades": int(numero(coluna(ent, col)).fillna(0).sum())}
        for rotulo, col in AREAS_ATUACAO
    ]
    atuacao.sort(key=lambda a: a["entidades"], reverse=True)

    analise = [
        {
            "tema": rotulo,
            "situacao": round(float(numero(coluna(ana, col_s)).mean()), 2),
            "relevancia": round(float(numero(coluna(ana, col_i)).mean()), 2),
        }
        for rotulo, col_s, col_i in TEMAS_ANALISE
    ]

    return {
        "meta": {
            "geradoEm": date.today().isoformat(),
            "fonte": "Levantamento da Capacidade Instalada de ATER — SEAB/IDR-Paraná",
            "municipios": MUNICIPIOS_PR,
            "metodologiaIndice": "ID-ATER: 11 indicadores em 3 áreas, fator de 1 a 10 por município; índice = soma(fator × peso) / 10",
            "correcoesEstruturais": correcoes,
            "dadosEmRevisao": em_revisao,
            "indicadoresConstantes": constantes,
            "pesoConstante": peso_constante,
            "pesosEfetivos": efetivos,
        },
        "resumo": {
            "municipios": MUNICIPIOS_PR,
            "idAterMedio": round(float(indice.mean()), 3),
            "idAterMediana": round(float(indice.median()), 3),
            "idAterMinimo": round(float(indice.min()), 3),
            "idAterMaximo": round(float(indice.max()), 3),
            "profissionais": int(base["tecnicos"].sum()),
            "equivalenteTecnico": round(total_equiv, 1),
            "estabRurais": int(total_estab),
            "estabAgf": int(base["estabAgf"].sum()),
            "estabPorEquivTecnico": round(total_estab / total_equiv, 1),
            "taxaAterMedia": round(float(taxa.mean()), 1),
            "orcamentoMunicipalTotal": int(orc_total),
            "orcamentoAter": int(orc_ater),
        },
        "indice": {
            "faixas": faixas,
            "porRegional": por_regional,
            "areas": areas,
            "indicadores": indicadores,
        },
        "governanca": {"conselho": conselho, "estrutura": estrutura},
        "entidades": {"tipos": tipos, "atuacao": atuacao},
        "profissionais": {"formacoes": formacoes},
        "analise": analise,
        "municipios": municipios,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fonte", type=Path, default=Path("dados"), help="pasta com as planilhas do levantamento")
    p.add_argument("--saida", type=Path, default=Path("painel/src/data/diagnostico.json"))
    args = p.parse_args()

    try:
        dados = montar(args.fonte)
    except ErroDeDados as e:
        print(f"erro nos dados: {e}", file=sys.stderr)
        return 1

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(
        json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    r = dados["resumo"]
    print(f"gerado {args.saida} ({args.saida.stat().st_size / 1024:.0f} KB)")
    print(f"  {r['municipios']} municípios · ID-ATER médio {r['idAterMedio']:.3f}")
    print(f"  {r['profissionais']:,} profissionais · {r['equivalenteTecnico']:,.1f} equivalentes técnicos")
    print(f"  {r['estabRurais']:,} estabelecimentos rurais · {r['estabPorEquivTecnico']:.1f} por equivalente técnico")

    m = dados["meta"]
    if m["correcoesEstruturais"]:
        print(f"\n{len(m['correcoesEstruturais'])} correções estruturais (reconciliação com o Formulário I):")
        for c in m["correcoesEstruturais"]:
            print(f"  · {c['municipio']}: {c['campo']} {c['de']}→{c['para']} "
                  f"(índice {c['indiceDe']:.3f}→{c['indicePara']:.3f})")
    if m["dadosEmRevisao"]:
        print(f"\n{len(m['dadosEmRevisao'])} municípios com dados em revisão na fonte (não corrigidos):")
        for d in m["dadosEmRevisao"]:
            print(f"  · {d['municipio']}: {d['problema']} — {d['detalhe']}")
    if m["indicadoresConstantes"]:
        print(f"\n{len(m['indicadoresConstantes'])} indicadores constantes "
              f"({m['pesoConstante']:.0%} do peso, sem poder discriminante):")
        for i in m["indicadoresConstantes"]:
            print(f"  · {i['nome']} (peso {i['peso']}, fator {i['fator']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
