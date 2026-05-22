import { useState } from 'react';
import { useForm, FormProvider, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { entidadeSchema, Entidade, valoresPadrao } from './schema/entidade';
import { Field } from './components/Field';
import { ListaRepetivel } from './components/ListaRepetivel';
import { UploadAnexos, TipoDocumento } from './components/UploadAnexos';
import { formatarCNPJ, limparCNPJ } from './lib/cnpj';
import { buscarCEP, formatarCEP } from './lib/cep';
import { enviarCadastro, AnexoPayload, RespostaCadastro } from './lib/api';

const TIPOS_ANEXO: TipoDocumento[] = [
  { chave: 'cnpj', rotulo: 'Comprovante de inscrição no CNPJ', obrigatorio: true },
  { chave: 'estatuto', rotulo: 'Estatuto ou contrato social', obrigatorio: true },
  { chave: 'ata_eleicao', rotulo: 'Ata da última eleição/posse da diretoria', obrigatorio: true },
  { chave: 'comprovante_endereco', rotulo: 'Comprovante de endereço da sede', obrigatorio: true },
  { chave: 'equipe_tecnica', rotulo: 'Documentos da equipe técnica (CPF / registro profissional)', obrigatorio: true },
  { chave: 'relacao_associados', rotulo: 'Relação de associados (quando aplicável)', obrigatorio: false }
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export function App() {
  const metodos = useForm<Entidade>({
    resolver: zodResolver(entidadeSchema),
    defaultValues: valoresPadrao as Entidade,
    mode: 'onBlur'
  });
  const [anexos, setAnexos] = useState<AnexoPayload[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<RespostaCadastro | null>(null);

  async function aoEnviar(dados: Entidade) {
    const obrigatorios = TIPOS_ANEXO.filter((t) => t.obrigatorio).map((t) => t.chave);
    const entreguesObrigatorios = obrigatorios.every(
      (k) => anexos.some((a) => a.tipo_documento === k)
    );
    if (!entreguesObrigatorios) {
      setResultado({ ok: false, erro: 'envie todos os documentos obrigatórios' });
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const r = await enviarCadastro({
        ...dados,
        cnpj: limparCNPJ(dados.cnpj),
        cep: dados.cep.replace(/\D/g, '')
      }, anexos);
      setResultado(r);
      if (r.ok) metodos.reset(valoresPadrao as Entidade);
    } catch (e) {
      setResultado({ ok: false, erro: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <FormProvider {...metodos}>
      <div className="container">
        <header className="cabecalho">
          <h1>Cadastro de Entidades</h1>
          <p>Adesão à Rede Paranaense de Assistência Técnica e Extensão Rural.</p>
        </header>

        <AvisoLGPD />

        {resultado?.ok && (
          <div className="resultado-ok">
            <strong>Cadastro recebido!</strong>
            <div>Protocolo: <code>{resultado.protocolo}</code></div>
            <div>{resultado.mensagem}</div>
          </div>
        )}
        {resultado && !resultado.ok && (
          <div className="resultado-erro">
            <strong>Não foi possível enviar.</strong>
            <div>{resultado.erro}</div>
            {resultado.campos && <div>Campos: {resultado.campos.join(', ')}</div>}
          </div>
        )}

        <form onSubmit={metodos.handleSubmit(aoEnviar)} noValidate>
          {/* Honeypot — usuários reais não veem este campo */}
          <input
            type="text" tabIndex={-1} autoComplete="off"
            className="honeypot"
            {...metodos.register('website_url')}
          />

          <PessoaJuridica />
          <Endereco />
          <Contatos />
          <Telefones />
          <AreaAtuacao />
          <EquipeTecnica />
          <Infraestrutura />

          <section className="cartao">
            <h2>Documentos (anexos)</h2>
            <UploadAnexos tipos={TIPOS_ANEXO} onChange={setAnexos} />
          </section>

          <div className="barra-acoes">
            <button type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar cadastro'}
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}

function AvisoLGPD() {
  const { register, formState: { errors } } = useFormContext<Entidade>();
  return (
    <div className="aviso-lgpd">
      <strong>Aviso de privacidade (LGPD)</strong>
      <p style={{ margin: '8px 0' }}>
        Os dados informados serão utilizados exclusivamente para a gestão da
        Rede Paranaense de Assistência Técnica e Extensão Rural, no âmbito da
        Política Estadual de ATER (Lei Estadual nº 14.447/2012) e da Política
        Nacional de ATER (Lei nº 12.188/2010), em conformidade com a LGPD (Lei
        nº 13.709/2018). CPFs e e-mails individuais não são exibidos no painel
        público. Para exercer direitos de acesso, correção ou eliminação, contate
        a coordenação da rede pelo canal institucional informado no momento do cadastro.
      </p>
      <label>
        <input type="checkbox" {...register('consentimento_lgpd')} />
        <span>Li, compreendi e concordo com o tratamento dos dados informados.</span>
      </label>
      {errors.consentimento_lgpd && <div className="erro-msg">{errors.consentimento_lgpd.message as string}</div>}
    </div>
  );
}

function PessoaJuridica() {
  const { register, setValue, formState: { errors } } = useFormContext<Entidade>();
  return (
    <section className="cartao">
      <h2>1. Pessoa Jurídica</h2>
      <div className="grid">
        <Field label="CNPJ" obrigatorio erro={errors.cnpj?.message}>
          <input
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            {...register('cnpj', {
              onChange: (e) => setValue('cnpj', formatarCNPJ(e.target.value))
            })}
          />
        </Field>
        <Field label="Inscrição Estadual" erro={errors.inscricao_estadual?.message}>
          <input {...register('inscricao_estadual')} />
        </Field>
        <Field label="Tipo de entidade" obrigatorio erro={errors.tipo_entidade?.message}>
          <select {...register('tipo_entidade')}>
            <option value="">Selecione...</option>
            {['Pública estadual','Pública municipal','Pública federal','Cooperativa','Associação','Sindicato','ONG','Empresa privada','Outra']
              .map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Data de constituição" obrigatorio erro={errors.data_constituicao?.message}>
          <input type="date" {...register('data_constituicao')} />
        </Field>
        <Field label="Razão social" obrigatorio erro={errors.razao_social?.message}>
          <input {...register('razao_social')} />
        </Field>
        <Field label="Nome fantasia" obrigatorio erro={errors.nome_fantasia?.message}>
          <input {...register('nome_fantasia')} />
        </Field>
      </div>
    </section>
  );
}

function Endereco() {
  const { register, setValue, formState: { errors } } = useFormContext<Entidade>();
  const cep = useWatch<Entidade, 'cep'>({ name: 'cep' });

  async function aoTrocarCEP(v: string) {
    const fmt = formatarCEP(v);
    setValue('cep', fmt);
    const limpo = fmt.replace(/\D/g, '');
    if (limpo.length === 8) {
      const e = await buscarCEP(limpo);
      if (e) {
        setValue('logradouro', e.logradouro);
        setValue('bairro', e.bairro);
        setValue('municipio', e.municipio);
        setValue('uf', e.uf);
      }
    }
  }

  return (
    <section className="cartao">
      <h2>2. Endereço</h2>
      <div className="grid">
        <Field label="CEP" obrigatorio erro={errors.cep?.message}>
          <input
            inputMode="numeric"
            placeholder="00000-000"
            value={cep || ''}
            onChange={(e) => aoTrocarCEP(e.target.value)}
          />
        </Field>
        <Field label="Logradouro" obrigatorio erro={errors.logradouro?.message}>
          <input {...register('logradouro')} />
        </Field>
        <Field label="Número" obrigatorio erro={errors.numero?.message}>
          <input {...register('numero')} />
        </Field>
        <Field label="Complemento" erro={errors.complemento?.message}>
          <input {...register('complemento')} />
        </Field>
        <Field label="Bairro" obrigatorio erro={errors.bairro?.message}>
          <input {...register('bairro')} />
        </Field>
        <Field label="Município" obrigatorio erro={errors.municipio?.message}>
          <input {...register('municipio')} />
        </Field>
        <Field label="UF" obrigatorio erro={errors.uf?.message}>
          <select {...register('uf')}>
            <option value="">--</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Tipo de endereço" erro={errors.tipo_endereco?.message}>
          <select {...register('tipo_endereco')}>
            <option value="Comercial">Comercial</option>
            <option value="Particular">Particular</option>
          </select>
        </Field>
      </div>
    </section>
  );
}

function Contatos() {
  const { register, formState: { errors } } = useFormContext<Entidade>();
  return (
    <section className="cartao">
      <h2>3. Contatos</h2>
      <div className="grid">
        <Field label="E-mail institucional" obrigatorio erro={errors.email?.message}>
          <input type="email" {...register('email')} />
        </Field>
        <Field label="Site" erro={errors.site?.message}>
          <input {...register('site')} placeholder="https://..." />
        </Field>
        <Field label="Responsável — nome" obrigatorio erro={errors.responsavel_nome?.message}>
          <input {...register('responsavel_nome')} />
        </Field>
        <Field label="Responsável — CPF" obrigatorio erro={errors.responsavel_cpf?.message}>
          <input {...register('responsavel_cpf')} />
        </Field>
        <Field label="Responsável — telefone" erro={errors.responsavel_telefone?.message}>
          <input {...register('responsavel_telefone')} />
        </Field>
        <Field label="Contato secundário — nome" erro={errors.contato2_nome?.message}>
          <input {...register('contato2_nome')} />
        </Field>
        <Field label="Contato secundário — CPF" erro={errors.contato2_cpf?.message}>
          <input {...register('contato2_cpf')} />
        </Field>
      </div>
    </section>
  );
}

function Telefones() {
  const { control, register, formState: { errors } } = useFormContext<Entidade>();
  return (
    <section className="cartao">
      <h2>4. Telefones</h2>
      <ListaRepetivel
        control={control} name="telefones"
        titulo="Telefones"
        textoAdicionar="+ Adicionar telefone"
        itemPadrao={{ tipo: 'Fixo', codigo: '', ddd: '', numero: '', ramal: '' }}
        renderItem={(i) => (
          <div className="grid">
            <Field label="Tipo" erro={errors.telefones?.[i]?.tipo?.message}>
              <select {...register(`telefones.${i}.tipo` as const)}>
                <option>Fixo</option><option>Celular</option><option>Fax</option>
              </select>
            </Field>
            <Field label="DDD" erro={errors.telefones?.[i]?.ddd?.message}>
              <input inputMode="numeric" maxLength={2} {...register(`telefones.${i}.ddd` as const)} />
            </Field>
            <Field label="Número" erro={errors.telefones?.[i]?.numero?.message}>
              <input inputMode="numeric" {...register(`telefones.${i}.numero` as const)} />
            </Field>
            <Field label="Ramal" erro={errors.telefones?.[i]?.ramal?.message}>
              <input {...register(`telefones.${i}.ramal` as const)} />
            </Field>
          </div>
        )}
      />
    </section>
  );
}

function AreaAtuacao() {
  const { control, register, formState: { errors } } = useFormContext<Entidade>();
  return (
    <section className="cartao">
      <h2>5. Área geográfica de atuação</h2>
      <ListaRepetivel
        control={control} name="area_atuacao"
        titulo="Municípios atendidos"
        textoAdicionar="+ Adicionar município"
        itemPadrao={{ codigo_ibge: '', municipio: '', uf: 'PR' }}
        renderItem={(i) => (
          <div className="grid">
            <Field label="Código IBGE" obrigatorio erro={errors.area_atuacao?.[i]?.codigo_ibge?.message}>
              <input inputMode="numeric" {...register(`area_atuacao.${i}.codigo_ibge` as const)} />
            </Field>
            <Field label="Município" obrigatorio erro={errors.area_atuacao?.[i]?.municipio?.message}>
              <input {...register(`area_atuacao.${i}.municipio` as const)} />
            </Field>
            <Field label="UF" obrigatorio erro={errors.area_atuacao?.[i]?.uf?.message}>
              <select {...register(`area_atuacao.${i}.uf` as const)}>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
        )}
      />
    </section>
  );
}

function EquipeTecnica() {
  const { control, register, formState: { errors } } = useFormContext<Entidade>();
  return (
    <section className="cartao">
      <h2>6. Equipe técnica</h2>
      <ListaRepetivel
        control={control} name="equipe"
        titulo="Técnicos"
        textoAdicionar="+ Adicionar técnico"
        itemPadrao={{ nome: '', cpf: '', formacao: '', registro_profissional: '', vinculo: 'CLT' }}
        renderItem={(i) => (
          <div className="grid">
            <Field label="Nome" obrigatorio erro={errors.equipe?.[i]?.nome?.message}>
              <input {...register(`equipe.${i}.nome` as const)} />
            </Field>
            <Field label="CPF" obrigatorio erro={errors.equipe?.[i]?.cpf?.message}>
              <input {...register(`equipe.${i}.cpf` as const)} />
            </Field>
            <Field label="Formação" obrigatorio erro={errors.equipe?.[i]?.formacao?.message}>
              <input {...register(`equipe.${i}.formacao` as const)} />
            </Field>
            <Field label="Registro profissional" erro={errors.equipe?.[i]?.registro_profissional?.message}>
              <input {...register(`equipe.${i}.registro_profissional` as const)} />
            </Field>
            <Field label="Vínculo" erro={errors.equipe?.[i]?.vinculo?.message}>
              <select {...register(`equipe.${i}.vinculo` as const)}>
                <option>CLT</option><option>Estatutário</option><option>Contrato</option>
                <option>Voluntário</option><option>Outro</option>
              </select>
            </Field>
          </div>
        )}
      />
    </section>
  );
}

function Infraestrutura() {
  const { control, register, formState: { errors } } = useFormContext<Entidade>();

  const equipamentoLista = (
    nome: 'veiculos' | 'eq_informatica' | 'eq_rede' | 'eq_extensionista',
    titulo: string
  ) => (
    <ListaRepetivel
      control={control} name={nome}
      titulo={titulo}
      textoAdicionar={`+ Adicionar item em ${titulo.toLowerCase()}`}
      itemPadrao={{ tipo: '', ano: new Date().getFullYear(), quantidade: 1 }}
      renderItem={(i) => (
        <div className="grid">
          <Field label="Tipo" erro={errors[nome]?.[i]?.tipo?.message}>
            <input {...register(`${nome}.${i}.tipo` as const)} />
          </Field>
          <Field label="Ano" erro={errors[nome]?.[i]?.ano?.message}>
            <input type="number" {...register(`${nome}.${i}.ano` as const, { valueAsNumber: true })} />
          </Field>
          <Field label="Quantidade" erro={errors[nome]?.[i]?.quantidade?.message}>
            <input type="number" {...register(`${nome}.${i}.quantidade` as const, { valueAsNumber: true })} />
          </Field>
        </div>
      )}
    />
  );

  return (
    <section className="cartao">
      <h2>7. Infraestrutura</h2>

      <ListaRepetivel
        control={control} name="imoveis"
        titulo="Imóveis"
        textoAdicionar="+ Adicionar imóvel"
        itemPadrao={{ tipo: 'Sede', condicao_uso: 'Próprio', codigo_ibge: '', municipio: '', uf: 'PR' }}
        renderItem={(i) => (
          <div className="grid">
            <Field label="Tipo">
              <select {...register(`imoveis.${i}.tipo` as const)}>
                <option>Sede</option><option>Escritório</option><option>Galpão</option>
                <option>Campo experimental</option><option>Outro</option>
              </select>
            </Field>
            <Field label="Condição de uso">
              <select {...register(`imoveis.${i}.condicao_uso` as const)}>
                <option>Próprio</option><option>Alugado</option><option>Cedido</option>
                <option>Comodato</option><option>Outro</option>
              </select>
            </Field>
            <Field label="Código IBGE">
              <input {...register(`imoveis.${i}.codigo_ibge` as const)} />
            </Field>
            <Field label="Município">
              <input {...register(`imoveis.${i}.municipio` as const)} />
            </Field>
            <Field label="UF">
              <select {...register(`imoveis.${i}.uf` as const)}>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
        )}
      />
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />
      {equipamentoLista('veiculos', 'Veículos')}
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />
      {equipamentoLista('eq_informatica', 'Equipamentos de Informática')}
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />
      {equipamentoLista('eq_rede', 'Equipamentos de Comunicação (rede)')}
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />
      {equipamentoLista('eq_extensionista', 'Equipamentos do extensionista')}
    </section>
  );
}
