import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  addDoc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { 
  User, 
  Briefcase, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  HelpCircle, 
  ArrowLeft, 
  ChevronRight,
  CreditCard,
  FileBadge,
  Save,
  Building2,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Clock,
  Activity,
  UserCheck,
  Inbox,
  Coins,
  Check,
  TrendingUp,
  Wallet,
  HeartHandshake,
  Gift,
  Cake,
  MessageSquare,
  Send,
  Copy,
  Laptop,
  Scale,
  Printer,
  Share2,
  FolderOpen,
  FileCheck,
  Mail,
  X,
  ChevronDown
} from 'lucide-react';

import { PainelGeralCliente } from '../../../components/boss/portal/PainelGeralCliente';
import { EventsManager } from '../../../components/boss/portal/EventsManager';
import { FinancialManager } from '../../../components/boss/portal/FinancialManager';
import { DadosCadastraisCliente } from '../../../components/boss/portal/DadosCadastraisCliente';

const PORTAL_CLIENT_EDITOR_SECTIONS = [
  {
    id: "painel_geral",
    label: "Painel Geral do Cliente",
    routeSuffix: "Editar-Painel-Geral-do-Cliente",
    title: "Editar Painel Geral do Cliente"
  },
  {
    id: "dados_cadastrais",
    label: "Dados Cadastrais do Cliente",
    routeSuffix: "Editar-Dados-Cadastrais-do-Cliente",
    title: "Editar Dados Cadastrais do Cliente"
  },
  {
    id: "crm_cliente",
    label: "CRM do Cliente",
    routeSuffix: "Editar-CRM-do-Cliente",
    title: "Editar CRM do Cliente"
  },
  {
    id: "relacao_casos",
    label: "Relação de casos do cliente",
    routeSuffix: "Editar-Relacao-de-casos-do-cliente",
    title: "Editar Relação de Casos do Cliente"
  },
  {
    id: "audiencias",
    label: "Audiências do cliente",
    routeSuffix: "Editar-audiencias-do-cliente",
    title: "Editar Audiências do Cliente"
  },
  {
    id: "pericias",
    label: "Perícias do Cliente",
    routeSuffix: "Editar-pericias-do-cliente",
    title: "Editar Perícias do Cliente"
  },
  {
    id: "reunioes",
    label: "Reuniões com o cliente",
    routeSuffix: "Editar-reunioes-com-o-cliente",
    title: "Editar Reuniões com o Cliente"
  },
  {
    id: "solicitacao_provas",
    label: "Solicitação de Provas",
    routeSuffix: "Editar-solicitacao-de-provas",
    title: "Editar Solicitação de Provas"
  },
  {
    id: "solicitacao_informacoes",
    label: "Solicitação de informações",
    routeSuffix: "Editar-solicitacao-de-informacoes",
    title: "Editar Solicitação de Informações"
  },
  {
    id: "financeiro",
    label: "Financeiro e Faturamento",
    routeSuffix: "Editar-financeiro-e-faturamento",
    title: "Editar Financeiro e Faturamento"
  }
];

export default function EditarPortalCliente() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const location = useLocation();

  const isPrestarContasRoute = location.pathname.includes('/prestar.contas.');
  let prestacaoStep = 0;
  if (location.pathname.includes('/prestar.contas.questionario')) {
    prestacaoStep = 1;
  } else if (location.pathname.includes('/prestar.contas.apuracao.efetiva')) {
    prestacaoStep = 2;
  } else if (location.pathname.includes('/prestar.contas.recibo.e.envio')) {
    prestacaoStep = 3;
  }

  const normalizedPathname = decodeURIComponent(location.pathname)
    .replace(/\/+$/, "")
    .toLowerCase();

  const isEditarFinanceiroEFaturamentoRoute = !!slug && 
    normalizedPathname.endsWith("/editar-financeiro-e-faturamento");

  // Selected client & loading states
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientCases, setClientCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingCaseDetails, setLoadingCaseDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Prestar Contas State Management
  const [targetCaseId, setTargetCaseId] = useState('');
  const [feesSystem, setFeesSystem] = useState('Honorários Fixos');
  const [formaRecebimento, setFormaRecebimento] = useState('Alvará judicial');
  const [alvaraId, setAlvaraId] = useState('');
  const [alvaraDebitoData, setAlvaraDebitoData] = useState('');
  const [alvaraRecebido, setAlvaraRecebido] = useState('Sim');
  const [contaDeposito, setContaDeposito] = useState('');
  const [tipoContaDepositada, setTipoContaDepositada] = useState<'cliente' | 'procurador' | ''>('');
  const [selectedProcuradorConta, setSelectedProcuradorConta] = useState<'bb' | 'nubank' | ''>('');
  const [depositadoContaCliente, setDepositadoContaCliente] = useState('Não');
  const [valorContrato, setValorContrato] = useState<number>(0);
  const [honorarioExitoPercentual, setHonorarioExitoPercentual] = useState<number>(30);
  const [valorRecebidoTotal, setValorRecebidoTotal] = useState<number>(0);
  const [valorHonorariosDeduzido, setValorHonorariosDeduzido] = useState<number>(0);
  const [despesas, setDespesas] = useState<number>(0);
  const [contaRepasse, setContaRepasse] = useState('');
  const [thanksMessage, setThanksMessage] = useState('Agradecemos imensamente a confiança depositada em nosso escritório. Estaremos sempre à disposição para novos desafios e soluções jurídicas!');
  const [selectedChannel, setSelectedChannel] = useState<'gmail' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'fisico'>('whatsapp');
  
  const [googleDriveLoading, setGoogleDriveLoading] = useState(false);
  const [googleDriveSuccess, setGoogleDriveSuccess] = useState(false);
  const [googleDocsJobId, setGoogleDocsJobId] = useState('');
  const [messageCopied, setMessageCopied] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Todoist Integration State
  const [todoistProjectId, setTodoistProjectId] = useState('__TODOIST_INBOX__');
  const [todoistProjectName, setTodoistProjectName] = useState('Caixa de Entrada (Inbox)');
  const [syncedProjectsList, setSyncedProjectsList] = useState<{ id: string, name: string }[]>([]);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [todoistTaskTitle, setTodoistTaskTitle] = useState('');
  const [todoistTaskComment, setTodoistTaskComment] = useState('');
  const [todoistAutomationStatus, setTodoistAutomationStatus] = useState<'idle' | 'gerando' | 'criado' | 'falha'>('idle');
  const [todoistTaskId, setTodoistTaskId] = useState('');
  const [todoistTaskUrl, setTodoistTaskUrl] = useState('');
  const [todoistTaskLogFalha, setTodoistTaskLogFalha] = useState('');
  const [todoistLoading, setTodoistLoading] = useState(false);

  const handleSyncTodoistProjects = async () => {
    setSyncingProjects(true);
    try {
      const response = await fetch('/api/todoist/projects');
      const data = await response.json();
      if (data.success && Array.isArray(data.projects)) {
        setSyncedProjectsList(data.projects);
      }
    } catch (err) {
      console.error("[Todoist Projects Sync Failed]", err);
    } finally {
      setSyncingProjects(false);
    }
  };

  const handleCreateTodoistTask = async () => {
    if (!selectedClient) return;
    setTodoistLoading(true);
    setTodoistAutomationStatus('gerando');
    setTodoistTaskLogFalha('');
    
    // Fallback if caseId is missing
    const safeCaseId = targetCaseId || selectedClient.id || 'client_' + selectedClient.id;

    const bodyPayload = {
      caseId: safeCaseId,
      projectId: todoistProjectId,
      projectName: todoistProjectName,
      content: todoistTaskTitle,
      commentText: todoistTaskComment,
      dueDate: '',
      priority: 4,
      labels: [],
      assignee: '',
      isDuplicateCreationAttempt: false
    };

    try {
      const response = await fetch('/api/todoist/create-case-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await response.json();
      
      if (data.success === true && data.todoistTaskId) {
        setTodoistAutomationStatus('criado');
        setTodoistTaskId(data.todoistTaskId);
        setTodoistTaskUrl(data.todoistTaskUrl);
      } else {
        setTodoistAutomationStatus('falha');
        setTodoistTaskLogFalha(data.errorMessage || 'Erro de integração ao enviar tarefa ao Todoist.');
      }
    } catch (err: any) {
      setTodoistAutomationStatus('falha');
      setTodoistTaskLogFalha(err.message || String(err));
    } finally {
      setTodoistLoading(false);
    }
  };

  // Sync Todoist when step is 3 or on mount in step 3
  useEffect(() => {
    if (prestacaoStep === 3) {
      handleSyncTodoistProjects();
    }
  }, [prestacaoStep]);

  // Handle reactive update of task comment and default task title
  useEffect(() => {
    if (selectedClient) {
      if (!todoistTaskTitle) {
        setTodoistTaskTitle('Lançamento no Nibo +managergiffoni todo dia 15');
      }
      
      const clientName = getClientName(selectedClient);
      const matchedCase = clientCases.find(c => c.id === targetCaseId);
      const caseTitle = matchedCase ? matchedCase.title : 'Caso Geral';
      const cnNum = matchedCase ? matchedCase.processNumber : 'Não informado';
      const repasse = Math.max(0, valorRecebidoTotal - valorHonorariosDeduzido - despesas);
      
      const commentVal = `Segue a prestação de contas consolidada:
- Cliente: ${clientName}
- Caso: ${caseTitle}
- Processo: ${cnNum}
- Valor Total Recebido: ${formatBRL(valorRecebidoTotal)}
- Honorários Retidos: ${formatBRL(valorHonorariosDeduzido)}
- Despesas Custas: ${formatBRL(despesas)}
- reprepasse líquido final: ${formatBRL(repasse)}
- Conta Indicada: ${contaRepasse || 'Não informada'}`;

      setTodoistTaskComment(commentVal);
    }
  }, [selectedClient, targetCaseId, valorRecebidoTotal, valorHonorariosDeduzido, despesas, contaRepasse, clientCases]);

  const formatBRL = (v: any) => {
    const val = Number(v) || 0;
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const saveDraftToStorage = async (showAlert = false) => {
    if (!selectedClient) return;
    setIsSavingDraft(true);
    const draftData = {
      clientId: selectedClient.id,
      slug: slug || '',
      targetCaseId,
      feesSystem,
      honorarioExitoPercentual,
      valorContrato,
      formaRecebimento,
      contaDeposito,
      depositadoContaCliente,
      alvaraId,
      alvaraDebitoData,
      alvaraRecebido,
      valorRecebidoTotal,
      valorHonorariosDeduzido,
      despesas,
      contaRepasse,
      thanksMessage,
      selectedChannel,
      tipoContaDepositada,
      selectedProcuradorConta,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(`prestacao_draft_${selectedClient.id}`, JSON.stringify(draftData));

    try {
      const draftDocId = `draft_${selectedClient.id}`;
      await setDoc(doc(db, 'prestacaoContasDrafts', draftDocId), draftData);
      if (showAlert) {
        alert("Rascunho de prestação de contas de " + getClientName(selectedClient) + " guardado com absoluto sucesso!");
      }
    } catch (err: any) {
      console.error("Erro ao guardar rascunho de contas em Firestore:", err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const loadDraftFromStorage = async (clientData: any) => {
    if (!clientData) return;
    let savedData: any = null;
    
    // Try localStorage
    const localStr = localStorage.getItem(`prestacao_draft_${clientData.id}`);
    if (localStr) {
      try { savedData = JSON.parse(localStr); } catch (_) {}
    }

    // Prefer Firestore
    try {
      const draftDocId = `draft_${clientData.id}`;
      const snap = await getDoc(doc(db, 'prestacaoContasDrafts', draftDocId));
      if (snap.exists()) {
        savedData = snap.data();
      }
    } catch (err) {
      console.error("Erro ao puxar rascunho de contas de Firestore:", err);
    }

    if (savedData) {
      if (savedData.targetCaseId) setTargetCaseId(savedData.targetCaseId);
      if (savedData.feesSystem) setFeesSystem(savedData.feesSystem);
      if (savedData.honorarioExitoPercentual !== undefined) setHonorarioExitoPercentual(savedData.honorarioExitoPercentual);
      if (savedData.valorContrato !== undefined) setValorContrato(savedData.valorContrato);
      if (savedData.formaRecebimento) setFormaRecebimento(savedData.formaRecebimento);
      if (savedData.contaDeposito) setContaDeposito(savedData.contaDeposito);
      if (savedData.depositadoContaCliente) setDepositadoContaCliente(savedData.depositadoContaCliente);
      if (savedData.alvaraId) setAlvaraId(savedData.alvaraId);
      if (savedData.alvaraDebitoData) setAlvaraDebitoData(savedData.alvaraDebitoData);
      if (savedData.alvaraRecebido) setAlvaraRecebido(savedData.alvaraRecebido);
      if (savedData.valorRecebidoTotal !== undefined) setValorRecebidoTotal(savedData.valorRecebidoTotal);
      if (savedData.valorHonorariosDeduzido !== undefined) setValorHonorariosDeduzido(savedData.valorHonorariosDeduzido);
      if (savedData.despesas !== undefined) setDespesas(savedData.despesas);
      if (savedData.contaRepasse) setContaRepasse(savedData.contaRepasse);
      if (savedData.thanksMessage) setThanksMessage(savedData.thanksMessage);
      if (savedData.selectedChannel) setSelectedChannel(savedData.selectedChannel);
      if (savedData.tipoContaDepositada) setTipoContaDepositada(savedData.tipoContaDepositada);
      if (savedData.selectedProcuradorConta) setSelectedProcuradorConta(savedData.selectedProcuradorConta);
      
      setIsFormDirty(true);
    }
  };

  const handlePrestarCaseSelect = (caseId: string) => {
    setTargetCaseId(caseId);
    setIsFormDirty(true);
    const caseObj = clientCases.find(c => c.id === caseId);
    if (caseObj) {
      const feeType = caseObj.tipoHonorario || "Honorários Fixos";
      setFeesSystem(feeType);

      let feeVal = 0;
      if (caseObj.honorarioFixoValor) {
        feeVal = Number(String(caseObj.honorarioFixoValor).replace(/[^\d.,]/g, '').replace(',', '.'));
      } else if (caseObj.valorHonorarios) {
        feeVal = Number(String(caseObj.valorHonorarios).replace(/[^\d.,]/g, '').replace(',', '.'));
      }
      setValorContrato(feeVal || 0);

      const exitoStr = caseObj.percentualExito || caseObj.honorarioExitoPercentual || "30%";
      const pct = parseFloat(exitoStr) || 30;
      setHonorarioExitoPercentual(pct);
    } else {
      setFeesSystem("Honorários Fixos");
      setValorContrato(0);
      setHonorarioExitoPercentual(30);
    }
  };

  const handleExportToGoogleDrive = async () => {
    setGoogleDriveLoading(true);
    setGoogleDriveSuccess(false);

    const selectedCaseObj = clientCases.find(c => c.id === targetCaseId);
    const nomeCliente = getClientName(selectedClient);
    const caseTitleStr = selectedCaseObj?.title || 'Caso Coletado';
    const caseProcessStr = selectedCaseObj?.processNumber || 'Sem número';

    try {
      const jobId = 'gdoc_prestacao_' + Math.random().toString(36).substring(2, 11);
      setGoogleDocsJobId(jobId);

      const jobPayload = {
        id: jobId,
        createdAt: new Date().toISOString(),
        status: 'success',
        clientType: selectedClient?.type || 'PF',
        clientId: selectedClient?.id || '',
        caseId: targetCaseId,
        documentType: "prestacao_contas",
        templateKey: "prestacao_contas",
        destinationFolderId: selectedClient?.googleDriveClientFolderId || '',
        destinationFolderUrl: selectedClient?.googleDriveClientFolderUrl || '',
        documentName: `Prestação de Contas - ${nomeCliente} - ${caseTitleStr}`,
        placeholders: {
          "{{CLIENTE_NOME}}": nomeCliente,
          "{{CASO_TITULO}}": caseTitleStr,
          "{{PROCESSO_NUMERO}}": caseProcessStr,
          "{{TIPO_HONORARIOS}}": feesSystem,
          "{{FORMA_RECEBIMENTO}}": formaRecebimento,
          "{{ALVARA_ID}}": alvaraId || '',
          "{{ALVARA_DEBITO_DATA}}": alvaraDebitoData || '',
          "{{VALIDO_RECEBIDO}}": alvaraRecebido,
          "{{CONTA_DEPOSITO}}": contaDeposito || '',
          "{{DEPOSITADO_CONTA_CLIENTE}}": depositadoContaCliente,
          "{{VALOR_CONTRATO}}": formatBRL(valorContrato),
          "{{VALOR_RECEBIDO_TOTAL}}": formatBRL(valorRecebidoTotal),
          "{{VALOR_HONORARIOS_DEDUZIDO}}": formatBRL(valorHonorariosDeduzido),
          "{{DEDUCOES_OUTRAS}}": formatBRL(despesas),
          "{{VALOR_REPASSE_CLIENTE}}": formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas),
          "{{CONTA_REPASSE}}": contaRepasse || '',
          "{{DATA_CONCLUSAO}}": new Date().toLocaleDateString('pt-BR'),
        },
        logs: ["GDI Prestação de contas executada de forma autônoma pelo portal edit-route."]
      };

      await setDoc(doc(db, 'googleDocsJobs', jobId), jobPayload);

      const prestacaoId = 'prestacao_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'prestacaoContas', prestacaoId), {
        id: prestacaoId,
        clientId: selectedClient?.id || '',
        clientName: nomeCliente,
        caseId: targetCaseId,
        caseTitle: caseTitleStr,
        caseProcessNumber: caseProcessStr,
        feesSystem,
        formaRecebimento,
        alvaraId,
        alvaraDebitoData,
        alvaraRecebido,
        contaDeposito,
        depositadoContaCliente,
        valorContrato,
        valorRecebidoTotal,
        valorHonorariosDeduzido,
        despesas,
        valorRepasse: valorRecebidoTotal - valorHonorariosDeduzido - despesas,
        contaRepasse,
        createdAt: new Date().toISOString()
      });

      setTimeout(() => {
        setGoogleDriveLoading(false);
        setGoogleDriveSuccess(true);
      }, 1200);

    } catch (e: any) {
      console.error(e);
      setGoogleDriveLoading(false);
      alert('Contas salvas localmente! Conexão GDI instável: ' + e.message);
    }
  };

  // Auto calculate honorarios based on feesSystem & valorRecebidoTotal
  useEffect(() => {
    if (valorRecebidoTotal > 0) {
      if (feesSystem.includes("Fixo") || feesSystem === "Honorários Fixos") {
        setValorHonorariosDeduzido(valorContrato);
      } else if (feesSystem.includes("Êxito") || feesSystem === "Êxito" || feesSystem === "Ad Êxito" || feesSystem.toLowerCase().includes("exito")) {
        const cal = (valorRecebidoTotal * honorarioExitoPercentual) / 100;
        setValorHonorariosDeduzido(Number(cal.toFixed(2)));
      } else {
        const cal = valorContrato + ((valorRecebidoTotal * honorarioExitoPercentual) / 100);
        setValorHonorariosDeduzido(Number(cal.toFixed(2)));
      }
    }
  }, [valorRecebidoTotal, feesSystem, valorContrato, honorarioExitoPercentual]);

  // States for Ficha de Identificação Cadastral Navigation & Visibility
  const [fichaActiveTab, setFichaActiveTab] = useState<'contratante' | 'endereco' | 'socios' | 'bancarios' | 'acesso'>('contratante');
  const [showFichaPassword, setShowFichaPassword] = useState(false);

  // Linked Entities
  const [activeSubTab, setActiveSubTab] = useState<'entrevista' | 'tipo_servico' | 'provas' | 'informacoes' | 'financeiro'>('entrevista');
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [informationRequests, setInformationRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);

  // Local Edit States
  const [editingNarrative, setEditingNarrative] = useState('');
  const [savingNarrative, setSavingNarrative] = useState(false);
  const [serviceTypeKey, setServiceTypeKey] = useState('');
  const [serviceTypeName, setServiceTypeName] = useState('');
  const [savingService, setSavingService] = useState(false);

  // Form states for adding Provas
  const [newProofTitle, setNewProofTitle] = useState('');
  const [newProofDesc, setNewProofDesc] = useState('');
  const [newProofVisible, setNewProofVisible] = useState(true);
  const [newProofUpload, setNewProofUpload] = useState(true);
  const [addingProof, setAddingProof] = useState(false);

  // Form states for adding Informacoes
  const [newQuestionText, setNewQuestionText] = useState('');
  const [addingQuestion, setAddingQuestion] = useState(false);

  // Form states for adding Financial
  const [newChargeType, setNewChargeType] = useState('honorarios_iniciais');
  const [newAmount, setNewAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('boleto');
  const [newInstallments, setNewInstallments] = useState(1);
  const [newDueDate, setNewDueDate] = useState('');
  const [newFinancialStatus, setNewFinancialStatus] = useState('pendente');
  const [newPublicMessage, setNewPublicMessage] = useState('');
  const [addingFinancial, setAddingFinancial] = useState(false);

  // Master client-wide data for dashboard summaries
  const [allClientEvents, setAllClientEvents] = useState<any[]>([]);
  const [allClientEvidence, setAllClientEvidence] = useState<any[]>([]);
  const [allClientInformation, setAllClientInformation] = useState<any[]>([]);
  const [allClientFinancials, setAllClientFinancials] = useState<any[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const activeSectionConfig = PORTAL_CLIENT_EDITOR_SECTIONS.find(
    section => location.pathname.endsWith(`/${section.routeSuffix}`)
  );

  const isExactBaseRoute = slug && (
    location.pathname === `/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}` ||
    location.pathname === `/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/`
  );

  const activeSidebarSection = activeSectionConfig?.id || "painel_geral";
  const isInvalidRoute = !isExactBaseRoute && !isPrestarContasRoute && !activeSectionConfig;

  // Auto redirect base URL to Painel Geral
  useEffect(() => {
    if (slug) {
      const basePath = `/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}`;
      if (location.pathname === basePath || location.pathname === `${basePath}/`) {
        navigate(`${basePath}/Editar-Painel-Geral-do-Cliente`, { replace: true });
      }
    }
  }, [slug, location.pathname, navigate]);

  const setActiveSidebarSection = (sectionId: string) => {
    const section = PORTAL_CLIENT_EDITOR_SECTIONS.find(s => s.id === sectionId);
    if (section && slug) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/${section.routeSuffix}`);
      if (sectionId === 'relacao_casos') {
        setActiveSubTab('entrevista');
      }
    }
  };

  // Event creation form local states
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventCaseId, setNewEventCaseId] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventVisible, setNewEventVisible] = useState(true);

  // CRM client states
  const [bdayChannel, setBdayChannel] = useState<'email' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok'>('whatsapp');
  const [bdayMessage, setBdayMessage] = useState('');
  const [profChannel, setProfChannel] = useState<'email' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok'>('whatsapp');
  const [profMessage, setProfMessage] = useState('');
  const [bdayCopied, setBdayCopied] = useState(false);
  const [profCopied, setProfCopied] = useState(false);

  // CRM protocol delay and distribution state
  const [justificationChannel, setJustificationChannel] = useState<'email' | 'whatsapp' | 'todoist'>('whatsapp');
  const [justificationMessage, setJustificationMessage] = useState('');
  const [justificationCopied, setJustificationCopied] = useState(false);
  const [automaticAlert3Days, setAutomaticAlert3Days] = useState(true);
  const [automaticAlert1Day, setAutomaticAlert1Day] = useState(true);
  const [automaticAlertOnDay, setAutomaticAlertOnDay] = useState(true);
  const [automaticAlertDelay, setAutomaticAlertDelay] = useState(true);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [distributionCaseId, setDistributionCaseId] = useState('');
  const [distributionMessage, setDistributionMessage] = useState('');
  const [distributionChannel, setDistributionChannel] = useState<'email' | 'whatsapp'>('whatsapp');
  const [distributionCopied, setDistributionCopied] = useState(false);

  const handleSaveExpectedProtocolDate = async (dateStr: string) => {
    if (!selectedCase) return;
    try {
      const updatedProtocol = {
        ...(selectedCase.protocol || {}),
        expectedProtocolDate: dateStr,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'cases', selectedCase.id), {
        protocol: updatedProtocol,
        expectedProtocolDate: dateStr,
        updatedAt: new Date().toISOString()
      });
      setSelectedCase((prev: any) => ({
        ...prev,
        protocol: updatedProtocol,
        expectedProtocolDate: dateStr
      }));
      setClientCases((prev) => 
        prev.map((c) => c.id === selectedCase.id ? { 
          ...c, 
          protocol: updatedProtocol, 
          expectedProtocolDate: dateStr 
        } : c)
      );
      showToastSuccess('Data prevista de protocolo atualizada!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar data prevista de protocolo: ' + err.message);
    }
  };

  useEffect(() => {
    if (selectedClient) {
      const clientName = getClientName(selectedClient);
      const pf = selectedClient?.pfData || selectedClient?.pfDadosPessoais || {};
      const job = pf.pf_profissao || pf.profissao || 'sua profissão';

      setBdayMessage(`Olá, ${clientName}! Nós da Giffoni Advogados Associados desejamos a você um feliz aniversário! Que seu ano seja repleto de realizações, saúde, sucesso e paz. É uma honra ter você como parceiro e cliente em nossa jornada jurídica. Parabéns! 🎉`);
      setProfMessage(`Olá, ${clientName}! Hoje, celebramos e parabenizamos você pela sua excelente dedicação em ${job === 'sua profissão' ? 'sua carreira' : job}. Nós da Giffoni Advogados Associados temos orgulho de contar com sua parceria fática e dedicação profissional. Sucesso e conquistas sempre em sua jornada! 💼⚖️`);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient && selectedCase) {
      const clientName = getClientName(selectedClient) || 'Cliente';
      const caseType = selectedCase.registrationType || 'Caso Jurídico';
      const caseIdStr = selectedCase.id;
      const procNum = selectedCase.processNumber || selectedCase.protocol?.processNumber || 'Em andamento';
      const receiptUrl = selectedCase.protocol?.protocolReceiptUrl || '';

      setJustificationMessage(`Olá, ${clientName}! Gostaríamos de solicitar uma justificativa referente ao atraso na data prevista de protocolo do seu caso "${caseType}" (Ref ID: ${caseIdStr}). Por gentileza, nos informe o motivo para que possamos atualizar nossos registros internos e alinhar os próximos passos fáticos. Atenciosamente, Giffoni Advogados Associados.`);
      setDistributionMessage(`Olá, ${clientName}! Temos a satisfação de informar que o seu processo correspondente ao caso "${caseType}" (Número do Processo: ${procNum}) foi oficialmente distribuído e protocolado em juízo! Segue o comprovante oficial correspondente para o seu acompanhamento: ${receiptUrl ? receiptUrl : 'Link disponível no seu Portal do Cliente'}. Atenciosamente, Giffoni Advogados Associados.`);
      setDistributionCaseId(selectedCase.id);
    }
  }, [selectedClient, selectedCase]);

  // Fetch client by slug or fallback to ID
  const fetchClientData = async () => {
    if (!slug) {
      setError('Slug do cliente não especificado.');
      setLoadingClient(false);
      return;
    }

    setLoadingClient(true);
    setError(null);
    try {
      let clientDoc: any = null;

      // 1. Query by slug
      const clientsRef = collection(db, 'clients');
      const qSlug = query(clientsRef, where('slug', '==', slug));
      const snapSlug = await getDocs(qSlug);

      if (!snapSlug.empty) {
        clientDoc = { id: snapSlug.docs[0].id, ...snapSlug.docs[0].data() };
      } else {
        // Try fallback to ID
        const directDoc = await getDoc(doc(db, 'clients', slug));
        if (directDoc.exists()) {
          clientDoc = { id: directDoc.id, ...directDoc.data() };
        }
      }

      if (!clientDoc) {
        setError(`Cliente com identificador "${slug}" não foi encontrado no sistema.`);
        return;
      }

      setSelectedClient(clientDoc);

      // Fetch client cases
      const qCases = query(collection(db, 'cases'), where('clientId', '==', clientDoc.id));
      const snapCases = await getDocs(qCases);
      const listCases: any[] = [];
      snapCases.forEach((d) => {
        listCases.push({ id: d.id, ...d.data() });
      });
      setClientCases(listCases);
      if (listCases.length > 0) {
        setNewEventCaseId(listCases[0].id);
      }

      // Query client-wide data for dashboard summaries
      setLoadingDashboard(true);
      try {
        // 1. Fetch caseEvidenceRequests of client
        const qAllEvidence = query(collection(db, 'caseEvidenceRequests'), where('clientId', '==', clientDoc.id));
        const snapAllEvidence = await getDocs(qAllEvidence);
        const listAllEvidence: any[] = [];
        snapAllEvidence.forEach((d) => {
          listAllEvidence.push({ id: d.id, ...d.data() });
        });
        setAllClientEvidence(listAllEvidence);

        // 2. Fetch caseInformationRequests of client
        const qAllInfo = query(collection(db, 'caseInformationRequests'), where('clientId', '==', clientDoc.id));
        const snapAllInfo = await getDocs(qAllInfo);
        const listAllInfo: any[] = [];
        snapAllInfo.forEach((d) => {
          listAllInfo.push({ id: d.id, ...d.data() });
        });
        setAllClientInformation(listAllInfo);

        // 3. Fetch caseFinancials of client
        const qAllFin = query(collection(db, 'caseFinancials'), where('clientId', '==', clientDoc.id));
        const snapAllFin = await getDocs(qAllFin);
        const listAllFin: any[] = [];
        snapAllFin.forEach((d) => {
          listAllFin.push({ id: d.id, ...d.data() });
        });
        setAllClientFinancials(listAllFin);

        // 4. Fetch caseEvents of client
        const qAllEvents = query(collection(db, 'caseEvents'), where('clientId', '==', clientDoc.id));
        const snapAllEvents = await getDocs(qAllEvents);
        const listAllEvents: any[] = [];
        snapAllEvents.forEach((d) => {
          listAllEvents.push({ id: d.id, ...d.data() });
        });
        setAllClientEvents(listAllEvents);
      } catch (dashErr) {
        console.error("Erro ao carregar dados do painel do cliente:", dashErr);
      } finally {
        setLoadingDashboard(false);
      }

      // Auto-select first case if exists to facilitate editing immediately
      if (listCases.length > 0) {
        handleSelectCase(listCases[0], clientDoc.id);
      }

      await loadDraftFromStorage(clientDoc);

    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar dados do cliente: ' + (err.message || err));
    } finally {
      setLoadingClient(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [slug]);

  // Load selected case's related data
  const handleSelectCase = async (caseObj: any, clientIdPassed?: string) => {
    setSelectedCase(caseObj);
    setLoadingCaseDetails(true);
    setActiveSubTab('entrevista');
    
    setEditingNarrative(caseObj.entrevistaPadrao || caseObj.description || '');
    setServiceTypeKey(caseObj.registrationTypeKey || '');
    setServiceTypeName(caseObj.registrationType || '');

    const targetClientId = clientIdPassed || selectedClient?.id;
    if (!targetClientId) return;

    try {
      // 1. Fetch caseEvidenceRequests
      const proofQuery = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseObj.id));
      const proofSnap = await getDocs(proofQuery);
      const proofList: any[] = [];
      proofSnap.forEach((d) => {
        proofList.push({ id: d.id, ...d.data() });
      });
      setEvidenceRequests(proofList);

      // 2. Fetch caseInformationRequests
      const infoQuery = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseObj.id));
      const infoSnap = await getDocs(infoQuery);
      const infoList: any[] = [];
      infoSnap.forEach((d) => {
        infoList.push({ id: d.id, ...d.data() });
      });
      setInformationRequests(infoList);

      // 3. Fetch caseFinancials
      const finQuery = query(collection(db, 'caseFinancials'), where('caseId', '==', caseObj.id));
      const finSnap = await getDocs(finQuery);
      const finList: any[] = [];
      finSnap.forEach((d) => {
        finList.push({ id: d.id, ...d.data() });
      });
      setFinancials(finList);

    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar vinculações do caso: ' + (err.message || err));
    } finally {
      setLoadingCaseDetails(false);
    }
  };

  const showToastSuccess = (text: string) => {
    setSuccess(text);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Action: Save Entrevista Narrative
  const handleSaveNarrative = async () => {
    if (!selectedCase) return;
    setSavingNarrative(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), {
        entrevistaPadrao: editingNarrative.trim(),
        description: editingNarrative.trim(),
        updatedAt: new Date().toISOString()
      });
      setSelectedCase((prev: any) => ({ 
          ...prev, 
          entrevistaPadrao: editingNarrative.trim(),
          description: editingNarrative.trim()
      }));
      // Update in local cases list as well
      setClientCases((prev) => 
        prev.map((c) => c.id === selectedCase.id ? { ...c, entrevistaPadrao: editingNarrative.trim(), description: editingNarrative.trim() } : c)
      );
      showToastSuccess('Narrativa da Entrevista foi atualizada com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar narrativa: ' + (err.message || err));
    } finally {
      setSavingNarrative(false);
    }
  };

  // Action: Save Tipo de Serviço
  const handleSaveServiceType = async () => {
    if (!selectedCase) return;
    setSavingService(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), {
        registrationTypeKey: serviceTypeKey,
        registrationType: serviceTypeName,
        updatedAt: new Date().toISOString()
      });
      setSelectedCase((prev: any) => ({
        ...prev,
        registrationTypeKey: serviceTypeKey,
        registrationType: serviceTypeName
      }));
      setClientCases((prev) => 
        prev.map((c) => c.id === selectedCase.id ? { ...c, registrationTypeKey: serviceTypeKey, registrationType: serviceTypeName } : c)
      );
      showToastSuccess('Tipo de Serviço atualizado com êxito!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar tipo de serviço: ' + (err.message || err));
    } finally {
      setSavingService(false);
    }
  };

  // Action: Create dynamic Case Evidence Request (Prova)
  const handleCreateProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !selectedClient || !newProofTitle.trim()) return;
    setAddingProof(true);
    setError(null);

    const payload = {
      caseId: selectedCase.id,
      clientId: selectedClient.id,
      clientSlug: selectedClient.slug || '',
      title: newProofTitle.trim(),
      description: newProofDesc.trim(),
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      status: 'pendente',
      visibleToClient: newProofVisible,
      allowUpload: newProofUpload,
      expectedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg'],
      maxFiles: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'caseEvidenceRequests'), payload);
      const newProof = { id: docRef.id, ...payload };
      setEvidenceRequests((prev) => [newProof, ...prev]);
      setAllClientEvidence((prev) => [newProof, ...prev]);
      setNewProofTitle('');
      setNewProofDesc('');
      showToastSuccess('Nova solicitação de prova cadastrada com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar solicitação de prova: ' + (err.message || err));
    } finally {
      setAddingProof(false);
    }
  };

  const handleToggleProofStatus = async (proof: any) => {
    const nextStatus = proof.status === 'aprovado' ? 'pendente' : 'aprovado';
    setError(null);
    try {
      await updateDoc(doc(db, 'caseEvidenceRequests', proof.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      setEvidenceRequests((prev) =>
        prev.map((p) => (p.id === proof.id ? { ...p, status: nextStatus } : p))
      );
      setAllClientEvidence((prev) =>
        prev.map((p) => (p.id === proof.id ? { ...p, status: nextStatus } : p))
      );
      showToastSuccess('Status da prova atualizado!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao alterar status da prova: ' + (err.message || err));
    }
  };

  const handleDeleteProof = async (proofId: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta solicitação de prova?')) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'caseEvidenceRequests', proofId));
      setEvidenceRequests((prev) => prev.filter((p) => p.id !== proofId));
      setAllClientEvidence((prev) => prev.filter((p) => p.id !== proofId));
      showToastSuccess('Documento removido da coleta!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao apagar solicitação de prova: ' + (err.message || err));
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !selectedClient || !newQuestionText.trim()) return;
    setAddingQuestion(true);
    setError(null);

    const payload = {
      caseId: selectedCase.id,
      clientId: selectedClient.id,
      question: newQuestionText.trim(),
      answer: '',
      status: 'pendente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'caseInformationRequests'), payload);
      const newQuestion = { id: docRef.id, ...payload };
      setInformationRequests((prev) => [newQuestion, ...prev]);
      setAllClientInformation((prev) => [newQuestion, ...prev]);
      setNewQuestionText('');
      showToastSuccess('Pergunta de informação complementar adicionada!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao adicionar pergunta complementar: ' + (err.message || err));
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleUpdateQuestionAnswer = async (id: string, ans: string, status: string) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'caseInformationRequests', id), {
        answer: ans.trim(),
        status: status,
        updatedAt: new Date().toISOString()
      });
      setInformationRequests((prev) =>
        prev.map((q) => (q.id === id ? { ...q, answer: ans, status: status } : q))
      );
      setAllClientInformation((prev) =>
        prev.map((q) => (q.id === id ? { ...q, answer: ans, status: status } : q))
      );
      showToastSuccess('Informação salva no histórico!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar resposta: ' + (err.message || err));
    }
  };

  const handleCreateFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount);
    if (!selectedCase || !selectedClient || isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Insira um valor numérico válido.');
      return;
    }
    setAddingFinancial(true);
    setError(null);

    const payload = {
      caseId: selectedCase.id,
      clientId: selectedClient.id,
      clientSlug: selectedClient.slug || '',
      chargeType: newChargeType,
      totalAmount: parsedAmount,
      paymentMethod: newPaymentMethod,
      installments: Number(newInstallments) || 1,
      firstDueDate: newDueDate || new Date().toISOString().split('T')[0],
      financialStatus: newFinancialStatus,
      visibleToClient: true,
      publicFinancialMessage: newPublicMessage.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'caseFinancials'), payload);
      const newFin = { id: docRef.id, ...payload };
      setFinancials((prev) => [newFin, ...prev]);
      setAllClientFinancials((prev) => [newFin, ...prev]);
      setNewAmount('');
      setNewPublicMessage('');
      showToastSuccess('Relatório financeiro do caso atualizado!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao cadastrar faturamento: ' + (err.message || err));
    } finally {
      setAddingFinancial(false);
    }
  };

  const handleDeleteFinancial = async (finId: string) => {
    if (!window.confirm('Excluir este lançamento financeiro permanentemente?')) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'caseFinancials', finId));
      setFinancials((prev) => prev.filter((f) => f.id !== finId));
      setAllClientFinancials((prev) => prev.filter((f) => f.id !== finId));
      showToastSuccess('Faturamento excluído!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao excluir financeiro: ' + (err.message || err));
    }
  };

  const handleCreateEvent = async (type: 'audiencia' | 'pericia' | 'reuniao', customForm?: any) => {
    if (!selectedClient) return;
    setAddingEvent(true);
    setError(null);
    try {
      const payload = {
        caseId: customForm?.caseId || newEventCaseId || (clientCases[0]?.id || 'f60jptoSi8Z9xat45yIb'),
        clientId: selectedClient.id,
        type: type,
        title: customForm?.title || newEventTitle.trim() || `${type.charAt(0).toUpperCase() + type.slice(1)} de Processo`,
        description: customForm?.description || newEventDesc.trim() || '',
        date: customForm?.date || newEventDate || new Date().toISOString().split('T')[0],
        time: customForm?.time || newEventTime || '14:00',
        location: customForm?.location || newEventLocation.trim() || '',
        status: customForm?.status || 'agendado',
        visibleToClient: customForm?.visibleToClient !== undefined ? customForm.visibleToClient : newEventVisible,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'caseEvents'), payload);
      setAllClientEvents((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      
      // Clear event form fields
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventLocation('');
      setNewEventDesc('');
      showToastSuccess(`Agendado com êxito!`);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao agendar ${type}: ` + (err.message || err));
    } finally {
      setAddingEvent(false);
    }
  };

  const handleToggleEventVisibility = async (event: any) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'caseEvents', event.id), {
        visibleToClient: !event.visibleToClient,
        updatedAt: new Date().toISOString()
      });
      setAllClientEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, visibleToClient: !e.visibleToClient } : e))
      );
      showToastSuccess('Visibilidade alterada!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao alterar visibilidade: ' + (err.message || err));
    }
  };

  const handleUpdateEventStatus = async (eventId: string, status: string) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'caseEvents', eventId), {
        status,
        updatedAt: new Date().toISOString()
      });
      setAllClientEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status } : e))
      );
      showToastSuccess('Status do evento atualizado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar status do evento: ' + (err.message || err));
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Excluir este evento permanentemente?')) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'caseEvents', eventId));
      setAllClientEvents((prev) => prev.filter((e) => e.id !== eventId));
      showToastSuccess('Evento removido com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao apagar evento: ' + (err.message || err));
    }
  };

  const handleMarkFinancialPaid = async (fin: any) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'caseFinancials', fin.id), {
        financialStatus: 'pago',
        updatedAt: new Date().toISOString()
      });
      setAllClientFinancials((prev) =>
        prev.map((f) => (f.id === fin.id ? { ...f, financialStatus: 'pago' } : f))
      );
      if (selectedCase && fin.caseId === selectedCase.id) {
        setFinancials((prev) =>
          prev.map((f) => (f.id === fin.id ? { ...f, financialStatus: 'pago' } : f))
        );
      }
      showToastSuccess('Pagamento liquidado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao liquidar cobrança: ' + (err.message || err));
    }
  };

  const getClientName = (c: any) => {
    if (!c) return '';
    return c.type === 'PF'
      ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || 'Sem Nome')
      : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || 'Sem Razão Social');
  };

  const getClientDoc = (c: any) => {
    if (!c) return '';
    return c.type === 'PF'
      ? (c.pfDadosPessoais?.pf_cpf || c.pfData?.pf_cpf || 'CPF não informado')
      : (c.pjDadosEmpresa?.pj_cnpj || c.pjData?.pj_cnpj || 'CNPJ não informado');
  };

  return (
    <BossLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-12">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-150 pb-6 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao/portal-cliente')}
                className="p-1 px-2.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition flex items-center gap-1.5 text-[15px] font-bold uppercase tracking-wider border border-gray-150 shadow-xs cursor-pointer"
              >
                <ArrowLeft size={14} /> Voltar à Busca
              </button>
              <h1 className="text-[25px] font-black text-gray-950 tracking-tight">Editar o Portal do Cliente</h1>
            </div>
            <p className="text-[15px] text-gray-400 font-semibold mt-1">Configuração individual das seções e fichas integradas fáticas para o portal do cliente.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start">
            {isEditarFinanceiroEFaturamentoRoute && (
              <button
                id="btn-ver-cadastro-contrato"
                onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao/f60jptoSi8Z9xat45yIb/financeiro/Criar%20Contrato%20de%20Honor%C3%A1rios')}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 hover:text-indigo-900 rounded-2xl text-[15px] font-extrabold transition uppercase tracking-wider font-mono cursor-pointer shadow-sm"
              >
                <FileText size={14} />
                Ver Cadastro do Contrato de honorários
              </button>
            )}
            <button
              onClick={fetchClientData}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-955 rounded-2xl text-[15px] font-extrabold transition uppercase tracking-wider font-mono cursor-pointer"
            >
              <RefreshCw size={14} className={loadingClient ? 'animate-spin' : ''} />
              Recarregar Cliente
            </button>
          </div>
        </div>

        {/* FEEDBACK LABELS */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100/80 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100/80 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            {success}
          </div>
        )}

        {loadingClient ? (
          <div className="bg-white border border-gray-150 rounded-3xl p-12 text-center text-gray-400 min-h-[400px] flex flex-col items-center justify-center space-y-4">
            <RefreshCw size={36} className="animate-spin text-purple-600" />
            <p className="text-xs font-extrabold uppercase font-mono tracking-wider">Carregando painel do cliente...</p>
          </div>
        ) : selectedClient ? (
          isPrestarContasRoute ? (
            <div className="bg-white border border-gray-150 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
              {/* Stepper Progress bar */}
              <div className="flex items-center justify-between relative px-2 mb-6">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
                
                {[
                  { step: 1, label: '1. Questionário Inicial', url: `/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/prestar.contas.questionario` },
                  { step: 2, label: '2. Apuração Efetiva', url: `/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/prestar.contas.apuracao.efetiva` },
                  { step: 3, label: '3. Recibo e Envio', url: `/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/prestar.contas.recibo.e.envio` }
                ].map((s) => {
                  const isActive = prestacaoStep === s.step;
                  const isCompleted = prestacaoStep > s.step;
                  return (
                    <div key={s.step} className="flex flex-col items-center z-10 relative bg-white px-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (targetCaseId) {
                            navigate(s.url);
                          }
                        }}
                        disabled={!targetCaseId && s.step > 1}
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                          isActive 
                            ? 'bg-indigo-650 border-indigo-650 text-white shadow-sm ring-4 ring-indigo-100' 
                            : isCompleted 
                              ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600' 
                              : 'bg-white border-gray-300 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isCompleted ? '✓' : s.step}
                      </button>
                      <span className={`text-[10px] mt-1.5 tracking-tight uppercase font-black ${
                        isActive ? 'text-indigo-650 font-bold' : 'text-gray-400 font-mono'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Stage 1: Questionário Inicial */}
              {prestacaoStep === 1 && (
                <div className="space-y-6 text-left max-w-3xl mx-auto animate-fade-in">
                  <div className="border-b border-gray-150 pb-3">
                    <h3 className="text-sm font-black uppercase text-indigo-650 tracking-widest">Etapa 1: Questionário sobre a prestação de contas</h3>
                    <p className="text-xs text-gray-400 mt-1">Preencha os dados do recebimento brutais para apuração de honorários fáticos.</p>
                  </div>

                  {/* 1) Qual o caso que você irá prestar contas? */}
                  <div>
                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider block mb-1.5 font-mono">1. Qual o caso que você irá prestar contas? (apresentar automaticamente os casos ativos do cliente)</label>
                    <select
                      value={targetCaseId}
                      onChange={(e) => {
                        handlePrestarCaseSelect(e.target.value);
                        setIsFormDirty(true);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-250 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                    >
                      <option value="">-- Escolha um Caso Jurisdicional --</option>
                      {clientCases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} {c.processNumber ? `(CNJ: ${c.processNumber})` : '(Sem Processo)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2) SISTEMA DE HONORÁRIOS DETECTADO (PUXADO DO CASO): */}
                  <div>
                    <label className="text-[10px] font-mono font-black text-indigo-650 block uppercase tracking-wider mb-1">2. SISTEMA DE HONORÁRIOS DETECTADO (PUXADO DO CASO):</label>
                    <div className="px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-900 uppercase">Regime Pactuado: {feesSystem}</span>
                      <span className="text-[10px] font-mono font-extrabold text-indigo-600">
                        {feesSystem.includes("Êxito") || feesSystem === "Ad Êxito" ? "AD ÊXITO E RETENÇÕES" : "TAXA FIXA / MISTO"}
                      </span>
                    </div>
                  </div>

                  {/* 3) Valor do êxito cobrado */}
                  <div>
                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider block mb-1.5 font-mono">3. Valor do êxito cobrado (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={honorarioExitoPercentual}
                        onChange={(e) => {
                          setHonorarioExitoPercentual(Number(e.target.value));
                          setIsFormDirty(true);
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-450">%</span>
                    </div>
                  </div>

                  {/* 4) VALOR TOTAL DO ÊXITO: */}
                  <div>
                    <label className="text-xs font-black uppercase text-emerald-650 tracking-wider block mb-1.5 font-mono font-sans">4. VALOR TOTAL DO ÊXITO:</label>
                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-150 rounded-xl">
                      <span className="text-sm font-black text-emerald-800 font-mono block">
                        {formatBRL((valorRecebidoTotal * honorarioExitoPercentual) / 100)}
                      </span>
                      <span className="text-[10.5px] text-emerald-600 block mt-0.5 leading-tight font-medium font-sans">
                        Valor total do êxito calculado automaticamente com base nas entradas.
                      </span>
                    </div>
                  </div>

                  {/* 5) Forma de Recebimento */}
                  <div>
                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider block mb-1.5 font-mono">5. Forma de Recebimento</label>
                    <select
                      value={formaRecebimento}
                      onChange={(e) => {
                        setFormaRecebimento(e.target.value);
                        setIsFormDirty(true);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                    >
                      <option value="Alvará judicial">Alvará judicial</option>
                      <option value="Depósito judicial">Depósito judicial</option>
                      <option value="Transferência Pix">Transferência Pix</option>
                      <option value="Ted / Doc">Ted / Doc</option>
                      <option value="Acordo em audiência">Acordo em audiência</option>
                    </select>
                  </div>

                  {/* 6) Em qual conta o valor foi depositado? */}
                  <div>
                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider block mb-1.5">6. Em qual conta o valor foi depositado?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTipoContaDepositada('cliente');
                          setIsFormDirty(true);
                          
                          const bancario = selectedClient.bancarioData || selectedClient.bancarioDadosBancarios || {};
                          if (bancario.bancario_banco) {
                            const str = `Banco: ${bancario.bancario_banco}, Agência: ${bancario.bancario_agencia || ''}, Conta: ${bancario.bancario_conta || ''}${bancario.bancario_chavePix ? `, PIX: ${bancario.bancario_chavePix} (${bancario.bancario_tipoChavePix || ''})` : ''}`;
                            setContaDeposito(str);
                          } else {
                            setContaDeposito('Dados bancários não preenchidos na Fase 1 do cadastro do cliente.');
                          }
                        }}
                        className={`px-4 py-3 border rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                          tipoContaDepositada === 'cliente'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm font-sans'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-black block">Conta do Cliente</span>
                          <span className="text-[10px] uppercase font-mono block mt-0.5 opacity-80">Fase 1 do Cadastro</span>
                        </div>
                        <User size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTipoContaDepositada('procurador');
                          setIsFormDirty(true);
                          setSelectedProcuradorConta('bb');
                          setContaDeposito("Banco do Brasil, Agência: 0428-6, Conta corrente: 61.954-x, pix do bB: direito.rgr@gmail.com");
                        }}
                        className={`px-4 py-3 border rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                          tipoContaDepositada === 'procurador'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm font-sans'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-black block">Conta do Procurador (Advogado)</span>
                          <span className="text-[10px] uppercase font-mono block mt-0.5 opacity-80">Especificar Cascata</span>
                        </div>
                        <ShieldCheck size={16} />
                      </button>
                    </div>

                    {/* Cascading view for procurador options */}
                    {tipoContaDepositada === 'procurador' && (
                      <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl space-y-3 animate-fade-in text-left">
                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Escolha uma das contas do procurador:</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProcuradorConta('bb');
                              setContaDeposito("Banco do Brasil, Agência: 0428-6, Conta corrente: 61.954-x, pix do bB: direito.rgr@gmail.com");
                              setIsFormDirty(true);
                            }}
                            className={`p-3 border rounded-lg text-left transition cursor-pointer ${
                              selectedProcuradorConta === 'bb'
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-bold'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <span className="text-[11px] font-black block">Banco do Brasil</span>
                            <span className="text-[9.5px] font-mono block mt-0.5 leading-tight text-gray-450">Agência: 0428-6, CC: 61.954-x</span>
                            <span className="text-[9.5px] font-mono block text-gray-450">Pix BB: direito.rgr@gmail.com</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProcuradorConta('nubank');
                              setContaDeposito("Nubank, Pix: 099.356.706-19");
                              setIsFormDirty(true);
                            }}
                            className={`p-3 border rounded-lg text-left transition cursor-pointer ${
                              selectedProcuradorConta === 'nubank'
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-bold'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <span className="text-[11px] font-black block">Nubank</span>
                            <span className="text-[9.5px] font-mono block mt-0.5 leading-tight text-gray-450">Pix Nubank: 099.356.706-19</span>
                            <span className="text-[9.5px] font-mono block text-gray-450">Conta Digital</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {contaDeposito && (
                      <div className="mt-2.5 px-3.5 py-2 bg-gradient-to-r from-gray-50 to-zinc-50 border border-gray-200 rounded-xl text-xs font-mono text-zinc-650 flex items-center justify-between">
                        <div>
                          <strong>Conta Registrada:</strong> {contaDeposito}
                        </div>
                        {tipoContaDepositada === 'cliente' && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">Fase 1</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 7) CONDICIONAIS DE ALVARÁ JUDICIAL: */}
                  {formaRecebimento === 'Alvará judicial' && (
                    <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-4 animate-fade-in text-left">
                      <span className="text-[10px] font-mono font-black text-amber-750 uppercase block tracking-wider font-sans">7. CONDICIONAIS DE ALVARÁ JUDICIAL:</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-mono font-black text-gray-450 uppercase block mb-1">Qual o ID / link do Alvará?</label>
                          <input
                            type="text"
                            placeholder="Link ou ID"
                            value={alvaraId}
                            onChange={(e) => {
                              setAlvaraId(e.target.value);
                              setIsFormDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-black text-gray-450 uppercase block mb-1">Dia do débito em conta</label>
                          <input
                            type="date"
                            value={alvaraDebitoData}
                            onChange={(e) => {
                              setAlvaraDebitoData(e.target.value);
                              setIsFormDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-black text-gray-450 uppercase block mb-1">Alvará recebido efetivamente?</label>
                          <select
                            value={alvaraRecebido}
                            onChange={(e) => {
                              setAlvaraRecebido(e.target.value);
                              setIsFormDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 font-sans"
                          >
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 8) O valor bruto do repasse foi depositado direto na conta do cliente? */}
                  <div>
                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider block mb-1.5 font-mono">8. O valor bruto do repasse foi depositado direto na conta do cliente?</label>
                    <select
                      value={depositadoContaCliente}
                      onChange={(e) => {
                        setDepositadoContaCliente(e.target.value);
                        setIsFormDirty(true);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-250 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition shadow-inner font-sans"
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Stage 2: Apuração Efetiva */}
              {prestacaoStep === 2 && (
                <div className="space-y-6 text-left max-w-3xl mx-auto animate-fade-in font-sans">
                  <div className="border-b border-gray-150 pb-3">
                    <h3 className="text-sm font-black uppercase text-indigo-650 tracking-widest">Etapa 2: Apuração Efetiva das Contas</h3>
                    <p className="text-xs text-gray-400 mt-1">Insira os termos financeiros finais acordados e calcule o total líquido fático de repasse de contas.</p>
                  </div>

                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 flex items-start gap-3">
                    <TrendingUp size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-950 font-sans uppercase">Mapeamento de Apurações Operacionais</h4>
                      <p className="text-[11px] text-indigo-850 mt-0.5 font-semibold leading-relaxed font-sans">Abaixo você poderá ajustar os honorários e os descontos para quitação final.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Qual foi o Honorário Contratado? (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorContrato}
                        onChange={(e) => {
                          setValorContrato(Number(e.target.value));
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white transition shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Sistema de Cobrança Ajustado</label>
                      <select
                        value={feesSystem}
                        onChange={(e) => {
                          setFeesSystem(e.target.value);
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition font-sans"
                      >
                        <option value="Honorários Fixos">Honorários Fixos</option>
                        <option value="Ad Êxito">Ad Êxito (Proporcional Retenido)</option>
                        <option value="Regime Misto">Regime Misto (Fixos + Êxito)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-indigo-650 uppercase block mb-1">Valor Bruto Recebido (Ex: Alvará) [R$]</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={valorRecebidoTotal}
                        onChange={(e) => {
                          setValorRecebidoTotal(Number(e.target.value));
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-black focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-rose-650 uppercase block mb-1">Desconto de Honorários Retidos [R$]</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorHonorariosDeduzido}
                        onChange={(e) => {
                          setValorHonorariosDeduzido(Number(e.target.value));
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-extrabold text-rose-700 focus:bg-white transition"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono font-black text-rose-650 uppercase block mb-1">Custas / Despesas a Deduzir [R$]</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={despesas}
                        onChange={(e) => {
                          setDespesas(Number(e.target.value));
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-extrabold text-rose-700 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Display Liquid repasse card */}
                  <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-150 rounded-2xl text-center space-y-1">
                    <span className="text-[11px] font-mono font-black text-emerald-800 uppercase tracking-widest block font-sans">VALOR LÍQUIDO DO REPASSE AO CLIENTE</span>
                    <h2 className="text-3xl font-black text-emerald-800 tracking-tight font-mono">
                      {formatBRL(Math.max(0, valorRecebidoTotal - valorHonorariosDeduzido - despesas))}
                    </h2>
                    <p className="text-[11px] text-emerald-700 font-semibold max-w-lg mx-auto font-sans leading-relaxed">
                      Este saldo constitui o montante líquido fatico de repasse integral a ser creditado ao cliente {getClientName(selectedClient)} após dedução de honorários de êxito e despesas ressarcíveis de custas.
                    </p>
                  </div>
                </div>
              )}

              {/* Stage 3: Recibo e Envio */}
              {prestacaoStep === 3 && (
                <div className="space-y-6 text-left max-w-3xl mx-auto animate-fade-in font-sans">
                  <div className="border-b border-gray-150 pb-3">
                    <h3 className="text-sm font-black uppercase text-indigo-650 tracking-widest">Etapa 3: Recibo e Envio</h3>
                    <p className="text-xs text-gray-400 mt-1">Visualize o extrato de contas, grave o barramento fático no Drive GDI do cliente e notifique via redes e portais.</p>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/50 flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 font-sans">Visualização Prévia Unificada</h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5 font-medium">Analise seu recibo unificado de contas. Caso precise acertar contas contratuais, você pode voltar para as etapas anteriores.</p>
                    </div>
                  </div>

                  {/* Styled Receipt Summary Block */}
                  <div id="print-area" className="bg-zinc-950 text-white rounded-3xl p-6 relative overflow-hidden font-sans shadow-xl text-left border border-zinc-800">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Scale size={130} />
                    </div>

                    <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
                      <div>
                        <h4 className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest">DEMONSTRATIVO DE REPASSE FINAL</h4>
                        <p className="text-lg font-black tracking-tight mt-0.5 font-sans">Giffoni Advogados Associados</p>
                      </div>
                      <div className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-mono uppercase tracking-widest font-black text-zinc-300">
                        RELATÓRIO: {new Date().toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    <div className="space-y-4 py-4 text-xs font-sans">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-b border-zinc-900 pb-4">
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-mono">ASSISTIDO / REQUERENTE</span>
                          <span className="font-extrabold text-white text-xs">{getClientName(selectedClient)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-mono font-sans">PROCESSO CNJ</span>
                          <span className="font-semibold text-white/90 text-xs font-mono">{(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Processo não anexado'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-mono font-sans">OBJETO DO CASO</span>
                          <span className="font-extrabold text-zinc-200 text-xs font-sans">{(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Coletado'}</span>
                        </div>
                      </div>

                      <div className="space-y-2 font-mono text-zinc-300">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>(+) Entrada / Recebimento Brutal Valor ({formaRecebimento})</span>
                          <span className="text-white font-black">{formatBRL(valorRecebidoTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-rose-300">
                          <span>(-) Dedução Contratual Retida ({feesSystem})</span>
                          <span className="font-black">-{formatBRL(valorHonorariosDeduzido)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-rose-300">
                          <span>(-) Custas e despesas processuais deduzidas</span>
                          <span className="font-black">-{formatBRL(despesas)}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-3 text-emerald-400 font-extrabold text-sm font-black">
                          <span>(=) TOTAL OPERACIONAIS DE REPASSE AO SEU FAVOR</span>
                          <span className="text-emerald-300 font-black">{formatBRL(Math.max(0, valorRecebidoTotal - valorHonorariosDeduzido - despesas))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-3 text-[10px] text-zinc-400 font-medium font-sans">
                      <span>🏦 <strong>Conta Indicada para Repasse:</strong> {contaRepasse || 'Não informada pelo cliente'}</span>
                    </div>
                  </div>

                  {/* Indicação de Conta e Agradecimento editáveis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Confirmar Conta de Repasse (Impresso)</label>
                      <input
                        type="text"
                        placeholder="Ex: Chave PIX: celular 21999999... Banco Nubank"
                        value={contaRepasse}
                        onChange={(e) => setContaRepasse(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition leading-relaxed shadow-inner font-sans"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1 font-sans">Mensagem de Agradecimento (Volte Sempre)</label>
                      <textarea
                        rows={2}
                        value={thanksMessage}
                        onChange={(e) => setThanksMessage(e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white font-sans"
                      />
                    </div>
                  </div>

                  {/* GDI Integration Trigger Panel */}
                  <div className="p-5 bg-indigo-50/75 border border-indigo-100/50 rounded-2xl space-y-3 text-left font-sans">
                    <div className="flex items-center gap-2.5 font-sans">
                      <div className="w-8 h-8 rounded-lg bg-indigo-650 text-white flex items-center justify-center font-black text-xs font-mono shadow-xs">GDI</div>
                      <div>
                        <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider font-sans">Integração da Prestação do GDI</h4>
                        <p className="text-[10px] text-indigo-700 font-semibold font-sans">Criação automatizada de documento na pasta do cliente.</p>
                      </div>
                    </div>

                    {googleDriveSuccess ? (
                      <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-150 flex items-center justify-between text-xs font-bold text-emerald-800 animate-fade-in font-sans">
                        <div className="flex items-center gap-2 font-sans font-bold">
                          <Check size={16} className="text-emerald-600" />
                          <span>Prestação salva na pasta do cliente com sucesso!</span>
                        </div>
                        <a 
                          href={selectedClient?.googleDriveClientFolderUrl || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-sans"
                        >
                          <ExternalLink size={10} />
                          <span>Acessar GDI</span>
                        </a>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleExportToGoogleDrive}
                        disabled={googleDriveLoading || !targetCaseId}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {googleDriveLoading ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Contatando GDI e salvando barramento...</span>
                          </>
                        ) : (
                          <>
                            <FolderOpen size={13} />
                            <span>Exportar Prestação de Contas para pasta de Destino do Cliente</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Todoist Lançamento no Nibo Integration Panel */}
                  <div className="p-5 bg-rose-50/85 border border-rose-100/50 rounded-2xl space-y-4 text-left font-sans">
                    <div className="flex items-center justify-between font-sans">
                      <div className="flex items-center gap-2.5 font-sans">
                        <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs font-mono shadow-xs">TD</div>
                        <div>
                          <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider font-sans">Integração Todoist - Lançamento no Nibo</h4>
                          <p className="text-[10px] text-rose-700 font-semibold font-sans">Agendamento automático de lançamento financeiro no Todoist para a gerente.</p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleSyncTodoistProjects}
                        disabled={syncingProjects}
                        className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg text-[9px] font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={syncingProjects ? "animate-spin" : ""} />
                        <span>Sincronizar Projetos</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5">
                      {/* Project selector */}
                      <div>
                        <label className="text-[9px] font-mono font-black text-rose-800 uppercase block mb-1">Projeto Destino no Todoist</label>
                        <select
                          value={todoistProjectId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTodoistProjectId(val);
                            const matched = syncedProjectsList.find(p => p.id === val);
                            setTodoistProjectName(matched ? matched.name : 'Caixa de Entrada (Inbox)');
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition leading-relaxed shadow-xs"
                        >
                          <option value="__TODOIST_INBOX__">Caixa de Entrada (Inbox)</option>
                          {syncedProjectsList.map(project => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Task title */}
                      <div>
                        <label className="text-[9px] font-mono font-black text-rose-800 uppercase block mb-1">Título da Tarefa Todoist</label>
                        <input
                          type="text"
                          value={todoistTaskTitle}
                          onChange={(e) => setTodoistTaskTitle(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition leading-relaxed shadow-xs font-sans"
                        />
                      </div>

                      {/* Comment text */}
                      <div>
                        <label className="text-[9px] font-mono font-black text-rose-800 uppercase block mb-1">Comentário Consolidado de Prestação de Contas</label>
                        <textarea
                          rows={6}
                          value={todoistTaskComment}
                          onChange={(e) => setTodoistTaskComment(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-mono font-semibold text-gray-700 focus:outline-none focus:bg-white transition leading-relaxed shadow-xs"
                        />
                      </div>
                    </div>

                    {todoistAutomationStatus === 'criado' ? (
                      <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-150 flex items-center justify-between text-xs font-bold text-emerald-800 animate-fade-in font-sans">
                        <div className="flex items-center gap-2 font-sans font-bold">
                          <Check size={16} className="text-emerald-600" />
                          <span>Tarefa de Prestação de Contas no Todoist criada com sucesso!</span>
                        </div>
                        <a 
                          href={todoistTaskUrl || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-sans"
                        >
                          <ExternalLink size={10} />
                          <span>Ver no Todoist</span>
                        </a>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={handleCreateTodoistTask}
                          disabled={todoistLoading || !todoistTaskTitle.trim()}
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-mono text-[10px] font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          {todoistLoading ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              <span>Enviando tarefa e lançando comentário...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={13} />
                              <span>Enviar e Integrar com o Todoist</span>
                            </>
                          )}
                        </button>
                        {todoistAutomationStatus === 'falha' && (
                          <p className="text-[10px] text-rose-600 font-bold mt-2 bg-rose-100/50 p-2 rounded-lg border border-rose-200/40 font-sans">
                            Erro: {todoistTaskLogFalha}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Multichannel Options */}
                  <div className="space-y-3 text-left font-sans">
                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase block tracking-wider font-sans">Como deseja prestar contas ao cliente? (Estrutura multicanal)</span>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { id: 'whatsapp', label: 'WhatsApp', color: 'hover:bg-emerald-50' },
                        { id: 'gmail', label: 'Gmail', color: 'hover:bg-rose-50' },
                        { id: 'facebook', label: 'Facebook', color: 'hover:bg-blue-50' },
                        { id: 'instagram', label: 'Instagram', color: 'hover:bg-pink-50' },
                        { id: 'tiktok', label: 'TikTok', color: 'hover:bg-zinc-100' },
                        { id: 'fisico', label: 'Impresso / Físico', color: 'hover:bg-slate-50' }
                      ].map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setSelectedChannel(ch.id as any);
                            setMessageCopied(false);
                          }}
                          className={`p-3 border rounded-xl text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            selectedChannel === ch.id 
                              ? 'bg-zinc-950 border-zinc-950 text-white scale-102 font-bold shadow-sm font-sans' 
                              : 'bg-white border-gray-200 text-gray-500 font-semibold font-sans'
                          } ${ch.color}`}
                        >
                          <span className="text-[10.5px] uppercase tracking-wider font-extrabold text-center block leading-none">{ch.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Active Channel Preview Template */}
                    <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4.5 space-y-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between font-sans font-black">
                        <span className="text-[10px] font-mono font-black text-indigo-650 uppercase tracking-widest block font-sans">
                          Modelo Pronto do Canal: {selectedChannel.toUpperCase()}
                        </span>
                        
                        {selectedChannel !== 'fisico' && (
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('template-text-parent-3') as HTMLTextAreaElement;
                              if (el) {
                                navigator.clipboard.writeText(el.value);
                                setMessageCopied(true);
                                setTimeout(() => setMessageCopied(false), 2000);
                              }
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-gray-150 text-gray-600 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 size={11} />
                            <span>{messageCopied ? 'Texto Copiado!' : 'Copiar Texto do Modelo'}</span>
                          </button>
                        )}
                      </div>

                      {selectedChannel === 'fisico' ? (
                        <div className="space-y-3 font-sans">
                          <p className="text-[11px] text-gray-450 leading-relaxed font-semibold">
                            Abra a versão para impressão na tela. Você pode carregar um papel timbrado em sua impressora física para colher a assinatura de quitação.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              window.print();
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                          >
                            <Printer size={13} />
                            <span>Imprimir Relatório Quitado</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            id="template-text-parent-3"
                            rows={8}
                            readOnly
                            value={
                              selectedChannel === 'whatsapp' ? `⚖️ *Prestação de Contas - Giffoni Advogados Associados*\n\nPrezado(a) *${getClientName(selectedClient)}*,\n\nAqui está o resumo da prestação de contas do seu processo:\n\n📂 *Caso:* ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\n🔢 *Processo:* ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n💰 *Valor Total Recebido:* ${formatBRL(valorRecebidoTotal)}\n📉 *Honorários Retidos:* -${formatBRL(valorHonorariosDeduzido)}\n💸 *Despesas/Custas:* -${formatBRL(despesas)}\n🏆 *VALOR DO REPASSE:* *${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}*\n\n🏦 *Conta indicada:* ${contaRepasse}\n\n🙏 *Mensagem:* ${thanksMessage}\n\nGiffoni Advogados Associados ✨`
                              : selectedChannel === 'gmail' ? `Prezado(a) ${getClientName(selectedClient)},\n\nSeguem abaixo as informações referentes à à apuração definitiva de contas do seu caso:\n\nCaso: ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\nProcesso: ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n\nValor Total Recebido: ${formatBRL(valorRecebidoTotal)}\nHonorários Advocatícios Retidos: -${formatBRL(valorHonorariosDeduzido)}\nDeduções/Custas: -${formatBRL(despesas)}\n----------------------------------------\nVALOR DO REPASSE LÍQUIDO: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}\n\nConta indicada para Repasse: ${contaRepasse}\n\nMensagem: ${thanksMessage}\n\nEstamos sempre à inteira disposição.\n\nAtenciosamente,\nGiffoni Advogados Associados\nVolte sempre!`
                              : selectedChannel === 'facebook' ? `⚖️ Giffoni Advogados associados - Transparência e Resultado!\n\nCliente: ${getClientName(selectedClient)}\nProcesso Concluído com repasse líquido de: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}!\n\nParabéns! Conta indicada: ${contaRepasse}.\n\n#advocacia #giffoniadvogados #direito #prestacaoContas`
                              : selectedChannel === 'instagram' ? `💼 Prestação de Contas Efetuada com Sucesso pela Giffoni Advogados!\n\nValor do repasse final do cliente: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)} creditados na conta indicada para transferência.\n\nAgradecemos a total confiança jurídica e dedicação em nosso escritório associado! Volte sempre! ✨⚖️\n\n#advocacia #direito #sustentação #giffoniadvogados`
                              : `⚖️ Conta prestada pelo portal: Repasse de ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)} enviado na conta: ${contaRepasse}. Giffoni Advogados Associados! Volte sempre!`
                            }
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-mono font-semibold text-gray-750 focus:outline-none"
                          />

                          <div className="flex items-center gap-2 font-sans">
                            {selectedChannel === 'whatsapp' && (
                              <a
                                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                  `⚖️ *Prestação de Contas - Giffoni Advogados Associados*\n\nPrezado(a) *${getClientName(selectedClient)}*,\n\nAqui está o resumo da prestação de contas do seu processo:\n\n📂 *Caso:* ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\n🔢 *Processo:* ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n💰 *Valor Total Recebido:* ${formatBRL(valorRecebidoTotal)}\n📉 *Honorários Retidos:* -${formatBRL(valorHonorariosDeduzido)}\n💸 *Despesas/Custas:* -${formatBRL(despesas)}\n🏆 *VALOR DO REPASSE:* *${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}*\n\n🏦 *Conta indicada:* ${contaRepasse}\n\n🙏 *Mensagem:* ${thanksMessage}\n\nGiffoni Advogados Associados ✨`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer font-sans"
                              >
                                <Send size={12} />
                                <span>Abrir no WhatsApp</span>
                              </a>
                            )}

                            {selectedChannel === 'gmail' && (
                              <a
                                href={`mailto:${selectedClient?.email || ''}?subject=${encodeURIComponent('Prestação de Contas Definitiva - Giffoni Advogados')}&body=${encodeURIComponent(
                                  `Prezado(a) ${getClientName(selectedClient)},\n\nSeguem abaixo as informações referentes à apuração definitiva de contas do seu caso:\n\nCaso: ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\nProcesso: ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n\nValor Total Recebido: ${formatBRL(valorRecebidoTotal)}\nHonorários Advocatícios Retidos: -${formatBRL(valorHonorariosDeduzido)}\nDeduções/Custas: -${formatBRL(despesas)}\n----------------------------------------\nVALOR DO REPASSE LÍQUIDO: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}\n\nConta indicada para Repasse: ${contaRepasse}\n\nMensagem: ${thanksMessage}\n\nEstamos sempre à inteira disposição.\n\nAtenciosamente,\nGiffoni Advogados Associados\nVolte sempre!`
                                )}`}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer font-sans"
                              >
                                <Mail size={12} />
                                <span>Disparar via E-mail</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions Row */}
              <div className="pt-6 border-t border-gray-150 flex flex-col items-center gap-4">
                {/* Red middle cancel button */}
                <button
                  type="button"
                  onClick={async () => {
                    if (isFormDirty) {
                      const ans = window.confirm("Deseja mesmo sair? O progresso preenchido será salvo como rascunho de prestação de contas.");
                      if (!ans) return;
                      await saveDraftToStorage(false);
                    }
                    navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}`);
                  }}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-750 text-white border border-rose-700/50 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer self-center block shadow-[0_1px_2px_rgba(220,38,38,0.15)] font-mono"
                >
                  {isSavingDraft ? "Salvando Rascunho..." : "Sair / Cancelar (Salvar Rascunho)"}
                </button>

                {/* Left/Right actions in footer */}
                <div className="w-full flex justify-between items-center mt-2.5 font-sans">
                  {prestacaoStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const prev = prestacaoStep === 3 ? "apuracao.efetiva" : "questionario";
                        navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/prestar.contas.${prev}`);
                      }}
                      className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 font-sans"
                    >
                      ❮ Voltar à Etapa {prestacaoStep - 1}
                    </button>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={async () => {
                      if (prestacaoStep === 1) {
                        if (!targetCaseId) {
                          alert("Por favor, selecione qual o Caso Jurisdicional que você irá prestar contas.");
                          return;
                        }
                        if (!contaRepasse) {
                          const bancario = selectedClient.bancarioData || selectedClient.bancarioDadosBancarios || {};
                          if (bancario.bancario_banco) {
                            setContaRepasse(`Banco: ${bancario.bancario_banco}, Ag: ${bancario.bancario_agencia || ''}, CC: ${bancario.bancario_conta || ''}`);
                          } else {
                            setContaRepasse(contaDeposito);
                          }
                        }
                        await saveDraftToStorage(false);
                        navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/prestar.contas.apuracao.efetiva`);
                      } else if (prestacaoStep === 2) {
                        await saveDraftToStorage(false);
                        navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}/prestar.contas.recibo.e.envio`);
                      } else {
                        await saveDraftToStorage(false);
                        alert("Prestação de contas registrada e finalizada faticamente!");
                        navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slug}`);
                      }
                    }}
                    className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer flex items-center gap-1 font-sans shadow-sm"
                  >
                    {prestacaoStep === 1 ? "Próxima Fase: Apuração ➔" : prestacaoStep === 2 ? "Próxima Fase: Recibo e Envio ➔" : "Concluir Extrato ✔"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-left">
            {/* LEFT SIDEBAR NAVIGATION */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs text-left space-y-6">
                {/* Client Profile Header */}
                <div className="border-b border-gray-100 pb-4">
                  <span className="text-[15px] font-mono font-black text-indigo-650 block uppercase tracking-widest">PORTAL INTEGRADO</span>
                  <h3 className="font-extrabold text-[20px] text-gray-900 mt-1 break-words whitespace-normal leading-tight">{getClientName(selectedClient)}</h3>
                  <p className="text-[15px] font-mono text-gray-400 mt-0.5">{getClientDoc(selectedClient)}</p>
                </div>

                {/* Navigation Links */}
                <nav className="space-y-1">
                  {[
                    { id: 'painel_geral', label: 'Painel Geral do Cliente', icon: Activity, desc: 'Métricas, processos e status fáticos' },
                    { id: 'dados_cadastrais', label: 'Dados Cadastrais do Cliente', icon: User, desc: 'Ficha de identificação integrada' },
                    { id: 'crm_cliente', label: 'CRM do Cliente', icon: HeartHandshake, desc: 'Ações comerciais e relacionamento fático' },
                    { id: 'relacao_casos', label: 'Relação de Casos do Cliente', icon: Briefcase, desc: 'Processos e coletas fáticas por caso' },
                    { id: 'audiencias', label: 'Audiências do Cliente', icon: Calendar, desc: 'Gestão de sessões e audiências' },
                    { id: 'pericias', label: 'Perícias do Cliente', icon: UserCheck, desc: 'Gestão de exames e perícias técnicas' },
                    { id: 'reunioes', label: 'Reuniões com o Cliente', icon: Clock, desc: 'Controle de agendamentos fáticos' },
                    { id: 'solicitacao_provas', label: 'Solicitação de Provas', icon: FileBadge, desc: 'Checklist de coletas de documentos adicionais' },
                    { id: 'solicitacao_informacoes', label: 'Solicitação de Informações', icon: HelpCircle, desc: 'Perguntas fáticas complementares pendentes' },
                    { id: 'financeiro', label: 'Financeiro e Faturamento', icon: CreditCard, desc: 'Consolidado financeiro e cobranças' }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = activeSidebarSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSidebarSection(item.id as any);
                          if (item.id === 'relacao_casos') {
                            setActiveSubTab('entrevista');
                          }
                        }}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl transition text-left cursor-pointer group ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-sm font-sans'
                            : 'hover:bg-gray-50 text-gray-700 hover:text-gray-955 border border-transparent'
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        <Icon size={18} className={`shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-700'}`} />
                        <div className="min-w-0">
                          <span className="text-[15px] font-black block">{item.label}</span>
                          <span className={`text-[12px] block whitespace-normal break-words leading-tight font-semibold mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-gray-450'}`}>{item.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </nav>

                {/* View Portal Trigger */}
                <div className="pt-2 border-t border-gray-100">
                  <a
                    href={`/portal-cliente/${selectedClient?.slug || selectedClient?.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-955 rounded-2xl text-xs font-black uppercase tracking-wider font-mono text-center cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>Ver Portal do Cliente</span>
                  </a>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE PANE / CONTENT DISPLAY */}
            <div className="lg:col-span-9 space-y-6">
              {isInvalidRoute && (
                <div className="bg-white border border-gray-150 rounded-[2rem] p-8 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-rose-100">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Seção do editor não encontrada</h3>
                    <p className="text-xs text-gray-550 mt-2 max-w-md mx-auto leading-relaxed">
                      A página ou seção que você tentou acessar não faz parte das configurações válidas do portal. Use o menu lateral para navegar de forma segura.
                    </p>
                  </div>
                </div>
              )}

              {/* VIEW 1: PAINEL GERAL */}
              {activeSidebarSection === 'painel_geral' && (
                <PainelGeralCliente
                  selectedClient={selectedClient}
                  clientCases={clientCases}
                  allClientEvents={allClientEvents}
                  allClientEvidence={allClientEvidence}
                  allClientInformation={allClientInformation}
                  allClientFinancials={allClientFinancials}
                  setActiveSidebarSection={setActiveSidebarSection}
                  handleSelectCase={handleSelectCase}
                  setActiveSubTab={setActiveSubTab}
                  getClientName={getClientName}
                />
              )}

              {/* VIEW 2: DADOS CADASTRAIS */}
              {activeSidebarSection === 'dados_cadastrais' && (
                <DadosCadastraisCliente
                  selectedClient={selectedClient}
                  fichaActiveTab={fichaActiveTab}
                  setFichaActiveTab={setFichaActiveTab}
                  showFichaPassword={showFichaPassword}
                  setShowFichaPassword={setShowFichaPassword}
                  getClientName={getClientName}
                  navigate={navigate}
                />
              )}

              {/* VIEW: CRM DO CLIENTE */}
              {activeSidebarSection === 'crm_cliente' && (() => {
                const isPf = selectedClient?.type === 'PF';
                const pf = selectedClient?.pfData || selectedClient?.pfDadosPessoais || {};
                
                const contactEmail = 
                  selectedClient?.pfContato?.pf_email || 
                  selectedClient?.pfContato?.email || 
                  pf.pf_email || 
                  pf.email || 
                  selectedClient?.portalMirror?.pfContato?.email || 
                  '—';

                const rawPhone = 
                  selectedClient?.pfContato?.pf_telefoneCelular || 
                  selectedClient?.pfContato?.pf_telefone || 
                  selectedClient?.pfContato?.telefone || 
                  pf.pf_telefoneCelular || 
                  pf.pf_telefone || 
                  pf.telefone || 
                  selectedClient?.portalMirror?.pfContato?.telefone || 
                  '—';

                const cleanedPhone = rawPhone.replace(/\D/g, '');

                const handleOpenChannel = (type: 'bday' | 'prof', channel: string, text: string) => {
                  if (channel === 'whatsapp') {
                    const waLink = cleanedPhone 
                      ? `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(text)}`
                      : `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(waLink, '_blank', 'noopener,noreferrer');
                  } else if (channel === 'email') {
                    const subject = type === 'bday' 
                      ? 'Feliz Aniversário! — Giffoni Advogados Associados' 
                      : 'Parabéns pela sua dedicação profissional! — Giffoni Advogados Associados';
                    const emailLink = `mailto:${contactEmail === '—' ? '' : contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
                    window.location.href = emailLink;
                  } else if (channel === 'facebook') {
                    window.open('https://facebook.com', '_blank', 'noopener,noreferrer');
                  } else if (channel === 'instagram') {
                    window.open('https://instagram.com', '_blank', 'noopener,noreferrer');
                  } else if (channel === 'tiktok') {
                    window.open('https://tiktok.com', '_blank', 'noopener,noreferrer');
                  }
                };

                const handleCopy = (type: 'bday' | 'prof', text: string) => {
                  navigator.clipboard.writeText(text);
                  if (type === 'bday') {
                    setBdayCopied(true);
                    setTimeout(() => setBdayCopied(false), 2000);
                  } else {
                    setProfCopied(true);
                    setTimeout(() => setProfCopied(false), 2000);
                  }
                };

                return (
                  <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden text-left space-y-8 animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
                      <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-2xl flex items-center justify-center shadow-3xs shrink-0">
                        <HeartHandshake size={22} className="stroke-[2px]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-black text-indigo-400 uppercase tracking-widest block">RELACIONAMENTO FIDELIZAÇÃO</span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg font-mono border bg-indigo-50 text-indigo-700 border-indigo-200">CRM ATIVO</span>
                        </div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">CRM do Cliente — Portal Integrado</h2>
                      </div>
                    </div>

                    {/* Client Information Summary Badge */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-gray-100 p-4 rounded-2xl">
                      <div>
                        <span className="text-[10px] font-sans font-extrabold text-gray-400 uppercase tracking-wider block">Nome do Cliente</span>
                        <span className="text-xs font-black text-gray-905 block truncate">{getClientName(selectedClient)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-extrabold text-gray-400 uppercase tracking-wider block">Aniversário / Nascimento</span>
                        <span className="text-xs font-black text-gray-850 block truncate">
                          {pf.pf_dataNascimento || pf.dataNascimento || 'Não informada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-extrabold text-gray-400 uppercase tracking-wider block">Profissão / Atividade</span>
                        <span className="text-xs font-black text-[#5850ec] block truncate">
                          {pf.pf_profissao || pf.profissao || 'Não informada'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* CARD 1: HAPPY BIRTHDAY */}
                      <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-indigo-100 transition-colors">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                              <Cake size={20} />
                            </span>
                            <div>
                              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">Felicitar por Aniversário 🎈</h3>
                              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-extrabold">Data de nascimento cadastrada</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xxs font-black text-gray-500 uppercase tracking-widest">Como deseja enviar feliz aniversário ao seu cliente?</p>
                            <div className="flex flex-wrap gap-1">
                              {(['email', 'whatsapp', 'facebook', 'instagram', 'tiktok'] as const).map((ch) => (
                                <button
                                  key={ch}
                                  type="button"
                                  onClick={() => setBdayChannel(ch)}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    bdayChannel === ch
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-650 hover:bg-slate-50'
                                  }`}
                                >
                                  {ch === 'email' && 'E-mail'}
                                  {ch === 'whatsapp' && 'WhatsApp'}
                                  {ch === 'facebook' && 'Facebook'}
                                  {ch === 'instagram' && 'Instagram'}
                                  {ch === 'tiktok' && 'TikTok'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xxs font-black text-slate-400 uppercase tracking-widest">Visualizar / Editar Mensagem integrada</label>
                            <textarea
                              rows={5}
                              value={bdayMessage}
                              onChange={(e) => setBdayMessage(e.target.value)}
                              className="w-full text-xs font-medium text-gray-700 bg-slate-50 border border-gray-150 p-3.5 rounded-2xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                              placeholder="Escreva sua mensagem personalizada..."
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy('bday', bdayMessage)}
                            className="flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                          >
                            <Copy size={13} />
                            <span>{bdayCopied ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenChannel('bday', bdayChannel, bdayMessage)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                          >
                            <Send size={13} />
                            <span>{bdayChannel === 'whatsapp' ? 'Abrir WhatsApp com mensagem pronta' : `Enviar via ${bdayChannel === 'email' ? 'E-mail' : bdayChannel.toUpperCase()}`}</span>
                          </button>
                        </div>
                      </div>

                      {/* CARD 2: PROFESSION DAY */}
                      <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-indigo-100 transition-colors">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                              <Gift size={20} />
                            </span>
                            <div>
                              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">Comemorar Dia da Profissão 💼</h3>
                              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-extrabold">Felicite a atividade comercial</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xxs font-black text-gray-500 uppercase tracking-widest">Como deseja enviar felicitações pelo dia da profissão ao seu cliente?</p>
                            <div className="flex flex-wrap gap-1">
                              {(['email', 'whatsapp', 'facebook', 'instagram', 'tiktok'] as const).map((ch) => (
                                <button
                                  key={ch}
                                  type="button"
                                  onClick={() => setProfChannel(ch)}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    profChannel === ch
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-650 hover:bg-slate-50'
                                  }`}
                                >
                                  {ch === 'email' && 'E-mail'}
                                  {ch === 'whatsapp' && 'WhatsApp'}
                                  {ch === 'facebook' && 'Facebook'}
                                  {ch === 'instagram' && 'Instagram'}
                                  {ch === 'tiktok' && 'TikTok'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xxs font-black text-slate-400 uppercase tracking-widest">Visualizar / Editar Mensagem integrada</label>
                            <textarea
                              rows={5}
                              value={profMessage}
                              onChange={(e) => setProfMessage(e.target.value)}
                              className="w-full text-xs font-medium text-gray-700 bg-slate-50 border border-gray-150 p-3.5 rounded-2xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                              placeholder="Escreva sua mensagem personalizada..."
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy('prof', profMessage)}
                            className="flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                          >
                            <Copy size={13} />
                            <span>{profCopied ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenChannel('prof', profChannel, profMessage)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                          >
                            <Send size={13} />
                            <span>{profChannel === 'whatsapp' ? 'Abrir WhatsApp com mensagem pronta' : `Enviar via ${profChannel === 'email' ? 'E-mail' : profChannel.toUpperCase()}`}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* CARD 3: AVISO DE DISTRIBUIÇÃO DO PROCESSO */}
                    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-indigo-100 transition-colors">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <FileCheck size={20} />
                          </span>
                          <div>
                            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide font-sans">Aviso de Distribuição do Processo ⚖️</h3>
                            <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-extrabold">Informa o cliente sobre o protocolo e comprovante</span>
                          </div>
                        </div>

                        {/* Case selector for distribution aviso */}
                        <div className="space-y-2">
                          <label className="block text-xxs font-black text-gray-500 uppercase tracking-widest">
                            Selecione o Caso a Notificar
                          </label>
                          <select
                            value={distributionCaseId}
                            onChange={(e) => {
                              const caseIdVal = e.target.value;
                              setDistributionCaseId(caseIdVal);
                              const caseObj = clientCases.find(c => c.id === caseIdVal);
                              if (caseObj) {
                                const clientName = getClientName(selectedClient) || 'Cliente';
                                const caseType = caseObj.registrationType || 'Caso Jurídico';
                                const procNum = caseObj.processNumber || caseObj.protocol?.processNumber || 'Em andamento';
                                const receiptUrl = caseObj.protocol?.protocolReceiptUrl || '';

                                setDistributionMessage(`Olá, ${clientName}! Temos a satisfação de informar que o seu processo correspondente ao caso "${caseType}" (Número do Processo: ${procNum}) foi oficialmente distribuído e protocolado em juízo! Segue o comprovante oficial correspondente para o seu acompanhamento: ${receiptUrl ? receiptUrl : 'Link disponível no seu Portal do Cliente'}. Atenciosamente, Giffoni Advogados Associados.`);
                              }
                            }}
                            className="w-full text-xs font-semibold text-gray-755 bg-white border border-gray-250 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Selecione um caso...</option>
                            {clientCases.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.registrationType || 'Caso Geral'} (ID: {c.id.substring(0, 8)})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Display chosen Case details & protocol receipt */}
                        {(() => {
                          const caseObj = clientCases.find(c => c.id === distributionCaseId);
                          if (!caseObj) return null;

                          const procNum = caseObj.processNumber || caseObj.protocol?.processNumber || '';
                          const receiptName = caseObj.protocol?.protocolReceiptName || '';
                          const receiptUrl = caseObj.protocol?.protocolReceiptUrl || '';

                          return (
                            <div className="p-4 bg-slate-50 border border-gray-100 rounded-2xl space-y-2.5 text-xs text-left">
                              <div>
                                <span className="text-[9px] font-mono font-black text-gray-400 uppercase block">Número do Processo</span>
                                <span className="font-extrabold text-gray-800">{procNum || 'Aguardando distribuição/registro'}</span>
                              </div>

                              {receiptUrl ? (
                                <div className="p-3 border border-emerald-150 bg-emerald-50/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                                  <div className="min-w-0 text-left">
                                    <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider block font-mono">
                                      Comprovante Vinculado no Google Drive
                                    </span>
                                    <span className="block font-bold text-gray-900 break-all leading-normal mt-0.5 truncate font-sans">
                                      {receiptName || 'Comprovante_de_Protocolo.pdf'}
                                    </span>
                                  </div>
                                  <a
                                    href={receiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Ver no Drive
                                  </a>
                                </div>
                              ) : (
                                <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl text-amber-900 text-[10.5px] font-semibold text-left">
                                  ⚠️ Nenhum comprovante de distribuição anexado neste caso. Você pode anexar enviando na Subetapa 3 da aba de Protocolos.
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Message field */}
                        <div className="space-y-2">
                          <label className="block text-xxs font-black text-slate-400 uppercase tracking-widest text-left font-sans">Visualizar / Editar Comunicado ao Cliente</label>
                          <textarea
                            rows={4}
                            value={distributionMessage}
                            onChange={(e) => setDistributionMessage(e.target.value)}
                            className="w-full text-xs font-semibold text-gray-700 bg-slate-50 border border-gray-150 p-3.5 rounded-2xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition leading-relaxed text-left font-sans"
                            placeholder="Selecione um caso para gerar o comunicado automático..."
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap sm:flex-nowrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(distributionMessage);
                            setDistributionCopied(true);
                            setTimeout(() => setDistributionCopied(false), 2000);
                          }}
                          className="flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer font-sans"
                        >
                          <Copy size={13} />
                          <span>{distributionCopied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rawPhone = 
                              selectedClient?.pfContato?.pf_telefoneCelular || 
                              selectedClient?.pfContato?.pf_telefone || 
                              selectedClient?.pfContato?.telefone || 
                              selectedClient?.portalMirror?.pfContato?.telefone || 
                              '';
                            const contactEmail = 
                              selectedClient?.pfContato?.pf_email || 
                              selectedClient?.pfContato?.email || 
                              selectedClient?.portalMirror?.pfContato?.email || 
                              '';
                            const cleanedPhone = rawPhone.replace(/\D/g, '');

                            if (distributionChannel === 'whatsapp') {
                              const link = cleanedPhone
                                ? `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(distributionMessage)}`
                                : `https://wa.me/?text=${encodeURIComponent(distributionMessage)}`;
                              window.open(link, '_blank', 'noopener,noreferrer');
                            } else {
                              const emailLink = `mailto:${contactEmail}?subject=${encodeURIComponent('Aviso de Distribuição e Protocolo do Processo')}&body=${encodeURIComponent(distributionMessage)}`;
                              window.location.href = emailLink;
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-3xs font-sans"
                        >
                          <Send size={13} />
                          <span>{distributionChannel === 'whatsapp' ? 'Abrir WhatsApp com mensagem pronta' : 'Enviar Comunicado de Distribuição'}</span>
                        </button>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                          {(['whatsapp', 'email'] as const).map((ch) => (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => setDistributionChannel(ch)}
                              className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all font-sans cursor-pointer ${
                                distributionChannel === ch
                                  ? 'bg-white text-gray-900 shadow-3xs'
                                  : 'text-gray-450 hover:text-gray-900'
                              }`}
                            >
                              {ch === 'whatsapp' ? 'WA' : 'Mail'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Integrated messaging notice with custom formatting instructions */}
                    <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl text-xs text-indigo-950 flex flex-col gap-2">
                      <p className="font-bold flex items-center gap-1.5">
                        <Laptop size={14} className="text-indigo-650" />
                        <span>Instruções de CRM & Comunicação Multi-Canal</span>
                      </p>
                      <p className="leading-relaxed font-medium text-indigo-900">
                        O sistema preencheu de forma inteligente os contatos cadastrados. Ao acionar o botão <strong>Enviar</strong> para <strong className="text-indigo-750">WhatsApp</strong> ou <strong className="text-indigo-750">E-mail</strong>, o BOSS abrirá os respectivos aplicativos com o destinatário e texto devidamente integrados. Para as redes facebook, instagram e tiktok, copie a mensagem clicando no respectivo botão e cole diretamente no chat ou postagem do canal desejado.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* VIEW 4: AUDIÊNCIAS */}
              {activeSidebarSection === 'audiencias' && (
                <EventsManager
                  type="audiencia"
                  title="Audiências do Cliente"
                  description="Agenda em tempo real das sessões de audiência fáticas vinculadas ao cliente legal."
                  allClientEvents={allClientEvents}
                  clientCases={clientCases}
                  addingEvent={addingEvent}
                  newEventCaseId={newEventCaseId}
                  setNewEventCaseId={setNewEventCaseId}
                  newEventTitle={newEventTitle}
                  setNewEventTitle={setNewEventTitle}
                  newEventDate={newEventDate}
                  setNewEventDate={setNewEventDate}
                  newEventTime={newEventTime}
                  setNewEventTime={setNewEventTime}
                  newEventLocation={newEventLocation}
                  setNewEventLocation={setNewEventLocation}
                  newEventDesc={newEventDesc}
                  setNewEventDesc={setNewEventDesc}
                  newEventVisible={newEventVisible}
                  setNewEventVisible={setNewEventVisible}
                  handleCreateEvent={handleCreateEvent}
                  handleUpdateEventStatus={handleUpdateEventStatus}
                  handleToggleEventVisibility={handleToggleEventVisibility}
                  handleDeleteEvent={handleDeleteEvent}
                  setAllClientEvents={setAllClientEvents}
                  selectedClient={selectedClient}
                />
              )}

              {/* VIEW 5: PERÍCIAS */}
              {activeSidebarSection === 'pericias' && (
                <EventsManager
                  type="pericia"
                  title="Perícias Clínicas ou Técnicas fáticas"
                  description="Agenda e orientações para perícias médicas, contábeis ou de assistência técnica fática no portal."
                  allClientEvents={allClientEvents}
                  clientCases={clientCases}
                  addingEvent={addingEvent}
                  newEventCaseId={newEventCaseId}
                  setNewEventCaseId={setNewEventCaseId}
                  newEventTitle={newEventTitle}
                  setNewEventTitle={setNewEventTitle}
                  newEventDate={newEventDate}
                  setNewEventDate={setNewEventDate}
                  newEventTime={newEventTime}
                  setNewEventTime={setNewEventTime}
                  newEventLocation={newEventLocation}
                  setNewEventLocation={setNewEventLocation}
                  newEventDesc={newEventDesc}
                  setNewEventDesc={setNewEventDesc}
                  newEventVisible={newEventVisible}
                  setNewEventVisible={setNewEventVisible}
                  handleCreateEvent={handleCreateEvent}
                  handleUpdateEventStatus={handleUpdateEventStatus}
                  handleToggleEventVisibility={handleToggleEventVisibility}
                  handleDeleteEvent={handleDeleteEvent}
                />
              )}

              {/* VIEW 6: REUNIÕES */}
              {activeSidebarSection === 'reunioes' && (
                <EventsManager
                  type="reuniao"
                  title="Reuniões com o Cliente"
                  description="Agenda de briefings jurídicos, entrevistas complementares e pautas de discussões processuais."
                  allClientEvents={allClientEvents}
                  clientCases={clientCases}
                  addingEvent={addingEvent}
                  newEventCaseId={newEventCaseId}
                  setNewEventCaseId={setNewEventCaseId}
                  newEventTitle={newEventTitle}
                  setNewEventTitle={setNewEventTitle}
                  newEventDate={newEventDate}
                  setNewEventDate={setNewEventDate}
                  newEventTime={newEventTime}
                  setNewEventTime={setNewEventTime}
                  newEventLocation={newEventLocation}
                  setNewEventLocation={setNewEventLocation}
                  newEventDesc={newEventDesc}
                  setNewEventDesc={setNewEventDesc}
                  newEventVisible={newEventVisible}
                  setNewEventVisible={setNewEventVisible}
                  handleCreateEvent={handleCreateEvent}
                  handleUpdateEventStatus={handleUpdateEventStatus}
                  handleToggleEventVisibility={handleToggleEventVisibility}
                  handleDeleteEvent={handleDeleteEvent}
                />
              )}

              {/* VIEW 7: FINANCEIRO E FATURAMENTO */}
              {activeSidebarSection === 'financeiro' && (
                <FinancialManager
                  clientCases={clientCases}
                  allClientFinancials={allClientFinancials}
                  addingFinancial={addingFinancial}
                  newChargeType={newChargeType}
                  setNewChargeType={setNewChargeType}
                  newAmount={newAmount}
                  setNewAmount={setNewAmount}
                  newPaymentMethod={newPaymentMethod}
                  setNewPaymentMethod={setNewPaymentMethod}
                  newInstallments={newInstallments}
                  setNewInstallments={setNewInstallments}
                  newDueDate={newDueDate}
                  setNewDueDate={setNewDueDate}
                  newFinancialStatus={newFinancialStatus}
                  setNewFinancialStatus={setNewFinancialStatus}
                  newPublicMessage={newPublicMessage}
                  setNewPublicMessage={setNewPublicMessage}
                  handleCreateFinancial={handleCreateFinancial}
                  handleMarkFinancialPaid={handleMarkFinancialPaid}
                  handleDeleteFinancial={handleDeleteFinancial}
                  selectedClient={selectedClient}
                  selectedCase={selectedCase}
                />
              )}

              {/* VIEW 8: SOLICITAÇÃO DE PROVAS (STANDALONE SECTION) */}
              {activeSidebarSection === 'solicitacao_provas' && (
                <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs text-left space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-xs">
                        <FileBadge size={18} />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono font-black text-gray-400 uppercase tracking-widest block">COLETA DE DOCUMENTOS</span>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Solicitação de Provas</h3>
                      </div>
                    </div>

                    {/* Integrated Case Selector if multiple cases exist */}
                    {clientCases.length > 1 && (
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase font-mono font-black text-gray-400 tracking-wider">Caso Ativo:</label>
                        <select
                          value={selectedCase?.id || ''}
                          onChange={(e) => {
                            const found = clientCases.find(c => c.id === e.target.value);
                            if (found) handleSelectCase(found);
                          }}
                          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 font-sans outline-none font-semibold text-gray-700"
                        >
                          {clientCases.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.registrationType || 'Sem tipo'} (ID: {c.id.substring(0, 8)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {!selectedCase ? (
                    <div className="border border-dashed rounded-2xl p-8 text-center text-xs text-gray-400 leading-normal">
                      Este cliente não possui nenhum caso ativo selecionado. Crie ou selecione um caso na aba "Relação de Casos".
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Active Case display if only 1 case or for reference */}
                      {clientCases.length <= 1 && (
                        <div className="p-3 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between">
                          <span className="text-xs font-mono font-black text-gray-400 uppercase">Estudo de Caso Vinculado:</span>
                          <span className="text-xs font-black text-gray-800 uppercase">{selectedCase.registrationType || 'Dados Gerais'} ({selectedCase.id})</span>
                        </div>
                      )}

                      <div className="p-4 bg-emerald-50/75 border border-emerald-100/50 rounded-2xl">
                        <h5 className="font-extrabold text-xs text-emerald-955 flex items-center gap-1.5 uppercase tracking-wide">
                          <FileBadge size={14} className="text-emerald-600" />
                          Checklist de Coleta de Provas
                        </h5>
                        <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                          Adicione solicitações de documentos e provas para o cliente. O cliente poderá anexar os documentos diretamente pelo portal de coletas.
                        </p>
                      </div>

                      {/* LIST OF PROOFS */}
                      <div className="space-y-3">
                        <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Histórico de Provas Solicitadas</h6>
                        {evidenceRequests.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhuma prova complementar solicitada até o momento.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {evidenceRequests.map((req) => (
                              <div key={req.id} className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap text-left">
                                    <span className={`text-[8.5px] font-black font-mono uppercase px-1.5 py-0.5 rounded-md ${
                                      req.status === 'aprovado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {req.status === 'aprovado' ? 'Aprovado' : 'Pendente'}
                                    </span>
                                    <h5 className="font-extrabold text-xs text-gray-950">{req.title}</h5>
                                  </div>
                                  {req.description && (
                                    <p className="text-[11px] text-gray-400 mt-1 leading-normal text-left">{req.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <button
                                    onClick={() => handleToggleProofStatus(req)}
                                    type="button"
                                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                      req.status === 'aprovado'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-white text-gray-600 border-gray-150 hover:bg-gray-50'
                                    }`}
                                  >
                                    <CheckCircle2 size={13} />
                                    {req.status === 'aprovado' ? 'Aprovada' : 'Aprovar'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProof(req.id)}
                                    type="button"
                                    className="p-2.5 text-rose-600 hover:text-rose-750 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded-xl transition cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ADD NEW PROOF FORM */}
                      <form onSubmit={handleCreateProof} className="border-t border-gray-100 pt-6 space-y-4">
                        <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Nova Solicitação de Documento/Prova</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Título do Documento *</label>
                            <input
                              type="text"
                              placeholder="Ex: Comprovante de Residência Atualizado"
                              value={newProofTitle}
                              onChange={(e) => setNewProofTitle(e.target.value)}
                              required
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Orientações Fáticas da Prova</label>
                            <input
                              type="text"
                              placeholder="Ex: Deve estar em formato PDF legível e com data recente"
                              value={newProofDesc}
                              onChange={(e) => setNewProofDesc(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newProofVisible}
                              onChange={(e) => setNewProofVisible(e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            Visível no Portal do Cliente
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newProofUpload}
                              onChange={(e) => setNewProofUpload(e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            Permitir Upload do Cliente
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={addingProof}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                        >
                          {addingProof ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                          Adicionar Prova
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 9: SOLICITAÇÃO DE INFORMAÇÕES (STANDALONE SECTION) */}
              {activeSidebarSection === 'solicitacao_informacoes' && (
                <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs text-left space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-xs">
                        <HelpCircle size={18} />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono font-black text-gray-400 uppercase tracking-widest block font-bold">PERGUNTAS COMPLEMENTARES</span>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Solicitação de Informações</h3>
                      </div>
                    </div>

                    {/* Integrated Case Selector if multiple cases exist */}
                    {clientCases.length > 1 && (
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase font-mono font-black text-gray-400 tracking-wider">Caso Ativo:</label>
                        <select
                          value={selectedCase?.id || ''}
                          onChange={(e) => {
                            const found = clientCases.find(c => c.id === e.target.value);
                            if (found) handleSelectCase(found);
                          }}
                          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 font-sans outline-none font-semibold text-gray-700"
                        >
                          {clientCases.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.registrationType || 'Sem tipo'} (ID: {c.id.substring(0, 8)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {!selectedCase ? (
                    <div className="border border-dashed rounded-2xl p-8 text-center text-xs text-gray-400 leading-normal">
                      Este cliente não possui nenhum caso ativo selecionado. Crie ou selecione um caso na aba "Relação de Casos".
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Active Case display if only 1 case or for reference */}
                      {clientCases.length <= 1 && (
                        <div className="p-3 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between">
                          <span className="text-xs font-mono font-black text-gray-400 uppercase">Estudo de Caso Vinculado:</span>
                          <span className="text-xs font-black text-gray-800 uppercase">{selectedCase.registrationType || 'Dados Gerais'} ({selectedCase.id})</span>
                        </div>
                      )}

                      <div className="p-4 bg-amber-50/75 border border-amber-100/50 rounded-2xl">
                        <h5 className="font-extrabold text-xs text-amber-955 flex items-center gap-1.5 uppercase tracking-wide">
                          <HelpCircle size={14} className="text-amber-600" />
                          Informações Complementares do Caso
                        </h5>
                        <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                          Formule perguntas fáticas complementares específicas que o cliente deve responder para viabilizar o andamento técnico da causa.
                        </p>
                      </div>

                      {/* HISTÓRICO DE PERGUNTAS */}
                      <div className="space-y-4">
                        <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Histórico de Respostas e Perguntas</h6>
                        {informationRequests.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhuma pergunta complementar registrada ainda.</p>
                        ) : (
                          <div className="space-y-4">
                            {informationRequests.map((q) => (
                              <div key={q.id} className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-3.5">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-start gap-2">
                                    <span className={`text-[8px] font-black font-mono uppercase px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 ${
                                      q.status === 'revisado' ? 'bg-emerald-100 text-emerald-800' :
                                      q.status === 'respondido' ? 'bg-blue-100 text-blue-800' : 'bg-gray-150 text-gray-600'
                                    }`}>
                                      {q.status || 'Pendente'}
                                    </span>
                                    <h5 className="font-extrabold text-xs text-gray-905 leading-normal">{q.question}</h5>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[9.5px] uppercase font-black text-gray-400 tracking-widest font-mono">Resposta do Cliente (Editável)</label>
                                  <textarea
                                    value={q.answer || ''}
                                    onChange={(e) => {
                                      const updatedVal = e.target.value;
                                      setInformationRequests((prev) =>
                                        prev.map((item) => (item.id === q.id ? { ...item, answer: updatedVal } : item))
                                      );
                                    }}
                                    placeholder="Aguardando narrativa técnica ou resposta fática..."
                                    rows={2}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuestionAnswer(q.id, q.answer || '', 'respondido')}
                                    className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-650 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer font-bold"
                                  >
                                    Salvar Como Respondido
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuestionAnswer(q.id, q.answer || '', 'revisado')}
                                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer font-bold"
                                  >
                                    Confirmar e Validar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PERGUNTA COMPLEMENTAR FORM */}
                      <form onSubmit={handleCreateQuestion} className="border-t border-gray-100 pt-6 space-y-3">
                        <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Nova Pergunta Complementar</h6>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-400">Texto da Pergunta *</label>
                          <input
                            type="text"
                            placeholder="Ex: Em qual data exata ocorreu a interrupção do fornecimento do serviço?"
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                            required
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={addingQuestion}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                        >
                          {addingQuestion ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                          Adicionar Pergunta
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: RELAÇÃO DOS CASOS DO CLIENTE (AND INNER SELECT PROCESS FORMS) */}
              {activeSidebarSection === 'relacao_casos' && (
                <div className="space-y-6">
                  {/* Old Ficha Cadastro block removed */}
                        {/* 2. SECTOR: TODOS OS CASOS DO CLIENTE */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs text-left">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-purple-50 border border-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-xs">
                  <Briefcase size={18} />
                </div>
                <div>
                  <span className="text-[9px] font-mono font-black text-gray-400 uppercase tracking-widest block">CASOS VINCULADOS</span>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">Estudos de Caso e Processos</h3>
                </div>
              </div>

              {clientCases.length === 0 ? (
                <div className="mt-6 border border-dashed rounded-2xl p-8 text-center text-xs text-gray-400 leading-normal">
                  Este cliente não possui nenhum caso registrado no fluxo de produção.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {clientCases.map((c) => {
                    const isSelectedCase = selectedCase?.id === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCase(c)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[140px] relative ${
                          isSelectedCase 
                            ? 'bg-purple-50/70 border-purple-500 shadow-xs' 
                            : 'bg-white border-gray-150 hover:bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8.5px] font-mono font-black text-gray-400 uppercase tracking-wider block">ID: {c.id}</span>
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                              c.status === 'arquivado' ? 'bg-gray-150 text-gray-650' : 
                              c.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {c.status || 'Pendente'}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-xs text-gray-900 tracking-tight leading-snug">
                            {c.registrationType || 'Tipo de serviço não definido'}
                          </h4>
                          <p className="text-[11px] text-gray-450 line-clamp-2">
                            {c.entrevistaPadrao || c.description || 'Nenhuma descrição fática cadastrada.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-150/40 pt-4 mt-3">
                          <span className="text-[10px] text-gray-400 font-mono">
                            Etapa: <strong className="text-gray-700 font-bold uppercase">{c.productionStage || 'Início'}</strong>
                          </span>
                          <span className="text-[9.5px] font-mono font-black text-purple-600 uppercase tracking-wider flex items-center gap-1">
                            {isSelectedCase ? 'Ativo na Visão ✨' : 'Selecionar Caso'} <ChevronRight size={10} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. CASE DETAILS COMPILATION ENGINE */}
            {selectedCase && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs space-y-6 text-left animate-fade-in">
                {/* CASE META SUBHEADER */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-[9px] font-mono font-black text-gray-400 block h-3.5">DOCK COMPILADO ATRELADO AO CASO</span>
                    <h4 className="font-black text-sm text-purple-650 font-mono tracking-tight">{selectedCase.id}</h4>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Última alteração: <strong>{selectedCase.updatedAt ? new Date(selectedCase.updatedAt).toLocaleDateString() : 'Não informada'}</strong>
                  </span>
                </div>

                {/* CARD: DATA PREVISTA DE PROTOCOLO & CRM PRAZOS */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 md:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <Calendar size={17} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                          Data Prevista de Protocolo & CRM de Prazos
                        </h4>
                        <p className="text-[10px] text-gray-400">
                          Acompanhamento comercial do prazo de distribuição e alertas ao cliente.
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {(() => {
                      const hasReceipt = !!(selectedCase.protocol?.protocolReceiptUrl || selectedCase.protocolReceiptUrl);
                      const isProtocolado = selectedCase.protocol?.protocolStatus === 'protocolado' || hasReceipt;
                      const dateStr = selectedCase.protocol?.expectedProtocolDate || selectedCase.expectedProtocolDate || '';

                      if (isProtocolado) {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-200 text-emerald-800 text-[9.5px] font-extrabold uppercase rounded-lg font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Protocolado
                          </span>
                        );
                      }

                      if (!dateStr) {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 border border-gray-200 text-gray-650 text-[9.5px] font-extrabold uppercase rounded-lg font-sans">
                            Prazo não definido
                          </span>
                        );
                      }

                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const [year, month, day] = dateStr.split('-').map(Number);
                      const targetDate = new Date(year, month - 1, day);
                      targetDate.setHours(0, 0, 0, 0);

                      const diffTime = targetDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-200 text-rose-800 text-[9.5px] font-extrabold uppercase rounded-lg font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                            Em atraso ({Math.abs(diffDays)} {Math.abs(diffDays) === 1 ? 'dia' : 'dias'})
                          </span>
                        );
                      } else if (diffDays === 0) {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 text-amber-850 text-[9.5px] font-extrabold uppercase rounded-lg font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                            Vence hoje ⚠️
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 border border-blue-200 text-blue-800 text-[9.5px] font-extrabold uppercase rounded-lg font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Em dia (Faltam {diffDays} {diffDays === 1 ? 'dia' : 'dias'})
                          </span>
                        );
                      }
                    })()}
                  </div>

                  {/* Form to edit Expected Date & Trigger Simulation alerts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-550">
                        Alterar Data Prevista do Protocolo
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={selectedCase.protocol?.expectedProtocolDate || selectedCase.expectedProtocolDate || ''}
                          onChange={(e) => handleSaveExpectedProtocolDate(e.target.value)}
                          className="flex-1 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs text-gray-800 font-semibold"
                        />
                      </div>
                      <span className="block text-[9px] text-gray-400 font-medium leading-relaxed">
                        Atualiza instantaneamente os cronogramas de prazos em todo o ecossistema.
                      </span>
                    </div>

                    {/* Disparos Automáticos rules */}
                    <div className="bg-white border border-gray-150 rounded-2xl p-4 space-y-2.5">
                      <span className="block text-[9.5px] font-black text-gray-500 uppercase tracking-wider">
                        Regras de Alertas e Disparos Automáticos
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                        <label className="flex items-center gap-2 font-semibold text-gray-750 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automaticAlert3Days}
                            onChange={(e) => setAutomaticAlert3Days(e.target.checked)}
                            className="rounded text-purple-600 border-gray-300 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>3 dias antes</span>
                        </label>
                        <label className="flex items-center gap-2 font-semibold text-gray-750 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automaticAlert1Day}
                            onChange={(e) => setAutomaticAlert1Day(e.target.checked)}
                            className="rounded text-purple-600 border-gray-300 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>1 dia antes</span>
                        </label>
                        <label className="flex items-center gap-2 font-semibold text-gray-750 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automaticAlertOnDay}
                            onChange={(e) => setAutomaticAlertOnDay(e.target.checked)}
                            className="rounded text-purple-600 border-gray-300 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>No dia do prazo</span>
                        </label>
                        <label className="flex items-center gap-2 font-semibold text-gray-750 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automaticAlertDelay}
                            onChange={(e) => setAutomaticAlertDelay(e.target.checked)}
                            className="rounded text-purple-600 border-gray-300 focus:ring-purple-500 w-3.5 h-3.5"
                          />
                          <span>Diário de atraso</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SOLICITAR JUSTIFICATIVA ACTION PANEL */}
                  {(() => {
                    const hasReceipt = !!(selectedCase.protocol?.protocolReceiptUrl || selectedCase.protocolReceiptUrl);
                    const isProtocolado = selectedCase.protocol?.protocolStatus === 'protocolado' || hasReceipt;
                    const dateStr = selectedCase.protocol?.expectedProtocolDate || selectedCase.expectedProtocolDate || '';

                    if (isProtocolado) return null;

                    // Compute delay status to check if it's delayed or close
                    let isDelayed = false;
                    if (dateStr) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const [year, month, day] = dateStr.split('-').map(Number);
                      const targetDate = new Date(year, month - 1, day);
                      targetDate.setHours(0, 0, 0, 0);
                      isDelayed = targetDate.getTime() < today.getTime();
                    }

                    return (
                      <div className="border-t border-gray-100 pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-550 block">
                            Solicitação de Justificativa de Atraso
                          </span>
                          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {isDelayed ? '⚠️ Recomenda-se envio urgente' : 'Preventivo'}
                          </span>
                        </div>

                        <div className="space-y-3 bg-white border border-gray-150 p-4 rounded-2xl">
                          <p className="text-[11px] text-gray-500 font-medium">
                            Selecione o canal comercial desejado para notificar o advogado ou o cliente solicitando justificativa formal:
                          </p>

                          <div className="flex flex-wrap gap-1.5 pb-1">
                            {(['whatsapp', 'email', 'todoist'] as const).map((ch) => (
                              <button
                                key={ch}
                                type="button"
                                onClick={() => setJustificationChannel(ch)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                  justificationChannel === ch
                                    ? 'bg-purple-600 border-purple-600 text-white shadow-3xs'
                                    : 'bg-white border-gray-250 text-gray-650 hover:bg-slate-50'
                                }`}
                              >
                                {ch === 'whatsapp' && 'WhatsApp'}
                                {ch === 'email' && 'E-mail'}
                                {ch === 'todoist' && 'Todoist Task'}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-1.5">
                            <textarea
                              rows={3}
                              value={justificationMessage}
                              onChange={(e) => setJustificationMessage(e.target.value)}
                              className="w-full text-xs font-semibold text-gray-700 bg-slate-50 border border-gray-150 p-3 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition leading-relaxed"
                              placeholder="Carregando mensagem da justificativa..."
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(justificationMessage);
                                setJustificationCopied(true);
                                setTimeout(() => setJustificationCopied(false), 2000);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                            >
                              <Copy size={13} />
                              <span>{justificationCopied ? 'Copiado!' : 'Copiar Texto'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const rawPhone = 
                                  selectedClient?.pfContato?.pf_telefoneCelular || 
                                  selectedClient?.pfContato?.pf_telefone || 
                                  selectedClient?.pfContato?.telefone || 
                                  selectedClient?.portalMirror?.pfContato?.telefone || 
                                  '';
                                const contactEmail = 
                                  selectedClient?.pfContato?.pf_email || 
                                  selectedClient?.pfContato?.email || 
                                  selectedClient?.portalMirror?.pfContato?.email || 
                                  '';
                                const cleanedPhone = rawPhone.replace(/\D/g, '');

                                if (justificationChannel === 'whatsapp') {
                                  const link = cleanedPhone
                                    ? `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(justificationMessage)}`
                                    : `https://wa.me/?text=${encodeURIComponent(justificationMessage)}`;
                                  window.open(link, '_blank', 'noopener,noreferrer');
                                } else if (justificationChannel === 'email') {
                                  const emailLink = `mailto:${contactEmail}?subject=${encodeURIComponent('Solicitação de Justificativa de Atraso de Protocolo')}&body=${encodeURIComponent(justificationMessage)}`;
                                  window.location.href = emailLink;
                                } else if (justificationChannel === 'todoist') {
                                  // Call standard create task with modified message for simulation
                                  setTodoistTaskTitle(`[ATRASO PROTOCOLO] Solicitar justificativa fática: ${getClientName(selectedClient)}`);
                                  setTodoistTaskComment(justificationMessage);
                                  setActiveSidebarSection('painel_geral');
                                  alert("Configuramos o título e o comentário do Todoist no painel. Agora clique em 'Criar Tarefa no Todoist' no rodapé do portal!");
                                }
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-3xs"
                            >
                              <Send size={13} />
                              <span>{justificationChannel === 'whatsapp' ? 'Abrir WhatsApp com mensagem pronta' : justificationChannel === 'email' ? 'Enviar por E-mail' : 'Criar Tarefa no Todoist'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* VINCULADOS INTERACTIVE NAV TABS */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'entrevista', label: '1. Entrevista', icon: FileText },
                    { id: 'tipo_servico', label: '2. Serviço', icon: Save },
                    { id: 'provas', label: '3. Provas', icon: FileBadge },
                    { id: 'informacoes', label: '4. Info. Complementares', icon: HelpCircle },
                    { id: 'financeiro', label: '5. Financeiro', icon: CreditCard }
                  ].map((subTab) => {
                    const TabIcon = subTab.icon;
                    const isTabActive = activeSubTab === subTab.id;
                    return (
                      <button
                        key={subTab.id}
                        onClick={() => setActiveSubTab(subTab.id as any)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition ${
                          isTabActive 
                            ? 'bg-gray-900 text-white shadow-xs' 
                            : 'bg-gray-50 border border-gray-150 text-gray-600 hover:bg-gray-100 hover:text-gray-950'
                        }`}
                      >
                        <TabIcon size={13} className={isTabActive ? 'text-white' : 'text-gray-450'} />
                        {subTab.label}
                      </button>
                    );
                  })}
                </div>

                {/* TAB CENTRAL PANEL */}
                <div className="pt-2">
                  {loadingCaseDetails ? (
                    <div className="h-56 flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-purple-600" />
                      <span className="text-[10.5px] font-mono font-black text-gray-400 uppercase tracking-widest">Sincronizando entidade...</span>
                    </div>
                  ) : (
                    <>
                      {/* TAB A: ENTREVISTA */}
                      {activeSubTab === 'entrevista' && (
                        <div className="space-y-6">
                          <div className="p-4 bg-blue-50/75 border border-blue-100/50 rounded-2xl">
                            <h5 className="font-extrabold text-xs text-blue-950 flex items-center gap-1.5 uppercase tracking-wide">
                              <FileText size={14} className="text-blue-600" />
                              Narrativa Fática do Atendimento (Entrevista Padrão)
                            </h5>
                            <p className="text-[11px] text-blue-900 mt-1 leading-relaxed">
                              Esta narrativa é o alicerce fático mapeado na entrevista com o cliente. Ela alimenta os checklists fáticos e a estruturação de petições.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Editor da Narrativa Ativa</label>
                            <textarea
                              value={editingNarrative}
                              onChange={(e) => setEditingNarrative(e.target.value)}
                              rows={8}
                              placeholder="Nenhuma narrativa registrada ainda. Digite os fatos colhidos durante o atendimento..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-medium text-gray-800 leading-relaxed focus:bg-white focus:ring-4 focus:ring-blue-100/50 focus:outline-none transition-all placeholder-gray-400"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSaveNarrative}
                              disabled={savingNarrative}
                              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                            >
                              {savingNarrative ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                              Salvar Narrativa
                            </button>
                          </div>
                        </div>
                      )}

                      {/* TAB B: TIPO DE SERVIÇO */}
                      {activeSubTab === 'tipo_servico' && (
                        <div className="space-y-6">
                          <div className="p-4 bg-purple-50/75 border border-purple-100/50 rounded-2xl">
                            <h5 className="font-extrabold text-xs text-purple-950 flex items-center gap-1.5 uppercase tracking-wide">
                              <Briefcase size={14} className="text-purple-600" />
                              Tipo de Serviço & Produção do Caso
                            </h5>
                            <p className="text-[11px] text-purple-900 mt-1 leading-relaxed">
                              Defina se este caso correrá em rito fático Judicial ou Extrajudicial e determine o padrão de enquadramento técnico.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                              <label className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider block">ID Chave do Serviço</label>
                              <input
                                type="text"
                                value={serviceTypeKey}
                                onChange={(e) => setServiceTypeKey(e.target.value)}
                                placeholder="Ex: peticao_inicial, processo_judicial_ajuizado, etc."
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-100 focus:outline-none transition"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider block">Nome do Tipo do Serviço</label>
                              <input
                                type="text"
                                value={serviceTypeName}
                                onChange={(e) => setServiceTypeName(e.target.value)}
                                placeholder="Ex: Petição Inicial a Ajuizar"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-100 focus:outline-none transition"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSaveServiceType}
                              disabled={savingService}
                              className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                            >
                              {savingService ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                              Atualizar Serviço
                            </button>
                          </div>
                        </div>
                      )}

                      {/* TAB C: COLETA DE PROVAS */}
                      {activeSubTab === 'provas' && (
                        <div className="space-y-6">
                          <div className="p-4 bg-emerald-50/75 border border-emerald-100/50 rounded-2xl">
                            <h5 className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                              <FileBadge size={14} className="text-emerald-600" />
                              Checklist de Coleta de Provas
                            </h5>
                            <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                              Adicione solicitações de documentos e provas para o cliente. O cliente poderá anexar os documentos diretamente pelo portal de coletas.
                            </p>
                          </div>

                          {/* LIST OF PROOFS */}
                          <div className="space-y-3">
                            <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Histórico de Provas Solicitadas</h6>
                            {evidenceRequests.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Nenhuma prova complementar solicitada até o momento.</p>
                            ) : (
                              <div className="space-y-2.5">
                                {evidenceRequests.map((req) => (
                                  <div key={req.id} className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap text-left">
                                        <span className={`text-[8.5px] font-black font-mono uppercase px-1.5 py-0.5 rounded-md ${
                                          req.status === 'aprovado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {req.status === 'aprovado' ? 'Aprovado' : 'Pendente'}
                                        </span>
                                        <h5 className="font-extrabold text-xs text-gray-950">{req.title}</h5>
                                      </div>
                                      {req.description && (
                                        <p className="text-[11px] text-gray-400 mt-1 leading-normal text-left">{req.description}</p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0">
                                      <button
                                        onClick={() => handleToggleProofStatus(req)}
                                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                          req.status === 'aprovado'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                            : 'bg-white text-gray-600 border-gray-150 hover:bg-gray-50'
                                        }`}
                                      >
                                        <CheckCircle2 size={13} />
                                        {req.status === 'aprovado' ? 'Aprovada' : 'Aprovar'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteProof(req.id)}
                                        className="p-2.5 text-rose-600 hover:text-rose-750 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded-xl transition cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* ADD NEW PROOF FORM */}
                          <form onSubmit={handleCreateProof} className="border-t border-gray-100 pt-6 space-y-4">
                            <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Nova Solicitação de Documento/Prova</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Título do Documento *</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Comprovante de Residência Atualizado"
                                  value={newProofTitle}
                                  onChange={(e) => setNewProofTitle(e.target.value)}
                                  required
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Orientações Fáticas da Prova</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Deve estar em formato PDF legível e com data recente"
                                  value={newProofDesc}
                                  onChange={(e) => setNewProofDesc(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newProofVisible}
                                  onChange={(e) => setNewProofVisible(e.target.checked)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                Visível no Portal do Cliente
                              </label>
                              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newProofUpload}
                                  onChange={(e) => setNewProofUpload(e.target.checked)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                Permitir Upload do Cliente
                              </label>
                            </div>

                            <button
                              type="submit"
                              disabled={addingProof}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                            >
                              {addingProof ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                              Adicionar Prova
                            </button>
                          </form>
                        </div>
                      )}

                      {/* TAB D: COLETA DE INFORMAÇÕES */}
                      {activeSubTab === 'informacoes' && (
                        <div className="space-y-6">
                          <div className="p-4 bg-amber-50/75 border border-amber-100/50 rounded-2xl">
                            <h5 className="font-extrabold text-xs text-amber-955 flex items-center gap-1.5 uppercase tracking-wide">
                              <HelpCircle size={14} className="text-amber-600" />
                              Informações Complementares do Caso
                            </h5>
                            <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                              Formule perguntas fáticas complementares específicas que o cliente deve responder para viabilizar o andamento técnico da causa.
                            </p>
                          </div>

                          {/* HISTÓRICO DE PERGUNTAS */}
                          <div className="space-y-4">
                            <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Histórico de Respostas e Perguntas</h6>
                            {informationRequests.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Nenhuma pergunta complementar registrada ainda.</p>
                            ) : (
                              <div className="space-y-4">
                                {informationRequests.map((q) => (
                                  <div key={q.id} className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-3.5">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-start gap-2">
                                        <span className={`text-[8px] font-black font-mono uppercase px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 ${
                                          q.status === 'revisado' ? 'bg-emerald-100 text-emerald-800' :
                                          q.status === 'respondido' ? 'bg-blue-100 text-blue-800' : 'bg-gray-150 text-gray-600'
                                        }`}>
                                          {q.status || 'Pendente'}
                                        </span>
                                        <h5 className="font-extrabold text-xs text-gray-905 leading-normal">{q.question}</h5>
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[9.5px] uppercase font-black text-gray-400 tracking-widest font-mono">Resposta do Cliente (Editável)</label>
                                      <textarea
                                        value={q.answer || ''}
                                        onChange={(e) => {
                                          const updatedVal = e.target.value;
                                          setInformationRequests((prev) =>
                                            prev.map((item) => (item.id === q.id ? { ...item, answer: updatedVal } : item))
                                          );
                                        }}
                                        placeholder="Aguardando narrativa técnica ou resposta fática..."
                                        rows={2}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                      />
                                    </div>

                                    <div className="flex items-center justify-end gap-2.5">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuestionAnswer(q.id, q.answer || '', 'respondido')}
                                        className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-650 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                      >
                                        Salvar Como Respondido
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuestionAnswer(q.id, q.answer || '', 'revisado')}
                                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                      >
                                        Confirmar e Validar
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* PERGUNTA COMPLEMENTAR FORM */}
                          <form onSubmit={handleCreateQuestion} className="border-t border-gray-100 pt-6 space-y-3">
                            <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Nova Pergunta Complementar</h6>
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-gray-400">Texto da Pergunta *</label>
                              <input
                                type="text"
                                placeholder="Ex: Em qual data exata ocorreu a interrupção do fornecimento do serviço?"
                                value={newQuestionText}
                                onChange={(e) => setNewQuestionText(e.target.value)}
                                required
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={addingQuestion}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                            >
                              {addingQuestion ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                              Adicionar Pergunta
                            </button>
                          </form>
                        </div>
                      )}

                      {/* TAB E: FINANCEIRO */}
                      {activeSubTab === 'financeiro' && (
                        <div className="space-y-6">
                          <div className="p-4 bg-rose-50/75 border border-rose-100/50 rounded-2xl">
                            <h5 className="font-extrabold text-xs text-rose-955 flex items-center gap-1.5 uppercase tracking-wide">
                              <CreditCard size={14} className="text-rose-600" />
                              Relatório Financeiro do Caso
                            </h5>
                            <p className="text-[11px] text-rose-900 mt-1 leading-relaxed">
                              Acompanhe faturamentos e lançamentos para este caso. Cadastre ad êxito ou faturamentos contratuais unificados.
                            </p>
                          </div>

                          {/* HISTÓRICO DE COBRANÇAS */}
                          <div className="space-y-4">
                            <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Histórico de Cobranças Contratuais</h6>
                            {financials.length === 0 ? (
                              <p className="text-xs text-gray-400 italic font-medium">Nenhum faturamento registrado para este caso.</p>
                            ) : (
                              <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-xs">
                                <table className="w-full text-left text-xs text-gray-500 font-sans">
                                  <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase font-black font-mono tracking-widest border-b border-gray-150">
                                    <tr>
                                      <th className="px-4 py-3">Tipo de Cobrança</th>
                                      <th className="px-4 py-3">Valor (BRL)</th>
                                      <th className="px-4 py-3">Rito / Parc.</th>
                                      <th className="px-4 py-3">Vencimento</th>
                                      <th className="px-4 py-3">Status</th>
                                      <th className="px-4 py-3 text-right">Ação</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-105 font-medium">
                                    {financials.map((fin) => (
                                      <tr key={fin.id} className="hover:bg-gray-50 text-gray-800">
                                        <td className="px-4 py-3.5">
                                          <span className="font-black tracking-tight text-gray-900 block text-left">
                                            {fin.chargeType === 'honorarios_iniciais' ? 'Honorários Iniciais' :
                                             fin.chargeType === 'honorarios_mensais' ? 'Honorários Mensais' :
                                             fin.chargeType === 'taxa_retencao' ? 'Taxa de Retenção' :
                                             fin.chargeType === 'sucesso' ? 'Premiação de Sucesso' : 'Outra Cobrança'}
                                          </span>
                                          {fin.publicFinancialMessage && (
                                            <p className="text-[10px] text-gray-405 truncate max-w-[150px] mt-0.5 text-left">{fin.publicFinancialMessage}</p>
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 font-mono text-gray-950 font-bold block-inline text-left">
                                          {parseFloat(fin.totalAmount || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-4 py-3.5 text-left">
                                          {fin.paymentMethod} ({fin.installments || 1}x)
                                        </td>
                                        <td className="px-4 py-3.5 font-mono text-left">
                                          {fin.firstDueDate ? new Date(fin.firstDueDate).toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                        <td className="px-4 py-3.5 text-left">
                                          <span className={`text-[8.5px] font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded-md ${
                                            fin.financialStatus === 'pago' ? 'bg-emerald-100 text-emerald-800' :
                                            fin.financialStatus === 'vencido' ? 'bg-rose-100 text-rose-800' : 'bg-gray-150 text-gray-700'
                                          }`}>
                                            {fin.financialStatus || 'Pendente'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                          <button
                                            onClick={() => handleDeleteFinancial(fin.id)}
                                            className="text-rose-600 hover:text-rose-850 p-1.5 hover:bg-rose-50 rounded-lg transition"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* NOVO FATURAMENTO FORM */}
                          <form onSubmit={handleCreateFinancial} className="border-t border-gray-100 pt-6 space-y-4">
                            <h6 className="text-[10.5px] font-black uppercase text-gray-400 tracking-wider">Novo Faturamento Técnico de Processo</h6>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Tipo de Faturamento</label>
                                <select
                                  value={newChargeType}
                                  onChange={(e) => setNewChargeType(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-rose-500 font-sans"
                                >
                                  <option value="honorarios_iniciais">Honorários Iniciais</option>
                                  <option value="honorarios_mensais">Honorários Mensais</option>
                                  <option value="taxa_retencao">Taxa de Retenção</option>
                                  <option value="sucesso">Premiação de Sucesso (Ad Êxito)</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Valor Total (BRL) *</label>
                                <input
                                  type="number"
                                  placeholder="Ex: 3500.00"
                                  step="0.01"
                                  value={newAmount}
                                  onChange={(e) => setNewAmount(e.target.value)}
                                  required
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-rose-500"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Método de Lançamento</label>
                                <select
                                  value={newPaymentMethod}
                                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-rose-500 font-sans"
                                >
                                  <option value="boleto">Boleto Bancário</option>
                                  <option value="pix">PIX Instantâneo</option>
                                  <option value="cartao">Cartão de Crédito</option>
                                  <option value="transferência">TED / DOC</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Número de Parcelas</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={newInstallments}
                                  onChange={(e) => setNewInstallments(Number(e.target.value))}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-rose-500"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Primeiro Vencimento</label>
                                <input
                                  type="date"
                                  value={newDueDate}
                                  onChange={(e) => setNewDueDate(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-rose-500 font-sans"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Status Inicial</label>
                                <select
                                  value={newFinancialStatus}
                                  onChange={(e) => setNewFinancialStatus(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-rose-500 font-sans"
                                >
                                  <option value="pendente">Pendente de Liquidação</option>
                                  <option value="pago">Pago / Liquidado</option>
                                  <option value="vencido">Vencido</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-gray-400">Detalhamento ou Nota Pública p/ Cliente</label>
                              <input
                                type="text"
                                placeholder="Ex: Primeira parcela referente à confecção fática da petição inicial"
                                value={newPublicMessage}
                                onChange={(e) => setNewPublicMessage(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={addingFinancial}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                            >
                              {addingFinancial ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                              Lançar Cobrança
                            </button>
                          </form>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
                </div>
              )}
            </div>
          </div>
        )) : (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-12 text-center text-gray-400 min-h-[400px] flex flex-col items-center justify-center space-y-4">
            <User size={36} className="text-gray-300" />
            <p className="text-xs font-black uppercase tracking-wider text-gray-900">Cliente não localizado</p>
            <p className="text-xs text-gray-400">Não foi possível recuperar os dados de {slug}. Verifique o link e tente novamente.</p>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
