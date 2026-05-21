/**
 * Validações server-side. Nunca confiar no cliente.
 */

function validarCNPJ(cnpj) {
  if (!cnpj) return false;
  var s = String(cnpj).replace(/\D/g, '');
  if (s.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(s)) return false;
  var calc = function (base) {
    var pesos = base.length === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    var soma = 0;
    for (var i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    var r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  var d1 = calc(s.substring(0, 12));
  var d2 = calc(s.substring(0, 12) + d1);
  return d1 === parseInt(s[12], 10) && d2 === parseInt(s[13], 10);
}

function validarCPF(cpf) {
  if (!cpf) return false;
  var s = String(cpf).replace(/\D/g, '');
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;
  var calc = function (len) {
    var soma = 0;
    for (var i = 0; i < len; i++) soma += parseInt(s[i], 10) * (len + 1 - i);
    var r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(s[9], 10) && calc(10) === parseInt(s[10], 10);
}

function validarEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) && email.length <= 254;
}

function validarUF(uf) {
  var ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
             'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  return ufs.indexOf(String(uf).toUpperCase()) >= 0;
}

function validarCEP(cep) {
  return /^\d{8}$/.test(String(cep || '').replace(/\D/g, ''));
}

/**
 * Magic bytes — valida que o conteúdo do anexo bate com o MIME alegado.
 * Recebe os primeiros bytes já decodificados (Uint8Array equivalente em Apps Script: Number[]).
 */
function checarMagicBytes(bytes, mime) {
  if (!bytes || bytes.length < 4) return false;
  if (mime === 'application/pdf') {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mime === 'image/jpeg') {
    return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  }
  if (mime === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  }
  return false;
}

function sanitizarNomeArquivo(nome) {
  return String(nome || 'arquivo')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .substring(0, 120);
}

function exigirCampos(obj, campos) {
  var faltando = [];
  for (var i = 0; i < campos.length; i++) {
    var v = obj[campos[i]];
    if (v === undefined || v === null || String(v).trim() === '') faltando.push(campos[i]);
  }
  return faltando;
}

/**
 * Verifica reCAPTCHA v3 com a API do Google.
 * Retorna { ok: bool, score: number }.
 */
function verificarRecaptcha(token, expectedAction) {
  if (!token) return { ok: false, score: 0 };
  var secret = cfg('RECAPTCHA_SECRET');
  var resp = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  var json;
  try { json = JSON.parse(resp.getContentText()); } catch (e) { return { ok: false, score: 0 }; }
  if (!json.success) return { ok: false, score: 0 };
  if (expectedAction && json.action && json.action !== expectedAction) return { ok: false, score: json.score || 0 };
  return { ok: (json.score || 0) >= LIMITS.RECAPTCHA_MIN_SCORE, score: json.score || 0 };
}

/**
 * Origem da requisição. Apps Script não dá acesso confiável ao header Origin,
 * então o frontend envia explicitamente `origin` no payload e nós validamos.
 */
function validarOrigem(origin) {
  var allowed = cfg('ALLOWED_ORIGIN');
  if (!origin || !allowed) return false;
  return origin === allowed;
}

function hashIP(ip) {
  var salt = cfg('IP_HASH_SALT');
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(ip || 'unknown') + ':' + salt
  );
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('').substring(0, 16);
}

/**
 * Rate limit por chave (CNPJ ou IP) usando CacheService.
 * Para "N por hora" usamos um contador com TTL de 3600s.
 */
function checarRateLimit(chave, limite, ttlSeg) {
  var cache = CacheService.getScriptCache();
  var atual = parseInt(cache.get(chave) || '0', 10);
  if (atual >= limite) return false;
  cache.put(chave, String(atual + 1), ttlSeg);
  return true;
}
