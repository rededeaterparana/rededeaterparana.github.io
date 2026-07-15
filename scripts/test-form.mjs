// Driver mínimo de Chrome via CDP — sem dependências externas.
// Lança/conecta a um Chrome em modo debug, navega para o form,
// preenche campos via JS injetado e salva screenshot.

import fs from 'node:fs';

const DEBUG_PORT = 9223;
const FORM_URL = process.env.FORM_URL || 'https://rededeaterparana.github.io/form/';
const OUT_DIR = new URL('../.github/', import.meta.url).pathname.replace(/^\//, '');

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function aguardarDebugger(porta, tentativas = 40) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const v = await get(`http://127.0.0.1:${porta}/json/version`);
      return v;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Chrome debug não respondeu em ' + tentativas * 500 + 'ms');
}

function abrirCDP(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pendentes = new Map();
  const eventos = [];
  let nextId = 1;

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve, reject } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      eventos.push(msg);
    }
  });

  function send(method, params = {}, sessionId) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pendentes.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  const pronto = new Promise((r) => ws.addEventListener('open', r));
  return { ws, send, pronto, eventos };
}

async function main() {
  // Anexa a Chrome existente (você lança manualmente; ver instrução).
  console.error('Conectando em http://127.0.0.1:' + DEBUG_PORT + ' ...');
  const info = await aguardarDebugger(DEBUG_PORT, 4);
  console.error('Browser:', info.Browser);

  // Conexão de browser-level
  const browser = abrirCDP(info.webSocketDebuggerUrl);
  await browser.pronto;

  // Cria target/aba nova
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  console.error('Navegando para', FORM_URL);
  await send('Page.navigate', { url: FORM_URL });

  // Espera load
  await new Promise((resolve) => {
    const t = setInterval(() => {
      const ev = browser.eventos.find((e) => e.method === 'Page.loadEventFired');
      if (ev) { clearInterval(t); resolve(); }
    }, 200);
    setTimeout(resolve, 15000);
  });
  await new Promise((r) => setTimeout(r, 5000)); // aguarda hidratação React/reCAPTCHA

  // Diagnóstico — o que veio na página?
  const diag = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      h1: document.querySelector('h1')?.textContent || null,
      labelsCount: document.querySelectorAll('label').length,
      labelsAmostra: [...document.querySelectorAll('label')].slice(0, 5).map(l => l.textContent.trim()),
      cnpjPorPlaceholder: !!document.querySelector('input[placeholder*="000"]'),
      rootChildren: document.getElementById('root')?.children?.length || 0,
      bodyText: document.body.innerText.slice(0, 200)
    })`,
    returnByValue: true
  });
  console.error('Diagnostico:', diag.result?.value);

  // Snippet de preenchimento. Cuidado: react-hook-form precisa de setter nativo.
  const snippet = `
    (async () => {
      function setVal(el, v) {
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype :
                      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype :
                      HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      function click(el) { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); el.click(); }
      function byLabel(texto) {
        const labels = [...document.querySelectorAll('label')];
        const l = labels.find(lb => lb.textContent.trim().toLowerCase().startsWith(texto.toLowerCase()));
        if (!l) return null;
        const parent = l.parentElement;
        return parent?.querySelector('input,select,textarea,.combo input');
      }

      const log = [];
      function set(label, value) {
        const el = byLabel(label);
        if (!el) { log.push('NAO ACHEI: ' + label); return; }
        setVal(el, value);
        log.push(label + ' = ' + value);
      }

      // Marca consentimento LGPD
      const lgpd = document.querySelector('.aviso-lgpd input[type=checkbox]');
      if (lgpd && !lgpd.checked) { lgpd.click(); log.push('LGPD checado'); }

      // Seção 1
      set('CNPJ', '11.222.333/0001-81');
      set('Tipo de entidade', 'Cooperativa');
      set('Data de constituição', '2010-01-01');
      set('Razão social', 'COOPERATIVA TESTE LTDA');
      set('Nome fantasia', 'COOP TESTE');

      // Endereço — gateado pelo ViaCEP, vamos preencher manualmente
      set('CEP', '80035-270');
      await new Promise(r => setTimeout(r, 800));
      set('Logradouro', 'RUA BANDEIRA');
      set('Número', '500');
      set('Bairro', 'CABRAL');
      set('Município', 'CURITIBA');
      set('UF', 'PR');

      // Contatos
      set('E-mail', 'teste@exemplo.com');
      set('Responsável — nome', 'João Silva');
      set('Responsável — CPF', '111.444.777-35');

      // Telefones (1º item já existe) — ordem: DDD, Número, Ramal
      const telefones = [...document.querySelectorAll('.cartao')].find(c => c.querySelector('h2')?.textContent?.includes('Telefones'));
      if (telefones) {
        const ins = telefones.querySelectorAll('input');
        if (ins[0]) { setVal(ins[0], '41'); log.push('DDD = 41'); }
        if (ins[1]) { setVal(ins[1], '33500000'); log.push('Numero = 33500000'); }
      }

      // Área de atuação — adiciona município e clica no item do combobox
      const areaCard = [...document.querySelectorAll('.cartao')].find(c => c.querySelector('h2')?.textContent?.includes('Área geográfica'));
      const btnArea = areaCard?.querySelector('button.secundario');
      if (btnArea) { btnArea.click(); await new Promise(r => setTimeout(r, 200)); }
      const comboMun = areaCard?.querySelector('.combo input');
      if (comboMun) {
        comboMun.focus();
        setVal(comboMun, 'Curitiba');
        await new Promise(r => setTimeout(r, 350));
        // Procura o item Curitiba na lista flutuante
        const lista = areaCard.querySelector('.combo-lista');
        if (lista) {
          const itens = [...lista.querySelectorAll('li')];
          const item = itens.find(li => li.textContent?.trim().toLowerCase().startsWith('curitiba'));
          if (item) {
            item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            log.push('Município escolhido via lista');
          } else { log.push('Curitiba não está na lista'); }
        } else { log.push('Lista do combo não apareceu'); }
      }

      // Equipe técnica — adiciona técnico
      const eqCard = [...document.querySelectorAll('.cartao')].find(c => c.querySelector('h2')?.textContent?.includes('Equipe'));
      const btnEq = eqCard?.querySelector('button.secundario');
      if (btnEq) { btnEq.click(); await new Promise(r => setTimeout(r, 200)); }
      if (eqCard) {
        const ins = eqCard.querySelectorAll('input');
        if (ins[0]) setVal(ins[0], 'Tecnico Teste');
        if (ins[1]) setVal(ins[1], '111.444.777-35');
        if (ins[2]) setVal(ins[2], 'Engenheiro Agrônomo');
      }

      return { log, html_preview: document.querySelector('.cabecalho h1')?.textContent };
    })()
  `;

  console.error('Executando snippet de preenchimento...');
  const res = await send('Runtime.evaluate', {
    expression: snippet,
    awaitPromise: true,
    returnByValue: true
  });
  console.error('Snippet result:', JSON.stringify(res.result?.value, null, 2));

  // ─── Upload de arquivos via CDP DOM.setFileInputFiles ─────────────────
  console.error('Fazendo upload de anexos...');
  const arquivoDummy = (new URL('../.github/og-image.png', import.meta.url)).pathname.replace(/^\//, '');
  const doc = await send('DOM.getDocument', {});
  const fileInputs = await send('DOM.querySelectorAll', {
    nodeId: doc.root.nodeId, selector: 'input[type=file]'
  });
  console.error('  ' + fileInputs.nodeIds.length + ' inputs file encontrados');
  // Os 5 primeiros são obrigatórios
  for (let i = 0; i < Math.min(5, fileInputs.nodeIds.length); i++) {
    await send('DOM.setFileInputFiles', {
      nodeId: fileInputs.nodeIds[i],
      files: [arquivoDummy]
    });
  }
  // React não escuta DOM.setFileInputFiles — preciso disparar change event manualmente
  await send('Runtime.evaluate', {
    expression: `
      document.querySelectorAll('input[type=file]').forEach((el, i) => {
        if (i < 5 && el.files && el.files.length) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    `,
    returnByValue: true
  });
  await new Promise((r) => setTimeout(r, 2500)); // aguarda base64 encoding nos handlers

  // ─── Clica em Enviar ──────────────────────────────────────────────────
  console.error('Clicando em Enviar...');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('button[type=submit]')?.click()`,
    returnByValue: true
  });

  // Espera resposta (até 30s)
  console.error('Aguardando resposta...');
  let resultado = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const probe = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        ok: document.querySelector('.resultado-ok')?.innerText || null,
        erro: document.querySelector('.resultado-erro')?.innerText || null
      })`,
      returnByValue: true
    });
    const r = JSON.parse(probe.result.value);
    if (r.ok || r.erro) { resultado = r; break; }
  }
  console.error('RESULTADO FINAL:', JSON.stringify(resultado, null, 2));

  // Rola pro topo antes do screenshot full-page
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
  await new Promise((r) => setTimeout(r, 500));
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
  fs.writeFileSync(OUT_DIR + 'screenshot-form-preenchido.png', Buffer.from(shot.data, 'base64'));
  console.error('Screenshot salvo: .github/screenshot-form-preenchido.png');

  browser.ws.close();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
