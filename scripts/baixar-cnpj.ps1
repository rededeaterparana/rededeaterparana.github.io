<#
.SYNOPSIS
  Baixa os arquivos dos Dados Abertos do CNPJ (Receita Federal) necessários para a
  análise de empresas de ATER no Paraná, via proxy local (px) e o endpoint WebDAV
  público do repositório SERPRO+ (o único que passa pelo WAF da rede: GET por
  caminho, sem query string). Só os arquivos usados pelo ETL (não baixa Socios*).

.EXAMPLE
  powershell -File scripts/baixar-cnpj.ps1 -Mes 2026-07

.NOTES
  Requer o px na 3128. O token do share público da Receita é fixo (abaixo).
  Descoberto que o WAF rejeita PROPFIND e GET com ?path=...; apenas o GET direto
  em /public.php/webdav/<mes>/<arquivo> com Basic auth (token:"") funciona.
#>
param(
  [Parameter(Mandatory = $true)][string]$Mes,          # ex: 2026-07
  [string]$Destino = "dados-cnpj",
  [string]$Proxy = "http://127.0.0.1:3128"
)

$ErrorActionPreference = "Stop"
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
$token = "YggdBLfdninEJX9"   # share público "CNPJ" do repositório SERPRO+
$davBase = "https://arquivos.receitafederal.gov.br/public.php/webdav/$Mes"

# Arquivos usados pelo ETL (Socios* propositalmente fora — é PII).
$Arquivos = @("Cnaes.zip", "Municipios.zip") +
  (0..9 | ForEach-Object { "Empresas$_.zip" }) +
  (0..9 | ForEach-Object { "Estabelecimentos$_.zip" })

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem

$falhas = @()
foreach ($f in $Arquivos) {
  $url = "$davBase/$f"
  $out = Join-Path $Destino $f
  Write-Host "baixando $f ..."
  # -C - retoma; --retry re-tenta a intermitência do proxy; -f falha em HTTP>=400
  curl.exe -f -L -C - --retry 15 --retry-delay 5 --retry-all-errors --retry-connrefused `
    -x $Proxy -A $ua -u "${token}:" -o $out $url
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "  falha em $f (curl exit $LASTEXITCODE) — reexecute para retomar."
    $falhas += $f
    continue
  }
  $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
  # valida integridade do zip
  try {
    $z = [System.IO.Compression.ZipFile]::OpenRead($out); $n = $z.Entries.Count; $z.Dispose()
    Write-Host "  ok $f ($mb MB, $n entradas)"
  } catch {
    Write-Warning "  $f ($mb MB) baixou mas NAO abre como zip — provavel corrompido, reexecute."
    $falhas += $f
  }
}

if ($falhas.Count) {
  Write-Warning "arquivos com falha: $($falhas -join ', '). Reexecute o script (retoma de onde parou)."
  exit 1
}
Write-Host "`nconcluido. Rode: python scripts/scrape-cnpj-ater.py --fonte $Destino --saida $Destino"
