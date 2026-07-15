# Metodologia do ID-ATER: reconstrução, validação e correção

> Documento técnico da Rede Paranaense de ATER. Descreve como o Índice de
> Desenvolvimento da ATER (ID-ATER) é reconstruído a partir dos insumos do
> Levantamento da Capacidade Instalada de ATER, como sua estrutura é validada e
> como as discrepâncias da planilha derivada são corrigidas de forma reprodutível.
>
> Implementação: [`scripts/gerar-diagnostico.py`](../scripts/gerar-diagnostico.py).
> Saída publicada: `painel/src/data/diagnostico.json`.

## 1. O que é o ID-ATER

O ID-ATER resume, numa escala de 0,1 a 1,0, a capacidade instalada de assistência
técnica e extensão rural de cada município. É um **indicador composto aditivo**:

```
ID-ATER(m) = Σ_i  fator_i(m) × peso_i  /  10
```

onde `i` percorre 11 indicadores agrupados em três áreas, cada `fator_i` é um
inteiro de 1 a 10 obtido por **limiares absolutos** sobre o valor bruto, e os
`peso_i` somam 1,0. O cálculo é próprio da rede (SEAB/IDR-Paraná) — portanto as
inconsistências da planilha derivada são corrigidas aqui, não apenas ressalvadas.

## 2. Estrutura reconstruída (fatores e pesos)

As funções de pontuação foram **reconstruídas empiricamente** a partir dos 399
municípios (par valor→fator de cada indicador) e conferidas contra a coluna de
fator da planilha. Regra geral: **quanto menor a pressão sobre o serviço, maior o
fator** (menos estabelecimentos por técnico ⇒ melhor situação).

| # | Indicador | Área (peso da área) | Peso | Função fator |
|---|-----------|--------------------|------|--------------|
| 1 | Taxa de ATER | Situação da ATER (40%) | 0,20 | `clamp(⌈v/10⌉, 1, 10)` — crescente |
| 5 | Estab. por equiv. técnico | Situação da ATER | 0,10 | `clamp(11 − ⌈v/25⌉, 1, 10)` — decrescente |
| 9 | Avaliação da ATER pelo CMDRS | Situação da ATER | 0,10 | **constante** (v=1,5 ⇒ F=5) |
| 3 | Estabelecimentos rurais | Abrangência (20%) | 0,05 | `clamp(11 − ⌈v/100⌉, 1, 10)` — decrescente |
| 2 | Estab. da agricultura familiar | Abrangência | 0,05 | `clamp(11 − ⌈v/100⌉, 1, 10)` — decrescente |
| 4 | Estabelecimentos com CAF | Abrangência | 0,05 | `clamp(11 − ⌈v/100⌉, 1, 10)` — decrescente |
| 10 | Propriedades com CAR | Abrangência | 0,05 | **constante** (v=500 ⇒ F=5) |
| 7 | Desenvolvimento humano (IDH-M) | Impacto da ATER (40%) | 0,10 | bandas absolutas de ~0,05 — crescente |
| 6 | Valor bruto da produção por hectare | Impacto da ATER | 0,10 | bandas absolutas de ~2.000 — crescente |
| 11 | Disponibilidade hídrica | Impacto da ATER | 0,10 | **constante** (v=800 ⇒ F=7) |
| 8 | Crédito rural | Impacto da ATER | 0,10 | **constante** (v=0,5 ⇒ F=5) |

A reconstrução é usada como **oráculo de validação**: o script recomputa o fator a
partir do valor bruto e aborta se ele não reproduzir a planilha (invariante
`fator_i ∈ {1..10}`, `Σ peso_i = 1,0`, `Ind_i = fator_i × peso_i`,
`ID-ATER = Σ Ind_i / 10`, todos conferidos município a município).

## 3. Técnica de correção

O tratamento segue a disciplina de **edição estatística de dados** da estatística
oficial, que separa a *detecção* (regras de edição) do *tratamento*
(corrigir/imputar vs. apenas sinalizar), e a metodologia de **indicadores
compostos** do Handbook OECD/JRC. Dois princípios orientam tudo:

1. **Reconstruir a partir dos insumos brutos autoritativos**, nunca da planilha
   derivada (o artefato onde os erros se infiltraram).
2. **Reconciliar por chave canônica (código IBGE), nunca por posição de linha** —
   foi a dependência de posição que deixou a rotação passar despercebida.

### 3.1 Reprodutibilidade

O índice é reconstruído como código versionado (fonte única de verdade). Qualquer
terceiro re-executa `scripts/gerar-diagnostico.py` sobre as mesmas planilhas e
obtém exatamente o mesmo `diagnostico.json`. Isto corresponde à recomendação de
"regras como código" (pacotes `validate`/`errorlocate`/`deducorrect` em R;
`COINr` para o pipeline OECD/JRC) — aqui implementada em Python.

### 3.2 Reconciliação com a fonte primária — a rotação (Achado A)

No `ÍNDICE DE ATER.xlsx`, os valores de *estabelecimentos da agricultura familiar*
dos três municípios "Diamante" estavam **rotacionados** (permutação cíclica): o
multiconjunto de valores coincide com o do Formulário I, mas a atribuição
valor→município é uma permutação sem ponto fixo (*derangement*).

- **Detecção:** *join* da planilha derivada com o Formulário I (fonte primária,
  concordante com o Censo) pelo código IBGE; a regra `valor_derivado == valor_fonte`
  falha exatamente nos 3 municípios, e `sorted(valores)` coincide entre as fontes —
  assinatura de rotação, não de erro de medição.
- **Correção:** *survivorship* "Formulário I vence" — reatribuir cada valor ao
  município correto (correção **dedutiva/determinística**, não imputação
  estatística) e recalcular `fator`, `Ind_2` e `ID-ATER` pela mesma regra.

### 3.3 Edição lógica "parte ≤ todo" — a subcontagem (Achado B)

Declaramos o *edit* fatal `agric. familiar ≤ total de estabelecimentos rurais`.
Pela localização de erro de Fellegi-Holt (mudança mínima com pesos de
confiabilidade), como a agricultura familiar concorda com a fonte primária, o
campo suspeito é o **total** (subcontado na coleta), não a parte. Onde o total
verdadeiro **não é recuperável** da fonte, o município é apenas **sinalizado**
(não imputado): não se inventa número. Só passaríamos a corrigir se o total
correto fosse recuperável e a correção movesse o fator inteiro (edição seletiva
por impacto no índice).

## 4. Correções aplicadas e dados em revisão

Registrados em `diagnostico.json → meta` e exibidos na página do diagnóstico.

**Correções estruturais aplicadas** (`meta.correcoesEstruturais`) — rotação
desfeita pela reconciliação com o Formulário I:

| Município | Agric. familiar (de → para) | ID-ATER (de → para) |
|-----------|------------------------------|----------------------|
| Diamante do Norte | 496 → 105 | 0,550 → **0,565** |
| Diamante do Sul | 105 → 350 | 0,530 → **0,520** |
| Diamante d'Oeste | 350 → 496 | 0,540 → **0,535** |

Por ser uma permutação dos mesmos três valores, **a média estadual não muda**
(0,580); apenas a atribuição por município se corrige. A correção do Diamante do
Norte também elimina a violação parte>todo daquele município (105 ≤ 176).

**Dados em revisão na fonte** (`meta.dadosEmRevisao`) — sinalizados, não corrigidos:

| Município | Situação | Provável causa |
|-----------|----------|----------------|
| Nova Prata do Iguaçu | 792 familiares para 186 estab. rurais | total subcontado na coleta |
| Pinhalão | 496 familiares para 405 estab. rurais | total subcontado na coleta |

Nestes casos o Formulário I e a planilha do índice **concordam** sobre a
agricultura familiar; a impossibilidade lógica está no total. Como o valor
autoritativo do total não está disponível no levantamento, o caso segue para
verificação na fonte (revisão da coleta / conferência com o Censo Agropecuário).

## 5. Achado estrutural: indicadores constantes ("peso morto")

Quatro dos 11 indicadores são **constantes em todos os 399 municípios** (variância
zero): Avaliação da ATER pelo CMDRS, Propriedades com CAR, Disponibilidade hídrica
e Crédito rural. Juntos somam **35% do peso nominal** (`meta.pesoConstante`).

Num índice aditivo, um subindicador constante soma o **mesmo** valor a todos os
municípios: ele desloca o *nível* do índice, mas **não altera nenhum ranking**.
Em termos de indicadores compostos, os pesos medem *substituibilidade*, não
importância; a importância efetiva de um indicador é sua razão de correlação com o
composto. Como a correlação de um indicador constante é ~0, seu **peso efetivo é
~0** apesar dos 35% nominais — os 7 indicadores com variância concentram ~100% do
poder discriminante com apenas 65% do peso nominal. Isto é registrado como achado
estrutural (não corrigido: depende de nova coleta), e comunicado na página para que
o peso publicado não seja lido como "importância" que não gera diferenciação.

## 6. Próximos passos recomendados

Para uma revisão metodológica formal do índice (fora do escopo desta publicação,
mas fundamentado na literatura abaixo):

1. **Tabela peso nominal × peso efetivo** (razão de correlação de Pearson) para os
   11 indicadores — evidência numérica do peso morto.
2. **Análise de incerteza e sensibilidade global** (Monte Carlo sobre os pesos;
   índices de Sobol de 1ª e total ordem) para mostrar, com intervalos de confiança
   de ranking, que remover/re-ponderar os 4 constantes **não altera** as posições.
3. **Sensibilidade aos limiares** das funções de fator (os cortes absolutos atuam
   como re-peso implícito; indicadores "saturados" comportam-se como quase-constantes).
4. **Re-especificação**: remover os constantes e redistribuir seus 35% entre os 7
   discriminantes (a ponderação por entropia serve de referência objetiva), ou
   mantê-los documentando que são itens de "nível/conformidade", não de discriminação.
5. **Reconciliação com o total do Censo Agropecuário** para os municípios em revisão.

## Referências

- OECD/EC-JRC (2008). *Handbook on Constructing Composite Indicators: Methodology
  and User Guide.* Nardo, Saisana, Saltelli, Tarantola, Hoffmann, Giovannini. OECD Publishing.
- Fellegi, I. P. & Holt, D. (1976). "A Systematic Approach to Automatic Edit and
  Imputation." *JASA* 71(353):17–35.
- De Waal, T., Pannekoek, J. & Scholtus, S. (2011). *Handbook of Statistical Data
  Editing and Imputation.* Wiley.
- van der Loo, M. & de Jonge, E. (2021). "Data Validation Infrastructure for R."
  *Journal of Statistical Software* 97(10). (pacotes `validate`, `errorlocate`, `deducorrect`)
- Paruolo, P., Saisana, M. & Saltelli, A. (2013). "Ratings and rankings: voodoo or
  science?" *JRSS-A* 176(3):609–634.
- Becker, W., Saisana, M., Paruolo, P. & Vandecasteele, I. (2017). "Weights and
  importance in composite indicators: closing the gap." *Ecological Indicators* 80:12–22.
- Saisana, M., Saltelli, A. & Tarantola, S. (2005). "Uncertainty and sensitivity
  analysis techniques as tools for the quality assessment of composite indicators."
  *JRSS-A* 168(2):307–323.
- Becker, W. (2022). "COINr: An R package for developing composite indicators."
  *Journal of Open Source Software* 7(78):4567.
- Christen, P. (2012). *Data Matching.* Springer. (record linkage determinístico)
- Kelemen et al. (2024). "A sensitivity analysis of composite indicators: Min/max
  thresholds." *Environmental and Sustainability Indicators.*
