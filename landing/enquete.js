/**
 * Enquete da identidade visual da Rede Paranaense de ATER.
 *
 * O voto é validado e deduplicado no servidor (Apps Script, action=voto_identidade).
 * Aqui só cuidamos de UX: pré-seleção pela query string, validação de forma,
 * reCAPTCHA v3 e leitura da apuração depois que o voto é aceito.
 */
(function () {
  'use strict';

  var IDENTIDADES = {
    '01-folha-e-rede': 'Folha & Rede',
    '02-institucional': 'Institucional',
    '03-territorio-vivo': 'Território Vivo / Micélio',
    '04-pinha-escudo': 'Pinha / Escudo',
    '05-raiz-araucaria': 'Raiz / Araucária',
    '06-pinhoes-vinho': 'Pinhões — vinho & azul',
    '07-pinhoes-verde-amarelo': 'Pinhões — marrom, verde & amarelo'
  };

  var CHAVE_ESCOLHA = 'ater:enquete:escolha';
  var CHAVE_VOTOU = 'ater:enquete:votou';

  var form = document.getElementById('form-enquete');
  var btn = document.getElementById('btn-votar');
  var escolhido = document.getElementById('escolhido');
  var avisoErro = document.getElementById('aviso-erro');
  var avisoInfo = document.getElementById('aviso-info');
  var confirmacao = document.getElementById('confirmacao');
  var textoConfirmacao = document.getElementById('texto-confirmacao');
  var caixaResultado = document.getElementById('resultado');

  function meta(nome) {
    var el = document.querySelector('meta[name="' + nome + '"]');
    var v = el ? (el.getAttribute('content') || '').trim() : '';
    // se o build não substituiu o placeholder, trata como não configurado
    return v.indexOf('__') === 0 ? '' : v;
  }

  var API_URL = meta('ater:api-url');
  var SITE_KEY = meta('ater:recaptcha-site-key');

  // ─── estado da escolha ────────────────────────────────────────────────

  function radios() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="identidade"]'));
  }

  function selecionada() {
    var m = radios().filter(function (r) { return r.checked; })[0];
    return m ? m.value : '';
  }

  function pintarEscolha() {
    var v = selecionada();
    if (v && IDENTIDADES[v]) {
      escolhido.textContent = 'Sua escolha: ' + IDENTIDADES[v] + '.';
      escolhido.setAttribute('data-vazio', 'false');
      try { localStorage.setItem(CHAVE_ESCOLHA, v); } catch (e) { /* modo privado */ }
    } else {
      escolhido.textContent = 'Nenhuma proposta marcada ainda.';
      escolhido.setAttribute('data-vazio', 'true');
    }
  }

  function preSelecionar() {
    var alvo = '';
    try {
      var qs = new URLSearchParams(window.location.search);
      alvo = qs.get('escolha') || '';
    } catch (e) { alvo = ''; }
    if (!alvo || !IDENTIDADES[alvo]) {
      try { alvo = localStorage.getItem(CHAVE_ESCOLHA) || ''; } catch (e) { alvo = ''; }
    }
    if (alvo && IDENTIDADES[alvo]) {
      radios().forEach(function (r) { if (r.value === alvo) r.checked = true; });
    }
    pintarEscolha();
  }

  radios().forEach(function (r) { r.addEventListener('change', pintarEscolha); });

  // ─── avisos ───────────────────────────────────────────────────────────

  function limparAvisos() {
    [avisoErro, avisoInfo].forEach(function (el) {
      el.textContent = '';
      el.setAttribute('data-visivel', 'false');
    });
  }

  function mostrarErro(msg) {
    avisoErro.textContent = msg;
    avisoErro.setAttribute('data-visivel', 'true');
    avisoInfo.setAttribute('data-visivel', 'false');
    avisoErro.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function mostrarInfo(msg) {
    avisoInfo.textContent = msg;
    avisoInfo.setAttribute('data-visivel', 'true');
    avisoErro.setAttribute('data-visivel', 'false');
  }

  // ─── reCAPTCHA v3 ─────────────────────────────────────────────────────

  var recaptchaCarregado = null;

  function carregarRecaptcha() {
    if (!SITE_KEY) return Promise.resolve(null);
    if (recaptchaCarregado) return recaptchaCarregado;
    recaptchaCarregado = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(SITE_KEY);
      s.async = true;
      s.onload = function () { resolve(window.grecaptcha || null); };
      s.onerror = function () { reject(new Error('recaptcha indisponível')); };
      document.head.appendChild(s);
    });
    return recaptchaCarregado;
  }

  function tokenRecaptcha() {
    if (!SITE_KEY) return Promise.resolve('');
    return carregarRecaptcha().then(function (g) {
      if (!g || !g.execute) return '';
      return new Promise(function (resolve) {
        g.ready(function () {
          g.execute(SITE_KEY, { action: 'voto_identidade' })
            .then(resolve)
            .catch(function () { resolve(''); });
        });
      });
    }).catch(function () { return ''; });
  }

  // ─── apuração ─────────────────────────────────────────────────────────

  function pintarResultado(apuracao) {
    if (!apuracao || !apuracao.total) {
      caixaResultado.textContent = '';
      return;
    }
    var porId = apuracao.por_identidade || {};
    var linhas = Object.keys(IDENTIDADES).map(function (id) {
      return { id: id, nome: IDENTIDADES[id], votos: Number(porId[id] || 0) };
    }).sort(function (a, b) { return b.votos - a.votos; });

    // montado via DOM (nada de innerHTML com dado vindo do servidor)
    caixaResultado.textContent = '';

    var titulo = document.createElement('h2');
    titulo.style.fontSize = '1.1rem';
    titulo.style.marginBottom = '4px';
    titulo.textContent = 'Apuração parcial — ' + apuracao.total +
      (apuracao.total === 1 ? ' voto' : ' votos');
    caixaResultado.appendChild(titulo);

    // a contagem exibida é bruta; o resultado final pondera por entidade
    var nota = document.createElement('p');
    nota.style.margin = '0 0 16px';
    nota.style.fontSize = '.86rem';
    nota.style.color = 'var(--tinta-fraca)';
    nota.textContent = 'Contagem por pessoa. Na decisão final os votos são ponderados ' +
      'para que cada entidade pese uma vez, então esta ordem pode mudar.';
    caixaResultado.appendChild(nota);

    linhas.forEach(function (l) {
      var pct = Math.round((l.votos / apuracao.total) * 100);

      var nome = document.createElement('span');
      nome.textContent = l.nome;
      var contagem = document.createElement('b');
      contagem.textContent = l.votos + (l.votos === 1 ? ' voto' : ' votos') + ' · ' + pct + '%';

      var rot = document.createElement('div');
      rot.className = 'rot';
      rot.appendChild(nome);
      rot.appendChild(contagem);

      var preenche = document.createElement('div');
      preenche.className = 'preenche';
      preenche.style.width = pct + '%';
      var trilho = document.createElement('div');
      trilho.className = 'trilho';
      trilho.appendChild(preenche);

      var bloco = document.createElement('div');
      bloco.className = 'barra-res';
      bloco.appendChild(rot);
      bloco.appendChild(trilho);
      caixaResultado.appendChild(bloco);
    });
  }

  function buscarApuracao() {
    if (!API_URL) return Promise.resolve(null);
    return fetch(API_URL + '?action=enquete_resultado', { method: 'GET', redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  function concluir(titulo, mensagem) {
    form.style.display = 'none';
    confirmacao.setAttribute('data-visivel', 'true');
    confirmacao.querySelector('h2').textContent = titulo;
    textoConfirmacao.textContent = mensagem;
    confirmacao.scrollIntoView({ block: 'start', behavior: 'smooth' });
    buscarApuracao().then(pintarResultado);
  }

  // ─── envio ────────────────────────────────────────────────────────────

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    limparAvisos();

    var nome = document.getElementById('nome');
    var email = document.getElementById('email');
    var entidade = document.getElementById('entidade');
    var consentimento = document.getElementById('consentimento');
    var honeypot = document.getElementById('website_url');

    [nome, email, entidade].forEach(function (c) { c.removeAttribute('aria-invalid'); });

    var identidade = selecionada();
    if (!identidade) {
      mostrarErro('Escolha uma das sete propostas antes de votar.');
      document.querySelector('.propostas').scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (nome.value.trim().length < 3) {
      nome.setAttribute('aria-invalid', 'true');
      nome.focus();
      mostrarErro('Informe seu nome completo.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      mostrarErro('Informe um e-mail válido.');
      return;
    }
    if (entidade.value.trim().length < 2) {
      entidade.setAttribute('aria-invalid', 'true');
      entidade.focus();
      mostrarErro('Informe a entidade que você representa — a apuração final pondera um voto por entidade.');
      return;
    }
    if (!consentimento.checked) {
      consentimento.focus();
      mostrarErro('É preciso autorizar o uso do nome, do e-mail e da entidade para registrar o voto.');
      return;
    }
    if (!API_URL) {
      mostrarErro('A enquete ainda não está configurada neste ambiente. Avise a Coordenação Estadual de ATER.');
      return;
    }

    btn.disabled = true;
    var rotuloOriginal = btn.textContent;
    btn.textContent = 'Registrando…';
    mostrarInfo('Validando e registrando o voto…');

    tokenRecaptcha().then(function (token) {
      var payload = {
        action: 'voto_identidade',
        identidade: identidade,
        nome: nome.value.trim(),
        email: email.value.trim(),
        entidade: entidade.value.trim(),
        consentimento_lgpd: true,
        website_url: honeypot.value,
        origin: window.location.origin,
        recaptcha_token: token
      };
      // text/plain evita preflight CORS — Apps Script aceita JSON cru.
      return fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    }).then(function (r) {
      return r.text();
    }).then(function (txt) {
      var dados;
      try { dados = JSON.parse(txt); } catch (e) { dados = null; }
      if (!dados) throw new Error('resposta inválida do servidor');

      if (dados.ok) {
        try { localStorage.setItem(CHAVE_VOTOU, '1'); } catch (e) { /* modo privado */ }
        concluir('Voto registrado. Obrigado!',
                 'Seu voto na proposta “' + (IDENTIDADES[identidade] || identidade) +
                 '” foi registrado. Cada pessoa vota uma única vez.');
        return;
      }
      if (dados._status === 409) {
        try { localStorage.setItem(CHAVE_VOTOU, '1'); } catch (e) { /* modo privado */ }
        concluir('Este e-mail já votou',
                 'Só o primeiro voto vale. Se acha que houve engano, fale com a ' +
                 'Coordenação Estadual de ATER.');
        return;
      }
      throw new Error(dados.erro || 'não foi possível registrar o voto');
    }).catch(function (err) {
      mostrarErro('Não deu para registrar o voto: ' + (err && err.message ? err.message : 'erro inesperado') +
                  '. Tente novamente em instantes.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = rotuloOriginal;
    });
  });

  // ─── inicialização ────────────────────────────────────────────────────

  preSelecionar();

  var jaVotou = false;
  try { jaVotou = localStorage.getItem(CHAVE_VOTOU) === '1'; } catch (e) { jaVotou = false; }
  if (jaVotou) {
    concluir('Você já votou',
             'Este navegador já registrou um voto nesta enquete. Cada pessoa vota uma única vez.');
  }

  if (!API_URL) {
    mostrarInfo('Modo de visualização: as propostas podem ser abertas, mas o registro de votos ainda não está ativo.');
  }
})();
