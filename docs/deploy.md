# Deploy

Ordem para colocar tudo no ar a partir de um repo zerado.

## 1. Conta Google institucional

Tudo (planilha, Drive, Apps Script) precisa ser dono de **uma conta Google
institucional** dedicada à rede (ex.: `redeater@<dominio-institucional>`). Não
use conta pessoal — quando a pessoa sair da instituição, todo o sistema cai junto.

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
   *(A partir do segundo deploy, prefira o `clasp` — veja 4b.)*
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

## 4b. Atualizar o Apps Script pelo `clasp`

Depois do projeto criado, o caminho de menor atrito para publicar alterações é o
[`clasp`](https://github.com/google/clasp), em vez de copiar e colar arquivo por arquivo.

```bash
npm install -g @google/clasp     # uma vez por máquina

# 1. Autentique-se na CONTA INSTITUCIONAL dona do projeto (passo 1).
#    Se você já estiver logado em outra conta, deslogue antes:
clasp logout
clasp login

# 2. Confirme que a conta enxerga o projeto certo:
clasp list                       # deve aparecer o projeto da Rede ATER

# 3. Aponte o repositório para ele (só na primeira vez):
cd apps-script
cp .clasp.example.json .clasp.json
#    substitua o scriptId — pegue em Configurações do projeto → ID do script,
#    ou na URL: script.google.com/d/<SCRIPT_ID>/edit
#    .clasp.json é gitignored, não vai para o repositório.

# 4. Envie e publique:
clasp push                       # sobe os .gs e o appsscript.json

# 5. Atualize a implantação QUE O SITE USA — não crie uma nova.
#    `clasp deployments` lista duas: a @HEAD e a versionada. A versionada é a
#    que está no VITE_API_URL; criar outra geraria uma URL nova e o site
#    continuaria na versão antiga.
clasp deployments                # veja qual ID bate com o VITE_API_URL
clasp deploy -i <DEPLOYMENT_ID> -d "descrição da mudança"
```

Se o `clasp push` falhar com **"User has not enabled the Apps Script API"**,
ative o interruptor em https://script.google.com/home/usersettings — logado na
conta dona do projeto. Atenção: essa página abre na conta ativa do navegador,
que pode não ser a mesma do `clasp`; use `?authuser=<email>` para garantir.
O `clasp` imprime "Pushed N files" mesmo quando o push falha, então confirme
com `clasp pull` num diretório separado.

> **`clasp push` sobrescreve os arquivos do projeto remoto.** Antes de rodar,
> confira com `clasp list` que você está na conta certa: enviar para o projeto
> errado apaga o código dele. Na dúvida, `clasp push --watch` não ajuda —
> use `clasp status` para ver o que seria enviado.

Um `clasp push` **não** troca a versão publicada sozinho: o Web App continua
servindo a última implantação até você rodar `clasp deploy` (ou publicar pelo
editor). Isso é útil — dá para subir o código e testar antes de virar a chave.

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

## 5c. Se o deploy do Pages ficar preso

Sintoma: o job `build` passa, o `deploy` fica em `queued` ou
`deployment_in_progress` por minutos e termina em `failure` ou `cancelled`,
sem mensagem útil. O site continua servindo a versão anterior.

O que **não** é a causa (já investigado): conteúdo do artefato, política de
branch do environment, execuções concorrentes, incidentes abertos no GitHub.

O que resolveu: **fixar `actions/deploy-pages@v4`**. Com a `v5`, o deployment
era aceito e nunca concluía; ao estourar o limite interno de ~10 min a própria
action **cancelava** o deployment. O input `timeout` da v5 é aceito mas
ignorado — passar 25 min não muda nada.

Mesmo com a v4 o serviço se mostrou instável em rajadas. Se acontecer:

- Dispare **um** deploy e não mexa. Rodar `workflow_dispatch` repetido no mesmo
  SHA cria deployments concorrentes que se cancelam.
- Se precisar forçar, faça um **commit novo** — um SHA inédito costuma passar
  quando o mesmo SHA já falhou.
- Confira o artefato antes de suspeitar do conteúdo:
  `gh run download <run-id> -n github-pages` e inspecione o `artifact.tar`.

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
