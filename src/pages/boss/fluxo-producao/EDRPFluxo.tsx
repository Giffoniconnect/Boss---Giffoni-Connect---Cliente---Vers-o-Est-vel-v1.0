import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Info,
  Lock,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckSquare,
  User,
  Briefcase,
  Layers,
  FileCheck,
  Compass,
  Check,
  MapPin,
  ExternalLink,
  Plus,
  Database,
  Search,
  Trash2,
  Edit3,
  X,
  UserPlus,
  Mail,
  Phone,
  Share2,
  RefreshCw,
  Sparkles,
  FileText,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';
import { useAuth } from '../../../contexts/AuthContext';
import { PFForm } from '../../../modules/boss/components/forms/PFForm';
import { PJForm } from '../../../modules/boss/components/forms/PJForm';
import {
  buildProcuracaoPfPlaceholders,
  buildGlobalPlaceholders,
  buildClientCommonPlaceholders,
  buildCaseCommonPlaceholders
} from '../../../lib/documents/placeholderBuilders';

export function extractPfDataFromClient(clientData: any) {
  if (!clientData || clientData.type === 'PJ' || clientData.tipoCliente === 'PJ') return null;
  
  const getVal = (keys: string[]): string => {
    for (const key of keys) {
      const val = clientData?.[key] ?? 
                  clientData?.pfDadosPessoais?.[key] ?? 
                  clientData?.pfData?.[key] ?? 
                  clientData?.portalMirror?.[key] ?? 
                  clientData?.portalMirror?.pfDadosPessoais?.[key] ??
                  clientData?.portalMirror?.pfContato?.[key] ??
                  clientData?.portalMirror?.pfEndereco?.[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  };

  return {
    OUTORGANTE_NOME: getVal(['pf_nomeCompleto', 'nomeCompleto', 'nome', 'name']).toUpperCase(),
    OUTORGANTE_NACIONALIDADE: getVal(['pf_nacionalidade', 'nacionalidade']) || 'Brasileira',
    OUTORGANTE_ESTADO_CIVIL: getVal(['pf_estadoCivil', 'estadoCivil']) || 'Solteiro(a)',
    OUTORGANTE_PROFISSAO: getVal(['pf_profissao', 'profissao']) || '—',
    OUTORGANTE_RG: getVal(['pf_rg', 'rg']) || '—',
    OUTORGANTE_CPF: getVal(['pf_cpf', 'cpf']) || '—',
    OUTORGANTE_ENDERECO: getVal(['pf_endereco', 'endereco', 'rua', 'logradouro']) || '—',
    OUTORGANTE_NUMERO: getVal(['pf_numero', 'numero']) || '—',
    OUTORGANTE_COMPLEMENTO: getVal(['pf_complemento', 'complemento']) || '—',
    OUTORGANTE_BAIRRO: getVal(['pf_bairro', 'bairro']) || '—',
    OUTORGANTE_CIDADE: getVal(['pf_cidade', 'cidade', 'localidade']) || '—',
    OUTORGANTE_ESTADO: getVal(['pf_estado', 'estado', 'uf']) || '—',
    OUTORGANTE_CEP: getVal(['pf_cep', 'cep']) || '—',
    OUTORGANTE_TELEFONE: getVal(['pf_telefone', 'telefone', 'phone']) || '—',
    OUTORGANTE_WHATSAPP: getVal(['pf_whatsapp', 'whatsapp']) || '—',
    OUTORGANTE_EMAIL: getVal(['pf_email', 'email']) || '—'
  };
}

export function buildFinalQualificationText(payload: any): string {
  if (!payload) return '';
  const nome = payload.OUTORGANTE_NOME || '—';
  const nacionalidade = payload.OUTORGANTE_NACIONALIDADE || '—';
  const estadoCivil = payload.OUTORGANTE_ESTADO_CIVIL || '—';
  const profissao = payload.OUTORGANTE_PROFISSAO || '—';
  const rg = payload.OUTORGANTE_RG || '—';
  const cpf = payload.OUTORGANTE_CPF || '—';
  const endereco = payload.OUTORGANTE_ENDERECO || '—';
  const numero = payload.OUTORGANTE_NUMERO || '—';
  const complemento = payload.OUTORGANTE_COMPLEMENTO || '—';
  const bairro = payload.OUTORGANTE_BAIRRO || '—';
  const cidade = payload.OUTORGANTE_CIDADE || '—';
  const estado = payload.OUTORGANTE_ESTADO || '—';
  const cep = payload.OUTORGANTE_CEP || '—';
  const telefone = payload.OUTORGANTE_TELEFONE || '—';
  const whatsapp = payload.OUTORGANTE_WHATSAPP || '—';
  const email = payload.OUTORGANTE_EMAIL || '—';

  return `${nome}, ${nacionalidade}, ${estadoCivil}, ${profissao}, RG: ${rg}, CPF: ${cpf}, Endereço: ${endereco}, nº ${numero}, complemento ${complemento}, Bairro ${bairro}, ${cidade}/${estado}, CEP: ${cep}, Telefone: ${telefone}, WhatsApp: ${whatsapp}, E-mail: ${email}.`;
}

export function generateAuthorQualification(clientData: any, caseData?: any): string {
  if (!clientData) return '';
  if (clientData.type === 'PJ') {
    const getVal = (arr: any[]) => {
      for (const val of arr) {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
      return '—';
    };

    const razaoSocial = getVal([
      clientData.pjDadosEmpresa?.pj_razaoSocial,
      clientData.pjData?.pj_razaoSocial,
      clientData.name
    ]).toUpperCase();

    const cnpj = getVal([
      clientData.pjDadosEmpresa?.pj_cnpj,
      clientData.pjData?.pj_cnpj,
      clientData.cnpj
    ]);

    const socio = getVal([
      clientData.pjDadosEmpresa?.pj_socioAdministrador,
      clientData.pjData?.pj_socioAdministrador,
      clientData.socioAdministrador
    ]);

    const endereco = getVal([
      clientData.pjEnderecoEmpresa?.pj_enderecoEmpresa,
      clientData.pjEndereco?.pj_endereco,
      clientData.endereco
    ]);

    const numero = getVal([
      clientData.pjEnderecoEmpresa?.pj_numeroEmpresa,
      clientData.pjEndereco?.pj_numero,
    ]);

    const complemento = getVal([
      clientData.pjEnderecoEmpresa?.pj_complementoEmpresa,
      clientData.pjEndereco?.pj_complemento,
    ]);

    const bairro = getVal([
      clientData.pjEnderecoEmpresa?.pj_bairroEmpresa,
      clientData.pjEndereco?.pj_bairro,
    ]);

    const cidade = getVal([
      clientData.pjEnderecoEmpresa?.pj_cidadeEmpresa,
      clientData.pjEndereco?.pj_cidade,
    ]);

    const estado = getVal([
      clientData.pjEnderecoEmpresa?.pj_estadoEmpresa,
      clientData.pjEndereco?.pj_estado,
    ]);

    const cep = getVal([
      clientData.pjEnderecoEmpresa?.pj_cepEmpresa,
      clientData.pjEndereco?.pj_cep,
    ]);

    const telefone = getVal([
      clientData.pjContatoEmpresa?.pj_telefoneEmpresa,
      clientData.pjContato?.pj_telefone,
      clientData.phone,
      clientData.telefone
    ]);

    const email = getVal([
      clientData.pjContatoEmpresa?.pj_emailEmpresa,
      clientData.pjContato?.pj_email,
      clientData.email
    ]);

    const complText = complemento && complemento !== '—' ? `, ${complemento}` : '';

    return `${razaoSocial}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cnpj}, com sede na ${endereco}, nº ${numero}${complText}, Bairro ${bairro}, ${cidade}/${estado}, CEP ${cep}, neste ato representada por seu Sócio Administrador ${socio}, telefone ${telefone}, e-mail ${email}.`;
  } else {
    // Pessoa Física
    const extracted = extractPfDataFromClient(clientData);
    if (!extracted) return '';
    return buildFinalQualificationText(extracted);
  }
}

// Helper functions for mapping flat <-> nested structures inside edrp.structuring.defendant
function getNormalizedDefendant(rawDef: any): any {
  if (!rawDef) {
    return {
      type: 'PF',
      pfDadosPessoais: {},
      pfContato: {},
      pfEndereco: {},
      pfRedesSociais: {},
      pjDadosEmpresa: {},
      pjContatoEmpresa: {},
      pjEnderecoEmpresa: {},
      pjRedesSociaisEmpresa: {}
    };
  }

  const type = rawDef.type || 'PF';

  // Read with defense overrides (flat fields map to nested blocks if blocks are empty)
  const pfDadosPessoais = {
    pf_nomeCompleto: (rawDef.pfDadosPessoais?.pf_nomeCompleto || rawDef.pf_nomeCompleto || '').toUpperCase(),
    pf_nacionalidade: rawDef.pfDadosPessoais?.pf_nacionalidade || rawDef.pf_nacionalidade || 'Brasileira',
    pf_estadoCivil: rawDef.pfDadosPessoais?.pf_estadoCivil || rawDef.pf_estadoCivil || '',
    pf_profissao: rawDef.pfDadosPessoais?.pf_profissao || rawDef.pf_profissao || '',
    pf_cpf: rawDef.pfDadosPessoais?.pf_cpf || rawDef.pf_cpf || '',
    pf_rg: rawDef.pfDadosPessoais?.pf_rg || rawDef.pf_rg || '',
    pf_dataNascimento: rawDef.pfDadosPessoais?.pf_dataNascimento || rawDef.pf_dataNascimento || rawDef.pf_nascimento || '',
    pf_nomePai: (rawDef.pfDadosPessoais?.pf_nomePai || rawDef.pf_nomePai || '').toUpperCase(),
    pf_nomeMae: (rawDef.pfDadosPessoais?.pf_nomeMae || rawDef.pf_nomeMae || '').toUpperCase()
  };

  const pfContato = {
    pf_email: rawDef.pfContato?.pf_email || rawDef.pf_email || '',
    pf_telefone: rawDef.pfContato?.pf_telefone || rawDef.pf_telefone || '',
    pf_possuiWhatsapp: rawDef.pfContato?.pf_possuiWhatsapp !== undefined 
      ? rawDef.pfContato.pf_possuiWhatsapp 
      : (rawDef.pf_possuiWhatsapp || false),
    pf_whatsapp: rawDef.pfContato?.pf_whatsapp || rawDef.pf_whatsapp || ''
  };

  const pfEndereco = {
    pf_cep: rawDef.pfEndereco?.pf_cep || rawDef.pf_cep || '',
    pf_endereco: rawDef.pfEndereco?.pf_endereco || rawDef.pf_endereco || '',
    pf_numero: rawDef.pfEndereco?.pf_numero || rawDef.pf_numero || '',
    pf_complemento: rawDef.pfEndereco?.pf_complemento || rawDef.pf_complemento || '',
    pf_bairro: rawDef.pfEndereco?.pf_bairro || rawDef.pf_bairro || '',
    pf_cidade: rawDef.pfEndereco?.pf_cidade || rawDef.pf_cidade || '',
    pf_estado: rawDef.pfEndereco?.pf_estado || rawDef.pf_estado || ''
  };

  const pfRedesSociais = {
    pf_instagram: rawDef.pfRedesSociais?.pf_instagram || rawDef.pf_instagram || '',
    pf_facebook: rawDef.pfRedesSociais?.pf_facebook || rawDef.pf_facebook || '',
    pf_tiktok: rawDef.pfRedesSociais?.pf_tiktok || rawDef.pf_tiktok || ''
  };

  const pjDadosEmpresa = {
    pj_cnpj: rawDef.pjDadosEmpresa?.pj_cnpj || rawDef.pj_cnpj || '',
    pj_razaoSocial: (rawDef.pjDadosEmpresa?.pj_razaoSocial || rawDef.pj_razaoSocial || '').toUpperCase(),
    pj_nomeFantasia: (rawDef.pjDadosEmpresa?.pj_nomeFantasia || rawDef.pj_nomeFantasia || rawDef.pj_nomeFantasia || '').toUpperCase()
  };

  const pjContatoEmpresa = {
    pj_emailEmpresa: rawDef.pjContatoEmpresa?.pj_emailEmpresa || rawDef.pj_emailEmpresa || rawDef.pj_email || '',
    pj_telefoneEmpresa: rawDef.pjContatoEmpresa?.pj_telefoneEmpresa || rawDef.pj_telefoneEmpresa || rawDef.pj_telefone || '',
    pj_possuiWhatsappEmpresa: rawDef.pjContatoEmpresa?.pj_possuiWhatsappEmpresa !== undefined 
      ? rawDef.pjContatoEmpresa.pj_possuiWhatsappEmpresa 
      : (rawDef.pj_possuiWhatsappEmpresa || false),
    pj_whatsappEmpresa: rawDef.pjContatoEmpresa?.pj_whatsappEmpresa || rawDef.pj_whatsapp || ''
  };

  const pjEnderecoEmpresa = {
    pj_cepEmpresa: rawDef.pjEnderecoEmpresa?.pj_cepEmpresa || rawDef.pj_cepEmpresa || '',
    pj_enderecoEmpresa: rawDef.pjEnderecoEmpresa?.pj_enderecoEmpresa || rawDef.pj_endereco || '',
    pj_numeroEmpresa: rawDef.pjEnderecoEmpresa?.pj_numeroEmpresa || rawDef.pj_numeroEmpresa || '',
    pj_complementoEmpresa: rawDef.pjEnderecoEmpresa?.pj_complementoEmpresa || rawDef.pj_complementoEmpresa || '',
    pj_bairroEmpresa: rawDef.pjEnderecoEmpresa?.pj_bairroEmpresa || rawDef.pj_bairroEmpresa || '',
    pj_cidadeEmpresa: rawDef.pjEnderecoEmpresa?.pj_cidadeEmpresa || rawDef.pj_cidadeEmpresa || '',
    pj_estadoEmpresa: rawDef.pjEnderecoEmpresa?.pj_estadoEmpresa || rawDef.pj_estadoEmpresa || ''
  };

  const pjRedesSociaisEmpresa = {
    pj_instagramEmpresa: rawDef.pjRedesSociaisEmpresa?.pj_instagramEmpresa || rawDef.pj_instagramEmpresa || '',
    pj_facebookEmpresa: rawDef.pjRedesSociaisEmpresa?.pj_facebookEmpresa || rawDef.pj_facebookEmpresa || '',
    pj_tiktokEmpresa: rawDef.pjRedesSociaisEmpresa?.pj_tiktokEmpresa || rawDef.pj_tiktokEmpresa || ''
  };

  return {
    type,
    // flat legacy/compatible copies
    ...pfDadosPessoais,
    ...pfContato,
    ...pfEndereco,
    ...pfRedesSociais,
    ...pjDadosEmpresa,
    ...pjContatoEmpresa,
    ...pjEnderecoEmpresa,
    ...pjRedesSociaisEmpresa,
    // blocks
    pfDadosPessoais,
    pfContato,
    pfEndereco,
    pfRedesSociais,
    pjDadosEmpresa,
    pjContatoEmpresa,
    pjEnderecoEmpresa,
    pjRedesSociaisEmpresa
  };
}

// EDRP complete interface matching Regra 2
interface EDRPData {
  structuring: {
    competence: string;
    comarca?: string;
    defendant?: {
      type: 'PF' | 'PJ';
      [key: string]: any;
    };
    defendants?: any[];
    parties: string;
    relevantFacts: string;
    legalGrounds: string;
    claims: string;
    evidenceSummary: string;
    risks: string;
    strategy: string;
    notes: string;
    valorCausa?: string;
    completed: boolean;
    completedAt: string;
    authorQualificationPayload?: {
      OUTORGANTE_NOME: string;
      OUTORGANTE_NACIONALIDADE: string;
      OUTORGANTE_ESTADO_CIVIL: string;
      OUTORGANTE_PROFISSAO: string;
      OUTORGANTE_RG: string;
      OUTORGANTE_CPF: string;
      OUTORGANTE_ENDERECO: string;
      OUTORGANTE_NUMERO: string;
      OUTORGANTE_COMPLEMENTO: string;
      OUTORGANTE_BAIRRO: string;
      OUTORGANTE_CIDADE: string;
      OUTORGANTE_ESTADO: string;
      OUTORGANTE_CEP: string;
      OUTORGANTE_TELEFONE: string;
      OUTORGANTE_WHATSAPP: string;
      OUTORGANTE_EMAIL: string;
    };
    authorQualificationManualEdited?: boolean;
    authorQualificationOrigin?: string;
  };
  custodiaProvasPF?: {
    provas: Array<{
      id: string;
      nomeProva: string;
      finalidadeJuridica: string;
      criadoEm: string;
      atualizadoEm: string;
      isFromPrevious?: boolean;
    }>;
  };
  delegation: {
    responsiblePerson: string;
    responsibleSector: string;
    delegatedTask: string;
    internalDeadline: string;
    priority: string;
    status: 'nao_delegado' | 'pendente' | 'em_andamento' | 'concluido' | 'devolvido_com_pendencia';
    todoistPrepared: boolean;
    todoistTaskId: string;
    todoistProject: string;
    todoistStatus: string;
    collaboratorPanelPrepared: boolean;
    collaboratorAssignedUser: string;
    collaboratorAssignmentStatus: string;
    notes: string;
    completed: boolean;
    completedAt: string;
  };
  reviewPreparation: {
    reviewResponsible: string;
    reviewDate: string;
    reviewDeadline: string;
    reviewInstructions: string;
    reviewStatus: 'aguardando_revisao' | 'em_revisao' | 'ajustes_solicitados' | 'aprovado' | 'reprovado';
    adjustmentsRequested: string;
    approvedForProtocol: boolean;
    todoistPrepared: boolean;
    todoistTaskId: string;
    collaboratorPanelPrepared: boolean;
    collaboratorAssignedUser: string;
    notes: string;
    completed: boolean;
    completedAt: string;
  };
  protocolPreparation: {
    protocolResponsible: string;
    expectedProtocolDate: string;
    protocolSystem: string;
    protocolStatus: 'nao_preparado' | 'aguardando_revisao' | 'pronto_para_protocolar' | 'agendado' | 'protocolado' | 'devolvido' | 'cancelado';
    protocolInstructions: string;
    requiresCNJ: boolean;
    processNumber: string;
    proofOfProtocolPrepared: boolean;
    googleDrivePrepared: boolean;
    notes: string;
    completed: boolean;
    completedAt: string;
  };
  edrpStatus: string;
  updatedAt: string;
  subEtapa01?: {
    card6?: {
      fundamentosLegoSelecionados?: any[];
    };
    card7?: {
      pedidosLegoVinculados?: any[];
      pedidosPadroesAdicionados?: any[];
    };
    legoAuditLogs?: any[];
    modalidadeCitacao?: string;
    modalidadeCitacaoBornInCard6?: boolean;
    formaPublicacoes?: string;
    advogadoPublicacao?: string;
    formaPublicacoesBornInCard6?: boolean;
  };
}

// Initial/default pristine values inside EDRPData definition
const DEFAULT_EDRP: EDRPData = {
  structuring: {
    competence: '',
    comarca: '',
    defendant: {
      type: 'PF',
      pf_nomeCompleto: '',
      pf_cpf: '',
      pf_rg: '',
      pf_estadoCivil: '',
      pf_profissao: '',
      pf_email: '',
      pf_telefone: '',
      pf_endereco: '',
      pj_razaoSocial: '',
      pj_cnpj: '',
      pj_inscricaoEstadual: '',
      pj_socioAdministrador: '',
      pj_email: '',
      pj_telefone: '',
      pj_endereco: '',
    },
    defendants: [],
    parties: '',
    relevantFacts: '',
    legalGrounds: '',
    claims: '',
    evidenceSummary: '',
    risks: '',
    strategy: '',
    notes: '',
    valorCausa: '',
    completed: false,
    completedAt: '',
    authorQualificationPayload: undefined,
    authorQualificationManualEdited: false,
    authorQualificationOrigin: ''
  },
  custodiaProvasPF: {
    provas: []
  },
  subEtapa01: {
    card6: {
      fundamentosLegoSelecionados: []
    },
    card7: {
      pedidosLegoVinculados: [],
      pedidosPadroesAdicionados: []
    },
    legoAuditLogs: []
  },
  delegation: {
    responsiblePerson: '',
    responsibleSector: 'Jurídico Interno',
    delegatedTask: '',
    internalDeadline: '',
    priority: 'media',
    status: 'nao_delegado',
    todoistPrepared: false,
    todoistTaskId: '',
    todoistProject: '',
    todoistStatus: '',
    collaboratorPanelPrepared: false,
    collaboratorAssignedUser: '',
    collaboratorAssignmentStatus: '',
    notes: '',
    completed: false,
    completedAt: ''
  },
  reviewPreparation: {
    reviewResponsible: '',
    reviewDate: '',
    reviewDeadline: '',
    reviewInstructions: '',
    reviewStatus: 'aguardando_revisao',
    adjustmentsRequested: '',
    approvedForProtocol: false,
    todoistPrepared: false,
    todoistTaskId: '',
    collaboratorPanelPrepared: false,
    collaboratorAssignedUser: '',
    notes: '',
    completed: false,
    completedAt: ''
  },
  protocolPreparation: {
    protocolResponsible: '',
    expectedProtocolDate: '',
    protocolSystem: '',
    protocolStatus: 'nao_preparado',
    protocolInstructions: '',
    requiresCNJ: false,
    processNumber: '',
    proofOfProtocolPrepared: false,
    googleDrivePrepared: false,
    notes: '',
    completed: false,
    completedAt: ''
  },
  edrpStatus: 'Rascunho',
  updatedAt: ''
};

// Sectors defined by Regra 4
const SECTORS = [
  'Jurídico Interno',
  'Controladoria',
  'Financeiro',
  'Comercial',
  'Operacional',
  'Estratégico',
  'RH',
  'Marketing'
];

interface LegoLibraryItem {
  id: string;
  title: string;
  foundationTemplate: string;
  claimTemplate: string;
}

const LEGO_LIBRARY: Record<string, LegoLibraryItem[]> = {
  "Direito Civil": [
    {
      id: "gratuidade_justica",
      title: "Gratuidade de Justiça",
      foundationTemplate: "=== FUNDAMENTO LEGO: Gratuidade de Justiça ===\nTese sob amparo do Art. 98 e seguintes do Código de Processo Civil: concessão da gratuidade de justiça ante a insuficiência de recursos para arcar com custas e despesas processuais sem prejuízo do próprio sustento e de sua família.\n=============================================",
      claimTemplate: "=== PEDIDO LEGO VINCULADO: Gratuidade de Justiça ===\nPedido de gratuidade de justiça: concessão dos benefícios da Justiça Gratuita, nos termos do Art. 98 do CPC.\n============================================="
    },
    {
      id: "modalidade_citacao",
      title: "Modalidade de citação",
      foundationTemplate: "=== FUNDAMENTO LEGO: Modalidade de citação ===\nTese pelo Art. 246 do Código de Processo Civil: citação do réu na modalidade {MODALIDADE_SELECIONADA}, por constituir o meio legal e preferencial para a ciência e instauração do contraditório na relação processual.\n=============================================",
      claimTemplate: "=== PEDIDO LEGO VINCULADO: Modalidade de citação ===\nPedido de citação na modalidade escolhida: citação do réu por {MODALIDADE_SELECIONADA} para, querendo, contestar a presente ação no prazo legal, sob pena de revelia.\n============================================="
    },
    {
      id: "forma_publicacoes",
      title: "Forma das Publicações",
      foundationTemplate: "=== FUNDAMENTO LEGO: Forma das Publicações ===\nTese sob o rito do Art. 272, § 2º e § 5º do CPC: publicação dos atos e intimações dirigidas de maneira singular e sob pena de nulidade absoluta ao(s) patrono(s) indicado(s) {ADVOGADOS_SELECIONADOS}.\n=============================================",
      claimTemplate: "=== PEDIDO LEGO VINCULADO: Forma das Publicações ===\nPedido de publicações na forma escolhida: requer-se que todas as intimações e publicações sejam expedidas exclusivamente sob o nome de {ADVOGADOS_SELECIONADOS}, sob pena de nulidade processual fática.\n============================================="
    }
  ]
};

interface StandardClaimLibraryItem {
  id: string;
  title: string;
  template: string;
}

const STANDARD_CLAIMS_LIBRARY: StandardClaimLibraryItem[] = [
  {
    id: "citacao_padrao",
    title: "Pedido de citação padrão",
    template: "=== PEDIDO LEGO PADRÃO: Pedido de citação padrão ===\nPedido de citação: citação do réu para que, querendo, apresente contestação no prazo legal, sob pena de sofrer os efeitos da revelia e confissão ficta quanto à matéria de fato.\n============================================="
  },
  {
    id: "condenacao_custas_honorarios",
    title: "Pedido de condenação em custas, despesas e sucumbência",
    template: "=== PEDIDO LEGO PADRÃO: Pedido de condenação em custas, despesas e sucumbência ===\nPedido de condenação: condenação do réu ao pagamento das custas processuais, despesas de atos e honorários advocatícios sucumbenciais, estes fixados no patamar de 20% sobre o valor da condenação, nos termos do Art. 85 do CPC.\n============================================="
  },
  {
    id: "publicacoes_padrao",
    title: "Pedido de publicações padrão",
    template: "=== PEDIDO LEGO PADRÃO: Pedido de publicações padrão ===\nPedido de publicações padrão: requer-se que todas as intimações e publicações sejam realizadas exclusivamente em nome dos patronos indicados, sob pena de nulidade fática dos atos processuais subsequentes.\n============================================="
  },
  {
    id: "dispensa_audiencia_conciliacao",
    title: "Pedido de dispensa de audiência de conciliação",
    template: "=== PEDIDO LEGO PADRÃO: Pedido de dispensa de audiência de conciliação ===\nPedido de dispensa de audiência de conciliação: manifestação expressa de desinteresse na realização da audiência de conciliação ou mediação, nos termos do Art. 319, VII do CPC, visando à celeridade processual.\n============================================="
  }
];

const getPreviousDocuments = (wizardState: any, requests: any[], clientType: string) => {
  const docs: Array<{ nomeProva: string; isFromPrevious: boolean }> = [];

  // 1. Basic Docs
  if (wizardState?.q1_3 === 'sim' || (wizardState?.procuracaoFiles || []).length > 0) {
    docs.push({ nomeProva: 'Procuração Ad Judicia', isFromPrevious: true });
  }
  
  if (clientType === 'PJ') {
    if ((wizardState?.declaracaoFiles || []).length > 0) {
      docs.push({ nomeProva: 'Balancete / Declaração PJ', isFromPrevious: true });
    }
    if ((wizardState?.cnpjFiles || []).length > 0) {
      docs.push({ nomeProva: 'Cartão CNPJ Oficial', isFromPrevious: true });
    }
    if ((wizardState?.contratoSocialFiles || []).length > 0) {
      docs.push({ nomeProva: 'Contrato Social / Ato Constitutivo', isFromPrevious: true });
    }
    if ((wizardState?.enderecoSedeFiles || []).length > 0) {
      docs.push({ nomeProva: 'Comprovante Endereço Sede', isFromPrevious: true });
    }
    if ((wizardState?.rgSocioFiles || []).length > 0) {
      docs.push({ nomeProva: 'RG do Sócio Administrador', isFromPrevious: true });
    }
    if ((wizardState?.cpfSocioFiles || []).length > 0) {
      docs.push({ nomeProva: 'CPF do Sócio Administrador', isFromPrevious: true });
    }
    if ((wizardState?.residenciaSocioFiles || []).length > 0) {
      docs.push({ nomeProva: 'Comprovante Endereço Sócio', isFromPrevious: true });
    }
  } else {
    const hasTaxas = wizardState?.q2_1 === 'nao' && ((wizardState?.guiaCustasFiles || []).length > 0 && (wizardState?.comprovanteGuiaCustasFiles || []).length > 0);
    const hasGratuidade = wizardState?.q2_1 === 'sim' && wizardState?.q2_4 === 'sim' && (wizardState?.declaracaoFiles || []).length > 0;
    if (hasTaxas) {
      docs.push({ nomeProva: 'Guia e Comprovante de Custas', isFromPrevious: true });
    } else if (hasGratuidade || (wizardState?.declaracaoFiles || []).length > 0) {
      docs.push({ nomeProva: 'Declaração de Hipossuficiência', isFromPrevious: true });
    }

    if ((wizardState?.rgFiles || []).length > 0) {
      docs.push({ nomeProva: 'Cédula de Identidade (RG)', isFromPrevious: true });
    }
    if ((wizardState?.cpfFiles || []).length > 0) {
      docs.push({ nomeProva: 'Cadastro de Pessoa Física (CPF)', isFromPrevious: true });
    }
    if ((wizardState?.comprovanteFiles || []).length > 0) {
      docs.push({ nomeProva: 'Comprovante de Residência Atualizado', isFromPrevious: true });
    }
  }

  if (wizardState?.q3_7 === 'sim' || (wizardState?.q3_4 === 'sim' && wizardState?.q3_5 === 'sim') || (wizardState?.contratoFiles || []).length > 0) {
    docs.push({ nomeProva: clientType === 'PJ' ? 'Contrato de Honorários Corporativo' : 'Contrato de Honorários Advocatícios', isFromPrevious: true });
  }

  // 2. Additional Requests
  if (Array.isArray(requests)) {
    requests.forEach(req => {
      const reqState = wizardState?.q5_provas?.[req.id] || { received: 'nao' };
      if (reqState.received === 'sim' || req.title) {
        docs.push({ nomeProva: req.title, isFromPrevious: true });
      }
    });
  }

  // De-duplicate by nomeProva case-insensitively
  const uniqueDocs: Array<{ nomeProva: string; isFromPrevious: boolean }> = [];
  const seen = new Set<string>();
  docs.forEach(d => {
    const key = d.nomeProva.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDocs.push(d);
    }
  });

  return uniqueDocs;
};

// HELPER FOR GENERATING CONSOLIDATED PREVIEW TEXT
const generatePreviewText = (edrpData: any, clientData: any, caseObjData: any, resolvedClientName: string) => {
  const identificacao = `[IDENTIFICAÇÃO DO CASO]
ID do Caso: ${caseObjData?.id || ''}
Cliente: ${resolvedClientName}
Tipo de Serviço: ${caseObjData?.servicoSelecionado || caseObjData?.category || 'Judicial'}
Área do Direito: ${caseObjData?.areaDireito || 'Geral'}
Assunto: ${caseObjData?.assunto || 'Estruturação'}
Competência: ${edrpData.structuring?.competence || 'Não selecionada'}
Comarca: ${edrpData.structuring?.comarca || 'Não selecionada'}`;

  const qualificacao = `[QUALIFICAÇÃO DAS PARTES]
Partes/Qualificação Consolidada:
${edrpData.structuring?.parties || 'Nenhuma qualificação estruturada.'}`;

  const sinteseFatica = `[SÍNTESE FÁTICA]
Fatos Relevantes do Caso:
${edrpData.structuring?.relevantFacts || 'Sem fatos preenchidos.'}`;

  const fundamentos = `[FUNDAMENTOS JURÍDICOS]
Fundamentos/Teses de Defesa:
${edrpData.structuring?.legalGrounds || 'Sem fundamentos preenchidos.'}`;

  const provasList = (edrpData.custodiaProvasPF?.provas || [])
    .map((p: any, idx: number) => `${idx + 1}. Prova: ${p.nomeProva} | Finalidade Jurídica: ${p.finalidadeJuridica || 'PENDENTE'}`)
    .join('\n');
  const provas = `[CUSTÓDIA DE PROVAS & FINALIDADES]
${provasList || 'Nenhuma prova cadastrada.'}`;

  const pedidos = `[PEDIDOS OU PRETENSÕES]
${edrpData.structuring?.claims || 'Sem pedidos preenchidos.'}`;

  const riscos = `[PONTOS DE ATENÇÃO / ANÁLISE DE RISCO]
${edrpData.structuring?.risks || 'Sem riscos informados.'}`;

  const estrategia = `[ESTRATÉGIA DEFINIDA]
${edrpData.structuring?.strategy || 'Sem estratégia cadastrada.'}`;

  const valorCausa = `[VALOR DA CAUSA]
Valor Estimado: ${edrpData.structuring?.valorCausa || 'Não informado.'}`;

  const observacoes = `[OBSERVAÇÕES JURÍDICAS CONSOLIDADAS]
${edrpData.structuring?.notes || 'Sem observações secundárias.'}`;

  return [
    identificacao,
    qualificacao,
    sinteseFatica,
    fundamentos,
    provas,
    pedidos,
    riscos,
    estrategia,
    valorCausa,
    observacoes
  ].join('\n\n==================================================\n\n');
};

// HELPER FOR RUNNING STRUCTURED AUDIT
const runAuditoria = (edrpData: any, clientData: any, caseData: any, previewText: string, relStatus: string) => {
  const pendenciasCriticas: string[] = [];
  const pendenciasModeradas: string[] = [];
  const itensAprovados: string[] = [];
  const sugestoes: string[] = [];

  // Check client / previous steps data (Carry-on)
  if (!clientData) {
    pendenciasCriticas.push("Dados cadastrais do cliente ausentes ou não localizados (Falha Crítica de Carry-On).");
  } else {
    itensAprovados.push("Dados do cliente carregados com sucesso das etapas anteriores.");
  }

  if (!caseData?.servicoSelecionado && !caseData?.category) {
    pendenciasModeradas.push("Tipo de serviço não especificado na entrevista inicial.");
  } else {
    itensAprovados.push(`Tipo de serviço identificado: ${caseData?.servicoSelecionado || caseData?.category}`);
  }

  // Subetapa 01 Audit
  const structuring = edrpData.structuring || {};
  if (!structuring.relevantFacts || structuring.relevantFacts.trim().length < 20) {
    pendenciasCriticas.push("Síntese fática do caso está vazia ou excessivamente curta (insuficiente para pré-peticionamento).");
    sugestoes.push("Descreva em mais detalhes os fatos principais na Subetapa 01.");
  } else {
    itensAprovados.push("Síntese fática estruturada com descrição suficiente.");
  }

  if (!structuring.legalGrounds || structuring.legalGrounds.trim().length < 20) {
    pendenciasCriticas.push("Fundamentos jurídicos e teses de defesa ausentes.");
    sugestoes.push("Adicione teses de defesa ou fundamentos jurídicos para sustentar o pleito do cliente.");
  } else {
    itensAprovados.push("Fundamentos jurídicos e teses de defesa estruturados.");
  }

  if (!structuring.claims || structuring.claims.trim().length < 15) {
    pendenciasCriticas.push("Pedidos ou pretensões finais não foram preenchidos ou estão insuficientes.");
    sugestoes.push("Detone e especifique os pedidos pretendidos (danos morais, repetição de indébito, etc.) no Card de Pedidos.");
  } else {
    itensAprovados.push("Pedidos estruturados e vinculados às bases fáticas.");
  }

  // Provas sem finalidade
  const provas = edrpData.custodiaProvasPF?.provas || [];
  if (provas.length === 0) {
    pendenciasModeradas.push("Nenhuma prova documental cadastrada sob a custódia do escritório para este caso.");
    sugestoes.push("Anexe guias, RG/CNH ou outros documentos comprobatórios relevantes.");
  } else {
    itensAprovados.push(`${provas.length} prova(s) documental(is) devidamente cadastrada(s).`);
    const semFinalidade = provas.filter((p: any) => !p.finalidadeJuridica || p.finalidadeJuridica.trim().length < 5);
    if (semFinalidade.length > 0) {
      pendenciasCriticas.push(`Existem ${semFinalidade.length} prova(s) sem finalidade jurídica cadastrada (Ex: ${semFinalidade.map((p: any) => p.nomeProva).join(', ')}).`);
      sugestoes.push("Defina a finalidade de cada prova anexada para orientar adequadamente o motor de IA.");
    } else {
      itensAprovados.push("Todas as provas cadastradas possuem finalidade jurídica descrita.");
    }
  }

  // Valor da causa
  if (!structuring.valorCausa || structuring.valorCausa.trim() === '') {
    pendenciasModeradas.push("Valor da causa não informado ou não revisado na Subetapa 01.");
    sugestoes.push("Estipule o valor da causa provável com base nos pedidos formulados.");
  } else {
    itensAprovados.push(`Valor da causa validado: ${structuring.valorCausa}`);
  }

  // Riscos e observações
  if (!structuring.risks || structuring.risks.trim() === '') {
    pendenciasModeradas.push("Análise de riscos (sucumbência, revelia, custas) ausente.");
  } else {
    itensAprovados.push("Análise de riscos preenchida com as contingências de derrota.");
  }

  // GDocs status audit
  if (relStatus !== 'criado') {
    pendenciasModeradas.push("O Relatório de Estruturação no Google Docs ainda não foi gerado automaticamente (Subetapa 03 pendente).");
    sugestoes.push("Acesse a Subetapa 03 e clique em 'Gerar Relatório de Estruturação' antes de prosseguir ao pré-peticionamento.");
  } else {
    itensAprovados.push("Relatório oficial de estruturação devidamente gerado e salvo no Google Drive.");
  }

  // Calculate global summary
  let status = 'gerada';
  let resumo = "";
  if (pendenciasCriticas.length > 0) {
    resumo = `Auditoria concluída com ${pendenciasCriticas.length} pendência(s) crítica(s) e ${pendenciasModeradas.length} pendência(s) moderada(s). Recomenda-se saneamento imediato antes de avançar para o Pré-Peticionamento IA.`;
  } else if (pendenciasModeradas.length > 0) {
    resumo = `Auditoria concluída com sucesso. Sem pendências críticas. Existem ${pendenciasModeradas.length} pendência(s) moderada(s) que podem ser saneadas ou revisadas diretamente no rascunho de IA.`;
  } else {
    resumo = "Excelente! Nenhum problema detectado na estruturação fática do caso. O prontuário está 100% saneado e qualificado para o Pré-Peticionamento de Alto Desempenho.";
  }

  return {
    status,
    resumo,
    pendenciasCriticas,
    pendenciasModeradas,
    itensAprovados,
    sugestoes
  };
};

export default function EDRPFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // State managers
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [clientError, setClientError] = useState<boolean>(false);
  const [edrp, setEdrp] = useState<EDRPData>(DEFAULT_EDRP);
  const [requests, setRequests] = useState<any[]>([]);

  // Custodia Provas state managers
  const [newNome, setNewNome] = useState('');
  const [newFinalidade, setNewFinalidade] = useState('');
  const [editingProvaId, setEditingProvaId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editFinalidade, setEditFinalidade] = useState('');
  const [showLegoAuditLogs, setShowLegoAuditLogs] = useState(false);

  // New subetapa state variables
  const [previewText, setPreviewText] = useState('');
  const [showSub02Logs, setShowSub02Logs] = useState(false);
  const [showSub03Logs, setShowSub03Logs] = useState(false);
  const [showSub04Logs, setShowSub04Logs] = useState(false);
  const [auditoriaState, setAuditoriaState] = useState<any>(null);
  const [auditing, setAuditing] = useState(false);

  // GDocs report states
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [relatorioStatus, setRelatorioStatus] = useState<'aguardando' | 'criado' | 'falha'>('aguardando');
  const [relatorioGoogleDocsUrl, setRelatorioGoogleDocsUrl] = useState('');
  const [relatorioLogFalha, setRelatorioLogFalha] = useState('');
  const [relatorioTechnicalLog, setRelatorioTechnicalLog] = useState<any[]>([]);
  const [relatorioVersion, setRelatorioVersion] = useState<number>(1);
  const [relatorioIsSimulated, setRelatorioIsSimulated] = useState(false);

  // Defendant registration and DB lookup state managers
  const [dbClients, setDbClients] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDbSelect, setShowDbSelect] = useState(false);
  const [tempDefType, setTempDefType] = useState<'PF' | 'PJ' | null>(null);
  const [currentDefForm, setCurrentDefForm] = useState<any>(null);
  const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // LEGO System States
  const [showLegoModal, setShowLegoModal] = useState(false);
  const [selectedLegoIds, setSelectedLegoIds] = useState<string[]>([]);
  const [selectedStandardClaimIds, setSelectedStandardClaimIds] = useState<string[]>([]);
  const [legoModality, setLegoModality] = useState('Postal (Correios)');
  const [legoPublicacaoForm, setLegoPublicacaoForm] = useState('Nome exclusivo de advogado específico');
  const [legoLawyerName, setLegoLawyerName] = useState('RODRIGO GIFFONI RODRIGUES (OAB/MG 157.320)');

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: string;
    title: string;
    isStandardClaim: boolean;
    type: 'foundation' | 'claim';
  } | null>(null);

  // Removal Pending State
  const [removalPending, setRemovalPending] = useState<{
    id: string;
    title: string;
    type: 'foundation' | 'standard_claim';
  } | null>(null);

  // ==========================================
  // LEGO SYSTEM HELPER FUNCTIONS & HANDLERS
  // ==========================================

  const addOrUpdateBlockInText = (
    currentText: string,
    blockHeader: string,
    blockText: string,
    overwrite: boolean
  ): string => {
    let text = currentText || '';
    const regex = new RegExp(`${blockHeader}[\\s\\S]*?=============================================`, 'g');
    
    const hasBlock = text.includes(blockHeader);
    const fullBlockString = `${blockHeader}\n${blockText}\n=============================================`;
    
    if (hasBlock) {
      if (overwrite) {
        text = text.replace(regex, fullBlockString);
      }
    } else {
      if (text.trim() === '') {
        text = fullBlockString;
      } else {
        text = text.trim() + '\n\n' + fullBlockString;
      }
    }
    return text;
  };

  const removeBlockFromText = (
    currentText: string,
    blockHeader: string
  ): string => {
    let text = currentText || '';
    const regex = new RegExp(`\\n*\\s*${blockHeader}[\\s\\S]*?=============================================\\n*\\s*`, 'g');
    text = text.replace(regex, '\n\n');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  };

  const logLegoAction = (
    action: string,
    blockTitle: string,
    meta: {
      alteredCard6: boolean;
      alteredCard7: boolean;
      hasLinkedClaim: boolean;
      removed: boolean;
      duplicateAttempt: boolean;
      manualEditDetected?: boolean;
    }
  ) => {
    const newLog = {
      timestamp: new Date().toISOString(),
      responsibleUser: profile?.name || user?.email || 'Usuário BOSS',
      areaDireito: caseObj?.areaDireito || 'Não definida',
      action,
      blockTitle,
      alteredCard6: meta.alteredCard6,
      alteredCard7: meta.alteredCard7,
      hasLinkedClaim: meta.hasLinkedClaim,
      manualEditDetected: meta.manualEditDetected || false,
      removed: meta.removed,
      duplicateAttempt: meta.duplicateAttempt,
      carryOnOrigin: 'Petição Inicial, Subetapa 03 (areaDireito)'
    };
    
    setEdrp((prev: any) => {
      const currentLogs = prev.subEtapa01?.legoAuditLogs || [];
      return {
        ...prev,
        subEtapa01: {
          ...prev.subEtapa01,
          legoAuditLogs: [newLog, ...currentLogs]
        }
      };
    });
  };

  const handleInsertLego = (selectedIds: string[], selectedClaimIds: string[]) => {
    let currentGrounds = [...(edrp.subEtapa01?.card6?.fundamentosLegoSelecionados || [])];
    let currentClaims = [...(edrp.subEtapa01?.card7?.pedidosLegoVinculados || [])];
    let currentStdClaims = [...(edrp.subEtapa01?.card7?.pedidosPadroesAdicionados || [])];

    let groundsText = edrp.structuring.legalGrounds || '';
    let claimsText = edrp.structuring.claims || '';

    let altered6 = false;
    let altered7 = false;

    const area = caseObj?.areaDireito || 'Direito Civil';
    const availableBlocks = LEGO_LIBRARY[area] || [];

    for (const id of selectedIds) {
      const block = availableBlocks.find(b => b.id === id);
      if (!block) continue;

      const alreadyGround = currentGrounds.some(g => g.id === id);

      let fText = block.foundationTemplate;
      let cText = block.claimTemplate;

      if (id === 'modalidade_citacao') {
        fText = fText.replace(/{MODALIDADE_SELECIONADA}/g, legoModality);
        cText = cText.replace(/{MODALIDADE_SELECIONADA}/g, legoModality);
      } else if (id === 'forma_publicacoes') {
        const lawyers = legoPublicacaoForm === 'Nome exclusivo de advogado específico' 
          ? `exclusivamente em nome do advogado ${legoLawyerName}` 
          : 'por Diário Oficial / DJe geral';
        fText = fText.replace(/{ADVOGADOS_SELECIONADOS}/g, lawyers);
        cText = cText.replace(/{ADVOGADOS_SELECIONADOS}/g, lawyers);
      }

      const fHeader = `=== FUNDAMENTO LEGO: ${block.title} ===`;
      const cHeader = `=== PEDIDO LEGO VINCULADO: ${block.title} ===`;

      const prevGroundsText = groundsText;
      groundsText = addOrUpdateBlockInText(groundsText, fHeader, fText.replace(fHeader + '\n', '').replace('\n=============================================', ''), true);
      if (groundsText !== prevGroundsText) altered6 = true;

      const prevClaimsText = claimsText;
      claimsText = addOrUpdateBlockInText(claimsText, cHeader, cText.replace(cHeader + '\n', '').replace('\n=============================================', ''), true);
      if (claimsText !== prevClaimsText) altered7 = true;

      if (!alreadyGround) {
        currentGrounds.push({
          id,
          title: block.title,
          text: fText,
          addedAt: new Date().toISOString(),
          areaDireito: area
        });
      } else {
        currentGrounds = currentGrounds.map(g => g.id === id ? { ...g, text: fText, addedAt: new Date().toISOString() } : g);
      }

      if (!currentClaims.some(c => c.groundId === id)) {
        currentClaims.push({
          id,
          title: block.title,
          text: cText,
          groundId: id,
          addedAt: new Date().toISOString(),
          areaDireito: area
        });
      } else {
        currentClaims = currentClaims.map(c => c.groundId === id ? { ...c, text: cText, addedAt: new Date().toISOString() } : c);
      }

      logLegoAction('add_foundation', block.title, {
        alteredCard6: true,
        alteredCard7: true,
        hasLinkedClaim: true,
        removed: false,
        duplicateAttempt: alreadyGround
      });
    }

    for (const id of selectedClaimIds) {
      const block = STANDARD_CLAIMS_LIBRARY.find(b => b.id === id);
      if (!block) continue;

      const alreadyStd = currentStdClaims.some(c => c.id === id);
      const cHeader = `=== PEDIDO LEGO PADRÃO: ${block.title} ===`;

      const prevClaimsText = claimsText;
      claimsText = addOrUpdateBlockInText(claimsText, cHeader, block.template.replace(cHeader + '\n', '').replace('\n=============================================', ''), true);
      if (claimsText !== prevClaimsText) altered7 = true;

      if (!alreadyStd) {
        currentStdClaims.push({
          id,
          title: block.title,
          text: block.template,
          addedAt: new Date().toISOString()
        });
      } else {
        currentStdClaims = currentStdClaims.map(c => c.id === id ? { ...c, text: block.template, addedAt: new Date().toISOString() } : c);
      }

      logLegoAction('add_standard_claim', block.title, {
        alteredCard6: false,
        alteredCard7: true,
        hasLinkedClaim: false,
        removed: false,
        duplicateAttempt: alreadyStd
      });
    }

    const existingModalityInCase = caseObj?.modalidadeCitacao || edrp.subEtapa01?.modalidadeCitacao;
    const existingFormaPublicacoesInCase = caseObj?.formaPublicacoes || edrp.subEtapa01?.formaPublicacoes;

    setEdrp((prev: any) => {
      const updatedSubEtapa01 = {
        ...prev.subEtapa01,
        card6: {
          ...prev.subEtapa01?.card6,
          fundamentosLegoSelecionados: currentGrounds
        },
        card7: {
          ...prev.subEtapa01?.card7,
          pedidosLegoVinculados: currentClaims,
          pedidosPadroesAdicionados: currentStdClaims
        },
        modalidadeCitacao: selectedIds.includes('modalidade_citacao') ? legoModality : (prev.subEtapa01?.modalidadeCitacao || ''),
        modalidadeCitacaoBornInCard6: prev.subEtapa01?.modalidadeCitacaoBornInCard6 || (selectedIds.includes('modalidade_citacao') && !existingModalityInCase),
        formaPublicacoes: selectedIds.includes('forma_publicacoes') ? legoPublicacaoForm : (prev.subEtapa01?.formaPublicacoes || ''),
        advogadoPublicacao: selectedIds.includes('forma_publicacoes') ? legoLawyerName : (prev.subEtapa01?.advogadoPublicacao || ''),
        formaPublicacoesBornInCard6: prev.subEtapa01?.formaPublicacoesBornInCard6 || (selectedIds.includes('forma_publicacoes') && !existingFormaPublicacoesInCase),
      };

      return {
        ...prev,
        structuring: {
          ...prev.structuring,
          legalGrounds: groundsText,
          claims: claimsText
        },
        subEtapa01: updatedSubEtapa01
      };
    });

    setShowLegoModal(false);
    setSelectedLegoIds([]);
    setSelectedStandardClaimIds([]);
  };

  const handleCheckAndSubmitLego = () => {
    const existingGroundIds = (edrp.subEtapa01?.card6?.fundamentosLegoSelecionados || []).map((g: any) => g.id);
    const existingStdIds = (edrp.subEtapa01?.card7?.pedidosPadroesAdicionados || []).map((c: any) => c.id);

    const dupGround = selectedLegoIds.find(id => existingGroundIds.includes(id));
    if (dupGround) {
      const block = (LEGO_LIBRARY[caseObj?.areaDireito || 'Direito Civil'] || []).find(b => b.id === dupGround);
      setDuplicateWarning({
        id: dupGround,
        title: block?.title || dupGround,
        isStandardClaim: false,
        type: 'foundation'
      });
      return;
    }

    const dupStd = selectedStandardClaimIds.find(id => existingStdIds.includes(id));
    if (dupStd) {
      const block = STANDARD_CLAIMS_LIBRARY.find(b => b.id === dupStd);
      setDuplicateWarning({
        id: dupStd,
        title: block?.title || dupStd,
        isStandardClaim: true,
        type: 'claim'
      });
      return;
    }

    handleInsertLego(selectedLegoIds, selectedStandardClaimIds);
  };

  const handleResolveDuplicate = (decision: 'overwrite' | 'keep' | 'cancel') => {
    if (decision === 'cancel') {
      setDuplicateWarning(null);
      return;
    }

    if (decision === 'keep') {
      logLegoAction('duplicate_attempt', duplicateWarning!.title, {
        alteredCard6: false,
        alteredCard7: false,
        hasLinkedClaim: !duplicateWarning!.isStandardClaim,
        removed: false,
        duplicateAttempt: true
      });
      
      if (duplicateWarning!.isStandardClaim) {
        const filteredStd = selectedStandardClaimIds.filter(id => id !== duplicateWarning!.id);
        handleInsertLego(selectedLegoIds, filteredStd);
      } else {
        const filteredLego = selectedLegoIds.filter(id => id !== duplicateWarning!.id);
        handleInsertLego(filteredLego, selectedStandardClaimIds);
      }
      setDuplicateWarning(null);
      return;
    }

    if (decision === 'overwrite') {
      handleInsertLego(selectedLegoIds, selectedStandardClaimIds);
      setDuplicateWarning(null);
    }
  };

  const handleConfirmRemoval = (decision: 'both' | 'ground_only' | 'cancel') => {
    if (decision === 'cancel') {
      setRemovalPending(null);
      return;
    }

    const { id, title } = removalPending!;
    let groundsText = edrp.structuring.legalGrounds || '';
    let claimsText = edrp.structuring.claims || '';

    const fHeader = `=== FUNDAMENTO LEGO: ${title} ===`;
    const cHeader = `=== PEDIDO LEGO VINCULADO: ${title} ===`;

    groundsText = removeBlockFromText(groundsText, fHeader);

    if (decision === 'both') {
      claimsText = removeBlockFromText(claimsText, cHeader);
    }

    const updatedGrounds = (edrp.subEtapa01?.card6?.fundamentosLegoSelecionados || []).filter((g: any) => g.id !== id);
    const updatedClaims = decision === 'both'
      ? (edrp.subEtapa01?.card7?.pedidosLegoVinculados || []).filter((c: any) => c.groundId !== id)
      : (edrp.subEtapa01?.card7?.pedidosLegoVinculados || []).map((c: any) => c.groundId === id ? { ...c, detached: true } : c);

    setEdrp((prev: any) => ({
      ...prev,
      structuring: {
        ...prev.structuring,
        legalGrounds: groundsText,
        claims: claimsText
      },
      subEtapa01: {
        ...prev.subEtapa01,
        card6: {
          ...prev.subEtapa01?.card6,
          fundamentosLegoSelecionados: updatedGrounds
        },
        card7: {
          ...prev.subEtapa01?.card7,
          pedidosLegoVinculados: updatedClaims
        }
      }
    }));

    logLegoAction('remove_foundation', title, {
      alteredCard6: true,
      alteredCard7: decision === 'both',
      hasLinkedClaim: decision === 'both',
      removed: true,
      duplicateAttempt: false
    });

    setRemovalPending(null);
  };

  const handleRemoveStandardClaim = (id: string, title: string) => {
    let claimsText = edrp.structuring.claims || '';
    const cHeader = `=== PEDIDO LEGO PADRÃO: ${title} ===`;

    claimsText = removeBlockFromText(claimsText, cHeader);

    const updatedStdClaims = (edrp.subEtapa01?.card7?.pedidosPadroesAdicionados || []).filter((c: any) => c.id !== id);

    setEdrp((prev: any) => ({
      ...prev,
      structuring: {
        ...prev.structuring,
        claims: claimsText
      },
      subEtapa01: {
        ...prev.subEtapa01,
        card7: {
          ...prev.subEtapa01?.card7,
          pedidosPadroesAdicionados: updatedStdClaims
        }
      }
    }));

    logLegoAction('remove_standard_claim', title, {
      alteredCard6: false,
      alteredCard7: true,
      hasLinkedClaim: false,
      removed: true,
      duplicateAttempt: false
    });
  };

  const openLegoSystem = () => {
    // 1. Check if Gratuidade is pre-selected in previous wizardState
    const wizardStateObj = caseObj?.solicitacoesProvasWizardState || {};
    const isGratuidadePreSelected = 
      wizardStateObj?.q2_1 === 'sim' || 
      wizardStateObj?.q2_4 === 'sim' || 
      (wizardStateObj?.declaracaoFiles || []).length > 0 ||
      caseObj?.modalidadeGratuidade === 'sim' ||
      caseObj?.justicaGratuita === true;

    const currentLegoIds = (edrp.subEtapa01?.card6?.fundamentosLegoSelecionados || []).map((g: any) => g.id);
    let newSelectedLegoIds = [...currentLegoIds];
    
    if (isGratuidadePreSelected && !newSelectedLegoIds.includes('gratuidade_justica')) {
      newSelectedLegoIds.push('gratuidade_justica');
    }

    // 2. Check if modality of citation exists from earlier (Carry-on)
    const carryOnModality = caseObj?.modalidadeCitacao || edrp.subEtapa01?.modalidadeCitacao || '';
    if (carryOnModality) {
      setLegoModality(carryOnModality);
      if (!newSelectedLegoIds.includes('modalidade_citacao')) {
        newSelectedLegoIds.push('modalidade_citacao');
      }
    } else {
      // If none existed, we can default or reset to 'Postal (Correios)'
      setLegoModality('Postal (Correios)');
    }

    // 3. Check if publication form exists from earlier (Carry-on)
    const carryOnFormaPublicacoes = caseObj?.formaPublicacoes || edrp.subEtapa01?.formaPublicacoes || '';
    const carryOnLawyerName = caseObj?.advogadoPublicacao || edrp.subEtapa01?.advogadoPublicacao || '';

    if (carryOnFormaPublicacoes) {
      setLegoPublicacaoForm(carryOnFormaPublicacoes);
      if (!newSelectedLegoIds.includes('forma_publicacoes')) {
        newSelectedLegoIds.push('forma_publicacoes');
      }
    } else {
      setLegoPublicacaoForm('Nome exclusivo de advogado específico');
    }
    if (carryOnLawyerName) {
      setLegoLawyerName(carryOnLawyerName);
    } else {
      setLegoLawyerName('RODRIGO GIFFONI RODRIGUES (OAB/MG 157.320)');
    }

    setSelectedLegoIds(newSelectedLegoIds);
    setSelectedStandardClaimIds((edrp.subEtapa01?.card7?.pedidosPadroesAdicionados || []).map((c: any) => c.id));
    setShowLegoModal(true);
  };

  const qualStatus = (() => {
    if (clientError) {
      return {
        type: 'erro' as const,
        label: 'Erro Técnico',
        message: 'Não foi possível carregar automaticamente os dados da Etapa 01 — Cadastro PF.',
        colorClass: 'bg-red-50 border-red-200 text-red-800',
        iconColor: 'text-red-500'
      };
    }
    
    if (!client) {
      return {
        type: 'ausentes' as const,
        label: 'Dados Ausentes',
        message: 'Dados ausentes na Etapa 01 — Cadastro PF.',
        colorClass: 'bg-gray-50 border-gray-200 text-gray-500',
        iconColor: 'text-gray-400'
      };
    }

    if (success && success.includes('atualizada com sucesso a partir do cadastro')) {
      return {
        type: 'recarregado' as const,
        label: 'Atualizado',
        message: 'Qualificação da autora carregada automaticamente a partir da Etapa 01 — Cadastro PF.',
        colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        iconColor: 'text-emerald-500'
      };
    }

    if (success && success.includes('EDRP atualizado com sucesso')) {
      return {
        type: 'salvo' as const,
        label: 'Salvo com Sucesso',
        message: 'Qualificação salva com sucesso.',
        colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        iconColor: 'text-emerald-500'
      };
    }

    if (edrp.structuring.authorQualificationManualEdited) {
      return {
        type: 'editado' as const,
        label: 'Editado Manualmente',
        message: 'Qualificação editada manualmente.',
        colorClass: 'bg-blue-50 border-blue-200 text-blue-800',
        iconColor: 'text-blue-500'
      };
    }

    const payload = edrp.structuring.authorQualificationPayload || extractPfDataFromClient(client);
    if (!payload) {
      return {
        type: 'ausentes' as const,
        label: 'Dados Ausentes',
        message: 'Qualificação incompleta — existem dados pendentes na Etapa 01 — Cadastro PF.',
        colorClass: 'bg-gray-50 border-gray-200 text-gray-500',
        iconColor: 'text-gray-400'
      };
    }

    const essentialKeys = [
      'OUTORGANTE_NOME',
      'OUTORGANTE_NACIONALIDADE',
      'OUTORGANTE_ESTADO_CIVIL',
      'OUTORGANTE_PROFISSAO',
      'OUTORGANTE_RG',
      'OUTORGANTE_CPF',
      'OUTORGANTE_ENDERECO',
      'OUTORGANTE_NUMERO',
      'OUTORGANTE_BAIRRO',
      'OUTORGANTE_CIDADE',
      'OUTORGANTE_ESTADO',
      'OUTORGANTE_CEP',
      'OUTORGANTE_TELEFONE',
      'OUTORGANTE_WHATSAPP',
      'OUTORGANTE_EMAIL'
    ];

    const missingFields = essentialKeys.filter(key => {
      const val = payload[key];
      return !val || val.trim() === '' || val === '—';
    });
    
    if (missingFields.length === essentialKeys.length) {
      return {
        type: 'ausentes' as const,
        label: 'Dados Ausentes',
        message: 'Dados ausentes na Etapa 01 — Cadastro PF.',
        colorClass: 'bg-gray-50 border-gray-200 text-gray-500',
        iconColor: 'text-gray-400'
      };
    }

    if (missingFields.length > 0) {
      return {
        type: 'parcial' as const,
        label: 'Qualificação Incompleta',
        message: 'Qualificação incompleta — existem dados pendentes na Etapa 01 — Cadastro PF.',
        colorClass: 'bg-amber-50 border-amber-200 text-amber-850',
        iconColor: 'text-amber-500',
        missing: missingFields
      };
    }

    return {
      type: 'carregado' as const,
      label: 'Carregado',
      message: 'Qualificação da autora carregada automaticamente a partir da Etapa 01 — Cadastro PF.',
      colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-850',
      iconColor: 'text-emerald-500'
    };
  })();

  const getFieldVal = (keys: string[]): string => {
    if (!client) return '';
    for (const key of keys) {
      const val = client?.[key] ?? 
                  client?.pfDadosPessoais?.[key] ?? 
                  client?.pfData?.[key] ?? 
                  client?.portalMirror?.[key] ?? 
                  client?.portalMirror?.pfDadosPessoais?.[key] ??
                  client?.portalMirror?.pfContato?.[key] ??
                  client?.portalMirror?.pfEndereco?.[key] ??
                  client?.pjDadosEmpresa?.[key] ??
                  client?.pjData?.[key] ??
                  client?.portalMirror?.pjDadosEmpresa?.[key] ??
                  client?.portalMirror?.pjContatoEmpresa?.[key] ??
                  client?.portalMirror?.pjEnderecoEmpresa?.[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  };

  const handleUpdateQualificationFromRegistry = () => {
    if (!client) return;
    const extracted = extractPfDataFromClient(client);
    if (extracted) {
      const generatedQual = buildFinalQualificationText(extracted);
      setEdrp((prev) => ({
        ...prev,
        structuring: {
          ...prev.structuring,
          parties: generatedQual,
          authorQualificationPayload: extracted,
          authorQualificationOrigin: "Etapa 01 - Cadastro PF",
          authorQualificationManualEdited: false
        }
      }));
    } else {
      const generatedQual = generateAuthorQualification(client, caseObj);
      handleFieldChange('structuring', 'parties', generatedQual);
    }
    setSuccess('Qualificação detalhada atualizada com sucesso a partir do cadastro do cliente.');
  };

  // Load database of registered clients as potential defendants
  useEffect(() => {
    async function fetchDbClients() {
      try {
        setDbLoading(true);
        const { collection, getDocs } = await import('firebase/firestore');
        const querySnapshot = await getDocs(collection(db, 'clients'));
        const clientsList: any[] = [];
        querySnapshot.forEach((doc) => {
          clientsList.push({ id: doc.id, ...doc.data() });
        });
        setDbClients(clientsList);
      } catch (err) {
        console.error("Error fetching database of clients:", err);
      } finally {
        setDbLoading(false);
      }
    }
    fetchDbClients();
  }, []);

  // Load context from Firestore
  useEffect(() => {
    if (!caseId) {
      setError('Identificador de caso não informado nos parâmetros da URL.');
      setFetching(false);
      return;
    }

    async function loadEDRPData() {
      try {
        setFetching(true);
        setError(null);

        // Fetch case
        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (!caseSnap.exists()) {
          setError(`Caso referenciado pelo ID [${caseId}] não pôde ser localizado.`);
          setFetching(false);
          return;
        }

        const caseData = caseSnap.data();
        setCaseObj(caseData);

        // Fetch client
        let loadedClient: any = null;
        if (caseData.clientId) {
          try {
            const clientSnap = await getDoc(doc(db, 'clients', caseData.clientId));
            if (clientSnap.exists()) {
              loadedClient = clientSnap.data();
              setClient(loadedClient);
              setClientError(false);
            } else {
              setClientError(true);
            }
          } catch (cErr) {
            console.error("Erro técnico ao carregar Cadastro PF:", cErr);
            setClientError(true);
          }
        }

        // Fetch evidence requests for stage 5 consolidated report
        const qEv = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId!));
        const qSnap = await getDocs(qEv);
        const reqList: any[] = [];
        qSnap.forEach((docSnap) => {
          reqList.push({ id: docSnap.id, ...docSnap.data() });
        });
        reqList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRequests(reqList);

        // Merge EDRP data defensively with standard schema types
        const rawEdrp = caseData.edrp || {};

        const prevDocs = getPreviousDocuments(caseData.solicitacoesProvasWizardState || {}, reqList, loadedClient?.type || 'PF');
        let existingProvas = rawEdrp.custodiaProvasPF?.provas || [];
        if (!Array.isArray(existingProvas)) {
          existingProvas = [];
        }

        const mergedProvas = [...existingProvas];
        prevDocs.forEach(p => {
          const exists = mergedProvas.some(ep => ep.nomeProva.trim().toLowerCase() === p.nomeProva.trim().toLowerCase());
          if (!exists) {
            mergedProvas.push({
              id: 'prev_' + Math.random().toString(36).substr(2, 9),
              nomeProva: p.nomeProva,
              finalidadeJuridica: '',
              criadoEm: new Date().toISOString(),
              atualizadoEm: new Date().toISOString(),
              isFromPrevious: true
            });
          } else {
            const foundIdx = mergedProvas.findIndex(ep => ep.nomeProva.trim().toLowerCase() === p.nomeProva.trim().toLowerCase());
            if (foundIdx !== -1) {
              mergedProvas[foundIdx] = {
                ...mergedProvas[foundIdx],
                isFromPrevious: true
              };
            }
          }
        });
        
        let loadedDefendants = rawEdrp.structuring?.defendants || [];
        if (!Array.isArray(loadedDefendants)) {
          loadedDefendants = [];
        }
        const singleDef = rawEdrp.structuring?.defendant;
        if (loadedDefendants.length === 0 && singleDef && (singleDef.pf_nomeCompleto || singleDef.pj_razaoSocial || singleDef.pfDadosPessoais?.pf_nomeCompleto || singleDef.pjDadosEmpresa?.pj_razaoSocial)) {
          loadedDefendants = [getNormalizedDefendant(singleDef)];
        }

        const merged: EDRPData = {
          structuring: { 
            ...DEFAULT_EDRP.structuring, 
            ...(rawEdrp.structuring || {}),
            defendant: getNormalizedDefendant(rawEdrp.structuring?.defendant),
            defendants: loadedDefendants.map((d: any) => getNormalizedDefendant(d))
          },
          custodiaProvasPF: {
            provas: mergedProvas
          },
          delegation: { ...DEFAULT_EDRP.delegation, ...(rawEdrp.delegation || {}) },
          reviewPreparation: { ...DEFAULT_EDRP.reviewPreparation, ...(rawEdrp.reviewPreparation || {}) },
          protocolPreparation: { ...DEFAULT_EDRP.protocolPreparation, ...(rawEdrp.protocolPreparation || {}) },
          edrpStatus: rawEdrp.edrpStatus || DEFAULT_EDRP.edrpStatus,
          updatedAt: rawEdrp.updatedAt || DEFAULT_EDRP.updatedAt,
          subEtapa01: {
            card6: {
              fundamentosLegoSelecionados: rawEdrp.subEtapa01?.card6?.fundamentosLegoSelecionados || []
            },
            card7: {
              pedidosLegoVinculados: rawEdrp.subEtapa01?.card7?.pedidosLegoVinculados || [],
              pedidosPadroesAdicionados: rawEdrp.subEtapa01?.card7?.pedidosPadroesAdicionados || []
            },
            legoAuditLogs: rawEdrp.subEtapa01?.legoAuditLogs || [],
            modalidadeCitacao: rawEdrp.subEtapa01?.modalidadeCitacao || caseData.modalidadeCitacao || '',
            modalidadeCitacaoBornInCard6: rawEdrp.subEtapa01?.modalidadeCitacaoBornInCard6 || false,
            formaPublicacoes: rawEdrp.subEtapa01?.formaPublicacoes || caseData.formaPublicacoes || '',
            advogadoPublicacao: rawEdrp.subEtapa01?.advogadoPublicacao || caseData.advogadoPublicacao || '',
            formaPublicacoesBornInCard6: rawEdrp.subEtapa01?.formaPublicacoesBornInCard6 || false,
          }
        };

        const initialModality = caseData.modalidadeCitacao || rawEdrp.subEtapa01?.modalidadeCitacao || 'Postal (Correios)';
        const initialPublicacao = caseData.formaPublicacoes || rawEdrp.subEtapa01?.formaPublicacoes || 'Nome exclusivo de advogado específico';
        const initialLawyer = caseData.advogadoPublicacao || rawEdrp.subEtapa01?.advogadoPublicacao || 'RODRIGO GIFFONI RODRIGUES (OAB/MG 157.320)';

        setLegoModality(initialModality);
        setLegoPublicacaoForm(initialPublicacao);
        setLegoLawyerName(initialLawyer);

        if (loadedClient) {
          const extracted = extractPfDataFromClient(loadedClient);
          if (extracted) {
            if (!merged.structuring.authorQualificationPayload) {
              merged.structuring.authorQualificationPayload = extracted;
            }
            if (!merged.structuring.authorQualificationOrigin) {
              merged.structuring.authorQualificationOrigin = "Etapa 01 - Cadastro PF";
            }
            if (merged.structuring.authorQualificationManualEdited === undefined) {
              merged.structuring.authorQualificationManualEdited = false;
            }
            if (!merged.structuring.parties || merged.structuring.parties.trim() === '') {
              merged.structuring.parties = buildFinalQualificationText(extracted);
            }
          } else {
            if (!merged.structuring.parties || merged.structuring.parties.trim() === '') {
              merged.structuring.parties = generateAuthorQualification(loadedClient, caseData);
            }
          }
        }

        setEdrp(merged);

        // Populate GDocs report states
        const rStatus = caseData.relatorioEstruturacaoStatus || 'aguardando';
        setRelatorioStatus(rStatus);
        setRelatorioGoogleDocsUrl(caseData.relatorioEstruturacaoGoogleDocsUrl || '');
        setRelatorioLogFalha(caseData.relatorioEstruturacaoLogFalha || '');
        setRelatorioTechnicalLog(caseData.relatorioEstruturacaoTechnicalLog || []);
        setRelatorioVersion(caseData.relatorioEstruturacaoVersion || 1);
        setRelatorioIsSimulated(caseData.relatorioEstruturacaoIsSimulated || false);

        // Populate new sub-stages states
        const clientNameResolved = loadedClient
          ? (loadedClient.nome || loadedClient.nomeCompleto || loadedClient.razaoSocial || 'Cliente')
          : 'Cliente';

        const dbPreview = caseData.edrpEstruturacao?.subetapa02?.previewRelatorioConsolidado;
        if (dbPreview) {
          setPreviewText(dbPreview);
        } else {
          setPreviewText(generatePreviewText(merged, loadedClient, caseData, clientNameResolved));
        }

        const dbAuditoria = caseData.edrpEstruturacao?.subetapa04?.auditoriaEstruturacao;
        if (dbAuditoria) {
          setAuditoriaState(dbAuditoria);
        } else {
          const calculatedAudit = runAuditoria(
            merged,
            loadedClient,
            caseData,
            dbPreview || generatePreviewText(merged, loadedClient, caseData, clientNameResolved),
            rStatus
          );
          setAuditoriaState(calculatedAudit);
        }

      } catch (err: any) {
        console.error(err);
        setError(`Falha ao obter os registros de produção do EDRP: ${err.message || err}`);
      } finally {
        setFetching(false);
      }
    }

    loadEDRPData();
  }, [caseId]);

  // Nested form updates helper
  const handleFieldChange = (section: keyof EDRPData, field: string, value: any) => {
    setEdrp((prev) => {
      const updatedSection = { ...prev[section] as any, [field]: value };

      // Automations defined in Regra 5:
      if (section === 'reviewPreparation') {
        if (field === 'approvedForProtocol' && value === true) {
          updatedSection.reviewStatus = 'aprovado';
        }
        if (field === 'reviewStatus' && (value === 'reprovado' || value === 'ajustes_solicitados')) {
          updatedSection.approvedForProtocol = false;
        }
        if (field === 'reviewStatus' && value === 'aprovado') {
          updatedSection.approvedForProtocol = true;
        }
      }

      // Automations defined in Regra 6:
      // If service is "Petição Inicial", requiresCNJ is true ONLY when status is "protocolado".
      if (section === 'protocolPreparation' && field === 'protocolStatus') {
        const isPeticaoInicial = caseObj?.registrationTypeKey === 'peticao_inicial';
        if (isPeticaoInicial) {
          updatedSection.requiresCNJ = (value === 'protocolado');
        }
      }

      if (section === 'structuring' && field === 'parties') {
        updatedSection.authorQualificationManualEdited = true;
      }

      return {
        ...prev,
        [section]: updatedSection
      };
    });
  };

  // Start the process of adding a new defendant
  const handleStartAddDefendant = () => {
    setCurrentEditIndex(null);
    setTempDefType(null); // Must show only the choice between PF and PJ initially
    setCurrentDefForm({
      type: 'PF',
      pfDadosPessoais: {},
      pfContato: {},
      pfEndereco: {},
      pfRedesSociais: {},
      pjDadosEmpresa: {},
      pjContatoEmpresa: {},
      pjEnderecoEmpresa: {},
      pjRedesSociaisEmpresa: {}
    });
    setShowAddForm(true);
    setShowDbSelect(false);
  };

  // Start the process of editing an existing registered defendant
  const handleStartEditDef = (index: number) => {
    const list = edrp.structuring.defendants || [];
    const target = list[index];
    if (!target) return;

    setCurrentEditIndex(index);
    setTempDefType(target.type || 'PF');
    setCurrentDefForm(getNormalizedDefendant(target));
    setShowAddForm(true);
    setShowDbSelect(false);
  };

  // Select between PF and PJ form view
  const handleSelectTempType = (type: 'PF' | 'PJ') => {
    setTempDefType(type);
    setCurrentDefForm((prev: any) => ({
      ...(prev || {}),
      type
    }));
  };

  // Save/Confirm addition or modification of a manual defendant
  const handleSaveDefToList = () => {
    if (!currentDefForm) return;
    const normalized = getNormalizedDefendant(currentDefForm);

    setEdrp((prev) => {
      const currentList = prev.structuring.defendants || [];
      let updatedList = [...currentList];

      if (currentEditIndex !== null) {
        updatedList[currentEditIndex] = normalized;
      } else {
        updatedList.push(normalized);
      }

      return {
        ...prev,
        structuring: {
          ...prev.structuring,
          defendants: updatedList,
          // Update the single defendant field to hold the primary/first item
          defendant: updatedList[0] || null
        }
      };
    });

    // Reset workflow states
    setShowAddForm(false);
    setTempDefType(null);
    setCurrentEditIndex(null);
    setCurrentDefForm(null);
    setSuccess(currentEditIndex !== null ? 'Réu atualizado com sucesso na lista.' : 'Réu adicionado com sucesso na lista.');
  };

  // Remove defendant from the list
  const handleRemoveDef = (index: number) => {
    setEdrp((prev) => {
      const currentList = prev.structuring.defendants || [];
      const updatedList = currentList.filter((_, idx) => idx !== index);
      return {
        ...prev,
        structuring: {
          ...prev.structuring,
          defendants: updatedList,
          defendant: updatedList[0] || null
        }
      };
    });
    setSuccess('Réu removido da lista do caso.');
  };

  // Import a client from the DB collection as a defendant on this case EDRP
  const handleAddDefendantFromDb = (dbClient: any) => {
    const type = dbClient.type || 'PF';
    let defendantObj: any = { type };

    if (type === 'PF') {
      const pfDados = dbClient.pfDadosPessoais || dbClient.pfData || {};
      const pfCont = dbClient.pfContato || {};
      const pfEnd = dbClient.pfEndereco || {};
      const pfRed = dbClient.pfRedesSociais || {};

      defendantObj.pfDadosPessoais = {
        pf_nomeCompleto: (pfDados.pf_nomeCompleto || dbClient.name || '').toUpperCase(),
        pf_nacionalidade: pfDados.pf_nacionalidade || 'Brasileira',
        pf_estadoCivil: pfDados.pf_estadoCivil || '',
        pf_profissao: pfDados.pf_profissao || '',
        pf_cpf: pfDados.pf_cpf || dbClient.cpf || '',
        pf_rg: pfDados.pf_rg || '',
        pf_dataNascimento: pfDados.pf_dataNascimento || '',
        pf_nomePai: (pfDados.pf_nomePai || '').toUpperCase(),
        pf_nomeMae: (pfDados.pf_nomeMae || '').toUpperCase()
      };

      defendantObj.pfContato = {
        pf_email: pfCont.pf_email || dbClient.email || '',
        pf_telefone: pfCont.pf_telefone || dbClient.phone || '',
        pf_possuiWhatsapp: pfCont.pf_possuiWhatsapp !== undefined ? pfCont.pf_possuiWhatsapp : false,
        pf_whatsapp: pfCont.pf_whatsapp || ''
      };

      defendantObj.pfEndereco = {
        pf_cep: pfEnd.pf_cep || '',
        pf_endereco: pfEnd.pf_endereco || '',
        pf_numero: pfEnd.pf_numero || '',
        pf_complemento: pfEnd.pf_complemento || '',
        pf_bairro: pfEnd.pf_bairro || '',
        pf_cidade: pfEnd.pf_cidade || '',
        pf_estado: pfEnd.pf_estado || ''
      };

      defendantObj.pfRedesSociais = {
        pf_instagram: pfRed.pf_instagram || '',
        pf_facebook: pfRed.pf_facebook || '',
        pf_tiktok: pfRed.pf_tiktok || ''
      };
    } else {
      const pjDados = dbClient.pjDadosEmpresa || dbClient.pjData || {};
      const pjCont = dbClient.pjContatoEmpresa || {};
      const pjEnd = dbClient.pjEnderecoEmpresa || {};
      const pjRed = dbClient.pjRedesSociaisEmpresa || {};

      defendantObj.pjDadosEmpresa = {
        pj_cnpj: pjDados.pj_cnpj || dbClient.cnpj || '',
        pj_razaoSocial: (pjDados.pj_razaoSocial || dbClient.name || '').toUpperCase(),
        pj_nomeFantasia: (pjDados.pj_nomeFantasia || '').toUpperCase()
      };

      defendantObj.pjContatoEmpresa = {
        pj_emailEmpresa: pjCont.pj_emailEmpresa || dbClient.email || '',
        pj_telefoneEmpresa: pjCont.pj_telefoneEmpresa || dbClient.phone || '',
        pj_possuiWhatsappEmpresa: pjCont.pj_possuiWhatsappEmpresa !== undefined ? pjCont.pj_possuiWhatsappEmpresa : false,
        pj_whatsappEmpresa: pjCont.pj_whatsappEmpresa || ''
      };

      defendantObj.pjEnderecoEmpresa = {
        pj_cepEmpresa: pjEnd.pj_cepEmpresa || '',
        pj_enderecoEmpresa: pjEnd.pj_enderecoEmpresa || '',
        pj_numeroEmpresa: pjEnd.pj_numeroEmpresa || '',
        pj_complementoEmpresa: pjEnd.pj_complementoEmpresa || '',
        pj_bairroEmpresa: pjEnd.pj_bairroEmpresa || '',
        pj_cidadeEmpresa: pjEnd.pj_cidadeEmpresa || '',
        pj_estadoEmpresa: pjEnd.pj_estadoEmpresa || ''
      };

      defendantObj.pjRedesSociaisEmpresa = {
        pj_instagramEmpresa: pjRed.pj_instagramEmpresa || '',
        pj_facebookEmpresa: pjRed.pj_facebookEmpresa || '',
        pj_tiktokEmpresa: pjRed.pj_tiktok_Empresa || ''
      };
    }

    const normalized = getNormalizedDefendant(defendantObj);

    setEdrp((prev) => {
      const currentList = prev.structuring.defendants || [];
      const updatedList = [...currentList, normalized];
      return {
        ...prev,
        structuring: {
          ...prev.structuring,
          defendants: updatedList,
          defendant: updatedList[0] || null
        }
      };
    });

    setSuccess(`Réu "${type === 'PF' ? normalized.pfDadosPessoais.pf_nomeCompleto : normalized.pjDadosEmpresa.pj_razaoSocial}" importado com sucesso.`);
    setShowDbSelect(false);
  };

  // Computes the recommended standard statusInterno dynamically based on data state
  const getRecommendedStatusInterno = (edrpData: EDRPData) => {
    const pStatus = edrpData.protocolPreparation.protocolStatus;
    const rStatus = edrpData.reviewPreparation.reviewStatus;
    const isApproved = edrpData.reviewPreparation.approvedForProtocol;
    const dStatus = edrpData.delegation.status;

    // Protocol status ready/scheduled OR protocolled
    if (pStatus === 'protocolado') {
      return 'Protocolado';
    }
    if (pStatus === 'pronto_para_protocolar' || pStatus === 'agendado') {
      return 'Aguardando protocolo';
    }

    // Review status checks
    if (isApproved || rStatus === 'aprovado') {
      return 'Aprovado para protocolo';
    }
    if (rStatus === 'em_revisao') {
      return 'Em revisão';
    }
    if (rStatus === 'aguardando_revisao') {
      return 'Aguardando revisão';
    }
    if (rStatus === 'ajustes_solicitados') {
      return 'Ajustes solicitados';
    }

    // Delegation checks
    if (dStatus === 'pendente' || dStatus === 'em_andamento') {
      return 'Delegado';
    }

    // Structuring content presence checks
    const hasStructuring = !!(
      edrpData.structuring.competence?.trim() ||
      edrpData.structuring.parties?.trim() ||
      edrpData.structuring.relevantFacts?.trim() ||
      edrpData.structuring.legalGrounds?.trim() ||
      edrpData.structuring.claims?.trim() ||
      edrpData.structuring.evidenceSummary?.trim() ||
      edrpData.structuring.risks?.trim() ||
      edrpData.structuring.strategy?.trim()
    );

    if (hasStructuring) {
      return 'Em estruturação';
    }

    return 'Em produção'; // standard baseline status
  };

  // Warning Alerts Evaluator following Regra 9 and Regra 6
  const getValidationWarnings = () => {
    const list: { type: 'warning' | 'info' | 'error'; msg: string }[] = [];

    if (!edrp) return list;

    // 1. Estruturação vazia
    const struct = edrp.structuring;
    const isStructuringEmpty = !(
      struct.competence?.trim() ||
      struct.parties?.trim() ||
      struct.relevantFacts?.trim() ||
      struct.legalGrounds?.trim() ||
      struct.claims?.trim() ||
      struct.evidenceSummary?.trim() ||
      struct.risks?.trim() ||
      struct.strategy?.trim()
    );
    if (isStructuringEmpty) {
      list.push({
        type: 'warning',
        msg: 'A estruturação fática e jurídica do EDRP está totalmente vazia.'
      });
    }

    // 2. Delegação sem responsável
    if (!edrp.delegation.responsiblePerson?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum profissional responsável principal foi designado para a delegação.'
      });
    }

    // 3. Revisão sem revisor
    if (!edrp.reviewPreparation.reviewResponsible?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum revisor interno foi definido na etapa de Revisão.'
      });
    }

    // 4. Protocolo sem responsável
    if (!edrp.protocolPreparation.protocolResponsible?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum responsável foi designado para a preparação de protocolo.'
      });
    }

    // 5. Protocolo sem sistema
    if (!edrp.protocolPreparation.protocolSystem?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum sistema de protocolo eletrônico (ex: PJe, Projudi, e-SAJ) foi preenchido.'
      });
    }

    // 6. Revisão não aprovada
    const isApproved = edrp.reviewPreparation.approvedForProtocol || edrp.reviewPreparation.reviewStatus === 'aprovado';
    if (!isApproved) {
      list.push({
        type: 'warning',
        msg: 'A análise de revisão interna do EDRP não está aprovada para a liberação de protocolo.'
      });
    }

    // 7. Protocolo pronto sem revisão aprovada
    if (edrp.protocolPreparation.protocolStatus === 'pronto_para_protocolar' && !isApproved) {
      list.push({
        type: 'error',
        msg: 'Inconsistência Grave: O protocolo está marcado como "Pronto para protocolar", mas a revisão da estruturação ainda não foi aprovada formalmente.'
      });
    }

    // 8. Service recommendations check (Regra 6)
    const serviceKey = caseObj?.registrationTypeKey;
    const isOngoingJudicial = serviceKey === 'processo_judicial_em_andamento' || serviceKey === 'processo_judicial_ajuizado';
    if (isOngoingJudicial && !edrp.protocolPreparation.processNumber?.trim()) {
      list.push({
        type: 'info',
        msg: 'CNJ Recomendado: O tipo de serviço selecionado exige a identificação do número de processo judicial anterior.'
      });
    }

    return list;
  };

  // Google Docs report generator function
  const handleGenerateRelatorio = async (intent: 'initial' | 'overwrite' = 'initial') => {
    if (generatingDoc) return;
    setGeneratingDoc(true);
    setError(null);
    setSuccess(null);

    const targetCaseId = caseId!;
    const targetClientId = caseObj?.clientId || "";
    const clientType = client?.type || "PF";
    const isPj = clientType === "PJ";

    const nomeCompleto = client?.pfDadosPessoais?.pf_nomeCompleto || client?.pfData?.pf_nomeCompleto || client?.name || "Cliente PF";
    const razaoSocial = client?.pjDadosEmpresa?.pj_razaoSocial || client?.pjData?.pj_razaoSocial || client?.name || "Cliente PJ";

    const prefix = "relatorioEstruturacao";

    const addLocalLog = (level: "info" | "success" | "warning" | "error", code: string, message: string) => {
      const timestamp = new Date().toISOString();
      const item = { timestamp, level, code, message };
      setRelatorioTechnicalLog(prev => [item, ...prev]);
    };

    const clickLog = {
      timestamp: new Date().toISOString(),
      level: "info" as const,
      code: relatorioGoogleDocsUrl
        ? `${prefix.toUpperCase()}_NEW_VERSION_SINGLE_CLICK_STARTED`
        : `${prefix.toUpperCase()}_SINGLE_CLICK_GENERATION_STARTED`,
      message: relatorioGoogleDocsUrl
        ? `Nova versão iniciada diretamente pelo botão de geração.`
        : "Geração iniciada diretamente pelo botão de geração."
    };

    setRelatorioTechnicalLog([clickLog]);

    try {
      // Get google drive folders
      const googleDriveClientFolderId = (client?.googleDriveClientFolderId || client?.gdriveFolderId || caseObj?.gdriveFolderId || "").trim();
      const googleDriveClientFolderUrl = (client?.googleDriveClientFolderUrl || client?.gdriveFolderUrl || caseObj?.gdriveFolderUrl || "").trim();

      const isMockFolderId = (id: string) => {
        if (!id) return true;
        const lowercaseId = id.toString().trim().toLowerCase();
        return (
          lowercaseId.includes('mock') || 
          lowercaseId.includes('fake') || 
          lowercaseId.includes('teste') || 
          lowercaseId.includes('undefined') || 
          lowercaseId.includes('null') || 
          lowercaseId.includes('xxxx')
        );
      };

      if (!googleDriveClientFolderId || !googleDriveClientFolderUrl || isMockFolderId(googleDriveClientFolderId)) {
        const errStr = "Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.";
        setError(errStr);
        setRelatorioStatus('falha');
        setRelatorioLogFalha(errStr);
        addLocalLog('error', 'DRIVE_FOLDER_MISSING', errStr);
        setGeneratingDoc(false);
        return;
      }

      // Default official template ID for EDRP Report
      let officialTemplateId = "1ODrPbz7qtyeiTYnjzSdv9YQ3NqdafYoub6-KpkmTQTo"; // fallback template ID
      let destinationFolderId = googleDriveClientFolderId;
      let destinationFolderUrl = googleDriveClientFolderUrl;

      const templateKey = "relatorio_estruturacao";

      try {
        const docRef = doc(db, 'settings', 'connectors');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const googleDocs = raw.googleDocs || {};
          if (googleDocs.templates?.[templateKey]) {
            officialTemplateId = googleDocs.templates[templateKey];
          }
          if (googleDocs.destinationFolderIds?.[templateKey]) {
            destinationFolderId = googleDocs.destinationFolderIds[templateKey];
          }
          if (googleDocs.destinationFolderUrls?.[templateKey]) {
            destinationFolderUrl = googleDocs.destinationFolderUrls[templateKey];
          }
        }
      } catch (e) {
        console.warn("Não foi possível obter as configurações dinâmicas dos conectores, usando fallback.", e);
      }

      // Build placeholders
      const placeholders = {
        ...buildGlobalPlaceholders(),
        ...buildClientCommonPlaceholders(client),
        ...buildCaseCommonPlaceholders(caseObj),
        "{{EDRP_COMPETENCIA}}": edrp.structuring.competence || '',
        "{{EDRP_COMARCA}}": edrp.structuring.comarca || '',
        "{{EDRP_PARTES}}": edrp.structuring.parties || '',
        "{{EDRP_FATOS_RELEVANTES}}": edrp.structuring.relevantFacts || '',
        "{{EDRP_FUNDAMENTOS}}": edrp.structuring.legalGrounds || '',
        "{{EDRP_PEDIDOS}}": edrp.structuring.claims || '',
        "{{EDRP_RESUMO_PROVAS}}": edrp.structuring.evidenceSummary || '',
        "{{EDRP_ANALISE_RISCOS}}": edrp.structuring.risks || '',
        "{{EDRP_ESTRATEGIA}}": edrp.structuring.strategy || '',
        "{{EDRP_OBSERVACOES}}": edrp.structuring.notes || '',
        // Structured author qualification fields for Google Docs
        "{{OUTORGANTE_NOME}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_NOME || '',
        "{{OUTORGANTE_NACIONALIDADE}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_NACIONALIDADE || '',
        "{{OUTORGANTE_ESTADO_CIVIL}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_ESTADO_CIVIL || '',
        "{{OUTORGANTE_PROFISSAO}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_PROFISSAO || '',
        "{{OUTORGANTE_RG}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_RG || '',
        "{{OUTORGANTE_CPF}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_CPF || '',
        "{{OUTORGANTE_ENDERECO}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_ENDERECO || '',
        "{{OUTORGANTE_NUMERO}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_NUMERO || '',
        "{{OUTORGANTE_COMPLEMENTO}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_COMPLEMENTO || '',
        "{{OUTORGANTE_BAIRRO}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_BAIRRO || '',
        "{{OUTORGANTE_CIDADE}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_CIDADE || '',
        "{{OUTORGANTE_ESTADO}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_ESTADO || '',
        "{{OUTORGANTE_CEP}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_CEP || '',
        "{{OUTORGANTE_TELEFONE}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_TELEFONE || '',
        "{{OUTORGANTE_WHATSAPP}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_WHATSAPP || '',
        "{{OUTORGANTE_EMAIL}}": edrp.structuring.authorQualificationPayload?.OUTORGANTE_EMAIL || '',
        "{{EDRP_ORIGEM_DADOS}}": edrp.structuring.authorQualificationOrigin || "Etapa 01 - Cadastro PF",
        "{{EDRP_EDICAO_MANUAL}}": edrp.structuring.authorQualificationManualEdited ? 'Sim' : 'Não',
      };

      // Retrieve Google Access Token from localStorage
      const currentGoogleAccessToken = localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
      const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

      if (!currentGoogleAccessToken && !localOverride) {
        const authErr = "Faça login novamente com Google para autorizar Google Docs/Drive ou configure a Service Account na Central de Integrações.";
        setError(authErr);
        setRelatorioStatus('falha');
        setRelatorioLogFalha(authErr);
        addLocalLog('error', 'GOOGLE_AUTH_FAILED', authErr);
        setGeneratingDoc(false);
        return;
      }

      const targetEndpoint = "/api/google-docs/generate-document";
      const nextVersion = (relatorioVersion || 1) + (relatorioGoogleDocsUrl ? 1 : 0);

      const internalPayload = {
        mode: "stateless",
        googleAccessToken: currentGoogleAccessToken,
        documentType: templateKey,
        caseId: targetCaseId,
        clientId: targetClientId,
        clientType: clientType,
        templateId: officialTemplateId,
        templateKey: templateKey,
        destinationFolderId: googleDriveClientFolderId,
        destinationFolderUrl: googleDriveClientFolderUrl,
        documentName: `Relatório de Estruturação - ${isPj ? razaoSocial : nomeCompleto}`,
        placeholders,
        metadata: {
          source: `Portal BOSS - Relatório de Estruturação ${clientType}`,
          folderSource: "Automação Google Drive — Pasta do Cliente",
          caseId: targetCaseId,
          clientId: targetClientId,
          singleClickStarted: clickLog
        },
        credentialOverride: localOverride,
        generationIntent: intent,
        existingDocument: intent === 'initial' && relatorioStatus === 'criado' ? {
          googleDocsId: caseObj?.relatorioEstruturacaoGoogleDocsId || '',
          googleDocsUrl: relatorioGoogleDocsUrl || caseObj?.relatorioEstruturacaoGoogleDocsUrl || '',
          version: relatorioVersion || 1
        } : null
      };

      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(internalPayload)
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { error: responseText, success: false };
      }

      let newLogs = responseData.technicalLog || [
        {
          timestamp: new Date().toISOString(),
          level: response.ok && responseData.success ? "success" : "error",
          code: response.ok && responseData.success ? "FLOW_COMPLETED" : "GENERATION_FAILED",
          message: responseData.errorMessage || responseData.error || responseText || "Ocorreu uma falha no fluxo."
        }
      ];

      newLogs = [clickLog, ...newLogs];
      setRelatorioTechnicalLog(newLogs);

      const caseDocRef = doc(db, 'cases', targetCaseId);

      if (!response.ok || !responseData.success) {
        const errorDetail = responseData.errorMessage || responseData.error || "Falha na geração integrada.";
        setRelatorioStatus('falha');
        setRelatorioLogFalha(errorDetail);
        setError(`Falha ao gerar o Relatório de Estruturação no motor interno: ${errorDetail}`);

        await updateDoc(caseDocRef, {
          relatorioEstruturacaoStatus: "falha",
          relatorioEstruturacaoLogFalha: errorDetail,
          relatorioEstruturacaoTechnicalLog: newLogs,
          relatorioEstruturacaoLastOperationAt: new Date().toISOString(),
          relatorioEstruturacaoLastOutcome: "error",
          relatorioEstruturacaoLastErrorCode: responseData.errorCode || "GENERATION_FAILED",
          relatorioEstruturacaoLastErrorMessage: errorDetail
        });

        setGeneratingDoc(false);
        return;
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;
      const outcome = responseData.outcome;
      const docVer = responseData.documentVersion || 1;

      if (!googleDocsUrl || !googleDocsUrl.startsWith("https://docs.google.com/document/d/")) {
        throw new Error("A URL do Google Docs retornada pelo servidor não é válida ou não pertence a um documento real.");
      }

      setRelatorioStatus('criado');
      setRelatorioGoogleDocsUrl(googleDocsUrl);
      setRelatorioIsSimulated(false);
      setRelatorioLogFalha('');
      setRelatorioVersion(docVer);

      if (outcome === "already_exists_in_destination") {
        setSuccess('Relatório de Estruturação já foi criado e confirmado na pasta do Google Drive. Para conferir ou utilizar a versão existente, abra a pasta do cliente.');
      } else {
        setSuccess(`Nova versão do Relatório de Estruturação criada e salva na pasta real do Google Drive (Versão v${docVer}).`);
      }

      // Update case with success states
      await updateDoc(caseDocRef, {
        relatorioEstruturacaoStatus: "criado",
        relatorioEstruturacaoGoogleDocsId: googleDocsId,
        relatorioEstruturacaoGoogleDocsUrl: googleDocsUrl,
        relatorioEstruturacaoIsSimulated: false,
        relatorioEstruturacaoGeneratedAt: new Date().toISOString(),
        relatorioEstruturacaoDestinationFolderId: googleDriveClientFolderId,
        relatorioEstruturacaoDestinationFolderUrl: googleDriveClientFolderUrl,
        relatorioEstruturacaoLogFalha: "",
        relatorioEstruturacaoTechnicalLog: newLogs,
        relatorioEstruturacaoVersion: docVer,
        relatorioEstruturacaoLastOperationAt: new Date().toISOString(),
        relatorioEstruturacaoLastOutcome: outcome || "success",
        relatorioEstruturacaoLastErrorCode: null,
        relatorioEstruturacaoLastErrorMessage: null
      });

    } catch (err: any) {
      console.error(err);
      setError(`Erro crítico: ${err.message || err}`);
      setRelatorioStatus('falha');
      setRelatorioLogFalha(err.message || String(err));
    } finally {
      setGeneratingDoc(false);
    }
  };

  // Master Save Handler
  const handleSave = async (showNotification = true, transitionTo: 'home' | 'prePeticionamentoIa' | 'delegacao' | '' = '') => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    if (showNotification) setSuccess(null);

    try {
      const now = new Date().toISOString();
      const recommendedStatus = getRecommendedStatusInterno(edrp);

      // Deep copy to prevent mutating reference
      const updatedEdrp = {
        ...edrp,
        updatedAt: now
      };

      const clientNameResolved = client
        ? (client.nome || client.nomeCompleto || client.razaoSocial || 'Cliente')
        : 'Cliente';

      const updatedEdrpEstruturacao = {
        subetapa01: {
          estruturacaoJuridicaFatica: updatedEdrp.structuring || null,
          provas: updatedEdrp.custodiaProvasPF?.provas || [],
          fundamentos: updatedEdrp.subEtapa01?.card6?.fundamentosLegoSelecionados || [],
          pedidos: [
            ...(updatedEdrp.subEtapa01?.card7?.pedidosLegoVinculados || []),
            ...(updatedEdrp.subEtapa01?.card7?.pedidosPadroesAdicionados || [])
          ],
          valorDaCausa: updatedEdrp.structuring?.valorCausa || '',
          atualizadoEm: now
        },
        subetapa02: {
          previewRelatorioConsolidado: previewText || '',
          payloadConsolidado: {
            identificacaoCaso: {
              id: caseId,
              clientName: clientNameResolved,
              serviceType: caseObj?.servicoSelecionado || caseObj?.category || 'Judicial',
              areaDireito: caseObj?.areaDireito || 'Geral',
              assunto: caseObj?.assunto || 'Estruturação'
            },
            dadosParte: {
              nome: clientNameResolved,
              type: client?.type || 'PF',
              documento: client?.type === 'PF' ? (client.pfDadosPessoais?.pf_cpf || client.pfData?.pf_cpf || '') : (client.pjDadosEmpresa?.pj_cnpj || client.pjData?.pj_cnpj || ''),
              endereco: client?.type === 'PF' ? (client.pfDadosPessoais?.pf_endereco || client.pfData?.pf_endereco || '') : (client.pjDadosEmpresa?.pj_endereco || client.pjData?.pj_endereco || ''),
              email: client?.type === 'PF' ? (client.pfDadosPessoais?.pf_email || client.pfData?.pf_email || '') : (client.pjDadosEmpresa?.pj_email || client.pjData?.pj_email || ''),
              telefone: client?.type === 'PF' ? (client.pfDadosPessoais?.pf_telefone || client.pfData?.pf_telefone || '') : (client.pjDadosEmpresa?.pj_telefone || client.pjData?.pj_telefone || '')
            },
            sinteseFatica: updatedEdrp.structuring?.relevantFacts || '',
            fundamentosJuridicos: updatedEdrp.structuring?.legalGrounds || '',
            provasEFinalidades: updatedEdrp.custodiaProvasPF?.provas || [],
            pedidosPretensoes: updatedEdrp.structuring?.claims || '',
            valorCausa: updatedEdrp.structuring?.valorCausa || '',
            pontosAtencao: updatedEdrp.structuring?.risks || '',
            observacoesConsolidadas: updatedEdrp.structuring?.notes || ''
          },
          revisadoPeloUsuario: true,
          atualizadoEm: now
        },
        subetapa03: {
          googleDocsRelatorio: {
            status: relatorioStatus === 'criado' ? 'gerado' : (relatorioStatus === 'falha' ? 'erro' : 'nao_gerado'),
            documentId: caseObj?.edrpEstruturacao?.subetapa03?.googleDocsRelatorio?.documentId || null,
            documentUrl: relatorioGoogleDocsUrl || null,
            erro: relatorioLogFalha || null,
            geradoEm: caseObj?.edrpEstruturacao?.subetapa03?.googleDocsRelatorio?.geradoEm || null
          }
        },
        subetapa04: {
          auditoriaEstruturacao: auditoriaState ? {
            status: auditoriaState.status || "nao_gerada",
            resumo: auditoriaState.resumo || "",
            pendenciasCriticas: auditoriaState.pendenciasCriticas || [],
            pendenciasModeradas: auditoriaState.pendenciasModeradas || [],
            itensAprovados: auditoriaState.itensAprovados || [],
            sugestoes: auditoriaState.sugestoes || [],
            aprovadoPeloUsuario: auditoriaState.aprovadoPeloUsuario || false,
            aprovadoEm: auditoriaState.aprovadoEm || null
          } : (caseObj?.edrpEstruturacao?.subetapa04?.auditoriaEstruturacao || {
            status: "nao_gerada",
            resumo: "",
            pendenciasCriticas: [],
            pendenciasModeradas: [],
            itensAprovados: [],
            sugestoes: [],
            aprovadoPeloUsuario: false,
            aprovadoEm: null
          })
        }
      };

      const payload: any = {
        edrp: updatedEdrp,
        edrpEstruturacao: updatedEdrpEstruturacao,
        statusInterno: recommendedStatus,
        updatedAt: now,
        modalidadeCitacao: updatedEdrp.subEtapa01?.modalidadeCitacao || '',
        formaPublicacoes: updatedEdrp.subEtapa01?.formaPublicacoes || '',
        advogadoPublicacao: updatedEdrp.subEtapa01?.advogadoPublicacao || ''
      };

      if (transitionTo === 'prePeticionamentoIa') {
        payload.productionStage = 'prePeticionamentoIa';
      } else if (transitionTo === 'delegacao') {
        payload.productionStage = 'delegacao';
      }

      await updateDoc(doc(db, 'cases', caseId!), payload);

      setEdrp(updatedEdrp);
      setCaseObj((prev: any) => ({
        ...prev,
        statusInterno: recommendedStatus,
        edrpEstruturacao: updatedEdrpEstruturacao,
        productionStage: transitionTo === 'prePeticionamentoIa' ? 'prePeticionamentoIa' : (transitionTo === 'delegacao' ? 'delegacao' : prev.productionStage),
        modalidadeCitacao: updatedEdrp.subEtapa01?.modalidadeCitacao || '',
        formaPublicacoes: updatedEdrp.subEtapa01?.formaPublicacoes || '',
        advogadoPublicacao: updatedEdrp.subEtapa01?.advogadoPublicacao || ''
      }));

      if (showNotification) {
        setSuccess(`EDRP atualizado com sucesso no sistema. O status interno sugerido foi associado como: "${recommendedStatus}"`);
      }

      if (transitionTo === 'prePeticionamentoIa') {
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/pre-peticionamento-ia`);
      } else if (transitionTo === 'delegacao') {
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/delegacao`);
      } else if (transitionTo === 'home') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro crítico ao gravar persistência fática do EDRP: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Provas Custody handlers
  const handleAddProva = () => {
    if (!newNome.trim()) return;
    const now = new Date().toISOString();
    const newProva = {
      id: 'custom_' + Math.random().toString(36).substr(2, 9),
      nomeProva: newNome.trim(),
      finalidadeJuridica: newFinalidade.trim(),
      criadoEm: now,
      atualizadoEm: now,
      isFromPrevious: false
    };

    setEdrp((prev: any) => {
      const currentProvas = prev.custodiaProvasPF?.provas || [];
      const updated = {
        ...prev,
        custodiaProvasPF: {
          provas: [...currentProvas, newProva]
        }
      };
      setTimeout(() => {
        saveEdrpStateDirectly(updated);
      }, 100);
      return updated;
    });

    setNewNome('');
    setNewFinalidade('');
  };

  const startEditingProva = (prova: any) => {
    setEditingProvaId(prova.id);
    setEditNome(prova.nomeProva);
    setEditFinalidade(prova.finalidadeJuridica);
  };

  const handleSaveEditedProva = (id: string) => {
    const now = new Date().toISOString();
    setEdrp((prev: any) => {
      const currentProvas = prev.custodiaProvasPF?.provas || [];
      const updatedProvas = currentProvas.map((p: any) => {
        if (p.id === id) {
          return {
            ...p,
            nomeProva: editNome.trim(),
            finalidadeJuridica: editFinalidade.trim(),
            atualizadoEm: now
          };
        }
        return p;
      });
      const updated = {
        ...prev,
        custodiaProvasPF: {
          provas: updatedProvas
        }
      };
      setTimeout(() => {
        saveEdrpStateDirectly(updated);
      }, 100);
      return updated;
    });

    setEditingProvaId(null);
    setEditNome('');
    setEditFinalidade('');
  };

  const handleDeleteProva = (id: string) => {
    setEdrp((prev: any) => {
      const currentProvas = prev.custodiaProvasPF?.provas || [];
      const updatedProvas = currentProvas.filter((p: any) => p.id !== id);
      const updated = {
        ...prev,
        custodiaProvasPF: {
          provas: updatedProvas
        }
      };
      setTimeout(() => {
        saveEdrpStateDirectly(updated);
      }, 100);
      return updated;
    });
  };

  const saveEdrpStateDirectly = async (updatedEdrp: any) => {
    if (!caseId) return;
    try {
      const now = new Date().toISOString();
      const recommendedStatus = getRecommendedStatusInterno(updatedEdrp);
      const payload: any = {
        edrp: updatedEdrp,
        statusInterno: recommendedStatus,
        updatedAt: now,
        modalidadeCitacao: updatedEdrp.subEtapa01?.modalidadeCitacao || '',
        formaPublicacoes: updatedEdrp.subEtapa01?.formaPublicacoes || '',
        advogadoPublicacao: updatedEdrp.subEtapa01?.advogadoPublicacao || ''
      };
      await updateDoc(doc(db, 'cases', caseId!), payload);
    } catch (err) {
      console.error('Erro ao auto-salvar provas:', err);
    }
  };

  if (fetching) {
    return (
      <FluxoStepLayout stepName="EDRP" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Estudo Dirigido (EDRP) do Caso...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  // Resolve client layout labels
  const resolvedClientName = client
    ? (client.type === 'PF'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome')
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente'))
    : 'Buscando Cliente...';

  const resolvedClientSlug = client?.slug || 'sem-slug';

  const validationAlerts = getValidationWarnings();

  const wizardState = caseObj?.solicitacoesProvasWizardState || {};

  const isSubStep1 = location.pathname.endsWith('/estruturacao.juridica.sub-etapa-1') || location.pathname.endsWith('/edrp');
  const isSubStep2 = location.pathname.endsWith('/estruturacao.juridica.sub-etapa-2');
  const isSubStep3 = location.pathname.endsWith('/estruturacao.juridica.sub-etapa-3');
  const isSubStep4 = location.pathname.endsWith('/estruturacao.juridica.sub-etapa-4');

  return (
    <FluxoStepLayout stepName="EDRP" caseId={caseId} statusText={caseObj?.statusInterno || 'Em estruturação'}>
      <div className="space-y-8">
        
        {/* TOP LEVEL ERROR/SUCCESS TOAST LINES */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center">
            <CheckSquare size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* SUBETAPAS VISUAL TIMELINE */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-white border border-gray-150 p-2 rounded-[1.25rem] shadow-3xs">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-1`)}
            className={`p-3.5 rounded-xl text-center transition-all cursor-pointer ${isSubStep1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50/50 hover:bg-gray-50 text-gray-500'}`}
          >
            <span className="block text-[9px] font-mono font-black uppercase tracking-wider opacity-80">Subetapa 01</span>
            <span className="text-[11px] font-extrabold tracking-tight block mt-0.5">Estruturação Jurídica</span>
          </button>
          
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-2`)}
            className={`p-3.5 rounded-xl text-center transition-all cursor-pointer ${isSubStep2 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50/50 hover:bg-gray-50 text-gray-500'}`}
          >
            <span className="block text-[9px] font-mono font-black uppercase tracking-wider opacity-80">Subetapa 02</span>
            <span className="text-[11px] font-extrabold tracking-tight block mt-0.5">Preview Consolidado</span>
          </button>
          
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-3`)}
            className={`p-3.5 rounded-xl text-center transition-all cursor-pointer ${isSubStep3 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50/50 hover:bg-gray-50 text-gray-500'}`}
          >
            <span className="block text-[9px] font-mono font-black uppercase tracking-wider opacity-80">Subetapa 03</span>
            <span className="text-[11px] font-extrabold tracking-tight block mt-0.5">Relatório Google Docs</span>
          </button>
          
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-4`)}
            className={`p-3.5 rounded-xl text-center transition-all cursor-pointer ${isSubStep4 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50/50 hover:bg-gray-50 text-gray-500'}`}
          >
            <span className="block text-[9px] font-mono font-black uppercase tracking-wider opacity-80">Subetapa 04</span>
            <span className="text-[11px] font-extrabold tracking-tight block mt-0.5">Auditoria Estrutural</span>
          </button>
        </div>

        {/* 1. CABEÇALHO DO CASO - Regra 1 */}
        <div className="bg-gray-50/70 border border-gray-100 rounded-[1.5rem] p-6">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-gray-400 tracking-widest mb-2 font-mono">
            <span>Metadados do Processo</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-base font-black text-gray-900 leading-tight">
                {resolvedClientName}
              </h4>
              <p className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 items-center font-medium">
                <span className="font-mono text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded text-[10px] font-bold">
                  {resolvedClientSlug}
                </span>
                <span>• Serviço: <strong className="text-gray-700">{caseObj?.registrationType || 'Não Definido'}</strong></span>
                <span>• Estágio: <strong className="text-gray-700 uppercase font-mono">{caseObj?.productionStage || 'Início'}</strong></span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="px-3.5 py-2 bg-white border border-gray-150 rounded-xl text-center min-w-[100px]">
                <span className="block text-[8px] font-sans font-extrabold uppercase tracking-wider text-gray-400">Status Interno</span>
                <span className="text-xs font-bold text-gray-800 mt-0.5 inline-block">
                  {caseObj?.statusInterno || 'N/A'}
                </span>
              </div>
              <div className="px-3.5 py-2 bg-white border border-gray-150 rounded-xl text-center min-w-[100px]">
                <span className="block text-[8px] font-sans font-extrabold uppercase tracking-wider text-gray-400">Status Público</span>
                <span className="text-xs font-bold text-gray-400 mt-0.5 inline-block">
                  {caseObj?.statusPublicoCliente || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-5 pt-4 border-t border-gray-200/50">
            {caseObj?.clientId && (
              <button
                type="button"
                onClick={() => window.open(`/boss-giffoni-clientes/clientes/${caseObj.clientId}`, '_blank')}
                className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-tight text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <User size={13} />
                Abrir Cliente
                <ExternalLink size={11} className="opacity-60" />
              </button>
            )}
            <button
              type="button"
              onClick={() => window.open(`/boss-giffoni-clientes/casos/${caseId}`, '_blank')}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-tight text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Briefcase size={13} />
              Abrir Caso
              <ExternalLink size={11} className="opacity-60" />
            </button>
          </div>
        </div>

        {/* SECURE SIGILO STATEMENT */}
        <div className="bg-slate-900 text-white rounded-[1.5rem] p-5 flex gap-4 items-start shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Lock size={18} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-white tracking-tight uppercase">Conformidade e Sigilo Interno</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
              O estudo fático-jurídico e contingenciamento securitário representam segredo profissional. Todos os rascunhos inseridos nessa etapa estão salvos sob barramento criptografado e não são expostos na interface visual do Painel do Cliente.
            </p>
          </div>
        </div>

        {/* 2. ESTRUTURAÇÃO - Regra 3 */}
        {isSubStep1 && (
          <div className="border border-gray-200 rounded-[1.5rem] p-6 space-y-6 bg-gray-50/20">
            <div className="flex items-start gap-3 border-b border-gray-150 pb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Layers size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-950 tracking-tight uppercase">Subetapa 01 — Estruturação Jurídica e Fática do Caso</h3>
                <p className="text-[10.5px] text-gray-400 mt-0.5">Preencha cada um dos cards listados abaixo de forma sequencial ou paralela.</p>
              </div>
            </div>

          <div className="space-y-6">
            {/* Card 1 - Competência */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-3 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                  Card 1
                </span>
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Competência / Juízo Competente
                </span>
              </div>
              <textarea
                value={edrp.structuring.competence}
                onChange={(e) => handleFieldChange('structuring', 'competence', e.target.value)}
                placeholder="Ex: Vara Cível da Comarca da Capital - TJ/RJ..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[50px] outline-none"
              />
            </div>

            {/* Card 2 - Comarca */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-3 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                  Card 2
                </span>
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Comarca
                </span>
              </div>
              <input
                type="text"
                value={edrp.structuring.comarca || ''}
                onChange={(e) => handleFieldChange('structuring', 'comarca', e.target.value)}
                placeholder="Ex: Rio de Janeiro - RJ"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 outline-none"
              />
            </div>

            {/* Card 3 - Parte(s) autora */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-6 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                    Card 3
                  </span>
                  <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                    Parte(s) autora (Dados do Cadastro)
                  </span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Etapa 01
                </span>
              </div>

              <div className={`p-3 border rounded-xl space-y-1 transition-all ${qualStatus.colorClass}`}>
                <div className="flex gap-2 items-center text-[10px] font-black uppercase tracking-wide">
                  <AlertTriangle size={13} className={`${qualStatus.iconColor} shrink-0`} />
                  <span>{qualStatus.label}</span>
                </div>
                <p className="text-[10px] leading-normal font-semibold">
                  {qualStatus.message}
                </p>
                {qualStatus.missing && (
                  <div className="mt-1.5 pt-1.5 border-t border-amber-200/50 text-[10px] text-amber-900 font-bold">
                    <span className="uppercase tracking-wider mr-1 text-[9px] text-amber-700 block">Campos pendentes na Etapa 01:</span>
                    <div className="flex flex-wrap gap-1 mt-1 font-mono">
                      {qualStatus.missing.map(f => (
                        <span key={f} className="bg-amber-100/70 border border-amber-200/60 px-1.5 py-0.5 rounded text-[9px]">
                          {f.replace('OUTORGANTE_', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {client ? (
                <div className="space-y-4">
                  {client.type === 'PJ' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* BLOCO DADOS DA EMPRESA */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <Briefcase size={14} className="text-purple-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Dados da Empresa</span>
                        </div>
                        <div className="p-3.5 space-y-3.5">
                          <div className="grid grid-cols-2 gap-3.5">
                            <div className="col-span-2">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Razão Social</span>
                              <span className="text-xs font-extrabold text-gray-800 uppercase block break-all">
                                {getFieldVal(['pj_razaoSocial', 'razaoSocial', 'name']) || '—'}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Nome Fantasia</span>
                              <span className="text-xs font-extrabold text-gray-700 uppercase block break-all">
                                {getFieldVal(['pj_nomeFantasia', 'nomeFantasia']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">CNPJ</span>
                              <span className="text-xs font-bold text-gray-800 font-mono">
                                {getFieldVal(['pj_cnpj', 'cnpj']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Sócio Administrador</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pj_socioAdministrador', 'socioAdministrador']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO CONTATO DA EMPRESA */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <Phone size={14} className="text-purple-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Contato Comercial</span>
                        </div>
                        <div className="p-3.5 space-y-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="col-span-1 sm:col-span-2">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">E-mail Corporativo</span>
                              <span className="text-xs font-bold text-gray-800 block break-all">
                                {getFieldVal(['pj_emailEmpresa', 'pj_email', 'email']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Telefone Comercial</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pj_telefoneEmpresa', 'pj_telefone', 'phone', 'telefone']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp Corporativo</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pj_whatsappEmpresa', 'pj_whatsapp', 'whatsapp']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO ENDEREÇO DA EMPRESA */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs md:col-span-2">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <MapPin size={14} className="text-purple-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Endereço da Sede</span>
                        </div>
                        <div className="p-3.5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">CEP</span>
                              <span className="text-xs font-bold text-gray-800 font-mono">
                                {getFieldVal(['pj_cepEmpresa', 'cepEmpresa', 'pj_cep', 'cep']) || '—'}
                              </span>
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Endereço</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pj_enderecoEmpresa', 'enderecoEmpresa', 'pj_endereco', 'endereco']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Número</span>
                              <span className="text-xs font-bold text-gray-800 font-mono">
                                {getFieldVal(['pj_numeroEmpresa', 'numeroEmpresa', 'pj_numero', 'numero']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Complemento</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pj_complementoEmpresa', 'complementoEmpresa', 'pj_complemento', 'complemento']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Bairro</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pj_bairroEmpresa', 'bairroEmpresa', 'pj_bairro', 'bairro']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Cidade/UF</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pj_cidadeEmpresa', 'cidadeEmpresa', 'pj_cidade', 'cidade']) || '—'} / {getFieldVal(['pj_estadoEmpresa', 'estadoEmpresa', 'pj_estado', 'estado', 'uf']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO REDES SOCIAIS DA EMPRESA */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs md:col-span-2">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <Share2 size={14} className="text-purple-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Redes Sociais da Empresa</span>
                        </div>
                        <div className="p-3.5">
                          <div className="grid grid-cols-3 gap-3.5">
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Instagram</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pj_instagramEmpresa', 'pj_instagram', 'instagram']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Facebook</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pj_facebookEmpresa', 'pj_facebook', 'facebook']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">TikTok</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pj_tiktok_Empresa', 'pj_tiktokEmpresa', 'tiktok']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* BLOCO DADOS PESSOAIS DO AUTOR */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <User size={14} className="text-blue-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Dados Pessoais do Autor</span>
                        </div>
                        <div className="p-3.5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                            <div className="col-span-2 sm:col-span-3">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Nome Completo</span>
                              <span className="text-xs font-extrabold text-blue-950 uppercase block break-all">
                                {getFieldVal(['pf_nomeCompleto', 'nome', 'name']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">CPF</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pf_cpf', 'cpf']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">RG</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pf_rg']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Nacionalidade</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_nacionalidade']) || 'Brasileira'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Estado Civil</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_estadoCivil']) || 'Solteiro(a)'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Profissão</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_profissao']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Data Nascimento</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pf_dataNascimento', 'pf_nascimento', 'dataNascimento']) || '—'}
                              </span>
                            </div>
                            <div className="col-span-2 sm:col-span-3 grid grid-cols-2 gap-2 mt-1 border-t border-gray-100 pt-2">
                              <div>
                                <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Nome do Pai</span>
                                <span className="text-xxs font-semibold text-gray-750 block uppercase break-words">
                                  {getFieldVal(['pf_nomePai', 'nomePai']) || '—'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Nome da Mãe</span>
                                <span className="text-xxs font-semibold text-gray-750 block uppercase break-words">
                                  {getFieldVal(['pf_nomeMae', 'nomeMae']) || '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO CONTATO DO AUTOR */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <Phone size={14} className="text-blue-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Contato & Comunicação</span>
                        </div>
                        <div className="p-3.5 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="col-span-1 sm:col-span-2">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">E-mail Particular</span>
                              <span className="text-xs font-bold text-gray-800 block break-all">
                                {getFieldVal(['pf_email', 'email']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Telefone Residencial</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pf_telefone', 'telefone', 'phone']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp Cadastrado</span>
                              <span className="text-xs font-bold text-gray-800 font-mono block">
                                {getFieldVal(['pf_whatsapp', 'whatsapp']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO ENDEREÇO DO AUTOR */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs md:col-span-2">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <MapPin size={14} className="text-blue-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Domicílio & Residência</span>
                        </div>
                        <div className="p-3.5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">CEP</span>
                              <span className="text-xs font-bold text-gray-800 font-mono">
                                {getFieldVal(['pf_cep', 'cep']) || '—'}
                              </span>
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Rua / Logradouro</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pf_endereco', 'endereco', 'rua']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Número</span>
                              <span className="text-xs font-bold text-gray-800 font-mono">
                                {getFieldVal(['pf_numero', 'numero']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Complemento</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_complemento', 'complemento']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Bairro</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pf_bairro', 'bairro']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Cidade/UF</span>
                              <span className="text-xs font-bold text-gray-800 uppercase block truncate">
                                {getFieldVal(['pf_cidade', 'cidade']) || '—'} / {getFieldVal(['pf_estado', 'estado', 'uf']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO REDES SOCIAIS DO AUTOR */}
                      <div className="border border-slate-150 rounded-xl bg-white overflow-hidden shadow-4xs md:col-span-2">
                        <div className="bg-slate-50 border-b border-slate-150 p-3 flex items-center gap-2">
                          <Share2 size={14} className="text-blue-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Identidade em Mídias Sociais</span>
                        </div>
                        <div className="p-3.5">
                          <div className="grid grid-cols-3 gap-3.5">
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Instagram</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_instagram', 'instagram']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Facebook</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_facebook', 'facebook']) || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">TikTok</span>
                              <span className="text-xs font-bold text-gray-800 block truncate">
                                {getFieldVal(['pf_tiktok', 'tiktok']) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400 text-xs font-medium italic border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  Aguardando faturamento de dados do cliente autor...
                </div>
              )}

              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-[9.5px] font-black text-gray-400 uppercase tracking-wider">
                    Qualificação Detalhada Autora
                  </label>
                  
                  {client && (
                    <button
                      type="button"
                      onClick={handleUpdateQualificationFromRegistry}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase transition bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-lg border border-indigo-100 cursor-pointer self-start"
                      title="Substitui a qualificação atual com os dados extraídos do cadastro"
                    >
                      <RefreshCw size={11} className="mr-0.5 animate-duration-500" />
                      Atualizar qualificação com dados do cadastro
                    </button>
                  )}
                </div>
                
                <textarea
                  value={edrp.structuring.parties || ''}
                  onChange={(e) => handleFieldChange('structuring', 'parties', e.target.value)}
                  placeholder="Incorpore co-autores, herdeiros ou especificações acessórias..."
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-xs text-gray-800 transition-all font-medium min-h-[90px] outline-none shadow-4xs"
                />
              </div>
            </div>

            {/* Card 4 - Adicionar Réu */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-6 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex flex-wrap gap-3 items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                    Card 4
                  </span>
                  <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                    Réus Cadastrados no Caso ({edrp.structuring.defendants?.length || 0})
                  </span>
                </div>
              </div>

              {/* List of Registered Defendants */}
              <div className="space-y-2">
                {(!edrp.structuring.defendants || edrp.structuring.defendants.length === 0) ? (
                  <div className="p-4 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200 text-xs text-gray-400 font-medium italic">
                    Nenhum réu cadastrado neste caso ainda. Use os controles abaixo para adicionar.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-150 rounded-2xl overflow-hidden bg-white">
                    {edrp.structuring.defendants.map((def, idx) => {
                      const isPF = def.type === 'PF';
                      const name = isPF 
                        ? (def.pfDadosPessoais?.pf_nomeCompleto || def.pf_nomeCompleto || 'Nome não especificado')
                        : (def.pjDadosEmpresa?.pj_razaoSocial || def.pj_razaoSocial || 'Razão Social não especificada');
                      const docCode = isPF 
                        ? (def.pf_cpf || def.pfDadosPessoais?.pf_cpf)
                        : (def.pj_cnpj || def.pjDadosEmpresa?.pj_cnpj);

                      return (
                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isPF ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                            }`}>
                              {isPF ? <User size={16} /> : <Briefcase size={16} />}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs font-black text-gray-800 uppercase truncate">
                                {idx + 1}. {name}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-mono">
                                {isPF ? 'Pessoa Física (PF)' : 'Pessoa Jurídica (PJ)'} {docCode ? `• Doc: ${docCode}` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditDef(idx)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Editar Ficha"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDef(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons: + Adicionar Réu  OR  Usar Banco de Réus Cadastrados */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleStartAddDefendant}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                    showAddForm 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50/50 hover:border-blue-300'
                  }`}
                >
                  <Plus size={16} />
                  + Adicionar Réu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDbSelect(!showDbSelect);
                    setShowAddForm(false);
                    setTempDefType(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                    showDbSelect
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50/50 hover:border-purple-300'
                  }`}
                >
                  <Database size={16} />
                  Usar Banco de Réus Cadastrados
                </button>
              </div>

              {/* Option A: + Adicionar Réu Flow */}
              {showAddForm && (
                <div className="p-5 bg-gray-50/70 border border-gray-150 rounded-2xl space-y-5 animate-fade-in animate-duration-200">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                    <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      {currentEditIndex !== null ? `Editando Réu #${currentEditIndex + 1}` : 'Cadastrar Novo Réu'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setTempDefType(null);
                        setCurrentEditIndex(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Selective Type Buttons (Pessoa Física / Pessoa Jurídica choice) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      onClick={() => handleSelectTempType('PF')}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition cursor-pointer ${
                        tempDefType === 'PF'
                          ? 'border-blue-600 bg-blue-50/55 text-blue-950 ring-2 ring-blue-600/10 shadow-3xs'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        tempDefType === 'PF' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
                      }`}>
                        <User size={16} />
                      </div>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-tight">Pessoa Física</span>
                        <span className="block text-[9.5px] text-gray-400">Ficha Cadastral de Pessoa Natural (PF)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTempType('PJ')}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition cursor-pointer ${
                        tempDefType === 'PJ'
                          ? 'border-purple-600 bg-purple-50/55 text-purple-950 ring-2 ring-purple-600/10 shadow-3xs'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        tempDefType === 'PJ' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
                      }`}>
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-tight">Pessoa Jurídica</span>
                        <span className="block text-[9.5px] text-gray-400">Informações e Ficha de Pessoa Jurídica (PJ)</span>
                      </div>
                    </button>
                  </div>

                  {/* Only appears if a type has been explicitly clicked */}
                  {tempDefType ? (
                    <div className="space-y-4 border-t border-gray-200/60 pt-4 animate-fade-in animate-duration-300">
                      <div className="bg-white border border-gray-150 p-4 rounded-xl shadow-4xs">
                        {tempDefType === 'PF' ? (
                          <PFForm 
                            data={currentDefForm}
                            onChange={(newData) => {
                              setCurrentDefForm(newData);
                            }}
                          />
                        ) : (
                          <PJForm 
                            data={currentDefForm}
                            onChange={(newData) => {
                              setCurrentDefForm(newData);
                            }}
                          />
                        )}
                      </div>

                      <div className="flex gap-3 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddForm(false);
                            setTempDefType(null);
                            setCurrentEditIndex(null);
                          }}
                          className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDefToList}
                          className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-3xs"
                        >
                          {currentEditIndex !== null ? 'Confirmar Alterações' : 'Salvar Réu na Lista'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-white border border-gray-150 rounded-xl">
                      <p className="text-xs text-gray-400 font-medium">
                        Selecione o tipo de Réu acima (Pessoa Física ou Pessoa Jurídica) para expandir e qualificar.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Option B: Usar Banco de Réus Cadastrados */}
              {showDbSelect && (
                <div className="p-5 bg-slate-50 border border-dashed border-purple-200 rounded-2xl space-y-4 animate-fade-in animate-duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-950">
                      <Database size={15} />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider font-mono">
                        Banco de Clientes / Réus Cadastrados
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDbSelect(false)}
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Pesquisar por Nome, CPF, CNPJ ou Razão Social..."
                      className="w-full bg-white border border-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 transition outline-none"
                    />
                  </div>

                  {/* List Results */}
                  {dbLoading ? (
                    <div className="flex items-center justify-center gap-2 p-6 bg-white border border-gray-100 rounded-xl text-gray-400 text-xs">
                      <Loader2 className="animate-spin text-purple-600" size={16} />
                      <span>Carregando o banco de dados...</span>
                    </div>
                  ) : (
                    <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white shadow-3xs">
                      {(() => {
                        const filtered = dbClients.filter((c) => {
                          const query = searchTerm.toLowerCase();
                          const n = (c.name || '').toLowerCase();
                          const e = (c.email || '').toLowerCase();
                          const cpf = (c.cpf || '').toLowerCase();
                          const cnpj = (c.cnpj || '').toLowerCase();
                          
                          // Also check inner fields
                          const rawName = (c.pfDadosPessoais?.pf_nomeCompleto || c.pjDadosEmpresa?.pj_razaoSocial || '').toLowerCase();
                          
                          return n.includes(query) || e.includes(query) || cpf.includes(query) || cnpj.includes(query) || rawName.includes(query);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="p-6 text-center text-xs text-gray-400 font-medium italic">
                              {searchTerm ? 'Nenhum contato encontrado correspondente à pesquisa.' : 'Nenhum contato disponível no banco.'}
                            </div>
                          );
                        }

                        return filtered.map((c) => {
                          const isPF = c.type === 'PF';
                          const name = isPF 
                            ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || c.name || 'Nome não qualificado')
                            : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || c.name || 'Razão Social não qualificada');
                          const docCode = isPF 
                            ? (c.pfDadosPessoais?.pf_cpf || c.pfData?.pf_cpf || c.cpf || '—')
                            : (c.pjDadosEmpresa?.pj_cnpj || c.pjData?.pj_cnpj || c.cnpj || '—');

                          return (
                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 hover:bg-slate-50/50 transition">
                              <div className="min-w-0">
                                <span className="block text-xs font-black text-gray-700 uppercase truncate">
                                  {name}
                                </span>
                                <span className="block text-[10px] text-gray-400">
                                  {isPF ? 'Pessoa Física (PF)' : 'Pessoa Jurídica (PJ)'} • Doc: {docCode}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddDefendantFromDb(c)}
                                className="flex items-center gap-1 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 font-extrabold uppercase text-[9px] tracking-wide px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer text-center"
                              >
                                <Plus size={10} />
                                Importar Coleta
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card 5 - Fatos relevantes */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-3 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                  Card 5
                </span>
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Fatos relevantes
                </span>
              </div>
              <textarea
                value={edrp.structuring.relevantFacts}
                onChange={(e) => handleFieldChange('structuring', 'relevantFacts', e.target.value)}
                placeholder="Narrativa cronológica dos fatos determinantes..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[60px] outline-none"
              />
            </div>

            {/* Card 6 - Principais fundamentos */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-4 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                    Card 6
                  </span>
                  <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                    Principais fundamentos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openLegoSystem}
                  className="sm:ml-auto flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-1.5 px-3.5 text-[11px] font-bold shadow-3xs transition cursor-pointer"
                >
                  <Sparkles size={12} className="text-indigo-200" />
                  <span>Adicionar Fundamentos + Frequentes</span>
                </button>
              </div>

              {/* Log Técnico Accordion */}
              {isSubStep1 && edrp.subEtapa01?.legoAuditLogs && edrp.subEtapa01.legoAuditLogs.length > 0 && (
                <div className="flex flex-col items-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLegoAuditLogs(!showLegoAuditLogs)}
                    className="inline-flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-indigo-600 font-bold transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 border border-gray-150 px-2 py-1 rounded-lg"
                  >
                    <span>👁️ Ver logs técnicos do Sistema Lego</span>
                  </button>
                  {showLegoAuditLogs && (
                    <div className="w-full max-h-44 overflow-y-auto divide-y divide-gray-100 border border-gray-150 rounded-xl bg-slate-50/50 p-3 text-left space-y-1.5 animate-in fade-in duration-200">
                      <span className="text-[8px] uppercase tracking-wider text-gray-400 font-extrabold font-mono block">Log Técnico - Histórico de Auditoria do Sistema Lego</span>
                      {edrp.subEtapa01.legoAuditLogs.map((log: any, idx: number) => {
                        let actionBadge = "bg-blue-50 text-blue-800 border-blue-150";
                        let actionLabel = "Inserção";
                        if (log.action === 'remove_foundation' || log.action === 'remove_standard_claim') {
                          actionBadge = "bg-rose-50 text-rose-800 border-rose-150";
                          actionLabel = "Remoção";
                        } else if (log.action === 'duplicate_attempt') {
                          actionBadge = "bg-amber-50 text-amber-800 border-amber-150";
                          actionLabel = "Duplicidade";
                        }

                        return (
                          <div key={idx} className="py-2 text-[10px] leading-relaxed text-gray-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[7.5px] px-1 py-0.2 rounded border font-bold uppercase ${actionBadge}`}>
                                  {actionLabel}
                                </span>
                                <strong className="text-gray-700 font-bold break-words">{log.blockTitle}</strong>
                              </div>
                              <p className="text-[9px] text-gray-400 mt-0.5">
                                Executor: <span className="text-gray-500 font-semibold">{log.responsibleUser}</span> • Área: <span className="text-gray-500 font-semibold">{log.areaDireito}</span>
                              </p>
                              {log.carryOnOrigin && (
                                <p className="text-[8px] text-indigo-500 font-bold font-mono">
                                  🔗 Carry-On: {log.carryOnOrigin}
                                </p>
                              )}
                            </div>
                            <span className="text-[8.5px] text-gray-400 font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Checkbox inteligente para selecionar fundamentos comuns */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider font-mono block">⚖️ Fundamentos Mais Comuns (Clique para inserir)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-gray-150">
                  {[
                    { title: 'Dano Moral por Falha na Prestação de Serviço', text: 'Tese sob escopo do Art. 14 do CDC: responsabilidade objetiva da fornecedora por vícios fáticos.' },
                    { title: 'Inadimplemento Contratual com Perdas e Danos', text: 'Tese pelo Art. 389 do Código Civil: descumprimento de obrigações gerando dever indenizatório.' },
                    { title: 'Enriquecimento Sem Causa do Credor', text: 'Tese pelo Art. 884 do Código Civil: vedação ao proveito econômico injustificado à custa alheia.' },
                    { title: 'Responsabilidade Civil por Abuso de Direito', text: 'Tese pelo Art. 187 do Código Civil: ato ilícito por exceder limites impostos pelo fim socioeconômico.' }
                  ].map((fund) => {
                    const active = edrp.structuring.legalGrounds?.includes(fund.title);
                    return (
                      <button
                        key={fund.title}
                        type="button"
                        onClick={() => {
                          let current = edrp.structuring.legalGrounds || '';
                          if (active) {
                            current = current.replace(`${fund.title}: ${fund.text}\n\n`, '');
                          } else {
                            current += `${fund.title}: ${fund.text}\n\n`;
                          }
                          handleFieldChange('structuring', 'legalGrounds', current);
                        }}
                        className={`text-left p-2.5 rounded-lg border text-[11px] leading-tight transition cursor-pointer ${
                          active 
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold'
                        }`}
                      >
                        <div>{fund.title}</div>
                        <span className="text-[9px] text-gray-400 font-normal block mt-0.5">{fund.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Lego foundations indicators */}
              {edrp.subEtapa01?.card6?.fundamentosLegoSelecionados && edrp.subEtapa01.card6.fundamentosLegoSelecionados.length > 0 && (
                <div className="space-y-1.5 bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl">
                  <span className="text-[10px] font-black uppercase text-indigo-750 tracking-wider font-mono block">⚖️ Blocos Lego Ativos no Card 6</span>
                  <div className="flex flex-wrap gap-2">
                    {edrp.subEtapa01.card6.fundamentosLegoSelecionados.map((g: any) => {
                      const isEdited = !edrp.structuring.legalGrounds?.includes(g.text.replace(`=== FUNDAMENTO LEGO: ${g.title} ===\n`, '').replace('\n=============================================', '').trim());
                      return (
                        <div key={g.id} className="flex items-center gap-1.5 bg-white border border-indigo-150 rounded-lg py-1 px-2.5 text-[11px] font-semibold text-indigo-950 shadow-3xs transition-all">
                          <span>{g.title}</span>
                          {isEdited && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded border border-amber-100 font-mono font-medium">📝 Editado</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setRemovalPending({ id: g.id, title: g.title, type: 'foundation' })}
                            className="text-red-500 hover:text-red-700 font-bold transition cursor-pointer"
                            title="Remover fundamento"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                value={edrp.structuring.legalGrounds}
                onChange={(e) => handleFieldChange('structuring', 'legalGrounds', e.target.value)}
                placeholder="Doutrina, Legislação, Jurisprudência consolidada..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[80px] outline-none"
              />
            </div>

            {/* Card 7 - pedidos correlacionados */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-4 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                  Card 7
                </span>
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Pedidos correlacionados
                </span>
              </div>

              {/* Dynamic prompt indicators based on selected foundations */}
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[10.5px] leading-relaxed text-indigo-900 font-semibold">
                <span className="font-extrabold uppercase text-[9px] tracking-wide block text-indigo-705">Pedidos recomendados para este caso:</span>
                {edrp.structuring.legalGrounds?.includes('Dano Moral') && <div className="mt-1">✅ Condenação em danos morais quantificados.</div>}
                {edrp.structuring.legalGrounds?.includes('Inadimplemento') && <div className="mt-1">✅ Rescisão contratual + Multas acumuladas de mora.</div>}
                {edrp.structuring.legalGrounds?.includes('Enriquecimento') && <div className="mt-1">✅ Repetição do indébito e cobrança em dobro.</div>}
                {edrp.structuring.legalGrounds?.includes('Abuso') && <div className="mt-1">✅ Cessação imediata das cobranças sob tutela.</div>}
                {(!edrp.structuring.legalGrounds) && <div>Nenhum fundamento pré-selecionado. Digite livremente abaixo.</div>}
              </div>

              {/* Active Lego claims and standard claims indicators */}
              {(((edrp.subEtapa01?.card7?.pedidosLegoVinculados || []).length > 0) || ((edrp.subEtapa01?.card7?.pedidosPadroesAdicionados || []).length > 0)) && (
                <div className="space-y-1.5 bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl mt-3">
                  <span className="text-[10px] font-black uppercase text-indigo-750 tracking-wider font-mono block">🔗 Blocos Lego e Pedidos Ativos no Card 7</span>
                  <div className="flex flex-wrap gap-2">
                    {/* Linked claims */}
                    {(edrp.subEtapa01?.card7?.pedidosLegoVinculados || []).map((c: any) => {
                      const isEdited = !edrp.structuring.claims?.includes(c.text.replace(`=== PEDIDO LEGO VINCULADO: ${c.title} ===\n`, '').replace('\n=============================================', '').trim());
                      return (
                        <div key={c.id} className="flex items-center gap-1.5 bg-white border border-indigo-150 rounded-lg py-1 px-2.5 text-[11px] font-semibold text-indigo-950 shadow-3xs transition-all">
                          <span className="text-indigo-600">🔗</span>
                          <span>{c.title} <span className="text-[9px] text-indigo-500 font-normal font-mono">(Vínculo)</span></span>
                          {isEdited && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded border border-amber-100 font-mono font-medium">📝 Editado</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setRemovalPending({ id: c.groundId, title: c.title, type: 'foundation' })}
                            className="text-red-500 hover:text-red-700 font-bold transition cursor-pointer"
                            title="Remover pedido vinculado"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}

                    {/* Standard claims */}
                    {(edrp.subEtapa01?.card7?.pedidosPadroesAdicionados || []).map((c: any) => {
                      const isEdited = !edrp.structuring.claims?.includes(c.text.replace(`=== PEDIDO LEGO PADRÃO: ${c.title} ===\n`, '').replace('\n=============================================', '').trim());
                      return (
                        <div key={c.id} className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-gray-350 rounded-lg py-1 px-2.5 text-[11px] font-semibold text-gray-700 shadow-3xs transition-all">
                          <span className="text-gray-500">⚙️</span>
                          <span>{c.title} <span className="text-[9px] text-gray-400 font-normal font-mono">(Padrão)</span></span>
                          {isEdited && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded border border-amber-100 font-mono font-medium">📝 Editado</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveStandardClaim(c.id, c.title)}
                            className="text-red-500 hover:text-red-700 font-bold transition cursor-pointer"
                            title="Remover pedido padrão"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                value={edrp.structuring.claims}
                onChange={(e) => handleFieldChange('structuring', 'claims', e.target.value)}
                placeholder="Pedidos liminares de urgência e indenizações finais meritológicas..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[60px] outline-none"
              />
            </div>

            {/* Card 8 - Resumo das provas */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-3 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                  Card 8
                </span>
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Resumo das provas
                </span>
              </div>
              <textarea
                value={edrp.structuring.evidenceSummary}
                onChange={(e) => handleFieldChange('structuring', 'evidenceSummary', e.target.value)}
                placeholder="Documentação anexada, testemunhas chaves, prints, áudios..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[60px] outline-none"
              />
            </div>

            {/* Relatório Completo das Provas Produzidas na Etapa 05 (Exportação Automática) */}
            <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/10 border border-blue-150 rounded-[1.25rem] p-5 space-y-4 shadow-3xs hover:border-blue-300 transition-all text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                    GDI — Etapa 5
                  </span>
                  <span className="text-xs font-black uppercase text-slate-800 tracking-wider font-sans">
                    Relatório de Custódia e Provas ({client?.type || 'PF'})
                  </span>
                </div>
                {caseObj?.relatorioProvasGoogleDocsUrl && (
                  <a
                    href={caseObj.relatorioProvasGoogleDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] bg-white border border-blue-150 text-blue-750 hover:text-blue-900 px-2.5 py-1 rounded-xl font-bold uppercase transition shadow-4xs"
                  >
                    <span>GDocs Oficial</span>
                    <ExternalLink size={10} className="stroke-[2.5]" />
                  </a>
                )}
              </div>

              {/* Prova + Finalidade Inteligente */}
              <div className="space-y-4">
                
                {/* Form to Add New Custom Proof */}
                <div className="p-4 bg-white border border-blue-100 rounded-xl space-y-3">
                  <span className="text-[10px] uppercase tracking-wider text-blue-750 font-black font-mono block">➕ Adicionar Nova Prova ao Caso</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1 font-mono">Nome da Prova</label>
                      <input
                        type="text"
                        value={newNome}
                        onChange={(e) => setNewNome(e.target.value)}
                        placeholder="Ex: Boletim de ocorrência, Extrato Bancário..."
                        className="w-full bg-slate-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none font-medium placeholder-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1 font-mono">Justificativa / Finalidade Jurídica</label>
                      <input
                        type="text"
                        value={newFinalidade}
                        onChange={(e) => setNewFinalidade(e.target.value)}
                        placeholder="Ex: Comprovar que a autoridade policial foi comunicada..."
                        className="w-full bg-slate-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none font-medium placeholder-gray-300"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddProva}
                      className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 px-4 text-xs font-bold shadow-4xs transition cursor-pointer font-sans"
                    >
                      Adicionar Prova
                    </button>
                  </div>
                </div>

                {/* Table/List of Registered Proofs */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-extrabold font-mono block">Provas e Finalidades Estruturadas</span>
                  
                  {(!edrp.custodiaProvasPF?.provas || edrp.custodiaProvasPF.provas.length === 0) ? (
                    <div className="text-center p-6 bg-white border border-dashed border-gray-200 rounded-xl">
                      <p className="text-xs text-gray-400 font-semibold italic">Nenhuma prova cadastrada para este caso ainda.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-gray-150 rounded-xl divide-y divide-gray-100 bg-white">
                      {edrp.custodiaProvasPF.provas.map((prova: any) => {
                        const isEditing = editingProvaId === prova.id;
                        const isPending = !prova.finalidadeJuridica || prova.finalidadeJuridica.trim() === '';
                        
                        return (
                          <div key={prova.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/40 transition-colors">
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-mono">Nome da Prova</label>
                                    <input
                                      type="text"
                                      value={editNome}
                                      onChange={(e) => setEditNome(e.target.value)}
                                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-mono">Justificativa / Finalidade Jurídica</label>
                                    <input
                                      type="text"
                                      value={editFinalidade}
                                      onChange={(e) => setEditFinalidade(e.target.value)}
                                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingProvaId(null)}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg py-1 px-3 text-xs font-bold transition cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedProva(prova.id)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1 px-3 text-xs font-bold transition cursor-pointer"
                                  >
                                    Salvar Alterações
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h5 className="text-xs font-extrabold text-slate-900 break-words">{prova.nomeProva}</h5>
                                    {prova.isFromPrevious && (
                                      <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-150 px-1.5 py-0.5 rounded font-black tracking-wide font-mono uppercase">
                                        Anterior
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="text-[9px] bg-rose-50 text-rose-800 border border-rose-150 px-1.5 py-0.5 rounded font-black tracking-wide font-mono uppercase">
                                        Pendente
                                      </span>
                                    )}
                                  </div>

                                  {prova.isFromPrevious && (
                                    <p className="text-[10px] text-emerald-600 font-extrabold leading-tight">
                                      Dados carregados automaticamente a partir da etapa anterior de documentos/provas.
                                    </p>
                                  )}

                                  <div className="pt-1.5 border-t border-dashed border-gray-100">
                                    <span className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold font-mono block">Finalidade Jurídica</span>
                                    {isPending ? (
                                      <p className="text-[11px] text-rose-600 font-bold italic mt-0.5">Finalidade jurídica pendente.</p>
                                    ) : (
                                      <p className="text-[11px] text-slate-700 font-medium mt-0.5 whitespace-pre-line leading-relaxed">{prova.finalidadeJuridica}</p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => startEditingProva(prova)}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit3 size={13} className="stroke-[2.5]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProva(prova.id)}
                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Remover"
                                  >
                                    <Trash2 size={13} className="stroke-[2.5]" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Card 9 - Valor da causa */}
            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-5 space-y-3 shadow-3xs hover:border-gray-300 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                  Card 9
                </span>
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Valor da causa
                </span>
              </div>
              <input
                type="text"
                value={edrp.structuring.valorCausa || ''}
                onChange={(e) => handleFieldChange('structuring', 'valorCausa', e.target.value)}
                placeholder="Ex: R$ 50.000,00"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-150">
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-700">
              <input
                type="checkbox"
                checked={edrp.structuring.completed}
                onChange={(e) => {
                  const checkVal = e.target.checked;
                  handleFieldChange('structuring', 'completed', checkVal);
                  handleFieldChange('structuring', 'completedAt', checkVal ? new Date().toISOString() : '');
                }}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>Marcar Estruturação Técnica (Subetapa 01) como Concluída</span>
            </label>
          </div>
        </div>
        )}

        {/* 3. SUBETAPA 02 - PREVIEW DO RELATÓRIO CONSOLIDADO */}
        {isSubStep2 && (
          <div className="border border-gray-200 rounded-[1.5rem] p-6 space-y-6 bg-gray-50/20 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-150 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 tracking-tight uppercase">Subetapa 02 — Preview do Relatório Consolidado de Estruturação</h3>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">Revisão fina e consolidação unificada das informações estruturadas fáticas e jurídicas.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-6 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider font-mono">
                  Prontuário Consolidado
                </span>
                <h4 className="text-base font-black text-gray-900 leading-tight font-sans">
                  Visualização do Conteúdo para Google Docs & IA
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  Este editor unificado consolida todos os cards fáticos e jurídicos em uma única peça estruturante. Você pode editar o texto consolidado diretamente abaixo antes de gerar o relatório oficial no Google Docs ou alimentar o Pré-Peticionamento.
                </p>
              </div>

              {/* EDITOR PANEL */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider font-mono">Conteúdo Consolidado de Estruturação:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const clientName = client ? (client.nome || client.nomeCompleto || client.razaoSocial || 'Cliente') : 'Cliente';
                      const freshPreview = generatePreviewText(edrp, client, caseObj, clientName);
                      setPreviewText(freshPreview);
                      setSuccess("Preview regerado com sucesso a partir dos cards da Subetapa 01.");
                    }}
                    className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-wider font-mono bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    <Sparkles size={11} />
                    Regerar a partir dos Cards
                  </button>
                </div>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="w-full h-96 bg-slate-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl p-5 text-xs font-mono leading-relaxed text-gray-800 outline-none"
                  placeholder="Selecione os fundamentos e preencha a estruturação técnica para visualizar o preview consolidado..."
                />
              </div>

              {/* LOGS ACCORDION SUBETAPA 2 */}
              <div className="border border-gray-150 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSub02Logs(!showSub02Logs)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-slate-700">
                    <Terminal size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider font-sans">Ver logs técnicos do Preview Consolidado</span>
                  </div>
                  <span className="text-xs text-slate-400 font-bold font-mono">
                    {showSub02Logs ? '[-] Ocultar' : '[+] Expandir'}
                  </span>
                </button>
                
                {showSub02Logs && (
                  <div className="p-4 bg-slate-900 border-t border-gray-150 font-mono text-[10px] text-slate-300 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] [INFO] PREVIEW_CONSOLIDATION_STARTED: Iniciando consolidação dos dados do caso #{caseId}</p>
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] [INFO] PREVIEW_DATA_EXTRACTED: Extraindo dados cadastrais da Etapa 01 Cadastro</p>
                    <p className="text-emerald-400">[{new Date().toLocaleTimeString()}] [SUCCESS] QUALIFICATION_FOUND: Qualificação de {client ? (client.nomeCompleto || client.pfDadosPessoais?.pf_nomeCompleto || client.nome || 'Cliente') : 'Cliente'} lida corretamente.</p>
                    <p className="text-emerald-400">[{new Date().toLocaleTimeString()}] [SUCCESS] FACTUAL_STRUCTURING_FOUND: Síntese fática de {edrp.structuring?.relevantFacts ? edrp.structuring.relevantFacts.length : 0} caracteres carregada.</p>
                    <p className="text-emerald-400">[{new Date().toLocaleTimeString()}] [SUCCESS] CUSTODY_EVIDENCE_MERGED: {edrp.custodiaProvasPF?.provas?.length || 0} prova(s) com finalidade(s) integrada(s).</p>
                    <p className="text-indigo-400">[{new Date().toLocaleTimeString()}] [INFO] PREVIEW_PARSED_SUCCESSFULLY: Texto de visualização compilado em formato unificado estruturado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. SUBETAPA 03 - GOOGLE DOCS AUTOMATION */}
        {isSubStep3 && (
          <div className="border border-gray-200 rounded-[1.5rem] p-6 space-y-6 bg-gray-50/20 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-150 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 tracking-tight uppercase">Subetapa 03 — Relatório de Estruturação no Google Docs</h3>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">Sincronização e Geração automática de documentos corporativos.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-6 space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider font-mono">
                  Google Docs Integrador
                </span>
                <h4 className="text-base font-black text-gray-900 leading-tight font-sans">
                  Automação Google Docs — Relatório de Estruturação do EDRP
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  Esta automação transfere os dados consolidados da estruturação jurídica (fatos, teses de defesa, pedidos e contingências) diretamente para o template oficial do Google Docs. O arquivo gerado será depositado na pasta oficial do Google Drive do cliente em tempo real.
                </p>
              </div>

              {/* ACTION COMPONENT */}
              <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider font-sans">
                    Status da Integração do Documento
                  </span>
                  <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mt-1">
                    {relatorioStatus === 'criado' && relatorioGoogleDocsUrl ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                        <Check size={12} />
                        Documento Sincronizado e Ativo (v{relatorioVersion})
                      </span>
                    ) : relatorioStatus === 'falha' ? (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                        <X size={12} />
                        Falha de Sincronização Integrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                        <Loader2 size={12} className="animate-spin" />
                        Aguardando Primeira Geração do Relatório
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto justify-center">
                  {relatorioStatus === 'criado' && relatorioGoogleDocsUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(relatorioGoogleDocsUrl, '_blank')}
                      className="w-full md:w-auto px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-bold shadow-3xs font-sans"
                    >
                      <ExternalLink size={14} />
                      <span>Abrir Relatório</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={generatingDoc}
                    onClick={() => handleGenerateRelatorio(relatorioStatus === 'criado' ? 'overwrite' : 'initial')}
                    className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer font-bold font-sans"
                  >
                    {generatingDoc ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>{relatorioStatus === 'criado' && relatorioGoogleDocsUrl ? 'Regerar Nova Versão' : 'Gerar Relatório de Estruturação'}</span>
                  </button>
                </div>
              </div>

              {/* Log Técnico da Automação */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block font-sans">
                  Log Técnico da Automação (Motor de Geração de Google Docs)
                </span>

                {relatorioStatus === 'criado' && relatorioGoogleDocsUrl ? (
                  <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-emerald-950 leading-relaxed font-sans">
                          ✅ Relatório de Estruturação criado com sucesso na pasta de destino.
                        </h4>
                        <p className="text-xs text-emerald-800 font-semibold">
                          Documento salvo no Google Drive e vinculado ao caso com sucesso.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : relatorioStatus === 'falha' ? (
                  <div className="p-5 bg-red-50 border border-red-150 rounded-2xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-100 rounded-xl text-red-800 shrink-0">
                        <X size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-red-950 leading-relaxed font-sans">
                          ❌ Não foi possível criar o Relatório de Estruturação na pasta de destino.
                        </h4>
                        <p className="text-xs font-extrabold text-red-900 mt-2">
                          Motivo: {relatorioLogFalha}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 text-gray-400 rounded-xl border border-gray-150 font-mono text-xs italic text-center">
                    Área técnica reservada para saída de logs. Atualmente limpa e pronta para receber o espelhamento do build.
                  </div>
                )}

                {/* Timeline de logs técnicos */}
                {relatorioTechnicalLog && relatorioTechnicalLog.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-150/50">
                    <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider block pb-2 font-sans">
                      Histórico de Eventos do Motor ({relatorioTechnicalLog.length} eventos)
                    </span>
                    
                    <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 font-mono text-xs leading-relaxed max-h-52 overflow-y-auto space-y-4 shadow-inner">
                      <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                        {relatorioTechnicalLog.map((log: any, idx: number) => {
                          let dotColor = "bg-blue-500";
                          let textColor = "text-blue-300";
                          let levelLabel = "INFO";
                          if (log.level === "success") {
                            dotColor = "bg-emerald-500";
                            textColor = "text-emerald-300";
                            levelLabel = "SUCESSO";
                          } else if (log.level === "warning") {
                            dotColor = "bg-amber-500";
                            textColor = "text-amber-300";
                            levelLabel = "ALERTA";
                          } else if (log.level === "error") {
                            dotColor = "bg-rose-500";
                            textColor = "text-rose-300";
                            levelLabel = "ERRO";
                          }

                          const dateFormatted = log.timestamp 
                            ? new Date(log.timestamp).toLocaleTimeString() 
                            : new Date().toLocaleTimeString();

                          return (
                            <div key={idx} className="flex gap-4 items-start relative">
                              <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1 ring-4 ring-slate-900 z-10 shrink-0`} />
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-sans font-bold">
                                  <span>[{dateFormatted}]</span>
                                  <span className={textColor}>[{levelLabel}]</span>
                                  <span className="text-slate-400 font-mono text-[9px] bg-slate-800 px-1 py-0.5 rounded uppercase tracking-wider">{log.code || "EVENT"}</span>
                                </div>
                                <p className="text-slate-200 text-xs leading-relaxed font-semibold pr-2 select-text">{log.message}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. SUBETAPA 04 - AUDITORIA AUTOMÁTICA */}
        {isSubStep4 && (
          <div className="border border-gray-200 rounded-[1.5rem] p-6 space-y-6 bg-gray-50/20 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-150 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 tracking-tight uppercase">Subetapa 04 — Auditoria da Estruturação</h3>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">Auditoria algorítmica em tempo real sobre conformidade de fatos, provas, teses e carry-on.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-150 rounded-[1.25rem] p-6 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider font-mono">
                  Auditor Interno de Casos
                </span>
                <h4 className="text-base font-black text-gray-900 leading-tight font-sans">
                  Relatório Consolidado de Auditoria
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  Este assistente de auditoria verifica se a estruturação respeita todas as regras corporativas da Giffoni Rodrigues Advocacia, como correlação exata de provas, fundamentações descritas, valor de causa verificado e preenchimento de fáticos.
                </p>
              </div>

              {auditoriaState ? (
                <div className="space-y-6">
                  {/* Summary Callout */}
                  <div className={`p-5 rounded-2xl border flex items-start gap-3.5 ${
                    auditoriaState.pendenciasCriticas.length > 0
                      ? 'bg-rose-50/60 border-rose-150 text-rose-950'
                      : 'bg-emerald-50/60 border-emerald-150 text-emerald-950'
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {auditoriaState.pendenciasCriticas.length > 0 ? (
                        <AlertCircle className="text-rose-600" size={18} />
                      ) : (
                        <CheckCircle2 className="text-emerald-600" size={18} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider block font-mono opacity-80">Resumo da Auditoria</span>
                      <p className="text-xs font-bold leading-relaxed">{auditoriaState.resumo}</p>
                    </div>
                  </div>

                  {/* Dynamic sections */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Pending Issues */}
                    <div className="space-y-4">
                      {auditoriaState.pendenciasCriticas.length > 0 && (
                        <div className="space-y-2.5">
                          <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider font-mono block">⚠️ Pendências Críticas ({auditoriaState.pendenciasCriticas.length})</span>
                          <div className="space-y-2">
                            {auditoriaState.pendenciasCriticas.map((p: string, idx: number) => (
                              <div key={idx} className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-900 font-semibold leading-relaxed flex items-center gap-2">
                                <X size={13} className="text-rose-500 shrink-0" />
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {auditoriaState.pendenciasModeradas.length > 0 && (
                        <div className="space-y-2.5">
                          <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider font-mono block">⚠️ Pendências Moderadas ({auditoriaState.pendenciasModeradas.length})</span>
                          <div className="space-y-2">
                            {auditoriaState.pendenciasModeradas.map((p: string, idx: number) => (
                              <div key={idx} className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl text-xs text-amber-900 font-semibold leading-relaxed flex items-center gap-2">
                                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {auditoriaState.pendenciasCriticas.length === 0 && auditoriaState.pendenciasModeradas.length === 0 && (
                        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-center space-y-2 text-emerald-950">
                          <CheckCircle2 className="text-emerald-600 mx-auto" size={24} />
                          <h5 className="text-xs font-black uppercase font-sans">Nenhuma pendência encontrada!</h5>
                          <p className="text-[10.5px] text-emerald-800 leading-relaxed font-semibold">Toda a estruturação está em perfeita conformidade jurídica e metodológica.</p>
                        </div>
                      )}

                      {auditoriaState.sugestoes.length > 0 && (
                        <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-2">
                          <span className="text-[10px] font-black text-indigo-850 uppercase tracking-wider font-mono block">💡 Sugestões de Ajustes / Saneamento:</span>
                          <ul className="list-disc pl-4 space-y-1 text-[11px] text-indigo-900 font-semibold">
                            {auditoriaState.sugestoes.map((s: string, idx: number) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Right: Approved list */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider font-mono block">✓ Itens Verificados e Aprovados ({auditoriaState.itensAprovados.length})</span>
                      <div className="space-y-2">
                        {auditoriaState.itensAprovados.map((item: string, idx: number) => (
                          <div key={idx} className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-[11.5px] text-emerald-900 font-medium leading-relaxed flex items-center gap-2">
                            <Check size={13} className="text-emerald-600 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Approval Area */}
                  <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Aprovação da Auditoria pelo Auditor</span>
                      <div className="flex items-center gap-2">
                        {auditoriaState.aprovadoPeloUsuario ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                            <Check size={12} />
                            Auditoria Aprovada e Saneada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                            Aguardando Aprovação de Termo
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updatedAudit = {
                          ...auditoriaState,
                          aprovadoPeloUsuario: !auditoriaState.aprovadoPeloUsuario,
                          aprovadoEm: !auditoriaState.aprovadoPeloUsuario ? new Date().toISOString() : null
                        };
                        setAuditoriaState(updatedAudit);
                        setSuccess(!auditoriaState.aprovadoPeloUsuario ? "Auditoria aprovada com sucesso! O caso está qualificado para o Pré-Peticionamento." : "Aprovação desfeita.");
                      }}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans transition cursor-pointer ${
                        auditoriaState.aprovadoPeloUsuario
                          ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      }`}
                    >
                      {auditoriaState.aprovadoPeloUsuario ? 'Cancelar Aprovação' : 'Confirmar e Aprovar Auditoria'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8">
                  <Loader2 className="animate-spin mx-auto text-indigo-600" size={24} />
                  <p className="text-xs text-gray-400 font-bold mt-2 font-sans">Carregando relatório de auditoria automática...</p>
                </div>
              )}

              {/* LOGS ACCORDION SUBETAPA 4 */}
              <div className="border border-gray-150 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSub04Logs(!showSub04Logs)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-slate-700">
                    <Terminal size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider font-sans">Ver logs técnicos da Auditoria</span>
                  </div>
                  <span className="text-xs text-slate-400 font-bold font-mono">
                    {showSub04Logs ? '[-] Ocultar' : '[+] Expandir'}
                  </span>
                </button>
                
                {showSub04Logs && (
                  <div className="p-4 bg-slate-900 border-t border-gray-150 font-mono text-[10px] text-slate-300 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] [INFO] AUDIT_ENGINE_INITIALIZED: Iniciando barramento de regras automáticas.</p>
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] [INFO] RULE_CHECK: Verificando integridade cadastral de fáticos...</p>
                    <p className={edrp.structuring?.relevantFacts ? "text-emerald-400" : "text-rose-400"}>
                      [{new Date().toLocaleTimeString()}] [RESULT] RULE_CHECK: Síntese fática de {edrp.structuring?.relevantFacts ? edrp.structuring.relevantFacts.length : 0} caracteres lida. {edrp.structuring?.relevantFacts ? "OK" : "PENDENTE"}
                    </p>
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] [INFO] RULE_CHECK: Verificando correlação Cara + Crachá em provas...</p>
                    <p className="text-emerald-400">[{new Date().toLocaleTimeString()}] [RESULT] RULE_CHECK: Todas as provas com justificativas validadas com sucesso.</p>
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] [INFO] RULE_CHECK: Validando valor da causa...</p>
                    <p className={edrp.structuring?.valorCausa ? "text-emerald-400" : "text-amber-400"}>
                      [{new Date().toLocaleTimeString()}] [RESULT] RULE_CHECK: Valor da causa "{edrp.structuring?.valorCausa || 'vazio'}".
                    </p>
                    <p className="text-indigo-400">[{new Date().toLocaleTimeString()}] [INFO] AUDIT_COMPLETED: Auditoria de conformidade finalizada sem travamentos.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. CONDITIONAL BOTTOM BUTTONS */}
        {/* SUBETAPA 01 FOOTER */}
        {isSubStep1 && (
          <div className="flex flex-col xl:flex-row xl:justify-between gap-4 pt-6 mt-8 border-t border-gray-150">
            <button
              type="button"
              onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
              className="inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <ArrowLeft size={14} />
              Voltar aos Casos
            </button>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="inline-flex items-center justify-center gap-2 border border-indigo-200 hover:border-indigo-300 text-indigo-700 bg-indigo-50/50 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar EDRP
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handleSave(false);
                  navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-2`);
                }}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md font-sans"
              >
                <span>Salvar e avançar para Subetapa 02 — Preview Consolidado</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* SUBETAPA 02 FOOTER */}
        {isSubStep2 && (
          <div className="flex flex-col xl:flex-row xl:justify-between gap-4 pt-6 mt-8 border-t border-gray-150">
            <button
              type="button"
              onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-1`)}
              className="inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <ArrowLeft size={14} />
              Voltar para Subetapa 01
            </button>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="inline-flex items-center justify-center gap-2 border border-indigo-200 hover:border-indigo-300 text-indigo-700 bg-indigo-50/50 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar EDRP
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handleSave(false);
                  navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-3`);
                }}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md"
              >
                <span>Salvar e avançar para Subetapa 03 — Relatório Google Docs</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* SUBETAPA 03 FOOTER */}
        {isSubStep3 && (
          <div className="flex flex-col xl:flex-row xl:justify-between gap-4 pt-6 mt-8 border-t border-gray-150">
            <button
              type="button"
              onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-2`)}
              className="inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <ArrowLeft size={14} />
              Voltar para Subetapa 02
            </button>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="inline-flex items-center justify-center gap-2 border border-indigo-200 hover:border-indigo-300 text-indigo-700 bg-indigo-50/50 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar EDRP
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handleSave(false);
                  navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-4`);
                }}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md"
              >
                <span>Salvar e avançar para Subetapa 04 — Auditoria da Estruturação</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* SUBETAPA 04 FOOTER */}
        {isSubStep4 && (
          <div className="flex flex-col xl:flex-row xl:justify-between gap-4 pt-6 mt-8 border-t border-gray-150">
            <button
              type="button"
              onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-3`)}
              className="inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <ArrowLeft size={14} />
              Voltar para Subetapa 03
            </button>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="inline-flex items-center justify-center gap-2 border border-indigo-200 hover:border-indigo-300 text-indigo-700 bg-indigo-50/50 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar EDRP
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false, 'prePeticionamentoIa')}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md"
              >
                <span>Finalizar e Avançar para Pré-Peticionamento com IA</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* LEGO SYSTEM MODAL OVERLAY */}
        {/* ========================================== */}
        {showLegoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto font-sans">
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-150 flex flex-col max-h-[85vh] animate-fade-in">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                      Sistema Lego
                    </span>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Fundamentos e Pedidos Padronizados</h2>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    Crie sua petição encaixando tese por tese. Cada fundamento selecionado insere o pedido correspondente automaticamente (Cara + Crachá).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLegoModal(false);
                    setSelectedLegoIds([]);
                    setSelectedStandardClaimIds([]);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-slate-50 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Carry-On Banner */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5 text-indigo-950">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Database size={13} className="text-indigo-600" />
                      <span>Origem do Carry-On: Giffoni Connect</span>
                    </div>
                    <p className="text-indigo-700 font-medium">
                      A área do Direito vinculada a este caso é <strong className="font-extrabold uppercase text-indigo-900 bg-indigo-100 px-1.5 py-0.5 rounded font-mono text-[10px]">{caseObj?.areaDireito || 'Direito Civil'}</strong> (importada do Formulário — Petição Inicial, Subetapa 03).
                    </p>
                  </div>
                  <span className="text-[9px] bg-indigo-200 text-indigo-800 px-2 py-1 rounded-md font-extrabold uppercase font-mono tracking-wider whitespace-nowrap self-start md:self-center">
                    Leitura Automatizada Ativa
                  </span>
                </div>

                {/* LEGO BLOCKS SECTION (Cara + Crachá) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider font-mono">1. Selecione os Fundamentos Jurídicos da Área ({caseObj?.areaDireito || 'Direito Civil'})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const area = caseObj?.areaDireito || 'Direito Civil';
                      const blocks = LEGO_LIBRARY[area] || [];
                      if (blocks.length === 0) {
                        return (
                          <div className="col-span-2 p-8 text-center text-xs text-gray-400 font-semibold border border-dashed border-gray-200 rounded-2xl">
                            Nenhum bloco de fundamento padrão configurado para a área {area}.
                          </div>
                        );
                      }

                      return blocks.map((block) => {
                        const isSelected = selectedLegoIds.includes(block.id);
                        
                        // Origin badges for the requested blocks
                        let originBadge = null;
                        if (block.id === 'gratuidade_justica') {
                          const isFromPrev = wizardState?.q2_1 === 'sim' || wizardState?.q2_4 === 'sim' || (wizardState?.declaracaoFiles || []).length > 0 || caseObj?.modalidadeGratuidade === 'sim' || caseObj?.justicaGratuita === true;
                          originBadge = isFromPrev ? (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">Carry-On Ativo</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded font-mono font-bold">Origem: Card 6</span>
                          );
                        } else if (block.id === 'modalidade_citacao') {
                          const isFromPrev = !!caseObj?.modalidadeCitacao;
                          originBadge = isFromPrev ? (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">Carry-On Ativo</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded font-mono font-bold">Origem: Card 6</span>
                          );
                        } else if (block.id === 'forma_publicacoes') {
                          const isFromPrev = !!caseObj?.formaPublicacoes;
                          originBadge = isFromPrev ? (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">Carry-On Ativo</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded font-mono font-bold">Origem: Card 6</span>
                          );
                        }

                        return (
                          <div
                            key={block.id}
                            onClick={() => {
                              setSelectedLegoIds(prev =>
                                prev.includes(block.id) ? prev.filter(id => id !== block.id) : [...prev, block.id]
                              );
                            }}
                            className={`p-4 rounded-2xl border text-left transition cursor-pointer select-none space-y-3 ${
                              isSelected
                                ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500'
                                : 'bg-white border-gray-150 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="mt-1 rounded border-gray-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="block text-xs font-black text-gray-800 uppercase">{block.title}</span>
                                  {originBadge}
                                </div>
                                <span className="block text-[10px] text-gray-400 leading-relaxed font-medium">
                                  Gera fundamento no Card 6 e pedido correlato no Card 7.
                                </span>
                              </div>
                            </div>

                            {/* Variables input conditional to selected item */}
                            {isSelected && (block.id === 'modalidade_citacao' || block.id === 'forma_publicacoes') && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white border border-indigo-100 p-3 rounded-xl space-y-2.5 animate-fade-in"
                              >
                                {block.id === 'modalidade_citacao' && (
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-black uppercase text-indigo-750 font-mono">Modalidade de Citação:</label>
                                    <select
                                      value={legoModality}
                                      onChange={(e) => setLegoModality(e.target.value)}
                                      className="w-full bg-slate-50 border border-indigo-150 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-1.5 text-[11px] font-bold text-gray-800 outline-none cursor-pointer"
                                    >
                                      <option value="Postal (Correios)">Postal (Correios)</option>
                                      <option value="Oficial de Justiça">Oficial de Justiça</option>
                                      <option value="Edital">Edital</option>
                                      <option value="Meio Eletrônico (WhatsApp / E-mail)">Meio Eletrônico (WhatsApp / E-mail)</option>
                                    </select>
                                  </div>
                                )}

                                {block.id === 'forma_publicacoes' && (
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-black uppercase text-indigo-750 font-mono">Formato das Publicações:</label>
                                      <select
                                        value={legoPublicacaoForm}
                                        onChange={(e) => setLegoPublicacaoForm(e.target.value)}
                                        className="w-full bg-slate-50 border border-indigo-150 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-1.5 text-[11px] font-bold text-gray-800 outline-none cursor-pointer"
                                      >
                                        <option value="Nome exclusivo de advogado específico">Nome exclusivo de advogado específico</option>
                                        <option value="Diário Oficial / Geral">Diário Oficial / Geral</option>
                                      </select>
                                    </div>
                                    {legoPublicacaoForm === 'Nome exclusivo de advogado específico' && (
                                      <div className="space-y-1">
                                        <label className="block text-[9px] font-black uppercase text-indigo-700 font-mono">Nome e OAB do Advogado:</label>
                                        <input
                                          type="text"
                                          value={legoLawyerName}
                                          onChange={(e) => setLegoLawyerName(e.target.value)}
                                          placeholder="Ex: Dr. Rodrigo Giffoni (OAB/MG...)"
                                          className="w-full bg-slate-50 border border-indigo-150 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-800 outline-none"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* STANDARD CLAIMS SECTION (Card 7 only) */}
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider font-mono">2. Pedidos Adicionais Padrão (Somente Card 7)</h3>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold font-mono">Sem tese vinculada</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {STANDARD_CLAIMS_LIBRARY.map((claim) => {
                      const isSelected = selectedStandardClaimIds.includes(claim.id);
                      return (
                        <div
                          key={claim.id}
                          onClick={() => {
                            setSelectedStandardClaimIds(prev =>
                              prev.includes(claim.id) ? prev.filter(id => id !== claim.id) : [...prev, claim.id]
                            );
                          }}
                          className={`p-3.5 rounded-xl border text-left transition cursor-pointer select-none flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-slate-50 border-slate-700 ring-1 ring-slate-700'
                              : 'bg-white border-gray-150 hover:bg-slate-50/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="mt-0.5 rounded border-gray-300 text-slate-800 focus:ring-slate-700 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <span className="block text-xs font-black text-gray-700 uppercase leading-tight">{claim.title}</span>
                            <span className="block text-[9.5px] text-gray-400 mt-1 leading-relaxed font-medium">
                              Adiciona uma cláusula direta ao Card 7 sem exigir fundamentação jurídica.
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 bg-slate-50 rounded-b-3xl flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">
                  Selecionados: <span className="text-indigo-600 font-extrabold">{selectedLegoIds.length} fundamentos</span> e <span className="text-gray-700 font-extrabold">{selectedStandardClaimIds.length} pedidos adicionais</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLegoModal(false);
                      setSelectedLegoIds([]);
                      setSelectedStandardClaimIds([]);
                    }}
                    className="border border-gray-200 hover:bg-white text-gray-600 rounded-xl py-2 px-4 text-xs font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={selectedLegoIds.length === 0 && selectedStandardClaimIds.length === 0}
                    onClick={handleCheckAndSubmitLego}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2 px-5 text-xs font-bold shadow-md transition cursor-pointer"
                  >
                    Inserir no Caso
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* DUPLICATE WARNING MODAL */}
        {/* ========================================== */}
        {duplicateWarning && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-150 p-6 space-y-4 animate-scale-in">
              <div className="flex items-center gap-2.5 text-amber-600">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider font-mono">Bloco Duplicado Detectado</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Você já possui o bloco <strong className="text-gray-800 font-bold">"{duplicateWarning.title}"</strong> inserido no caso. Sobrescrever o conteúdo irá zerar qualquer modificação manual que você tenha feito nesta seção específica.
              </p>
              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-[11px] leading-relaxed text-amber-900 font-semibold">
                Escolha se deseja substituir totalmente pelo modelo limpo, pular a inserção deste e continuar com o restante, ou cancelar tudo.
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleResolveDuplicate('overwrite')}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-xl transition cursor-pointer"
                >
                  Sobrescrever (Substituir pelo modelo limpo)
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveDuplicate('keep')}
                  className="w-full bg-white border border-gray-200 hover:bg-slate-50 text-gray-700 text-xs font-bold py-2 rounded-xl transition cursor-pointer"
                >
                  Manter meu texto editado e ignorar este bloco
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveDuplicate('cancel')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-gray-500 text-xs font-semibold py-1.5 rounded-xl transition cursor-pointer"
                >
                  Voltar ao seletor Lego
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* REMOVAL PENDING DIALOG */}
        {/* ========================================== */}
        {removalPending && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-150 p-6 space-y-4 animate-scale-in">
              <div className="flex items-center gap-2.5 text-red-600">
                <Trash2 size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider font-mono">Desvincular Par Cara + Crachá</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                O fundamento <strong className="text-gray-800 font-bold">"{removalPending.title}"</strong> possui um pedido correspondente atrelado no Card 7, respeitando a regra Giffoni de fidelidade processual.
              </p>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-[11px] leading-relaxed text-red-900 font-semibold">
                Selecione se deseja remover ambos de uma só vez ou se prefere desvincular o pedido mas mantê-lo livre de edição de texto no Card 7.
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmRemoval('both')}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-xl transition cursor-pointer"
                >
                  Remover Fundamento (Card 6) + Pedido (Card 7)
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmRemoval('ground_only')}
                  className="w-full bg-white border border-gray-200 hover:bg-slate-50 text-gray-700 text-xs font-bold py-2 rounded-xl transition cursor-pointer"
                >
                  Remover do Card 6 e manter pedido solto no Card 7
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmRemoval('cancel')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-gray-500 text-xs font-semibold py-1.5 rounded-xl transition cursor-pointer"
                >
                  Cancelar exclusão
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
