/**
 * Configuração — lê todos os segredos do PropertiesService.
 * NÃO coloque IDs ou chaves neste arquivo: ele é versionado.
 *
 * Definir em: Project Settings → Script Properties
 *   SHEET_ID            ID da planilha (banco)
 *   DRIVE_FOLDER_ID     Pasta-raiz dos anexos
 *   BACKUP_FOLDER_ID    Pasta de backups semanais
 *   RECAPTCHA_SECRET    Chave secreta do reCAPTCHA v3
 *   ALLOWED_ORIGIN      Ex: https://rededeaterparana.github.io
 *   IP_HASH_SALT        Sal aleatório p/ hashear IPs no log de auditoria
 *   ADMIN_NOTIFY_EMAIL  (opcional) E-mail institucional p/ alertas
 */

function cfg(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Configuração ausente: ' + key);
  return v;
}

function cfgOpt(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || null;
}

// Limites — podem virar Script Properties se precisar ajustar sem deploy.
var LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024,        // 5 MB por anexo
  MAX_TOTAL_BYTES: 25 * 1024 * 1024,      // 25 MB no envio inteiro
  RATE_PER_CNPJ_SECONDS: 600,             // 1 envio por CNPJ a cada 10 min
  RATE_PER_IP_HOURLY: 5,                  // 5 envios por IP por hora
  RECAPTCHA_MIN_SCORE: 0.5,
  ALLOWED_MIME: ['application/pdf', 'image/jpeg', 'image/png'],
  CACHE_GET_SECONDS: 300
};
