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
  '06-pinhoes-vinho'
];

var ENQUETE_LIMITES = {
  MAX_NOME: 120,
  MAX_ENTIDADE: 120,
  MIN_ENTIDADE: 2,
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

/**
 * Normaliza o nome da entidade para agrupar os votos na apuração ponderada.
 *
 * Resolve só as diferenças de digitação: caixa, acentos, pontuação e espaços.
 * NÃO resolve sinônimos — "IDR-PR", "IDR Paraná" e "Instituto de Desenvolvimento
 * Rural" viram chaves distintas. Por isso o agrupamento final é uma conferência
 * humana sobre a coluna `entidade` original; `entidade_norm` só reduz o trabalho.
 */
function normalizarEntidade(texto) {
  var s = String(texto || '').trim().toLowerCase();
  // Remove acentos. As marcas do NFD são montadas por código para o fonte
  // ficar ASCII puro, e precisam sair ANTES do filtro abaixo — senão "São"
  // viraria "sa o" em vez de "sao".
  var COMBINANTES = new RegExp('[' + String.fromCharCode(0x300) + '-' +
                               String.fromCharCode(0x36f) + ']', 'g');
  try { s = s.normalize('NFD').replace(COMBINANTES, ''); } catch (e) { /* runtime antigo */ }
  s = s.replace(/[^a-z0-9]+/g, ' ');   // pontuação e hífens viram separador
  return s.trim().replace(/\s+/g, ' ');
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
  var faltando = exigirCampos(corpo, ['identidade', 'nome', 'email', 'entidade', 'consentimento_lgpd']);
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
  var entidade = String(corpo.entidade).trim().substring(0, ENQUETE_LIMITES.MAX_ENTIDADE);
  var entidadeNorm = normalizarEntidade(entidade);
  // valida a forma normalizada: um campo só com pontuação não identifica ninguém
  if (entidadeNorm.length < ENQUETE_LIMITES.MIN_ENTIDADE) {
    return resposta(400, { erro: 'informe a entidade que você representa' });
  }
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
      entidade_norm: entidadeNorm,
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
 * Apuração ponderada: um voto por entidade. Função ADMINISTRATIVA — rode pelo
 * editor do Apps Script, não é exposta pelo doGet.
 *
 * Fica de fora da rota pública de propósito: divulgar o voto consolidado por
 * entidade permitiria inferir como cada organização votou, o que a contagem
 * simples do `enquete_resultado` não revela.
 *
 * Dentro de cada entidade vale a maioria simples. Empate interno não é
 * desempatado por código — a entidade entra em `empates` para decisão humana,
 * e não pontua em `por_identidade`.
 *
 * Escreve o resultado no log de execução e devolve o objeto.
 */
function apurarPorEntidade() {
  var ss = abrirPlanilha();
  var aba = abaPorNome(ss, 'enquete_votos');
  var ultima = aba.getLastRow();
  if (ultima < 2) {
    console.log('Nenhum voto registrado.');
    return { por_identidade: {}, entidades: 0, empates: [] };
  }

  var cols = SCHEMA.enquete_votos;
  var dados = aba.getRange(2, 1, ultima - 1, cols.length).getValues();
  var colId = cols.indexOf('identidade');
  var colEntNorm = cols.indexOf('entidade_norm');
  var colEnt = cols.indexOf('entidade');

  // entidade -> { rotulo, contagem por identidade }
  var porEntidade = {};
  for (var i = 0; i < dados.length; i++) {
    var chave = String(dados[i][colEntNorm] || '').trim();
    // votos gravados antes desta coluna existir caem no rótulo original
    if (!chave) chave = normalizarEntidade(dados[i][colEnt]);
    if (!chave) continue;
    if (!porEntidade[chave]) {
      porEntidade[chave] = { rotulo: String(dados[i][colEnt] || chave), votos: {} };
    }
    var ident = String(dados[i][colId] || '').trim();
    if (ENQUETE_IDENTIDADES.indexOf(ident) < 0) continue;
    porEntidade[chave].votos[ident] = (porEntidade[chave].votos[ident] || 0) + 1;
  }

  var porIdentidade = {};
  for (var k = 0; k < ENQUETE_IDENTIDADES.length; k++) porIdentidade[ENQUETE_IDENTIDADES[k]] = 0;

  var empates = [];
  var detalhe = [];
  var chaves = Object.keys(porEntidade);
  for (var j = 0; j < chaves.length; j++) {
    var ent = porEntidade[chaves[j]];
    var melhor = [];
    var maxVotos = 0;
    for (var ident2 in ent.votos) {
      if (ent.votos[ident2] > maxVotos) { maxVotos = ent.votos[ident2]; melhor = [ident2]; }
      else if (ent.votos[ident2] === maxVotos) { melhor.push(ident2); }
    }
    if (melhor.length === 1) {
      porIdentidade[melhor[0]]++;
      detalhe.push({ entidade: ent.rotulo, escolha: melhor[0], votos_internos: ent.votos });
    } else {
      empates.push({ entidade: ent.rotulo, empatadas: melhor, votos_internos: ent.votos });
    }
  }

  var resultado = {
    por_identidade: porIdentidade,
    entidades: chaves.length,
    entidades_decididas: chaves.length - empates.length,
    empates: empates,
    detalhe: detalhe
  };

  console.log('Apuração ponderada — 1 voto por entidade');
  console.log('Entidades: ' + resultado.entidades +
              ' (decididas: ' + resultado.entidades_decididas +
              ', empatadas: ' + empates.length + ')');
  for (var m = 0; m < ENQUETE_IDENTIDADES.length; m++) {
    var id3 = ENQUETE_IDENTIDADES[m];
    console.log('  ' + id3 + ': ' + porIdentidade[id3]);
  }
  if (empates.length) {
    console.log('Empates internos (decidir manualmente):');
    for (var n = 0; n < empates.length; n++) {
      console.log('  ' + empates[n].entidade + ' -> ' + empates[n].empatadas.join(', '));
    }
  }
  console.log('ATENÇÃO: `entidade_norm` só normaliza digitação. Confira a coluna ' +
              '`entidade` para juntar variações do mesmo nome (ex.: "IDR-PR" e "IDR Paraná").');
  return resultado;
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
