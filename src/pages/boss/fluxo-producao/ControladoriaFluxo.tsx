import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Info,
  ShieldCheck,
  FileCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Calendar,
  Layers,
  ArrowUpRight,
  RotateCcw,
  Flag,
  Loader2,
  FileSearch,
  Plus,
  Trash2,
  Copy,
  Check,
  Activity,
  Award,
  Clock,
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

interface ExtendedProtocolData {
  protocolResponsible: string;
  expectedProtocolDate: string;
  actualProtocolDate: string;
  protocolSystem: string;
  protocolStatus: string;
  processNumber: string;
  protocolReceiptName: string;
  protocolReceiptUrl: string;
  googleDriveFileId: string;
  googleDrivePrepared: boolean;
  notes: string;
  convertedToJudicialCase: boolean;
  completedAt: string;
  updatedAt: string;

  // Step 1.10.1.1 fields
  clientsList: string[];
  exAdversosList: string[];
  subject: string;
  court: string;
  comarca: string;

  // Step 1.10.1.2 Perícia fields
  periciaMarked: boolean;
  periciaDate: string;
  periciaTime: string;
  periciaLocal: string;
  periciaPerito: string;
  periciaType: 'presencial' | 'online';
  periciaEscritorioComparecer: boolean;

  // Step 1.10.1.3 Prazo fields
  prazoMarked: boolean;
  prazoQual: string;
  prazoFatal: string;
  prazoResponsavel: string;
  prazoSeguranca: string;
  prazoDependeClienteInfo: boolean;
  prazoQualInfo: string;
  prazoDependeClienteProof: boolean;
  prazoQualProof: string;

  // Step 1.10.1.4 Audiência fields
  audienciaMarked: boolean;
  audienciaDate: string;
  audienciaTime: string;
  audienciaLocal: string;
  audienciaJuizo: string;
  audienciaType: 'presencial' | 'online';
  audienciaPlatform: string;
  audienciaPlatformType: 'zoom' | 'webex' | 'gmeet' | 'teams' | 'outro';
  audienciaLink: string;
  audienciaClienteAvisado: boolean;

  // Step 1.10.1.5 Contrato fields
  contratoCriado: boolean;
  contratoValorTotal: string;
  contratoParcelas: string;
  contratoVencimentoDia: string;
  contratoAssinado: boolean;

  // Step 1.10.1.6 Andamento fields
  andamentoConferido: boolean;
  andamentoResumo: string;

  // Step 1.10.1.7 Controladoria fields
  controladoriaMigrado: boolean;
  controladoriaData: string;
  controladoriaResponsavel: string;
}

const DEFAULT_PROTOCOL: ExtendedProtocolData = {
  protocolResponsible: '',
  expectedProtocolDate: '',
  actualProtocolDate: '',
  protocolSystem: '',
  protocolStatus: 'nao_preparado',
  processNumber: '',
  protocolReceiptName: '',
  protocolReceiptUrl: '',
  googleDriveFileId: '',
  googleDrivePrepared: false,
  notes: '',
  convertedToJudicialCase: false,
  completedAt: '',
  updatedAt: '',
  clientsList: [],
  exAdversosList: [],
  subject: '',
  court: '',
  comarca: '',
  periciaMarked: false,
  periciaDate: '',
  periciaTime: '',
  periciaLocal: '',
  periciaPerito: '',
  periciaType: 'presencial',
  periciaEscritorioComparecer: false,
  prazoMarked: false,
  prazoQual: '',
  prazoFatal: '',
  prazoResponsavel: '',
  prazoSeguranca: '',
  prazoDependeClienteInfo: false,
  prazoQualInfo: '',
  prazoDependeClienteProof: false,
  prazoQualProof: '',
  audienciaMarked: false,
  audienciaDate: '',
  audienciaTime: '',
  audienciaLocal: '',
  audienciaJuizo: '',
  audienciaType: 'presencial',
  audienciaPlatform: '',
  audienciaPlatformType: 'zoom',
  audienciaLink: '',
  audienciaClienteAvisado: false,
  contratoCriado: false,
  contratoValorTotal: '',
  contratoParcelas: '',
  contratoVencimentoDia: '',
  contratoAssinado: false,
  andamentoConferido: false,
  andamentoResumo: '',
  controladoriaMigrado: false,
  controladoriaData: '',
  controladoriaResponsavel: ''
};

interface ControladoriaData {
  responsible: string;
  sentAt: string;
  checkedAt: string;
  status: 'nao_enviado' | 'enviado' | 'em_conferencia' | 'apto' | 'apto_com_ressalvas' | 'inapto' | 'devolvido_com_pendencia' | 'concluido';
  findings: string;
  returnToStage: string;
  notes: string;
  integrityPreCheck: boolean;
  completedAt: string;
  updatedAt: string;
  auditLogs?: any[];
}

const DEFAULT_CONTROLADORIA: ControladoriaData = {
  responsible: '',
  sentAt: '',
  checkedAt: '',
  status: 'nao_enviado',
  findings: '',
  returnToStage: 'revisao',
  notes: '',
  integrityPreCheck: false,
  completedAt: '',
  updatedAt: '',
  auditLogs: []
};

const STAGES_LIST = [
  { value: 'dados-caso', label: 'Dados do Caso' },
  { value: 'solicitacoes-informacoes', label: 'Solicitações de Informações' },
  { value: 'solicitacoes-provas', label: 'Solicitações de Provas' },
  { value: 'financeiro', label: 'Financeiro e Conectores' },
  { value: 'edrp', label: 'EDRP Interno' },
  { value: 'revisao', label: 'Revisão Formal' },
  { value: 'protocolo', label: 'Protocolo / Distribuição (Etapa 1.9)' },
  { value: 'novo-caso', label: 'Novo Caso / Processo (Etapa 1.10)' }
];

function getRouteForStage(stage: string, caseId: string) {
  switch (stage) {
    case 'dados-caso': return flowRoutes.dadosCaso(caseId);
    case 'solicitacoes-informacoes': return flowRoutes.solicitacoesInformacoes(caseId);
    case 'solicitacoes-provas': return flowRoutes.solicitacoesProvas(caseId);
    case 'financeiro': return flowRoutes.financeiro(caseId);
    case 'edrp': return flowRoutes.edrp(caseId);
    case 'revisao': return flowRoutes.revisao(caseId);
    case 'protocolo': return flowRoutes.protocolo(caseId);
    case 'novo-caso': return flowRoutes.novoCaso(caseId);
    default: return flowRoutes.fluxoHome();
  }
}

function formatCNJ(value: string) {
  const clean = value.replace(/\D/g, '').substring(0, 20);
  if (clean.length === 0) return '';
  let formatted = clean.substring(0, 7);
  if (clean.length > 7) formatted += '-' + clean.substring(7, 9);
  if (clean.length > 9) formatted += '.' + clean.substring(9, 13);
  if (clean.length > 13) formatted += '.' + clean.substring(13, 14);
  if (clean.length > 14) formatted += '.' + clean.substring(14, 16);
  if (clean.length > 16) formatted += '.' + clean.substring(16, 20);
  return formatted;
}

export default function ControladoriaFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [controladoria, setControladoria] = useState<ControladoriaData>(DEFAULT_CONTROLADORIA);
  const [protocol, setProtocol] = useState<ExtendedProtocolData>(DEFAULT_PROTOCOL);
  const [internStatusChoice, setInternStatusChoice] = useState<'Em controladoria' | 'Consolidado'>('Em controladoria');
  
  const [statusInterno, setStatusInterno] = useState<string>('Em produção');
  const [statusPublicoCliente, setStatusPublicoCliente] = useState<string>('Em análise');
  const [visibleToClient, setVisibleToClient] = useState<boolean>(true);
  const [isPublicStatusManuallyEdited, setIsPublicStatusManuallyEdited] = useState<boolean>(false);

  // Multi-item lists input state
  const [newClientInput, setNewClientInput] = useState('');
  const [newExAdversoInput, setNewExAdversoInput] = useState('');
  const [copiedFormula, setCopiedFormula] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (!caseSnap.exists()) {
          setError(`Caso de ID [${caseId}] não encontrado.`);
          setLoading(false);
          return;
        }

        const cData = caseSnap.data();
        setCaseObj(cData);

        let resolvedPrimaryClient = 'Cliente';
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            const cliData = clientSnap.data();
            setClient(cliData);
            resolvedPrimaryClient = cliData.type === 'PF'
              ? (cliData.pfDadosPessoais?.pf_nomeCompleto || cliData.pfData?.pf_nomeCompleto || 'Cliente')
              : (cliData.pjDadosEmpresa?.pj_razaoSocial || cliData.pjData?.pj_razaoSocial || 'Cliente');
          }
        }

        const rawCtrl = cData.controladoria || {};
        setControladoria({
          responsible: rawCtrl.responsible || '',
          sentAt: rawCtrl.sentAt || '',
          checkedAt: rawCtrl.checkedAt || '',
          status: rawCtrl.status || 'nao_enviado',
          findings: rawCtrl.findings || '',
          returnToStage: rawCtrl.returnToStage || 'revisao',
          notes: rawCtrl.notes || '',
          integrityPreCheck: rawCtrl.integrityPreCheck || false,
          completedAt: rawCtrl.completedAt || '',
          updatedAt: rawCtrl.updatedAt ?? '',
          auditLogs: rawCtrl.auditLogs || []
        });

        if (cData.statusInterno === 'Consolidado') {
          setInternStatusChoice('Consolidado');
        } else {
          setInternStatusChoice('Em controladoria');
        }

        setStatusInterno(cData.statusInterno || 'Em produção');
        setStatusPublicoCliente(cData.statusPublicoCliente || 'Em análise');
        setVisibleToClient(cData.visibleToClient ?? true);
        setIsPublicStatusManuallyEdited(cData.isPublicStatusManuallyEdited ?? false);

        const rawProt = cData.protocol || {};
        let loadedClients = rawProt.clientsList || [];
        if (!Array.isArray(loadedClients) || loadedClients.length === 0) {
          loadedClients = [resolvedPrimaryClient];
        }

        setProtocol({
          protocolResponsible: rawProt.protocolResponsible || '',
          expectedProtocolDate: rawProt.expectedProtocolDate || '',
          actualProtocolDate: rawProt.actualProtocolDate || '',
          protocolSystem: rawProt.protocolSystem || '',
          protocolStatus: rawProt.protocolStatus || 'nao_preparado',
          processNumber: rawProt.processNumber || cData.processNumber || '',
          protocolReceiptName: rawProt.protocolReceiptName || '',
          protocolReceiptUrl: rawProt.protocolReceiptUrl || '',
          googleDriveFileId: rawProt.googleDriveFileId || '',
          googleDrivePrepared: rawProt.googleDrivePrepared || false,
          notes: rawProt.notes || '',
          convertedToJudicialCase: rawProt.convertedToJudicialCase || false,
          completedAt: rawProt.completedAt || '',
          updatedAt: rawProt.updatedAt ?? '',
          clientsList: loadedClients,
          exAdversosList: rawProt.exAdversosList || [],
          subject: rawProt.subject || '',
          court: rawProt.court || '',
          comarca: rawProt.comarca || '',
          periciaMarked: rawProt.periciaMarked ?? false,
          periciaDate: rawProt.periciaDate || '',
          periciaTime: rawProt.periciaTime || '',
          periciaLocal: rawProt.periciaLocal || '',
          periciaPerito: rawProt.periciaPerito || '',
          periciaType: rawProt.periciaType || 'presencial',
          periciaEscritorioComparecer: rawProt.periciaEscritorioComparecer ?? false,
          prazoMarked: rawProt.prazoMarked ?? false,
          prazoQual: rawProt.prazoQual || '',
          prazoFatal: rawProt.prazoFatal || '',
          prazoResponsavel: rawProt.prazoResponsavel || '',
          prazoSeguranca: rawProt.prazoSeguranca || '',
          prazoDependeClienteInfo: rawProt.prazoDependeClienteInfo ?? false,
          prazoQualInfo: rawProt.prazoQualInfo || '',
          prazoDependeClienteProof: rawProt.prazoDependeClienteProof ?? false,
          prazoQualProof: rawProt.prazoQualProof || '',
          audienciaMarked: rawProt.audienciaMarked ?? false,
          audienciaDate: rawProt.audienciaDate || '',
          audienciaTime: rawProt.audienciaTime || '',
          audienciaLocal: rawProt.audienciaLocal || '',
          audienciaJuizo: rawProt.audienciaJuizo || '',
          audienciaType: rawProt.audienciaType || 'presencial',
          audienciaPlatform: rawProt.audienciaPlatform || '',
          audienciaPlatformType: rawProt.audienciaPlatformType || 'zoom',
          audienciaLink: rawProt.audienciaLink || '',
          audienciaClienteAvisado: rawProt.audienciaClienteAvisado ?? false,
          contratoCriado: rawProt.contratoCriado ?? false,
          contratoValorTotal: rawProt.contratoValorTotal || '',
          contratoParcelas: rawProt.contratoParcelas || '',
          contratoVencimentoDia: rawProt.contratoVencimentoDia || '',
          contratoAssinado: rawProt.contratoAssinado ?? false,
          andamentoConferido: rawProt.andamentoConferido ?? false,
          andamentoResumo: rawProt.andamentoResumo || '',
          controladoriaMigrado: rawProt.controladoriaMigrado ?? false,
          controladoriaData: rawProt.controladoriaData || '',
          controladoriaResponsavel: rawProt.controladoriaResponsavel || ''
        });
      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const hCtrlChange = (field: keyof ControladoriaData, value: any) => {
    setControladoria((p) => ({ ...p, [field]: value }));
  };

  const statusInternoOptions = [
    'Em produção',
    'Aguardando cliente',
    'Aguardando controladoria',
    'Consolidado',
    'Protocolado',
    'Com recurso',
    'Gargalo técnico'
  ];

  const statusMapping: Record<string, string> = {
    'Em produção': 'Análise de documentos iniciada',
    'Aguardando cliente': 'Informações solicitadas ao cliente',
    'Aguardando controladoria': 'Fatos validados e aguardando protocolo',
    'Consolidado': 'Petição inicial pronta e homologada',
    'Protocolado': 'Caso protocolado sob número judicial',
    'Com recurso': 'Fase recursal fática instaurada',
    'Gargalo técnico': 'Estudo aprofundado de tese pelo escritório'
  };

  const statusConcepts: Record<string, string> = {
    'Em produção': 'O caso está sob ativa redação de faticidade e enquadramento pela assessoria.',
    'Aguardando cliente': 'Paralisação operacional temporária aguardando retorno de provas ou esclarecimentos.',
    'Aguardando controladoria': 'Redação concluída. Etapa pendente de conferência procedimental da controladoria.',
    'Consolidado': 'Aprovado pelo controle de integridade formal para encaminhamento ao protocolo.',
    'Protocolado': 'Submetido ao tribunal estatal ou autarquia administrativa com chaves de identificação.',
    'Com recurso': 'Peticionamento incidental ou recursal contra decisão preliminar ou acórdão.',
    'Gargalo técnico': 'Estudo qualificado de alta complexidade fática exigindo junta extraordinária de advogados.'
  };

  const handleStatusInternoChange = (newVal: string) => {
    setStatusInterno(newVal);
    if (!isPublicStatusManuallyEdited) {
      setStatusPublicoCliente(statusMapping[newVal] || 'Em análise');
    }
  };

  const handlePublicStatusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusPublicoCliente(e.target.value);
    setIsPublicStatusManuallyEdited(true);
  };

  const handleRestoreStatusSuggestion = () => {
    setStatusPublicoCliente(statusMapping[statusInterno] || 'Em análise');
    setIsPublicStatusManuallyEdited(false);
  };

  const hProtChange = (field: keyof ExtendedProtocolData, value: any) => {
    setProtocol((p) => {
      let val = value;
      if (field === 'processNumber') {
        val = formatCNJ(value);
      }
      return { ...p, [field]: val };
    });
  };

  const isCNJValid = (v: string) => v.replace(/\D/g, '').length === 20;

  const handleSave = async (silent = false, action: 'none' | 'exit' | 'advance' | 'return' = 'none') => {
    if (!caseId) return false;
    setSaving(true);
    setError(null);
    if (!silent) setSuccess(null);

    try {
      const now = new Date().toISOString();

      if (controladoria.status === 'devolvido_com_pendencia') {
        if (!controladoria.returnToStage) {
          throw new Error('Selecione uma etapa para o retorno do caso operacional.');
        }
        if (!controladoria.findings.trim()) {
          throw new Error('Descreva os motivos e pendências no campo Descobertas.');
        }
      }

      if ((controladoria.status === 'apto' || controladoria.status === 'concluido' || action === 'advance') && !isCNJValid(protocol.processNumber)) {
        throw new Error('Número do processo (CNJ) é obrigatório com exatamente 20 dígitos para homologação.');
      }

      const existingLogs = controladoria.auditLogs || [];
      const newLogVal = {
        timestamp: now,
        responsible: controladoria.responsible || 'Auditor',
        status: controladoria.status,
        description: `Parecer [${controladoria.status.toUpperCase()}]. Pré-auditoria: [${controladoria.integrityPreCheck ? 'Sim' : 'Não'}]. CNJ: [${protocol.processNumber || 'Sem'}].`,
        findings: controladoria.findings,
        notes: controladoria.notes
      };

      const updatedControladoria: ControladoriaData = {
        ...controladoria,
        auditLogs: [newLogVal, ...existingLogs],
        completedAt: (controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas' || controladoria.status === 'concluido')
          ? (controladoria.completedAt || now) : '',
        updatedAt: now
      };

      const payload: any = {
        controladoria: updatedControladoria,
        protocol: protocol,
        processNumber: protocol.processNumber,
        statusInterno: statusInterno,
        statusPublicoCliente: statusPublicoCliente,
        visibleToClient: visibleToClient,
        isPublicStatusManuallyEdited: isPublicStatusManuallyEdited,
        updatedAt: now
      };

      if (controladoria.status === 'devolvido_com_pendencia') {
        payload.productionStatus = 'com_pendencias';
        payload.productionStage = controladoria.returnToStage;
        payload.statusInterno = 'Com pendência';
      } else if (controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas') {
        payload.productionStatus = 'pronto_para_relatorio';
        payload.statusInterno = internStatusChoice;
        if (action === 'advance') {
          payload.productionStage = 'arquivamento';
        }
      } else if (controladoria.status === 'concluido') {
        payload.productionStatus = 'pronto_para_relatorio';
        payload.statusInterno = 'Consolidado';
        if (action === 'advance') {
          payload.productionStage = 'arquivamento';
        }
      } else {
        payload.statusInterno = statusInterno || 'Em controladoria';
        if (action === 'advance') {
          payload.productionStage = 'arquivamento';
        }
      }

      await updateDoc(doc(db, 'cases', caseId!), payload);

      setCaseObj((p: any) => ({
        ...p,
        ...payload,
        controladoria: updatedControladoria
      }));

      if (!silent) {
        setSuccess('Dados da Controladoria sincronizados e consolidados nos registros do BOSS!');
      }

      if (action === 'exit') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      } else if (action === 'advance') {
        navigate(flowRoutes.prazos(caseId!));
      } else if (action === 'return') {
        navigate(getRouteForStage(controladoria.returnToStage, caseId));
      }

      return true;
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const detectedOrigin = () => {
    const key = caseObj?.registrationTypeKey || '';
    const label = caseObj?.registrationType || '';
    if (key === 'peticao_inicial' || label.toLowerCase().includes('inicial') || label.toLowerCase().includes('petição')) {
      return {
        type: 'PETICAO_INICIAL',
        title: 'Petição Inicial Ajuizada',
        subtitle: 'Origem: Protocolo de Petição Inicial (Etapa 1.9.7)',
        step: '1.9.7'
      };
    } else {
      return {
        type: 'NOVO_CASO',
        title: 'Novo Caso / Processo em Andamento',
        subtitle: 'Origem: Novo Caso de Cliente Existente (Etapa 1.10.1.7)',
        step: '1.10.1.7'
      };
    }
  };

  const origin = detectedOrigin();
  const todoistFormula = `[${protocol.clientsList.join(' & ')}] x [${protocol.exAdversosList.join(' & ')}] - [${protocol.subject || 'Assunto'}] - [${protocol.processNumber || 'Sem CNJ'}] - [${protocol.court || 'Sem Vara'}] - [${protocol.comarca || 'Sem Comarca'}]`;

  return (
    <FluxoStepLayout
      stepName="1.11.1 Painel da Controladoria"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em auditoria'}
    >
      <div className="space-y-8 font-sans">
        
        {/* Messages */}
        {error && (
          <div className="p-4.5 bg-red-50 border border-red-200 rounded-2xl text-red-950 text-xs flex gap-3 items-center">
            <AlertCircle className="text-red-600 shrink-0" size={18} />
            <span className="font-semibold">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* TOP META CARD */}
        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                {client?.slug || 'sem-slug'}
              </span>
              <h4 className="text-sm font-extrabold text-gray-900 leading-tight">
                {client ? (client.type === 'PF' ? client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto : client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial) : 'Processando...'}
              </h4>
              <p className="text-[11px] text-gray-500 font-medium">
                Caso vinculado: <strong className="text-gray-700 font-mono text-xs">{caseId}</strong> • Tipo de Cadastro: <strong className="text-indigo-600">{caseObj?.registrationType || 'Não Definido'}</strong>
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-gray-150 bg-white text-gray-700">
                Fase de Produção: {caseObj?.productionStage || 'controladoria'}
              </span>
            </div>
          </div>
        </div>

        {/* 1. SOURCE DETECTION CARD */}
        <div className="border border-indigo-150 rounded-2xl p-5 bg-gradient-to-r from-indigo-50/40 via-white to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
            <div>
              <span className="text-[9px] font-black tracking-widest uppercase text-indigo-600">Reconhecimento de Origem Operacional</span>
              <h4 className="text-sm font-extrabold text-gray-900 leading-normal">{origin.title}</h4>
              <p className="text-xs text-gray-500">{origin.subtitle}</p>
            </div>
          </div>
          {protocol.controladoriaMigrado ? (
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-150 rounded-xl text-left md:text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <Check size={11} /> Migração Homologada
              </span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Por: <strong>{protocol.controladoriaResponsavel || 'Auditor'}</strong> em <strong>{protocol.controladoriaData ? new Date(protocol.controladoriaData).toLocaleDateString('pt-BR') : 'recente'}</strong>
              </p>
            </div>
          ) : (
            <span className="text-[10px] font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
              Aguardando Liberação Oficial
            </span>
          )}
        </div>

        {/* Rollback Notification panel (Preserve rollback) */}
        {controladoria.status === 'devolvido_com_pendencia' && (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3.5">
            <div className="flex gap-3">
              <Flag size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-black uppercase text-amber-950 tracking-wider">Despacho de Devolução / Rollback Ativo</h5>
                <p className="text-xs text-amber-900/90 leading-relaxed font-semibold">
                  O caso retornará imediatamente à etapa selecionada, sinalizando o status "Com pendência" faturada na listagem geral.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">Fase operacional de destino do trâmite:</label>
                <select
                  value={controladoria.returnToStage}
                  onChange={(e) => hCtrlChange('returnToStage', e.target.value)}
                  className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 sm:w-[260px]"
                >
                  {STAGES_LIST.map((step) => (
                    <option key={step.value} value={step.value}>{step.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleSave(true, 'return')}
                className="mt-4 sm:mt-5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} /> Devolver e Redirecionar Agora
              </button>
            </div>
          </div>
        )}

        {/* 2. DADOS DO PROTOCOLO E FILA CADASTRO (EXIBIR E CONTROLAR) */}
        <div className="border border-gray-150 rounded-2xl p-6 bg-white space-y-6">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Sincronizador & Controle Cadastral</h3>
              <p className="text-[11px] text-gray-400">Edite, sanitize e salve todos os dados migrados das etapas anteriores.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Assunto Competente</label>
              <input
                type="text"
                value={protocol.subject}
                onChange={(e) => hProtChange('subject', e.target.value)}
                placeholder="Exemplo: Concessão de Benefício"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Vara / Órgão Competente</label>
              <input
                type="text"
                value={protocol.court}
                onChange={(e) => hProtChange('court', e.target.value)}
                placeholder="Exemplo: 1ª Vara Previdenciária"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Comarca de Jurisdição</label>
              <input
                type="text"
                value={protocol.comarca}
                onChange={(e) => hProtChange('comarca', e.target.value)}
                placeholder="Exemplo: São Paulo - SP"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Clientes */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Clientes Integrados</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClientInput}
                  onChange={(e) => setNewClientInput(e.target.value)}
                  placeholder="Nome do cliente adicional"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-1.5 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newClientInput.trim()) return;
                    setProtocol(p => ({ ...p, clientsList: [...p.clientsList, newClientInput.trim()] }));
                    setNewClientInput('');
                  }}
                  className="px-3 bg-gray-950 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-black transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {protocol.clientsList.map((c, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-[11px] font-bold rounded-lg">
                    {c}
                    <button
                      type="button"
                      onClick={() => setProtocol(p => ({ ...p, clientsList: p.clientsList.filter((_, i) => i !== idx) }))}
                      className="text-indigo-400 hover:text-indigo-900 font-bold ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Ex Adversos */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Relação de Ex-adversos</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExAdversoInput}
                  onChange={(e) => setNewExAdversoInput(e.target.value)}
                  placeholder="Exemplo: Empresa Ré, INSS"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-1.5 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newExAdversoInput.trim()) return;
                    setProtocol(p => ({ ...p, exAdversosList: [...p.exAdversosList, newExAdversoInput.trim()] }));
                    setNewExAdversoInput('');
                  }}
                  className="px-3 bg-gray-950 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-black transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {protocol.exAdversosList.length === 0 ? (
                  <span className="text-[11px] text-gray-400 italic">Nenhum ex-adverso adicionado.</span>
                ) : (
                  protocol.exAdversosList.map((exa, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 border border-red-100 text-red-800 text-[11px] font-bold rounded-lg">
                      {exa}
                      <button
                        type="button"
                        onClick={() => setProtocol(p => ({ ...p, exAdversosList: p.exAdversosList.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-950 font-bold ml-1"
                      >
                        &times;
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black uppercase tracking-wider text-red-500">
                  Número Unificado do Processo (CNJ) *
                </label>
                {isCNJValid(protocol.processNumber) ? (
                  <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Validado (20 dígitos)</span>
                ) : (
                  <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">Pendente</span>
                )}
              </div>
              <input
                type="text"
                value={protocol.processNumber}
                onChange={(e) => hProtChange('processNumber', e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
                className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:outline-none ${
                  isCNJValid(protocol.processNumber) ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 text-emerald-950' : 'border-red-200 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
            </div>

            <div className="bg-slate-900 border border-slate-950 rounded-xl p-4 text-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
              <div className="space-y-0.5">
                <span className="text-[8px] text-indigo-400 font-black tracking-widest uppercase">Métrica / Fórmula Todoist</span>
                <p className="text-[11px] font-bold leading-tight break-all line-clamp-2 text-indigo-50">{todoistFormula}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(todoistFormula);
                  setCopiedFormula(true);
                  setTimeout(() => setCopiedFormula(false), 2000);
                }}
                className="px-3 py-1.5 text-[10px] font-black bg-slate-800 text-indigo-200 uppercase rounded hover:bg-slate-700 transition-colors"
              >
                {copiedFormula ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. COMPROMISSOS OPERACIONAIS (PRAZOS, PERÍCIAS, AUDIÊNCIAS) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* A. PRAZOS */}
          <div className="border border-gray-150 rounded-2xl p-5 bg-white space-y-4 shadow-3xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="text-rose-500" size={16} />
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Controle de Prazos</h3>
              </div>
              <input
                type="checkbox"
                checked={protocol.prazoMarked}
                onChange={(e) => hProtChange('prazoMarked', e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </div>
            {protocol.prazoMarked ? (
              <div className="space-y-3.5 pt-1 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Qual o prazo?</label>
                  <input
                    type="text"
                    value={protocol.prazoQual}
                    onChange={(e) => hProtChange('prazoQual', e.target.value)}
                    placeholder="Ex: Réplica, Especificação"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-red-500 uppercase">Prazo Fatal</label>
                    <input
                      type="date"
                      value={protocol.prazoFatal}
                      onChange={(e) => hProtChange('prazoFatal', e.target.value)}
                      className="w-full border border-red-200 rounded-lg px-2 py-1 text-xs text-red-950 font-bold bg-ref-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Segurança (Revisão)</label>
                    <input
                      type="date"
                      value={protocol.prazoSeguranca}
                      onChange={(e) => hProtChange('prazoSeguranca', e.target.value)}
                      className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-xs text-indigo-950 font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Responsável</label>
                  <input
                    type="text"
                    value={protocol.prazoResponsavel}
                    onChange={(e) => hProtChange('prazoResponsavel', e.target.value)}
                    placeholder="Nome do Advogado"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                {/* Dependência Info */}
                <div className="p-2.5 border border-amber-100 rounded-xl bg-amber-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-amber-900 uppercase">Depende de INFO do cliente?</span>
                    <input
                      type="checkbox"
                      checked={protocol.prazoDependeClienteInfo}
                      onChange={(e) => hProtChange('prazoDependeClienteInfo', e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                    />
                  </div>
                  {protocol.prazoDependeClienteInfo && (
                    <input
                      type="text"
                      value={protocol.prazoQualInfo}
                      onChange={(e) => hProtChange('prazoQualInfo', e.target.value)}
                      placeholder="Descreva a informação pendente..."
                      className="w-full border border-amber-200 bg-white rounded-lg px-2.5 py-1 text-[11px]"
                    />
                  )}
                </div>
                {/* Dependência Provas */}
                <div className="p-2.5 border border-purple-100 rounded-xl bg-purple-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-900 uppercase">Depende de PROVAS do cliente?</span>
                    <input
                      type="checkbox"
                      checked={protocol.prazoDependeClienteProof}
                      onChange={(e) => hProtChange('prazoDependeClienteProof', e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                    />
                  </div>
                  {protocol.prazoDependeClienteProof && (
                    <input
                      type="text"
                      value={protocol.prazoQualProof}
                      onChange={(e) => hProtChange('prazoQualProof', e.target.value)}
                      placeholder="Qual prova documental?"
                      className="w-full border border-purple-200 bg-white rounded-lg px-2.5 py-1 text-[11px]"
                    />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic pt-2">Sem prazos em aberto cadastrados para este caso.</p>
            )}
          </div>

          {/* B. PERÍCIAS */}
          <div className="border border-gray-150 rounded-2xl p-5 bg-white space-y-4 shadow-3xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="text-emerald-500" size={16} />
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Controle de Perícias</h3>
              </div>
              <input
                type="checkbox"
                checked={protocol.periciaMarked}
                onChange={(e) => hProtChange('periciaMarked', e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </div>
            {protocol.periciaMarked ? (
              <div className="space-y-3.5 pt-1 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Data</label>
                    <input
                      type="date"
                      value={protocol.periciaDate}
                      onChange={(e) => hProtChange('periciaDate', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Horário</label>
                    <input
                      type="time"
                      value={protocol.periciaTime}
                      onChange={(e) => hProtChange('periciaTime', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Perito Judicial</label>
                  <input
                    type="text"
                    value={protocol.periciaPerito}
                    onChange={(e) => hProtChange('periciaPerito', e.target.value)}
                    placeholder="Nome do Expert"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Local / Posto Clínico</label>
                  <input
                    type="text"
                    value={protocol.periciaLocal}
                    onChange={(e) => hProtChange('periciaLocal', e.target.value)}
                    placeholder="Endereço da perícia"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => hProtChange('periciaType', 'presencial')}
                    className={`py-1 text-[11px] font-bold rounded-lg transition-all border ${
                      protocol.periciaType === 'presencial' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-150'
                    }`}
                  >
                    Presencial
                  </button>
                  <button
                    type="button"
                    onClick={() => hProtChange('periciaType', 'online')}
                    className={`py-1 text-[11px] font-bold rounded-lg transition-all border ${
                      protocol.periciaType === 'online' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-150'
                    }`}
                  >
                    Online
                  </button>
                </div>
                <label className="flex items-center gap-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg text-[10px] text-indigo-950 font-bold block select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={protocol.periciaEscritorioComparecer}
                    onChange={(e) => hProtChange('periciaEscritorioComparecer', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                  />
                  <span>Escritório deve comparecer/assistir</span>
                </label>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic pt-2">Sem perícias designadas no momento.</p>
            )}
          </div>

          {/* C. AUDIÊNCIAS */}
          <div className="border border-gray-150 rounded-2xl p-5 bg-white space-y-4 shadow-3xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="text-violet-500" size={16} />
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Controle de Audiências</h3>
              </div>
              <input
                type="checkbox"
                checked={protocol.audienciaMarked}
                onChange={(e) => hProtChange('audienciaMarked', e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </div>
            {protocol.audienciaMarked ? (
              <div className="space-y-3 pt-1 animate-fadeIn">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Data</label>
                    <input
                      type="date"
                      value={protocol.audienciaDate}
                      onChange={(e) => hProtChange('audienciaDate', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Hora</label>
                    <input
                      type="time"
                      value={protocol.audienciaTime}
                      onChange={(e) => hProtChange('audienciaTime', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Juízo / Vara da Audiência</label>
                  <input
                    type="text"
                    value={protocol.audienciaJuizo}
                    onChange={(e) => hProtChange('audienciaJuizo', e.target.value)}
                    placeholder="Vara Federal ou Tribunal"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => hProtChange('audienciaType', 'presencial')}
                    className={`py-0.5 text-[10px] font-bold rounded border ${
                      protocol.audienciaType === 'presencial' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    Presencial
                  </button>
                  <button
                    type="button"
                    onClick={() => hProtChange('audienciaType', 'online')}
                    className={`py-0.5 text-[10px] font-bold rounded border ${
                      protocol.audienciaType === 'online' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    Online
                  </button>
                </div>
                {protocol.audienciaType === 'online' && (
                  <div className="space-y-2 bg-slate-50 p-2 border border-slate-100 rounded-lg">
                    <div className="grid grid-cols-2 gap-1">
                      <select
                        value={protocol.audienciaPlatformType}
                        onChange={(e) => hProtChange('audienciaPlatformType', e.target.value)}
                        className="border border-gray-200 rounded text-[10px] bg-white h-[26px]"
                      >
                        <option value="zoom">Zoom</option>
                        <option value="teams">Teams</option>
                        <option value="gmeet">Meet</option>
                        <option value="webex">Webex</option>
                        <option value="outro">Outro</option>
                      </select>
                      <input
                        type="text"
                        value={protocol.audienciaPlatform}
                        onChange={(e) => hProtChange('audienciaPlatform', e.target.value)}
                        placeholder="Nome Plataforma"
                        className="border border-gray-200 rounded px-1.5 py-0.5 text-[10px]"
                      />
                    </div>
                    <input
                      type="text"
                      value={protocol.audienciaLink}
                      onChange={(e) => hProtChange('audienciaLink', e.target.value)}
                      placeholder="Link de acesso da sala"
                      className="w-full border border-gray-200 rounded px-2 py-0.5 text-[10px]"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded text-[9px] text-indigo-950 font-bold block select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={protocol.audienciaClienteAvisado}
                    onChange={(e) => hProtChange('audienciaClienteAvisado', e.target.checked)}
                    className="rounded text-indigo-600 h-3.5 w-3.5"
                  />
                  <span>Cliente já alinhado/avisado</span>
                </label>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic pt-2">Sem audiências marcadas para aprovação.</p>
            )}
          </div>
        </div>

        {/* 4. MOVIMENTAÇÕES PROCESSUAIS */}
        <div className="border border-gray-150 rounded-2xl p-6 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Última Movimentação Processual</h3>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
              <input
                type="checkbox"
                checked={protocol.andamentoConferido}
                onChange={(e) => hProtChange('andamentoConferido', e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>Conferido com o Tribunal</span>
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-gray-400">Resumo do Andamento Processual Atualizado:</label>
            <textarea
              value={protocol.andamentoResumo}
              onChange={(e) => hProtChange('andamentoResumo', e.target.value)}
              placeholder="Escreva detalhes fáticos colhidos do portal judicial..."
              className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[90px]"
            />
          </div>
        </div>

        {/* 5. PARECER DA CONTROLADORIA (STATUS OPERACIONAL, RESPONSÁVEL) */}
        <div className="border border-gray-150 rounded-2xl p-6 bg-white space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3.5">
            <FileSearch size={18} className="text-violet-600" />
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Parecer da Controladoria & Homologação</h3>
              <p className="text-[11px] text-gray-400">Triagem final de consistência de faturamento e regularidade cadastral.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Auditor Responsável</label>
              <div className="relative">
                <input
                  type="text"
                  value={controladoria.responsible}
                  onChange={(e) => hCtrlChange('responsible', e.target.value)}
                  placeholder="Nome do Auditor"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 font-medium h-[38px]"
                />
                <User size={14} className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Data de Envio</label>
              <div className="relative">
                <input
                  type="date"
                  value={controladoria.sentAt}
                  onChange={(e) => hCtrlChange('sentAt', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 transition-all font-medium h-[38px]"
                />
                <Calendar size={14} className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Data de Conferência</label>
              <div className="relative">
                <input
                  type="date"
                  value={controladoria.checkedAt}
                  onChange={(e) => hCtrlChange('checkedAt', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 transition-all font-medium h-[38px]"
                />
                <Calendar size={14} className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Despacho de Trâmite</label>
              <select
                value={controladoria.status}
                onChange={(e) => hCtrlChange('status', e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 font-bold h-[38px]"
              >
                <option value="nao_enviado">Não Enviado</option>
                <option value="enviado">Enviado para Auditoria</option>
                <option value="em_conferencia">Em Conferência Crítica</option>
                <option value="apto">❇️ Apto sem Restrições</option>
                <option value="apto_com_ressalvas">🔸 Apto com Ressalvas Operacionais</option>
                <option value="inapto">❌ Inapto para Andamento (Bloqueio)</option>
                <option value="devolvido_com_pendencia">🚨 Devolvido com Pendência para Correção (Rollback)</option>
                <option value="concluido">👑 Concluído / Homologado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Checagem de Consistência</label>
              <div className="flex items-center h-[38px]">
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={controladoria.integrityPreCheck}
                    onChange={(e) => hCtrlChange('integrityPreCheck', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5 cursor-pointer"
                  />
                  <span>Pré-checagem estática de consistência cadastral homologada OK</span>
                </label>
              </div>
            </div>
          </div>

          {/* Satus choices for approved status */}
          {(controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas') && (
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-150 rounded-xl space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-800">Selecione o Status Interno para Exibição Geral:</span>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-705">
                  <input
                    type="radio"
                    name="statusInternoChoice"
                    checked={internStatusChoice === 'Em controladoria'}
                    onChange={() => setInternStatusChoice('Em controladoria')}
                    className="text-indigo-600"
                  />
                  <span>Em controladoria</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-705">
                  <input
                    type="radio"
                    name="statusInternoChoice"
                    checked={internStatusChoice === 'Consolidado'}
                    onChange={() => setInternStatusChoice('Consolidado')}
                    className="text-indigo-600"
                  />
                  <span>Consolidado</span>
                </label>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Descobertas e Pendências</label>
            <textarea
              value={controladoria.findings}
              onChange={(e) => hCtrlChange('findings', e.target.value)}
              placeholder="Descreva as inconformidades localizadas, inconsistência de guias judiciais, pendências contratuais de faturamento..."
              className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[90px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold uppercase tracking-wide text-gray-500">Notas de Auditoria</label>
            <textarea
              value={controladoria.notes}
              onChange={(e) => hCtrlChange('notes', e.target.value)}
              placeholder="Observações operacionais adicionais de arquivamento fático..."
              className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[70px]"
            />
          </div>
        </div>

        {/* CONTROLE DE STATUS E TRANSPARÊNCIA DO CLIENTE (Ref relocated from DadosCaso) */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-6 shadow-xs">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-[18px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <Activity size={18} className="text-indigo-600" />
              <span>Controle de Status e Transparência ao Cliente</span>
            </h3>
            <p className="text-[15px] text-gray-500 mt-1">Gestão técnica de status de produção e publicação correspondente na timeline do cliente.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Embedded Internal Status Column with Concept & Suggestions */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-gray-650 tracking-wide flex items-center gap-1.5">
                  <Activity size={12} className="text-indigo-600" />
                  <span>Status Interno de Produção *</span>
                </label>
                <p className="text-xs text-gray-400 leading-relaxed">Status restrito à equipe técnica interna.</p>
                <select
                  value={statusInterno}
                  onChange={(e) => handleStatusInternoChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-950 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none cursor-pointer"
                >
                  {statusInternoOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* CONCEPT BOX PLACED IMMEDIATELY UNDER THE SELECTION DROPDOWN */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-widest leading-none">
                  <Info size={12} className="text-indigo-600" />
                  <span>Conceito & Prática Corporativa</span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-sans">
                  Conceito do status <strong className="text-gray-900 font-bold">"{statusInterno}"</strong>: <br/>
                  <span className="text-gray-650 font-medium italic">"{statusConcepts[statusInterno] || 'Fase de análise interna.'}"</span>
                </p>

                <p className="text-xs text-gray-750 font-medium leading-none font-mono border-t border-gray-100 pt-2 flex items-center gap-1">
                  <span>Sugestão à timeline:</span>
                  <strong className="text-indigo-700">"{statusMapping[statusInterno] || ''}"</strong>
                </p>

                {isPublicStatusManuallyEdited && (
                  <button
                    type="button"
                    onClick={handleRestoreStatusSuggestion}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-100 hover:bg-indigo-150 text-indigo-700 font-extrabold rounded-lg text-xs transition-colors cursor-pointer w-full justify-center border border-indigo-200"
                  >
                    <RotateCcw size={10} className="animate-spin-once" />
                    Restaurar sugestão automática
                  </button>
                )}
              </div>
            </div>

            {/* Visible to client and manual public status */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-gray-650 tracking-wide flex items-center gap-1.5">
                  <User size={12} className="text-indigo-600" />
                  <span>Exibir no Portal do Cliente?</span>
                </label>
                <p className="text-xs text-gray-400 leading-relaxed">Define se o caso fica visível ou opaco no portal do cliente e timeline.</p>
                <div className="flex items-center gap-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => setVisibleToClient(!visibleToClient)}
                    className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors outline-none duration-250 cursor-pointer ${
                      visibleToClient ? 'bg-emerald-600 justify-end' : 'bg-gray-200 justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                  <span className="text-xs font-bold text-gray-700">
                    {visibleToClient ? 'Visível (Indicado)' : 'Ocultado ao cliente'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-650 tracking-wide flex items-center gap-1.5">
                  <span>Status Público do Cliente (Timeline do Portal) *</span>
                </label>
                
                <p className="text-xs text-gray-400 leading-relaxed">
                  Texto exibido para o cliente logado no portal.
                </p>
                
                <input
                  type="text"
                  value={statusPublicoCliente}
                  onChange={handlePublicStatusChange}
                  placeholder="Defina as palavras do status público..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-950 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                />
              </div>
            </div>

          </div>
        </div>

        {/* 6. VALIDAÇÃO DE ENCERRAMENTO OPERACIONAL */}
        <div className="border border-gray-150 rounded-2xl p-6 bg-slate-50 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Lista de Validação de Encerramento Operacional</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1 text-xs">
            <div className={`p-4 rounded-xl border flex items-center gap-3 bg-white ${isCNJValid(protocol.processNumber) ? 'border-emerald-200' : 'border-red-100'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isCNJValid(protocol.processNumber) ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {isCNJValid(protocol.processNumber) ? '✓' : '!'}
              </span>
              <div>
                <p className="font-bold text-gray-800 leading-none">Processo (CNJ)</p>
                <p className="text-[10px] text-gray-400 mt-1">{isCNJValid(protocol.processNumber) ? 'Digitado e Válido' : 'Pendente'}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex items-center gap-3 bg-white ${controladoria.integrityPreCheck ? 'border-emerald-200' : 'border-amber-100'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${controladoria.integrityPreCheck ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                {controladoria.integrityPreCheck ? '✓' : '!'}
              </span>
              <div>
                <p className="font-bold text-gray-800 leading-none">Pré-Checagem</p>
                <p className="text-[10px] text-gray-400 mt-1">{controladoria.integrityPreCheck ? 'Confirmada' : 'Aguardando'}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex items-center gap-3 bg-white ${controladoria.responsible.trim() ? 'border-emerald-200' : 'border-amber-100'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${controladoria.responsible.trim() ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                {controladoria.responsible.trim() ? '✓' : '!'}
              </span>
              <div>
                <p className="font-bold text-gray-800 leading-none">Auditor Nomeado</p>
                <p className="text-[10px] text-gray-400 mt-1">{controladoria.responsible.trim() ? controladoria.responsible : 'Ausente'}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex items-center gap-3 bg-white ${(controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas' || controladoria.status === 'concluido') ? 'border-emerald-200' : 'border-amber-105'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${(controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas' || controladoria.status === 'concluido') ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                {(controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas' || controladoria.status === 'concluido') ? '✓' : '!'}
              </span>
              <div>
                <p className="font-bold text-gray-800 leading-none">Homologado</p>
                <p className="text-[10px] text-gray-400 mt-1">{(controladoria.status === 'apto' || controladoria.status === 'apto_com_ressalvas' || controladoria.status === 'concluido') ? 'Controle Apto' : 'Pendente'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 7. AUDIT LOGS (PRESERVE LOGS & AUDIT TIMELINE) */}
        {controladoria.auditLogs && controladoria.auditLogs.length > 0 && (
          <div className="border border-gray-150 rounded-2xl p-6 bg-white space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Clock className="text-gray-400" size={16} />
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Histórico de Auditoria & Registro de Logs</h3>
            </div>
            <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 divide-y divide-gray-100">
              {controladoria.auditLogs.map((log: any, idx: number) => (
                <div key={idx} className="pt-3 text-xs space-y-1 first:pt-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] tracking-wide">
                      {log.status ? log.status.toUpperCase() : 'CONCLUIDO'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : 'Sem data'}
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium leading-relaxed">{log.description || 'Alterações realizadas no prontuário do caso judicial.'}</p>
                  <p className="text-gray-500 text-[11px] font-mono italic">
                    Auditor: <strong className="text-slate-700">{log.responsible || 'Controlador'}</strong>
                  </p>
                  {(log.findings || log.notes) && (
                    <div className="p-2 border border-dashed border-gray-150 bg-gray-50 rounded mt-1 text-[11px] text-gray-600 font-medium">
                      {log.findings && <div>• <strong>Descobertas:</strong> {log.findings}</div>}
                      {log.notes && <div className="mt-0.5">• <strong>Notas:</strong> {log.notes}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM NAV */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.protocolo(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-650 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white shadow-xs"
          >
            <ArrowLeft size={14} /> Voltar para Protocolo
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            {controladoria.status === 'devolvido_com_pendencia' && (
              <button
                type="button"
                onClick={() => handleSave(false, 'return')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-xs"
              >
                <RotateCcw size={13} /> Devolver p/ Etapa Escolhida
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'none')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <Save size={13} /> {saving ? 'Sincronizando...' : 'Apenas Salvar'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'exit')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 hover:bg-gray-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              Salvar e Sair
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'advance')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Salvar e Avançar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
