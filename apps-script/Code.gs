/**
 * Web App: doPost (cadastrar entidade), doGet (listar agregado para o painel).
 *
 * Deploy: Web App, "Execute as: me", "Who has access: Anyone".
 * Toda a defesa vive aqui — o frontend é público e pode ser falsificado.
 */

function doPost(e) {
  try {
    var corpo = parseCorpo(e);
    var ipHash = hashIP(corpo._ip || '');

    // 1. Origem
    if (!validarOrigem(corpo.origin)) {
      return resposta(403, { erro: 'origem não permitida' });
    }

    // 2. Honeypot — qualquer valor no campo invisível derruba o envio.
    if (corpo.website_url) {
      registrarLogSeguro(ipHash, corpo.origin, 'honeypot', '', '');
      return resposta(400, { erro: 'requisição inválida' });
    }

    // 3. reCAPTCHA v3
    var captcha = verificarRecaptcha(corpo.recaptcha_token, 'cadastro_entidade');
    if (!captcha.ok) {
      return resposta(403, { erro: 'verificação anti-bot falhou', score: captcha.score });
    }

    // 4. Validações de campos obrigatórios
    var faltando = exigirCampos(corpo, [
      'cnpj','razao_social','nome_fantasia','data_constituicao',
      'logradouro','numero','bairro','cep','municipio','uf','email',
      'responsavel_nome','responsavel_cpf','tipo_entidade','consentimento_lgpd'
    ]);
    if (faltando.length) return resposta(400, { erro: 'campos obrigatórios faltando', campos: faltando });
    if (!corpo.consentimento_lgpd) return resposta(400, { erro: 'consentimento LGPD obrigatório' });

    if (!validarCNPJ(corpo.cnpj)) return resposta(400, { erro: 'CNPJ inválido' });
    if (!validarCPF(corpo.responsavel_cpf)) return resposta(400, { erro: 'CPF do responsável inválido' });
    if (!validarEmail(corpo.email)) return resposta(400, { erro: 'e-mail inválido' });
    if (!validarUF(corpo.uf)) return resposta(400, { erro: 'UF inválida' });
    if (!validarCEP(corpo.cep)) return resposta(400, { erro: 'CEP inválido' });

    // Validação das listas (CPFs da equipe)
    if (Array.isArray(corpo.equipe)) {
      for (var i = 0; i < corpo.equipe.length; i++) {
        if (corpo.equipe[i].cpf && !validarCPF(corpo.equipe[i].cpf)) {
          return resposta(400, { erro: 'CPF inválido em equipe técnica', indice: i });
        }
      }
    }

    // 5. Rate limit por CNPJ e por IP
    var chaveCNPJ = 'rl:cnpj:' + corpo.cnpj.replace(/\D/g, '');
    if (!checarRateLimit(chaveCNPJ, 1, LIMITS.RATE_PER_CNPJ_SECONDS)) {
      return resposta(429, { erro: 'aguarde antes de reenviar este CNPJ' });
    }
    var chaveIP = 'rl:ip:' + ipHash;
    if (!checarRateLimit(chaveIP, LIMITS.RATE_PER_IP_HOURLY, 3600)) {
      return resposta(429, { erro: 'limite de envios por hora atingido' });
    }

    // 6. Anexos — soma e limite total
    var anexos = Array.isArray(corpo.anexos) ? corpo.anexos : [];
    var totalBytes = 0;
    for (var j = 0; j < anexos.length; j++) {
      var b = anexos[j].base64 || '';
      // base64 → bytes ≈ length * 3/4
      totalBytes += Math.floor(b.length * 3 / 4);
    }
    if (totalBytes > LIMITS.MAX_TOTAL_BYTES) {
      return resposta(413, { erro: 'tamanho total dos anexos excede o limite' });
    }

    // 7. Lock para serializar escritas concorrentes
    var lock = LockService.getScriptLock();
    try { lock.waitLock(15000); } catch (e) {
      return resposta(503, { erro: 'sistema ocupado, tente novamente em instantes' });
    }
    try {
      var ss = abrirPlanilha();
      var protocolo = 'ATER-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss') + '-' +
                      String(corpo.cnpj).replace(/\D/g, '').slice(-4);

      // 8. Salva anexos antes de gravar na planilha (fail-fast em arquivos suspeitos).
      var pasta = pastaDoCNPJ(corpo.cnpj, corpo.razao_social);
      var anexosSalvos = [];
      for (var k = 0; k < anexos.length; k++) {
        anexosSalvos.push(salvarAnexo(pasta, anexos[k]));
      }

      // 9. Upsert entidade
      var registro = {
        cnpj: String(corpo.cnpj).replace(/\D/g, ''),
        razao_social: corpo.razao_social,
        nome_fantasia: corpo.nome_fantasia,
        inscricao_estadual: corpo.inscricao_estadual || 'ISENTA',
        data_constituicao: corpo.data_constituicao,
        logradouro: corpo.logradouro,
        numero: corpo.numero,
        complemento: corpo.complemento || '',
        bairro: corpo.bairro,
        cep: String(corpo.cep).replace(/\D/g, ''),
        municipio: corpo.municipio,
        uf: String(corpo.uf).toUpperCase(),
        tipo_endereco: corpo.tipo_endereco || 'Comercial',
        email: corpo.email,
        site: corpo.site || '',
        responsavel_nome: corpo.responsavel_nome,
        responsavel_cpf: String(corpo.responsavel_cpf).replace(/\D/g, ''),
        responsavel_telefone: corpo.responsavel_telefone || '',
        contato2_nome: corpo.contato2_nome || '',
        contato2_cpf: corpo.contato2_cpf ? String(corpo.contato2_cpf).replace(/\D/g, '') : '',
        tipo_entidade: corpo.tipo_entidade,
        protocolo: protocolo,
        status: 'pendente_revisao'
      };
      upsertEntidade(ss, registro);

      // 10. Replace nas filhas
      replaceFilhas(ss, 'telefones', registro.cnpj, corpo.telefones || []);
      replaceFilhas(ss, 'area_atuacao', registro.cnpj, corpo.area_atuacao || []);
      replaceFilhas(ss, 'equipe', registro.cnpj, corpo.equipe || []);
      replaceFilhas(ss, 'imoveis', registro.cnpj, corpo.imoveis || []);
      replaceFilhas(ss, 'veiculos', registro.cnpj, corpo.veiculos || []);
      replaceFilhas(ss, 'eq_informatica', registro.cnpj, corpo.eq_informatica || []);
      replaceFilhas(ss, 'eq_rede', registro.cnpj, corpo.eq_rede || []);
      replaceFilhas(ss, 'eq_extensionista', registro.cnpj, corpo.eq_extensionista || []);
      replaceFilhas(ss, 'anexos', registro.cnpj, anexosSalvos);

      registrarLogSeguro(ipHash, corpo.origin, 'cadastro_ok', mascararCNPJ(registro.cnpj), protocolo);

      // Invalida cache do GET para refletir a nova entidade rapidamente.
      try { CacheService.getScriptCache().remove('publico:listar'); } catch (e) {}

      return resposta(200, {
        ok: true,
        protocolo: protocolo,
        mensagem: 'Cadastro recebido. Está em análise pela equipe.'
      });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // Não vazar mensagens internas para o cliente.
    try { console.error(err && err.stack || err); } catch (e) {}
    return resposta(500, { erro: 'falha interna ao processar o cadastro' });
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'listar';
    if (action !== 'listar') return resposta(400, { erro: 'ação desconhecida' });

    var cache = CacheService.getScriptCache();
    var cached = cache.get('publico:listar');
    if (cached) return resposta(200, JSON.parse(cached));

    var dados = lerAgregadoPublico();
    cache.put('publico:listar', JSON.stringify(dados), LIMITS.CACHE_GET_SECONDS);
    return resposta(200, dados);
  } catch (err) {
    try { console.error(err && err.stack || err); } catch (e) {}
    return resposta(500, { erro: 'falha ao consultar dados' });
  }
}

/**
 * Snapshot semanal — instalar como trigger time-based (Edit → Current project's triggers).
 */
function backupSemanal() {
  var origem = DriveApp.getFileById(cfg('SHEET_ID'));
  var destino = DriveApp.getFolderById(cfg('BACKUP_FOLDER_ID'));
  var nome = 'backup-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
  origem.makeCopy(nome, destino);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseCorpo(e) {
  var corpo = {};
  if (e && e.postData && e.postData.contents) {
    try { corpo = JSON.parse(e.postData.contents); } catch (err) { corpo = {}; }
  }
  // Apps Script não expõe IP real de forma confiável; tenta cabeçalhos comuns.
  if (e && e.parameter) {
    corpo._ip = e.parameter.__ip || e.parameter.ip || '';
  }
  return corpo;
}

function resposta(status, payload) {
  // ContentService só permite JSON/Text. Status real é 200; o status semântico
  // vai no corpo para o cliente tratar.
  var body = Object.assign({}, payload, { _status: status });
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function registrarLogSeguro(ipHash, origin, acao, cnpjMascarado, detalhe) {
  try {
    var ss = abrirPlanilha();
    registrarLog(ss, {
      ip_hash: ipHash,
      origin: origin || '',
      acao: acao,
      cnpj_mascarado: cnpjMascarado,
      detalhe: detalhe
    });
  } catch (e) { /* log nunca derruba o fluxo principal */ }
}
