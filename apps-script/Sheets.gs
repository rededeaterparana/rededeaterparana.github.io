/**
 * Acesso à planilha (banco). Cada aba tem um cabeçalho fixo definido em SCHEMA.
 * Operações idempotentes: upsert por CNPJ na aba `entidades`,
 * replace-all nas abas filhas para o mesmo CNPJ.
 */

var SCHEMA = {
  entidades: [
    'cnpj','razao_social','nome_fantasia','inscricao_estadual','data_constituicao',
    'logradouro','numero','complemento','bairro','cep','municipio','uf',
    'tipo_endereco','email','site',
    'responsavel_nome','responsavel_cpf','responsavel_telefone',
    'contato2_nome','contato2_cpf',
    'tipo_entidade','protocolo','criado_em','atualizado_em','status'
  ],
  telefones:        ['cnpj','tipo','codigo','ddd','numero','ramal'],
  area_atuacao:     ['cnpj','codigo_ibge','municipio','uf'],
  equipe:           ['cnpj','nome','cpf','formacao','registro_profissional','vinculo'],
  imoveis:          ['cnpj','tipo','condicao_uso','codigo_ibge','municipio','uf'],
  veiculos:         ['cnpj','tipo','ano','quantidade'],
  eq_informatica:   ['cnpj','tipo','ano','quantidade'],
  eq_rede:          ['cnpj','tipo','ano','quantidade'],
  eq_extensionista: ['cnpj','tipo','ano','quantidade'],
  anexos:           ['cnpj','tipo_documento','nome_arquivo','drive_file_id','tamanho_bytes','criado_em'],
  _log:             ['timestamp','ip_hash','origin','acao','cnpj_mascarado','detalhe']
};

function abrirPlanilha() {
  return SpreadsheetApp.openById(cfg('SHEET_ID'));
}

function abaPorNome(ss, nome) {
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.appendRow(SCHEMA[nome]);
    aba.setFrozenRows(1);
  } else if (aba.getLastRow() === 0) {
    aba.appendRow(SCHEMA[nome]);
    aba.setFrozenRows(1);
  }
  return aba;
}

function montarLinha(nomeAba, registro) {
  var cols = SCHEMA[nomeAba];
  return cols.map(function (c) { return registro[c] === undefined ? '' : registro[c]; });
}

function upsertEntidade(ss, registro) {
  var aba = abaPorNome(ss, 'entidades');
  var dados = aba.getDataRange().getValues();
  var cnpjCol = SCHEMA.entidades.indexOf('cnpj');
  var linhaExistente = -1;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][cnpjCol]) === String(registro.cnpj)) { linhaExistente = i + 1; break; }
  }
  if (linhaExistente > 0) {
    registro.atualizado_em = new Date();
    aba.getRange(linhaExistente, 1, 1, SCHEMA.entidades.length)
       .setValues([montarLinha('entidades', registro)]);
    return { criado: false };
  } else {
    registro.criado_em = new Date();
    registro.atualizado_em = registro.criado_em;
    aba.appendRow(montarLinha('entidades', registro));
    return { criado: true };
  }
}

function replaceFilhas(ss, nomeAba, cnpj, registros) {
  var aba = abaPorNome(ss, nomeAba);
  var dados = aba.getDataRange().getValues();
  var cnpjCol = SCHEMA[nomeAba].indexOf('cnpj');

  // Apaga linhas existentes do CNPJ (de baixo p/ cima p/ não bagunçar índices).
  for (var i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][cnpjCol]) === String(cnpj)) aba.deleteRow(i + 1);
  }
  if (!registros || !registros.length) return;
  var linhas = registros.map(function (r) {
    r.cnpj = cnpj;
    return montarLinha(nomeAba, r);
  });
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, SCHEMA[nomeAba].length)
     .setValues(linhas);
}

function registrarLog(ss, registro) {
  var aba = abaPorNome(ss, '_log');
  aba.appendRow(montarLinha('_log', {
    timestamp: new Date(),
    ip_hash: registro.ip_hash || '',
    origin: registro.origin || '',
    acao: registro.acao || '',
    cnpj_mascarado: registro.cnpj_mascarado || '',
    detalhe: registro.detalhe || ''
  }));
}

function mascararCNPJ(cnpj) {
  var s = String(cnpj || '').replace(/\D/g, '');
  if (s.length !== 14) return '***';
  return s.substring(0, 2) + '.***.***/****-' + s.substring(12);
}

/**
 * Lê tudo e devolve apenas o subset PÚBLICO para o painel.
 * Nada de CPF, e-mail individual, telefone, endereço completo, URL de anexo.
 */
function lerAgregadoPublico() {
  var ss = abrirPlanilha();
  var entidades = abaPorNome(ss, 'entidades').getDataRange().getValues();
  var areas = abaPorNome(ss, 'area_atuacao').getDataRange().getValues();
  var equipe = abaPorNome(ss, 'equipe').getDataRange().getValues();
  var veiculos = abaPorNome(ss, 'veiculos').getDataRange().getValues();
  var eqInfo = abaPorNome(ss, 'eq_informatica').getDataRange().getValues();
  var eqRede = abaPorNome(ss, 'eq_rede').getDataRange().getValues();
  var eqExt = abaPorNome(ss, 'eq_extensionista').getDataRange().getValues();
  var imoveis = abaPorNome(ss, 'imoveis').getDataRange().getValues();

  var headersEnt = SCHEMA.entidades;
  var idx = function (h, col) { return h.indexOf(col); };

  var resultado = [];
  for (var i = 1; i < entidades.length; i++) {
    var row = entidades[i];
    if (!row[idx(headersEnt, 'cnpj')]) continue;
    if (row[idx(headersEnt, 'status')] && row[idx(headersEnt, 'status')] === 'rejeitado') continue;
    var cnpj = String(row[idx(headersEnt, 'cnpj')]);
    resultado.push({
      cnpj_mascarado: mascararCNPJ(cnpj),
      razao_social: row[idx(headersEnt, 'razao_social')],
      nome_fantasia: row[idx(headersEnt, 'nome_fantasia')],
      municipio: row[idx(headersEnt, 'municipio')],
      uf: row[idx(headersEnt, 'uf')],
      tipo_entidade: row[idx(headersEnt, 'tipo_entidade')],
      criado_em: row[idx(headersEnt, 'criado_em')],
      area_atuacao: contarPorCNPJ(areas, SCHEMA.area_atuacao, cnpj),
      equipe_total: contarPorCNPJ(equipe, SCHEMA.equipe, cnpj),
      veiculos_total: somarQuantidade(veiculos, SCHEMA.veiculos, cnpj),
      eq_informatica_total: somarQuantidade(eqInfo, SCHEMA.eq_informatica, cnpj),
      eq_rede_total: somarQuantidade(eqRede, SCHEMA.eq_rede, cnpj),
      eq_extensionista_total: somarQuantidade(eqExt, SCHEMA.eq_extensionista, cnpj),
      imoveis_total: contarPorCNPJ(imoveis, SCHEMA.imoveis, cnpj)
    });
  }
  return { entidades: resultado, total: resultado.length, gerado_em: new Date() };
}

function contarPorCNPJ(dados, schema, cnpj) {
  var c = 0;
  var col = schema.indexOf('cnpj');
  for (var i = 1; i < dados.length; i++) if (String(dados[i][col]) === cnpj) c++;
  return c;
}

function somarQuantidade(dados, schema, cnpj) {
  var col = schema.indexOf('cnpj');
  var colQ = schema.indexOf('quantidade');
  var s = 0;
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][col]) === cnpj) s += Number(dados[i][colQ]) || 0;
  }
  return s;
}
