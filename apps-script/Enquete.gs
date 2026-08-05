/**
 * Enquete da identidade visual da Rede.
 *
 * Fluxo isolado do cadastro de entidades: repete as checagens de borda
 * (origem, honeypot, reCAPTCHA) em vez de compartilhar caminho com o doPost
 * do cadastro, para que uma mudança aqui não afete o formulário em produção.
 *
 * Um voto por e-mail. A unicidade é garantida na planilha, dentro do lock —
 * o rate limit por cache é só uma primeira barreira, não é a fonte da verdade.
 */

var ENQUETE_IDENTIDADES = [
  '01-folha-e-rede',
  '02-institucional',
  '03-territorio-vivo',
  '04-pinha-escudo',
  '05-raiz-araucaria',
  '06-pinhoes-vinho',
  '07-pinhoes-verde-amarelo'
];

var ENQUETE_LIMITES = {
  MAX_NOME: 120,
  MAX_ENTIDADE: 120,
  RATE_POR_EMAIL_SEGUNDOS: 60
};

/**
 * Normaliza o e-mail para deduplicar.
 * Minúsculas, sem espaços, e descarta o sufixo "+tag" da parte local —
 * é o disfarce mais trivial para votar duas vezes. Pontos NÃO são removidos:
 * fora do Gmail eles distinguem caixas diferentes.
 */
function normalizarEmail(email) {
  var s = String(email || '').trim().toLowerCase();
  var at = s.lastIndexOf('@');
  if (at < 1) return s;
  var local = s.substring(0, at);
  var dominio = s.substring(at + 1);
  var mais = local.indexOf('+');
  if (mais > 0) local = local.substring(0, mais);
  return local + '@' + dominio;
}

function registrarVotoIdentidade(corpo) {
  var ipHash = hashIP(corpo._ip || '');

  // 1. Origem
  if (!validarOrigem(corpo.origin)) {
    return resposta(403, { erro: 'origem não permitida' });
  }

  // 2. Honeypot
  if (corpo.website_url) {
    registrarLogSeguro(ipHash, corpo.origin, 'enquete_honeypot', '', '');
    return resposta(400, { erro: 'requisição inválida' });
  }

  // 3. reCAPTCHA v3
  var captcha = verificarRecaptcha(corpo.recaptcha_token, 'voto_identidade');
  if (!captcha.ok) {
    return resposta(403, { erro: 'verificação anti-bot falhou' });
  }

  // 4. Campos
  var faltando = exigirCampos(corpo, ['identidade', 'nome', 'email', 'consentimento_lgpd']);
  if (faltando.length) {
    return resposta(400, { erro: 'campos obrigatórios faltando', campos: faltando });
  }
  if (!corpo.consentimento_lgpd) {
    return resposta(400, { erro: 'consentimento LGPD obrigatório' });
  }
  if (ENQUETE_IDENTIDADES.indexOf(String(corpo.identidade)) < 0) {
    return resposta(400, { erro: 'proposta inválida' });
  }
  if (!validarEmail(corpo.email)) {
    return resposta(400, { erro: 'e-mail inválido' });
  }
  var nome = String(corpo.nome).trim().substring(0, ENQUETE_LIMITES.MAX_NOME);
  if (nome.length < 3) {
    return resposta(400, { erro: 'nome muito curto' });
  }
  var entidade = String(corpo.entidade || '').trim().substring(0, ENQUETE_LIMITES.MAX_ENTIDADE);
  var emailNorm = normalizarEmail(corpo.email);

  // 5. Rate limit por e-mail (barreira barata contra reenvio em rajada)
  if (!checarRateLimit('rl:voto:' + emailNorm, 1, ENQUETE_LIMITES.RATE_POR_EMAIL_SEGUNDOS)) {
    return resposta(429, { erro: 'aguarde alguns instantes antes de tentar de novo' });
  }

  // 6. Escrita serializada — a checagem de duplicidade só vale dentro do lock
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {
    return resposta(503, { erro: 'sistema ocupado, tente novamente em instantes' });
  }
  try {
    var ss = abrirPlanilha();
    if (jaVotou(ss, emailNorm)) {
      registrarLogSeguro(ipHash, corpo.origin, 'enquete_duplicado', '', corpo.identidade);
      return resposta(409, { erro: 'este e-mail já votou nesta enquete' });
    }

    abaPorNome(ss, 'enquete_votos').appendRow(montarLinha('enquete_votos', {
      criado_em: new Date(),
      identidade: String(corpo.identidade),
      nome: nome,
      email: String(corpo.email).trim(),
      email_norm: emailNorm,
      entidade: entidade,
      origin: corpo.origin || '',
      ip_hash: ipHash
    }));

    registrarLogSeguro(ipHash, corpo.origin, 'enquete_voto_ok', '', corpo.identidade);
    try { CacheService.getScriptCache().remove('publico:enquete'); } catch (e) {}

    return resposta(200, { ok: true, mensagem: 'Voto registrado.' });
  } finally {
    lock.releaseLock();
  }
}

function jaVotou(ss, emailNorm) {
  var aba = abaPorNome(ss, 'enquete_votos');
  var ultima = aba.getLastRow();
  if (ultima < 2) return false;
  var col = SCHEMA.enquete_votos.indexOf('email_norm') + 1;
  var valores = aba.getRange(2, col, ultima - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === emailNorm) return true;
  }
  return false;
}

/**
 * Apuração pública: só a contagem por proposta. Nunca nome, e-mail ou entidade.
 */
function lerApuracaoEnquete() {
  var ss = abrirPlanilha();
  var aba = abaPorNome(ss, 'enquete_votos');
  var porIdentidade = {};
  for (var i = 0; i < ENQUETE_IDENTIDADES.length; i++) {
    porIdentidade[ENQUETE_IDENTIDADES[i]] = 0;
  }

  var ultima = aba.getLastRow();
  var total = 0;
  if (ultima >= 2) {
    var col = SCHEMA.enquete_votos.indexOf('identidade') + 1;
    var valores = aba.getRange(2, col, ultima - 1, 1).getValues();
    for (var j = 0; j < valores.length; j++) {
      var id = String(valores[j][0]).trim();
      if (porIdentidade.hasOwnProperty(id)) {
        porIdentidade[id]++;
        total++;
      }
    }
  }
  return { por_identidade: porIdentidade, total: total, gerado_em: new Date() };
}
