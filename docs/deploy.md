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
   `Validacao.gs`, `Config.gs`, `Enquete.gs` em arquivos com os mesmos nomes.
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
clasp deploy -d "enquete da identidade visual"
```

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
   - Enquete em `https://rededeaterparana.github.io/enquete.html` e as propostas
     em `https://rededeaterparana.github.io/identidades/`

## 5b. Enquete da identidade visual

A enquete é HTML estático — não passa por bundler —, então os dois valores
públicos entram por substituição de placeholder no `pages.yml`:
`__API_URL__` e `__RECAPTCHA_SITE_KEY__` em `landing/enquete.html` recebem os
mesmos secrets `VITE_API_URL` e `VITE_RECAPTCHA_SITE_KEY` do passo 5.3.

Se algum dos dois estiver ausente, a página **sobe assim mesmo**, em modo
somente visualização: as propostas podem ser abertas, mas o botão de votar
avisa que o registro não está ativo. O workflow emite um `::warning::` nesse caso.

Do lado do Apps Script não há configuração nova: `Enquete.gs` reaproveita
`SHEET_ID`, `RECAPTCHA_SECRET`, `ALLOWED_ORIGIN` e `IP_HASH_SALT`. Na primeira
gravação a aba `enquete_votos` é criada sozinha, com as colunas
`criado_em, identidade, nome, email, email_norm, entidade, entidade_norm, origin, ip_hash`.

### Regras de contagem

- **Um voto por e-mail.** A unicidade é checada dentro do `LockService`, contra a
  coluna `email_norm` — não confie no rate limit por cache, ele é só a primeira barreira.
- `email_norm` é o e-mail em minúsculas, sem espaços e **sem o sufixo `+tag`** da
  parte local. Pontos não são removidos: fora do Gmail eles distinguem caixas diferentes.
- Voto repetido devolve `409` e a página trata como "você já votou" — o primeiro voto prevalece.
- A apuração pública (`?action=enquete_resultado`) devolve **só a contagem por proposta**.
  Nome, e-mail e entidade nunca saem da planilha.

### Apuração ponderada — um voto por entidade

O campo **entidade é obrigatório**: a decisão final pesa cada entidade uma vez,
independentemente de quantas pessoas dela votaram.

Rode a função `apurarPorEntidade()` pelo editor do Apps Script (*Executar* →
selecione a função → veja o *Registro de execução*). Ela:

1. agrupa os votos por `entidade_norm`;
2. em cada entidade, aplica **maioria simples**;
3. soma um voto por entidade decidida;
4. lista à parte as entidades com **empate interno** — que não pontuam e ficam
   para decisão humana.

Ela **não** é exposta pelo `doGet`, e isso é deliberado: publicar o voto
consolidado por entidade permitiria inferir como cada organização votou, coisa
que a contagem simples não revela.

> **Antes de bater o martelo:** `entidade_norm` só resolve diferenças de
> digitação — caixa, acentos, pontuação e espaços. Ele agrupa "IDR-Paraná",
> "IDR Parana" e "idr paraná", mas **não** agrupa "IDR-PR" com "Instituto de
> Desenvolvimento Rural". Passe os olhos na coluna `entidade` e junte as
> variações do mesmo nome antes de considerar o resultado final.

Para encerrar a enquete, remova o link da barra em `landing/*.html` e o card do
`index.html`; para congelar a apuração, basta parar de divulgar a URL — os votos
continuam válidos na planilha.

## 6. Verificações pós-deploy

- [ ] Abrir o formulário e cadastrar uma entidade fictícia (CNPJ válido de teste).
- [ ] Conferir linha em `entidades`, abas filhas e log em `_log`.
- [ ] Conferir pasta criada no Drive com anexos privados.
- [ ] Abrir o painel — entidade aparece após até 5 min (cache do `doGet`).
- [ ] `curl -X POST <VITE_API_URL>` (sem token CAPTCHA, origin errado) → resposta com erro 403.
- [ ] Enviar 6 cadastros do mesmo CNPJ em sequência → 6º rejeitado (rate limit).
- [ ] Tentar enviar `.exe` renomeado para `.pdf` → magic byte rejeita.
- [ ] Abrir `<VITE_API_URL>?action=listar` no navegador → JSON sem CPF/e-mail/URL.
- [ ] Abrir `/enquete.html`, abrir uma proposta, voltar pelo botão da faixa → a escolha continua marcada.
- [ ] Votar com um e-mail de teste → confirmação + apuração parcial.
- [ ] Votar de novo com o mesmo e-mail (outro navegador) → mensagem de "já votou", sem nova linha na planilha.
- [ ] Votar com `fulano+teste@dominio` depois de `fulano@dominio` → também barrado (normalização do `+tag`).
- [ ] Tentar votar sem preencher a entidade → bloqueado no formulário e no servidor.
- [ ] Votar duas vezes pela mesma entidade escrita diferente ("IDR-Paraná" e "IDR Parana", e-mails distintos)
      → rodar `apurarPorEntidade()`: as duas linhas contam como **uma** entidade.
- [ ] Abrir `<VITE_API_URL>?action=enquete_resultado` → só contagens, sem nome, e-mail nem entidade.

## Rotação / troca de conta dona

1. Na conta nova: criar planilha+pastas idênticas.
2. Atualizar Script Properties no Apps Script (sem trocar o código).
3. Re-implantar (mesma URL é reaproveitada se for "Gerenciar implantações → Editar").
4. Nenhuma alteração no GitHub é necessária.
