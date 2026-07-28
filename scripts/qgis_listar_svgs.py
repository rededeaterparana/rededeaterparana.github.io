# -*- coding: utf-8 -*-
"""Lista SVGs da biblioteca do QGIS que casam com temas de interesse, via QGIS-MCP."""
import json, os, socket, struct, sys
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


def send(cmd, params=None, timeout=60):
    s = socket.socket(); s.settimeout(timeout); s.connect((HOST, PORT))
    m = {"type": cmd, "params": params or {}}
    if TOKEN:
        m["token"] = TOKEN
    p = json.dumps(m).encode()
    s.sendall(HDR.pack(len(p)) + p)
    (n,) = HDR.unpack(_recvn(s, 4))
    return json.loads(_recvn(s, n).decode())


code = r'''
import os
from qgis.core import QgsApplication
alvo = ["agri","tractor","farm","tree","leaf","forest","plant","garden","wheat","grain","harvest","crop",
        "wrench","tool","gear","cog","hammer","screw","factory","industr","engineer","service","cow","cattle",
        "animal","horse","pig","sheep","bird","bee","paw","vet","bank","money","coin","finance"]
achados = {}
for base in QgsApplication.svgPaths():
    for root,_d,files in os.walk(base):
        for f in files:
            if not f.lower().endswith(".svg"): continue
            low = f.lower()
            for k in alvo:
                if k in low:
                    achados.setdefault(k, [])
                    if f not in achados[k] and len(achados[k])<6:
                        achados[k].append(f)
print("MATCHES:", {k:v for k,v in achados.items() if v})
'''
r = send("execute_code", {"code": code}, timeout=120).get("result", {})
print(r.get("stdout", r))
