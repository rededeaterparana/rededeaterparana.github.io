# -*- coding: utf-8 -*-
"""Abre a camada web.cnpj_ater (empresas de ATER geocodificadas) do PostGIS bdgeo no
QGIS via QGIS-MCP (socket 127.0.0.1:9876), CATEGORIZADA POR CATEGORIA DE ATIVIDADE,
com marcadores SVG distintos (ícones da biblioteca do QGIS, escolhidos por palavra-chave
em tempo de execução) + cor por categoria e fallback para formas simples."""
import json
import os
import socket
import struct
import sys

HOST, PORT = "127.0.0.1", 9876
TOKEN = os.environ.get("QGIS_MCP_TOKEN", "").strip()
HDR = struct.Struct(">I")


def _recvn(s, n):
    buf = b""
    while len(buf) < n:
        ch = s.recv(min(65536, n - len(buf)))
        if not ch:
            raise ConnectionError("conexão fechada durante leitura")
        buf += ch
    return buf


def send(cmd, params=None, timeout=180):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect((HOST, PORT))
    msg = {"type": cmd, "params": params or {}}
    if TOKEN:
        msg["token"] = TOKEN
    payload = json.dumps(msg).encode("utf-8")
    s.sendall(HDR.pack(len(payload)) + payload)
    (rlen,) = HDR.unpack(_recvn(s, 4))
    return json.loads(_recvn(s, rlen).decode("utf-8"))


try:
    print("ping ->", send("ping", timeout=8))
except Exception as e:
    print(f"ERRO: QGIS-MCP não respondeu em {HOST}:{PORT} ({e}).")
    print("No QGIS, abra o painel do plugin QGIS MCP e clique em 'Start Server' (porta 9876).")
    sys.exit(1)

code = r'''
import os
from qgis.core import (QgsProject, QgsVectorLayer, QgsDataSourceUri, QgsApplication,
    QgsCategorizedSymbolRenderer, QgsRendererCategory, QgsMarkerSymbol,
    QgsSvgMarkerSymbolLayer, QgsSimpleMarkerSymbolLayer, QgsSimpleMarkerSymbolLayerBase)
from qgis.PyQt.QtGui import QColor

# (categoria, cor, formaFallback, [basenames SVG preferidos, em ordem])
# SVGs escolhidos entre os disponíveis na biblioteca do QGIS (verificados em runtime).
S = QgsSimpleMarkerSymbolLayerBase
CATS = [
    ("Apoio à produção",    "#2e6e3a", S.Triangle, ["tree.svg", "shopping_garden_centre.svg"]),
    ("Produção animal",     "#e67e22", S.Square,   ["sport_horse_racing.svg"]),
    ("Veterinária",         "#c0392b", S.Cross2,   ["health_veterinary.svg"]),
    ("Crédito rural",       "#2980b9", S.Diamond,  ["bank.svg", "money_bank2.svg"]),
    ("Consultoria/técnica", "#8e44ad", S.Star,     []),   # sem SVG adequado -> estrela
    ("Outros",              "#7f8c8d", S.Circle,   ["background_circle.svg"]),
]

# indexa os SVGs disponiveis na biblioteca do QGIS (por basename)
svgs = {}
for base in QgsApplication.svgPaths():
    for root, _d, files in os.walk(base):
        for f in files:
            if f.lower().endswith(".svg"):
                svgs.setdefault(f.lower(), os.path.join(root, f))

def achar_svg(nomes):
    for n in nomes:
        full = svgs.get(n.lower())
        if full:
            return full
    return None

def simbolo(cor, forma, svgpath):
    if svgpath:
        sl = QgsSvgMarkerSymbolLayer(svgpath)
        sl.setSize(4.2)
        for setter in ("setFillColor", "setColor"):
            try: getattr(sl, setter)(QColor(cor))
            except Exception: pass
        try:
            sl.setStrokeColor(QColor("#2b2b2b")); sl.setStrokeWidth(0.2)
        except Exception: pass
    else:
        sl = QgsSimpleMarkerSymbolLayer()
        sl.setShape(forma); sl.setColor(QColor(cor)); sl.setSize(3.0)
        sl.setStrokeColor(QColor("#2b2b2b")); sl.setStrokeWidth(0.2)
    sym = QgsMarkerSymbol(); sym.changeSymbolLayer(0, sl); sym.setOpacity(0.85)
    return sym

proj = QgsProject.instance()
# remove instancias anteriores da camada (evita duplicar)
for lid, lyr0 in list(proj.mapLayers().items()):
    if lyr0.name() == "Empresas de ATER (CNPJ)":
        proj.removeMapLayer(lid)

uri = QgsDataSourceUri()
uri.setConnection("localhost", "5432", "bdgeo", "bdgeo_user", "bdgeo")
uri.setDataSource("web", "cnpj_ater", "geom")
lyr = QgsVectorLayer(uri.uri(False), "Empresas de ATER (CNPJ)", "postgres")
out = {}
if not lyr.isValid():
    out["erro"] = "camada invalida: " + lyr.error().message()
else:
    proj.addMapLayer(lyr)
    cats, escolhidos = [], {}
    for nome, cor, forma, keys in CATS:
        svg = achar_svg(keys)
        escolhidos[nome] = os.path.basename(svg) if svg else "(forma simples)"
        cats.append(QgsRendererCategory(nome, simbolo(cor, forma, svg), nome))
    lyr.setRenderer(QgsCategorizedSymbolRenderer("categoria", cats))
    lyr.triggerRepaint()
    out["n"] = lyr.featureCount()
    out["svgs"] = escolhidos
    try:
        from qgis.utils import iface
        if iface:
            iface.mapCanvas().setExtent(lyr.extent()); iface.mapCanvas().refresh()
            iface.setActiveLayer(lyr); iface.layerTreeView().refreshLayerSymbology(lyr.id())
    except Exception as e:
        out["iface"] = str(e)
print("RESULT:", out)
'''

resp = send("execute_code", {"code": code}, timeout=240)
r = resp.get("result", resp)
print("executed:", r.get("executed"))
if r.get("stdout"):
    print("stdout:", r["stdout"].strip())
if r.get("stderr"):
    print("stderr:", r["stderr"].strip())
if r.get("error"):
    print("ERROR:", r["error"], "\n", (r.get("traceback") or "")[:800])
