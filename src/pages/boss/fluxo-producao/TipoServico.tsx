import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Info, 
  Scale, 
  FileText, 
  FileSignature, 
  FolderOpen, 
  AlertCircle,
  Loader2,
  CheckCircle,
  Briefcase,
  Copy,
  ExternalLink,
  Check,
  Search,
  RefreshCw,
  Folder,
  Calendar,
  Sliders,
  X,
  Tag,
  User,
  Flag,
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  MapPin,
  Bell
} from 'lucide-react';

function formatCNJ(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 20);
  let res = '';
  if (digits.length > 0) {
    res += digits.substring(0, 7);
  }
  if (digits.length > 7) {
    res += '-' + digits.substring(7, 9);
  }
  if (digits.length > 9) {
    res += '.' + digits.substring(9, 13);
  }
  if (digits.length > 13) {
    res += '.' + digits.substring(13, 14);
  }
  if (digits.length > 14) {
    res += '.' + digits.substring(14, 16);
  }
  if (digits.length > 16) {
    res += '.' + digits.substring(16, 20);
  }
  return res;
}

const TODOIST_INBOX_SENTINEL = "**TODOIST_INBOX**";
const TODOIST_INBOX_NAME = "Caixa de Entrada (Inbox)";

const isInvalidTodoistTaskIdentity = (taskId?: string, taskUrl?: string) => {
  const id = String(taskId || "").toLowerCase();
  const url = String(taskUrl || "").toLowerCase();

  return (
    !id ||
    !url ||
    id.includes("demo") ||
    id.includes("fake") ||
    id.includes("mock") ||
    url.includes("showcase") ||
    url.includes("demo") ||
    url.includes("fake") ||
    url.includes("mock") ||
    url.includes("undefined") ||
    url.includes("null")
  );
};

export default function TipoServico() {
  const { caseId } = useParams<{ caseId: string }>();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientId = searchParams.get('clientId');
  const safeCaseId = caseId || '';

  // Parsed subtype sub-page
  let subTypeRoute: 'peticao-inicial' | 'processo-judicial-em-andamento' | 'requerimento-administrativo' | 'outro-servico-administrativo' | null = null;
  if (pathname.endsWith('/peticao-inicial') || pathname.endsWith('/peticao_inicial')) subTypeRoute = 'peticao-inicial';
  else if (pathname.endsWith('/processo-judicial-em-andamento')) subTypeRoute = 'processo-judicial-em-andamento';
  else if (pathname.endsWith('/requerimento-administrativo')) subTypeRoute = 'requerimento-administrativo';
  else if (pathname.endsWith('/outro-servico-administrativo')) subTypeRoute = 'outro-servico-administrativo';

  let currentStep: 'natureza' | 'judicial' | 'extrajudicial' | 'form' = 'natureza';
  if (pathname.endsWith('/judicial')) currentStep = 'judicial';
  else if (pathname.endsWith('/extrajudicial')) currentStep = 'extrajudicial';
  else if (subTypeRoute) currentStep = 'form';

  const getRouteTo = (step: 'natureza' | 'judicial' | 'extrajudicial') => {
    const query = clientId ? `?clientId=${clientId}` : '';
    if (safeCaseId) {
      if (step === 'natureza') return `/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/tipo-producao${query}`;
      if (step === 'judicial') return `/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/tipo-producao/judicial${query}`;
      if (step === 'extrajudicial') return `/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/tipo-producao/extrajudicial${query}`;
    } else {
      if (step === 'natureza') return `/boss-giffoni-clientes/fluxo-producao/tipo-producao${query}`;
      if (step === 'judicial') return `/boss-giffoni-clientes/fluxo-producao/tipo-producao/judicial${query}`;
      if (step === 'extrajudicial') return `/boss-giffoni-clientes/fluxo-producao/tipo-producao/extrajudicial${query}`;
    }
    return '';
  };

  // Core Data States
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Client context
  const [clientName, setClientName] = useState<string>('');
  const [clientSlug, setClientSlug] = useState<string>('');
  const [isEntrevistaIncomplete, setIsEntrevistaIncomplete] = useState(false);

  // Expanded tree states
  const [macroTypeSelection, setMacroTypeSelection] = useState<'judicial' | 'extrajudicial' | null>(null);

  // Specific Subtype Form States
  const [oppositeParty, setOppositeParty] = useState('');
  const [hasOppositeParty, setHasOppositeParty] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [vara, setVara] = useState('');
  const [comarca, setComarca] = useState('');
  const [processNumber, setProcessNumber] = useState('');
  const [serviceSubtype, setServiceSubtype] = useState('');

  // New States for Petição Inicial Structure
  const [areaDireito, setAreaDireito] = useState('');
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [temSubArea, setTemSubArea] = useState<'sim' | 'nao'>('nao');
  const [subArea, setSubArea] = useState('');
  const [showAddAreaInput, setShowAddAreaInput] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');
  const [customAllowedFeesInput, setCustomAllowedFeesInput] = useState<string[]>(["fixo", "exito_simples", "misto"]);
  const [customAreaFeesMap, setCustomAreaFeesMap] = useState<Record<string, string[]>>({});

  // Redistribution states
  const [isRedistributeModalOpen, setIsRedistributeModalOpen] = useState(false);
  const [redistributeJustification, setRedistributeJustification] = useState('');

  // Future Todoist status fields
  const [todoistTaskId, setTodoistTaskId] = useState('');
  const [todoistTaskUrl, setTodoistTaskUrl] = useState('');
  const [todoistTaskLogFalha, setTodoistTaskLogFalha] = useState('');
  const [todoistAutomationStatus, setTodoistAutomationStatus] = useState('aguardando');
  const [todoistInitialCommentStatus, setTodoistInitialCommentStatus] = useState('');
  const [todoistLogs, setTodoistLogs] = useState<any[]>([]);

  const appendFrontendLogs = async (newLogs: any[]) => {
    if (!safeCaseId) return;
    const updatedNewLogs = newLogs.map(log => ({
      ...log,
      timestamp: log.timestamp || new Date().toISOString()
    }));

    setTodoistLogs(prev => {
      const merged = [...prev, ...updatedNewLogs];
      return merged
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-100);
    });

    try {
      const caseSnap = await getDoc(doc(db, 'cases', safeCaseId));
      let existingLogs: any[] = [];
      if (caseSnap.exists()) {
        const dataSnap = caseSnap.data();
        if (dataSnap && Array.isArray(dataSnap.todoistLogs)) {
          existingLogs = dataSnap.todoistLogs;
        }
      }
      let combined = [...existingLogs, ...updatedNewLogs];
      combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const limited = combined.slice(-100);

      await updateDoc(doc(db, 'cases', safeCaseId), { todoistLogs: limited });
      await setDoc(doc(db, 'casos', safeCaseId), { todoistLogs: limited }, { merge: true });
    } catch (err) {
      console.warn("Falha ao salvar logs do frontend no Firestore:", err);
    }
  };

  // Todoist Project and Search states
  const SHOW_TODOIST_QA_SIMULATION = false;
  const [todoistProjectId, setTodoistProjectId] = useState(TODOIST_INBOX_SENTINEL);
  const [todoistProjectName, setTodoistProjectName] = useState(TODOIST_INBOX_NAME);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [syncedProjectsList, setSyncedProjectsList] = useState([
    { id: TODOIST_INBOX_SENTINEL, name: TODOIST_INBOX_NAME }
  ]);

  // Novas possibilidades: data, prazo, prioridade, etiqueta, responsável
  const [todoistDueDate, setTodoistDueDate] = useState('');
  const [todoistPriority, setTodoistPriority] = useState<number>(1);
  const [todoistLabels, setTodoistLabels] = useState('');
  const [todoistAssignee, setTodoistAssignee] = useState('');
  const [showTodoistLogs, setShowTodoistLogs] = useState(false);

  // Todoist dynamic details (description, subtasks, comments, custom fields)
  const [todoistDescription, setTodoistDescription] = useState('');
  const [todoistSubtasks, setTodoistSubtasks] = useState<{ id: string; title: string; completed: boolean; taskId?: string }[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddSubtaskInput, setShowAddSubtaskInput] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const [todoistComments, setTodoistComments] = useState<{ id: string; content: string; createdAt: string }[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [showAddCommentInput, setShowAddCommentInput] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Reminders and Location metadata states
  const [todoistReminders, setTodoistReminders] = useState('');
  const [todoistLocation, setTodoistLocation] = useState('');
  const [todoistProjectsSyncError, setTodoistProjectsSyncError] = useState('');

  useEffect(() => {
    if (currentStep === 'judicial') {
      setMacroTypeSelection('judicial');
    } else if (currentStep === 'extrajudicial') {
      setMacroTypeSelection('extrajudicial');
    } else if (subTypeRoute) {
      const macro = (subTypeRoute === 'peticao-inicial' || subTypeRoute === 'processo-judicial-em-andamento') ? 'judicial' : 'extrajudicial';
      setMacroTypeSelection(macro);
    }
  }, [currentStep, subTypeRoute]);

  useEffect(() => {
    if (subTypeRoute === 'peticao-inicial') {
      setVara(prev => prev || 'A definir');
    }
  }, [subTypeRoute]);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadContext() {
      setError(null);
      setFetching(true);

      try {
        if (safeCaseId) {
          const caseSnap = await getDoc(doc(db, 'cases', safeCaseId));
          if (caseSnap.exists()) {
            const data = caseSnap.data();
            
            // Map legacy and new fields
            const regTypeKey = data.registrationTypeKey || '';
            const macro = data.serviceMacroType || (regTypeKey === 'peticao_inicial' || regTypeKey === 'peticao-inicial' || regTypeKey === 'processo_judicial_em-andamento' || regTypeKey === 'processo-judicial-em-andamento' || regTypeKey === 'processo_judicial_ajuizado' ? 'judicial' : 'extrajudicial');
            setMacroTypeSelection(macro);

            // Populate form values
            setOppositeParty(data.oppositeParty || '');
            setHasOppositeParty(!!data.hasOppositeParty);
            setAssunto(data.assunto || data.title || '');
            setVara(subTypeRoute === 'peticao-inicial' ? (data.vara || 'A definir') : (data.vara || ''));
            setComarca(data.comarca || '');
            setProcessNumber(data.processNumber || '');
            setServiceSubtype(data.serviceSubtype || '');
            setAreaDireito(data.areaDireito || '');
            setCustomAreas(data.customAreas || []);
            setCustomAreaFeesMap(data.customAreaFeesMap || {});
            setTemSubArea(data.temSubArea || 'nao');
            setSubArea(data.subArea || '');

            // Todoist metadata with automatic simulator protection
            let loadedTaskId = data.todoistTaskId || '';
            let loadedTaskUrl = data.todoistTaskUrl || '';
            let loadedProjectId = data.todoistProjectId || '';
            let loadedProjectName = data.todoistProjectName || '';
            let loadedStatus = data.todoistAutomationStatus || 'aguardando';
            let loadedLogFalha = data.todoistTaskLogFalha || '';

            const isFakeOrMock = isInvalidTodoistTaskIdentity(loadedTaskId, loadedTaskUrl);

            if (isFakeOrMock && subTypeRoute === 'peticao-inicial') {
              loadedProjectId = TODOIST_INBOX_SENTINEL;
              loadedProjectName = TODOIST_INBOX_NAME;
              loadedStatus = "aguardando";
              loadedTaskId = "";
              loadedTaskUrl = "";
              loadedLogFalha = "";

              // Persist clean up in Firestore
              const cleanPayload = {
                todoistAutomationStatus: "aguardando",
                todoistTaskId: "",
                todoistTaskUrl: "",
                todoistTaskLogFalha: "",
                todoistProjectId: TODOIST_INBOX_SENTINEL,
                todoistProjectName: TODOIST_INBOX_NAME,
                updatedAt: new Date().toISOString()
              };
              updateDoc(doc(db, 'cases', safeCaseId), cleanPayload).catch((e) => console.error("Error cleaning cases:", e));
              updateDoc(doc(db, 'casos', safeCaseId), cleanPayload).catch((e) => console.error("Error cleaning casos:", e));
            }

            setTodoistTaskId(loadedTaskId);
            setTodoistTaskUrl(loadedTaskUrl);
            setTodoistTaskLogFalha(loadedLogFalha);
            setTodoistAutomationStatus(loadedStatus);
            setTodoistInitialCommentStatus(data.todoistInitialCommentStatus || '');
            setTodoistProjectId(loadedProjectId);
            setTodoistProjectName(loadedProjectName);
            setTodoistLogs(Array.isArray(data.todoistLogs) ? data.todoistLogs : []);

            setTodoistDescription(data.todoistDescription || data.description || data.descricaoDet || data.descricao || '');
            setTodoistSubtasks(Array.isArray(data.todoistSubtasks) ? data.todoistSubtasks : []);
            setTodoistComments(Array.isArray(data.todoistComments) ? data.todoistComments : []);
            setTodoistReminders(data.todoistReminders || '');
            setTodoistLocation(data.todoistLocation || '');

            // 5W2H interview check
            const isNewComplete = !!(
              data.entrevistaPadrao?.trim() &&
              data.checklist5w2h?.oQue === true &&
              data.checklist5w2h?.quem === true &&
              data.checklist5w2h?.onde === true &&
              data.checklist5w2h?.quando === true &&
              data.checklist5w2h?.como === true &&
              data.checklist5w2h?.porque === true &&
              data.checklist5w2h?.comoResolver === true
            );

            const isLegacyComplete = !!(
              data.basesFaticas?.trim() &&
              (data.description?.trim() || data.descricaoDet?.trim() || data.descricao?.trim()) &&
              data.fatosAbordagem?.trim() &&
              data.oQueAconteceu?.trim() &&
              data.quemParticipou?.trim() &&
              data.ondeAconteceu?.trim() &&
              data.quandoAconteceu?.trim() &&
              data.comoAconteceu?.trim() &&
              data.porQueAconteceu?.trim() &&
              (data.comoPretendeResolver?.trim() || data.encaminhamentoEsperado?.trim())
            );

            const is5W2HComplete = isNewComplete || isLegacyComplete;
            const isNewStarted = !!(
              data.entrevistaPadrao?.trim() ||
              data.checklist5w2h?.oQue === true ||
              data.checklist5w2h?.quem === true ||
              data.checklist5w2h?.onde === true ||
              data.checklist5w2h?.quando === true ||
              data.checklist5w2h?.como === true ||
              data.checklist5w2h?.porque === true ||
              data.checklist5w2h?.comoResolver === true
            );

            const isLegacyStarted = !!(
              data.basesFaticas?.trim() ||
              data.description?.trim() ||
              data.descricaoDet?.trim() ||
              data.fatosAbordagem?.trim() ||
              data.oQueAconteceu?.trim() ||
              data.quemParticipou?.trim() ||
              data.ondeAconteceu?.trim() ||
              data.quandoAconteceu?.trim() ||
              data.comoAconteceu?.trim() ||
              data.porQueAconteceu?.trim() ||
              data.comoPretendeResolver?.trim() ||
              data.encaminhamentoEsperado?.trim()
            );

            const isStarted = isNewStarted || isLegacyStarted;
            if (!is5W2HComplete && isStarted) {
              setIsEntrevistaIncomplete(true);
            }

            // Client linkage
            if (data.clientId) {
              const cliSnap = await getDoc(doc(db, 'clients', data.clientId));
              if (cliSnap.exists()) {
                const cData = cliSnap.data();
                setClientSlug(cData.slug || '');
                const name = cData.type === 'PF' 
                  ? (cData.pfDadosPessoais?.pf_nomeCompleto || cData.pfData?.pf_nomeCompleto || '')
                  : (cData.pjDadosEmpresa?.pj_razaoSocial || cData.pjData?.pj_razaoSocial || '');
                setClientName(name);
              }
            }
          } else {
            setError(`O caso ${safeCaseId} solicitado não foi encontrado no sistema.`);
          }
        } else if (clientId) {
          const cliSnap = await getDoc(doc(db, 'clients', clientId));
          if (cliSnap.exists()) {
            const cData = cliSnap.data();
            setClientSlug(cData.slug || '');
            const name = cData.type === 'PF' 
              ? (cData.pfDadosPessoais?.pf_nomeCompleto || cData.pfData?.pf_nomeCompleto || '')
              : (cData.pjDadosEmpresa?.pj_razaoSocial || cData.pjData?.pj_razaoSocial || '');
            setClientName(name);
          } else {
            setError(`O código de cliente [${clientId}] fornecido não pôde ser localizado.`);
          }
        } else {
          setError('Nenhum parâmetro identificador de caso ou de cliente foi fornecido.');
        }
      } catch (err: any) {
        console.error(err);
        setError(`Erro de comunicação com o sistema de dados: ${err.message || err}`);
      } finally {
        setFetching(false);
      }
    }
    loadContext();
  }, [safeCaseId, clientId]);

  const getTodoistFormula = (): string => {
    const clientPart = clientName?.trim() || "DOCUMENTO SEM CLIENTE";
    const oppositePart = oppositeParty?.trim() || "[Parte Adversa]";
    const assuntoPart = assunto?.trim() || "[Assunto]";
    const varaPart = vara?.trim() || "[Vara]";
    const comarcaPart = comarca?.trim() || "[Comarca]";
    const processPart = processNumber?.trim() || "[Processo CNJ]";
    const subtypePart = serviceSubtype?.trim() || "[Tipo de Serviço]";

    if (subTypeRoute === 'peticao-inicial') {
      return `${clientPart} x ${oppositePart} - ${assuntoPart} - Tipo de serviço: Petição inicial a ajuizar - Vara: A definir - Comarca: ${comarcaPart}`;
    }
    if (subTypeRoute === 'processo-judicial-em-andamento') {
      return `${clientPart} x ${oppositePart} - ${assuntoPart} - Tipo de serviço: Processo ${processPart} - ${varaPart} - ${comarcaPart}`;
    }
    if (subTypeRoute === 'requerimento-administrativo') {
      return hasOppositeParty
        ? `${clientPart} x ${oppositePart} - ${assuntoPart} - Tipo de serviço Extrajudicial: Requerimento Administrativo`
        : `${clientPart} - ${assuntoPart} - Tipo de serviço Extrajudicial: Requerimento Administrativo`;
    }
    if (subTypeRoute === 'outro-servico-administrativo') {
      return hasOppositeParty
        ? `${clientPart} x ${oppositePart} - ${assuntoPart} - Tipo de serviço Extrajudicial: ${subtypePart}`
        : `${clientPart} - ${assuntoPart} - Tipo de serviço Extrajudicial: ${subtypePart}`;
    }
    return '';
  };

  const handleCopyFormula = () => {
    const text = getTodoistFormula();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigateToSubtype = async (subtypeKey: string) => {
    if (safeCaseId) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/tipo-producao/${subtypeKey}`);
    } else if (clientId) {
      setLoading(true);
      try {
        const now = new Date().toISOString();
        const baseRef = doc(collection(db, 'cases'));
        const autoCaseId = baseRef.id;

        const isNovoCaso = searchParams.get('source') === 'novo-caso';
        
        let subLabel = '';
        if (subtypeKey === 'peticao-inicial') subLabel = 'Petição Inicial';
        else if (subtypeKey === 'processo-judicial-em-andamento') subLabel = 'Processo Judicial em Andamento';
        else if (subtypeKey === 'requerimento-administrativo') subLabel = 'Requerimento Administrativo';
        else if (subtypeKey === 'outro-servico-administrativo') subLabel = 'Outro Serviço Administrativo';

        const payload = {
          clientId: clientId,
          clientSlug: clientSlug,
          registrationType: subLabel,
          registrationTypeKey: subtypeKey,
          serviceMacroType: (subtypeKey === 'peticao-inicial' || subtypeKey === 'processo-judicial-em-andamento') ? 'judicial' : 'extrajudicial',
          title: "RASCUNHO DE PRODUÇÃO",
          status: isNovoCaso ? "ativo" : "rascunho",
          statusInterno: "Em produção",
          statusPublicoCliente: "Em análise",
          visibleToClient: true,
          productionStatus: "em_producao",
          productionStage: "tipo-producao",
          caseLifecycle: isNovoCaso ? "novo-caso" : "edrp",
          isNovoCaso: isNovoCaso,
          createdAt: now,
          updatedAt: now
        };

        await setDoc(baseRef, payload);

        try {
          await setDoc(doc(db, 'casos', autoCaseId), {
            id: autoCaseId,
            caseId: autoCaseId,
            clienteId: clientId,
            clientId: clientId,
            title: payload.title,
            titulo: payload.title,
            tipo: subLabel,
            caseType: subLabel,
            status: payload.status,
            statusInterno: payload.statusInterno,
            visibleToClient: payload.visibleToClient,
            productionStatus: payload.productionStatus,
            productionStage: payload.productionStage,
            createdAt: now,
            updatedAt: now
          }, { merge: true });
        } catch (mirrorErr) {
          console.warn('Silent mirror save warning:', mirrorErr);
        }

        navigate(`/boss-giffoni-clientes/fluxo-producao/${autoCaseId}/tipo-producao/${subtypeKey}${isNovoCaso ? '?source=novo-caso' : ''}`);
      } catch (err: any) {
        console.error(err);
        setError("Erro ao inicializar o rascunho de caso: " + err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setError("Indentificador de caso ou cliente indisponível.");
    }
  };

  const handleRedistributeCase = async () => {
    if (!safeCaseId) return;
    if (redistributeJustification.trim().length < 20) {
      setError("A justificativa técnica deve conter pelo menos 20 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const caseRef = doc(db, 'cases', safeCaseId);
      const casoRef = doc(db, 'casos', safeCaseId);

      // Fetch current case to get legacy logs if we want to preserve them
      let existingLogs: any[] = [];
      let existingHistory: any[] = [];
      try {
        const caseSnap = await getDoc(caseRef);
        if (caseSnap.exists()) {
          const caseData = caseSnap.data();
          existingLogs = Array.isArray(caseData.complianceLogs) ? caseData.complianceLogs : [];
          existingHistory = Array.isArray(caseData.redistributionHistory) ? caseData.redistributionHistory : [];
        }
      } catch (e) {
        console.error("Error reading case for redistribution logs:", e);
      }

      const newRedistributionLog = {
        id: `redist_${Date.now()}`,
        timestamp: now,
        justification: redistributeJustification.trim(),
        user: 'Usuário',
        phase: 'peticao-inicial'
      };

      const newActionLog = {
        id: `log_${Date.now()}`,
        timestamp: now,
        action: 'Redistribuição de Processo',
        details: `Processo redistribuído com justificativa: ${redistributeJustification.trim()}`,
        status: 'sucesso'
      };

      const updatedHistory = [newRedistributionLog, ...existingHistory];
      const updatedActionLogs = [newActionLog, ...existingLogs].slice(0, 50);

      // Prepare clear payload
      const resetPayload: any = {
        serviceMacroType: "", // subetapa 1 & 2 reset
        registrationTypeKey: "",
        registrationType: "",
        serviceSubtype: "",
        todoistTaskId: "", // subetapa 3 reset
        todoistTaskUrl: "",
        todoistAutomationStatus: "aguardando",
        todoistTaskLogFalha: "",
        todoistDescription: "",
        todoistSubtasks: [],
        todoistComments: [],
        todoistReminders: "",
        todoistLocation: "",
        todoistInitialCommentStatus: "",
        todoistFormula: "",
        todoistLogs: [],
        redistributionHistory: updatedHistory,
        complianceLogs: updatedActionLogs,
        updatedAt: now
      };

      // Save to both collections
      await updateDoc(caseRef, resetPayload);
      await updateDoc(casoRef, resetPayload);

      // Reset local states to default values
      setMacroTypeSelection(null);
      setServiceSubtype("");
      setTodoistTaskId("");
      setTodoistTaskUrl("");
      setTodoistAutomationStatus("aguardando");
      setTodoistTaskLogFalha("");
      setTodoistDescription("");
      setTodoistSubtasks([]);
      setTodoistComments([]);
      setTodoistReminders("");
      setTodoistLocation("");
      setTodoistInitialCommentStatus("");
      setTodoistLogs([]);
      
      // Close modal
      setIsRedistributeModalOpen(false);
      setRedistributeJustification("");

      // Navigate back to nature selection (Subetapa 01 - Segmento da Demanda base path)
      navigate(`/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/tipo-producao`);
    } catch (e: any) {
      console.error("Error redistributing process:", e);
      setError("Erro ao realizar redistribuição: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubtypeForm = async (advanceAfter: boolean) => {
    if (!safeCaseId) {
      setError("Impossível salvar sem um Identificador de Caso ativo.");
      return;
    }
    
    if (!assunto.trim()) {
      setError('Por favor, defina o campo Assunto para prosseguir.');
      return;
    }

    if (subTypeRoute === 'peticao-inicial') {
      if (!clientName) {
        setError('Por favor, certifique-se de que o nome do cliente está carregado.');
        return;
      }
      if (!oppositeParty.trim()) {
        setError('Por favor, informe a Parte Adversa.');
        return;
      }
      if (!comarca.trim()) {
        setError('Por favor, informe a Comarca.');
        return;
      }
    }

    if (subTypeRoute === 'processo-judicial-em-andamento' && !processNumber.trim()) {
      setError('Por favor, defina o número do Processo CNJ para prosseguir.');
      return;
    }

    if (subTypeRoute === 'outro-servico-administrativo' && !serviceSubtype.trim()) {
      setError('Por favor, defina o tipo de serviço administrativo para prosseguir.');
      return;
    }

    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    const now = new Date().toISOString();
    
    let regType = '';
    let macro = 'judicial';
    if (subTypeRoute === 'peticao-inicial') {
      regType = 'Petição Inicial';
      macro = 'judicial';
    } else if (subTypeRoute === 'processo-judicial-em-andamento') {
      regType = 'Processo Judicial em Andamento';
      macro = 'judicial';
    } else if (subTypeRoute === 'requerimento-administrativo') {
      regType = 'Requerimento Administrativo';
      macro = 'extrajudicial';
    } else if (subTypeRoute === 'outro-servico-administrativo') {
      regType = 'Outro Serviço Administrativo';
      macro = 'extrajudicial';
    }

    const currentFormula = getTodoistFormula();

    let publicStatus = 'Aguardando distribuição';
    if (subTypeRoute === 'processo-judicial-em-andamento') {
      publicStatus = 'Processo em andamento';
    } else if (subTypeRoute === 'requerimento-administrativo') {
      publicStatus = 'Requerimento pendente';
    } else if (subTypeRoute === 'outro-servico-administrativo') {
      publicStatus = 'Serviço administrativo em andamento';
    }

    try {
      const isPeticaoInicial = subTypeRoute === 'peticao-inicial';
      const nextStage = advanceAfter 
        ? (isPeticaoInicial ? "financeiro" : "solicitacoes-provas") 
        : "tipo-producao";

      const payload: any = {
        serviceMacroType: macro,
        registrationTypeKey: isPeticaoInicial ? "peticao_inicial" : subTypeRoute,
        registrationType: isPeticaoInicial ? "Petição Inicial a Ajuizar" : regType,
        serviceSubtype: isPeticaoInicial ? "peticao_inicial" : (subTypeRoute === 'outro-servico-administrativo' ? serviceSubtype : ''),
        clientDisplayName: clientName || '',
        oppositeParty: oppositeParty || '',
        hasOppositeParty: isPeticaoInicial ? true : !!hasOppositeParty,
        assunto: assunto.trim(),
        title: assunto.trim(), 
        todoistFormula: currentFormula,
        todoistProjectId: todoistProjectId,
        todoistProjectName: todoistProjectName,
        todoistTaskId: todoistTaskId || '',
        todoistTaskUrl: todoistTaskUrl || '',
        todoistAutomationStatus: todoistAutomationStatus || 'aguardando',
        todoistTaskLogFalha: todoistTaskLogFalha || '',
        todoistDescription: todoistDescription || '',
        todoistSubtasks: todoistSubtasks || [],
        todoistComments: todoistComments || [],
        todoistReminders: todoistReminders || '',
        todoistLocation: todoistLocation || '',
        updatedAt: now,
        productionStage: nextStage,
        customAreaFeesMap: customAreaFeesMap || {}
      };

      if (isPeticaoInicial) {
        payload.tipoServicoCompleto = true;
        payload.tipoServicoPendente = false;
        payload.vara = vara || 'A definir';
        payload.comarca = comarca || '';
        payload.areaDireito = areaDireito || '';
        payload.customAreas = customAreas || [];
        payload.temSubArea = temSubArea || 'nao';
        payload.subArea = temSubArea === 'sim' ? (subArea || '') : '';
      } else if (macro === 'judicial') {
        payload.vara = vara || '';
        payload.comarca = comarca || '';
        if (subTypeRoute === 'processo-judicial-em-andamento') {
          payload.processNumber = processNumber || '';
        }
      } else {
        payload.serviceSubtype = serviceSubtype || '';
      }

      // Maintain legacy data updates
      await updateDoc(doc(db, 'cases', safeCaseId), payload);

      try {
        await setDoc(doc(db, 'casos', safeCaseId), {
          id: safeCaseId,
          caseId: safeCaseId,
          title: assunto.trim(),
          titulo: assunto.trim(),
          tipo: isPeticaoInicial ? "Petição Inicial a Ajuizar" : regType,
          caseType: isPeticaoInicial ? "Petição Inicial a Ajuizar" : regType,
          registrationTypeKey: isPeticaoInicial ? "peticao_inicial" : subTypeRoute,
          registrationType: isPeticaoInicial ? "Petição Inicial a Ajuizar" : regType,
          productionStage: nextStage,
          todoistProjectId: todoistProjectId,
          todoistProjectName: todoistProjectName,
          todoistTaskId: todoistTaskId || '',
          todoistTaskUrl: todoistTaskUrl || '',
          todoistAutomationStatus: todoistAutomationStatus || 'aguardando',
          todoistTaskLogFalha: todoistTaskLogFalha || '',
          todoistDescription: todoistDescription || '',
          todoistSubtasks: todoistSubtasks || [],
          todoistComments: todoistComments || [],
          todoistReminders: todoistReminders || '',
          todoistLocation: todoistLocation || '',
          updatedAt: now
        }, { merge: true });
      } catch (mirrorErr) {
        console.warn('Silent mirror save warning:', mirrorErr);
      }

      setSaveSuccess(true);

      if (advanceAfter) {
        setTimeout(() => {
          if (isPeticaoInicial) {
            navigate(`/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/financeiro`);
          } else {
            navigate(`/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/solicitacoes-provas`);
          }
        }, 800);
      }

    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar os dados técnicos: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTodoistProjects = async () => {
    setSyncingProjects(true);
    setTodoistProjectsSyncError('');
    try {
      const response = await fetch('/api/todoist/projects');
      const data = await response.json();
      if (data.success && Array.isArray(data.projects)) {
        setSyncedProjectsList(data.projects);
        await appendFrontendLogs([
          {
            level: "success",
            step: "TODOIST_PROJECTS_SYNC_SUCCESS",
            message: "Lista de projetos do Todoist sincronizada com sucesso.",
            details: {
              projectsCount: data.projects.length
            }
          }
        ]);
      } else {
        const errorMsg = data.errorMessage || "Não foi possível obter a lista de projetos do Todoist.";
        setTodoistProjectsSyncError(`Erro ao sincronizar projetos: ${errorMsg}`);
        await appendFrontendLogs([
          {
            level: "error",
            step: "TODOIST_PROJECTS_SYNC_FAILED",
            message: "Não foi possível sincronizar a lista de projetos do Todoist.",
            details: {
              errorMessage: errorMsg
            }
          }
        ]);
      }
    } catch (err: any) {
      console.error("[Todoist Projects Sync Failed]", err);
      const errMsg = err.message || err;
      setTodoistProjectsSyncError(
        `Falha ao conectar com o backend do Todoist: ${errMsg}`
      );
      await appendFrontendLogs([
        {
          level: "error",
          step: "TODOIST_PROJECTS_SYNC_FAILED",
          message: "Não foi possível sincronizar a lista de projetos do Todoist.",
          details: {
            errorMessage: String(errMsg)
          }
        }
      ]);
    } finally {
      setSyncingProjects(false);
    }
  };

  useEffect(() => {
    if (subTypeRoute === 'peticao-inicial') {
      handleSyncTodoistProjects();
    }
  }, [subTypeRoute]);

  const handleCreateTodoistTask = async () => {
    if (!safeCaseId) {
      setError("Erro ao criar tarefa: O ID do caso (caseId) está ausente.");
      return;
    }

    const currentFormula = getTodoistFormula();

    // Specific validation for peticao-inicial according to rule 6
    if (subTypeRoute === "peticao-inicial") {
      const missingFields = [];
      if (!clientName || !clientName.trim()) missingFields.push("Cliente");
      if (!oppositeParty || !oppositeParty.trim()) missingFields.push("Parte Adversa");
      if (!assunto || !assunto.trim()) missingFields.push("Assunto");
      if (!comarca || !comarca.trim()) missingFields.push("Comarca");
      if (!todoistProjectId) missingFields.push("Projeto Destino");
      if (!currentFormula || !currentFormula.trim()) missingFields.push("Fórmula do Todoist");

      if (missingFields.length > 0) {
        setError(`Não é possível criar a tarefa no Todoist. Preencha os seguintes dados obrigatórios: ${missingFields.join(", ")}.`);
        return;
      }
    } else {
      if (!todoistProjectId) {
        setError("Selecione um projeto do Todoist para criar a tarefa.");
        return;
      }
      if (!currentFormula || !currentFormula.trim()) {
        setError("A fórmula do Todoist está vazia.");
        return;
      }
    }

    // detect and prepare duplicate creation factors
    const isDuplicateCreationAttempt = !!(
      todoistTaskId &&
      todoistAutomationStatus === "criado" &&
      !isInvalidTodoistTaskIdentity(todoistTaskId, todoistTaskUrl)
    );

    const previousTodoistTaskId = isDuplicateCreationAttempt ? (todoistTaskId || "") : "";
    const previousTodoistTaskUrl = isDuplicateCreationAttempt ? (todoistTaskUrl || "") : "";

    if (isDuplicateCreationAttempt) {
      await appendFrontendLogs([
        {
          timestamp: new Date().toISOString(),
          level: "warning",
          step: "DUPLICATE_CREATION_WARNING",
          message: "Sistema detectou que já existe tarefa Todoist criada para este caso.",
          details: {
            existingTodoistTaskId: todoistTaskId,
            existingTodoistTaskUrl: todoistTaskUrl
          }
        }
      ]);

      const confirmed = window.confirm(
        `Já existe uma tarefa criada no Todoist para este caso.\n\n` +
        `ID atual: ${todoistTaskId}\n\n` +
        `Deseja criar outra tarefa igual no Todoist?\n\n` +
        `A nova tarefa substituirá o ID e o link exibidos neste painel, mas o histórico ficará registrado nos logs.`
      );

      if (!confirmed) {
        await appendFrontendLogs([
          {
            timestamp: new Date().toISOString(),
            level: "warning",
            step: "DUPLICATE_CREATION_CANCELLED",
            message: "Operador cancelou a criação de tarefa duplicada no Todoist.",
            details: {
              existingTodoistTaskId: todoistTaskId,
              existingTodoistTaskUrl: todoistTaskUrl
            }
          }
        ]);
        return;
      }

      await appendFrontendLogs([
        {
          timestamp: new Date().toISOString(),
          level: "warning",
          step: "DUPLICATE_CREATION_CONFIRMED",
          message: "Operador confirmou criação de nova tarefa mesmo já existindo tarefa anterior.",
          details: {
            previousTodoistTaskId: todoistTaskId,
            previousTodoistTaskUrl: todoistTaskUrl
          }
        }
      ]);
    }

    setTodoistAutomationStatus("gerando");
    setTodoistTaskLogFalha("");
    setError(null);

    // Operational first steps logs
    const initialLogs = [
      {
        level: "info",
        step: "FRONTEND_BUTTON_CLICKED",
        message: "Operador clicou em Criar tarefa no Todoist."
      },
      {
        level: "info",
        step: "FRONTEND_PAYLOAD_PREPARED",
        message: "Payload preparado com o conteúdo do Preview Operacional Todoist.",
        details: {
          caseId: safeCaseId,
          projectId: todoistProjectId,
          projectName: todoistProjectName,
          content: currentFormula,
          route: pathname,
          dueDate: todoistDueDate,
          priority: todoistPriority,
          labelsCount: todoistLabels ? todoistLabels.split(',').length : 0,
          assignee: todoistAssignee,
          previousTodoistTaskId,
          previousTodoistTaskUrl,
          isDuplicateCreationAttempt
        }
      }
    ];
    await appendFrontendLogs(initialLogs);

    // Prepare body
    const bodyPayload = {
      caseId: safeCaseId,
      projectId: todoistProjectId,
      projectName: todoistProjectName,
      content: currentFormula,
      description: todoistDescription,
      dueDate: todoistDueDate,
      priority: todoistPriority,
      labels: todoistLabels ? todoistLabels.split(',').map(l => l.trim()).filter(Boolean) : [],
      assignee: todoistAssignee,
      previousTodoistTaskId,
      previousTodoistTaskUrl,
      isDuplicateCreationAttempt
    };

    try {
      const response = await fetch('/api/todoist/create-case-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await response.json();

      if (data && Array.isArray(data.logs)) {
        setTodoistLogs(prev => {
          const merged = [...prev, ...data.logs];
          return merged
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-100);
        });
      }

      const isTaskCreatedSuccessfully = data && data.verified === true && data.todoistTaskId && data.todoistTaskUrl && !isInvalidTodoistTaskIdentity(data.todoistTaskId, data.todoistTaskUrl);

      if (isTaskCreatedSuccessfully) {
        setTodoistAutomationStatus("criado");
        setTodoistInitialCommentStatus(data.commentVerified ? "criado" : "falha");
        setTodoistTaskId(data.todoistTaskId);
        setTodoistTaskUrl(data.todoistTaskUrl);
        
        if (data.commentVerified) {
          setTodoistTaskLogFalha("");
        } else {
          setTodoistTaskLogFalha("Comentário obrigatório pendente: " + (data.errorMessage || "Falha desconhecida"));
        }

        // Dynamically create any pending subtasks in Todoist
        const createdSubtasks = [...todoistSubtasks];
        for (let i = 0; i < createdSubtasks.length; i++) {
          const sub = createdSubtasks[i];
          if (!sub.taskId) {
            try {
              const subRes = await fetch('/api/todoist/create-case-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  caseId: safeCaseId,
                  projectId: todoistProjectId,
                  projectName: todoistProjectName,
                  content: sub.title,
                  parentId: data.todoistTaskId
                })
              });
              const subData = await subRes.json();
              if (subData.success && subData.todoistTaskId) {
                createdSubtasks[i] = {
                  ...sub,
                  taskId: subData.todoistTaskId
                };
              }
            } catch (err) {
              console.error("Erro ao criar subtarefa no Todoist:", err);
            }
          }
        }
        setTodoistSubtasks(createdSubtasks);

        // Auto-save the full details to Firestore
        const nowStr = new Date().toISOString();
        const updatedPayload: any = {
          todoistTaskId: data.todoistTaskId,
          todoistTaskUrl: data.todoistTaskUrl,
          todoistAutomationStatus: "criado",
          todoistInitialCommentStatus: data.commentVerified ? "criado" : "falha",
          todoistDescription,
          todoistSubtasks: createdSubtasks,
          todoistComments,
          todoistReminders,
          todoistLocation,
          updatedAt: nowStr
        };

        if (data.commentVerified) {
          updatedPayload.todoistTaskLogFalha = "";
        } else {
          updatedPayload.todoistTaskLogFalha = "Comentário obrigatório pendente: " + (data.errorMessage || "Falha ao criar comentário obrigatório");
        }

        await updateDoc(doc(db, 'cases', safeCaseId), updatedPayload);
        await setDoc(doc(db, 'casos', safeCaseId), { id: safeCaseId, caseId: safeCaseId, ...updatedPayload }, { merge: true });

        await appendFrontendLogs([
          {
            level: data.commentVerified ? "success" : "warning",
            step: "FRONTEND_BACKEND_SUCCESS",
            message: data.commentVerified 
              ? "Backend confirmou criação real e comentada da tarefa no Todoist."
              : "Tarefa criada com sucesso, mas o comentário obrigatório automático falhou.",
            details: {
              todoistTaskId: data.todoistTaskId,
              todoistTaskUrl: data.todoistTaskUrl,
              commentVerified: data.commentVerified,
              commentError: data.errorMessage || null
            }
          }
        ]);
      } else {
        const errMsg = data.errorMessage || "A API não confirmou a criação real da tarefa no Todoist.";
        setTodoistAutomationStatus("falha");
        setTodoistInitialCommentStatus("falha");
        if (!previousTodoistTaskId) {
          setTodoistTaskId("");
          setTodoistTaskUrl("");
        }
        setTodoistTaskLogFalha(errMsg);
        setError(`Falha na criação da tarefa Todoist: ${errMsg}`);

        await appendFrontendLogs([
          {
            level: "error",
            step: "FRONTEND_BACKEND_FAILED",
            message: "Backend não confirmou a criação real da tarefa no Todoist.",
            details: {
              errorCode: data.errorCode || "UNKNOWN_ERROR",
              errorMessage: errMsg
            }
          }
        ]);
      }
    } catch (err: any) {
      console.error("[Todoist Create Task Failed]", err);
      const errStr = err.message || err;
      setTodoistAutomationStatus("falha");
      setTodoistInitialCommentStatus("falha");
      if (!previousTodoistTaskId) {
        setTodoistTaskId("");
        setTodoistTaskUrl("");
      }
      setTodoistTaskLogFalha(`Erro de rede / conexão: ${errStr}`);
      setError(`Erro ao criar tarefa no Todoist: ${errStr}`);

      await appendFrontendLogs([
        {
          level: "error",
          step: "FRONTEND_BACKEND_FAILED",
          message: "Backend não confirmou a criação real da tarefa no Todoist.",
          details: {
            errorCode: "NETWORK_CONECTION_ERROR",
            errorMessage: errStr
          }
        }
      ]);
    }
  };

  const handleAddSubtaskClick = async () => {
    if (!newSubtaskTitle.trim()) return;
    setIsAddingSubtask(true);
    const newId = Date.now().toString();
    const tempSubtask = { id: newId, title: newSubtaskTitle, completed: false };

    let finalTaskId: string | undefined;

    if (todoistTaskId && !isInvalidTodoistTaskIdentity(todoistTaskId, todoistTaskUrl)) {
      try {
        const response = await fetch('/api/todoist/create-case-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId: safeCaseId,
            projectId: todoistProjectId,
            projectName: todoistProjectName,
            content: newSubtaskTitle,
            parentId: todoistTaskId
          })
        });
        const data = await response.json();
        if (data.success && data.todoistTaskId) {
          finalTaskId = data.todoistTaskId;
          await appendFrontendLogs([
            {
              level: "success",
              step: "SUBTASK_CREATED",
              message: `Subtarefa criada com sucesso no Todoist: ${newSubtaskTitle}`,
              details: { subtaskId: finalTaskId }
            }
          ]);
        } else {
          console.warn("Erro retornado do Todoist para subtarefa:", data.errorMessage);
        }
      } catch (err) {
        console.error("Erro ao integrar subtarefa com o Todoist:", err);
      }
    }

    const updatedSubtasks = [...todoistSubtasks, { ...tempSubtask, taskId: finalTaskId }];
    setTodoistSubtasks(updatedSubtasks);
    setNewSubtaskTitle('');
    setShowAddSubtaskInput(false);
    setIsAddingSubtask(false);

    // Persist immediately in Firestore
    if (safeCaseId) {
      await updateDoc(doc(db, 'cases', safeCaseId), { todoistSubtasks: updatedSubtasks });
      await setDoc(doc(db, 'casos', safeCaseId), { todoistSubtasks: updatedSubtasks }, { merge: true });
    }
  };

  const handleToggleSubtask = async (subId: string) => {
    const updated = todoistSubtasks.map(sub => {
      if (sub.id === subId) {
        return { ...sub, completed: !sub.completed };
      }
      return sub;
    });
    setTodoistSubtasks(updated);
    if (safeCaseId) {
      await updateDoc(doc(db, 'cases', safeCaseId), { todoistSubtasks: updated });
      await setDoc(doc(db, 'casos', safeCaseId), { todoistSubtasks: updated }, { merge: true });
    }
  };

  const handleRemoveSubtask = async (subId: string) => {
    const updated = todoistSubtasks.filter(sub => sub.id !== subId);
    setTodoistSubtasks(updated);
    if (safeCaseId) {
      await updateDoc(doc(db, 'cases', safeCaseId), { todoistSubtasks: updated });
      await setDoc(doc(db, 'casos', safeCaseId), { todoistSubtasks: updated }, { merge: true });
    }
  };

  const handleAddCommentClick = async () => {
    if (!newCommentText.trim()) return;
    setIsAddingComment(true);
    const newId = Date.now().toString();
    const newComment = { id: newId, content: newCommentText, createdAt: new Date().toISOString() };

    if (todoistTaskId && !isInvalidTodoistTaskIdentity(todoistTaskId, todoistTaskUrl)) {
      try {
        const response = await fetch('/api/todoist/create-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: todoistTaskId,
            content: newCommentText
          })
        });
        const data = await response.json();
        if (data.success) {
          await appendFrontendLogs([
            {
              level: "success",
              step: "COMMENT_CREATED",
              message: `Comentário adicionado com sucesso no Todoist: ${newCommentText}`
            }
          ]);
        } else {
          console.warn("Erro retornado do Todoist para comentário:", data.errorMessage);
        }
      } catch (err) {
        console.error("Erro ao integrar comentário com o Todoist:", err);
      }
    }

    const updatedComments = [...todoistComments, newComment];
    setTodoistComments(updatedComments);
    setNewCommentText('');
    setShowAddCommentInput(false);
    setIsAddingComment(false);

    // Persist immediately in Firestore
    if (safeCaseId) {
      await updateDoc(doc(db, 'cases', safeCaseId), { todoistComments: updatedComments });
      await setDoc(doc(db, 'casos', safeCaseId), { todoistComments: updatedComments }, { merge: true });
    }
  };

  return (
    <FluxoStepLayout
      stepName="Tipo de Serviço"
      caseId={safeCaseId || undefined}
      tipoProducaoSubetapasStep={currentStep}
      serviceMacroType={macroTypeSelection}
      serviceSubtype={serviceSubtype}
      todoistAutomationStatus={todoistAutomationStatus}
      todoistTaskId={todoistTaskId}
    >
      <div className="space-y-8 text-xs md:text-sm">
        
        {/* HEADER INFORMATION BLOCK */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <span className="text-xs font-black uppercase text-gray-400 tracking-wider block font-mono">
              Fase de Produção Operacional
            </span>
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Categorização Técnica & Fórmula Todoist</h3>
            
            {clientName ? (
              <p className="text-xs text-indigo-600 font-bold tracking-wide mt-1 uppercase">
                Cliente: {clientName}
              </p>
            ) : !fetching ? (
              <div className="mt-2 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-xs flex gap-3 items-start">
                <AlertCircle size={16} className="text-red-650 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h5 className="font-extrabold text-red-900 uppercase tracking-wide">⚠️ Alerta Técnico — Cliente Não Vinculado</h5>
                  <p className="leading-relaxed font-semibold">
                    Não foi possível identificar o nome completo do cliente para este caso no Firestore. Por favor, verifique se o cadastro do cliente está completo ou se o vínculo foi realizado corretamente.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Redistribuir processo button, visible only if subTypeRoute === 'peticao-inicial' */}
          {subTypeRoute === 'peticao-inicial' && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsRedistributeModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-red-200 hover:border-red-400 text-red-600 hover:bg-red-50 font-extrabold rounded-2xl text-xs transition-all cursor-pointer shadow-3xs"
              >
                <RefreshCw size={13} className="text-red-500 animate-spin-slow" />
                <span>Redistribuir processo</span>
              </button>
            </div>
          )}
        </div>

        {/* CLICKABLE AND FUNCTIONAL SUBSTAGE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b border-gray-100">
          {/* Card 1 - Segmento */}
          <button
            type="button"
            onClick={() => {
              navigate(getRouteTo('natureza'));
            }}
            className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              currentStep === 'natureza'
                ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-sm scale-[1.01]'
                : 'bg-white border-gray-150 hover:border-indigo-400 hover:shadow-xs'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-xs ${
              currentStep === 'natureza' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-emerald-50 text-emerald-600 border-emerald-150'
            }`}>
              {currentStep !== 'natureza' ? <Check size={14} className="stroke-[3]" /> : <Layers size={14} />}
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider leading-none">Subetapa 01</p>
              <h5 className="font-bold text-xs text-gray-900 mt-1">Segmento da Demanda</h5>
            </div>
          </button>

          {/* Card 2 - Tipo do Serviço */}
          <button
            type="button"
            onClick={() => {
              const macro = macroTypeSelection || 'judicial';
              navigate(getRouteTo(macro));
            }}
            className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              currentStep === 'judicial' || currentStep === 'extrajudicial'
                ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-sm scale-[1.01]'
                : currentStep === 'form'
                ? 'bg-emerald-50/20 border-emerald-150 text-emerald-800'
                : 'bg-white border-gray-150 hover:border-indigo-400 hover:shadow-xs opacity-75'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-xs ${
              currentStep === 'judicial' || currentStep === 'extrajudicial'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : currentStep === 'form'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-150'
                : 'bg-gray-50 text-gray-400 border-gray-100'
            }`}>
              {currentStep === 'form' ? <Check size={14} className="stroke-[3]" /> : <Scale size={14} />}
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider leading-none">Subetapa 02</p>
              <h5 className="font-bold text-xs text-gray-900 mt-1">
                {macroTypeSelection === 'extrajudicial' ? 'Serviço Extrajudicial' : 'Serviço Judicial'}
              </h5>
            </div>
          </button>

          {/* Card 3 - Cadastro */}
          <button
            type="button"
            onClick={() => {
              const subtype = subTypeRoute || 'peticao-inicial';
              const query = clientId ? `?clientId=${clientId}` : '';
              navigate(`/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/tipo-producao/${subtype}${query}`);
            }}
            className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              currentStep === 'form'
                ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-sm scale-[1.01]'
                : 'bg-white border-gray-150 hover:border-indigo-400 hover:shadow-xs opacity-60'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-xs ${
              currentStep === 'form'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : todoistAutomationStatus === 'criado' || !!todoistTaskId
                ? 'bg-emerald-50 text-emerald-600 border-emerald-150'
                : 'bg-gray-50 text-gray-400 border-gray-100'
            }`}>
              {todoistAutomationStatus === 'criado' || !!todoistTaskId ? <Check size={14} className="stroke-[3]" /> : <CheckSquare size={14} />}
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider leading-none">Subetapa 03</p>
              <h5 className="font-bold text-xs text-gray-900 mt-1">Cadastro no Todoist</h5>
            </div>
          </button>
        </div>

        {isEntrevistaIncomplete && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 text-xs flex gap-3 items-start animate-fadeIn">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h5 className="font-extrabold text-amber-900">Entrevista 5W2H incompleta</h5>
              <p className="leading-relaxed">
                Você pode navegar livremente pelo fluxo, mas esta pendência de preenchimento fático continuará registrada.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex gap-3 items-center animate-fadeIn">
            <CheckCircle size={16} className="text-emerald-500 shrink-0" />
            <span className="font-bold leading-relaxed">Dados e fórmula operacional atualizados com sucesso!</span>
          </div>
        )}

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-gray-500" size={24} />
            <span className="text-xs font-bold font-mono uppercase tracking-widest">Pesquisando dados específicos do caso...</span>
          </div>
        ) : currentStep !== 'form' ? (
          
          /* VIEW 1: SELECTION TREE PROCESS (Step 1 -> cards, and Step 2 -> subtypes) */
          <div className="space-y-8 animate-fadeIn">
            
            {/* IF STEP IS naturaleza */}
            {currentStep === 'natureza' && (
              <div className="space-y-4">
                <h4 className="text-sm font-black uppercase text-gray-400 tracking-wider block font-mono">
                  Etapa 1 — Selecione o Segmento da Demanda
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* CARD judicial */}
                  <button
                    type="button"
                    onClick={() => {
                      setMacroTypeSelection('judicial');
                      navigate(getRouteTo('judicial'));
                    }}
                    className={`p-6 rounded-3xl border text-left flex gap-4 items-start transition-all cursor-pointer ${
                      macroTypeSelection === 'judicial' 
                        ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-xs' 
                        : 'bg-white border-gray-150 hover:border-indigo-400 hover:shadow-xs'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${
                      macroTypeSelection === 'judicial' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                      <Scale size={20} />
                    </div>
                    <div className="space-y-1">
                      <h5 className={`font-black text-xs tracking-wider uppercase font-sans ${macroTypeSelection === 'judicial' ? 'text-indigo-900' : 'text-gray-900'}`}>
                        1. JUDICIAL
                      </h5>
                      <p className="text-xs text-gray-550 leading-relaxed font-semibold">
                        Adequado para demandas de rito contencioso em andamento ou peças preparatórias de ajuizamento estrutural perante órgãos judiciais.
                      </p>
                    </div>
                  </button>

                  {/* CARD extrajudicial */}
                  <button
                    type="button"
                    onClick={() => {
                      setMacroTypeSelection('extrajudicial');
                      navigate(getRouteTo('extrajudicial'));
                    }}
                    className={`p-6 rounded-3xl border text-left flex gap-4 items-start transition-all cursor-pointer ${
                      macroTypeSelection === 'extrajudicial' 
                        ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-xs' 
                        : 'bg-white border-gray-150 hover:border-indigo-400 hover:shadow-xs'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${
                      macroTypeSelection === 'extrajudicial' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                      <Briefcase size={20} />
                    </div>
                    <div className="space-y-1">
                      <h5 className={`font-black text-xs tracking-wider uppercase font-sans ${macroTypeSelection === 'extrajudicial' ? 'text-indigo-900' : 'text-gray-900'}`}>
                        2. EXTRAJUDICIAL
                      </h5>
                      <p className="text-xs text-gray-550 leading-relaxed font-semibold">
                        Ideal para notificações preventivas, assessoria contratual pautada em resoluções administrativas e pleitos junto a autarquias.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* IF STEP IS judicial */}
            {currentStep === 'judicial' && (
              <div className="space-y-4">
                {/* Simple Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold font-sans mb-2">
                  <span className="hover:text-indigo-650 cursor-pointer text-gray-400" onClick={() => navigate(getRouteTo('natureza'))}>
                    Tipo de Serviço
                  </span>
                  <span className="text-gray-350">&gt;</span>
                  <span className="text-indigo-600 font-bold uppercase tracking-wider">
                    Judicial
                  </span>
                </div>

                <h4 className="text-sm font-black uppercase text-gray-400 tracking-wider block font-mono">
                  Etapa 2 — Serviço Judicial
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* BUTTON sub 1: Petição Inicial */}
                  <button
                    type="button"
                    onClick={() => {
                      setServiceSubtype('peticao-inicial');
                      handleNavigateToSubtype('peticao-inicial');
                    }}
                    className={`p-5 rounded-3xl text-left flex gap-4 items-start transition-all cursor-pointer border ${
                      serviceSubtype === 'peticao-inicial' || serviceSubtype === 'peticao_inicial'
                        ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-xs'
                        : 'bg-white border-gray-150 hover:border-indigo-400 hover:bg-gray-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      serviceSubtype === 'peticao-inicial' || serviceSubtype === 'peticao_inicial'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      <FileText size={18} />
                    </div>
                    <div className="space-y-1">
                      <h5 className={`font-extrabold text-xs uppercase ${
                        serviceSubtype === 'peticao-inicial' || serviceSubtype === 'peticao_inicial' ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                        Petição Inicial
                      </h5>
                      <p className="text-xs text-gray-550 leading-relaxed">
                        Ajuizar peça inicial qualificada contendo pleitos liminares ou fáticos.
                      </p>
                    </div>
                  </button>

                  {/* BUTTON sub 2: Processo Judicial em Andamento */}
                  <button
                    type="button"
                    onClick={() => {
                      setServiceSubtype('processo-judicial-em-andamento');
                      handleNavigateToSubtype('processo-judicial-em-andamento');
                    }}
                    className={`p-5 rounded-3xl text-left flex gap-4 items-start transition-all cursor-pointer border ${
                      serviceSubtype === 'processo-judicial-em-andamento'
                        ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-xs'
                        : 'bg-white border-gray-150 hover:border-indigo-400 hover:bg-gray-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      serviceSubtype === 'processo-judicial-em-andamento'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      <FolderOpen size={18} />
                    </div>
                    <div className="space-y-1">
                      <h5 className={`font-extrabold text-xs uppercase ${
                        serviceSubtype === 'processo-judicial-em-andamento' ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                        Processo Judicial em Andamento
                      </h5>
                      <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                        Habilitação ativa com número CNJ preexistente nas varas federais ou estaduais.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* IF STEP IS extrajudicial */}
            {currentStep === 'extrajudicial' && (
              <div className="space-y-4">
                {/* Simple Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold font-sans mb-2">
                  <span className="hover:text-indigo-650 cursor-pointer text-gray-400" onClick={() => navigate(getRouteTo('natureza'))}>
                    Tipo de Serviço
                  </span>
                  <span className="text-gray-350">&gt;</span>
                  <span className="text-indigo-600 font-bold uppercase tracking-wider">
                    Extrajudicial
                  </span>
                </div>

                <h4 className="text-sm font-black uppercase text-gray-400 tracking-wider block font-mono">
                  Etapa 2 — Serviço Extrajudicial
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* BUTTON sub 3: Requerimento Administrativo */}
                  <button
                    type="button"
                    onClick={() => {
                      setServiceSubtype('requerimento-administrativo');
                      handleNavigateToSubtype('requerimento-administrativo');
                    }}
                    className={`p-5 rounded-3xl text-left flex gap-4 items-start transition-all cursor-pointer border ${
                      serviceSubtype === 'requerimento-administrativo'
                        ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-xs'
                        : 'bg-white border-gray-150 hover:border-indigo-400 hover:bg-gray-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      serviceSubtype === 'requerimento-administrativo'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      <FileSignature size={18} />
                    </div>
                    <div className="space-y-1">
                      <h5 className={`font-extrabold text-xs uppercase ${
                        serviceSubtype === 'requerimento-administrativo' ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                        Requerimento Administrativo
                      </h5>
                      <p className="text-xs text-gray-550 leading-relaxed">
                        Requerimento em trâmite na esfera de autarquias públicas ou órgãos governamentais.
                      </p>
                    </div>
                  </button>

                  {/* BUTTON sub 4: Outro Tipo de Serviço Administrativo */}
                  <button
                    type="button"
                    onClick={() => {
                      setServiceSubtype('outro-servico-administrativo');
                      handleNavigateToSubtype('outro-servico-administrativo');
                    }}
                    className={`p-5 rounded-3xl text-left flex gap-4 items-start transition-all cursor-pointer border ${
                      serviceSubtype === 'outro-servico-administrativo'
                        ? 'border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 shadow-xs'
                        : 'bg-white border-gray-150 hover:border-indigo-400 hover:bg-gray-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      serviceSubtype === 'outro-servico-administrativo'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      <Briefcase size={18} />
                    </div>
                    <div className="space-y-1">
                      <h5 className={`font-extrabold text-xs uppercase ${
                        serviceSubtype === 'outro-servico-administrativo' ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                        Outro Serviço Administrativo
                      </h5>
                      <p className="text-xs text-gray-550 leading-relaxed">
                        Atividades genéricas, pareceres, notificações ou serviços customizados extrajudiciais.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

          </div>

        ) : (
          
          /* VIEW 2: SUBTYPE FORM EDITING MODE */
          <div className="space-y-8 animate-fadeIn">
            
            {/* VOLTAR A ADESÃO DA ÁRVORE BAR */}
            <div>
              <button
                type="button"
                onClick={() => navigate(getRouteTo(macroTypeSelection || 'judicial'))}
                className="inline-flex items-center gap-1.5 text-indigo-650 hover:underline font-bold text-xs"
              >
                <ArrowLeft size={14} />
                Voltar para escolha de subtipo de serviço
              </button>
            </div>

            {/* TWO COLUMN GRID FOR FORM AND WORKFLOW PREVIEWS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* LEFT FORM FIELD CONTAINER */}
              <div className="lg:col-span-2 space-y-6">
                
                <div className="p-6 bg-white border border-gray-150 rounded-3xl space-y-5">
                  <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-700 flex items-center justify-center">
                      <Scale size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase">
                        {subTypeRoute === 'peticao-inicial' && 'Formulário — Petição Inicial'}
                        {subTypeRoute === 'processo-judicial-em-andamento' && 'Formulário — Processo Judicial em Andamento'}
                        {subTypeRoute === 'requerimento-administrativo' && 'Formulário — Requerimento Administrativo'}
                        {subTypeRoute === 'outro-servico-administrativo' && 'Formulário — Outro Tipo de Serviço Administrativo'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">Preencha e verifique os dados operacionais.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {subTypeRoute === 'peticao-inicial' ? (
                      <>
                        {/* Nome completo do cliente */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Nome completo do Cliente
                          </label>
                          <input 
                            type="text" 
                            value={clientName || "IDENTIFICANDO CLIENTE..."} 
                            disabled 
                            className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 cursor-not-allowed outline-none"
                          />
                        </div>

                        {/* Nome completo da parte Adversa */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Nome completo da parte Adversa
                          </label>
                          <input 
                            type="text" 
                            value={oppositeParty} 
                            onChange={(e) => setOppositeParty(e.target.value)}
                            placeholder="Ex: Nome do Réu / Requerido" 
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          />
                        </div>

                        {/* Área do Direito */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Área do Direito
                          </label>
                          <select
                            value={areaDireito}
                            onChange={(e) => setAreaDireito(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          >
                            <option value="">Selecione a área do direito</option>
                            {[
                              "Direito Civil",
                              "Direito do Trabalho - Reclamante",
                              "Direito do Trabalho - Reclamada",
                              "Direito Previdenciário -  INSS - RGPS",
                              "Direito Previdenciário - RPPS - Outros Regimes",
                              "Direito Administrativo",
                              "Direito Tributário",
                              "Direito Ambiental",
                              "Direito Bancário",
                              "Direito do Consumidor"
                            ].map((area) => (
                              <option key={area} value={area}>{area}</option>
                            ))}
                            {customAreas.map((area) => (
                              <option key={area} value={area}>{area}</option>
                            ))}
                          </select>

                          {!showAddAreaInput ? (
                            <button
                              type="button"
                              onClick={() => setShowAddAreaInput(true)}
                              className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-all outline-none"
                            >
                              + ADD nova área
                            </button>
                          ) : (
                            <div className="mt-2 flex flex-col gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-fadeIn text-xs shadow-sm">
                              <p className="font-bold text-gray-800">Cadastrar Nova Área do Direito</p>
                              <input
                                type="text"
                                placeholder="Nome da nova área"
                                value={newAreaInput}
                                onChange={(e) => setNewAreaInput(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-white outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                              />

                              {/* Balloon checkboxes for fee selection */}
                              <div className="bg-white border border-gray-150 p-3 rounded-xl space-y-2">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono">
                                  Tipos de Honorários Possíveis de Cobrar
                                </span>
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={customAllowedFeesInput.includes("fixo")}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCustomAllowedFeesInput(prev => [...prev, "fixo"]);
                                        } else {
                                          setCustomAllowedFeesInput(prev => prev.filter(f => f !== "fixo"));
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Honorários Fixos
                                  </label>
                                  <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={customAllowedFeesInput.includes("exito_simples")}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCustomAllowedFeesInput(prev => [...prev, "exito_simples"]);
                                        } else {
                                          setCustomAllowedFeesInput(prev => prev.filter(f => f !== "exito_simples"));
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Honorários de Êxito Simples
                                  </label>
                                  <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={customAllowedFeesInput.includes("misto")}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCustomAllowedFeesInput(prev => [...prev, "misto"]);
                                        } else {
                                          setCustomAllowedFeesInput(prev => prev.filter(f => f !== "misto"));
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Honorários Mistos (Fixo + Êxito)
                                  </label>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newAreaInput.trim()) {
                                      const added = newAreaInput.trim();
                                      setCustomAreas(prev => [...prev, added]);
                                      setAreaDireito(added);
                                      setCustomAreaFeesMap(prev => ({
                                        ...prev,
                                        [added]: customAllowedFeesInput.length > 0 ? customAllowedFeesInput : ["fixo", "exito_simples", "misto"]
                                      }));
                                      setNewAreaInput('');
                                      setCustomAllowedFeesInput(["fixo", "exito_simples", "misto"]);
                                      setShowAddAreaInput(false);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                                >
                                  Adicionar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewAreaInput('');
                                    setCustomAllowedFeesInput(["fixo", "exito_simples", "misto"]);
                                    setShowAddAreaInput(false);
                                  }}
                                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-all"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Assunto */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Assunto
                          </label>
                          <input 
                            type="text" 
                            value={assunto} 
                            onChange={(e) => setAssunto(e.target.value)}
                            placeholder="Ex: Empréstimo consignado indevido d/c juros abusivos" 
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          />
                        </div>

                        {/* Deseja adicionar sub-área? */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Deseja adicionar sub-área?
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="temSubArea" 
                                value="sim" 
                                checked={temSubArea === 'sim'}
                                onChange={() => setTemSubArea('sim')}
                                className="accent-indigo-600"
                              />
                              Sim
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="temSubArea" 
                                value="nao" 
                                checked={temSubArea === 'nao'}
                                onChange={() => {
                                  setTemSubArea('nao');
                                  setSubArea('');
                                }}
                                className="accent-indigo-600"
                              />
                              Não
                            </label>
                          </div>
                        </div>

                        {/* Se sim, Qual será a Sub-área? */}
                        {temSubArea === 'sim' && (
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                              Qual será a Sub-área?
                            </label>
                            <input 
                              type="text" 
                              value={subArea} 
                              onChange={(e) => setSubArea(e.target.value)}
                              placeholder="Ex: Contratos, Consumidor, Danos Morais" 
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                            />
                          </div>
                        )}

                        {/* Vara */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Vara
                          </label>
                          <input 
                            type="text" 
                            value={vara} 
                            onChange={(e) => setVara(e.target.value)}
                            placeholder="Ex: 1ª Vara Cível, Juizado Especial Cível" 
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          />
                        </div>

                        {/* Comarca */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Comarca
                          </label>
                          <input 
                            type="text" 
                            value={comarca} 
                            onChange={(e) => setComarca(e.target.value)}
                            placeholder="Ex: Viçosa/MG" 
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* CLIENT NAME FIELD (preenchido automaticamente e bloqueado) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                            Nome Completo do Cliente *
                          </label>
                          <input 
                            type="text" 
                            value={clientName || "IDENTIFICANDO CLIENTE..."} 
                            disabled 
                            className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 cursor-not-allowed"
                          />
                        </div>

                        {/* ASSUNTO (Substitui o antigo título operacional do caso, não temos mais título operacional) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block mt-3">
                            Assunto *
                          </label>
                          <input 
                            type="text" 
                            value={assunto} 
                            onChange={(e) => setAssunto(e.target.value)}
                            placeholder="Ex: Empréstimo consignado indevido d/c juros abusivos" 
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          />
                        </div>

                        {/* CONTEXT-BASED EXTRA FIELDS */}
                        
                        {/* TYPE BLOCK */}
                        {subTypeRoute === 'requerimento-administrativo' && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block mt-3">
                              Tipo de Serviço
                            </label>
                            <input 
                              type="text" 
                              value="Requerimento Administrativo" 
                              disabled 
                              className="w-full px-4 py-3 bg-gray-100 border border-gray-150 rounded-xl text-xs font-black text-gray-500 cursor-not-allowed"
                            />
                          </div>
                        )}

                        {/* SERVICE SUBTYPE TEXT INPUT FOR OTHER TYPE */}
                        {subTypeRoute === 'outro-servico-administrativo' && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block mt-3">
                              Tipo de Serviço Administrativo *
                            </label>
                            <input 
                              type="text" 
                              value={serviceSubtype} 
                              onChange={(e) => setServiceSubtype(e.target.value)}
                              placeholder="Ex: Confecção de Notificação Extrajudicial" 
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                            />
                          </div>
                        )}

                        {/* PARTE ADVERSA CONTROLS */}
                        {(subTypeRoute === 'requerimento-administrativo' || subTypeRoute === 'outro-servico-administrativo') ? (
                          <div className="space-y-4 pt-2">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                checked={hasOppositeParty} 
                                onChange={(e) => {
                                  setHasOppositeParty(e.target.checked);
                                  if (!e.target.checked) setOppositeParty('');
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="text-xs font-bold text-gray-700">Possui parte adversa neste fluxo?</span>
                            </label>

                            {hasOppositeParty && (
                              <div className="space-y-1.5 animate-fadeIn">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                                  Nome da Parte Adversa *
                                </label>
                                <input 
                                  type="text" 
                                  value={oppositeParty} 
                                  onChange={(e) => setOppositeParty(e.target.value)}
                                  placeholder="Ex: Banco X S/A" 
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          // Judicial always has oppositeParty
                          <div className="space-y-1.5 pt-1">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block mt-3">
                              Nome da Parte Adversa *
                            </label>
                            <input 
                              type="text" 
                              value={oppositeParty} 
                              onChange={(e) => setOppositeParty(e.target.value)}
                              placeholder="Ex: Banco X S/A ou Seguradora Y" 
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                            />
                          </div>
                        )}

                        {/* JUDICIAL SPECIFIC DETAILS */}
                        {subTypeRoute === 'processo-judicial-em-andamento' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            
                            {/* VARA */}
                            <div className="space-y-1.5 flex-1">
                              <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                                Vara
                              </label>
                              <input 
                                type="text" 
                                value={vara} 
                                onChange={(e) => setVara(e.target.value)}
                                placeholder="Ex: 2ª Vara Cível / Juizado" 
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                              />
                            </div>

                            {/* COMARCA */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                                Comarca
                              </label>
                              <input 
                                type="text" 
                                value={comarca} 
                                onChange={(e) => setComarca(e.target.value)}
                                placeholder="Ex: Viçosa/MG" 
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                              />
                            </div>

                          </div>
                        )}

                        {/* PROCESS NUMBER CNJ WITH MASK */}
                        {subTypeRoute === 'processo-judicial-em-andamento' && (
                          <div className="space-y-1.5 pt-2">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wide block">
                              Número do Processo CNJ *
                            </label>
                            <input 
                              type="text" 
                              value={processNumber} 
                              onChange={(e) => {
                                const raw = e.target.value;
                                setProcessNumber(formatCNJ(raw));
                              }}
                              placeholder="Ex: 0000000-00.0000.0.00.0000" 
                              maxLength={25}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-mono font-semibold text-gray-800 transition-all outline-none"
                            />
                            <p className="text-xs text-gray-400 font-medium">Formato automático: NNNNNNN-DD.AAAA.J.TR.OOOO</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT LIVE FORMULA PREVIEW PANEL */}
              <div className="space-y-6">
                
                {/* DETAILED TASK DETAIL PANEL (mimicking Todoist task detail layout) */}
                <div className="border border-rose-100 rounded-3xl bg-white shadow-md overflow-hidden animate-fadeIn">
                  {/* Header */}
                  <div className="bg-rose-50/50 px-6 py-4 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle className="text-[#e44332]" size={18} />
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                          Integração & Detalhes da Tarefa no Todoist
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium">
                          Gerenciamento direto dos dados, subtarefas e comentários sincronizados em tempo real.
                        </p>
                      </div>
                    </div>
                    
                    {/* Action Links */}
                    {todoistTaskId && todoistTaskUrl && !isInvalidTodoistTaskIdentity(todoistTaskId, todoistTaskUrl) && (
                      <a
                        href={todoistTaskUrl}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-[#e44332]/20 text-[#e44332] font-extrabold rounded-lg text-xs transition-all cursor-pointer shadow-3xs"
                      >
                        <ExternalLink size={12} />
                        <span>Abrir no Todoist</span>
                      </a>
                    )}
                  </div>

                  {/* Two Column Layout Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-gray-100">
                    
                    {/* LEFT COLUMN: Main Task Data (Actions, Status, Title, Description, Subtasks, Comments) */}
                    <div className="xl:col-span-8 p-6 space-y-6">
                      
                      {/* 1. Main Action Button */}
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={todoistAutomationStatus === "gerando" || !todoistProjectId}
                          onClick={handleCreateTodoistTask}
                          className="w-full inline-flex items-center justify-center gap-2 bg-[#e44332] hover:bg-[#c53222] text-white font-extrabold px-6 py-4 rounded-2xl transition-all text-xs cursor-pointer shadow-md disabled:opacity-50 select-none transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          {todoistAutomationStatus === 'gerando' ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Sincronizando com Todoist...</span>
                            </>
                          ) : (
                            <>
                              <CheckSquare size={14} />
                              <span>
                                {todoistAutomationStatus === 'criado' ? "Criar outra tarefa no Todoist" :
                                 todoistAutomationStatus === 'falha' ? "Tentar criar tarefa novamente" :
                                 "Criar Tarefa no Todoist"}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 2. Status de Execução da Automação */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono">
                          Status de Execução da Automação
                        </span>
                        <div className="mt-1">
                          {todoistAutomationStatus === 'criado' && todoistTaskId && todoistInitialCommentStatus !== 'falha' ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center gap-2.5 font-bold animate-fadeIn font-sans">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                              <div className="min-w-0">
                                <p>Tarefa vinculada com sucesso no Todoist</p>
                                <p className="text-[9px] font-mono text-emerald-600 font-normal mt-0.5">ID: {todoistTaskId}</p>
                              </div>
                            </div>
                          ) : todoistAutomationStatus === 'criado' && todoistTaskId && todoistInitialCommentStatus === 'falha' ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex flex-col gap-1.5 animate-fadeIn font-semibold font-sans">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                <span className="font-bold">Tarefa criada com sucesso, mas o comentário obrigatório automático falhou.</span>
                              </div>
                              <p className="text-[9px] font-mono text-amber-600 font-normal">ID: {todoistTaskId}</p>
                              {todoistTaskLogFalha && (
                                <div className="w-full bg-amber-100/40 p-2.5 rounded-xl border border-amber-200 text-amber-900 font-mono text-[10px] max-h-24 overflow-y-auto">
                                  {todoistTaskLogFalha}
                                </div>
                              )}
                            </div>
                          ) : todoistAutomationStatus === 'gerando' ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-center gap-2.5 font-bold animate-fadeIn font-sans">
                              <span className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                              <span>Criando pauta de tarefa real via REST API...</span>
                            </div>
                          ) : todoistAutomationStatus === 'falha' ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-950 text-xs flex flex-col gap-2 animate-fadeIn font-semibold font-sans">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                <span className="font-bold">Falha ao provisionar tarefa</span>
                              </div>
                              {todoistTaskLogFalha && (
                                <div className="w-full bg-red-100/40 p-2.5 rounded-xl border border-red-200 text-red-900 font-mono text-[10px] max-h-24 overflow-y-auto">
                                  {todoistTaskLogFalha}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-stone-50 border border-gray-200 rounded-2xl text-gray-500 text-xs flex items-center gap-2.5 font-semibold font-sans">
                              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                              <span>Aguardando comando de envio para pauta</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <hr className="border-gray-100" />

                      {/* 3. Task Title / Formula */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono">
                          Título da Tarefa (Fórmula)
                        </label>
                        <div className="bg-stone-50 border border-gray-150 rounded-2xl p-4 relative group">
                          <p className="text-xs font-mono leading-relaxed text-stone-800 select-all selection:bg-rose-100 break-words pr-12">
                            {getTodoistFormula()}
                          </p>
                          <button
                            type="button"
                            onClick={handleCopyFormula}
                            className={`absolute right-3 top-3 p-2 rounded-xl transition-all cursor-pointer border ${
                              copied 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                : 'bg-white hover:bg-rose-50 border-gray-150 text-[#e44332]'
                            }`}
                            title="Copiar Fórmula"
                          >
                            {copied ? <Check size={14} className="stroke-[3px]" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* 2. Description */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono">
                          Descrição da Tarefa
                        </label>
                        <textarea
                          rows={3}
                          value={todoistDescription}
                          onChange={(e) => setTodoistDescription(e.target.value)}
                          placeholder="Adicione uma descrição detalhada para a tarefa do caso..."
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-rose-500 focus:bg-white focus:ring-1 focus:ring-rose-500 rounded-2xl text-xs font-semibold text-gray-800 transition-all outline-none resize-none"
                        />
                      </div>

                      {/* 3. Subtasks */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono flex items-center gap-1.5">
                            <CheckSquare size={13} className="text-gray-400" />
                            Subtarefas ({todoistSubtasks.length})
                          </label>
                          
                          {!showAddSubtaskInput && (
                            <button
                              type="button"
                              onClick={() => setShowAddSubtaskInput(true)}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#e44332] hover:text-[#c53222] transition-colors cursor-pointer uppercase font-mono"
                            >
                              <Plus size={11} className="stroke-[2.5px]" />
                              <span>Adicionar subtarefa</span>
                            </button>
                          )}
                        </div>

                        {/* List of subtasks */}
                        {todoistSubtasks.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhuma subtarefa criada.</p>
                        ) : (
                          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                            {todoistSubtasks.map((sub) => (
                              <div 
                                key={sub.id} 
                                className="flex items-center justify-between gap-3 p-2.5 bg-gray-50/55 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubtask(sub.id)}
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                                      sub.completed 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : 'border-gray-300 hover:border-[#e44332]'
                                    }`}
                                  >
                                    {sub.completed && <Check size={10} className="stroke-[4px]" />}
                                  </button>
                                  <span className={`text-xs font-semibold truncate ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                    {sub.title}
                                  </span>
                                  {sub.taskId && (
                                    <span className="text-[8px] bg-red-100/50 text-[#e44332] px-1.5 py-0.5 rounded-full font-mono font-bold">
                                      Sincronizado
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSubtask(sub.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                  title="Excluir subtarefa"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add subtask input panel */}
                        {showAddSubtaskInput && (
                          <div className="bg-gray-50 p-3.5 border border-gray-150 rounded-2xl space-y-3 animate-fadeIn">
                            <input
                              type="text"
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder="O que precisa ser feito?"
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-xl text-xs font-semibold text-gray-800 transition-all"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddSubtaskClick();
                              }}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewSubtaskTitle('');
                                  setShowAddSubtaskInput(false);
                                }}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-55 transition-all cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isAddingSubtask || !newSubtaskTitle.trim()}
                                onClick={handleAddSubtaskClick}
                                className="px-3 py-1.5 bg-[#e44332] text-white rounded-lg text-xs font-bold hover:bg-[#c53222] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isAddingSubtask && <Loader2 size={12} className="animate-spin" />}
                                <span>Adicionar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Comments */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-gray-400" />
                            Comentários ({todoistComments.length})
                          </label>
                          
                          {!showAddCommentInput && (
                            <button
                              type="button"
                              onClick={() => setShowAddCommentInput(true)}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#e44332] hover:text-[#c53222] transition-colors cursor-pointer uppercase font-mono"
                            >
                              <Plus size={11} className="stroke-[2.5px]" />
                              <span>Adicionar comentário</span>
                            </button>
                          )}
                        </div>

                        {/* List of comments */}
                        {todoistComments.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhum comentário adicionado.</p>
                        ) : (
                          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                            {todoistComments.map((com) => (
                              <div 
                                key={com.id} 
                                className="p-3 bg-stone-50 border border-stone-100 rounded-2xl space-y-1.5 animate-fadeIn"
                              >
                                <div className="flex justify-between items-center text-[10px] font-mono text-gray-450">
                                  <span className="font-bold text-gray-600">Comentário</span>
                                  <span>{new Date(com.createdAt).toLocaleString("pt-BR")}</span>
                                </div>
                                <p className="text-xs font-semibold text-gray-700 leading-relaxed whitespace-pre-line break-words">
                                  {com.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add comment input panel */}
                        {showAddCommentInput && (
                          <div className="bg-gray-50 p-3.5 border border-gray-150 rounded-2xl space-y-3 animate-fadeIn">
                            <textarea
                              rows={2}
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              placeholder="Escreva um comentário..."
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-xl text-xs font-semibold text-gray-800 transition-all resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewCommentText('');
                                  setShowAddCommentInput(false);
                                }}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-55 transition-all cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isAddingComment || !newCommentText.trim()}
                                onClick={handleAddCommentClick}
                                className="px-3 py-1.5 bg-[#e44332] text-white rounded-lg text-xs font-bold hover:bg-[#c53222] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isAddingComment && <Loader2 size={12} className="animate-spin" />}
                                <span>Comentar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* RIGHT COLUMN: Sidebar Metadata & Controls */}
                    <div className="xl:col-span-4 p-6 bg-stone-50/45 space-y-5">
                      
                      {/* 1. Todoist Project Selector */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                            <Folder size={11} className="text-[#e44332]" />
                            Projeto de Destino *
                          </label>
                          <button
                            type="button"
                            disabled={syncingProjects}
                            onClick={handleSyncTodoistProjects}
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-[#e44332] hover:text-[#c53222] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw size={9} className={`shrink-0 ${syncingProjects ? 'animate-spin' : ''}`} />
                            Sincronizar
                          </button>
                        </div>

                        {syncingProjects ? (
                          <div className="p-3 bg-white border border-gray-150 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 font-mono">
                            <Loader2 size={12} className="animate-spin text-[#e44332]" />
                            <span>Sincronizando via API...</span>
                          </div>
                        ) : todoistProjectId ? (
                          <div className="p-3 bg-white border border-rose-100 rounded-2xl flex items-center justify-between gap-2.5 text-xs shadow-3xs animate-fadeIn">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-[#e44332] shrink-0">
                                <Folder size={13} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-stone-950 truncate leading-tight">{todoistProjectName}</p>
                                <p className="font-mono text-[8px] text-[#e44332] mt-0.5">Ativo • ID: {todoistProjectId}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setTodoistProjectId('');
                                setTodoistProjectName('');
                              }}
                              className="p-1 hover:bg-rose-50 rounded text-gray-400 hover:text-[#e44332] transition-colors cursor-pointer"
                              title="Mudar Projeto"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="flex items-center bg-white border border-gray-200 focus-within:border-[#e44332] rounded-2xl px-3 transition-all shadow-3xs">
                              <Search size={14} className="text-gray-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="Buscar projeto do Todoist..."
                                value={projectSearchQuery}
                                onChange={(e) => {
                                  setProjectSearchQuery(e.target.value);
                                  setShowProjectDropdown(true);
                                }}
                                onFocus={() => setShowProjectDropdown(true)}
                                className="w-full pl-2 pr-1 py-2.5 bg-transparent text-xs font-semibold text-gray-700 outline-none placeholder-gray-400"
                              />
                              {projectSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setProjectSearchQuery('')}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {showProjectDropdown && (
                              <div className="absolute top-11 left-0 right-0 max-h-48 overflow-y-auto bg-white border border-gray-150 rounded-2xl shadow-lg z-20 p-1 divide-y divide-gray-50">
                                {syncedProjectsList.filter(p => 
                                  p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                                  p.id.toLowerCase().includes(projectSearchQuery.toLowerCase())
                                ).length > 0 ? (
                                  syncedProjectsList
                                    .filter(p => 
                                      p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                                      p.id.toLowerCase().includes(projectSearchQuery.toLowerCase())
                                    )
                                    .map((proj) => (
                                      <button
                                        type="button"
                                        key={proj.id}
                                        onClick={() => {
                                          setTodoistProjectId(proj.id);
                                          setTodoistProjectName(proj.name);
                                          setProjectSearchQuery('');
                                          setShowProjectDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-rose-50/50 rounded-xl text-xs font-semibold text-gray-700 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                                      >
                                        <span className="truncate">{proj.name}</span>
                                        <span className="text-[9px] text-gray-400 font-mono font-normal shrink-0">ID: {proj.id}</span>
                                      </button>
                                    ))
                                ) : (
                                  <div className="p-3 text-center text-xs text-gray-400 font-mono">
                                    Nenhum projeto encontrado.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {!todoistProjectId && (
                          <p className="text-[9px] text-[#e44332] font-black leading-tight font-mono uppercase tracking-wide flex items-center gap-1 animate-pulse">
                            ⚠️ Escolha o Projeto de Destino para habilitar a criação.
                          </p>
                        )}
                      </div>

                      {/* 2. Assignee */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                          <User size={11} className="text-gray-400" />
                          ID do Responsável
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 23184972"
                          value={todoistAssignee}
                          onChange={(e) => setTodoistAssignee(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-2xl transition-all shadow-3xs placeholder-gray-400"
                        />
                      </div>

                      {/* 3. Due Date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                          <Calendar size={11} className="text-gray-400" />
                          Prazo / Data
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: amanhã, 15/06/2026, monday"
                          value={todoistDueDate}
                          onChange={(e) => setTodoistDueDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-2xl transition-all shadow-3xs placeholder-gray-400"
                        />
                      </div>

                      {/* 4. Priority */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                          <Flag size={11} className="text-gray-400" />
                          Prioridade
                        </label>
                        <div className="relative">
                          <select
                            value={todoistPriority}
                            onChange={(e) => setTodoistPriority(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-2xl transition-all appearance-none pr-10 shadow-3xs"
                          >
                            <option value={1}>⚪ Prioridade 1 (Normal)</option>
                            <option value={2}>🔵 Prioridade 2</option>
                            <option value={3}>🟡 Prioridade 3</option>
                            <option value={4}>🔴 Prioridade 4 (Urgente)</option>
                          </select>
                          <ChevronDown size={14} className="text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
                        </div>
                      </div>

                      {/* 5. Labels */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                          <Tag size={11} className="text-gray-400" />
                          Etiquetas (separadas por vírgula)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: urgente, civil"
                          value={todoistLabels}
                          onChange={(e) => setTodoistLabels(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-2xl transition-all shadow-3xs placeholder-gray-400"
                        />
                      </div>

                      {/* 6. Reminders */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                          <Bell size={11} className="text-gray-400" />
                          Lembretes (reminders)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 30m before, 10:00"
                          value={todoistReminders}
                          onChange={(e) => setTodoistReminders(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-2xl transition-all shadow-3xs placeholder-gray-400"
                        />
                      </div>

                      {/* 7. Location */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block font-mono flex items-center gap-1">
                          <MapPin size={11} className="text-gray-400" />
                          Localização (location)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Fórum de Viçosa"
                          value={todoistLocation}
                          onChange={(e) => setTodoistLocation(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 focus:border-[#e44332] outline-none rounded-2xl transition-all shadow-3xs placeholder-gray-400"
                        />
                      </div>

                    </div>

                  </div>

                  {/* BOTTOM BAR: Logs da Integração Todoist */}
                  <div className="bg-stone-50 p-6 border-t border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="text-gray-400" size={15} />
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider font-mono">
                          Logs Técnicos da Integração Todoist
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTodoistLogs(!showTodoistLogs)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold rounded-lg text-[10px] uppercase font-mono transition-colors cursor-pointer shadow-3xs"
                      >
                        {showTodoistLogs ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{showTodoistLogs ? "Ocultar LOGS" : "Ver LOGS"}</span>
                      </button>
                    </div>

                    {showTodoistLogs && (
                      <div className="animate-fadeIn">
                        {todoistLogs.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">
                            Nenhum log registrado ainda. Clique em "Criar tarefa no Todoist" para iniciar a automação.
                          </p>
                        ) : (
                          <div className="max-h-60 overflow-y-auto border border-gray-150 rounded-2xl bg-white p-4 space-y-3 shadow-inner">
                            {todoistLogs.map((log, index) => (
                              <div key={`${log.timestamp}-${index}`} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={
                                      log.level === "success" ? "w-2 h-2 rounded-full bg-emerald-500 shrink-0" :
                                      log.level === "error" ? "w-2 h-2 rounded-full bg-red-500 shrink-0" :
                                      log.level === "warning" ? "w-2 h-2 rounded-full bg-amber-500 shrink-0" :
                                      "w-2 h-2 rounded-full bg-blue-500 shrink-0"
                                    } />
                                    <span className="font-mono font-black text-gray-700 truncate text-[10px]">
                                      {log.step}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-gray-450 font-mono shrink-0">
                                    {new Date(log.timestamp).toLocaleString("pt-BR")}
                                  </span>
                                </div>

                                <p className="mt-1 text-gray-700 font-semibold leading-relaxed pl-4">
                                  {log.message}
                                </p>

                                {log.details && Object.keys(log.details).length > 0 && (
                                  <pre className="mt-2 ml-4 bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-[9px] text-gray-500 overflow-x-auto font-mono">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {todoistProjectsSyncError && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2 animate-fadeIn">
                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-black uppercase tracking-wide text-[10px]">
                            Falha na sincronização de projetos Todoist
                          </p>
                          <p className="font-semibold leading-relaxed">
                            {todoistProjectsSyncError}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* BOTTOM STEP NAV ACTIONS BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          
          {/* VOLTAR ACTION BUTTON */}
          <button
            type="button"
            onClick={() => {
              if (currentStep === 'form') {
                navigate(getRouteTo(macroTypeSelection || 'judicial'));
              } else if (currentStep === 'judicial' || currentStep === 'extrajudicial') {
                navigate(getRouteTo('natureza'));
              } else {
                navigate(safeCaseId ? `/boss-giffoni-clientes/fluxo-producao/${safeCaseId}/dados-caso` : '/boss-giffoni-clientes/fluxo-producao/cadastro');
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            {currentStep === 'form' ? 'Voltar para Subtipos' : (currentStep === 'judicial' || currentStep === 'extrajudicial') ? 'Voltar para Etapa 1' : 'Voltar'}
          </button>

          {/* RIGHT CTA SAVE ACTIONS */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            
            {/* SAIR SEM SALVAR BAR */}
            <button
              type="button"
              onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 px-6 py-3 rounded-xl font-bold transition-all text-xs hover:bg-gray-50 cursor-pointer bg-white"
            >
              <Save size={14} />
              Sair
            </button>

            {/* ACTION TRIGGERS ONLY VISIBLE IF EDITING A SPECIFIC SUBTYPE FORM */}
            {subTypeRoute ? (
              <>
                <button
                  type="button"
                  disabled={loading || fetching}
                  onClick={() => handleSaveSubtypeForm(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-950 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Salvar Dados</span>
                </button>

                <button
                  type="button"
                  disabled={loading || fetching}
                  onClick={() => handleSaveSubtypeForm(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{subTypeRoute === 'peticao-inicial' ? 'Avançando para o Financeiro...' : 'Salvando...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{subTypeRoute === 'peticao-inicial' ? 'Avançar para o Financeiro 💲' : 'Próxima subetapa (Salvar e Avançar)'}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={loading || fetching}
                onClick={async () => {
                  if (currentStep === 'natureza') {
                    // Go to step 2: Serviço Judicial or Extrajudicial
                    navigate(getRouteTo(macroTypeSelection || 'judicial'));
                  } else if (currentStep === 'judicial') {
                    // Go to step 3: Cadastrando Petição Inicial no Todoist (defaulting to peticao-inicial, or current serviceSubtype if set)
                    let targetSubtype = serviceSubtype || 'peticao-inicial';
                    if (targetSubtype === 'peticao_inicial') targetSubtype = 'peticao-inicial';
                    await handleNavigateToSubtype(targetSubtype);
                  } else if (currentStep === 'extrajudicial') {
                    let targetSubtype = serviceSubtype || 'requerimento-administrativo';
                    await handleNavigateToSubtype(targetSubtype);
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Carregando...</span>
                  </>
                ) : (
                  <>
                    <span>Próxima subetapa</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            )}

          </div>
        </div>

        {/* REDISTRIBUTION WARNING AND JUSTIFICATION MODAL */}
        {isRedistributeModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-white border border-gray-150 rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scaleUp">
              
              {/* Header with Danger Warning */}
              <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-start gap-3.5 shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-red-900 tracking-wider font-sans leading-tight">
                    Alerta de Risco: Litispendência Crítica
                  </h4>
                  <p className="text-[11px] text-red-700 font-semibold mt-0.5">
                    Atenção jurídica mandatória ao redistribuir ou reiniciar o fluxo deste caso.
                  </p>
                </div>
              </div>

              {/* Scrollable Warn Content */}
              <div className="p-6 overflow-y-auto space-y-5 text-gray-700 leading-relaxed">
                
                {/* Concept definition card */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs space-y-2">
                  <span className="font-mono font-black uppercase tracking-wider text-[10px] text-stone-500">
                    O que é Litispendência? (CPC, Art. 337, §1º, §2º e §3º)
                  </span>
                  <p className="font-medium text-stone-700 font-sans leading-relaxed">
                    Ocorre litispendência quando se reproduz uma ação que já está em curso. Uma ação é idêntica à outra quando possui as <strong>mesmes partes</strong>, a <strong>mesma causa de pedir</strong> e o <strong>mesmo pedido</strong>.
                  </p>
                </div>

                {/* Practical consequences check */}
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-xs space-y-2">
                  <span className="font-mono font-black uppercase tracking-wider text-[10px] text-red-700">
                    Consequências de uma Redistribuição Acidental / Duplicidade
                  </span>
                  <ul className="list-disc pl-4 space-y-1.5 font-medium text-red-950 font-sans">
                    <li>Extinção imediata do novo processo sem resolução de mérito (CPC, Art. 485, V).</li>
                    <li>Risco elevado de condenação em multa por Litigância de Má-Fé.</li>
                    <li>Geração de custos processuais e honorários de sucumbência adicionais indevidos.</li>
                    <li>Sérias punições disciplinares perante a OAB por duplicidade de litígio.</li>
                  </ul>
                </div>

                {/* Mandatary Justification input */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-gray-500 tracking-wider block font-mono">
                    Justificativa Técnica de Redistribuição (Mínimo de 20 caracteres) *
                  </label>
                  <textarea
                    rows={4}
                    value={redistributeJustification}
                    onChange={(e) => setRedistributeJustification(e.target.value)}
                    placeholder="Descreva a fundamentação técnica e o motivo de força maior para redistribuir este processo..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-500 rounded-2xl text-xs font-semibold text-gray-800 transition-all outline-none resize-none placeholder-gray-400 shadow-3xs"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-gray-400 font-semibold">Min. 20 caracteres necessários</span>
                    <span className={`font-black uppercase tracking-wide ${redistributeJustification.trim().length >= 20 ? 'text-emerald-600' : 'text-red-500'}`}>
                      Contador: {redistributeJustification.trim().length} / 20
                    </span>
                  </div>
                </div>

              </div>

              {/* Footer CTA Buttons */}
              <div className="bg-stone-50 border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-end items-center gap-3 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setIsRedistributeModalOpen(false);
                    setRedistributeJustification("");
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-100 text-gray-600 px-5 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
                >
                  Cancelar e Manter
                </button>
                <button
                  type="button"
                  disabled={loading || redistributeJustification.trim().length < 20}
                  onClick={handleRedistributeCase}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold px-6 py-2.5 rounded-xl transition-all text-xs cursor-pointer shadow-md disabled:opacity-50"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>Confirmar e Reiniciar Fluxo 🔄</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
