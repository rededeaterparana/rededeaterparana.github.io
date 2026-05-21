import { z } from 'zod';
import { validarCNPJ, validarCPF } from '../lib/cnpj';

const cnpjSchema = z.string().refine((v) => validarCNPJ(v), { message: 'CNPJ inválido' });
const cpfSchema = z.string().refine((v) => validarCPF(v), { message: 'CPF inválido' });
const cepSchema = z.string().refine((v) => /^\d{8}$/.test((v || '').replace(/\D/g, '')), { message: 'CEP inválido' });
const ufSchema = z.string().length(2, 'UF inválida');
const emailSchema = z.string().email('e-mail inválido').max(254);

const telefoneSchema = z.object({
  tipo: z.enum(['Fixo', 'Celular', 'Fax']),
  codigo: z.string().optional().default(''),
  ddd: z.string().regex(/^\d{2}$/, 'DDD com 2 dígitos'),
  numero: z.string().regex(/^\d{8,9}$/, 'número com 8 ou 9 dígitos'),
  ramal: z.string().optional().default('')
});

const areaAtuacaoSchema = z.object({
  codigo_ibge: z.string().regex(/^\d{6,7}$/, 'código IBGE inválido'),
  municipio: z.string().min(2),
  uf: ufSchema
});

const equipeSchema = z.object({
  nome: z.string().min(3),
  cpf: cpfSchema,
  formacao: z.string().min(2),
  registro_profissional: z.string().optional().default(''),
  vinculo: z.enum(['CLT', 'Estatutário', 'Contrato', 'Voluntário', 'Outro']).default('CLT')
});

const imovelSchema = z.object({
  tipo: z.enum(['Sede', 'Escritório', 'Galpão', 'Campo experimental', 'Outro']),
  condicao_uso: z.enum(['Próprio', 'Alugado', 'Cedido', 'Comodato', 'Outro']),
  codigo_ibge: z.string().regex(/^\d{6,7}$/),
  municipio: z.string().min(2),
  uf: ufSchema
});

const equipamentoSchema = z.object({
  tipo: z.string().min(2),
  ano: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  quantidade: z.number().int().min(1).max(9999)
});

export const entidadeSchema = z.object({
  // Seção 1
  cnpj: cnpjSchema,
  razao_social: z.string().min(3).max(200),
  nome_fantasia: z.string().min(2).max(200),
  inscricao_estadual: z.string().max(50).default('ISENTA'),
  data_constituicao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD'),

  logradouro: z.string().min(3).max(200),
  numero: z.string().min(1).max(20),
  complemento: z.string().max(100).optional().default(''),
  bairro: z.string().min(2).max(100),
  cep: cepSchema,
  municipio: z.string().min(2).max(100),
  uf: ufSchema,
  tipo_endereco: z.enum(['Comercial', 'Particular']).default('Comercial'),

  email: emailSchema,
  site: z.string().max(200).optional().default(''),

  telefones: z.array(telefoneSchema).min(1, 'informe ao menos um telefone'),

  responsavel_nome: z.string().min(3).max(150),
  responsavel_cpf: cpfSchema,
  responsavel_telefone: z.string().max(30).optional().default(''),
  contato2_nome: z.string().max(150).optional().default(''),
  contato2_cpf: z.string().optional().default('').refine(
    (v) => !v || validarCPF(v), { message: 'CPF do contato secundário inválido' }
  ),

  tipo_entidade: z.enum([
    'Pública estadual', 'Pública municipal', 'Pública federal',
    'Cooperativa', 'Associação', 'Sindicato', 'ONG', 'Empresa privada', 'Outra'
  ]),

  // Seção 2
  area_atuacao: z.array(areaAtuacaoSchema).min(1, 'informe ao menos um município de atuação'),
  equipe: z.array(equipeSchema).min(1, 'informe ao menos um técnico'),
  imoveis: z.array(imovelSchema).default([]),
  veiculos: z.array(equipamentoSchema).default([]),
  eq_informatica: z.array(equipamentoSchema).default([]),
  eq_rede: z.array(equipamentoSchema).default([]),
  eq_extensionista: z.array(equipamentoSchema).default([]),

  // LGPD / anti-bot
  consentimento_lgpd: z.literal(true, {
    errorMap: () => ({ message: 'é necessário aceitar o termo LGPD' })
  }),
  website_url: z.string().max(0).optional().default('') // honeypot — deve ficar vazio
});

export type Entidade = z.infer<typeof entidadeSchema>;

export const valoresPadrao: Partial<Entidade> = {
  inscricao_estadual: 'ISENTA',
  tipo_endereco: 'Comercial',
  telefones: [{ tipo: 'Fixo', codigo: '', ddd: '', numero: '', ramal: '' }],
  area_atuacao: [],
  equipe: [],
  imoveis: [],
  veiculos: [],
  eq_informatica: [],
  eq_rede: [],
  eq_extensionista: [],
  website_url: ''
};
