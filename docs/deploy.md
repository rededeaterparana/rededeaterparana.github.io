# Deploy

Ordem para colocar tudo no ar a partir de um repo zerado.

## 1. Conta Google institucional

Tudo (planilha, Drive, Apps Script) precisa ser dono de **uma conta Google
institucional** (ex.: `redeater@idrparana.pr.gov.br`). Não use conta pessoal —
quando a pessoa sair do IDR-Paraná, todo o sistema cai junto.

## 2. Criar planilha e pastas no Drive

Na conta institucional:

1. Crie uma planilha "Rede ATER — Cadastros" — anote o **SHEET_ID** da URL.
2. Crie uma pasta "Rede ATER — Anexos" — anote o **DRIVE_FOLDER_ID**.
3. Crie uma pasta "Rede ATER — Backups" — anote o **BACKUP_FOLDER_ID**.
4. Em ambas as pastas e na planilha: *Compartilhar → Restrito* (NÃO "Qualquer pessoa com o link").

## 3. reCAPTCHA v3

1. Acesse https://www.google.com/recaptcha/admin/create.
2. Tipo: reCAPTCHA v3.
3. Domínios: `rededeaterparana.github.io` e `localhost` (para dev).
4. Anote a **site key** (pública, vai pro frontend) e a **secret key** (vai pro Apps Script).

## 4. Apps Script

1. Em https://script.google.com → Novo projeto.
2. Cole o conteúdo de `apps-script/Code.gs`, `Sheets.gs`, `Drive.gs`,
   `Validacao.gs`, `Config.gs` em arquivos com os mesmos nomes.
3. Substitua `appsscript.json` pelo do repo (menu *Configurações do projeto* →
   "Mostrar arquivo de manifesto appsscript.json no editor").
4. *Configurações do projeto → Propriedades do script* — adicione:
   - `SHEET_ID`
   - `DRIVE_FOLDER_ID`
   - `BACKUP_FOLDER_ID`
   - `RECAPTCHA_SECRET`
   - `ALLOWED_ORIGIN` = `https://rededeaterparana.github.io`
   - `IP_HASH_SALT` = string aleatória de 32+ chars
5. *Implantar → Nova implantação → Tipo: aplicativo da Web*.
   - Executar como: **Eu**.
   - Quem pode acessar: **Qualquer pessoa**.
   - Anote a **URL** (`/exec`).
6. *Acionadores → Adicionar acionador* → função `backupSemanal`, semanalmente.

## 5. GitHub

1. Crie o repo (público) e suba o código.
2. *Settings → Pages → Source: GitHub Actions*.
3. *Settings → Secrets and variables → Actions → New repository secret*:
   - `VITE_API_URL` = URL `/exec` do passo 4.5.
   - `VITE_RECAPTCHA_SITE_KEY` = site key do passo 3.
4. *Settings → Branches → Branch protection rule* em `main`: exigir PR, exigir
   status checks (audit), proibir force-push.
5. *Settings → Code security → Dependabot alerts* + *Dependabot security
   updates*: ativar.
6. Push em `main` dispara o workflow `pages.yml` que publica:
   - `https://rededeaterparana.github.io/form/`
   - `https://rededeaterparana.github.io/painel/`
   - Página índice em `https://rededeaterparana.github.io/`

## 6. Verificações pós-deploy

- [ ] Abrir o formulário e cadastrar uma entidade fictícia (CNPJ válido de teste).
- [ ] Conferir linha em `entidades`, abas filhas e log em `_log`.
- [ ] Conferir pasta criada no Drive com anexos privados.
- [ ] Abrir o painel — entidade aparece após até 5 min (cache do `doGet`).
- [ ] `curl -X POST <VITE_API_URL>` (sem token CAPTCHA, origin errado) → resposta com erro 403.
- [ ] Enviar 6 cadastros do mesmo CNPJ em sequência → 6º rejeitado (rate limit).
- [ ] Tentar enviar `.exe` renomeado para `.pdf` → magic byte rejeita.
- [ ] Abrir `<VITE_API_URL>?action=listar` no navegador → JSON sem CPF/e-mail/URL.

## Rotação / troca de conta dona

1. Na conta nova: criar planilha+pastas idênticas.
2. Atualizar Script Properties no Apps Script (sem trocar o código).
3. Re-implantar (mesma URL é reaproveitada se for "Gerenciar implantações → Editar").
4. Nenhuma alteração no GitHub é necessária.
