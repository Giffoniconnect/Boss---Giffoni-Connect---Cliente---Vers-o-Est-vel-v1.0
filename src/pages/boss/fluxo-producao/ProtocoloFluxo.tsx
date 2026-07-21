import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Info,
  ShieldCheck,
  FileCheck,
  Upload,
  Sliders,
  AlertTriangle,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Calendar,
  Layers,
  Loader2,
  HardDrive,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  Eye,
  Activity,
  Award,
  ChevronRight,
  CheckSquare,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

interface ExtendedProtocolData {
  protocolResponsible: string;
  expectedProtocolDate: string;
  actualProtocolDate: string;
  protocolSystem: string;
  protocolStatus: 'nao_preparado' | 'aguardando_revisao' | 'pronto_para_protocolar' | 'agendado' | 'protocolado' | 'devolvido' | 'cancelado';
  processNumber: string;
  protocolReceiptName: string;
  protocolReceiptUrl: string;
  googleDriveFileId: string;
  googleDrivePrepared: boolean;
  notes: string;
  convertedToJudicialCase: boolean;
  completedAt: string;
  updatedAt: string;

  // Step 1.9.1 fields
  clientsList: string[];
  exAdversosList: string[];
  subject: string;
  court: string;
  comarca: string;

  // Step 1.9.2 Perícia fields
  periciaMarked: boolean;
  periciaDate: string;
  periciaTime: string;
  periciaLocal: string;
  periciaPerito: string;
  periciaType: 'presencial' | 'online';
  periciaEscritorioComparecer: boolean;

  // Step 1.9.3 Prazo fields
  prazoMarked: boolean;
  prazoQual: string;
  prazoFatal: string;
  prazoResponsavel: string;
  prazoSeguranca: string;
  prazoDependeClienteInfo: boolean;
  prazoQualInfo: string;
  prazoDependeClienteProva: boolean;
  prazoQualProva: string;

  // Step 1.9.4 Audiência fields
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

  // Step 1.9.5 Contrato fields
  contratoCriado: boolean;
  contratoValorTotal: string;
  contratoParcelas: string;
  contratoVencimentoDia: string;
  contratoAssinado: boolean;

  // Step 1.9.6 Andamento fields
  andamentoConferido: boolean;
  andamentoResumo: string;

  // Step 1.9.7 Controladoria fields
  controladoriaMigrado: boolean;
  controladoriaData: string;
  controladoriaResponsavel: string;

  // Auditoria fields
  auditoriaJustifications?: Record<string, string>;
  auditoriaLogs?: string[];
  comprovanteDispensaJustificativa?: string;
  protocoloDriveLogs?: string[];
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
  comprovanteDispensaJustificativa: '',
  protocoloDriveLogs: [],

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
  prazoDependeClienteProva: false,
  prazoQualProva: '',

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

// CNJ Format: 0000000-00.0000.0.00.0000 (20 digits)
function formatCNJ(value: string) {
  const clean = value.replace(/\D/g, '').substring(0, 20);
  if (clean.length === 0) return '';
  
  let formatted = '';
  const n = clean.substring(0, 7);
  formatted = n;
  if (clean.length > 7) {
    const d = clean.substring(7, 9);
    formatted += '-' + d;
  }
  if (clean.length > 9) {
    const a = clean.substring(9, 13);
    formatted += '.' + a;
  }
  if (clean.length > 13) {
    const j = clean.substring(13, 14);
    formatted += '.' + j;
  }
  if (clean.length > 14) {
    const tr = clean.substring(14, 16);
    formatted += '.' + tr;
  }
  if (clean.length > 16) {
    const o = clean.substring(16, 20);
    formatted += '.' + o;
  }
  return formatted;
}

function computeAuditedItems(
  caseObj: any,
  client: any,
  evidenceRequests: any[],
  infoRequests: any[],
  justifications: Record<string, string>
) {
  const list: any[] = [];
  if (!caseObj) return list;

  const wiz = caseObj.solicitacoesProvasWizardState || {};
  const isPf = client?.type === 'PF';
  const isPj = client?.type === 'PJ';

  // 1. Procuração (Setor 05)
  const isProcSigned = (wiz.procuracaoFiles || caseObj.procuracaoFiles || []).length > 0 || wiz.q1_3 === 'sim';
  const hasProcUrl = !!caseObj.procuracaoGoogleDocsUrl;
  list.push({
    id: 'core_procuracao',
    name: 'Procuração Oficial',
    sector: '05 — Coleta de Provas',
    status: isProcSigned ? 'Juntado' : (hasProcUrl ? 'Recebido' : 'Pendente'),
    obs: 'Instrumento de procuração para representação de defesa.',
    responsible: 'Cliente',
    requestedAt: caseObj.createdAt || '',
    receivedAt: isProcSigned ? (caseObj.updatedAt || '') : '',
    isPendente: !isProcSigned
  });

  // 2. Declaração de Pobreza / Custas (Setor 05)
  const exigeCustas = wiz.q3_1 === 'sim';
  if (exigeCustas) {
    const hasGuiaDoc = (wiz.contratoFiles || []).length > 0 || caseObj.guiaCustasUrl || caseObj.guiaPaga === true;
    list.push({
      id: 'core_custas',
      name: 'Guia de Custas e Taxas Processuais',
      sector: '05 — Coleta de Provas',
      status: hasGuiaDoc ? 'Juntado' : 'Pendente',
      obs: 'Guia de recolhimento tributário e custas judiciais.',
      responsible: 'Cliente',
      requestedAt: caseObj.createdAt || '',
      receivedAt: hasGuiaDoc ? (caseObj.updatedAt || '') : '',
      isPendente: !hasGuiaDoc
    });
  } else {
    const isPobrezaSigned = (wiz.declaracaoFiles || caseObj.declaracaoFiles || []).length > 0 || wiz.q2_4 === 'sim';
    list.push({
      id: 'core_pobreza',
      name: 'Declaração de Pobreza (Gratuidade)',
      sector: '05 — Coleta de Provas',
      status: isPobrezaSigned ? 'Juntado' : 'Pendente',
      obs: 'Termo de declaração de pobreza para isenção de taxas.',
      responsible: 'Cliente',
      requestedAt: caseObj.createdAt || '',
      receivedAt: isPobrezaSigned ? (caseObj.updatedAt || '') : '',
      isPendente: !isPobrezaSigned
    });
  }

  // 3. RG (Setor 05 - PF only)
  if (isPf) {
    const hasRgFile = (wiz.rgFiles || []).length > 0 || wiz.q4_rg === 'sim';
    list.push({
      id: 'core_rg',
      name: 'Documento RG / Identidade Oficial',
      sector: '05 — Coleta de Provas',
      status: hasRgFile ? 'Juntado' : 'Pendente',
      obs: 'Documento civil de identificação do cliente.',
      responsible: 'Cliente',
      requestedAt: caseObj.createdAt || '',
      receivedAt: hasRgFile ? (caseObj.updatedAt || '') : '',
      isPendente: !hasRgFile
    });

    // 4. CPF (Setor 05 - PF only)
    const hasCpfFile = (wiz.cpfFiles || []).length > 0 || wiz.q4_cpf === 'sim';
    list.push({
      id: 'core_cpf',
      name: 'Comprovante de CPF',
      sector: '05 — Coleta de Provas',
      status: hasCpfFile ? 'Juntado' : 'Pendente',
      obs: 'Cadastro de Pessoa Física federal.',
      responsible: 'Cliente',
      requestedAt: caseObj.createdAt || '',
      receivedAt: hasCpfFile ? (caseObj.updatedAt || '') : '',
      isPendente: !hasCpfFile
    });
  }

  // 5. Contrato Social (Setor 05 - PJ only)
  if (isPj) {
    const hasContratoSoc = (wiz.contratoSocialFiles || []).length > 0 || wiz.q4_contrato_social === 'sim';
    list.push({
      id: 'core_contrato_social',
      name: 'Contrato Social Constitutivo',
      sector: '05 — Coleta de Provas',
      status: hasContratoSoc ? 'Juntado' : 'Pendente',
      obs: 'Estatuto constitutivo para comprovar poderes de representação societária.',
      responsible: 'Cliente',
      requestedAt: caseObj.createdAt || '',
      receivedAt: hasContratoSoc ? (caseObj.updatedAt || '') : '',
      isPendente: !hasContratoSoc
    });
  }

  // 6. Custom Evidence Requests (Setor 05 or Setor 12)
  evidenceRequests.forEach((req) => {
    const sectorLabel = req.evidenceType === 'adicional' || req.periciaType || req.isAdditional === true
      ? '12 — Solicitar + Provas'
      : '05 — Coleta de Provas';

    const isJuntado = req.status === 'aprovado' || req.status === 'arquivado';
    const isRecebido = req.status === 'enviado' || req.status === 'em_analise';
    const isDispensado = req.status === 'dispensado' || req.status === 'nao_se_aplica';

    list.push({
      id: req.id,
      name: req.title || 'Item de Prova',
      sector: sectorLabel,
      status: isJuntado ? 'Juntado' : (isRecebido ? 'Recebido' : (isDispensado ? 'Dispensado' : 'Pendente')),
      obs: req.description || 'Prova geral para fundamentação de mérito.',
      responsible: 'Cliente',
      requestedAt: req.createdAt || '',
      receivedAt: isJuntado || isRecebido ? (req.updatedAt || '') : '',
      isPendente: !isJuntado && !isDispensado
    });
  });

  // 7. Custom Information Requests (Setor 06)
  infoRequests.forEach((req) => {
    const isJuntado = req.status === 'conferido' || req.status === 'concluido' || req.status === 'aprovado' || !!req.clientAnswer || !!req.answer;
    const isRecebido = req.status === 'respondido' || req.status === 'em_analise';
    const isDispensado = req.status === 'arquivado' || req.status === 'dispensado';

    list.push({
      id: req.id,
      name: req.title || 'Solicitação de Informação',
      sector: '06 — Solicitar + Informações',
      status: isJuntado ? 'Juntado' : (isRecebido ? 'Recebido' : (isDispensado ? 'Dispensado' : 'Pendente')),
      obs: req.description || req.clientAnswer || 'Questão complementar de elucidação fática.',
      responsible: 'Cliente',
      requestedAt: req.createdAt || '',
      receivedAt: isJuntado || isRecebido ? (req.updatedAt || '') : '',
      isPendente: !isJuntado && !isDispensado
    });
  });

  return list.map(item => {
    const just = justifications[item.id];
    if (just && just.trim() && item.isPendente) {
      return {
        ...item,
        status: 'Dispensado',
        isPendente: false,
        justification: just
      };
    }
    return {
      ...item,
      justification: just || ''
    };
  });
}

export default function ProtocoloFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [protocol, setProtocol] = useState<ExtendedProtocolData>(DEFAULT_PROTOCOL);

  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [auditoriaJustifications, setAuditoriaJustifications] = useState<Record<string, string>>({});
  const [auditoriaLogs, setAuditoriaLogs] = useState<string[]>([]);
  const [showLogsConsole, setShowLogsConsole] = useState(false);

  const [activeSubetapa, setActiveSubetapa] = useState(1);

  // Google Drive Simulation states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadingError] = useState<string | null>(null);
  const [driveConfigError, setDriveConfigError] = useState(false);
  const [simulateUploadFail, setSimulateUploadFail] = useState(false);

  // Additional Inline State for Client & Ex-Adverso lists
  const [newClientInput, setNewClientInput] = useState('');
  const [newExAdversoInput, setNewExAdversoInput] = useState('');
  const [copiedFormula, setCopiedFormula] = useState(false);

  // Validation
  const isCNJValid = (value: string) => {
    return value.replace(/\D/g, '').length === 20;
  };

  const auditedItems = React.useMemo(() => {
    return computeAuditedItems(caseObj, client, evidenceRequests, infoRequests, auditoriaJustifications);
  }, [caseObj, client, evidenceRequests, infoRequests, auditoriaJustifications]);

  const logToAuditoria = async (message: string, currentJustifications = auditoriaJustifications) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logEntry = `[${timestamp}] ${message}`;
    const nextLogs = [logEntry, ...auditoriaLogs];
    setAuditoriaLogs(nextLogs);

    try {
      await updateDoc(doc(db, 'cases', caseId!), {
        'protocol.auditoriaLogs': nextLogs,
        'protocol.auditoriaJustifications': currentJustifications
      });
    } catch (err) {
      console.error("Erro ao gravar log da auditoria:", err);
    }
  };

  const handleUpdateJustification = (itemId: string, val: string) => {
    const updated = {
      ...auditoriaJustifications,
      [itemId]: val
    };
    setAuditoriaJustifications(updated);

    const item = auditedItems.find(i => i.id === itemId);
    const itemName = item ? item.name : itemId;
    const msg = val.trim() 
      ? `Justificativa registrada para o item "${itemName}": "${val.trim()}"`
      : `Justificativa removida para o item "${itemName}"`;
    logToAuditoria(msg, updated);
  };

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
        let cliData: any = null;
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            cliData = clientSnap.data();
            setClient(cliData);
            resolvedPrimaryClient = cliData.type === 'PF'
              ? (cliData.pfDadosPessoais?.pf_nomeCompleto || cliData.pfData?.pf_nomeCompleto || 'Cliente')
              : (cliData.pjDadosEmpresa?.pj_razaoSocial || cliData.pjData?.pj_razaoSocial || 'Cliente');
          }
        }

        const rawProtocol = cData.protocol || {};
        
        // Auto pull clientsList and pre-populate if empty
        let loadedClientsList = rawProtocol.clientsList || [];
        if (!Array.isArray(loadedClientsList) || loadedClientsList.length === 0) {
          loadedClientsList = [resolvedPrimaryClient];
        }

        // Auto pull defendant from EDRP structuring when empty
        let loadedExAdversosList = rawProtocol.exAdversosList || [];
        if (!Array.isArray(loadedExAdversosList) || loadedExAdversosList.length === 0) {
          const edrpDefs = cData.edrp?.structuring?.defendants;
          if (Array.isArray(edrpDefs) && edrpDefs.length > 0) {
            loadedExAdversosList = edrpDefs.map((d: any) => {
              if (d.type === 'PF') {
                return d.pfDadosPessoais?.pf_nomeCompleto || d.pf_nomeCompleto || '';
              } else {
                return d.pjDadosEmpresa?.pj_razaoSocial || d.pj_razaoSocial || '';
              }
            }).filter(Boolean);
          } else {
            const edrpDef = cData.edrp?.structuring?.defendant || {};
            let resolvedDefName = '';
            if (edrpDef.type === 'PF') {
              resolvedDefName = edrpDef.pfDadosPessoais?.pf_nomeCompleto || edrpDef.pf_nomeCompleto || '';
            } else if (edrpDef.type === 'PJ') {
              resolvedDefName = edrpDef.pjDadosEmpresa?.pj_razaoSocial || edrpDef.pj_razaoSocial || '';
            }
            if (!resolvedDefName && cData.opposingParty) {
              resolvedDefName = cData.opposingParty;
            }
            if (resolvedDefName) {
              loadedExAdversosList = [resolvedDefName];
            }
          }
        }

        const resolvedSubject = rawProtocol.subject || cData.subject || cData.edrp?.structuring?.notes || '';
        const resolvedCourt = rawProtocol.court || cData.court || cData.edrp?.structuring?.competence || '';
        const resolvedComarca = rawProtocol.comarca || cData.comarca || cData.edrp?.structuring?.comarca || '';

        const merged: ExtendedProtocolData = {
          protocolResponsible: rawProtocol.protocolResponsible || '',
          expectedProtocolDate: rawProtocol.expectedProtocolDate || '',
          actualProtocolDate: rawProtocol.actualProtocolDate || '',
          protocolSystem: rawProtocol.protocolSystem || '',
          protocolStatus: rawProtocol.protocolStatus || 'nao_preparado',
          processNumber: rawProtocol.processNumber || '',
          protocolReceiptName: rawProtocol.protocolReceiptName || '',
          protocolReceiptUrl: rawProtocol.protocolReceiptUrl || '',
          googleDriveFileId: rawProtocol.googleDriveFileId || '',
          googleDrivePrepared: rawProtocol.googleDrivePrepared || false,
          notes: rawProtocol.notes || '',
          convertedToJudicialCase: rawProtocol.convertedToJudicialCase || false,
          completedAt: rawProtocol.completedAt || '',
          updatedAt: rawProtocol.updatedAt ?? '',

          clientsList: loadedClientsList,
          exAdversosList: loadedExAdversosList,
          subject: resolvedSubject,
          court: resolvedCourt,
          comarca: resolvedComarca,

          periciaMarked: rawProtocol.periciaMarked ?? false,
          periciaDate: rawProtocol.periciaDate || '',
          periciaTime: rawProtocol.periciaTime || '',
          periciaLocal: rawProtocol.periciaLocal || '',
          periciaPerito: rawProtocol.periciaPerito || '',
          periciaType: rawProtocol.periciaType || 'presencial',
          periciaEscritorioComparecer: rawProtocol.periciaEscritorioComparecer ?? false,

          prazoMarked: rawProtocol.prazoMarked ?? false,
          prazoQual: rawProtocol.prazoQual || '',
          prazoFatal: rawProtocol.prazoFatal || '',
          prazoResponsavel: rawProtocol.prazoResponsavel || '',
          prazoSeguranca: rawProtocol.prazoSeguranca || '',
          prazoDependeClienteInfo: rawProtocol.prazoDependeClienteInfo ?? false,
          prazoQualInfo: rawProtocol.prazoQualInfo || '',
          prazoDependeClienteProva: rawProtocol.prazoDependeClienteProva ?? false,
          prazoQualProva: rawProtocol.prazoQualProva || '',

          audienciaMarked: rawProtocol.audienciaMarked ?? false,
          audienciaDate: rawProtocol.audienciaDate || '',
          audienciaTime: rawProtocol.audienciaTime || '',
          audienciaLocal: rawProtocol.audienciaLocal || '',
          audienciaJuizo: rawProtocol.audienciaJuizo || '',
          audienciaType: rawProtocol.audienciaType || 'presencial',
          audienciaPlatform: rawProtocol.audienciaPlatform || '',
          audienciaPlatformType: rawProtocol.audienciaPlatformType || 'zoom',
          audienciaLink: rawProtocol.audienciaLink || '',
          audienciaClienteAvisado: rawProtocol.audienciaClienteAvisado ?? false,

          contratoCriado: rawProtocol.contratoCriado ?? false,
          contratoValorTotal: rawProtocol.contratoValorTotal || '',
          contratoParcelas: rawProtocol.contratoParcelas || '',
          contratoVencimentoDia: rawProtocol.contratoVencimentoDia || '',
          contratoAssinado: rawProtocol.contratoAssinado ?? false,

          andamentoConferido: rawProtocol.andamentoConferido ?? false,
          andamentoResumo: rawProtocol.andamentoResumo || '',

          controladoriaMigrado: rawProtocol.controladoriaMigrado ?? false,
          controladoriaData: rawProtocol.controladoriaData || '',
          controladoriaResponsavel: rawProtocol.controladoriaResponsavel || '',
          comprovanteDispensaJustificativa: rawProtocol.comprovanteDispensaJustificativa || '',
          protocoloDriveLogs: rawProtocol.protocoloDriveLogs || []
        };

        setProtocol(merged);

        // 1. Fetch caseEvidenceRequests
        const qEv = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId!));
        const evSnap = await getDocs(qEv);
        const evList: any[] = [];
        evSnap.forEach((docSnap) => {
          evList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setEvidenceRequests(evList);

        // 2. Fetch caseInformationRequests
        const qInfo = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseId!));
        const infoSnap = await getDocs(qInfo);
        const infoList: any[] = [];
        infoSnap.forEach((docSnap) => {
          infoList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setInfoRequests(infoList);

        // 3. Load justifications and logs
        const loadedJustifications = rawProtocol.auditoriaJustifications || {};
        setAuditoriaJustifications(loadedJustifications);

        const initialLogs = rawProtocol.auditoriaLogs || [];
        if (initialLogs.length === 0) {
          const tempAudited = computeAuditedItems(cData, cliData, evList, infoList, loadedJustifications);
          const countAll = tempAudited.length;
          const countPending = tempAudited.filter((i: any) => i.isPendente).length;
          const countResolved = countAll - countPending;
          const timestamp = new Date().toLocaleString('pt-BR');
          const initialLog = `[${timestamp}] Auditoria inicializada na rota /protocolo. Total de itens monitorados: ${countAll}. Resolvidos: ${countResolved}. Pendentes: ${countPending}.`;
          setAuditoriaLogs([initialLog]);
        } else {
          setAuditoriaLogs(initialLogs);
        }
      } catch (err: any) {
        console.error(err);
        setError(`Erro ao buscar dados do protocolo: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleSyncFromStructuring = () => {
    if (!caseObj) return;

    const primaryClient = client
      ? (client.type === 'PF'
          ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || '')
          : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || ''))
      : '';

    let resolvedDefNames: string[] = [];
    const edrpDefs = caseObj.edrp?.structuring?.defendants;
    if (Array.isArray(edrpDefs) && edrpDefs.length > 0) {
      resolvedDefNames = edrpDefs.map((d: any) => {
        if (d.type === 'PF') {
          return d.pfDadosPessoais?.pf_nomeCompleto || d.pf_nomeCompleto || '';
        } else {
          return d.pjDadosEmpresa?.pj_razaoSocial || d.pj_razaoSocial || '';
        }
      }).filter(Boolean);
    } else {
      const edrpDef = caseObj.edrp?.structuring?.defendant || {};
      let resolvedDefName = '';
      if (edrpDef.type === 'PF') {
        resolvedDefName = edrpDef.pf_nomeCompleto || '';
      } else if (edrpDef.type === 'PJ') {
        resolvedDefName = edrpDef.pj_razaoSocial || '';
      }
      if (!resolvedDefName && caseObj.opposingParty) {
        resolvedDefName = caseObj.opposingParty;
      }
      if (resolvedDefName) {
        resolvedDefNames = [resolvedDefName];
      }
    }

    const resolvedSubject = caseObj.subject || caseObj.edrp?.structuring?.notes || '';
    const resolvedCourt = caseObj.court || caseObj.edrp?.structuring?.competence || '';
    const resolvedComarca = caseObj.comarca || caseObj.edrp?.structuring?.comarca || '';

    setProtocol((prev) => ({
      ...prev,
      clientsList: prev.clientsList.length === 0 && primaryClient ? [primaryClient] : prev.clientsList,
      exAdversosList: prev.exAdversosList.length === 0 && resolvedDefNames.length > 0 ? resolvedDefNames : prev.exAdversosList,
      subject: prev.subject || resolvedSubject,
      court: prev.court || resolvedCourt,
      comarca: prev.comarca || resolvedComarca
    }));

    setSuccess('Sincronizados com sucesso os dados de Autor, Ré, Assunto, Vara e Comarca definidos na estruturação!');
  };

  const handleChange = (field: keyof ExtendedProtocolData, value: any) => {
    setProtocol((prev) => {
      let val = value;
      if (field === 'processNumber') {
        val = formatCNJ(value);
      }
      return { ...prev, [field]: val };
    });
  };

  // Helper lists handlers
  const handleAddClient = () => {
    if (!newClientInput.trim()) return;
    setProtocol((prev) => ({
      ...prev,
      clientsList: [...prev.clientsList, newClientInput.trim()]
    }));
    setNewClientInput('');
  };

  const handleRemoveClient = (index: number) => {
    setProtocol((prev) => ({
      ...prev,
      clientsList: prev.clientsList.filter((_, idx) => idx !== index)
    }));
  };

  const handleAddExAdverso = () => {
    if (!newExAdversoInput.trim()) return;
    setProtocol((prev) => ({
      ...prev,
      exAdversosList: [...prev.exAdversosList, newExAdversoInput.trim()]
    }));
    setNewExAdversoInput('');
  };

  const handleRemoveExAdverso = (index: number) => {
    setProtocol((prev) => ({
      ...prev,
      exAdversosList: prev.exAdversosList.filter((_, idx) => idx !== index)
    }));
  };

  const logToDrive = (message: string, currentLogs: string[] = protocol.protocoloDriveLogs || []) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logEntry = `[${timestamp}] ${message}`;
    const nextLogs = [logEntry, ...currentLogs];
    setProtocol(prev => ({
      ...prev,
      protocoloDriveLogs: nextLogs
    }));
    return nextLogs;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadingError(null);

    const originalName = file.name;
    let currentLogs = protocol.protocoloDriveLogs || [];

    // Log the initial attempt
    currentLogs = logToDrive(`Tentativa de upload iniciada. Arquivo original: "${originalName}"`, currentLogs);

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (driveConfigError) {
      const errorMsg = "Erro: Integração com o Google Drive não está configurada no painel de configurações.";
      setUploadingError(errorMsg);
      logToDrive(`FALHA NO UPLOAD: ${errorMsg}`, currentLogs);
      setUploading(false);
      return;
    }

    if (simulateUploadFail) {
      const errorMsg = "Erro de rede: Falha ao enviar arquivo para o Google Drive. Tente novamente.";
      setUploadingError(errorMsg);
      logToDrive(`FALHA NO UPLOAD: ${errorMsg}`, currentLogs);
      setUploading(false);
      return;
    }

    // Dynamic extraction of name elements
    const clientPart = protocol.clientsList.length > 0 ? protocol.clientsList.join(' & ') : (resolvedClientName || 'não informado');
    const vsPart = protocol.exAdversosList.length > 0 ? protocol.exAdversosList.join(' & ') : 'não informado';
    const cnjPart = protocol.processNumber || 'não informado';
    const courtPart = protocol.court || 'não informado';
    const comarcaPart = protocol.comarca || 'não informado';

    const extIdx = originalName.lastIndexOf('.');
    const ext = extIdx !== -1 ? originalName.substring(extIdx) : '.pdf';

    // Rename file pattern
    const rawRenamed = `Distribuição - Comprovante de Protocolo - ${clientPart} x ${vsPart} - ${cnjPart} - ${courtPart} - ${comarcaPart}${ext}`;
    // Remove invalid file name characters
    const renamedName = rawRenamed.replace(/[\\/:*?"<>|]/g, '-');

    const fakeFileId = `drive_file_${Math.random().toString(36).substring(2, 11)}`;
    const fakeFileUrl = `https://drive.google.com/file/d/${fakeFileId}/view`;

    const nextLogs = [
      `[${new Date().toLocaleString('pt-BR')}] SUCESSO: Upload concluído. Comprovante enviado ao Google Drive com ID: "${fakeFileId}"`,
      `[${new Date().toLocaleString('pt-BR')}] Renomeação automática concluída. Nome final: "${renamedName}"`,
      ...currentLogs
    ];

    const updatedProtocol = {
      ...protocol,
      protocolReceiptName: renamedName,
      protocolReceiptUrl: fakeFileUrl,
      googleDriveFileId: fakeFileId,
      googleDrivePrepared: true,
      protocoloDriveLogs: nextLogs
    };

    setProtocol(updatedProtocol);
    setUploading(false);

    // Persist automatically to Firestore
    try {
      await updateDoc(doc(db, 'cases', caseId!), {
        protocol: updatedProtocol
      });
      setSuccess('Comprovante enviado e salvo com sucesso no Google Drive!');
    } catch (err: any) {
      console.error("Erro ao salvar comprovante no firestore:", err);
      setError(`Erro ao salvar comprovante: ${err.message || err}`);
    }
  };

  // Formula generator
  const generatedTodoistFormula = `[${protocol.clientsList.join(' & ')}] x [${protocol.exAdversosList.join(' & ')}] - [${protocol.subject || 'Assunto'}] - [${protocol.processNumber || 'Sem CNJ'}] - [${protocol.court || 'Sem Vara'}] - [${protocol.comarca || 'Sem Comarca'}]`;

  const copyTodoistFormula = () => {
    navigator.clipboard.writeText(generatedTodoistFormula);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 2000);
  };

  const handleSave = async (silent = false, action: 'none' | 'exit' | 'advance' = 'none') => {
    if (!caseId) return false;
    setSaving(true);
    setError(null);
    if (!silent) setSuccess(null);

    // CRITICAL: Prevent progress or save validation if CNJ has not been filled out with exactly 20 digits.
    if (!isCNJValid(protocol.processNumber)) {
      setError('🚨 O número do processo (CNJ) é obrigatório e de preenchimento obrigatório com exatamente 20 dígitos.');
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    const currentAudited = computeAuditedItems(caseObj, client, evidenceRequests, infoRequests, auditoriaJustifications);
    const pendingItems = currentAudited.filter((i) => i.isPendente);

    if ((action === 'advance' || protocol.protocolStatus === 'protocolado') && pendingItems.length > 0) {
      const timestamp = new Date().toLocaleString('pt-BR');
      const logMsg = `[${timestamp}] BLOQUEIO DE SALVAMENTO: Tentativa de finalizar ou avançar com ${pendingItems.length} pendências ativas.`;
      const nextLogs = [logMsg, ...auditoriaLogs];
      setAuditoriaLogs(nextLogs);
      
      try {
        await updateDoc(doc(db, 'cases', caseId!), {
          'protocol.auditoriaLogs': nextLogs
        });
      } catch (err) {
        console.error("Erro ao salvar log de bloqueio:", err);
      }

      setError(`🚨 Ação bloqueada pela Auditoria: Existem ${pendingItems.length} pendências ativas nos setores 05, 06 ou 12. Você precisa de conferência fática real ou deve justificar formalmente cada item para prosseguir.`);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    const isSubetapa3Pendente = !protocol.protocolReceiptUrl && !protocol.protocolReceiptName;
    if ((action === 'advance' || protocol.protocolStatus === 'protocolado') && isSubetapa3Pendente) {
      if (!protocol.comprovanteDispensaJustificativa?.trim()) {
        setError('⚠️ Atenção: o comprovante de distribuição/protocolo ainda não foi enviado na Subetapa 03. Para prosseguir sem o comprovante, preencha a Justificativa de Dispensa.');
        setSaving(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
      } else {
        const timestamp = new Date().toLocaleString('pt-BR');
        const justLogMsg = `[${timestamp}] Justificativa de Dispensa: Protocolo concluído sem comprovante. Motivo: "${protocol.comprovanteDispensaJustificativa.trim()}"`;
        if (!protocol.protocoloDriveLogs) {
          protocol.protocoloDriveLogs = [];
        }
        if (!protocol.protocoloDriveLogs.includes(justLogMsg)) {
          protocol.protocoloDriveLogs = [justLogMsg, ...protocol.protocoloDriveLogs];
        }
      }
    }

    try {
      const now = new Date().toISOString();
      const timestamp = new Date().toLocaleString('pt-BR');
      const logMsg = `[${timestamp}] SUCESSO: Protocolo salvo. Todas as pendências de auditoria foram devidamente saneadas ou justificadas.`;
      const nextLogs = [logMsg, ...auditoriaLogs];
      setAuditoriaLogs(nextLogs);

      const updatedProtocol: ExtendedProtocolData = {
        ...protocol,
        auditoriaJustifications,
        auditoriaLogs: nextLogs,
        completedAt: protocol.protocolStatus === 'protocolado' ? (protocol.completedAt || now) : '',
        updatedAt: now
      };

      const payload: any = {
        protocol: updatedProtocol,
        processNumber: protocol.processNumber,
        updatedAt: now
      };

      // Handle transition rules
      const isInitialField = caseObj?.registrationTypeKey === 'peticao_inicial';
      if (isInitialField && protocol.protocolStatus === 'protocolado') {
        updatedProtocol.convertedToJudicialCase = true;
        payload.registrationTypeKey = 'processo_judicial_ajuizado';
        payload.registrationType = 'Processo Judicial Ajuizado';
        payload.actionCategory = 'judicial';
        payload.statusPublicoCliente = `Processo nº ${protocol.processNumber}`;
        payload.statusInterno = 'Protocolado';
        payload.caseLifecycle = 'caso';
      }

      if (action === 'advance') {
        payload.productionStage = 'controladoria';
        payload.statusInterno = 'Em controladoria';
      } else {
        payload.statusInterno = protocol.protocolStatus === 'protocolado' ? 'Protocolado' : (caseObj?.statusInterno || 'Aguardando protocolo');
      }

      await updateDoc(doc(db, 'cases', caseId!), payload);

      setCaseObj((prev: any) => ({
        ...prev,
        ...payload,
        protocol: updatedProtocol
      }));

      if (!silent) {
        setSuccess('Etapa 1.9 Protocolo e Distribuição salva de forma exemplar no Connect!');
      }

      if (action === 'exit') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      } else if (action === 'advance') {
        navigate(flowRoutes.controladoria(caseId!));
      }

      return true;
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar protocolo: ${err.message || err}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Protocolo / Distribuição" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-gray-900" size={28} />
          <span className="text-xs font-bold font-mono tracking-wide uppercase">
            Carregando Sincronizador de Protocolo...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PF'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome')
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente'))
    : 'Buscando Cliente...';

  const resolvedClientSlug = client?.slug || 'sem-slug';

  return (
    <FluxoStepLayout
      stepName="Protocolo"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Aguardando protocolo'}
    >
      <div className="space-y-8 font-sans">
        
        {/* Alerts & Errors */}
        {error && (
          <div className="p-5 bg-red-50 border border-red-150 rounded-2xl text-red-955 text-xs flex gap-3 items-center shadow-xs">
            <AlertCircle size={18} className="text-red-650 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center shadow-xs">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* DETAILS PANEL */}
        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
                {resolvedClientSlug}
              </span>
              <h4 className="text-sm font-extrabold text-gray-900 leading-tight">
                {resolvedClientName}
              </h4>
              <p className="text-[11px] text-gray-450 font-medium">
                Caso vinculado: <strong className="text-gray-700 font-mono">{caseId}</strong> • Tipo Original: <strong className="text-indigo-600">{caseObj?.registrationType || 'Não Definido'}</strong>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSyncFromStructuring}
                className="text-[10px] font-bold px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-750 hover:bg-indigo-100/80 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers size={13} />
                Sincronizar Estruturação
              </button>
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-gray-150 bg-white text-gray-700 flex items-center">
                Fase do Caso: {caseObj?.productionStage || 'protocolo'}
              </span>
            </div>
          </div>
        </div>

        {/* METRICS / DIGITAL CASE FILE DISPLAY */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm border border-slate-950 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layers className="text-indigo-400" size={18} />
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-300">Resumo do Protocolo Cadastrado</h4>
              <p className="text-[9.5px] text-slate-400">Esta é a mesma informação oficial fática que aparecerá no setor de Controladoria e de Auditoria.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="space-y-1">
              <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">Autor da Ação</span>
              <p className="font-bold text-slate-100 break-words">
                {protocol.clientsList.length > 0 ? protocol.clientsList.join(' & ') : <span className="text-slate-500 italic">Vazio fático</span>}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">Parte Ré / Ex-Adverso</span>
              <p className="font-bold text-slate-100 break-words">
                {protocol.exAdversosList.length > 0 ? protocol.exAdversosList.join(' & ') : <span className="text-slate-500 italic">Vazio fático</span>}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">Assunto Principal</span>
              <p className="font-bold text-slate-100 break-words">
                {protocol.subject || <span className="text-slate-500 italic">Preencher na Subetapa 1</span>}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">Vara / Órgão do Tribunal</span>
              <p className="font-bold text-slate-100 break-words">
                {protocol.court || <span className="text-slate-500 italic">Preencher na Subetapa 1</span>}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">Comarca de Jurisdição</span>
              <p className="font-bold text-slate-100 break-words">
                {protocol.comarca || <span className="text-slate-500 italic">Preencher na Subetapa 1</span>}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-rose-400 font-bold block uppercase tracking-wider">Distribuição (Número CNJ)</span>
              <p className="font-mono font-bold text-rose-100">
                {protocol.processNumber || <span className="text-slate-500 italic">Preenchimento obrigatório</span>}
              </p>
            </div>
          </div>
        </div>

        {/* AUDITORIA DE JUNTADA DE PROVAS E INFORMAÇÕES */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                  Auditoria de Juntada de Provas e Informações
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Análise automática de pendências nos setores 05, 06 e 12 antes da conclusão do protocolo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const countAll = auditedItems.length;
                const countPending = auditedItems.filter((i: any) => i.isPendente).length;
                const countResolved = countAll - countPending;
                await logToAuditoria(`Re-execução manual da auditoria. Total de itens monitorados: ${countAll}. Resolvidos: ${countResolved}. Pendentes: ${countPending}.`);
                setSuccess('Auditoria atualizada com sucesso!');
                setTimeout(() => setSuccess(null), 3000);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold transition-all flex items-center gap-1.5 text-gray-700 cursor-pointer"
            >
              <RefreshCw size={12} />
              Forçar Re-auditoria
            </button>
          </div>

          {auditedItems.filter(i => i.isPendente).length > 0 ? (
            <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-red-955 text-xs space-y-1.5 animate-pulse">
              <div className="flex items-center gap-2 font-black uppercase text-red-800">
                <AlertCircle size={15} />
                <span>Bloqueio de Auditoria Ativo</span>
              </div>
              <p className="font-semibold leading-relaxed">
                Existem {auditedItems.filter(i => i.isPendente).length} pendência(s) ativa(s). O salvamento final/avanço está bloqueado. Junte o arquivo correspondente nas etapas anteriores ou forneça uma justificativa formal abaixo.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-950 text-xs space-y-1">
              <div className="flex items-center gap-2 font-black uppercase text-emerald-800">
                <CheckCircle2 size={15} />
                <span>Auditoria Aprovada</span>
              </div>
              <p className="font-semibold">
                Nenhuma pendência relevante nos setores 05, 06 ou 12. O protocolo está liberado para encerramento.
              </p>
            </div>
          )}

          {/* ITEM LIST */}
          <div className="overflow-hidden border border-gray-150 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider font-black text-[10px] border-b border-gray-150">
                  <th className="p-3.5 pl-4 w-1/3">Item Monitorado</th>
                  <th className="p-3.5">Setor de Origem</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Responsável / Datas</th>
                  <th className="p-3.5 pr-4 w-1/4">Justificativa de Dispensa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 font-semibold italic">
                      Nenhum item monitorado encontrado para este caso.
                    </td>
                  </tr>
                ) : (
                  auditedItems.map((item) => {
                    const statusColors: Record<string, string> = {
                      'Juntado': 'bg-emerald-600 text-white',
                      'Recebido': 'bg-blue-600 text-white',
                      'Dispensado': 'bg-slate-500 text-white',
                      'Pendente': 'bg-red-500 text-white',
                      'Não se aplica': 'bg-gray-400 text-white'
                    };

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 pl-4 space-y-1">
                          <span className="font-extrabold text-gray-900 block">{item.name}</span>
                          <span className="text-[10.5px] text-gray-400 block font-medium leading-relaxed">
                            {item.obs}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-black uppercase text-indigo-750 font-mono tracking-wide bg-indigo-50/60 px-2 py-0.5 rounded">
                            {item.sector}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${statusColors[item.status] || 'bg-gray-500'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 space-y-1 font-medium text-gray-500 text-[11px]">
                          <div>Resp: <strong className="text-gray-800">{item.responsible}</strong></div>
                          {item.requestedAt && (
                            <div>Solicitado: <span className="font-mono">{new Date(item.requestedAt).toLocaleDateString('pt-BR')}</span></div>
                          )}
                          {item.receivedAt && (
                            <div>Recebido: <span className="font-mono">{new Date(item.receivedAt).toLocaleDateString('pt-BR')}</span></div>
                          )}
                        </td>
                        <td className="p-4 pr-4">
                          {item.isPendente || item.status === 'Dispensado' ? (
                            <textarea
                              value={item.justification || ''}
                              onChange={(e) => handleUpdateJustification(item.id, e.target.value)}
                              placeholder="Justifique formalmente o prosseguimento sem este item..."
                              className="w-full bg-white border border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-lg p-2 text-[11px] font-medium placeholder-gray-300 min-h-[60px] resize-none"
                            />
                          ) : (
                            <span className="text-[10.5px] text-emerald-600 font-bold block bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center">
                              ✓ Item sanado nos autos
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* LOG TÉCNICO CONSOLE */}
          <div className="border border-gray-150 rounded-2xl overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setShowLogsConsole(!showLogsConsole)}
              className="w-full flex items-center justify-between p-4 bg-gray-100/70 hover:bg-gray-100 transition-all font-bold text-xs text-gray-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <FileText size={14} className="text-gray-500" />
                Log Técnico da Auditoria ({auditoriaLogs.length} registros)
              </span>
              <span className="text-[10px] uppercase font-black text-gray-400">
                {showLogsConsole ? 'Ocultar Terminal ▲' : 'Expandir Terminal ▼'}
              </span>
            </button>

            {showLogsConsole && (
              <div className="p-4 bg-slate-900 border-t border-gray-200 font-mono text-[10px] text-slate-300 space-y-1.5 max-h-[180px] overflow-y-auto leading-relaxed scrollbar-thin">
                {auditoriaLogs.map((log, index) => (
                  <div key={index} className="flex gap-2.5">
                    <span className="text-indigo-400 shrink-0 font-bold">›</span>
                    <span className="whitespace-pre-wrap">{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SUBETAPA CONTAINER SYSTEM */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Side navigation matching professional UX */}
          <div className="lg:col-span-4 bg-white border border-gray-150 rounded-3xl p-4.5 space-y-2">
            <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400 px-3.5 pb-2.5 border-b border-gray-100/60 mb-2">Subetapas do Protocolo</span>
            
            {[
              { id: 1, title: '1. Cadastrar Protocolo', desc: 'Dados do processo / CNJ', icon: FileText },
              { id: 2, title: '2. Conferir Andamento', desc: 'Certidão recente de trâmite', icon: FileCheck },
              { id: 3, title: '3. Enviar Comprovante', desc: 'Google Drive Upload', icon: HardDrive },
              { id: 4, title: '4. Integração Todoist', desc: 'Programação futura', icon: Activity },
            ].map((sub) => {
              const isActive = activeSubetapa === sub.id;
              
              // Helper complete logic
              let isComplete = false;
              if (sub.id === 1) {
                isComplete = protocol.clientsList.length > 0 && isCNJValid(protocol.processNumber);
              } else if (sub.id === 2) {
                isComplete = !protocol.andamentoConferido || (protocol.andamentoConferido && !!protocol.andamentoResumo);
              } else if (sub.id === 3) {
                isComplete = !!protocol.protocolReceiptUrl || !!protocol.comprovanteDispensaJustificativa?.trim();
              } else if (sub.id === 4) {
                isComplete = true;
              }

              const IconComponent = sub.icon;

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubetapa(sub.id)}
                  className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all text-xs font-semibold cursor-pointer border ${
                    isActive
                      ? 'bg-slate-900 border-slate-950 text-white shadow-sm'
                      : 'bg-white border-transparent hover:border-gray-150 text-gray-700'
                  }`}
                >
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 border ${
                    isActive 
                      ? 'bg-slate-800 border-slate-700 text-indigo-300' 
                      : isComplete 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                        : 'bg-gray-50 border-gray-150 text-gray-500'
                  }`}>
                    {isComplete ? <CheckSquare size={13} /> : <IconComponent size={14} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`block font-black uppercase text-[10px] tracking-tight leading-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>
                      {sub.title}
                    </span>
                    <span className={`block font-medium text-[9.5px] mt-0.5 truncate ${isActive ? 'text-slate-400' : 'text-gray-400'}`}>
                      {sub.desc}
                    </span>
                  </div>

                  {isComplete && !isActive && (
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active section block */}
          <div className="lg:col-span-8 space-y-6">

                       {activeSubetapa === 1 && (
              <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                      01
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Subetapa 1 — Cadastrar Protocolo</h3>
                      <p className="text-[10.5px] text-gray-400">Insira a distribuição judicial para vincular o CNJ e sincronizar os registros.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncFromStructuring}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-750 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-3xs"
                  >
                    <RefreshCw size={12} />
                    <span>Puxar Dados Automaticamente</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Autor input */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-550">Relação de Autores / Clientes *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newClientInput}
                        onChange={(e) => setNewClientInput(e.target.value)}
                        placeholder="Adicionar autor"
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddClient}
                        className="px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {protocol.clientsList.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Vazio. Clique em "Puxar Dados Automaticamente".</span>
                      ) : (
                        protocol.clientsList.map((c, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-150 text-indigo-750 text-xs font-bold rounded-xl">
                            <span>{c}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveClient(idx)}
                              className="text-indigo-400 hover:text-indigo-800 font-bold text-[11px] font-sans"
                            >
                              &times;
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Ré input */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-550">Relação de Réus / Ex-Adversos</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newExAdversoInput}
                        onChange={(e) => setNewExAdversoInput(e.target.value)}
                        placeholder="Adicionar réu / ex-adverso"
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddExAdverso}
                        className="px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {protocol.exAdversosList.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Adicione réus ou clique em "Puxar Dados".</span>
                      ) : (
                        protocol.exAdversosList.map((exa, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-150 text-red-750 text-xs font-bold rounded-xl">
                            <span>{exa}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExAdverso(idx)}
                              className="text-red-400 hover:text-red-800 font-bold text-[11px] font-sans"
                            >
                              &times;
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Assunto Principal *</label>
                    <input
                      type="text"
                      value={protocol.subject}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      placeholder="Ex: Concessão de BPC LOAS"
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Vara / Órgão do Tribunal *</label>
                    <input
                      type="text"
                      value={protocol.court}
                      onChange={(e) => handleChange('court', e.target.value)}
                      placeholder="Ex: 5ª Vara Previdenciária Federal"
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Comarca de Jurisdição *</label>
                    <input
                      type="text"
                      value={protocol.comarca}
                      onChange={(e) => handleChange('comarca', e.target.value)}
                      placeholder="Ex: Curitiba - PR"
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-red-500">
                      Número do Processo de Distribuição (CNJ) *
                    </label>
                    {isCNJValid(protocol.processNumber) ? (
                      <span className="text-[9px] text-emerald-600 font-black tracking-widest uppercase font-mono">CNJ Preenchido com 20 dígitos</span>
                    ) : (
                      <span className="text-[9px] text-red-500 font-black tracking-widest uppercase font-mono">Faltam {20 - protocol.processNumber.replace(/\D/g, '').length} dígitos</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={protocol.processNumber}
                    onChange={(e) => handleChange('processNumber', e.target.value)}
                    placeholder="0000000-00.0000.0.00.0000"
                    className={`w-full bg-white border focus:ring-1 rounded-xl px-3.5 py-3 text-xs font-mono font-bold transition-all ${
                      isCNJValid(protocol.processNumber) 
                        ? 'border-emerald-250 focus:border-emerald-600 focus:ring-emerald-600 text-emerald-950' 
                        : 'border-red-250 focus:border-indigo-650 focus:ring-indigo-650'
                    }`}
                  />
                </div>

                {/* VER PROTOCOLO CADASTRADO PREVIEW (exactly same layout shown in controladoria) */}
                {isCNJValid(protocol.processNumber) && (
                  <div className="border border-emerald-150 bg-emerald-50/20 p-5 rounded-2xl space-y-3.5 animate-in slide-in-from-top-3 duration-200">
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      Visualizar Protocolo Cadastrado
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-gray-700">
                      <div>
                        <span className="text-[9px] text-gray-400 block font-black uppercase">Autor(es) / Clientes</span>
                        <span className="text-gray-900 font-bold">{protocol.clientsList.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 block font-black uppercase">Réu(s) / Adversários</span>
                        <span className="text-gray-900 font-bold">{protocol.exAdversosList.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 block font-black uppercase">Assunto Definido</span>
                        <span className="text-gray-900 font-bold">{protocol.subject}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 block font-black uppercase">Vara / Comarca</span>
                        <span className="text-gray-900 font-bold">{protocol.court} — {protocol.comarca}</span>
                      </div>
                      <div className="sm:col-span-2 p-3 bg-white border border-emerald-100 rounded-xl inline-flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-emerald-600 block font-black uppercase font-sans">Número Único CNJ Distribuído</span>
                          <span className="text-emerald-900 font-mono font-black text-[13px]">{protocol.processNumber}</span>
                        </div>
                        <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-2.5 py-1 rounded-lg">REGISTRADO</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Formula generator copy banner */}
                <div className="bg-slate-900 border border-slate-950 rounded-2xl p-5 text-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono tracking-widest font-black uppercase text-indigo-400 bg-indigo-950/85 px-2 py-0.5 rounded">
                      Fórmula Todoist de Organização Comercial
                    </span>
                    <p className="text-[11px] text-slate-100 font-mono font-bold break-all leading-normal">
                      {generatedTodoistFormula}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={copyTodoistFormula}
                    className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase bg-slate-800 hover:bg-slate-750 text-white shrink-0 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    {copiedFormula ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedFormula ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUBETAPA 2: RECENT UPDATES / ANDAMENTO */}
            {activeSubetapa === 2 && (
              <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                      02
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Subetapa 2 — Conferir Andamento Processual</h3>
                      <p className="text-[10.5px] text-gray-400">Verifique nos portais judiciais se houve nova publicação ou andamento relevante.</p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
                    <button
                      type="button"
                      onClick={() => handleChange('andamentoConferido', true)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        protocol.andamentoConferido ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Conferido
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('andamentoConferido', false)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        !protocol.andamentoConferido ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Pendente
                    </button>
                  </div>
                </div>

                {protocol.andamentoConferido ? (
                  <div className="space-y-1.5 animate-in slide-in-from-top-3 duration-200">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Resumo da Última Movimentação Judicial Encontrada</label>
                    <textarea
                      value={protocol.andamentoResumo}
                      onChange={(e) => handleChange('andamentoResumo', e.target.value)}
                      placeholder="Ex: Conclusos para decisão, despachado, expedida intimação..."
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-xs text-gray-800 font-medium placeholder-gray-300 min-h-[90px]"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-150 text-gray-500 rounded-2xl text-xs text-center font-semibold">
                    Certidão de movimentação judicial recente pendente nos autos.
                  </div>
                )}
              </div>
            )}

            {activeSubetapa === 3 && (
              <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                      03
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Subetapa 3 — Comprovante de Distribuição</h3>
                      <p className="text-[10.5px] text-gray-400">Envio automático do comprovante padronizado ao Google Drive.</p>
                    </div>
                  </div>
                </div>

                {/* Simulation Control Board */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-gray-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                      Painel de Simulação de Erros (Teste de Integração)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={driveConfigError}
                        onChange={(e) => setDriveConfigError(e.target.checked)}
                        className="rounded border-gray-350 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Simular Integração Não Configurada</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={simulateUploadFail}
                        onChange={(e) => setSimulateUploadFail(e.target.checked)}
                        className="rounded border-gray-350 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Simular Falha de Envio (Upload Error)</span>
                    </label>
                  </div>
                </div>

                {/* Main upload UI */}
                {protocol.protocolReceiptUrl ? (
                  <div className="p-5 border border-emerald-150 bg-emerald-50/20 rounded-2xl space-y-4 animate-in zoom-in-95 duration-150">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                        <HardDrive size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-[8px] font-black uppercase text-emerald-600 tracking-wider font-mono">
                          Comprovante no Google Drive
                        </span>
                        <h4 className="text-xs font-black text-gray-900 break-all leading-normal mt-0.5">
                          {protocol.protocolReceiptName}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-1">
                          Google Drive File ID: {protocol.googleDriveFileId}
                        </p>
                      </div>
                      <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-md shrink-0">
                        Enviado
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-100/60">
                      <a
                        href={protocol.protocolReceiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10.5px] transition-all cursor-pointer shadow-3xs"
                      >
                        <ExternalLink size={13} />
                        Visualizar no Google Drive
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = {
                            ...protocol,
                            protocolReceiptName: '',
                            protocolReceiptUrl: '',
                            googleDriveFileId: '',
                            googleDrivePrepared: false,
                          };
                          setProtocol(updated);
                          logToDrive("Comprovante de distribuição removido pelo usuário.");
                          try {
                            await updateDoc(doc(db, 'cases', caseId!), {
                              protocol: updated
                            });
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 font-bold rounded-xl text-[10.5px] transition-all cursor-pointer"
                      >
                        Remover Arquivo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pending Alert banner */}
                    <div className="p-4 bg-amber-50 border border-amber-150 rounded-2xl text-amber-950 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div>
                        <span className="font-extrabold uppercase text-amber-950 block mb-0.5">
                          ⚠️ Atenção: comprovante pendente
                        </span>
                        <p className="font-semibold leading-relaxed">
                          O comprovante de distribuição/protocolo ainda não foi enviado ao Google Drive. 
                          Se você concluir este protocolo, deve obrigatoriamente preencher uma justificativa formal abaixo.
                        </p>
                      </div>
                    </div>

                    {/* Drag & Drop File Input */}
                    <div className="relative border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-3xl p-8 text-center bg-gray-50/50 hover:bg-white transition-all">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-1">
                          <Upload size={22} className={uploading ? "animate-bounce" : ""} />
                        </div>
                        <p className="text-xs font-bold text-gray-800">
                          {uploading ? "Enviando arquivo ao Google Drive..." : "Arraste ou clique para enviar o Comprovante"}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          O arquivo será renomeado automaticamente seguindo as diretrizes técnicas do escritório.
                        </p>
                      </div>
                    </div>

                    {uploadError && (
                      <div className="p-3 bg-red-50 border border-red-150 text-red-955 text-xs font-semibold rounded-xl flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-700" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {/* Justification of dispensa */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <label className="block text-[10.5px] font-black uppercase tracking-wider text-gray-550">
                        Justificativa de Dispensa (Obrigatório caso avance sem comprovante)
                      </label>
                      <textarea
                        value={protocol.comprovanteDispensaJustificativa}
                        onChange={(e) => handleChange('comprovanteDispensaJustificativa', e.target.value)}
                        placeholder="Ex: Processo de urgência protocolado no plantão sem emissão automática de comprovante, aguardando validação do distribuidor judiciário..."
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-xs text-gray-800 font-medium placeholder-gray-300 min-h-[85px]"
                      />
                    </div>
                  </div>
                )}

                {/* Subetapa 3 drive technical logs panel */}
                <div className="border border-gray-150 rounded-2xl overflow-hidden bg-slate-950 font-mono text-[9.5px] text-slate-300">
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between font-sans">
                    <span className="font-extrabold uppercase text-[9px] tracking-wider text-slate-400">
                      Logs de Transmissão do Google Drive
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[8px] text-indigo-400 font-black uppercase">
                      Integrado
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1.5 max-h-[140px] overflow-y-auto leading-relaxed">
                    {(!protocol.protocoloDriveLogs || protocol.protocoloDriveLogs.length === 0) ? (
                      <div className="text-slate-500 italic">Nenhum evento registrado ainda para esta subetapa.</div>
                    ) : (
                      protocol.protocoloDriveLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-indigo-400 shrink-0">›</span>
                          <span className="whitespace-pre-wrap">{log}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubetapa === 4 && (
              <div className="border border-red-150 rounded-3xl p-6 space-y-6 bg-red-50/10 shadow-3xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-red-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                      04
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Subetapa 4 — Integração Todoist</h3>
                      <p className="text-[10.5px] text-gray-400">Vincular e gerenciar tarefas comerciais integradas.</p>
                    </div>
                  </div>
                </div>

                {/* Reserved Space (Red Block) */}
                <div className="border border-red-300 bg-red-50/35 p-6 rounded-2xl space-y-3.5 animate-pulse">
                  <div className="flex items-center gap-2.5 text-red-750 font-black uppercase tracking-wider text-xs">
                    <Activity size={16} />
                    <span>⚠️ Espaço Reservado — Futura Integração Todoist</span>
                  </div>
                  <p className="text-[11px] text-red-900 font-semibold leading-relaxed">
                    Este espaço está reservado exclusivamente para a futura comunicação bidirecional com a API do Todoist.
                  </p>
                  <p className="text-[11px] text-red-900/80 font-medium leading-relaxed">
                    Quando implementado, este módulo será responsável por alterar automaticamente a tarefa de acompanhamento
                    originalmente criada no setor de Petição Inicial. A rota de petição inicial registra a demanda fática comercial 
                    e, após este protocolo ser validado, o Todoist marcará a tarefa inicial como concluída e abrirá o fluxo de monitoramento.
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-lg">
                    Status: Programação Futura
                  </div>
                </div>

                {/* Subetapa 4 simulated tech logs */}
                <div className="border border-red-200/50 rounded-2xl overflow-hidden bg-slate-950 font-mono text-[9.5px] text-slate-300">
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between font-sans">
                    <span className="font-extrabold uppercase text-[9px] tracking-wider text-slate-400">
                      Logs de Execução Todoist
                    </span>
                    <span className="px-2 py-0.5 rounded bg-red-955 text-[8px] text-red-400 font-black uppercase">
                      Offline
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1.5 leading-relaxed">
                    <div className="flex gap-2 font-mono">
                      <span className="text-red-400 shrink-0">›</span>
                      <span>[{new Date().toLocaleString('pt-BR')}] Exibição do espaço reservado Todoist na rota de protocolo.</span>
                    </div>
                    <div className="flex gap-2 font-mono">
                      <span className="text-red-400 shrink-0">›</span>
                      <span className="text-slate-400 italic">Status atual: Programação Futura. Nenhuma ação de rede executada.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Subetapas controller controls: anterior and proxima */}
            <div className="flex justify-between items-center bg-gray-50/70 border border-gray-100 rounded-2xl p-4.5 mt-4">
              <button
                type="button"
                disabled={activeSubetapa === 1}
                onClick={() => setActiveSubetapa((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <ArrowLeft size={13} />
                Subetapa Anterior
              </button>

              <span className="text-[10px] font-black text-gray-400 uppercase font-mono">
                {activeSubetapa} / 4
              </span>

              <button
                type="button"
                disabled={activeSubetapa === 4}
                onClick={() => setActiveSubetapa((prev) => Math.min(4, prev + 1))}
                className="inline-flex items-center gap-1.5 text-xs font-black text-slate-800 hover:text-slate-950 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Próxima Subetapa
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* LOG TÉCNICO DO PROTOCOLO — GOOGLE DRIVE E TODOIST */}
        <div className="border border-gray-150 rounded-3xl overflow-hidden bg-slate-50 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <FileText size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  Log Técnico do Protocolo — Google Drive e Todoist
                </h4>
                <p className="text-[10px] text-gray-400">
                  Histórico oficial de transmissões, renomeações e integrações de tarefas.
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg">
              Drive: Ativo | Todoist: Programação Futura
            </span>
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl font-mono text-[10.5px] text-slate-300 space-y-2 max-h-[220px] overflow-y-auto leading-relaxed border border-slate-950">
            {/* Hardcoded Todoist Status info inside console */}
            <div className="flex gap-2.5 border-b border-slate-800 pb-2 mb-2 text-rose-300 font-bold">
              <span className="text-rose-400 shrink-0">› [Todoist]</span>
              <span>[{new Date().toLocaleString('pt-BR')}] STATUS: Programação Futura. Nenhuma tarefa comercial alterada ou transmitida à API neste momento.</span>
            </div>

            {/* Google Drive Upload Logs */}
            {(!protocol.protocoloDriveLogs || protocol.protocoloDriveLogs.length === 0) ? (
              <div className="text-slate-500 italic">Nenhum evento registrado de upload para o Google Drive.</div>
            ) : (
              protocol.protocoloDriveLogs.map((log, index) => (
                <div key={index} className="flex gap-2.5">
                  <span className="text-emerald-400 shrink-0 font-bold">› [Drive]</span>
                  <span className="whitespace-pre-wrap">{log}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BOTTOM NAV BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.compliance(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Compliance
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'none')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Protocolo'}
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
