# Mapeamento de campos → planilha

Fonte: `Cadastro De Entidades Prestadoras de Serviços de ATER - Ater -01.doc`
(não versionado). Esta tabela é a fonte da verdade para qualquer alteração de
esquema. Ao adicionar/remover colunas, atualizar em três lugares:

1. `apps-script/Sheets.gs` — constante `SCHEMA`.
2. `form/src/schema/entidade.ts` — schema Zod.
3. Este arquivo.

## Aba `entidades` (1 linha por CNPJ)

| Coluna | Fonte (doc) | Tipo | Obrigatório | Exposto no painel |
|---|---|---|---|---|
| cnpj | 1.1 | string 14 dígitos | sim | mascarado |
| razao_social | 1.3 | string | sim | sim |
| nome_fantasia | 1.4 | string | sim | sim |
| inscricao_estadual | 1.2 | string | não (default ISENTA) | não |
| data_constituicao | 1.5 | date AAAA-MM-DD | sim | não |
| logradouro | 1.6 | string | sim | não |
| numero | 1.7 | string | sim | não |
| complemento | — | string | não | não |
| bairro | 1.8 | string | sim | não |
| cep | 1.9 | string 8 dígitos | sim | não |
| municipio | 1.10 | string | sim | sim |
| uf | 1.11 | enum UFs | sim | sim |
| tipo_endereco | 1.14 | enum | não | não |
| email | 1.12 | e-mail | sim | não |
| site | 1.13 | url | não | não |
| responsavel_nome | (Telefone Responsável) | string | sim | não |
| responsavel_cpf | (Telefone Responsável) | CPF 11 dígitos | sim | **NUNCA** |
| responsavel_telefone | 1.15 | string | não | não |
| contato2_nome | Outro contato | string | não | não |
| contato2_cpf | Outro contato | CPF | não | **NUNCA** |
| tipo_entidade | (categorização) | enum | sim | sim |
| protocolo | gerado | string | sim | não |
| criado_em | gerado | datetime | sim | sim (data) |
| atualizado_em | gerado | datetime | sim | não |
| status | fluxo | enum (pendente_revisao/aprovado/rejeitado) | sim | filtra |

## Abas filhas (N linhas por CNPJ)

- **telefones**: cnpj, tipo (Fixo/Celular/Fax), codigo, ddd, numero, ramal — todos PII, **não expostos**.
- **area_atuacao** (2.1): cnpj, codigo_ibge, municipio, uf — agregado (contagem) exposto.
- **equipe** (2.2): cnpj, nome, cpf, formacao, registro_profissional, vinculo — **CPFs nunca expostos**, só contagem.
- **imoveis** (2.4.1): cnpj, tipo, condicao_uso, codigo_ibge, municipio, uf — contagem exposta.
- **veiculos** (2.4.2): cnpj, tipo, ano, quantidade — soma exposta.
- **eq_informatica** (2.4.3): cnpj, tipo, ano, quantidade — soma exposta.
- **eq_rede** (2.4.4): cnpj, tipo, ano, quantidade — soma exposta.
- **eq_extensionista** (2.4.5): cnpj, tipo, ano, quantidade — soma exposta.
- **anexos**: cnpj, tipo_documento, nome_arquivo, drive_file_id, tamanho_bytes, criado_em — **drive_file_id nunca exposto**.
- **_log**: timestamp, ip_hash, origin, acao, cnpj_mascarado, detalhe — interno.

## Anexos exigidos

Lista alinhada com o Manual de Credenciamento da ANATER (consultar PDF antes do
deploy definitivo — pode haver atualização):

| Chave | Documento | Obrigatório |
|---|---|---|
| cnpj | Comprovante de inscrição no CNPJ | sim |
| estatuto | Estatuto ou contrato social | sim |
| ata_eleicao | Ata da última eleição/posse da diretoria | sim |
| comprovante_endereco | Comprovante de endereço da sede | sim |
| equipe_tecnica | CPF e registro profissional dos técnicos | sim |
| relacao_associados | Relação de associados | só p/ cooperativas/associações |
