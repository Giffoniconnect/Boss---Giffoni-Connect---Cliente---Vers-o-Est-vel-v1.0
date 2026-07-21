import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

import { BossLayout } from '../../../components/Layout';
import { 
  FileText, 
  ArrowLeft, 
  Save, 
  Play, 
  AlertCircle, 
  Check, 
  X,
  Info,
  Layers,
  Scale,
  Briefcase,
  FileCheck,
  DollarSign,
  Fingerprint,
  Activity,
  Eye,
  EyeOff,
  Copy,
  Terminal,
  Settings,
  FolderOpen,
  RefreshCw
} from 'lucide-react';

const OFFICIAL_PROCURACAO_PF_TEMPLATE_ID = '16k_n_BTdf8wTCG8CK4T2TyAT93o5qrmZqjbROtrBqzk';
const OFFICIAL_PROCURACAO_PF_TEMPLATE_URL = `https://docs.google.com/document/d/${OFFICIAL_PROCURACAO_PF_TEMPLATE_ID}/edit?tab=t.0`;
const PROCURACAO_PF_PLACEHOLDER_SOURCE_ROUTE = '/boss-giffoni-clientes/fluxo-producao/:caseId/editar-cadastro-cliente';

interface TemplateRegistry {
  primeiro_atendimento: string;
  procuracao_pf: string;
  procuracao_pj: string;
  declaracao_pobreza_pf: string;
  declaracao_pobreza_pj: string;
  contrato_honorarios_pf: string;
  contrato_honorarios_pj: string;
  pre_peticao_judicial: string;
}

export default function GoogleDocsGeraisConfig() {
  const navigate = useNavigate();
  const { googleAccessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string | null } | null>(null);

  // Connection fields state
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [serviceAccountPrivateKey, setServiceAccountPrivateKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  
  // Visibility for private credentials inputs
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  // Credential override state
  const [credentialOverride, setCredentialOverride] = useState(() => {
    return localStorage.getItem('portal_boss_gdocs_override') || '';
  });

  const handleLoadAndParseOverrideJson = (jsonStr: string) => {
    setCredentialOverride(jsonStr);
    localStorage.setItem('portal_boss_gdocs_override', jsonStr);
    
    if (!jsonStr.trim()) return;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.client_email) setServiceAccountEmail(parsed.client_email);
      if (parsed.project_id) setProjectId(parsed.project_id);
      if (parsed.private_key) setServiceAccountPrivateKey(parsed.private_key);
    } catch (e) {
      // Quietly ignore parsing errors for manual entry
    }
  };

  const [validatedDetails, setValidatedDetails] = useState<{
    isValid: boolean;
    checked: boolean;
    error?: string;
  }>({ isValid: false, checked: false });

  const [testingOverrideAuth, setTestingOverrideAuth] = useState(false);

  const handlePasteOverrideJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleLoadAndParseOverrideJson(text);
      setFeedback({ type: 'success', message: 'JSON colado da área de transferência com sucesso!' });
    } catch (err) {
      const promptText = prompt("Cole o JSON de sua Service Account abaixo:");
      if (promptText) {
        handleLoadAndParseOverrideJson(promptText);
      }
    }
  };

  const handleClientSideValidateJson = () => {
    if (!credentialOverride.trim()) {
      setValidatedDetails({ isValid: false, checked: true, error: 'O campo JSON está vazio.' });
      setFeedback({ type: 'error', message: 'O campo JSON está vazio.' });
      return;
    }
    try {
      const parsed = JSON.parse(credentialOverride);
      if (!parsed.client_email) {
        setValidatedDetails({ isValid: false, checked: true, error: 'Falta a propriedade "client_email" no JSON.' });
        setFeedback({ type: 'error', message: 'Falta a propriedade "client_email" no JSON.' });
        return;
      }
      if (!parsed.private_key) {
        setValidatedDetails({ isValid: false, checked: true, error: 'Falta a propriedade "private_key" no JSON.' });
        setFeedback({ type: 'error', message: 'Falta a propriedade "private_key" no JSON.' });
        return;
      }
      setValidatedDetails({ isValid: true, checked: true });
      setFeedback({ type: 'success', message: 'Formato JSON e chaves obrigatórias validados com absoluto sucesso!' });
    } catch (e: any) {
      setValidatedDetails({ isValid: false, checked: true, error: `JSON inválido: ${e.message}` });
      setFeedback({ type: 'error', message: `JSON de formato inválido: ${e.message}` });
    }
  };

  const handleClearOverride = () => {
    handleLoadAndParseOverrideJson('');
    setValidatedDetails({ isValid: false, checked: false });
  };

  const handleTestGoogleOverrideAuth = async () => {
    if (!credentialOverride.trim()) {
      setFeedback({ type: 'error', message: 'Coloque e valide o JSON antes de testar a autenticação.' });
      return;
    }
    setTestingOverrideAuth(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/google-docs/test-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialOverride: {
            allowPreviewCredentialOverride: true,
            serviceAccountJson: credentialOverride
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCamadaZero(prev => ({ ...prev, googleAuth: 'ok' }));
        setFeedback({ type: 'success', message: 'Autenticação de Teste Google OK! Servidor aceitou chaves do override!' });
      } else {
        setCamadaZero(prev => ({ ...prev, googleAuth: 'error' }));
        setFeedback({ type: 'error', message: `O teste de autenticação falhou: ${data.errorMessage || 'Credenciais rejeitadas'}` });
      }
    } catch (e: any) {
      setCamadaZero(prev => ({ ...prev, googleAuth: 'error' }));
      setFeedback({ type: 'error', message: `Erro de comunicação: ${e.message}` });
    } finally {
      setTestingOverrideAuth(false);
    }
  };

  // Template Google Docs IDs state
  const [templates, setTemplates] = useState<TemplateRegistry>({
    primeiro_atendimento: '',
    procuracao_pf: OFFICIAL_PROCURACAO_PF_TEMPLATE_ID,
    procuracao_pj: '',
    declaracao_pobreza_pf: '',
    declaracao_pobreza_pj: '',
    contrato_honorarios_pf: '',
    contrato_honorarios_pj: '',
    pre_peticao_judicial: ''
  });

  // Recent cases loaded for Form Test
  const [casesList, setCasesList] = useState<any[]>([]);
  const [testDocumentType, setTestDocumentType] = useState<keyof TemplateRegistry>('procuracao_pf');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [customDocumentName, setCustomDocumentName] = useState('');
  const [testLogs, setTestLogs] = useState<any[]>([]);
  const [testSuccessUrl, setTestSuccessUrl] = useState<string | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  // Camada Zero State Definitions
  const [camadaZero, setCamadaZero] = useState<{
    firestore: 'pending' | 'ok' | 'error';
    googleAuth: 'pending' | 'ok' | 'error';
    driveApi: 'pending' | 'ok' | 'error';
    docsApi: 'pending' | 'ok' | 'error';
    template: 'pending' | 'ok' | 'error';
    folder: 'pending' | 'ok' | 'error';
    preflight: 'pending' | 'ok' | 'error';
  }>({
    firestore: 'pending',
    googleAuth: 'pending',
    driveApi: 'pending',
    docsApi: 'pending',
    template: 'pending',
    folder: 'pending',
    preflight: 'pending'
  });

  const [checkingCamadaZero, setCheckingCamadaZero] = useState(false);
  const [camadaCheckMessages, setCamadaCheckMessages] = useState<Record<string, string>>({});

  // Firebase Admin Health & Config states
  const [firebaseProject, setFirebaseProject] = useState('');
  const [firebaseDatabaseId, setFirebaseDatabaseId] = useState('');
  const [firebaseCredSource, setFirebaseCredSource] = useState('');
  const [firebaseLastError, setFirebaseLastError] = useState<string | null>(null);

  // Service Account configuration form
  const [fbSaJsonInput, setFbSaJsonInput] = useState('');
  const [fbDbIdInput, setFbDbIdInput] = useState('ai-studio-ffebafe8-f1b5-4749-87a5-7b28a5c05e6c');
  const [savingFbAdmin, setSavingFbAdmin] = useState(false);
  const [fbAdminErrorToCopy, setFbAdminErrorToCopy] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsContent, setDiagnosticsContent] = useState<any>(null);

  // Load configuration from Firebase on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const docRef = doc(db, 'settings', 'connectors');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const gdocsData = data?.googleDocs || {};
          
          setServiceAccountEmail(gdocsData.serviceAccountEmail || '');
          setServiceAccountPrivateKey(gdocsData.serviceAccountPrivateKey || '');
          setProjectId(gdocsData.projectId || '');
          setDriveFolderId(gdocsData.driveFolderId || gdocsData.folderId || '');
          
          if (gdocsData.templates) {
            setTemplates({
              primeiro_atendimento: gdocsData.templates.primeiro_atendimento || '',
              procuracao_pf: gdocsData.templates.procuracao_pf || OFFICIAL_PROCURACAO_PF_TEMPLATE_ID,
              procuracao_pj: gdocsData.templates.procuracao_pj || '',
              declaracao_pobreza_pf: gdocsData.templates.declaracao_pobreza_pf || '',
              declaracao_pobreza_pj: gdocsData.templates.declaracao_pobreza_pj || '',
              contrato_honorarios_pf: gdocsData.templates.contrato_honorarios_pf || '',
              contrato_honorarios_pj: gdocsData.templates.contrato_honorarios_pj || '',
              pre_peticao_judicial: gdocsData.templates.pre_peticao_judicial || ''
            });
          }
        }

        // Fetch recent cases to populate test dropdown list
        const casesSnap = await getDocs(query(collection(db, 'cases'), limit(15)));
        const items = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCasesList(items);
        if (items.length > 0) {
          setSelectedCaseId(items[0].id);
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: `Falha ao carregar configurações: ${err.message || err}`
        });
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const runCamadaZeroChecks = async () => {
    setCheckingCamadaZero(true);
    setCamadaCheckMessages({});
    
    setCamadaZero({
      firestore: 'pending',
      googleAuth: 'pending',
      driveApi: 'pending',
      docsApi: 'pending',
      template: 'pending',
      folder: 'pending',
      preflight: 'pending'
    });

    const messages: Record<string, string> = {};

    // 1. Firestore test
    try {
      const fsRes = await fetch('/api/system/firestore-health');
      const fsData = await fsRes.json();
      setDiagnosticsContent(fsData);
      if (fsRes.ok && fsData.success) {
        setCamadaZero(prev => ({ ...prev, firestore: 'ok' }));
        messages.firestore = `Conectado ao projeto ${fsData.projectId || 'BOSS'} [Banco: ${fsData.firestoreDatabaseId || '(default)'}]`;
        setFirebaseProject(fsData.projectId || '');
        setFirebaseDatabaseId(fsData.firestoreDatabaseId || '');
        setFirebaseCredSource(fsData.credentialSource || '');
        setFirebaseLastError(null);
        setFbAdminErrorToCopy(null);
      } else {
        setCamadaZero(prev => ({ ...prev, firestore: 'error' }));
        const errMsg = fsData.errorMessage || 'Falha de conexão Firestore';
        messages.firestore = `Erro: ${errMsg}`;
        setFirebaseLastError(errMsg);
        setFbAdminErrorToCopy(errMsg);
        if (fsData.firebaseAdminStatus) {
          setFirebaseProject(fsData.firebaseAdminStatus.projectId || '');
          setFirebaseDatabaseId(fsData.firebaseAdminStatus.firestoreDatabaseId || '');
          setFirebaseCredSource(fsData.firebaseAdminStatus.credentialSource || '');
        }
      }
    } catch (e: any) {
      setCamadaZero(prev => ({ ...prev, firestore: 'error' }));
      messages.firestore = `Erro de rede: ${e.message}`;
      setFirebaseLastError(e.message);
      setFbAdminErrorToCopy(e.message);
    }

    // 2. Google OAuth credentials
    try {
      const authRes = await fetch('/api/google-docs/test-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialOverride, googleAccessToken })
      });
      const authData = await authRes.json();
      if (authRes.ok && authData.success) {
        setCamadaZero(prev => ({ ...prev, googleAuth: 'ok' }));
        messages.googleAuth = `Chave ativa: ${authData.serviceAccountEmail || 'OK'} (${authData.credentialSource || 'carregado'})`;
      } else {
        setCamadaZero(prev => ({ ...prev, googleAuth: 'error' }));
        messages.googleAuth = `Erro: ${authData.errorMessage || 'Falha de login'}`;
      }
    } catch (e: any) {
      setCamadaZero(prev => ({ ...prev, googleAuth: 'error' }));
      messages.googleAuth = `Erro de rede: ${e.message}`;
    }

    // 3 & 4. APIs enabled check
    let targetTemplateIdForApiCheck = templates.procuracao_pf || OFFICIAL_PROCURACAO_PF_TEMPLATE_ID;
    try {
      const apiRes = await fetch('/api/google-docs/check-google-apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: targetTemplateIdForApiCheck, credentialOverride, googleAccessToken })
      });
      const apiData = await apiRes.json();
      if (apiRes.ok && apiData.success) {
        setCamadaZero(prev => ({ ...prev, driveApi: 'ok', docsApi: 'ok' }));
        messages.driveApi = 'API Google Drive ativada e conectável.';
        messages.docsApi = 'API Google Docs e escopos habilitados.';
      } else {
        setCamadaZero(prev => ({ ...prev, driveApi: 'error', docsApi: 'error' }));
        messages.driveApi = `Erro: ${apiData.errorMessage || 'Desabilitada'}`;
        messages.docsApi = `Erro: ${apiData.errorMessage || 'Desabilitada'}`;
      }
    } catch (e: any) {
      setCamadaZero(prev => ({ ...prev, driveApi: 'error', docsApi: 'error' }));
      messages.driveApi = `Erro: ${e.message}`;
      messages.docsApi = `Erro: ${e.message}`;
    }

    // 5. Template Access check
    const currentTemplateId = templates.procuracao_pf || OFFICIAL_PROCURACAO_PF_TEMPLATE_ID;
    if (currentTemplateId) {
      try {
        const templRes = await fetch('/api/google-docs/test-template-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: currentTemplateId, credentialOverride, googleAccessToken })
        });
        const templData = await templRes.json();
        if (templRes.ok && templData.success) {
          setCamadaZero(prev => ({ ...prev, template: 'ok' }));
          messages.template = `Leitura de "${templData.templateName || 'Procuração PF'}" confirmada!`;
        } else {
          setCamadaZero(prev => ({ ...prev, template: 'error' }));
          messages.template = `Erro: ${templData.errorMessage || 'Sem permissão de leitura'}`;
        }
      } catch (e: any) {
        setCamadaZero(prev => ({ ...prev, template: 'error' }));
        messages.template = `Erro de rede: ${e.message}`;
      }
    } else {
      setCamadaZero(prev => ({ ...prev, template: 'error' }));
      messages.template = 'Insira o ID do template no Bloco correspondente.';
    }

    // 6. Folder Write Access check
    const targetFolderId = driveFolderId || '1Yt-a7B9cd_ef1h2j3k4l5m6n7op_xxxx';
    if (targetFolderId) {
      try {
        const foldRes = await fetch('/api/google-docs/test-folder-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationFolderId: targetFolderId, credentialOverride, googleAccessToken })
        });
        const foldData = await foldRes.json();
        if (foldRes.ok && foldData.success) {
          setCamadaZero(prev => ({ ...prev, folder: 'ok' }));
          messages.folder = `Permissão de escrita em "${foldData.folderName || 'Pasta'}" confirmada!`;
        } else {
          setCamadaZero(prev => ({ ...prev, folder: 'error' }));
          messages.folder = `Erro: ${foldData.errorMessage || 'Sem permissão de gravação'}`;
        }
      } catch (e: any) {
        setCamadaZero(prev => ({ ...prev, folder: 'error' }));
        messages.folder = `Erro de rede: ${e.message}`;
      }
    } else {
      setCamadaZero(prev => ({ ...prev, folder: 'error' }));
      messages.folder = 'O ID da pasta de destino não está preenchido no Bloco 3.';
    }

    // 7. Core Preflight Check
    try {
      const targetCase = casesList.find(c => c.id === selectedCaseId) || (casesList.length > 0 ? casesList[0] : null);
      const preRes = await fetch('/api/google-docs/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: "stateless",
          templateId: currentTemplateId,
          destinationFolderId: targetFolderId,
          caseId: targetCase ? targetCase.id : (selectedCaseId || ''),
          clientId: targetCase ? (targetCase.clientId || targetCase.client?.id || targetCase.client_id || '') : '',
          credentialOverride,
          googleAccessToken
        })
      });
      const preData = await preRes.json();
      if (preRes.ok && preData.success) {
        setCamadaZero(prev => ({ ...prev, preflight: 'ok' }));
        messages.preflight = 'Preflight liberado! Toda a cadeia de saúde integrada está operacional.';
      } else {
        setCamadaZero(prev => ({ ...prev, preflight: 'error' }));
        messages.preflight = `Bloqueado no step [${preData.blockingStep || 'geral'}]: ${preData.errorMessage || 'Falha de pré-requisito'}`;
      }
    } catch (e: any) {
      setCamadaZero(prev => ({ ...prev, preflight: 'error' }));
      messages.preflight = `Erro de rede: ${e.message}`;
    }

    setCamadaCheckMessages(messages);
    setCheckingCamadaZero(false);
  };

  const handlePasteFbJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setFbSaJsonInput(text);
    } catch (err) {
      const text = prompt("Cole o JSON da sua Service Account aqui:");
      if (text) {
        setFbSaJsonInput(text);
      }
    }
  };

  const handleSaveAndValidateFbAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fbSaJsonInput.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, cole o JSON de suas credenciais Admin antes de validar.' });
      return;
    }

    setSavingFbAdmin(true);
    setFeedback(null);
    setFbAdminErrorToCopy(null);

    try {
      const response = await fetch('/api/system/save-firebase-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceAccountJsonString: fbSaJsonInput.trim(),
          firestoreDatabaseId: fbDbIdInput.trim()
        })
      });

      const data = await response.json();
      setDiagnosticsContent(data);

      if (response.ok && data.success) {
        setFeedback({
          type: 'success',
          message: 'Firebase Admin inicializado, salvo localmente e verificado com total sucesso factual!'
        });
        setCamadaZero(prev => ({ ...prev, firestore: 'ok' }));
        if (data.firebaseAdminStatus) {
          setFirebaseProject(data.firebaseAdminStatus.projectId || '');
          setFirebaseDatabaseId(data.firebaseAdminStatus.firestoreDatabaseId || '');
          setFirebaseCredSource(data.firebaseAdminStatus.credentialSource || '');
        }
        setFirebaseLastError(null);
        setTimeout(() => runCamadaZeroChecks(), 1500);
      } else {
        setCamadaZero(prev => ({ ...prev, firestore: 'error' }));
        const errMsg = data.errorMessage || 'Erro inesperado ao salvar.';
        setFirebaseLastError(errMsg);
        setFbAdminErrorToCopy(errMsg);
        setFeedback({
          type: 'error',
          message: `Falha na verificação do Firebase: ${errMsg}`
        });
      }
    } catch (err: any) {
      setCamadaZero(prev => ({ ...prev, firestore: 'error' }));
      setFirebaseLastError(err.message);
      setFbAdminErrorToCopy(err.message);
      setFeedback({
        type: 'error',
        message: `Falha de rede ao conectar com o backend: ${err.message}`
      });
    } finally {
      setSavingFbAdmin(false);
    }
  };

  const handleCheckFirestoreHealth = async () => {
    setCheckingCamadaZero(true);
    try {
      const fsRes = await fetch('/api/system/firestore-health');
      const fsData = await fsRes.json();
      setDiagnosticsContent(fsRes.ok ? fsData : { error: true, data: fsData });
      if (fsRes.ok && fsData.success) {
        setCamadaZero(prev => ({ ...prev, firestore: 'ok' }));
        setFirebaseProject(fsData.projectId || '');
        setFirebaseDatabaseId(fsData.firestoreDatabaseId || '');
        setFirebaseCredSource(fsData.credentialSource || '');
        setFirebaseLastError(null);
        setFbAdminErrorToCopy(null);
        setFeedback({ type: 'success', message: `Firebase Admin validado: ${fsData.message}` });
      } else {
        setCamadaZero(prev => ({ ...prev, firestore: 'error' }));
        setFeedback({ type: 'error', message: 'Falha de validação do Firebase Admin.' });
      }
    } catch (e: any) {
      setCamadaZero(prev => ({ ...prev, firestore: 'error' }));
      setFeedback({ type: 'error', message: 'Erro ao conectar ao barramento do Firestore.' });
    } finally {
      setCheckingCamadaZero(false);
    }
  };

  const handleTestGoogleAuth = async () => {
    setCheckingCamadaZero(true);
    try {
      const authRes = await fetch('/api/google-docs/test-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialOverride, googleAccessToken })
      });
      const authData = await authRes.json();
      if (authRes.ok && authData.success) {
        setCamadaZero(prev => ({ ...prev, googleAuth: 'ok' }));
        setFeedback({ type: 'success', message: `Google Auth conectado com sucesso: ${authData.serviceAccountEmail}` });
      } else {
        setCamadaZero(prev => ({ ...prev, googleAuth: 'error' }));
        setFeedback({ type: 'error', message: `Falha Google Auth: ${authData.errorMessage}` });
      }
    } catch (e) {
      setCamadaZero(prev => ({ ...prev, googleAuth: 'error' }));
    } finally {
      setCheckingCamadaZero(false);
    }
  };

  const handleTestDriveApi = async () => {
    setCheckingCamadaZero(true);
    try {
      const apiRes = await fetch('/api/google-docs/check-google-apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templates.procuracao_pf, credentialOverride, googleAccessToken })
      });
      const apiData = await apiRes.json();
      if (apiRes.ok && apiData.success) {
        setCamadaZero(prev => ({ ...prev, driveApi: 'ok', docsApi: 'ok' }));
        setFeedback({ type: 'success', message: 'Drive e Docs APIs ativas e aceitando tráfego.' });
      } else {
        setCamadaZero(prev => ({ ...prev, driveApi: 'error', docsApi: 'error' }));
        setFeedback({ type: 'error', message: `Chaves rejeitadas pelo console Google: ${apiData.errorMessage}` });
      }
    } catch (e) {
      setCamadaZero(prev => ({ ...prev, driveApi: 'error', docsApi: 'error' }));
    } finally {
      setCheckingCamadaZero(false);
    }
  };

  const handleTestDocsApi = handleTestDriveApi;

  const handleTestTemplateAccess = async () => {
    setCheckingCamadaZero(true);
    try {
      const templRes = await fetch('/api/google-docs/test-template-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templates.procuracao_pf, credentialOverride, googleAccessToken })
      });
      const templData = await templRes.json();
      if (templRes.ok && templData.success) {
        setCamadaZero(prev => ({ ...prev, template: 'ok' }));
        setFeedback({ type: 'success', message: `ID de Template validado com sucesso: "${templData.templateName}"` });
      } else {
        setCamadaZero(prev => ({ ...prev, template: 'error' }));
        setFeedback({ type: 'error', message: `Template invisível para as credenciais: ${templData.errorMessage}` });
      }
    } catch (e) {
      setCamadaZero(prev => ({ ...prev, template: 'error' }));
    } finally {
      setCheckingCamadaZero(false);
    }
  };

  const handleTestFolderAccess = async () => {
    setCheckingCamadaZero(true);
    try {
      const foldRes = await fetch('/api/google-docs/test-folder-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationFolderId: driveFolderId, credentialOverride, googleAccessToken })
      });
      const foldData = await foldRes.json();
      if (foldRes.ok && foldData.success) {
        setCamadaZero(prev => ({ ...prev, folder: 'ok' }));
        setFeedback({ type: 'success', message: `Pasta destino validada e com gravação ativa: "${foldData.folderName}"` });
      } else {
        setCamadaZero(prev => ({ ...prev, folder: 'error' }));
        setFeedback({ type: 'error', message: `Impossível gravar na pasta destino: ${foldData.errorMessage}` });
      }
    } catch (e) {
      setCamadaZero(prev => ({ ...prev, folder: 'error' }));
    } finally {
      setCheckingCamadaZero(false);
    }
  };

  const handleRunTestPreflight = async () => {
    setCheckingCamadaZero(true);
    try {
      const targetCase = casesList.find(c => c.id === selectedCaseId) || (casesList.length > 0 ? casesList[0] : null);
      const preRes = await fetch('/api/google-docs/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: "stateless",
          templateId: templates.procuracao_pf,
          destinationFolderId: driveFolderId,
          caseId: targetCase ? targetCase.id : (selectedCaseId || ''),
          clientId: targetCase ? (targetCase.clientId || targetCase.client?.id || targetCase.client_id || '') : '',
          credentialOverride,
          googleAccessToken
        })
      });
      const preData = await preRes.json();
      if (preRes.ok && preData.success) {
        setCamadaZero(prev => ({ ...prev, preflight: 'ok' }));
        setFeedback({ type: 'success', message: 'Preflight executado ponta a ponta com êxito!' });
      } else {
        setCamadaZero(prev => ({ ...prev, preflight: 'error' }));
        setFeedback({ type: 'error', message: `Bloqueado em preflight: ${preData.errorMessage}` });
      }
    } catch (e) {
      setCamadaZero(prev => ({ ...prev, preflight: 'error' }));
    } finally {
      setCheckingCamadaZero(false);
    }
  };

  const handleSaveCredentialsAndSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const docRef = doc(db, 'settings', 'connectors');
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};
      
      const newGoogleDocs = {
        ...(currentData.googleDocs || {}),
        serviceAccountEmail: serviceAccountEmail.trim(),
        serviceAccountPrivateKey: serviceAccountPrivateKey.trim(),
        projectId: projectId.trim(),
        driveFolderId: driveFolderId.trim(),
        templates: {
          ...((currentData.googleDocs || {}).templates || {}),
          ...templates
        }
      };

      await setDoc(docRef, {
        ...currentData,
        googleDocs: newGoogleDocs
      });

      setFeedback({
        type: 'success',
        message: 'Configurações Gerais gravadas com sucesso absoluto no Firestore!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha técnica ao salvar no Firebase: ${err.message || err}`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerTest = async () => {
    if (casesList.length === 0) {
      setFeedback({ type: 'error', message: 'Não há casos ativos carregados no banco para o teste fático.' });
      return;
    }
    setTestSuccessUrl(null);
    setIsRunningTest(true);
    setTestLogs([
      { step: "START", timestamp: new Date().toLocaleTimeString(), details: `Disparando fluxo stateless de teste real para o módulo [${testDocumentType}].` }
    ]);

    const addLog = (step: string, details: string) => {
      setTestLogs(prev => [...prev, { step, timestamp: new Date().toLocaleTimeString(), details }]);
    };

    try {
      const currentTemplateId = templates[testDocumentType] || OFFICIAL_PROCURACAO_PF_TEMPLATE_ID;
      const targetCase = casesList.find(c => c.id === selectedCaseId) || casesList[0];
      const targetClientId = targetCase.clientId || targetCase.client?.id || targetCase.client_id || '';

      addLog("READ", `Buscando e mapeando parâmetros do Caso: ${targetCase.clientName || targetCase.client?.nome || targetCase.id}.`);
      addLog("AUTH", "Preparando tokens de autenticação gdocs stateless e validando limites.");

      const response = await fetch('/api/google-docs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'stateless',
          templateId: currentTemplateId,
          destinationFolderId: driveFolderId,
          caseId: targetCase.id,
          clientId: targetClientId,
          customName: customDocumentName.trim() || `BOSS Teste - ${testDocumentType} - ${new Date().toLocaleDateString()}`,
          documentType: testDocumentType,
          credentialOverride,
          googleAccessToken
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        addLog("REPLACE", "Leitura e troca de marcadores operada pelo motor interno com sucesso!");
        addLog("DRIVE", `Arquivo criado com ID: ${result.googleDocId}. Pasta de destino confirmada.`);
        addLog("SUCCESS", "Integração validada perfeitamente. Histórico operacional atualizado!");
        setTestSuccessUrl(result.googleDocUrl);
        setFeedback({
          type: 'success',
          message: `Sucesso! Documento de teste real gerado no Drive!`
        });
      } else {
        addLog("ERROR", `Falha no motor: ${result.errorMessage || 'Falha de comunicação'}`);
        setFeedback({
          type: 'error',
          message: `Falha técnica na geração de teste: ${result.errorMessage || 'Verifique as permissões de gravação'}`
        });
      }
    } catch (e: any) {
      addLog("FATAL", `Falha de barramento: ${e.message}`);
      setFeedback({ type: 'error', message: `Erro fatal de rede: ${e.message}` });
    } finally {
      setIsRunningTest(false);
    }
  };

  const parsedOverrideInfo = (() => {
    if (!credentialOverride.trim()) {
      return {
        isValidJson: false,
        email: '',
        projectId: '',
        hasPrivateKey: false,
        privateKeyStatus: 'Ausente',
        error: ''
      };
    }
    try {
      const parsed = JSON.parse(credentialOverride);
      return {
        isValidJson: true,
        email: parsed.client_email || '',
        projectId: parsed.project_id || '',
        hasPrivateKey: !!parsed.private_key,
        privateKeyStatus: parsed.private_key ? (parsed.private_key.includes('PRIVATE KEY') ? 'PEM Válido (RS256)' : 'Formato incorreto') : 'Falta private_key',
        error: ''
      };
    } catch (e: any) {
      return {
        isValidJson: false,
        email: '',
        projectId: '',
        hasPrivateKey: false,
        privateKeyStatus: 'Erro no JSON',
        error: e.message
      };
    }
  })();

  const isProcuracaoUnlocked = 
    credentialOverride.trim() ? (camadaZero.googleAuth === 'ok' && camadaZero.driveApi === 'ok' && camadaZero.template === 'ok' && camadaZero.folder === 'ok') : true;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Copiado: ${text}`);
  };

  return (
    <BossLayout>
      <div className="space-y-8 font-sans max-w-7xl mx-auto pb-12 animate-fadeIn">
        
        {/* HEADER DE NAVEGAÇÃO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-6 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse shrink-0"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 font-mono">
                Google Cloud Workspace
              </span>
            </div>
            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              Configurações Gerais de Integração (GDI)
            </h1>
            <p className="text-xs text-gray-500 leading-normal max-w-3xl">
              Gerencie chaves mestre, diagnósticos da camada de saúde operacional, credenciais de contas de serviço e parametrizações comuns do motor de Google Docs.
            </p>
          </div>

          <button
            onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-xs font-black uppercase text-gray-700 rounded-xl transition shadow-xs cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Voltar ao Menu</span>
          </button>
        </div>

        {/* FEEDBACK STATUS ALERTS */}
        {feedback && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start justify-between ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-950 border border-emerald-250' : 'bg-rose-50 text-rose-950 border border-rose-220'
          }`}>
            <div className="flex items-start gap-2.5 text-left">
              <AlertCircle size={16} className={`shrink-0 mt-0.5 ${feedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>{feedback.message}</span>
            </div>
            <button type="button" onClick={() => setFeedback(null)} className="shrink-0">
              <X size={14} className="opacity-60 hover:opacity-100 cursor-pointer" />
            </button>
          </div>
        )}

        {/* HABILITAÇÃO DO AMBIENTE — CAMADA ZERO */}
        <div className="bg-white border border-gray-250 rounded-3xl overflow-hidden shadow-xs text-left">
          <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-900 font-sans">
                  Habilitação do Ambiente (Camada Zero)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">
                  Painel interativo e fático de validação de dependências, chaves privadas e APIs integradas.
                </p>
              </div>
            </div>
            <button
              onClick={runCamadaZeroChecks}
              disabled={checkingCamadaZero}
              type="button"
              className="flex items-center gap-2 p-2 px-4 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
            >
              {checkingCamadaZero ? 'Orquestrando Testes...' : 'Rodar Diagnóstico Geral'}
            </button>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-gray-50/20">
            
            {/* CARD 1: Firebase Admin Diagnostics */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.firestore === 'ok' ? 'border-emerald-250 ring-2 ring-emerald-50/50' : 'border-amber-200 bg-amber-50/5'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 1 / Firestore</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.firestore === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {camadaZero.firestore === 'ok' ? 'Ativo' : 'Pendente'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">Firebase Admin</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium">
                  Requerido para salvar as variáveis de produção no banco central unificado do servidor.
                </p>
                
                <div className="space-y-2 text-[10px] text-gray-600 font-mono">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <span className="text-[9px] text-gray-400 block font-sans uppercase">Project ID</span>
                    <span className="break-all font-medium text-gray-800">{firebaseProject || "ai-studio-ffebafe8-f1b5-4749-87a5-7b28a5c05e6c"}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <span className="text-[9px] text-gray-400 block font-sans uppercase">Database ID</span>
                    <span className="break-all font-medium text-gray-800">{firebaseDatabaseId || "(default)"}</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleCheckFirestoreHealth}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl hover:bg-indigo-50 transition"
              >
                Testar Firestore
              </button>
            </div>

            {/* CARD 2: Service Account Override JSON config */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between shadow-xs hover:shadow-sm transition">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 2 / Admin SA</span>
                  <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 p-0.5 px-2 rounded-full">JSON ADMIN</span>
                </div>
                <h3 className="text-xs font-bold text-gray-950 mb-1">Firebase Credentials</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-2 font-medium">
                  Chave administrativa para leitura/gravação de tokens persistentes do conector.
                </p>

                <div className="space-y-2">
                  <textarea
                    value={fbSaJsonInput}
                    onChange={(e) => setFbSaJsonInput(e.target.value)}
                    placeholder='{ "type": "service_account", ... }'
                    rows={2}
                    className="w-full text-[10px] font-mono p-2 bg-slate-50 border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-350 text-slate-800"
                  />
                  <input
                    type="text"
                    value={fbDbIdInput}
                    onChange={(e) => setFbDbIdInput(e.target.value)}
                    placeholder="database-id"
                    className="w-full text-[10px] font-mono p-1 px-2 bg-slate-50 border border-slate-250 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  onClick={handlePasteFbJson}
                  type="button"
                  className="p-1.5 text-[10px] font-bold bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  Colar
                </button>
                <button
                  onClick={() => handleSaveAndValidateFbAdmin()}
                  disabled={savingFbAdmin}
                  type="button"
                  className="p-1.5 text-[10px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>

            {/* CARD 3: Google Docs / Drive Auth */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.googleAuth === 'ok' ? 'border-emerald-250 ring-2 ring-emerald-50/50' : 'border-rose-200 ring-2 ring-rose-50/50'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 3 / Auth</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.googleAuth === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {camadaZero.googleAuth === 'ok' ? 'Autorizado' : 'Inativo'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">GCP Service Account</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium font-sans">
                  Serviço de autenticação JWT para acesso às APIs do Google Workspace.
                </p>
                <div className="bg-gray-50 p-2 rounded-lg text-[10px] font-mono break-all text-gray-600">
                  {serviceAccountEmail || "(Pendente de Configuração)"}
                </div>
              </div>
              <button
                onClick={handleTestGoogleAuth}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl hover:bg-indigo-50 transition"
              >
                Testar Google Auth
              </button>
            </div>

            {/* CARD 4: Google Drive API Status */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.driveApi === 'ok' ? 'border-emerald-250 ring-2 ring-emerald-50/50' : 'border-rose-200 bg-rose-50/5'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 4 / Drive</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.driveApi === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {camadaZero.driveApi === 'ok' ? 'OK' : 'Desabilitado'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">Google Drive API</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium">
                  Responsável pelo download dos modelos do cliente e organização das pastas.
                </p>
                <div className="bg-gray-50 p-2 rounded-lg text-[9px] font-mono text-gray-500 leading-normal min-h-[36px]">
                  {camadaCheckMessages.driveApi || "Aguardando diagnóstico geral de integridade."}
                </div>
              </div>
              <button
                onClick={handleTestDriveApi}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl hover:bg-indigo-50 transition"
              >
                Testar Drive API
              </button>
            </div>

          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-gray-50/20 border-t border-gray-150">
            
            {/* CARD 5: Google Docs API */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.docsApi === 'ok' ? 'border-emerald-250 ring-2 ring-emerald-50/50' : 'border-rose-200 bg-rose-50/5'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 5 / Docs</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.docsApi === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {camadaZero.docsApi === 'ok' ? 'OK' : 'Inativa'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">Google Docs API</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium select-none">
                  Responsável por ler os placeholders e trocá-los faticamente.
                </p>
                <div className="bg-gray-50 p-2 rounded-lg text-[9px] font-mono text-gray-500 leading-normal min-h-[36px]">
                  {camadaCheckMessages.docsApi || "Status de resposta pendente de requisição."}
                </div>
              </div>
              <button
                onClick={handleTestDocsApi}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl hover:bg-indigo-50 transition"
              >
                Testar Docs API
              </button>
            </div>

            {/* CARD 6: Model access */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.template === 'ok' ? 'border-emerald-250 ring-2 ring-emerald-50/50' : 'border-rose-200 bg-rose-50/5'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 6 / Modelo</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.template === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {camadaZero.template === 'ok' ? 'Ativo' : 'Pendente'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">Modelo de Teste (Procuração PF)</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium select-none">
                  Garante que o ID de teste do modelo oficial está aberto para leitura.
                </p>
                <div className="bg-gray-50 p-2 rounded-lg text-[9px] font-mono text-gray-500 leading-normal min-h-[36px] break-all">
                  {templates.procuracao_pf || "OFFICIAL_TEMPLATE_ID"}
                </div>
              </div>
              <button
                onClick={handleTestTemplateAccess}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl hover:bg-indigo-50 transition"
              >
                Testar Modelo PF
              </button>
            </div>

            {/* CARD 7: Destination Drive Folder access */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.folder === 'ok' ? 'border-emerald-250 ring-2 ring-emerald-50/50' : 'border-rose-200 bg-rose-50/5'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 7 / Armazenamento</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.folder === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {camadaZero.folder === 'ok' ? 'Liberado' : 'Bloqueado'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">Pasta Raiz (Drive Output)</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium select-none">
                  Valida se as contas administrativas possuem acesso de gravação.
                </p>
                <div className="bg-gray-50 p-2 rounded-lg text-[9px] font-mono text-gray-500 leading-normal min-h-[36px] break-all">
                  {driveFolderId || "(Pasta não parametrizada)"}
                </div>
              </div>
              <button
                onClick={handleTestFolderAccess}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl hover:bg-indigo-50 transition"
              >
                Testar Pasta do Drive
              </button>
            </div>

            {/* CARD 8: Preflight Pipeline */}
            <div className={`p-5 rounded-2xl border bg-white flex flex-col justify-between shadow-xs transition hover:shadow-sm ${
              camadaZero.preflight === 'ok' ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-gray-200'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">Card 8 / Cadeia Preflight</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    camadaZero.preflight === 'ok' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {camadaZero.preflight === 'ok' ? 'Sincronizado' : 'Inativo'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-gray-900 mb-1">Simulador de Integridade</h3>
                <p className="text-[11px] text-gray-400 leading-normal mb-3 font-medium select-none">
                  Execução ponta a ponta simulada faticamente sem criar arquivos de perda.
                </p>
                <div className="bg-gray-50 p-2 rounded-lg text-[9px] font-mono text-gray-500 leading-normal min-h-[36px]">
                  {camadaCheckMessages.preflight || "Pré-requisito geral pronto para orquestração fática."}
                </div>
              </div>
              <button
                onClick={handleRunTestPreflight}
                type="button"
                className="mt-4 w-full text-center p-2 text-xs font-bold text-white bg-indigo-650 rounded-xl hover:bg-indigo-700 transition"
              >
                Orquestrar Preflight
              </button>
            </div>

          </div>

          {/* TELEMETRIA DE CONSOLE DIAGNÓSTICO */}
          <div className="p-6 bg-slate-900 border-t border-slate-950 text-slate-300 font-mono text-xs flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h4 className="text-indigo-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                Console de telemetria da camada de saúde operacional (Fático):
              </h4>
              <button 
                onClick={() => {
                  setShowDiagnostics(!showDiagnostics);
                  if(!diagnosticsContent) runCamadaZeroChecks();
                }} 
                className="text-[10px] bg-slate-800 border border-slate-700 text-indigo-300 px-3 py-1 rounded hover:bg-slate-750 hover:text-white"
              >
                {showDiagnostics ? '[ Ocultar Telemetria ]' : '[ Carregar Telemetria ]'}
              </button>
            </div>
            {showDiagnostics && (
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56 p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-[10px]">
                {diagnosticsContent ? JSON.stringify(diagnosticsContent, null, 2) : "Nenhum dado carregado. Rode o 'Diagnóstico Geral' para alimentar a telemetria."}
              </pre>
            )}
          </div>
        </div>

        {/* BLOCO 1: MOTOR GOOGLE DOCS INTERNO */}
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs text-left">
          <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-emerald-600 animate-spin" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-950">
                  BLOCO 1 — Motor Google Docs Interno
                </h2>
                <p className="text-xs text-gray-400 font-medium">
                  Geração nativa de minutas e automações com barramento protegido e stateless.
                </p>
              </div>
            </div>
            <span className="p-1 px-2.5 text-[10px] font-mono bg-emerald-100 text-emerald-800 rounded font-bold animate-pulse">
              Ativo &amp; Operacional
            </span>
          </div>
          <div className="p-6">
            <p className="text-xs text-gray-650 leading-relaxed font-medium">
              As automações de Google Docs deixaram de depender de qualquer serviço externo de proxy (como GDI legados) e agora executam diretamente através de requisições de servidores node integrados do Portal. O processamento suporta cópias simultâneas em segundo plano, substituição instantânea de tags, salvamento unificado e rastreabilidade total de logs em tempo real.
            </p>
          </div>
        </div>

        {/* FORMULÁRIO PRINCIPAL */}
        <form onSubmit={handleSaveCredentialsAndSettings} className="space-y-8 text-left">

          {/* BLOCO 2: CREDENCIAIS GOOGLE */}
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-950">
                  BLOCO 2 — Credenciais Google
                </h2>
                <p className="text-xs text-gray-400 font-medium pb-0.5">
                  Especificações de acesso da Conta de Serviço Google Cloud Platform do escritório.
                </p>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Sandbox override card */}
              <div className="bg-slate-50 border border-indigo-150 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 uppercase">
                        Sandbox Override de Credenciais (Navegador Local)
                      </h3>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Coloque um service_account.json temporário para validações instantâneas.
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 border border-indigo-200 rounded font-bold uppercase">
                    Stateless mode
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Service Account JSON
                        </label>
                        <div className="flex gap-1.5 text-[9px] font-bold">
                          <button
                            type="button"
                            onClick={handlePasteOverrideJson}
                            className="bg-white border text-gray-600 border-gray-200 p-1 px-2 rounded hover:bg-gray-100 transition"
                          >
                            Colar JSON
                          </button>
                          <button
                            type="button"
                            onClick={handleClientSideValidateJson}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-1 px-2 rounded hover:bg-emerald-100 transition"
                          >
                            Validar JSON
                          </button>
                          <button
                            type="button"
                            onClick={handleClearOverride}
                            className="bg-rose-50 text-rose-705 border border-rose-200 p-1 px-2 rounded hover:bg-rose-100 transition"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                      
                      <textarea
                        value={credentialOverride}
                        onChange={(e) => handleLoadAndParseOverrideJson(e.target.value)}
                        placeholder='Cole o arquivo JSON de Conta de Serviço: { "type": "service_account", "project_id": "...", ... }'
                        className="w-full font-mono text-[10px] p-3 border border-gray-200 bg-white rounded-xl focus:outline-none focus:border-indigo-500 h-28"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleTestGoogleOverrideAuth}
                      disabled={testingOverrideAuth}
                      className="p-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 transition"
                    >
                      {testingOverrideAuth ? "Testando..." : "Testar Chave do Override"}
                    </button>
                  </div>

                  <div className="bg-white p-4 border border-gray-200 rounded-xl space-y-2.5 text-xs font-medium">
                    <h4 className="text-[10px] font-bold uppercase text-gray-400">Metadados lidos do JSON colado:</h4>
                    
                    <div className="space-y-2 text-[10px]">
                      <div>
                        <span className="text-gray-400 block uppercase text-[9px] font-mono">E-mail:</span>
                        <p className="font-mono text-gray-700 break-all bg-gray-50 p-1 rounded-md">{parsedOverrideInfo.email || "Não detectado"}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase text-[9px] font-mono">Project ID:</span>
                        <p className="font-mono text-gray-700 bg-gray-50 p-1 rounded-md">{parsedOverrideInfo.projectId || "Não detectado"}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase text-[9px] font-mono">Private Key status:</span>
                        <p className="font-mono text-gray-750 bg-gray-50 p-1 rounded-md">{parsedOverrideInfo.privateKeyStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form fields for GCP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Service Account Email (E-mail do Robô Google)
                  </label>
                  <input 
                    type="email"
                    value={serviceAccountEmail}
                    onChange={(e) => setServiceAccountEmail(e.target.value)}
                    placeholder="gdocs-service@agency.iam.gserviceaccount.com"
                    className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:border-indigo-505 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    Importante: Conceda a este robô a permissão de &quot;Editor&quot; na pasta de saída e &quot;Leitor&quot; nos templates.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Google Cloud Project ID
                  </label>
                  <input 
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="agency-portal-boss-3942"
                    className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:border-indigo-550 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-medium font-sans">
                    Identificador de infraestrutura do console GCP correspondente.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Chave Privada Google SA (RS256 Private Key)
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="text-xs font-bold text-indigo-650 hover:text-indigo-800 flex items-center gap-1.5 transition"
                  >
                    {showPrivateKey ? 'Mascarar chave' : 'Revelar chave'}
                  </button>
                </div>
                <textarea 
                  value={serviceAccountPrivateKey}
                  onChange={(e) => setServiceAccountPrivateKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD..."
                  className="w-full font-mono text-xs p-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none h-28 leading-relaxed"
                  style={!showPrivateKey ? { WebkitTextSecurity: 'disc' } as any : {}}
                  required
                />
              </div>

            </div>
          </div>

          {/* BLOCO 3: CONFIGURAÇÕES COMUNS */}
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-950">
                  BLOCO 3 — Configurações comuns
                </h2>
                <p className="text-xs text-gray-400 font-medium">
                  Configure a pasta raiz mestre de saída e caminhos regulatórios do Drive.
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-70 dimensions uppercase tracking-wider mb-2">
                  ID Global da Pasta de Destino (Google Drive Folder ID)
                </label>
                <input 
                  type="text"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  placeholder="ID da pasta padrão ex: 1Yt-a7B9cd_ef1h2j3k4l5m6n7op_xxxx"
                  className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Esta será a pasta global utilizada para criar o documento do cliente caso o processo dele não possua um diretório cadastrado.
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-150 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 p-2.5 px-6 font-bold text-xs uppercase tracking-wider text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" /> 
                <span>Salvar Configurações Gerais</span>
              </button>
            </div>
          </div>

        </form>

        {/* BLOCO 5: PLACEHOLDERS GLOBAIS */}
        <div className="bg-white border border-gray-250 rounded-3xl overflow-hidden shadow-xs text-left">
          <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-950">
                BLOCO 5 — Placeholders Globais
              </h2>
              <p className="text-xs text-gray-400 font-medium pb-0.5">
                Variáveis estáticas comuns estruturadas substituídas automaticamente em todos os documentos.
              </p>
            </div>
          </div>
          
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-150 text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 text-left">Token Placeholder</th>
                    <th className="py-3 px-4 text-left">Classe de Origem / Valor Padrão</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  <tr className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-indigo-600 font-bold">{"{{DATA_ATUAL}}"}</td>
                    <td className="py-3 px-4 text-gray-650 font-sans">Data da geração formatada (Exemplo: 6 de junho de 2026)</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => copyToClipboard("{{DATA_ATUAL}}")} 
                        className="p-1 px-3 bg-gray-50 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded transition font-bold"
                      >
                        Copiar
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-indigo-600 font-bold">{"{{CIDADE_ASSINATURA}}"}</td>
                    <td className="py-3 px-4 text-gray-650 font-sans">Cidade sede de emissão: Viçosa, MG</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => copyToClipboard("{{CIDADE_ASSINATURA}}")} 
                        className="p-1 px-3 bg-gray-50 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded transition font-bold"
                      >
                        Copiar
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-indigo-600 font-bold">{"{{ADVOGADO_NOME}}"}</td>
                    <td className="py-3 px-4 text-gray-650 font-sans">Nome do advogado principal: RODRIGO GIFFONI RODRIGUES</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => copyToClipboard("{{ADVOGADO_NOME}}")} 
                        className="p-1 px-3 bg-gray-50 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded transition font-bold"
                      >
                        Copiar
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-indigo-600 font-bold">{"{{ADVOGADO_OAB}}"}</td>
                    <td className="py-3 px-4 text-gray-650 font-sans">Registro de Ordem dos Advogados: OAB/MG 157.320</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => copyToClipboard("{{ADVOGADO_OAB}}")} 
                        className="p-1 px-3 bg-gray-50 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded transition font-bold"
                      >
                        Copiar
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-indigo-600 font-bold">{"{{ESCRITORIO_NOME}}"}</td>
                    <td className="py-3 px-4 text-gray-650 font-sans">Giffoni Connect</td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => copyToClipboard("{{ESCRITORIO_NOME}}")} 
                        className="p-1 px-3 bg-gray-50 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded transition font-bold"
                      >
                        Copiar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BLOCO 7: SIMULAÇÃO E TESTES REAIS */}
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs text-left">
          <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex items-center gap-3">
            <Play className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-950">
                BLOCO 7 — Geração de Testes Fáticos
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Execute geração fática contra a API com um caso teste real para validar chaves operativas.
              </p>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-705 uppercase tracking-wider mb-2">
                  1. Módulo Operacional
                </label>
                <select 
                  value={testDocumentType} 
                  onChange={(e) => setTestDocumentType(e.target.value as any)}
                  className="w-full text-xs p-3 border border-gray-200 focus:outline-none rounded-xl bg-white"
                >
                  <option value="primeiro_atendimento">1º Atendimento</option>
                  <option value="procuracao_pf">Procuração PF</option>
                  <option value="procuracao_pj">Procuração PJ</option>
                  <option value="declaracao_pobreza_pf">Declaração de Pobreza PF</option>
                  <option value="declaracao_pobreza_pj">Declaração de Pobreza PJ</option>
                  <option value="contrato_honorarios_pf">Contrato de Honorários PF</option>
                  <option value="contrato_honorarios_pj">Contrato de Honorários PJ</option>
                  <option value="pre_peticao_judicial">Pré-Petição / Minutas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-705 uppercase tracking-wider mb-2">
                  2. Selecione um caso para teste
                </label>
                <select 
                  value={selectedCaseId} 
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full text-xs p-3 border border-gray-200 focus:outline-none rounded-xl"
                  required
                >
                  {casesList.length === 0 ? (
                    <option value="">Carregando casos no banco...</option>
                  ) : (
                    casesList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.clientName || c.client?.nome || `Caso #${c.id.slice(0, 8)}`} - Assunto: {c.assunto || "(vazio)"}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-705 uppercase tracking-wider mb-2">
                  3. Nome do Arquivo Resultante
                </label>
                <input 
                  type="text"
                  value={customDocumentName}
                  onChange={(e) => setCustomDocumentName(e.target.value)}
                  placeholder="BOSS Teste - Procuracao Rodrigo Giffoni"
                  className="w-full text-xs p-3 border border-gray-200 focus:outline-none rounded-xl"
                />
              </div>

            </div>

            <div className="pt-4 border-t border-gray-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  type="button" 
                  onClick={handleTriggerTest}
                  disabled={isRunningTest || casesList.length === 0 || !isProcuracaoUnlocked}
                  className="flex items-center gap-2 p-3 px-6 font-bold text-xs uppercase tracking-wider text-white bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-xs cursor-pointer"
                >
                  {isRunningTest ? "Gerando Documento..." : "Gerar Documento de Teste"}
                </button>

                {testSuccessUrl && (
                  <a 
                    href={testSuccessUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2.5 px-5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> 
                    <span>Abrir Documento Gerado</span>
                  </a>
                )}
              </div>

              {!isProcuracaoUnlocked && (
                <div className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2 max-w-lg leading-relaxed select-none">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    <strong>Pré-requisitos pendentes:</strong> Preencha a SA no override ou tenha chaves válidas configuradas, obtenha Autenticação OK, Template acessível e pasta gravável.
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* BLOCO 8: TERMINAL DE LOGS */}
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs text-left font-mono">
          <div className="p-6 border-b border-gray-150 bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-gray-700" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-950 font-sans">
                  BLOCO 8 — Logs e Auditoria do Motor
                </h2>
                <p className="text-xs text-gray-400 font-medium font-sans mt-0.5">
                  Histórico de telemetria das etapas percorridas na automação de templates.
                </p>
              </div>
            </div>
            {testLogs.length > 0 && (
              <button 
                onClick={() => setTestLogs([])}
                className="text-[10px] text-gray-400 hover:text-gray-600 font-sans font-bold uppercase cursor-pointer"
              >
                Limpar Logs
              </button>
            )}
          </div>
          
          <div className="p-6 bg-slate-900 border-t border-slate-950 text-slate-300 text-xs min-h-36 leading-6">
            {testLogs.length === 0 ? (
              <span className="text-slate-500 select-none text-[11px]">
                [Logs de atividade vazios] Dispare a geração de teste real acima para carregar o rastreador de passos...
              </span>
            ) : (
              <div className="space-y-3 text-[11px]">
                {testLogs.map((log, index) => (
                  <div key={index} className="border-l-2 border-indigo-500 pl-3 py-1 bg-slate-950/40 rounded-r-lg">
                    <span className="text-indigo-400 font-black">[{log.step}]</span>
                    <span className="text-slate-500 text-[9px] ml-2 font-mono">({log.timestamp})</span>
                    <p className="text-slate-300 font-sans mt-0.5">{log.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BLOCO 9: LEGADO GDI DESATIVADO */}
        <div className="bg-white border border-rose-200 rounded-3xl overflow-hidden shadow-xs text-left">
          <div className="p-6 border-b border-rose-100 bg-rose-50/30 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <X className="w-5 h-5 text-rose-600" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-rose-955">
                  BLOCO 9 — Legado GDI desativado
                </h2>
                <p className="text-xs text-rose-700/80 font-medium">
                  Informações sobre a desvinculação completa de dependências de proxy externas.
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 text-xs text-rose-800 leading-relaxed font-mono space-y-3">
            <p>
              A antiga API de proxy externa GDI (<code className="bg-rose-50 p-0.5 rounded text-rose-700">https://giffoniconnect.como.br</code>) e suas chaves (<code className="bg-rose-50 p-0.5 rounded text-rose-700">X-BOSS-Google-Docs-Integration-Key</code>) foram desativadas e desvinculadas das operações fáticas do portal. A fila de Webhooks operantes para auditoria (<code className="bg-rose-50 p-0.5 rounded text-rose-700">/api/webhook/gdi-job</code>) agora é tratada diretamente pela central interna do Portal.
            </p>
            <p className="font-bold text-[11px] text-rose-900">
              ✓ Nenhuma requisição operacional externa trafega no servidor para segurança absoluta.
            </p>
          </div>
        </div>

      </div>
    </BossLayout>
  );
}
