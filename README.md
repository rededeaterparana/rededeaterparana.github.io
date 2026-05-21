# Rede Paranaense de Assistência Técnica e Extensão Rural

Cadastro público das entidades prestadoras de Assistência Técnica e Extensão
Rural (ATER) que aderirem à rede, com painel de visualização agregada.

## Componentes

| Diretório | O que é | Onde roda |
|---|---|---|
| `form/` | SPA pública do formulário de adesão (Vite + React + TS + Zod) | GitHub Pages |
| `painel/` | Painel de visualização (Vite + React + TS + Recharts) | GitHub Pages |
| `apps-script/` | Backend Google Apps Script (doPost grava em Sheets/Drive, doGet retorna agregado) | script.google.com |

Banco de dados: Google Sheets privada. Anexos: pasta privada no Google Drive.
Tudo acessado pelo Apps Script (deploy "Execute as: me, anyone has access").

## Por que esta arquitetura

- **Sem servidor pago, sem container**: GitHub Pages + Apps Script + Sheets cobrem
  o volume esperado (centenas de entidades).
- **Continuidade com a stack atual**: o levantamento de capacidade já usa Google
  Forms + Sheets + Power BI; mantém familiaridade da Assessoria de Planejamento.
- **Auditável**: código todo público; o que é sensível (IDs de planilha, chaves de
  CAPTCHA) vive no `PropertiesService` do Apps Script, fora do Git.

## Segurança (resumo — detalhes em `docs/deploy.md`)

- Planilha e pasta do Drive **restritas** (não compartilhadas por link).
- IDs (`SHEET_ID`, `DRIVE_FOLDER_ID`, `RECAPTCHA_SECRET`, `ALLOWED_ORIGIN`)
  ficam no Script Properties, lidos via `cfg()` em `apps-script/Config.gs`.
- `doPost` valida reCAPTCHA v3 + Origin + rate limit por IP/CNPJ + MIME magic bytes.
- `doGet` retorna apenas campos não-pessoais (sem CPF, sem e-mail individual).
- LGPD: aviso e consentimento explícito no formulário.

## Desenvolvimento local

```bash
# Formulário
cd form && npm install && npm run dev

# Painel
cd painel && npm install && npm run dev
```

Variáveis necessárias (copie `.env.example` para `.env.local`):
- `VITE_API_URL` — URL pública do Web App do Apps Script
- `VITE_RECAPTCHA_SITE_KEY` — site key (pública) do reCAPTCHA v3
