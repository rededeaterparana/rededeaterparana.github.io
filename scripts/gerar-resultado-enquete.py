# -*- coding: utf-8 -*-
"""Monta o documento de uma pagina com o resultado final da enquete da identidade.

Gera o HTML; o PDF sai do Chrome headless (unica dependencia externa):

    python scripts/gerar-resultado-enquete.py
    chrome --headless --no-pdf-header-footer            --print-to-pdf=docs/resultado-enquete-identidade-2026-08-24.pdf            file:///<caminho>/resultado-enquete.html

Os numeros vem de scripts/apurar-enquete.py, que roda sobre a aba
`enquete_votos` da planilha da Rede.
"""
import base64
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SAIDA = RAIZ / 'docs' / 'resultado-enquete.html'
# a marca vencedora entra embutida em base64: o PDF precisa ser autossuficiente
marca = base64.b64encode(
    (RAIZ / 'landing' / 'identidades' / 'marcas' / 'ater-folha-cor.png').read_bytes()
).decode('ascii')

HTML = u"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Resultado da enquete da identidade visual - Rede Paranaense de ATER</title>
<style>
  @page { size: A4; margin: 13mm 14mm 11mm; }
  :root {
    --terra-950:#2b2114; --terra-900:#382b18; --terra-700:#6b5427;
    --terra-200:#d9cfa8; --terra-100:#e8e0c4; --terra-50:#f2eddb;
    --superficie:#fffdf6; --tinta:#29241a; --tinta-suave:#5c553f; --tinta-fraca:#8a806a;
    --borda:#ded5b8; --borda-forte:#c9bd99;
    --serif:"Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    --sans:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;
  }
  * { box-sizing:border-box; }
  /* O documento e desenhado em escala 1 e depois ampliado por um fator unico,
     calibrado para ocupar a folha sem passar de UMA pagina. Assim o ajuste fino
     e um numero so, e nao um retrabalho em cada tamanho de fonte. */
  body { zoom: __ZOOM__; margin:0; font-family:var(--sans); color:var(--tinta); font-size:8.7pt; line-height:1.42;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  .faixa { background:var(--terra-950); color:var(--terra-200); padding:5px 12px; border-radius:4px;
           font-size:6.2pt; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
           display:flex; justify-content:space-between; }
  h1 { font-family:var(--serif); font-size:16.5pt; line-height:1.12; margin:14px 0 3px; color:var(--terra-900); }
  .subtitulo { margin:0 0 13px; color:var(--tinta-suave); font-size:8.6pt; max-width:170mm; }

  h2 { font-family:var(--serif); font-size:10.5pt; color:var(--terra-900);
       margin:0 0 2px; padding-bottom:3px; border-bottom:1.4px solid var(--borda-forte); }
  .nota { color:var(--tinta-fraca); font-size:7.4pt; margin:4px 0 9px; }

  .vencedora { display:flex; align-items:center; gap:16px; background:var(--terra-900);
               color:var(--terra-50); border-radius:7px; padding:14px 18px; margin-bottom:15px; }
  .vencedora img { width:76px; background:#fffdf6; border-radius:5px; padding:7px; }
  .vencedora .rotulo { display:block; font-size:6.3pt; font-weight:700; letter-spacing:.14em;
                       text-transform:uppercase; color:var(--terra-200); margin-bottom:3px; }
  .vencedora .nome { font-family:var(--serif); font-size:15pt; line-height:1.1; display:block; }
  .vencedora .placar { margin:5px 0 0; color:var(--terra-200); font-size:8pt; }

  .numeros { display:flex; gap:8px; margin:0 0 16px; }
  .num { flex:1; background:var(--terra-50); border:1px solid var(--borda); border-radius:6px;
         padding:9px 11px; text-align:center; }
  .num b { display:block; font-family:var(--serif); font-size:15pt; color:var(--terra-900); line-height:1.05; }
  .num span { font-size:6.5pt; letter-spacing:.09em; text-transform:uppercase; color:var(--tinta-fraca); font-weight:700; }

  .colunas { display:flex; gap:12mm; margin-bottom:16px; }
  .coluna { flex:1; min-width:0; }

  .linha { display:grid; grid-template-columns:1fr 50px; gap:7px; align-items:center; margin:8px 0 0; }
  .rot { font-size:7.8pt; grid-column:1/-1; margin-bottom:2px; }
  .trilho { background:var(--terra-50); border:1px solid var(--borda); border-radius:3px; height:13px; overflow:hidden; }
  .barra { display:block; background:var(--terra-700); height:100%; }
  .barra.top { background:var(--terra-900); }
  .valor { font-size:7.8pt; text-align:right; color:var(--tinta-suave); white-space:nowrap; }
  .valor b { color:var(--tinta); }

  .criterios { background:var(--superficie); border:1px solid var(--borda); border-left:3px solid var(--terra-700);
               border-radius:7px; padding:12px 16px; }
  .criterios h3 { font-family:var(--serif); font-size:9.4pt; color:var(--terra-900); margin:0 0 7px; }
  .criterios ul { margin:0; padding-left:15px; }
  .criterios li { font-size:7.7pt; color:var(--tinta-suave); margin-bottom:5px; line-height:1.4; }
  .criterios li strong { color:var(--tinta); }
  .criterios li:last-child { margin-bottom:0; }

  .rodape { margin-top:15px; padding-top:8px; border-top:1px solid var(--borda);
            font-size:6.9pt; color:var(--tinta-fraca); display:flex; justify-content:space-between; gap:12px; }
</style></head>
<body>

<div class="faixa"><span>Rede Paranaense de ATER</span><span>Apura&ccedil;&atilde;o final &middot; 24 de agosto de 2026</span></div>

<h1>Enquete da identidade visual: resultado final</h1>
<p class="subtitulo">A vota&ccedil;&atilde;o foi encerrada e a p&aacute;gina de vota&ccedil;&atilde;o saiu do ar.
A apura&ccedil;&atilde;o seguiu a regra anunciada &agrave;s entidades: <strong>um voto por entidade</strong>,
decidido pela maioria simples entre os votantes de cada uma.</p>

<div class="vencedora">
  <img src="data:image/png;base64,__MARCA__" alt="Proposta 1 - Folha e Rede">
  <div>
    <span class="rotulo">Proposta escolhida pela rede</span>
    <span class="nome">Proposta 1 &middot; Folha &amp; Rede</span>
    <p class="placar">9 das 12 entidades que decidiram &middot; 59% dos votos individuais &middot;
      vencedora em todas as formas de contagem</p>
  </div>
</div>

<div class="numeros">
  <div class="num"><b>39</b><span>Votos v&aacute;lidos</span></div>
  <div class="num"><b>14</b><span>Entidades</span></div>
  <div class="num"><b>12</b><span>Entid. decididas</span></div>
  <div class="num"><b>2</b><span>Empates internos</span></div>
</div>

<div class="colunas">
  <div class="coluna">
    <h2>Resultado oficial &middot; por entidade</h2>
    <p class="nota">Cada entidade vale um voto. Empate interno n&atilde;o pontua.</p>
    __BARRAS_PONDERADO__
  </div>
  <div class="coluna">
    <h2>Contagem simples &middot; por voto</h2>
    <p class="nota">Os 39 votos individuais, sem pondera&ccedil;&atilde;o por entidade.</p>
    __BARRAS_SIMPLES__
  </div>
</div>

<div class="criterios">
  <h3>Crit&eacute;rios aplicados na apura&ccedil;&atilde;o</h3>
  <ul>
    <li><strong>Um voto por entidade.</strong> Dentro de cada entidade vale a maioria simples entre seus
      votantes. Duas entidades empataram internamente (1 &times; 1), n&atilde;o pontuam pela regra e ficam
      para decis&atilde;o da Coordena&ccedil;&atilde;o Estadual de ATER &mdash; o desempate delas n&atilde;o
      altera a proposta vencedora.</li>
    <li><strong>39 votos v&aacute;lidos de 40 registros:</strong> exclu&iacute;do 1 voto de teste feito na
      homologa&ccedil;&atilde;o do sistema, em 06/08/2026.</li>
    <li>Votos registrados por unidades, regionais e programas do <strong>IDR-Paran&aacute;</strong> foram
      consolidados na pr&oacute;pria entidade, conforme confer&ecirc;ncia dos v&iacute;nculos dos votantes.</li>
    <li><strong>O resultado n&atilde;o depende do crit&eacute;rio de prazo.</strong> Considerando apenas os
      votos at&eacute; 13/08/2026, data anunciada de encerramento, a Proposta 1 vence com 8 das 11 entidades
      decididas e 62% dos votos individuais.</li>
    <li><strong>Nomes, e-mails e o voto de cada entidade n&atilde;o s&atilde;o divulgados</strong>, conforme a
      LGPD (Lei n&ordm; 13.709/2018) e o que foi informado aos participantes. O detalhamento fica restrito
      &agrave; Coordena&ccedil;&atilde;o Estadual de ATER.</li>
  </ul>
</div>

<div class="rodape">
  <span>Coordena&ccedil;&atilde;o Estadual de ATER &middot; SEAB / IDR-Paran&aacute;</span>
  <span>Fonte: base da enquete, snapshot de 24/08/2026 &middot; rededeaterparana.github.io/enquete.html</span>
</div>

</body></html>"""

# (rotulo, entidades ponderadas, votos simples)
PROPS = [
    (u"Proposta 1 &middot; Folha &amp; Rede",        9, 23),
    (u"Proposta 3 &middot; Territ&oacute;rio Vivo",  2,  6),
    (u"Proposta 5 &middot; Raiz e Arauc&aacute;ria", 1,  5),
    (u"Proposta 2 &middot; Institucional",           0,  4),
    (u"Proposta 6 &middot; Pinh&otilde;es em vinho e azul", 0, 1),
    (u"Proposta 4 &middot; Pinha em escudo",         0,  0),
]


def barras(idx, maxv, fmt):
    """Uma coluna de barras, ordenada pela metrica da propria coluna."""
    linhas = sorted(PROPS, key=lambda p: -p[idx])
    out = []
    for i, p in enumerate(linhas):
        v = p[idx]
        larg = (100.0 * v / maxv) if maxv else 0
        destaque = u' top' if (i == 0 and v) else u''
        out.append(
            u'<div class="linha"><span class="rot">%s</span>'
            u'<span class="trilho"><span class="barra%s" style="width:%.1f%%"></span></span>'
            u'<span class="valor">%s</span></div>' % (p[0], destaque, larg, fmt(v)))
    return u'\n    '.join(out)


pond = barras(1, 9, lambda v: (u'<b>%d</b> ent.' % v) if v else u'0')
simp = barras(2, 23, lambda v: (u'<b>%d</b> &middot; %d%%' % (v, round(100.0 * v / 39))) if v else u'0')

import sys
# 1.14 e o maior fator que ainda cabe em UMA pagina A4 (1.16 ja quebra em duas)
zoom = sys.argv[1] if len(sys.argv) > 1 else '1.14'
html = (HTML.replace('__ZOOM__', zoom)
            .replace('__MARCA__', marca)
            .replace('__BARRAS_PONDERADO__', pond)
            .replace('__BARRAS_SIMPLES__', simp))
SAIDA.write_text(html, encoding='utf-8')
print('%s gerado (%d bytes)' % (SAIDA, len(html)))
