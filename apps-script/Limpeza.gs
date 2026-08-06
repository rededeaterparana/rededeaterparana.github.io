/**
 * LIMPEZA ÚNICA — remove as entidades de teste de TODAS as abas + pastas/arquivos
 * no Drive. Vai para a LIXEIRA (reversível). Rode uma vez e depois apague este arquivo.
 */
function limparEntidadesTeste() {
  var TESTE = [
    '11222333000181','11444777000161','11555888000145',
    '11666999000129','11888000000196','11999111000170','11222333000343'
  ];
  var ss = abrirPlanilha();
  var resumo = { linhas: {}, arquivos_drive: 0, pastas_drive: 0 };

  // 1) Drive: arquivos listados na aba `anexos` + a pasta por CNPJ.
  var raiz = DriveApp.getFolderById(cfg('DRIVE_FOLDER_ID'));
  var anexosAba = ss.getSheetByName('anexos');
  var anexosDados = anexosAba ? anexosAba.getDataRange().getValues() : [];
  var cCnpjAnx = SCHEMA.anexos.indexOf('cnpj');
  var cIdAnx = SCHEMA.anexos.indexOf('drive_file_id');

  TESTE.forEach(function (cnpj) {
    for (var i = 1; i < anexosDados.length; i++) {
      if (String(anexosDados[i][cCnpjAnx]) === cnpj && anexosDados[i][cIdAnx]) {
        try { DriveApp.getFileById(String(anexosDados[i][cIdAnx])).setTrashed(true); resumo.arquivos_drive++; } catch (e) {}
      }
    }
    var it = raiz.getFolders();
    while (it.hasNext()) {
      var f = it.next();
      if (f.getName().indexOf(cnpj) === 0) { try { f.setTrashed(true); resumo.pastas_drive++; } catch (e) {} }
    }
  });

  // 2) Planilha: remove linhas em todas as abas com coluna `cnpj`.
  ['entidades','telefones','area_atuacao','equipe','imoveis',
   'veiculos','eq_informatica','eq_rede','eq_extensionista','anexos'].forEach(function (nome) {
    var aba = ss.getSheetByName(nome);
    if (!aba) return;
    var dados = aba.getDataRange().getValues();
    var c = SCHEMA[nome].indexOf('cnpj');
    var n = 0;
    for (var i = dados.length - 1; i >= 1; i--) {
      if (TESTE.indexOf(String(dados[i][c])) >= 0) { aba.deleteRow(i + 1); n++; }
    }
    resumo.linhas[nome] = n;
  });

  Logger.log('Limpeza: ' + JSON.stringify(resumo));
  return resumo;
}
