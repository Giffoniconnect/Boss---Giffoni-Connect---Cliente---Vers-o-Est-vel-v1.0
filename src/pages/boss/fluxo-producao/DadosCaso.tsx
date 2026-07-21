import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Info, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Activity,
  User,
  AlertTriangle,
  RefreshCw,
  ClipboardList,
  Check,
  X,
  HelpCircle,
  Sparkles,
  BookOpen,
  Settings,
  ExternalLink,
  Copy,
  Terminal
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';
import { useAuth } from '../../../contexts/AuthContext';
import { buildPrimeiroAtendimentoPlaceholders, buildPrimeiroAtendimentoPjPlaceholders } from '../../../lib/documents/placeholderBuilders';

interface MiniRichEditorProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  isMissing: boolean;
}

// Mini Rich Text Editor in compliance with legal writing standards
function MiniRichEditor({ id, value, onChange, placeholder, isMissing }: MiniRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const applyCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div id={`editor-container-${id}`} className={`border rounded-2xl overflow-hidden shadow-xs bg-white transition-all duration-200 ${
      isMissing ? 'border-red-300 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500' : 'border-gray-200 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900'
    }`}>
      {/* Editorial Toolbar Buttons */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-150 select-none">
        <button
          type="button"
          onClick={() => applyCommand('bold')}
          className="px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 rounded-lg transition-all font-serif font-black flex items-center justify-center min-w-[28px] cursor-pointer"
          title="Negrito"
        >
          N
        </button>
        <button
          type="button"
          onClick={() => applyCommand('backColor', 'yellow')}
          className="px-2.5 py-1.5 text-[11px] text-gray-800 hover:bg-yellow-105 border border-yellow-250 rounded-lg transition-all bg-yellow-50 flex items-center gap-1.5 cursor-pointer font-bold animate-pulse"
          title="Marca-texto amarelo"
        >
          <span className="w-3.5 h-3.5 bg-yellow-400 border border-yellow-500 rounded-md shrink-0 block" />
          <span>Marca-texto</span>
        </button>
        <button
          type="button"
          onClick={() => {
            applyCommand('removeFormat');
            try {
              applyCommand('backColor', 'transparent');
            } catch (e) {}
          }}
          className="px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 border border-red-105 hover:border-red-200 rounded-lg transition-all font-bold ml-auto cursor-pointer"
          title="Limpar marcação"
        >
          Limpar formatação
        </button>
      </div>

      {/* Editor Canvas Styled with Classical Times New Roman and Left Margin Recess */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={handlePaste}
        className="outline-none min-h-[220px] p-6 text-gray-900 bg-white"
        style={{
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '12pt',
          lineHeight: '1.5',
          textAlign: 'justify',
          paddingLeft: '1.5rem',
        }}
        {...{ placeholder }}
      />
    </div>
  );
}

const statusMapping: Record<string, string> = {
  'Rascunho': 'Cadastro interno em andamento.',
  'Entrevista pendente': 'Aguardando complementação de informações.',
  'Em produção': 'Seu caso está em análise e preparação.',
  'Com pendência': 'Há pendências necessárias para avanço do caso.',
  'Em estruturação': 'Seu caso está em estruturação técnica.',
  'Aguardando revisão': 'Seu caso está em revisão interna.',
  'Em revisão': 'Seu caso está em revisão jurídica.',
  'Aprovado para protocolo': 'Seu caso está pronto para o próximo protocolo.',
  'Aguardando protocolo': 'Seu caso aguarda protocolo.',
  'Protocolado': 'Seu caso foi protocolado.',
  'Em controladoria': 'Seu caso está em acompanhamento processual.',
  'Arquivado': 'Atendimento encerrado/arquivado.'
};

const statusConcepts: Record<string, string> = {
  'Rascunho': 'Cadastro inicial e estruturação fática em andamento interno.',
  'Entrevista pendente': 'Dados fáticos/5W2H ainda incompletos. Aguardando entrevista.',
  'Em produção': 'A equipe de assessores está trabalhando ativamente no caso.',
  'Com pendência': 'Necessário intervir para sanar incongruência ou falta de dados.',
  'Em estruturação': 'Análise técnica de viabilidade jurídica do caso.',
  'Aguardando revisão': 'O rascunho da peça/projeto de requerimento foi finalizado.',
  'Em revisão': 'Os defensores seniores analisam a viabilidade jurídica fina.',
  'Aprovado para protocolo': 'Tudo validado! O caso está apto a ser protocolado.',
  'Aguardando protocolo': 'Enviado para o rito final de protocolo processual.',
  'Protocolado': 'Ação distribuída ou requerimento protocolado oficialmente.',
  'Em controladoria': 'O caso está sob monitoramento ativo de prazos e trâmite.',
  'Arquivado': 'Trâmite encerrado definitivamente no escritório.'
};

interface Checklist5W2HState {
  oQue: boolean;
  oQueObs: string;
  quem: boolean;
  quemObs: string;
  onde: boolean;
  ondeObs: string;
  quando: boolean;
  quandoObs: string;
  como: boolean;
  comoObs: string;
  porque: boolean;
  porqueObs: string;
  comoResolver: boolean;
  comoResolverObs: string;
}

const GoogleDriveIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 87.3 78"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path fill="#00a354" d="M18.9 50l-14 24.2 0 3.8h4.2l53.9-1.2-11.4-26.8z" />
    <path fill="#3b7cf6" d="M14 0l-14 24.2L11.1 50h41.7l14.4-25.8z" />
    <path fill="#fbb000" d="M72.6 50L53.7 78H83l4.3-11.2L72.6 50z" />
  </svg>
);

const translateErrorCode = (code: string | null | undefined, rawMessage: string | null | undefined): string => {
  const normCode = (code || '').toUpperCase();
  const normMsg = (rawMessage || '').toUpperCase();

  if (normCode === 'GOOGLE_DOCS_CREDENTIALS_MISSING' || normMsg.includes('GOOGLE_DOCS_CREDENTIALS_MISSING')) {
    return 'A autenticação com Google Docs e Google Drive não está configurada.';
  }
  if (normCode === 'GOOGLE_DOCS_AUTH_FAILED' || normMsg.includes('GOOGLE_DOCS_AUTH_FAILED')) {
    return 'A autenticação da conta Google falhou ou expirou.';
  }
  if (normCode === 'DOCUMENT_COPY_FAILED' || normMsg.includes('DOCUMENT_COPY_FAILED')) {
    return 'Não foi possível copiar o modelo oficial para a pasta do cliente.';
  }
  if (normCode === 'DESTINATION_FOLDER_ID_MISSING' || normMsg.includes('DESTINATION_FOLDER_ID_MISSING')) {
    return 'A pasta de destino do cliente ainda não está vinculada ao cadastro.';
  }
  if (normCode === 'DESTINATION_FOLDER_ACCESS_DENIED' || normMsg.includes('DESTINATION_FOLDER_ACCESS_DENIED')) {
    return 'A conta Google configurada não possui permissão para gravar documentos nesta pasta.';
  }
  if (normCode === 'TEMPLATE_ACCESS_DENIED' || normMsg.includes('TEMPLATE_ACCESS_DENIED')) {
    return 'A conta Google configurada não possui acesso ao modelo oficial do 1º Atendimento.';
  }
  if (normCode === 'TEMPLATE_ID_MISSING' || normMsg.includes('TEMPLATE_ID_MISSING')) {
    return 'O modelo oficial do 1º Atendimento não está configurado.';
  }
  if (normCode === 'PLACEHOLDER_REPLACEMENT_FAILED' || normMsg.includes('PLACEHOLDER_REPLACEMENT_FAILED')) {
    return 'O modelo foi copiado, mas ocorreu falha ao inserir os dados do cliente e do caso.';
  }
  if (normCode === 'PORTAL_RESULT_SAVE_FAILED' || normMsg.includes('PORTAL_RESULT_SAVE_FAILED')) {
    return 'O documento foi criado no Google Drive, mas houve falha ao registrar o link no Portal BOSS.';
  }

  // Fallback map checks based on some substrings in rawMessage:
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('credential') || msg.includes('autentica') || msg.includes('token') || msg.includes('permiss')) {
    if (msg.includes('pasta') || msg.includes('folder') || msg.includes('grav')) {
      return 'A conta Google configurada não possui permissão para gravar documentos nesta pasta.';
    }
    if (msg.includes('modelo') || msg.includes('template')) {
      return 'A conta Google configurada não possui acesso ao modelo oficial do 1º Atendimento.';
    }
    return 'A autenticação da conta Google falhou ou expirou.';
  }
  if (msg.includes('folder id') || msg.includes('pasta de destino') || msg.includes('gdrivefolderid')) {
    return 'A pasta de destino do cliente ainda não está vinculada ao cadastro.';
  }
  if (msg.includes('template id') || msg.includes('modelo oficial')) {
    return 'O modelo oficial do 1º Atendimento não está configurado.';
  }
  if (msg.includes('copy') || msg.includes('copiar')) {
    return 'Não foi possível copiar o modelo oficial para a pasta do cliente.';
  }
  if (msg.includes('placeholder') || msg.includes('substitu')) {
    return 'O modelo foi copiado, mas ocorreu falha ao inserir os dados do cliente e do caso.';
  }

  return rawMessage || 'Ocorreu um erro desconhecido no motor de geração.';
};

export default function DadosCaso() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { googleAccessToken } = useAuth();
  const generationInFlightRef = useRef(false);

  // Screen states
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab State (Solution 2)
  const [selectedTab, setSelectedTab] = useState<'padrao' | 'estruturada'>('padrao');

  // Loaded assets
  const [client, setClient] = useState<any>(null);
  const [caseObj, setCaseObj] = useState<any>(null);

  // Core input mapping
  const [entrevistaPadrao, setEntrevistaPadrao] = useState('');

  // Google Docs 1st Attendance automation states
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [primeiroAtendimentoStatus, setPrimeiroAtendimentoStatus] = useState<'aguardando' | 'criado' | 'falha'>('aguardando');
  const [primeiroAtendimentoGoogleDocsUrl, setPrimeiroAtendimentoGoogleDocsUrl] = useState('');
  const [primeiroAtendimentoLogFalha, setPrimeiroAtendimentoLogFalha] = useState('');
  const [primeiroAtendimentoIsSimulated, setPrimeiroAtendimentoIsSimulated] = useState<boolean>(false);
  const [forceNewVersion, setForceNewVersion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [primeiroAtendimentoTechnicalLog, setPrimeiroAtendimentoTechnicalLog] = useState<any[]>([]);
  const [primeiroAtendimentoVersion, setPrimeiroAtendimentoVersion] = useState<number>(1);

  // Integration config modal/balloon states
  const [showIntegrationConfig, setShowIntegrationConfig] = useState<boolean>(false);
  const [integrationTemplateId, setIntegrationTemplateId] = useState<string>('1ODrPbz7qtyeiTYnjzSdv9YQ3NqdafYoub6-KpkmTQTo');
  const [integrationFolderId, setIntegrationFolderId] = useState<string>('');
  const [integrationFolderUrl, setIntegrationFolderUrl] = useState<string>('');
  
  // Backward preservation memory
  const [basesFaticas, setBasesFaticas] = useState('');
  const [description, setDescription] = useState(''); 
  const [fatosAbordagem, setFatosAbordagem] = useState('');

  // 5W2H Checklist boolean states
  const [checklist, setChecklist] = useState<Checklist5W2HState>({
    oQue: false,
    oQueObs: '',
    quem: false,
    quemObs: '',
    onde: false,
    ondeObs: '',
    quando: false,
    quandoObs: '',
    como: false,
    comoObs: '',
    porque: false,
    porqueObs: '',
    comoResolver: false,
    comoResolverObs: ''
  });

  // Administrative classification (Retained silently to avoid data loss)
  const [materia, setMateria] = useState('');
  const [ramo, setRamo] = useState('');
  const [tipoAcao, setTipoAcao] = useState('');

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('media');
  const [responsibleLawyer, setResponsibleLawyer] = useState('');
  const [visibleToClient, setVisibleToClient] = useState(true);

  const clientDriveFolderId = (client?.googleDriveClientFolderId || client?.gdriveFolderId || caseObj?.gdriveFolderId || '').trim();
  const clientDriveFolderUrl = (client?.googleDriveClientFolderUrl || client?.gdriveFolderUrl || caseObj?.gdriveFolderUrl || '').trim();
  const folderIsReal = !!(
    clientDriveFolderId && 
    !clientDriveFolderId.toLowerCase().includes('mock') && 
    !clientDriveFolderId.toLowerCase().includes('fake') && 
    !clientDriveFolderId.toLowerCase().includes('teste') && 
    !clientDriveFolderId.toLowerCase().includes('undefined') && 
    !clientDriveFolderId.toLowerCase().includes('null') && 
    !clientDriveFolderId.toLowerCase().includes('xxxx')
  );
  const [statusInterno, setStatusInterno] = useState('Em produção');
  const [statusPublicoCliente, setStatusPublicoCliente] = useState('');
  const [isPublicStatusManuallyEdited, setIsPublicStatusManuallyEdited] = useState(false);

  // Safeguard Baseline state
  const [initialCaseData, setInitialCaseData] = useState<any>(null);

  const hasUnsavedChanges = initialCaseData
    ? (
        title !== initialCaseData.title ||
        priority !== initialCaseData.priority ||
        responsibleLawyer !== initialCaseData.responsibleLawyer ||
        visibleToClient !== initialCaseData.visibleToClient ||
        statusInterno !== initialCaseData.statusInterno ||
        statusPublicoCliente !== initialCaseData.statusPublicoCliente ||
        entrevistaPadrao !== initialCaseData.entrevistaPadrao ||
        materia !== initialCaseData.materia ||
        ramo !== initialCaseData.ramo ||
        tipoAcao !== initialCaseData.tipoAcao ||
        JSON.stringify(checklist) !== JSON.stringify(initialCaseData.checklist)
      )
    : false;

  const handleGuardSave = async (): Promise<boolean> => {
    try {
      const successSaved = await saveCasePayload();
      return successSaved;
    } catch (err) {
      console.error("Guard save failed in DadosCaso screen:", err);
      return false;
    }
  };

  const { UnsavedChangesModal, SaveStatusIndicator } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    onSave: handleGuardSave,
    isSaving: saving,
    saveError: error
  });

  const statusInternoOptions = [
    'Rascunho',
    'Entrevista pendente',
    'Em produção',
    'Com pendência',
    'Em estruturação',
    'Aguardando revisão',
    'Em revisão',
    'Aprovado para protocolo',
    'Aguardando protocolo',
    'Protocolado',
    'Em controladoria',
    'Arquivado'
  ];

  // Load documentation on mount
  useEffect(() => {
    if (!caseId) {
      setError('Identificador do caso ausente na URL.');
      setFetching(false);
      return;
    }

    async function loadCaseData() {
      try {
        const caseSnap = await getDoc(doc(db, 'cases', caseId!));
        if (!caseSnap.exists()) {
          setError(`Caso referenciado por ID [${caseId}] não existe no banco de dados.`);
          setFetching(false);
          return;
        }

        const data = caseSnap.data();
        setCaseObj(data);

        // Core fields
        setTitle(data.title || '');
        setPriority(data.priority || 'media');
        setResponsibleLawyer(data.responsibleLawyer || '');
        setVisibleToClient(data.visibleToClient !== false);
        setStatusInterno(data.statusInterno || 'Em produção');
        setStatusPublicoCliente(data.statusPublicoCliente || '');
        setIsPublicStatusManuallyEdited(data.isPublicStatusManuallyEdited === true);

        // Google Docs automation fields
        setPrimeiroAtendimentoStatus(data.primeiroAtendimentoStatus || 'aguardando');
        setPrimeiroAtendimentoGoogleDocsUrl(data.primeiroAtendimentoGoogleDocsUrl || '');
        setPrimeiroAtendimentoLogFalha(data.primeiroAtendimentoLogFalha || '');
        setPrimeiroAtendimentoIsSimulated(data.primeiroAtendimentoIsSimulated === true);
        setPrimeiroAtendimentoTechnicalLog(data.primeiroAtendimentoTechnicalLog || []);
        setPrimeiroAtendimentoVersion(data.primeiroAtendimentoVersion || 1);

        // Reconcile and migrate narrative blocks safely (Solution 1)
        const loadedEntrevista = data.entrevistaPadrao || '';
        if (loadedEntrevista) {
          setEntrevistaPadrao(loadedEntrevista);
        } else {
          // Perform silent, clear migration concatenation of old blocks
          const tempParts: string[] = [];
          
          if (data.description?.trim()) {
            tempParts.push(`<p><strong>Histórico / Descrição Inicial:</strong><br/>${data.description}</p>`);
          } else if (data.descricaoDet?.trim()) {
            tempParts.push(`<p><strong>Histórico / Descrição Inicial:</strong><br/>${data.descricaoDet}</p>`);
          }

          if (data.basesFaticas?.trim()) {
            tempParts.push(`<p><strong>Bases Fáticas:</strong><br/>${data.basesFaticas}</p>`);
          }

          if (data.fatosAbordagem?.trim()) {
            tempParts.push(`<p><strong>Fatos de Abordagem:</strong><br/>${data.fatosAbordagem}</p>`);
          }

          setEntrevistaPadrao(tempParts.join('<br/>'));
        }

        // Keep local backups of legacy fields
        setBasesFaticas(data.basesFaticas || '');
        setDescription(data.description || '');
        setFatosAbordagem(data.fatosAbordagem || '');

        // Load 5W2H Checklist safely (Solution 3)
        const checkSrc = data.checklist5w2h || {};
        setChecklist({
          oQue: checkSrc.oQue === true,
          oQueObs: checkSrc.oQueObs || '',
          quem: checkSrc.quem === true,
          quemObs: checkSrc.quemObs || '',
          onde: checkSrc.onde === true,
          ondeObs: checkSrc.ondeObs || '',
          quando: checkSrc.quando === true,
          quandoObs: checkSrc.quandoObs || '',
          como: checkSrc.como === true,
          comoObs: checkSrc.comoObs || '',
          porque: checkSrc.porque === true,
          porqueObs: checkSrc.porqueObs || '',
          comoResolver: checkSrc.comoResolver === true,
          comoResolverObs: checkSrc.comoResolverObs || ''
        });

        // Retain classifications silently so we do not break any other screens
        setMateria(data.materia || (data.caseType ? data.caseType.split('/')[0]?.trim() : ''));
        setRamo(data.ramo || (data.caseType ? data.caseType.split('/')[1]?.trim() : ''));
        setTipoAcao(data.tipoAcao || (data.caseType ? data.caseType.split('/')[2]?.trim() : ''));

        // Client info lookup
        if (data.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', data.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Load GDI connectors settings
        try {
          const docRef = doc(db, 'settings', 'connectors');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const raw = docSnap.data();
            const googleDocs = raw.googleDocs || {};
            const savedTemplateId = googleDocs.templates?.['primeiro_atendimento'] || '1ODrPbz7qtyeiTYnjzSdv9YQ3NqdafYoub6-KpkmTQTo';
            const savedFolderId = googleDocs.destinationFolderIds?.['primeiro_atendimento'] || googleDocs.destinationFolderId || '';
            const savedFolderUrl = googleDocs.destinationFolderUrls?.['primeiro_atendimento'] || googleDocs.destinationFolderUrl || '';
            setIntegrationTemplateId(savedTemplateId);
            setIntegrationFolderId(savedFolderId);
            setIntegrationFolderUrl(savedFolderUrl);
          }
        } catch (e) {
          console.error("Erro ao carregar configurações de conectores para o balão: ", e);
        }

        // Store safeguard baseline comparison
        const checkSrcResolved = data.checklist5w2h || {};
        const loadedState = {
          title: data.title || '',
          priority: data.priority || 'media',
          responsibleLawyer: data.responsibleLawyer || '',
          visibleToClient: data.visibleToClient !== false,
          statusInterno: data.statusInterno || 'Em produção',
          statusPublicoCliente: data.statusPublicoCliente || '',
          entrevistaPadrao: loadedEntrevista,
          checklist: {
            oQue: checkSrcResolved.oQue === true,
            oQueObs: checkSrcResolved.oQueObs || '',
            quem: checkSrcResolved.quem === true,
            quemObs: checkSrcResolved.quemObs || '',
            onde: checkSrcResolved.onde === true,
            ondeObs: checkSrcResolved.ondeObs || '',
            quando: checkSrcResolved.quando === true,
            quandoObs: checkSrcResolved.quandoObs || '',
            como: checkSrcResolved.como === true,
            comoObs: checkSrcResolved.comoObs || '',
            porque: checkSrcResolved.porque === true,
            porqueObs: checkSrcResolved.porqueObs || '',
            comoResolver: checkSrcResolved.comoResolver === true,
            comoResolverObs: checkSrcResolved.comoResolverObs || ''
          },
          materia: data.materia || (data.caseType ? data.caseType.split('/')[0]?.trim() : ''),
          ramo: data.ramo || (data.caseType ? data.caseType.split('/')[1]?.trim() : ''),
          tipoAcao: data.tipoAcao || (data.caseType ? data.caseType.split('/')[2]?.trim() : '')
        };
        setInitialCaseData(loadedState);
      } catch (err: any) {
        console.error(err);
        setError(`Erro crítico ao carregar fasticidade do caso: ${err.message || err}`);
      } finally {
        setFetching(false);
      }
    }

    loadCaseData();
  }, [caseId]);

  // Suggested Public Status triggers on status altering
  const handleStatusInternoChange = (newVal: string) => {
    setStatusInterno(newVal);
    if (!isPublicStatusManuallyEdited) {
      const suggest = statusMapping[newVal] || '';
      setStatusPublicoCliente(suggest);
    }
  };

  const handlePublicStatusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusPublicoCliente(e.target.value);
    setIsPublicStatusManuallyEdited(true);
  };

  const handleRestoreStatusSuggestion = () => {
    setError(null);
    const suggest = statusMapping[statusInterno] || '';
    setStatusPublicoCliente(suggest);
    setIsPublicStatusManuallyEdited(false);
  };

  // Check 5W2H Completeness Criteria: (Solution 3 / Checklist + Entrevista)
  const is5W2HComplete = !!(
    entrevistaPadrao.trim() &&
    checklist.oQue &&
    checklist.quem &&
    checklist.onde &&
    checklist.quando &&
    checklist.como &&
    checklist.porque &&
    checklist.comoResolver
  );

  const is5W2HStarted = !!(
    entrevistaPadrao.trim() ||
    checklist.oQue ||
    checklist.quem ||
    checklist.onde ||
    checklist.quando ||
    checklist.como ||
    checklist.porque ||
    checklist.comoResolver
  );

  const handleChecklistToggle = (field: keyof Checklist5W2HState) => {
    setChecklist(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleChecklistObsChange = (field: keyof Checklist5W2HState, value: string) => {
    setChecklist(prev => ({
      ...prev,
      [`${field}Obs`]: value
    }));
  };

  const validateDraft = (): boolean => {
    setError(null);
    return true;
  };

  const saveCasePayload = async (nextStage?: string): Promise<boolean> => {
    if (!validateDraft()) return false;
 
    setSaving(true);
    setError(null);
    setSuccess(null);
 
    // Keep combined structure
    const combinedCaseType = [materia.trim(), ramo.trim(), tipoAcao.trim()].filter(Boolean).join(' / ');
    let currentStatusValue = caseObj?.status || 'active';
    const resolvedTitle = title.trim() || caseObj?.title || 'Rascunho de Produção';
    if (currentStatusValue === 'rascunho' && resolvedTitle) {
      currentStatusValue = 'ativo';
    }
 
    const computedProductionStatus = is5W2HComplete ? 'em_producao' : 'com_pendencias';
    const timestamp = new Date().toISOString();
 
    const payload: any = {
      title: resolvedTitle,
      caseType: combinedCaseType,
      materia: materia.trim(),
      ramo: ramo.trim(),
      tipoAcao: tipoAcao.trim(),
      
      // Store consolidated fields
      entrevistaPadrao: entrevistaPadrao.trim(),
      checklist5w2h: {
        oQue: checklist.oQue,
        oQueObs: checklist.oQueObs || '',
        quem: checklist.quem,
        quemObs: checklist.quemObs || '',
        onde: checklist.onde,
        ondeObs: checklist.ondeObs || '',
        quando: checklist.quando,
        quandoObs: checklist.quandoObs || '',
        como: checklist.como,
        comoObs: checklist.comoObs || '',
        porque: checklist.porque,
        porqueObs: checklist.porqueObs || '',
        comoResolver: checklist.comoResolver,
        comoResolverObs: checklist.comoResolverObs || ''
      },
 
      // Mirror / Fallback backup storage (Solution 1 and 3)
      description: entrevistaPadrao.trim(), // espelhamento
      basesFaticas: basesFaticas,
      fatosAbordagem: fatosAbordagem,
 
      // UI variables
      priority,
      responsibleLawyer: responsibleLawyer.trim(),
      visibleToClient,
      statusInterno,
      statusPublicoCliente: statusPublicoCliente.trim(),
      isPublicStatusManuallyEdited,
      productionStatus: computedProductionStatus,
      status: currentStatusValue,
      updatedAt: timestamp,

      // Google Docs automation status
      primeiroAtendimentoStatus,
      primeiroAtendimentoGoogleDocsUrl,
      primeiroAtendimentoLogFalha
    };

    if (nextStage) {
      payload.productionStage = nextStage;
    } else {
      payload.productionStage = 'dados-caso';
    }

    try {
      // 1. Primary updates
      await updateDoc(doc(db, 'cases', caseId!), payload);
      
      // 2. Mirrored legacy lists update
      await setDoc(doc(db, 'casos', caseId!), {
        id: caseId,
        caseId: caseId,
        clienteId: caseObj.clientId,
        clientId: caseObj.clientId,
        title: payload.title,
        titulo: payload.title,
        caseType: payload.caseType,
        tipo: payload.caseType,
        description: payload.description,
        descricao: payload.description,
        priority: payload.priority,
        prioridade: payload.priority,
        responsibleLawyer: payload.responsibleLawyer,
        advogadoResponsavel: payload.responsibleLawyer,
        visibleToClient: payload.visibleToClient,
        visivelParaCliente: payload.visibleToClient,
        statusInterno: payload.statusInterno,
        statusPublicoCliente: payload.statusPublicoCliente,
        status: payload.status,
        productionStatus: payload.productionStatus,
        productionStage: payload.productionStage,
        updatedAt: payload.updatedAt,
        atualizadoEm: payload.updatedAt,
        createdAt: caseObj.createdAt || new Date().toISOString(),
        criadoEm: caseObj.createdAt || new Date().toISOString()
      }, { merge: true });

      setSuccess('Entrevista Padrão e Checklist 5W2H salvos com primor operacional!');
      setCaseObj({ ...caseObj, ...payload });
      setInitialCaseData({
        title: payload.title,
        priority: payload.priority,
        responsibleLawyer: payload.responsibleLawyer,
        visibleToClient: payload.visibleToClient,
        statusInterno: payload.statusInterno,
        statusPublicoCliente: payload.statusPublicoCliente,
        entrevistaPadrao: payload.entrevistaPadrao,
        checklist: { ...payload.checklist5w2h },
        materia: payload.materia,
        ramo: payload.ramo,
        tipoAcao: payload.tipoAcao
      });
      return true;
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao gravar dados da entrevista: ${err.message || err}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    await saveCasePayload();
  };

  const handleSaveAndAdvance = async () => {
    const successSaved = await saveCasePayload('tipo-producao');
    if (successSaved) {
      navigate(flowRoutes.tipoServico(caseId!));
    }
  };

  const handleSaveAndExit = async () => {
    const successSaved = await saveCasePayload();
    if (successSaved) {
      navigate('/boss-giffoni-clientes/fluxo-producao');
    }
  };

  const handleCopyLink = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Erro ao copiar link:", err);
    });
  };

  const handleGeneratePrimeiroAtendimento = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Primeiro Atendimento ignorada.");
      return;
    }
    generationInFlightRef.current = true;
    setError(null);
    setSuccess(null);
    setGeneratingDoc(true);

    const targetCaseId = caseId;
    const targetClientId = caseObj?.clientId || client?.id;

    try {
      // 1. caseId existe
      if (!targetCaseId) {
        throw new Error("ID do caso (caseId) está ausente.");
      }

      // 2. caseData existe (caseObj)
      if (!caseObj) {
        throw new Error("Dados do caso não foram carregados do banco de dados.");
      }

      // 3. clientId existe
      if (!targetClientId) {
        throw new Error("ID do cliente (clientId) está ausente.");
      }

      // 4. clientData existe (client)
      if (!client) {
        throw new Error("Dados do cliente não foram carregados do banco de dados.");
      }

      // 5. clientType detection
      const clientType = client?.type || client?.clientType || caseObj?.clientType || "PF";
      const isPj = clientType === "PJ";
      const prefix = isPj ? "ATENDIMENTO_PJ_" : "ATENDIMENTO_PF_";

      let nomeCompleto = "";
      let razaoSocial = "";

      if (!isPj) {
        nomeCompleto = (
          client?.pfData?.pf_nomeCompleto ||
          client?.pfDadosPessoais?.pf_nomeCompleto ||
          client?.portalMirror?.pfDadosPessoais?.nomeCompleto ||
          client?.nomeCompleto ||
          client?.nome ||
          client?.name ||
          ""
        ).trim();

        if (!nomeCompleto) {
          console.error("PF_FULL_NAME_NOT_FOUND: Nome completo do cliente não localizado.", {
            clientId: targetClientId,
            caseId: targetCaseId
          });
          throw new Error("Nome completo do cliente não localizado no cadastro PF. Verifique o campo pf_nomeCompleto na Etapa 1 — Cadastro do Cliente.");
        }
      } else {
        razaoSocial = (
          client?.pjData?.pj_razaoSocial ||
          client?.pjDadosEmpresa?.pj_razaoSocial ||
          client?.razaoSocial ||
          client?.nomeEmpresa ||
          ""
        ).trim();

        if (!razaoSocial) {
          console.error("PJ_RAZAO_SOCIAL_NOT_FOUND: Razão social do cliente não localizada.", {
            clientId: targetClientId,
            caseId: targetCaseId
          });
          throw new Error("Razão social da empresa não localizada no cadastro PJ. Verifique o campo pj_razaoSocial na Etapa 1 — Cadastro do Cliente.");
        }
      }

      // 7. googleDriveClientFolderId existe
      // 8. googleDriveClientFolderUrl existe
      const googleDriveClientFolderId = (client?.googleDriveClientFolderId || client?.gdriveFolderId || caseObj?.gdriveFolderId || "").trim();
      const googleDriveClientFolderUrl = (client?.googleDriveClientFolderUrl || client?.gdriveFolderUrl || caseObj?.gdriveFolderUrl || "").trim();

      // 9. googleDriveClientFolderId não contém “mock”, “fake”, Curt, “teste”, “undefined” ou “null”
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
        setError("Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.");
        setGeneratingDoc(false);
        generationInFlightRef.current = false;
        return;
      }

      // 10. templateId oficial está definido
      let officialTemplateId = "1ODrPbz7qtyeiTYnjzSdv9YQ3NqdafYoub6-KpkmTQTo";
      let destinationFolderId = googleDriveClientFolderId;
      let destinationFolderUrl = googleDriveClientFolderUrl;

      const templateKey = isPj ? "primeiro_atendimento_pj" : "primeiro_atendimento";

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

      // 11. placeholders foram montados e não estão vazios
      const placeholders = isPj 
        ? buildPrimeiroAtendimentoPjPlaceholders(client, caseObj)
        : buildPrimeiroAtendimentoPlaceholders(client, caseObj);

      if (!placeholders || Object.keys(placeholders).length === 0) {
        throw new Error("Os placeholders do Primeiro Atendimento estão vazios ou não puderam ser gerados.");
      }

      // 12. googleAccessToken existe ou há credentialOverride válido
      const currentGoogleAccessToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
      const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

      if (!currentGoogleAccessToken && !localOverride) {
        setError("Faça login novamente com Google para autorizar Google Docs/Drive ou configure a Service Account na Central de Integrações.");
        setGeneratingDoc(false);
        generationInFlightRef.current = false;
        return;
      }

      const targetEndpoint = "/api/google-docs/generate-document";
      const nextVersion = (primeiroAtendimentoVersion || caseObj?.primeiroAtendimentoVersion || 1) + (primeiroAtendimentoGoogleDocsUrl ? 1 : 0);
      
      const clickLog = {
        action: primeiroAtendimentoGoogleDocsUrl
          ? `${prefix}NEW_VERSION_SINGLE_CLICK_STARTED`
          : `${prefix}SINGLE_CLICK_GENERATION_STARTED`,
        timestamp: new Date().toISOString(),
        message: primeiroAtendimentoGoogleDocsUrl
          ? `Nova versão ${nextVersion} iniciada diretamente pelo botão único, sem confirmação intermediária.`
          : "Geração iniciada diretamente pelo botão único de documento."
      };

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
        documentName: isPj ? `1º Atendimento PJ - ${razaoSocial}` : `1º Atendimento PF - ${nomeCompleto}`,
        placeholders,
        metadata: {
          source: `Portal BOSS - 1º Atendimento ${clientType}`,
          folderSource: "Automação Google Drive — Pasta do Cliente",
          caseId: targetCaseId,
          clientId: targetClientId,
          singleClickStarted: clickLog
        },
        credentialOverride: localOverride,
        generationIntent: intent,
        existingDocument: intent === 'initial' && primeiroAtendimentoStatus === 'criado' ? {
          googleDocsId: caseObj?.primeiroAtendimentoGoogleDocsId || caseObj?.primeiroAtendimentoId || '',
          googleDocsUrl: primeiroAtendimentoGoogleDocsUrl || caseObj?.primeiroAtendimentoGoogleDocsUrl || caseObj?.primeiroAtendimentoUrl || '',
          version: primeiroAtendimentoVersion || caseObj?.primeiroAtendimentoVersion || 1
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

      // Update immediate state and persist in Firestore
      let newLogs = responseData.technicalLog || [
        {
          timestamp: new Date().toISOString(),
          level: response.ok && responseData.success ? "success" : "error",
          code: response.ok && responseData.success ? "FLOW_COMPLETED" : "GENERATION_FAILED",
          message: responseData.errorMessage || responseData.error || responseText || "Ocorreu uma falha no fluxo."
        }
      ];

      newLogs = [clickLog, ...newLogs];
      setPrimeiroAtendimentoTechnicalLog(newLogs);

      const caseDocRef = doc(db, 'cases', targetCaseId);

      if (!response.ok || !responseData.success) {
        const errorDetail = responseData.errorMessage || responseData.error || "Falha na geração integrada.";
        setPrimeiroAtendimentoStatus('falha');
        setPrimeiroAtendimentoLogFalha(errorDetail);
        setError(`Falha ao gerar o 1º Atendimento no motor interno: ${errorDetail}`);

        // Update case with failure state and log
        await updateDoc(caseDocRef, {
          primeiroAtendimentoStatus: "falha",
          primeiroAtendimentoLogFalha: errorDetail,
          primeiroAtendimentoTechnicalLog: newLogs,
          primeiroAtendimentoLastOperationAt: new Date().toISOString(),
          primeiroAtendimentoLastOutcome: "error",
          primeiroAtendimentoLastErrorCode: responseData.errorCode || "GENERATION_FAILED",
          primeiroAtendimentoLastErrorMessage: errorDetail
        });

        const subdocRef = doc(db, 'cases', targetCaseId, 'generatedDocuments', 'primeiro_atendimento');
        await setDoc(subdocRef, {
          status: "failure",
          technicalLog: newLogs,
          lastOutcome: "error",
          errorCode: responseData.errorCode || "GENERATION_FAILED",
          errorMessage: errorDetail,
          lastCheckedAt: new Date().toISOString()
        }, { merge: true });

        return;
      }

      // Handle Success Modes
      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;
      const outcome = responseData.outcome;
      const docVer = responseData.documentVersion || 1;

      // VALIDAR URL DO GOOGLE DOCS REAL
      if (!googleDocsUrl || !googleDocsUrl.startsWith("https://docs.google.com/document/d/")) {
        throw new Error("A URL do Google Docs retornada pelo servidor não é válida ou não pertence a um documento real.");
      }

      setPrimeiroAtendimentoStatus('criado');
      setPrimeiroAtendimentoGoogleDocsUrl(googleDocsUrl);
      setPrimeiroAtendimentoIsSimulated(false);
      setPrimeiroAtendimentoLogFalha('');
      setPrimeiroAtendimentoVersion(docVer);

      if (outcome === "already_exists_in_destination") {
        setSuccess('1º Atendimento já foi criado e confirmado na pasta do Google Drive. Para conferir ou utilizar a versão existente, abra a pasta do cliente.');
      } else {
        setSuccess(`Nova versão do 1º Atendimento criada e salva na pasta real do Google Drive (Versão v${docVer}).`);
      }

      // Update case with success states and logs
      await updateDoc(caseDocRef, {
        primeiroAtendimentoStatus: "criado",
        primeiroAtendimentoId: googleDocsId,
        primeiroAtendimentoUrl: googleDocsUrl,
        primeiroAtendimentoGoogleDocsId: googleDocsId,
        primeiroAtendimentoGoogleDocsUrl: googleDocsUrl,
        primeiroAtendimentoIsSimulated: false,
        primeiroAtendimentoGeneratedAt: new Date().toISOString(),
        primeiroAtendimentoDestinationFolderId: googleDriveClientFolderId,
        primeiroAtendimentoDestinationFolderUrl: googleDriveClientFolderUrl,
        primeiroAtendimentoLogFalha: "",
        primeiroAtendimentoTechnicalLog: newLogs,
        primeiroAtendimentoVersion: docVer,
        primeiroAtendimentoLastOperationAt: new Date().toISOString(),
        primeiroAtendimentoLastOutcome: outcome || "success",
        primeiroAtendimentoLastErrorCode: null,
        primeiroAtendimentoLastErrorMessage: null
      });

      // Save to cases/{caseId}/generatedDocuments/primeiro_atendimento
      const subdocRef = doc(db, 'cases', targetCaseId, 'generatedDocuments', 'primeiro_atendimento');
      await setDoc(subdocRef, {
        documentType: templateKey,
        displayName: isPj ? `1º Atendimento PJ - ${razaoSocial} - v${docVer}` : `1º Atendimento PF - ${nomeCompleto} - v${docVer}`,
        templateKey: templateKey,
        templateId: officialTemplateId,
        googleDocsId,
        googleDocsUrl,
        isSimulated: false,
        destinationFolderId: googleDriveClientFolderId,
        destinationFolderUrl: googleDriveClientFolderUrl,
        status: "success",
        generatedAt: new Date().toISOString(),
        generatedBy: "Portal BOSS Central Interna (Stateless)",
        errorCode: null,
        errorMessage: null,
        technicalLog: newLogs,
        documentVersion: docVer,
        lastCheckedAt: new Date().toISOString(),
        lastOutcome: outcome || "success"
      }, { merge: true });

      // Save version history entry if created a new version
      if (outcome === "created") {
        const versionSubdocRef = doc(db, 'cases', targetCaseId, 'generatedDocuments', 'primeiro_atendimento', 'versions', googleDocsId);
        await setDoc(versionSubdocRef, {
          googleDocsId,
          googleDocsUrl,
          documentVersion: docVer,
          destinationFolderId: googleDriveClientFolderId,
          destinationFolderUrl: googleDriveClientFolderUrl,
          status: "success",
          technicalLog: newLogs,
          generatedAt: new Date().toISOString()
        });
      }

    } catch (err: any) {
      console.error(err);
      setPrimeiroAtendimentoStatus('falha');
      const errorMessage = err.message || String(err);
      setPrimeiroAtendimentoLogFalha(errorMessage);
      setError(`Falha ao gerar o 1º Atendimento no motor interno: ${errorMessage}`);

      try {
        const caseDocRef = doc(db, 'cases', targetCaseId!);
        await updateDoc(caseDocRef, {
          primeiroAtendimentoStatus: "falha",
          primeiroAtendimentoLogFalha: errorMessage,
          primeiroAtendimentoGeneratedAt: ""
        });
      } catch (e) {
        console.warn("Could not save failure state to case document", e);
      }
    } finally {
      setGeneratingDoc(false);
      generationInFlightRef.current = false;
    }
  };

  if (!caseId) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 bg-white border border-red-200 rounded-3xl shadow-sm text-center">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-gray-900 uppercase">Acesso Bloqueado</h3>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Nenhum identificador fático (caseId) foi fornecido na URL de requisição técnica.
        </p>
      </div>
    );
  }

  const clientName = client 
    ? (client.type === 'PF' 
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome') 
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Sem Razão Social'))
    : '';
  const clientSlug = client?.slug || '';

  const nomeRealDoCliente = (
    client?.pfData?.pf_nomeCompleto ||
    client?.pfDadosPessoais?.pf_nomeCompleto ||
    client?.portalMirror?.pfDadosPessoais?.nomeCompleto ||
    client?.nomeCompleto ||
    client?.nome ||
    client?.name ||
    clientName ||
    "Cliente"
  ).trim();

  const isSimulatedDoc = !!(
    primeiroAtendimentoIsSimulated || 
    caseObj?.primeiroAtendimentoIsSimulated === true ||
    (primeiroAtendimentoGoogleDocsUrl && primeiroAtendimentoGoogleDocsUrl.includes('simulated=true')) ||
    (caseObj?.primeiroAtendimentoGoogleDocsId && caseObj?.primeiroAtendimentoGoogleDocsId.startsWith('simulated-'))
  );

  const hasRealSuccess = !!(
    primeiroAtendimentoStatus === 'criado' &&
    primeiroAtendimentoGoogleDocsUrl &&
    primeiroAtendimentoGoogleDocsUrl.startsWith("https://docs.google.com/document/d/") &&
    clientDriveFolderId &&
    !isSimulatedDoc
  );

  const techCode = primeiroAtendimentoStatus === 'criado' 
    ? (caseObj?.primeiroAtendimentoLastOutcome || "SUCCESS") 
    : (caseObj?.primeiroAtendimentoLastErrorCode || "GENERATION_FAILED");
  const techTimestamp = caseObj?.primeiroAtendimentoLastOperationAt || caseObj?.primeiroAtendimentoGeneratedAt || caseObj?.updatedAt || "";
  const techDocId = caseObj?.primeiroAtendimentoGoogleDocsId || caseObj?.primeiroAtendimentoId || "";
  const techDocVer = primeiroAtendimentoVersion || caseObj?.primeiroAtendimentoVersion || 1;

  return (
    <FluxoStepLayout stepName="Dados do Caso" caseId={caseId} statusText={caseObj?.status === 'rascunho' ? 'Rascunho' : 'Caso Ativo'}>
      <div className="space-y-8">
        
        {/* HEADER AREA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Entrevista Inicial / Questionário 5W2H</h3>
            {clientName && (
              <p className="text-[11px] text-indigo-650 font-bold tracking-wide mt-1 uppercase">
                Cliente: {clientName}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Registre a narrativa consolidada da entrevista e confira os fatos obrigatórios no checklist de auditoria 5W2H.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <SaveStatusIndicator />
            {!is5W2HComplete && is5W2HStarted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-800 text-[10px] font-black uppercase tracking-wider font-sans animate-pulse">
                <AlertTriangle size={11} className="text-amber-500" />
                Incompetência / Pendências
              </span>
            ) : is5W2HComplete ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-[10px] font-black uppercase tracking-wider font-sans">
                <CheckCircle2 size={11} className="text-emerald-500" />
                Entrevista Pronta
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-gray-500 text-[10px] font-bold uppercase tracking-wider font-sans">
                Aguardando Cadastro
              </span>
            )}
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-red-900 text-xs flex gap-3 items-center animate-fadeIn">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center animate-fadeIn">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {fetching ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-gray-500 font-bold" size={28} />
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-gray-500">Sincronizando Histórico Fático...</span>
          </div>
        ) : (
          <div className="space-y-8">

            {/* IF INCOMPLETE WARNING CARD */}
            {!is5W2HComplete && is5W2HStarted && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm flex gap-3 items-start animate-fadeIn">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-xs uppercase tracking-wider">Aviso de Integralidade Fática</h5>
                  <p className="leading-relaxed text-xs">
                    Entrevista ou checklist pendente. Você pode navegar livremente pelo fluxo, mas esta etapa constará como pendente no painel de controle e na lateral até que a narrativa principal seja redigida e todas as 7 perguntas do checklist de auditoria abaixo sejam conferidas.
                  </p>
                </div>
              </div>
            )}

            {/* PART 1: CARDS DE SELEÇÃO DE TIPO (Solution 2) */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase text-gray-650 tracking-wide block">
                Modalidade de Entrevista
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Entrevista Padrão Card */}
                <button
                  type="button"
                  onClick={() => setSelectedTab('padrao')}
                  className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                    selectedTab === 'padrao'
                      ? 'border-gray-950 bg-white shadow-xs'
                      : 'border-gray-150 bg-gray-50/50 opacity-80 hover:bg-gray-50 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider font-mono text-gray-900 flex items-center gap-1.5">
                      <FileText size={14} className="text-gray-950" />
                      Entrevista Padrão
                    </span>
                    <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-800 text-[9px] font-black rounded-sm tracking-wider uppercase">
                      Ativo
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    Escrita livre do histórico fático consolidado do cliente, unificando dados, contextualização e fatos da abordagem.
                  </p>
                </button>

                {/* Entrevistas Estruturadas Card */}
                <button
                  type="button"
                  onClick={() => setSelectedTab('estruturada')}
                  className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden ${
                    selectedTab === 'estruturada'
                      ? 'border-indigo-600 bg-indigo-50/10 shadow-xs ring-1 ring-indigo-600'
                      : 'border-gray-150 bg-gray-50/50 opacity-80 hover:bg-gray-50 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider font-mono text-gray-600 flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-gray-400" />
                      Roteiros Estruturados
                    </span>
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-black rounded-sm tracking-wider uppercase">
                      Em breve
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    Formulários e questionários guiados inteligentes baseados nas teses mais recorrentes do escritório (trabalhista, previdenciário, consumidor).
                  </p>
                </button>
              </div>

              {selectedTab === 'estruturada' && (
                <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl text-indigo-950 text-xs flex gap-3 items-center animate-fadeIn">
                  <Sparkles size={16} className="text-indigo-600 shrink-0" />
                  <span>
                    <strong>Integração futura:</strong> As entrevistas estruturadas serão disponibilizadas em módulos subsequentes do giga app. Por favor, utilize o editor da <strong>Entrevista Padrão</strong> para registrar o caso atual.
                  </span>
                </div>
              )}
            </div>

            {/* PART 2: UNIFIED NARRATIVE EDITOR (Solution 1 & 6) */}
            <div className="border border-gray-150 rounded-3xl p-6 bg-white space-y-4 shadow-xs">
              <div className="flex justify-between items-start border-b border-gray-100 pb-3 flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <BookOpen size={16} className="text-gray-700" />
                    <span>Registro da Entrevista Padrão</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Laudo descritivo do atendimento de fasticidade principal da lide.</p>
                </div>
                {!entrevistaPadrao.trim() && (
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider px-2 py-0.5 bg-red-50 rounded-md">Pendente *</span>
                )}
              </div>
              
              <MiniRichEditor 
                id="entrevistaPadrao"
                value={entrevistaPadrao}
                onChange={setEntrevistaPadrao}
                placeholder="Insira a narrativa fática do atendimento, transcrição da entrevista e documentos correspondentes apresentados..." 
                isMissing={!entrevistaPadrao.trim()}
              />
            </div>

            {/* PART 3: AUDIT 5W2H CHECKLISTS (Solution 3) */}
            <div className="border border-gray-150 rounded-3xl p-6 bg-white space-y-6 shadow-xs">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-[18px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <ClipboardList size={18} className="text-blue-600" />
                  <span>Módulo de Auditoria de Faticidade • Checklist 5W2H</span>
                </h3>
                <p className="text-[15px] text-gray-500 mt-1">
                  Fatores mínimos de verificação para controle de qualidade da petição inicial ou requerimento administrativo.
                </p>
              </div>

              <div className="space-y-4">
                
                {/* CHECKLIST ITEMS LIST */}
                {[
                  { key: 'oQue', label: '1. O Quê', question: 'Foi colhido tudo o que aconteceu?' },
                  { key: 'quem', label: '2. Quem', question: 'Foram identificadas todas as pessoas envolvidas?' },
                  { key: 'onde', label: '3. Onde', question: 'O local dos fatos foi esclarecido?' },
                  { key: 'quando', label: '4. Quando', question: 'As datas, períodos ou marcos temporais foram esclarecidos?' },
                  { key: 'como', label: '5. Como', question: 'A forma como os fatos ocorreram foi compreendida?' },
                  { key: 'porque', label: '6. Por quê', question: 'A causa, motivação ou origem do problema foi investigada?' },
                  { key: 'comoResolver', label: '7. Como resolver', question: 'O encaminhamento esperado pelo cliente foi compreendido?' },
                ].map((item) => {
                  const val = (checklist as any)[item.key];
                  const isSim = val === true;
                  const isNao = val === false;

                  return (
                    <div 
                      key={item.key} 
                      className={`p-4 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isSim 
                          ? 'border-emerald-150 bg-emerald-50/20' 
                          : isNao 
                          ? 'border-red-150 bg-red-50/20'
                          : 'border-gray-150 bg-gray-50/40'
                      }`}
                    >
                      {/* Left: Indicator label & Clean descriptive question */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isSim 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : isNao 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {item.label}
                          </span>
                          
                          {isSim && (
                            <span className="text-xs text-emerald-700 font-extrabold flex items-center gap-0.5 select-none">
                              ✅ Sim
                            </span>
                          )}
                          {isNao && (
                            <span className="text-xs text-red-700 font-extrabold flex items-center gap-0.5 select-none">
                              ❌ Não
                            </span>
                          )}
                        </div>
                        <p className="text-[15px] font-bold text-gray-800 leading-normal font-sans">
                          {item.question}
                        </p>
                      </div>

                      {/* Right: Objective SIM / NÃO Selector Buttons with visual emoji */}
                      <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setChecklist(prev => ({ ...prev, [item.key]: true }))}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none ${
                            isSim
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-400'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                          }`}
                        >
                          <span>✅</span>
                          <span>Sim</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setChecklist(prev => ({ ...prev, [item.key]: false }))}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none ${
                            isNao
                              ? 'bg-red-600 border-red-500 text-white shadow-sm ring-1 ring-red-400'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                          }`}
                        >
                          <span>❌</span>
                          <span>Não</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* AUTOMAÇÃO GOOGLE DOCS — 1º ATENDIMENTO */}
            <div className="bg-gradient-to-br from-indigo-50/60 to-blue-50/20 border border-indigo-150 rounded-3xl p-6 shadow-3xs space-y-5 animate-in fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 bg-indigo-100 text-indigo-800 rounded-full font-black text-[9px] uppercase tracking-wider font-mono">
                      Automação Ativa
                    </span>
                    <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">
                    Automação Google Docs — 1º Atendimento - {client?.type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                    Esta ferramenta envia os dados consolidados do cadastro de {client?.type === 'PJ' ? 'pessoa jurídica' : 'pessoa física'} diretamente ao build receptor do Google Docs para preenchimento de placeholders, indexação e arquivamento automatizado na pasta em tempo real.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Botoes de acao de integracao empilhados verticalmente à esquerda */}
                <div className="flex flex-col items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowIntegrationConfig(!showIntegrationConfig)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs border ${
                      showIntegrationConfig
                        ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border-indigo-150 hover:border-indigo-300'
                    }`}
                  >
                    <Settings size={13} className={showIntegrationConfig ? "text-white" : "text-indigo-500"} />
                    Ver Configurações de integração
                  </button>

                  {folderIsReal && clientDriveFolderUrl ? (
                    <a
                      href={clientDriveFolderUrl}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-3xs"
                    >
                      <GoogleDriveIcon size={14} className="text-emerald-600" />
                      <span>Abrir pasta no Google Drive</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-250 text-gray-400 font-extrabold rounded-xl text-xs cursor-not-allowed opacity-60"
                    >
                      <GoogleDriveIcon size={14} className="grayscale opacity-50" />
                      <span>Pasta do Google Drive ainda não disponível</span>
                    </button>
                  )}
                </div>

                {showIntegrationConfig && (
                  <div className="p-5 bg-white border border-gray-150 rounded-2xl space-y-4 shadow-lg animate-in slide-in-from-top-1 duration-250 max-w-xl text-left">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Settings size={15} className="text-indigo-600" />
                        <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider font-mono">
                          Informações Técnicas & Configurações GDI
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowIntegrationConfig(false)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-405 hover:text-gray-700 transition"
                        title="Fechar"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* DESTINO DA PASTA DO CLIENTE */}
                      <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                        <h5 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider font-mono">
                          DESTINO DA PASTA DO CLIENTE
                        </h5>
                        <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-700">
                          <p className="font-bold text-slate-850">
                            Pasta do Google Drive de {nomeRealDoCliente}
                          </p>
                          <p className="text-slate-500 font-semibold">
                            Fonte: Automação Google Drive — Pasta do Cliente
                          </p>
                          <div className="pt-1.5 space-y-1.5 border-t border-slate-200/50">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-600 truncate">Pasta ID: {clientDriveFolderId || 'Não definida'}</span>
                              {clientDriveFolderId && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(clientDriveFolderId)}
                                  className="text-[9px] font-black uppercase text-indigo-650 hover:text-indigo-850 cursor-pointer shrink-0"
                                >
                                  {copied ? "Copiado!" : "Copiar ID"}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-600 truncate flex-1">URL: {clientDriveFolderUrl || 'Não definida'}</span>
                              {clientDriveFolderUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(clientDriveFolderUrl)}
                                  className="text-[9px] font-black uppercase text-indigo-650 hover:text-indigo-850 cursor-pointer shrink-0"
                                >
                                  {copied ? "Copiado!" : "Copiar URL"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Template de Referência (Documento Base) */}
                      <div className="space-y-2 pb-1">
                        <label className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider block font-mono">
                          Template de Referência (Documento Base)
                        </label>
                        <div className="space-y-2">
                          <p className="text-[11px] text-gray-500 font-medium">
                            Modelo padrão utilizado para preenchimento de metadados fáticos (1º Atendimento PF):
                          </p>
                          <a
                            href={`https://docs.google.com/document/d/${integrationTemplateId}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-150 text-indigo-750 hover:text-indigo-900 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shadow-3xs"
                          >
                            <FileText size={13} className="text-indigo-500" />
                            <span>Abrir Template de Referência Google Docs</span>
                            <ExternalLink size={10} className="opacity-70" />
                          </a>
                          <div className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-[9px] font-mono select-all text-gray-500 flex items-center justify-between gap-2">
                            <span className="truncate">ID: {integrationTemplateId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(integrationTemplateId)}
                              className="text-indigo-650 hover:text-indigo-850 font-black uppercase tracking-wider cursor-pointer"
                            >
                              Copiar ID do Template
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Botao fechar */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setShowIntegrationConfig(false)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer"
                        >
                          Fechar painel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {generatingDoc ? (
                  <div className="bg-white border border-indigo-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-pulse font-sans">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="text-indigo-600 animate-spin" size={17} />
                        <span className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                          Gerando primeiro atendimento seguro... Por favor, aguarde alguns instantes.
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full animate-infinite-loading w-3/4"></div>
                      </div>
                    </div>
                  </div>
                ) : primeiroAtendimentoStatus === 'criado' && primeiroAtendimentoGoogleDocsUrl ? (
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                        <FileText size={20} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                          1º Atendimento Gerado - v{primeiroAtendimentoVersion}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          O documento de Primeiro Atendimento {client?.type === 'PJ' ? 'PJ' : 'PF'} real foi localizado, preenchido e confirmado na pasta real do Google Drive.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1.5">
                      <a
                        href={primeiroAtendimentoGoogleDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold"
                      >
                        <ExternalLink size={13} />
                        Abrir 1º Atendimento
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(primeiroAtendimentoGoogleDocsUrl)}
                        className={`inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-black uppercase transition-all border shadow-3xs cursor-pointer font-bold ${
                          copied 
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                            : 'bg-white border-gray-250 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copied ? "Copiado!" : "Copiar Link"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={generatingDoc}
                        onClick={() => handleGeneratePrimeiroAtendimento('new_version')}
                        className="px-4.5 py-2 bg-white hover:bg-gray-50 border border-gray-250 text-slate-800 text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold disabled:opacity-50"
                      >
                        {generatingDoc ? "Gerando..." : "Gerar nova versão"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Motor Integrado info display */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs animate-fadeIn">
                      <p className="font-extrabold text-slate-700 uppercase tracking-widest text-[9px] font-mono flex items-center gap-1.5 align-middle">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span>Motor documental preparado para validar e executar geração real.</span>
                      </p>
                      <p className="text-slate-500 leading-normal text-[11px]">
                        A geração documental do primeiro atendimento está configurada e pronta para execução real, aguardando validação de pastas e arquivos fáticos.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        disabled={generatingDoc}
                        onClick={() => handleGeneratePrimeiroAtendimento('initial')}
                        className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer font-bold"
                      >
                        <Sparkles size={14} />
                        <span>Gerar 1º Atendimento</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Log Técnico da Automação */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Log Técnico da Automação (Motor de Geração de Google Docs)
                </span>

                {hasRealSuccess ? (
                  /* SUCESSO REAL */
                  <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-emerald-950 leading-relaxed">
                          ✅ 1º Atendimento criado com sucesso na pasta de destino: {nomeRealDoCliente}.
                        </h4>
                        <p className="text-xs text-emerald-800 font-semibold">
                          Documento salvo no Google Drive e vinculado ao caso em {techTimestamp ? new Date(techTimestamp).toLocaleString() : new Date().toLocaleString()}.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : primeiroAtendimentoStatus === 'falha' ? (
                  /* FALHA REAL */
                  <div className="p-5 bg-red-50 border border-red-150 rounded-2xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-100 rounded-xl text-red-800 shrink-0">
                        <X size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-red-950 leading-relaxed">
                          ❌ Não foi possível criar o 1º Atendimento na pasta de destino: {nomeRealDoCliente}.
                        </h4>
                        <p className="text-xs font-extrabold text-red-900 mt-2">
                          Motivo: {translateErrorCode(caseObj?.primeiroAtendimentoLastErrorCode, primeiroAtendimentoLogFalha)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* SEM OPERAÇÃO RECENTE OU EM ESPERA */
                  <div className="p-4 bg-gray-50 text-gray-400 rounded-xl border border-gray-150 font-mono text-xs italic text-center">
                    Área técnica reservada para saída de logs. Atualmente limpa e pronta para receber o espelhamento do build.
                  </div>
                )}

                {/* DETALHES TÉCNICOS COMPLEMENTARES - EXIBIR SOMENTE QUANDO EXISTIR */}
                {(techCode || techTimestamp || techDocId || techDocVer) && (primeiroAtendimentoStatus === 'criado' || primeiroAtendimentoStatus === 'falha') && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-xs font-mono space-y-1.5">
                    <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider font-sans mb-1">
                      Detalhes técnicos
                    </p>
                    <p>Código: <span className="font-bold text-slate-800">{techCode || 'N/A'}</span></p>
                    {techTimestamp && <p>Executado em: <span className="font-bold text-slate-850">{new Date(techTimestamp).toLocaleString()}</span></p>}
                    {techDocId && <p>Documento: <span className="font-bold text-indigo-700 select-all">{techDocId}</span></p>}
                    {primeiroAtendimentoStatus === 'criado' && <p>Versão: <span className="font-bold text-slate-800">{techDocVer}</span></p>}
                  </div>
                )}

                {/* Timeline de eventos técnicos de desenvolvimento, se houver log de auditoria */}
                {primeiroAtendimentoTechnicalLog && primeiroAtendimentoTechnicalLog.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-150/50">
                    <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider block pb-2">
                      Histórico de Eventos do Motor ({primeiroAtendimentoTechnicalLog.length} eventos)
                    </span>
                    
                    <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 font-mono text-xs leading-relaxed max-h-52 overflow-y-auto space-y-4 shadow-inner">
                      <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                        {primeiroAtendimentoTechnicalLog.map((log: any, idx: number) => {
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
                                <p className="text-slate-200 text-xs font-sans leading-normal font-medium">
                                  {log.message}
                                </p>
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

            {/* ACTION FOOTER */}
            <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
              
              <button
                type="button"
                onClick={() => navigate(flowRoutes.editarCadastroCliente(caseId))}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-250 hover:bg-gray-50 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-sm cursor-pointer"
              >
                <ArrowLeft size={16} />
                Voltar
              </button>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveOnly}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-blue-600 hover:bg-blue-50/50 text-blue-700 px-6 py-3 rounded-xl font-bold transition-all text-sm cursor-pointer"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Salvar rascunho</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveAndExit}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-250 text-gray-700 px-6 py-3 rounded-xl font-bold transition-all text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <span>Salvar e Sair</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveAndAdvance}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-950 hover:bg-black text-white px-8 py-3.5 rounded-xl font-bold transition-all text-sm cursor-pointer shadow-md"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando dados fáticos...</span>
                    </>
                  ) : (
                    <>
                      <span>Salvar e Avançar</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

              </div>
            </div>

          </div>
        )}
      </div>
      <UnsavedChangesModal />
    </FluxoStepLayout>
  );
}
