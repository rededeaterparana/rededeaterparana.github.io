# -*- coding: utf-8 -*-
"""Exibe, DENTRO do QGIS, um gráfico Plotly interativo da quantidade (e %) de empresas
de ATER por categoria de atividade — num painel (QDockWidget + QWebView), via QGIS-MCP.
Conta a partir da camada web.cnpj_ater já carregada."""
import json
import os
import socket
import struct
import sys

HOST, PORT = "127.0.0.1", 9876
TOKEN = os.environ.get("QGIS_MCP_TOKEN", "").strip()
HDR = struct.Struct(">I")


def _recvn(s, n):
    b = b""
    while len(b) < n:
        c = s.recv(min(65536, n - len(b)))
        if not c:
            raise ConnectionError("fechou")
        b += c
    return b


def send(cmd, params=None, timeout=180):
    s = socket.socket()
    s.settimeout(timeout)
    s.connect((HOST, PORT))
    m = {"type": cmd, "params": params or {}}
    if TOKEN:
        m["token"] = TOKEN
    p = json.dumps(m).encode()
    s.sendall(HDR.pack(len(p)) + p)
    (n,) = HDR.unpack(_recvn(s, 4))
    return json.loads(_recvn(s, n).decode())


try:
    print("ping ->", send("ping", timeout=8))
except Exception as e:
    print(f"ERRO: QGIS-MCP não respondeu ({e}). Inicie o servidor do plugin QGIS MCP (porta 9876).")
    sys.exit(1)

code = r'''
import os, tempfile
from collections import Counter
from qgis.core import QgsProject
from qgis.PyQt.QtWebKitWidgets import QWebView
from qgis.PyQt.QtWidgets import QDockWidget
from qgis.PyQt.QtCore import QUrl, Qt
from qgis.utils import iface
import plotly.graph_objects as go

out = {}
lyr = None
for l in QgsProject.instance().mapLayers().values():
    if l.name() == "Empresas de ATER (CNPJ)":
        lyr = l
        break
if lyr is None:
    out["erro"] = "camada 'Empresas de ATER (CNPJ)' nao esta carregada"
    print("RESULT:", out)
else:
    cnt = Counter()
    for f in lyr.getFeatures():
        cnt[(f["categoria"] or "Outros")] += 1
    total = sum(cnt.values())
    ordem = [c for c, _ in cnt.most_common()]
    cores = {"Apoio à produção": "#2e6e3a", "Produção animal": "#e67e22",
             "Veterinária": "#c0392b", "Crédito rural": "#2980b9",
             "Consultoria/técnica": "#8e44ad", "Outros": "#7f8c8d"}
    vals = [cnt[c] for c in ordem]
    pcts = [100.0 * v / total for v in vals]
    def milhar(v): return f"{v:,}".replace(",", ".")
    texto = [f"<b>{milhar(v)}</b><br>{p:.1f}%" for v, p in zip(vals, pcts)]
    fig = go.Figure(go.Bar(
        x=ordem, y=vals, text=texto, textposition="outside",
        marker_color=[cores.get(c, "#888888") for c in ordem],
        customdata=pcts,
        hovertemplate="%{x}<br>%{y} empresas (%{customdata:.1f}%)<extra></extra>"))
    fig.update_layout(
        title=f"Empresas de ATER no Paraná por categoria (n={milhar(total)})",
        yaxis_title="empresas", xaxis_title=None, template="plotly_white",
        margin=dict(t=64, l=64, r=24, b=90), uniformtext_minsize=8, uniformtext_mode="hide")
    fig.update_yaxes(rangemode="tozero")
    html = fig.to_html(include_plotlyjs=True, full_html=True)
    tmp = os.path.join(tempfile.gettempdir(), "cnpj_ater_categoria.html")
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(html)

    mw = iface.mainWindow()
    for d in mw.findChildren(QDockWidget):
        if d.objectName() == "cnpj_ater_plot":
            d.deleteLater()
    dock = QDockWidget("Empresas de ATER — por categoria", mw)
    dock.setObjectName("cnpj_ater_plot")
    view = QWebView(dock)
    view.load(QUrl.fromLocalFile(tmp))
    dock.setWidget(view)
    dock.setMinimumWidth(460)
    iface.addDockWidget(Qt.RightDockWidgetArea, dock)
    dock.show(); dock.raise_()
    out = {"total": total, "categorias": dict(cnt), "html": tmp}
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
    print("ERROR:", r["error"], "\n", (r.get("traceback") or "")[:900])
