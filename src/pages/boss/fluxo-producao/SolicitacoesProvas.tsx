import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { LOCAL_FALLBACK_TEMPLATES } from '../Configuracoes';
import FluxoStepLayout from './components/FluxoStepLayout';
import { 
  ArrowLeft, ArrowRight, Save, Info, Plus, Edit2, Check, AlertTriangle, 
  Clock, FileText, Loader2, AlertCircle, Archive, RefreshCw, 
  FileCheck2, HardDrive, CheckCircle, ChevronDown, ChevronRight, 
  Trash2, UploadCloud, FileSearch, Send, Mail
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

interface EvidenceRequest {
  id: string;
  caseId: string;
  clientId: string;
  clientSlug: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pendente' | 'enviado' | 'em_analise' | 'aprovado' | 'rejeitado' | 'complemento_solicitado' | 'arquivado';
  visibleToClient: boolean;
  allowUpload: boolean;
  expectedFileTypes: string[];
  maxFiles: number;
  documentNumber?: string;
  justification?: string;
  documentType?: string;
  generatedFileName?: string;
  evidenceType?: string;
  periciaType?: string;
  hireTechnicalAssistant?: string;
  createdAt: string;
  updatedAt: string;
}

const formatSimNao = (o: string) => o === 'sim' ? 'sim ✅' : o === 'nao' ? 'não ❌' : o;

export default function SolicitacoesProvas() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  // Root screen states
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Entities
  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [requests, setRequests] = useState<EvidenceRequest[]>([]);
  const [docTemplates, setDocTemplates] = useState<any[]>([]);

  // Wizard state structure
  const [wizardState, setWizardState] = useState<any>({
    currentStep: 1,
    q1_1: 'nao', q1_2: [], q1_2_outro: '', q1_3: 'nao', q1_4: 'nao', q1_5: 'nao', q1_6: 'nao', procuracaoFiles: [],
    q2_1: 'nao', q2_2: 'nao', q2_3: [], q2_3_outro: '', q2_4: 'nao', q2_5: 'nao', q2_6: 'nao', q2_7: 'nao', declaracaoFiles: [],
    q3_1: 'nao', q3_2: '', q3_2_outro: '', q3_3: [], q3_3_outro: '', q3_4: 'nao', q3_5: 'nao', q3_6: 'nao', q3_7: 'nao', q3_8: 'nao', contratoFiles: [],
    q4_rg: '', q4_cpf: '', q4_residencia: '', q4_anexar_pf: '', rgFiles: [], cpfFiles: [], residenciaFiles: [],
    q4_cnpj: '', q4_contrato_social: '', q4_endereco_sede: '', q4_rg_socio: '', q4_cpf_socio: '', q4_residencia_socio: '', q4_anexar_pj: '',
    cnpjFiles: [], contratoSocialFiles: [], enderecoSedeFiles: [], rgSocioFiles: [], cpfSocioFiles: [], residenciaSocioFiles: [],
    q5_1: '', q5_provas: {}, q5_y_pendentes: '', q5_z_solicitacao_automatica: '', q5_z_channels: [],
    q6_7_1: '', q6_7_2: '', q6_7_3: '', q6_7_4: '', q6_8_channels: [],
    step1_completed: false, step2_completed: false, step3_completed: false, step4_completed: false, step5_completed: false, step6_completed: false
  });

  const [currentUploadingField, setCurrentUploadingField] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  // Adding Custom Evidence Form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDocNumber, setFormDocNumber] = useState('');
  const [typePdf, setTypePdf] = useState(true);
  const [typeAudio, setTypeAudio] = useState(false);
  const [typeVideo, setTypeVideo] = useState(false);

  // Computed data
  const tipoCliente = client?.type;
  const isPF = tipoCliente === 'PF';
  const isPJ = tipoCliente === 'PJ';
  const tipoClienteValido = isPF || isPJ;

  const temPjDadosEmpresa = !!(
    (client?.pjDadosEmpresa && Object.keys(client.pjDadosEmpresa).some(k => !!client.pjDadosEmpresa[k])) ||
    (client?.pjData && Object.keys(client.pjData).some(k => !!client.pjData[k]))
  );

  const temDadosMinimosPJ = !!(
    (client?.pjDadosEmpresa?.pj_razaoSocial || client?.pjData?.pj_razaoSocial) &&
    (client?.pjDadosEmpresa?.pj_cnpj || client?.pjDadosEmpresa?.cnpj || client?.pjData?.pj_cnpj || client?.pjData?.cnpj)
  );

  const clientName = client 
    ? (isPF 
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome') 
        : isPJ 
          ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Sem Razão Social')
          : 'Tipo de cliente indefinido/inconsistente'
      )
    : '';
  const clientSlug = client?.slug || '';
  const driveFolderId = client?.googleDriveClientFolderId || client?.gdriveFolderId || caseObj?.gdriveFolderId || '';
  const driveFolderUrl = client?.googleDriveClientFolderUrl || client?.gdriveFolderUrl || caseObj?.gdriveFolderUrl || '';
  const hasDriveFolder = !!driveFolderId;

  // Load backend configurations
  useEffect(() => {
    if (!caseId) {
      setError('Identificador do caso correspondente ausente.');
      setFetching(false);
      return;
    }

    async function loadData() {
      try {
        const caseSnap = await getDoc(doc(db, 'cases', caseId!));
        if (!caseSnap.exists()) {
          setError(`Caso referenciado por ID [${caseId}] não existe no banco de dados.`);
          setFetching(false);
          return;
        }
        const cData = caseSnap.data();
        setCaseObj(cData);

        // Load persisted Wizard state
        if (cData.solicitacoesProvasWizardState) {
          setWizardState((prev: any) => ({
            ...prev,
            ...cData.solicitacoesProvasWizardState
          }));
        }

        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Fetch custom evidence list
        const qEv = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId));
        const qSnap = await getDocs(qEv);
        const reqList: EvidenceRequest[] = [];
        qSnap.forEach((docSnap) => {
          reqList.push({ id: docSnap.id, ...docSnap.data() } as EvidenceRequest);
        });
        reqList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRequests(reqList);

        // Fetch GDocs settings templates
        const tSnap = await getDoc(doc(db, 'settings', 'documentTemplates'));
        if (tSnap.exists()) {
          const tData = tSnap.data();
          if (tData.templates && Array.isArray(tData.templates)) {
            setDocTemplates(tData.templates);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(`Erro crítico ao carregar: ${err.message || err}`);
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, [caseId]);

  // Save State and sync in Firestore
  const saveWizardStateUpdate = (updates: Partial<typeof wizardState>) => {
    setWizardState((prev: any) => {
      const next = { ...prev, ...updates };
      // Async update caseObj and firestore outside the React render/update cycle immediately
      setTimeout(() => {
        updateDoc(doc(db, 'cases', caseId!), { 
          solicitacoesProvasWizardState: next,
          // sync backward compatibility variables
          procuracaoStatus: next.q1_3 === 'sim' ? 'criada' : 'pendente',
          desejaRecolherCustas: next.q2_1 === 'nao',
          declaracaoPobrezaStatus: next.q2_4 === 'sim' ? 'criada' : 'pendente',
          contratoHonorariosStatus: next.q3_4 === 'sim' ? 'criada' : 'pendente'
        }).then(() => {
          setSuccess('Salvo automaticamente com segurança!');
          setTimeout(() => setSuccess(null), 2500);
        }).catch(e => {
          console.error('Auto-save error', e);
        });
      }, 0);
      return next;
    });
  };

  const currentStepNum = wizardState.currentStep || 1;

  // Calculo de porcentagem cumulativa de integridade ou progresso de etapas concluídas
  const completedStepsCount = [
    wizardState.step1_completed,
    wizardState.step2_completed,
    wizardState.step3_completed,
    wizardState.step4_completed,
    wizardState.step5_completed,
    wizardState.step6_completed
  ].filter(Boolean).length;
  const progressPercent = Math.min(100, Math.round((completedStepsCount / 6) * 100));

  // Simulating GDocs automation triggers
  const triggerSimulation = async (
    type: 'Procuração' | 'Declaração de Pobreza' | 'Contrato de Honorários' | 'Checklist de Provas',
    status: 'criada' | 'falha'
  ) => {
    setError(null);
    setSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const mockUrl = `https://docs.google.com/document/d/mock-${type.toLowerCase().replace(/[^a-z]/g, '')}-${caseId}`;
      const mockId = `mock-id-${type.slice(0,3).toLowerCase()}-${caseId!.slice(0,5)}`;

      if (type === 'Procuração') {
        await saveWizardStateUpdate({
          q1_1: 'sim',
          q1_3: status === 'criada' ? 'sim' : 'nao',
          q1_4: status === 'criada' ? 'sim' : 'nao',
          q1_5: status === 'criada' ? 'sim' : 'nao'
        });
        await updateDoc(doc(db, 'cases', caseId!), {
          procuracaoStatus: status,
          procuracaoGoogleDocsUrl: status === 'criada' ? mockUrl : '',
          procuracaoGoogleDocsId: status === 'criada' ? mockId : '',
          procuracaoLogFalha: status === 'falha' ? 'Template indisponível no Google Workspace' : ''
        });
      } else if (type === 'Declaração de Pobreza') {
        await saveWizardStateUpdate({
          q2_2: 'sim',
          q2_4: status === 'criada' ? 'sim' : 'nao',
          q2_5: status === 'criada' ? 'sim' : 'nao',
          q2_6: status === 'criada' ? 'sim' : 'nao'
        });
        await updateDoc(doc(db, 'cases', caseId!), {
          declaracaoPobrezaStatus: status,
          declaracaoPobrezaGoogleDocsUrl: status === 'criada' ? mockUrl : '',
          declaracaoPobrezaGoogleDocsId: status === 'criada' ? mockId : '',
          declaracaoPobrezaLogFalha: status === 'falha' ? 'Problema de permissões GDrive no folder' : ''
        });
      } else if (type === 'Contrato de Honorários') {
        await saveWizardStateUpdate({
          q3_1: 'sim',
          q3_4: status === 'criada' ? 'sim' : 'nao',
          q3_5: status === 'criada' ? 'sim' : 'nao',
          q3_6: status === 'criada' ? 'sim' : 'nao'
        });
        await updateDoc(doc(db, 'cases', caseId!), {
          contratoHonorariosStatus: status,
          contratoHonorariosGoogleDocsUrl: status === 'criada' ? mockUrl : '',
          contratoHonorariosGoogleDocsId: status === 'criada' ? mockId : '',
          contratoHonorariosLogFalha: status === 'falha' ? 'Limite quota de API excedido' : ''
        });
      }

      setSuccess(`Automação de ${type} executada de forma simulada: ${status.toUpperCase()}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Erro na simulação: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Add / Remove files simulator helper
  const addWizardFile = (field: string, name: string, size: string) => {
    const list = wizardState[field] || [];
    const updated = [...list, { name, size, date: new Date().toLocaleDateString('pt-BR') }];
    saveWizardStateUpdate({ [field]: updated });
  };

  const removeWizardFile = (field: string, idx: number) => {
    const list = wizardState[field] || [];
    const updated = list.filter((_: any, i: number) => i !== idx);
    saveWizardStateUpdate({ [field]: updated });
  };

  // Step advancement handles
  const handleNextStep = (stepNum: number) => {
    const updates = { 
      [`step${stepNum}_completed`]: true,
      currentStep: stepNum + 1
    };
    saveWizardStateUpdate(updates);
  };

  const handleCustomEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesc.trim()) {
      setError('Preencha o título e as orientações das provas complementares.');
      return;
    }
    setSaving(true);
    const nowISO = new Date().toISOString();
    try {
      const docNumToSave = formDocNumber.trim() || `Doc. ${String(3 + requests.length).padStart(2, '0')}`;
      const prependedTitle = `${docNumToSave} - ${formTitle.trim()}`;

      const expectedTypes: string[] = [];
      if (typePdf) expectedTypes.push('PDF');
      if (typeAudio) expectedTypes.push('áudio');
      if (typeVideo) expectedTypes.push('vídeo');

      const payload = {
        caseId: caseId!,
        clientId: caseObj?.clientId || '',
        clientSlug: clientSlug || '',
        title: prependedTitle,
        description: formDesc.trim(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        visibleToClient: true,
        allowUpload: true,
        expectedFileTypes: expectedTypes,
        maxFiles: 1,
        documentNumber: docNumToSave,
        status: 'pendente',
        createdAt: nowISO,
        updatedAt: nowISO
      };

      const docRef = await addDoc(collection(db, 'caseEvidenceRequests'), payload);
      setRequests(prev => [{ id: docRef.id, ...payload } as EvidenceRequest, ...prev]);

      setFormTitle('');
      setFormDesc('');
      setFormDocNumber('');
      setSuccess('Nova prova complementar agendada e vinculada ao fluxo!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Erro ao cadastrar prova: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeAll = async () => {
    setSaving(true);
    setError(null);
    const nowISO = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'cases', caseId!), {
        productionStage: "solicitacoes-informacoes",
        evidenceCompleted: true,
        evidenceStatus: 'concluido',
        updatedAt: nowISO
      });
      // Mirror
      try {
        await setDoc(doc(db, 'casos', caseId!), {
          productionStage: "solicitacoes-informacoes",
          evidenceCompleted: true,
          evidenceStatus: 'concluido',
          updatedAt: nowISO
        }, { merge: true });
      } catch {}
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId!}/solicitacoes-informacoes`);
    } catch (err: any) {
      setError(`Erro na finalização: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Extract non-standard proof list (custom ones)
  const customRequests = requests.filter(r => 
    !['Procuração', 'Declaração de Pobreza', 'Contrato de Honorários', 'Checklist de Provas'].includes(r.documentType || '') 
    && r.status !== 'arquivado'
  );

  // FileUpload drop/click simulator component
  const FileUploadBox = ({ field, allowedTypes = ['PDF'] }: { field: string, allowedTypes?: string[] }) => {
    const files = wizardState[field] || [];
    const isUploading = currentUploadingField === field;

    return (
      <div className="space-y-2 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></div>
          ) : (
            <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-1" size={20} />
          )}
          <span className="text-[11px] font-bold text-gray-750">
            {isUploading ? "Uploading to Google Drive..." : "Clique para anexar arquivo real ou simular"}
          </span>
          <span className="text-[9px] text-gray-400">O arquivo será enviado e renomeado automaticamente</span>
          <input 
            type="file" 
            className="hidden" 
            disabled={isUploading}
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const originalName = file.name;
                const sizeStr = (file.size / 1024 / 1024).toFixed(2) + ' MB';
                const lastDotIndex = originalName.lastIndexOf('.');
                const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';

                let finalName = originalName;
                const cleanedClientName = clientName ? clientName.trim() : 'Cliente';

                if (field === 'procuracaoFiles') {
                  finalName = `Doc. 01 - Procuração - ${cleanedClientName}${extension}`;
                } else if (field === 'declaracaoFiles') {
                  finalName = `Doc. 02 - Declaração de Pobreza - ${cleanedClientName}${extension}`;
                } else if (field === 'contratoFiles') {
                  finalName = `Doc. $$$ - Contrato de Honorários - ${cleanedClientName}${extension}`;
                } else if (field === 'rgFiles') {
                  finalName = `Doc. 03 - RG - ${cleanedClientName}${extension}`;
                } else if (field === 'cpfFiles') {
                  finalName = `Doc. 04 - CPF - ${cleanedClientName}${extension}`;
                } else if (field === 'residenciaFiles') {
                  finalName = `Doc. 04 - Comprovante de Residência - ${cleanedClientName}${extension}`;
                }

                setCurrentUploadingField(field);
                setUploadErrorMsg(null);

                try {
                  const base64Promise = new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = err => reject(err);
                  });
                  const base64 = await base64Promise;

                  const targetFolder = (driveFolderId || '1YUl0Z3hbptBaXfdp0vSnvGTQv0ChsPMs').trim();
                  const token = localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken');

                  const response = await fetch('/api/google-docs/upload-file', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      folderId: targetFolder,
                      fileName: finalName,
                      fileBase64: base64,
                      mimeType: file.type,
                      googleAccessToken: token
                    })
                  });

                  const data = await response.json();
                  if (!response.ok || !data.success) {
                    throw new Error(data.errorMessage || 'Falha ao enviar arquivo para o Google Drive');
                  }

                  await addWizardFile(field, finalName, sizeStr);
                } catch (err: any) {
                  console.error("Erro no upload do arquivo:", err);
                  setUploadErrorMsg(err.message || "Erro no upload do arquivo");
                  // Fallback to local simulate to support offline preview smoothly
                  await addWizardFile(field, finalName, sizeStr);
                } finally {
                  setCurrentUploadingField(null);
                }
              }
            }}
          />
        </label>
        {uploadErrorMsg && (
          <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
            {uploadErrorMsg}
          </div>
        )}
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-xs">
                <span className="truncate font-semibold text-indigo-900 flex items-center gap-1">
                  <FileText size={12} /> {f.name} <span className="text-[10px] text-indigo-400 font-normal">({f.size})</span>
                </span>
                <button type="button" onClick={() => removeWizardFile(field, idx)} className="text-rose-600 hover:bg-rose-100 p-1 rounded-lg">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Helper toggle checkboxes
  const handleCheckboxToggle = (field: string, val: string) => {
    const list = wizardState[field] || [];
    const updated = list.includes(val) 
      ? list.filter((item: string) => item !== val) 
      : [...list, val];
    saveWizardStateUpdate({ [field]: updated });
  };

  // Reopen Step Trigger
  const handleReopenStep = (stepNum: number) => {
    saveWizardStateUpdate({
      [`step${stepNum}_completed`]: false,
      currentStep: stepNum
    });
  };

  // Integrity calculation for Step 6
  const totalExpectedItems = 3 + (isPJ ? 6 : 3) + customRequests.length;
  let receivedCount = 0;
  if (wizardState.q1_3 === 'sim') receivedCount++;
  if (wizardState.q2_1 === 'nao' || wizardState.q2_4 === 'sim') receivedCount++;
  if (wizardState.q3_4 === 'sim') receivedCount++;
  // PF identification
  if (!isPJ) {
    if (wizardState.q4_rg === 'sim') receivedCount++;
    if (wizardState.q4_cpf === 'sim') receivedCount++;
    if (wizardState.q4_residencia === 'sim') receivedCount++;
  } else {
    // PJ checks
    if (wizardState.q4_cnpj === 'sim') receivedCount++;
    if (wizardState.q4_contrato_social === 'sim') receivedCount++;
    if (wizardState.q4_endereco_sede === 'sim') receivedCount++;
    if (wizardState.q4_rg_socio === 'sim') receivedCount++;
    if (wizardState.q4_cpf_socio === 'sim') receivedCount++;
    if (wizardState.q4_residencia_socio === 'sim') receivedCount++;
  }
  // Custom requests checklist
  customRequests.forEach(r => {
    const sub = wizardState.q5_provas?.[r.id];
    if (sub?.received === 'sim') receivedCount++;
  });

  const integrityPercent = Math.min(100, Math.round((receivedCount / totalExpectedItems) * 100));

  return (
    <FluxoStepLayout stepName="Solicitação de Provas" caseId={caseId!} statusText="Em produção">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* FEEDBACK MASSAGES */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex gap-2 items-center animate-in fade-in">
            <AlertCircle size={15} className="text-red-600 animate-bounce" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs flex gap-2 items-center animate-in fade-in">
            <Check className="text-emerald-500 font-extrabold" size={15} />
            <span className="font-bold">{success}</span>
          </div>
        )}

        {/* TOPO FIXO DA PÁGINA (FLUXO OPERACIONAL EM CABEÇALHO PREMIUM) */}
        {!fetching && caseObj && (
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold font-mono tracking-tight uppercase">Tipo de cliente: {isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                <span className="text-xs text-gray-500 font-medium">Caso: #{caseId?.slice(0, 8)}</span>
              </div>
              <h1 className="text-sm font-black text-gray-900 leading-none">
                Cliente: <span className="text-indigo-600">{clientName || 'Triagem inicial...'}</span>
              </h1>
              <div className="text-[11px] font-semibold text-gray-450 flex items-center gap-1.5 pt-1">
                <Clock size={12} className="shrink-0 text-indigo-500" />
                <span>Status: <strong className="text-gray-800">Em coleta documental</strong></span>
                <span>•</span>
                <span>Última atualização: {new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <div className="w-full md:w-56 space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-150/80">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-extrabold text-indigo-950 uppercase font-mono">Progresso Onboarding</span>
                <span className="font-black text-indigo-600 font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-250 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-right block">
                Etapa {currentStepNum} de 6
              </div>
            </div>
          </div>
        )}

        {/* GUIDED OPERATIONAL PROGRESSIVE WORKFLOW (CHECKLIST VIVO) */}
        {fetching ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={30} />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500 font-mono">Sincronizando Pacote de Coletas...</span>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ETAPA 1 — PROCURAÇÃO */}
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => saveWizardStateUpdate({ currentStep: 1 })}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{wizardState.step1_completed ? '✅' : (currentStepNum === 1 ? '▼' : '▶')}</span>
                  <span className={`text-xs font-bold ${wizardState.step1_completed ? 'text-emerald-700 font-black' : 'text-gray-850'}`}>
                    Etapa 1 — {wizardState.step1_completed ? 'Procuração concluída' : 'Procuração Ad Judicia'}
                  </span>
                </div>
                <ChevronRight size={14} className={`transform transition text-gray-400 ${currentStepNum === 1 ? 'rotate-90' : ''}`} />
              </button>

              {currentStepNum === 1 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/20 space-y-4 animate-in slide-in-from-top duration-300">
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-gray-800">1.1 Você gerou a procuração?</p>
                    <div className="flex gap-4">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold uppercase text-gray-700">
                          <input 
                            type="radio" 
                            name="q1_1" 
                            checked={wizardState.q1_1 === o} 
                            onChange={() => saveWizardStateUpdate({ q1_1: o })} 
                            className="text-indigo-600 rounded-full"
                          />
                          <span>{formatSimNao(o)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {wizardState.q1_1 === 'sim' && (
                    <div className="space-y-4 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                      
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">1.2 Você enviou a procuração ao cliente?</p>
                        <div className="flex flex-wrap gap-3">
                          {['whatsapp', 'email', 'fisica', 'outro'].map(ch => (
                            <label key={ch} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-750">
                              <input 
                                type="checkbox"
                                checked={wizardState.q1_2?.includes(ch)}
                                onChange={() => handleCheckboxToggle('q1_2', ch)}
                                className="rounded text-indigo-600"
                              />
                              <span className="capitalize">{ch === 'fisica' ? 'Física/Impressa' : ch}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q1_2?.includes('outro') && (
                          <input 
                            type="text" 
                            placeholder="Descreva o canal do envio" 
                            value={wizardState.q1_2_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q1_2_outro: e.target.value })}
                            className="mt-1 w-full max-w-md px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">1.3 O cliente assinou a procuração?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="q1_3" 
                                checked={wizardState.q1_3 === o} 
                                onChange={() => saveWizardStateUpdate({ q1_3: o })} 
                              />
                              <span>{formatSimNao(o)}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">1.4 Você solicitou a digitalização do documento?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="q1_4" 
                                checked={wizardState.q1_4 === o} 
                                onChange={() => saveWizardStateUpdate({ q1_4: o })} 
                              />
                              <span>{formatSimNao(o)}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">1.5 Você recebeu a procuração digitalizada?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="q1_5" 
                                checked={wizardState.q1_5 === o} 
                                onChange={() => saveWizardStateUpdate({ q1_5: o })} 
                              />
                              <span>{formatSimNao(o)}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-extrabold text-gray-800">1.6 Deseja anexar a procuração agora?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="q1_6" 
                                checked={wizardState.q1_6 === o} 
                                onChange={() => saveWizardStateUpdate({ q1_6: o })} 
                              />
                              <span>{formatSimNao(o)}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q1_6 === 'sim' && <FileUploadBox field="procuracaoFiles" />}
                      </div>

                    </div>
                  )}

                  {/* SIMULATOR QUICK ACTIONS BLOCK */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => triggerSimulation('Procuração', 'criada')} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer">Forçar Sucesso (GDocs)</button>
                      <button type="button" onClick={() => triggerSimulation('Procuração', 'falha')} className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer">Simular Falha</button>
                    </div>

                    <button
                      type="button"
                      disabled={!wizardState.q1_1}
                      onClick={() => handleNextStep(1)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>Próxima Etapa</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 2 — DECLARAÇÃO DE HIPOSSUFICIÊNCIA */}
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => saveWizardStateUpdate({ currentStep: 2 })}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{wizardState.step2_completed ? '✅' : (currentStepNum === 2 ? '▼' : '▶')}</span>
                  <span className={`text-xs font-bold ${wizardState.step2_completed ? 'text-emerald-700 font-black' : 'text-gray-850'}`}>
                    Etapa 2 — {wizardState.step2_completed ? 'Declaração concluída' : 'Declaração de Hipossuficiência'}
                  </span>
                </div>
                <ChevronRight size={14} className={`transform transition text-gray-400 ${currentStepNum === 2 ? 'rotate-90' : ''}`} />
              </button>

              {currentStepNum === 2 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/20 space-y-4 animate-in slide-in-from-top duration-300">
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-gray-800">2.1 O cliente precisará de gratuidade da justiça?</p>
                    <div className="flex gap-4">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                          <input 
                            type="radio" 
                            name="q2_1" 
                            checked={wizardState.q2_1 === o} 
                            onChange={() => saveWizardStateUpdate({ q2_1: o })} 
                          />
                          <span>{formatSimNao(o)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {wizardState.q2_1 === 'nao' && (
                    <div className="p-3 bg-indigo-50/45 border border-indigo-150 rounded-xl text-indigo-950 text-xs font-semibold leading-relaxed animate-in fade-in">
                      ℹ️ O cliente não quer ou não precisará de gratuidade da justiça. Permitido concluir sem declaração de hipossuficiência.
                    </div>
                  )}

                  {wizardState.q2_1 === 'sim' && (
                    <div className="space-y-4 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">2.2 Você gerou a declaração?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input 
                                type="radio" 
                                name="q2_2" 
                                checked={wizardState.q2_2 === o} 
                                onChange={() => saveWizardStateUpdate({ q2_2: o })} 
                              />
                              <span>{formatSimNao(o)}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {wizardState.q2_2 === 'sim' && (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs font-extrabold text-gray-800">2.3 Você enviou a declaração ao cliente?</p>
                            <div className="flex flex-wrap gap-3">
                              {['whatsapp', 'email', 'fisica', 'outro'].map(ch => (
                                <label key={ch} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-750">
                                  <input 
                                    type="checkbox"
                                    checked={wizardState.q2_3?.includes(ch)}
                                    onChange={() => handleCheckboxToggle('q2_3', ch)}
                                  />
                                  <span className="capitalize">{ch === 'fisica' ? 'Física/Impressa' : ch}</span>
                                </label>
                              ))}
                            </div>
                            {wizardState.q2_3?.includes('outro') && (
                              <input 
                                type="text" 
                                placeholder="Meio de envio do documento" 
                                value={wizardState.q2_3_outro || ''}
                                onChange={(e) => saveWizardStateUpdate({ q2_3_outro: e.target.value })}
                                className="mt-1 w-full max-w-sm px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none"
                              />
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-extrabold text-gray-800">2.4 O cliente assinou a declaração?</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input 
                                    type="radio" 
                                    name="q2_4" 
                                    checked={wizardState.q2_4 === o} 
                                    onChange={() => saveWizardStateUpdate({ q2_4: o })} 
                                  />
                                  <span>{formatSimNao(o)}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-extrabold text-gray-800">2.5 Você solicitou a digitalização do documento?</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input type="radio" checked={wizardState.q2_5 === o} onChange={() => saveWizardStateUpdate({ q2_5: o })} />
                                  <span>{formatSimNao(o)}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-extrabold text-gray-800">2.6 Você recebeu a declaração digitalizada?</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input type="radio" checked={wizardState.q2_6 === o} onChange={() => saveWizardStateUpdate({ q2_6: o })} />
                                  <span>{formatSimNao(o)}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-extrabold text-gray-800">2.7 Deseja anexar a declaração agora?</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input type="radio" checked={wizardState.q2_7 === o} onChange={() => saveWizardStateUpdate({ q2_7: o })} />
                                  <span>{formatSimNao(o)}</span>
                                </label>
                              ))}
                            </div>
                            {wizardState.q2_7 === 'sim' && <FileUploadBox field="declaracaoFiles" />}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                       {wizardState.q2_1 === 'sim' && (
                         <>
                           <button type="button" onClick={() => triggerSimulation('Declaração de Pobreza', 'criada')} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer">Simular Sucesso (GDocs)</button>
                           <button type="button" onClick={() => triggerSimulation('Declaração de Pobreza', 'falha')} className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer">Simular Falha</button>
                         </>
                       )}
                    </div>

                    <button
                      type="button"
                      disabled={!wizardState.q2_1}
                      onClick={() => handleNextStep(2)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>Próxima Etapa</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 3 — CONTRATO DE HONORÁRIOS */}
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => saveWizardStateUpdate({ currentStep: 3 })}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{wizardState.step3_completed ? '✅' : (currentStepNum === 3 ? '▼' : '▶')}</span>
                  <span className={`text-xs font-bold ${wizardState.step3_completed ? 'text-emerald-700 font-black' : 'text-gray-850'}`}>
                    Etapa 3 — {wizardState.step3_completed ? 'Contrato de honorários concluído' : 'Contrato de Honorários'}
                  </span>
                </div>
                <ChevronRight size={14} className={`transform transition text-gray-400 ${currentStepNum === 3 ? 'rotate-90' : ''}`} />
              </button>

              {currentStepNum === 3 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/20 space-y-4 animate-in slide-in-from-top duration-300">
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-gray-800">3.1 Você gerou o contrato de honorários?</p>
                    <div className="flex gap-4">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                          <input type="radio" checked={wizardState.q3_1 === o} onChange={() => saveWizardStateUpdate({ q3_1: o })} />
                          <span>{formatSimNao(o)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {wizardState.q3_1 === 'sim' && (
                    <div className="space-y-4 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                      
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">3.2 Qual o modelo de contratação?</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {['exito', 'entrada_exito', 'mensalidade', 'administrativo', 'outro'].map(m => (
                            <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700 font-medium capitalize">
                              <input 
                                type="radio" 
                                name="q3_2" 
                                checked={wizardState.q3_2 === m} 
                                onChange={() => saveWizardStateUpdate({ q3_2: m })} 
                              />
                              <span>{m.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q3_2 === 'outro' && (
                          <input 
                            type="text" 
                            placeholder="Descreva o modelo acordado" 
                            value={wizardState.q3_2_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q3_2_outro: e.target.value })}
                            className="mt-1 w-full max-w-sm px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none"
                          />
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">3.3 Você enviou o contrato ao cliente?</p>
                        <div className="flex flex-wrap gap-3">
                          {['whatsapp', 'email', 'fisica', 'outro'].map(ch => (
                            <label key={ch} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-750">
                              <input 
                                type="checkbox"
                                checked={wizardState.q3_3?.includes(ch)}
                                onChange={() => handleCheckboxToggle('q3_3', ch)}
                              />
                              <span className="capitalize">{ch === 'fisica' ? 'Física/Impressa' : ch}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q3_3?.includes('outro') && (
                          <input 
                            type="text" 
                            placeholder="Modo alternativo de envio" 
                            value={wizardState.q3_3_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q3_3_outro: e.target.value })}
                            className="mt-1 w-full max-w-sm px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
                          />
                        )}
                      </div>

                      {['q3_4', 'q3_5', 'q3_6', 'q3_7'].map((f, i) => {
                        const labels = [
                          '3.4 O cliente assinou o contrato?',
                          '3.5 Você solicitou a digitalização do contrato?',
                          '3.6 Você recebeu o contrato digitalizado?',
                          '3.7 O financeiro foi informado?'
                        ];
                        return (
                          <div key={f} className="space-y-1">
                            <p className="text-xs font-extrabold text-gray-800">{labels[i]}</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input type="radio" checked={wizardState[f] === o} onChange={() => saveWizardStateUpdate({ [f]: o })} />
                                  <span>{formatSimNao(o)}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <div className="space-y-2">
                        <p className="text-xs font-extrabold text-gray-800">3.8 Deseja anexar o contrato agora?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q3_8 === o} onChange={() => saveWizardStateUpdate({ q3_8: o })} />
                              <span>{formatSimNao(o)}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q3_8 === 'sim' && <FileUploadBox field="contratoFiles" />}
                      </div>

                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => triggerSimulation('Contrato de Honorários', 'criada')} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer">Simular Sucesso (GDocs)</button>
                      <button type="button" onClick={() => triggerSimulation('Contrato de Honorários', 'falha')} className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer">Simular Falha</button>
                    </div>

                    <button
                      type="button"
                      disabled={!wizardState.q3_1}
                      onClick={() => handleNextStep(3)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>Próxima Etapa</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 4 — DOCUMENTOS MÍNIMOS OBRIGATÓRIOS */}
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => saveWizardStateUpdate({ currentStep: 4 })}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{wizardState.step4_completed ? '✅' : (currentStepNum === 4 ? '▼' : '▶')}</span>
                  <span className={`text-xs font-bold ${wizardState.step4_completed ? 'text-emerald-700 font-black' : 'text-gray-850'}`}>
                    Etapa 4 — {isPJ 
                      ? (wizardState.step4_completed ? 'Documentos mínimos da Pessoa Jurídica concluídos' : 'Documentos Mínimos Obrigatorios da Pessoa Jurídica')
                      : (wizardState.step4_completed ? 'Documentos mínimos da Pessoa Física concluídos' : 'Documentos Mínimos Obrigatórios da Pessoa Física')
                    }
                  </span>
                </div>
                <ChevronRight size={14} className={`transform transition text-gray-400 ${currentStepNum === 4 ? 'rotate-90' : ''}`} />
              </button>

              {currentStepNum === 4 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/20 space-y-4 animate-in slide-in-from-top duration-300">
                  {!tipoClienteValido ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 text-xs font-semibold space-y-2">
                      <div className="flex items-center gap-2 text-rose-800 font-extrabold uppercase font-mono">
                        <AlertTriangle size={16} />
                        <span>Erro de Conformidade</span>
                      </div>
                      <p>
                        Não foi possível abrir a Etapa 4 porque o tipo de cliente está inconsistente. Verifique se o cliente é Pessoa Física ou Pessoa Jurídica no cadastro.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-indigo-50/30 text-indigo-900 border border-indigo-150 rounded-xl text-xs font-bold uppercase tracking-tight flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-indigo-600" />
                        <span>Identificado Automaticamente: Tipo de cliente: {isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                      </div>

                      {/* INTEGRITY ALERTS (CORREÇÃO 5) */}
                      {isPF && temPjDadosEmpresa && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs font-semibold flex items-start gap-2 animate-in slide-in-from-top duration-200">
                          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                          <div>
                            Inconsistência cadastral detectada: cliente marcado como Pessoa Física possui dados residuais de Pessoa Jurídica. O sistema seguirá o tipo canônico Pessoa Física, mas recomenda revisar o cadastro.
                          </div>
                        </div>
                      )}

                      {isPJ && !temDadosMinimosPJ && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs font-semibold flex items-start gap-2 animate-in slide-in-from-top duration-200">
                          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                          <div>
                            Inconsistência cadastral detectada: cliente marcado como Pessoa Jurídica não possui dados empresariais mínimos.
                          </div>
                        </div>
                      )}

                      {/* PESSOA FÍSICA ROUTE */}
                      {isPF && (
                        <div className="space-y-4 animate-in fade-in">
                          {['q4_rg', 'q4_cpf', 'q4_residencia'].map((field, idx) => {
                            const labelList = [
                              '4.1 Você recebeu o RG do cliente?',
                              '4.2 Você recebeu o CPF do cliente?',
                              '4.3 Você recebeu o comprovante de residência do cliente?'
                            ];
                            return (
                              <div key={field} className="space-y-1">
                                <p className="text-xs font-extrabold text-gray-800">{labelList[idx]}</p>
                                <div className="flex gap-4">
                                  {['sim', 'nao'].map(o => (
                                    <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                      <input type="radio" checked={wizardState[field] === o} onChange={() => saveWizardStateUpdate({ [field]: o })} />
                                      <span>{o}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          <div className="space-y-3">
                            <p className="text-xs font-extrabold text-gray-800">4.4 Deseja anexar os documentos mínimos obrigatórios agora?</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input type="radio" checked={wizardState.q4_anexar_pf === o} onChange={() => saveWizardStateUpdate({ q4_anexar_pf: o })} />
                                  <span>{o}</span>
                                </label>
                              ))}
                            </div>
                            {wizardState.q4_anexar_pf === 'sim' && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">RG</span><FileUploadBox field="rgFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">CPF</span><FileUploadBox field="cpfFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">Residência</span><FileUploadBox field="residenciaFiles" /></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PESSOA JURÍDICA ROUTE */}
                      {isPJ && (
                        <div className="space-y-4 animate-in fade-in">
                          {['q4_cnpj', 'q4_contrato_social', 'q4_endereco_sede', 'q4_rg_socio', 'q4_cpf_socio', 'q4_residencia_socio'].map((field, idx) => {
                            const labels = [
                              '4.1 Você recebeu o Cartão CNPJ?',
                              '4.2 Você recebeu o Contrato Social e Atos Constitutivos?',
                              '4.3 Você recebeu o comprovante do endereço da sede da empresa?',
                              '4.4 Você recebeu o RG do sócio administrador?',
                              '4.5 Você recebeu o CPF do sócio administrador?',
                              '4.6 Você recebeu o comprovante de residência do sócio administrador?'
                            ];
                            return (
                              <div key={field} className="space-y-1">
                                <p className="text-xs font-extrabold text-gray-800">{labels[idx]}</p>
                                <div className="flex gap-4">
                                  {['sim', 'nao'].map(o => (
                                    <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                      <input type="radio" checked={wizardState[field] === o} onChange={() => saveWizardStateUpdate({ [field]: o })} />
                                      <span>{o}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          <div className="space-y-3">
                            <p className="text-xs font-extrabold text-gray-800">4.7 Deseja anexar os documentos mínimos obrigatórios agora?</p>
                            <div className="flex gap-4">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                  <input type="radio" checked={wizardState.q4_anexar_pj === o} onChange={() => saveWizardStateUpdate({ q4_anexar_pj: o })} />
                                  <span>{o}</span>
                                </label>
                              ))}
                            </div>
                            {wizardState.q4_anexar_pj === 'sim' && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">CARTÃO CNPJ</span><FileUploadBox field="cnpjFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">CONTRATO SOCIAL</span><FileUploadBox field="contratoSocialFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">ENDEREÇO DA SEDE</span><FileUploadBox field="enderecoSedeFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">RG SÓCIO</span><FileUploadBox field="rgSocioFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">CPF SÓCIO</span><FileUploadBox field="cpfSocioFiles" /></div>
                                <div className="bg-white border rounded-xl p-3"><span className="text-[10px] font-bold text-gray-400 block font-mono">RESIDÊNCIA SÓCIO</span><FileUploadBox field="residenciaSocioFiles" /></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleNextStep(4)}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                        >
                          <span>Próxima Etapa</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ETAPA 5 — OUTROS DOCUMENTOS E PROVAS CONFORME NECESSIDADE DO CASO */}
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => saveWizardStateUpdate({ currentStep: 5 })}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{wizardState.step5_completed ? '✅' : (currentStepNum === 5 ? '▼' : '▶')}</span>
                  <span className={`text-xs font-bold ${wizardState.step5_completed ? 'text-emerald-700 font-black' : 'text-gray-850'}`}>
                    Etapa 5 — {wizardState.step5_completed ? 'Provas complementares concluídas' : 'Outros Documentos e Provas conforme a necessidade'}
                  </span>
                </div>
                <ChevronRight size={14} className={`transform transition text-gray-400 ${currentStepNum === 5 ? 'rotate-90' : ''}`} />
              </button>

              {currentStepNum === 5 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/20 space-y-4 animate-in slide-in-from-top duration-300">
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-gray-800">5.1 Existem outros documentos ou provas necessários para este caso?</p>
                    <div className="flex gap-4">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                          <input type="radio" checked={wizardState.q5_1 === o} onChange={() => saveWizardStateUpdate({ q5_1: o })} />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {wizardState.q5_1 === 'sim' && (
                    <div className="space-y-5 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                      
                      {/* ADD NEW EVIDENCE SMALL POP-UP FORM INLINE */}
                      <form onSubmit={handleCustomEvidenceSubmit} className="bg-white border rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-black uppercase text-indigo-700 block tracking-wider font-mono">Requisitar Outro Comprovante / Prova Livre</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Nome da Prova</label>
                            <input 
                              type="text" 
                              placeholder="Ex: Conversas do WhatsApp, Extratos" 
                              value={formTitle}
                              onChange={(e) => setFormTitle(e.target.value)}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Etiqueta Doc (ou número)</label>
                            <input 
                              type="text" 
                              placeholder="Ex: Doc. 03" 
                              value={formDocNumber}
                              onChange={(e) => setFormDocNumber(e.target.value)}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs font-mono outline-none bg-gray-50/50"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Orientações p/ Cliente</label>
                          <textarea 
                            rows={2} 
                            placeholder="Instrua o cliente como obter e enviar..." 
                            value={formDesc}
                            onChange={(e) => setFormDesc(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold"
                          />
                        </div>

                        <div className="flex gap-4">
                          <label className="flex items-center gap-1 cursor-pointer text-xs">
                            <input type="checkbox" checked={typePdf} onChange={(e) => setTypePdf(e.target.checked)} />
                            <span>PDF</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-xs">
                            <input type="checkbox" checked={typeAudio} onChange={(e) => setTypeAudio(e.target.checked)} />
                            <span>Áudio</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-xs">
                            <input type="checkbox" checked={typeVideo} onChange={(e) => setTypeVideo(e.target.checked)} />
                            <span>Vídeo</span>
                          </label>
                        </div>

                        <button 
                          type="submit" 
                          disabled={saving}
                          className="w-full py-1.5 bg-gray-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition"
                        >
                          Adicionar Requisito de Prova
                        </button>
                      </form>

                      {/* DYNAMIC LISTING */}
                      {customRequests.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block font-mono">Checklists de Provas Adicionais</span>
                          {customRequests.map((req) => {
                            const valState = wizardState.q5_provas?.[req.id] || { received: '', anexar: '', files: [] };
                            const setVal = (updatesSub: any) => {
                              const nextProvas = {
                                ...wizardState.q5_provas,
                                [req.id]: { ...valState, ...updatesSub }
                              };
                              saveWizardStateUpdate({ q5_provas: nextProvas });
                            };

                            return (
                              <div key={req.id} className="p-4 bg-white border border-gray-150 rounded-xl space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <span className="text-[9px] bg-indigo-150 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold block w-max uppercase mb-1">{req.documentNumber || 'Doc. Adicional'}</span>
                                    <h4 className="text-xs font-black text-gray-900">{req.title}</h4>
                                    <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">{req.description}</p>
                                  </div>
                                </div>

                                <div className="space-y-2 border-t pt-2.5">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-black text-gray-800">5.X Você já recebeu esse documento?</p>
                                    <div className="flex gap-4">
                                      {['sim', 'nao'].map(o => (
                                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                          <input type="radio" checked={valState.received === o} onChange={() => setVal({ received: o })} />
                                          <span>{o}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>

                                  {valState.received === 'sim' && (
                                    <div className="space-y-2 pl-3 border-l-2 border-indigo-200">
                                      <p className="text-[11px] font-bold text-gray-800">5.X.1 Deseja anexar esse documento agora?</p>
                                      <div className="flex gap-4">
                                        {['sim', 'nao'].map(o => (
                                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                            <input type="radio" checked={valState.anexar === o} onChange={() => setVal({ anexar: o })} />
                                            <span>{o}</span>
                                          </label>
                                        ))}
                                      </div>
                                      {valState.anexar === 'sim' && <FileUploadBox field={`custom_${req.id}`} />}
                                    </div>
                                  )}

                                  {valState.received === 'nao' && (
                                    <div className="p-3 bg-red-50/50 rounded-xl space-y-2 animate-in fade-in">
                                      <p className="text-[10px] font-bold text-red-800 uppercase font-mono">Solicitar Diligência de Pendência</p>
                                      <div className="flex flex-wrap gap-2">
                                        {['portal_cliente', 'whatsapp', 'email', 'outro'].map(ch => (
                                          <label key={ch} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 cursor-pointer">
                                            <input 
                                              type="checkbox"
                                              checked={valState.channels?.includes(ch)}
                                              onChange={() => {
                                                const currentList = valState.channels || [];
                                                const nextList = currentList.includes(ch)
                                                  ? currentList.filter((x: string) => x !== ch)
                                                  : [...currentList, ch];
                                                setVal({ channels: nextList });
                                              }}
                                              className="rounded text-red-500 focus:ring-0"
                                            />
                                            <span>{ch === 'portal_cliente' ? 'Portal do Cliente' : ch.toUpperCase()}</span>
                                          </label>
                                        ))}
                                      </div>
                                      {valState.channels?.includes('outro') && (
                                        <input 
                                          type="text" 
                                          placeholder="Falar outro canal" 
                                          value={valState.outro || ''}
                                          onChange={(e) => setVal({ outro: e.target.value })}
                                          className="w-full px-2 py-1 bg-white border rounded text-xs font-semibold outline-none"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-1 border-t pt-3">
                        <p className="text-xs font-extrabold text-gray-800 font-mono">5.Y Existem provas pendentes?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q5_y_pendentes === o} onChange={() => saveWizardStateUpdate({ q5_y_pendentes: o })} />
                              <span>{o}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q5_y_pendentes === 'sim' && (
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-950 text-xs font-semibold space-y-1 animate-in fade-in">
                            <span className="font-extrabold text-[10px] uppercase text-red-800 tracking-tight font-mono block">Painel Resumido de Pendências Ativas</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-red-900 font-medium">
                              {wizardState.q1_3 === 'nao' && <li>Falta assinatura Procuração (Doc. 01)</li>}
                              {(wizardState.q2_1 === 'sim' && wizardState.q2_4 === 'nao') && <li>Falta assinatura Declaração (Doc. 02)</li>}
                              {wizardState.q3_4 === 'nao' && <li>Falta assinatura Contrato de Honorários</li>}
                              {customRequests.filter(req => wizardState.q5_provas?.[req.id]?.received === 'nao').map(req => (
                                <li key={req.id}>Pendente receber: {req.title}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-800">5.Z Deseja abrir solicitação automática ao cliente?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q5_z_solicitacao_automatica === o} onChange={() => saveWizardStateUpdate({ q5_z_solicitacao_automatica: o })} />
                              <span>{o}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q5_z_solicitacao_automatica === 'sim' && (
                          <div className="bg-indigo-50/50 rounded-xl p-3 border space-y-2 animate-in fade-in text-xs font-semibold">
                            <span className="text-[9px] font-mono uppercase text-indigo-700 block">Escolher Canais Disponíveis</span>
                            <div className="flex gap-3">
                              {['portal_cliente', 'whatsapp', 'email'].map(c => (
                                <label key={c} className="flex items-center gap-1">
                                  <input 
                                    type="checkbox"
                                    checked={wizardState.q5_z_channels?.includes(c)}
                                    onChange={() => handleCheckboxToggle('q5_z_channels', c)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                                  />
                                  <span className="capitalize">{c === 'portal_cliente' ? 'Portal' : c}</span>
                                </label>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setSuccess('Disparado com sucesso!'); setTimeout(() => setSuccess(null), 2000); }} className="w-full py-1 text-[10px] uppercase font-mono font-black tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Gerar Notificação</button>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleNextStep(5)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>Seguir para Auditoria (Validação)</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 6 — AUDITORIA DA COLETA DE PROVAS */}
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => saveWizardStateUpdate({ currentStep: 6 })}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{wizardState.step6_completed ? '✅' : (currentStepNum === 6 ? '▼' : '▶')}</span>
                  <span className={`text-xs font-bold ${wizardState.step6_completed ? 'text-emerald-700 font-black' : 'text-gray-850'}`}>
                    Etapa 6 — {wizardState.step6_completed ? 'Auditoria concluída' : 'Auditoria da Coleta de Provas'}
                  </span>
                </div>
                <ChevronRight size={14} className={`transform transition text-gray-400 ${currentStepNum === 6 ? 'rotate-90' : ''}`} />
              </button>

              {currentStepNum === 6 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/20 space-y-6 animate-in slide-in-from-top duration-300">
                  
                  {/* RESUMO GERAL CARD */}
                  <div className="bg-white border p-4 rounded-xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider font-sans border-b pb-1.5">Resumo Geral da Coleta</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs leading-relaxed font-semibold text-gray-700">
                      <div><span className="text-[10px] uppercase text-gray-400 font-bold block">Cliente</span> <span className="text-gray-900">{clientName || 'N/A'}</span></div>
                      <div><span className="text-[10px] uppercase text-gray-400 font-bold block">Ref Caso</span> <span className="text-gray-900">#Caso {caseId?.slice(0, 8)}</span></div>
                      <div><span className="text-[10px] uppercase text-gray-400 font-bold block">Inscrição</span> <span className="uppercase text-gray-900">{caseObj?.registrationType || 'N/A'}</span></div>
                      <div><span className="text-[10px] uppercase text-gray-400 font-bold block">Integridade Coletas</span> <span className="text-indigo-655 text-indigo-700 font-black font-mono">{integrityPercent}%</span></div>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${integrityPercent}%` }} />
                    </div>
                  </div>

                  {/* 6.1 — RESUMO DA ETAPA 1 — PROCURAÇÃO */}
                  <div className="bg-white border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center pb-1 border-b">
                      <h4 className="text-xs font-black text-indigo-950 uppercase font-mono">6.1 — Procuração Jurídica (Compilado)</h4>
                    </div>
                    <div className="text-xs font-semibold space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span>{wizardState.q1_1 === 'sim' ? '✅' : '❌'}</span>
                        <span>Procuração gerada {wizardState.q1_1 === 'sim' ? '(Google Docs)' : 'pendente'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{wizardState.q1_2?.length > 0 ? '✅' : '❌'}</span>
                        <span>Enviado via: {wizardState.q1_2?.join(', ') || 'Nenhum canal selecionado'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{wizardState.q1_3 === 'sim' ? '✅' : '❌'}</span>
                        <span>Assinatura coletada</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{wizardState.q1_4 === 'sim' ? '✅' : (wizardState.q1_4 === 'nao' ? '⚠' : '❌')}</span>
                        <span>Digitalização requisitada</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{(wizardState.procuracaoFiles || []).length > 0 ? '✅' : '❌'}</span>
                        <span>Anexo persistido na pasta</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2.5">
                      <button type="button" onClick={() => window.open(driveFolderUrl || '#')} className="px-2.5 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg text-[10px] font-black text-gray-700 inline-flex items-center gap-1">
                        <FileSearch size={12} /> Visualizar Documento
                      </button>
                      <button type="button" onClick={() => handleReopenStep(1)} className="px-2.5 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg text-[10px] font-black text-gray-700">Reabrir Etapa</button>
                    </div>
                  </div>

                  {/* 6.2 — RESUMO DA ETAPA 2 — DECLARAÇÃO DE HIPOSSUFICIÊNCIA */}
                  <div className="bg-white border rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.2 — Resumo Declaração de Hipossuficiência</h4>
                    {wizardState.q2_1 === 'nao' ? (
                      <div className="text-xs font-semibold text-gray-500 italic">ℹ️ Cliente não utilizará gratuidade da justiça (isento de declaração)</div>
                    ) : (
                      <div className="text-xs font-semibold space-y-1">
                        <div className="flex items-center gap-1.5"><span>✅</span> <span>Gratuidade judiciária necessária</span></div>
                        <div className="flex items-center gap-1.5"><span>{wizardState.q2_2 === 'sim' ? '✅' : '❌'}</span> <span>Declaração gerada</span></div>
                        <div className="flex items-center gap-1.5"><span>{wizardState.q2_4 === 'sim' ? '✅' : '❌'}</span> <span>Assinatura coletada</span></div>
                        <div className="flex items-center gap-1.5"><span>{(wizardState.declaracaoFiles || []).length > 0 ? '✅' : '❌'}</span> <span>Anexo persistido</span></div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => handleReopenStep(2)} className="px-2.5 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg text-[10px] font-black text-gray-700">Reabrir Etapa</button>
                    </div>
                  </div>

                  {/* 6.3 — RESUMO DA ETAPA 3 — CONTRATO DE HONORÁRIOS */}
                  <div className="bg-white border rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.3 — Resumo Contrato de Honorários</h4>
                    <div className="text-xs font-semibold space-y-1">
                      <div className="flex items-center gap-1.5"><span>{wizardState.q3_1 === 'sim' ? '✅' : '❌'}</span> <span>Contrato gerado</span></div>
                      <div className="flex items-center gap-1.5"><span>✅</span> <span>Modelo acordado: <strong className="uppercase text-indigo-700">{wizardState.q3_2 || 'Não definido'}</strong></span></div>
                      <div className="flex items-center gap-1.5"><span>{wizardState.q3_4 === 'sim' ? '✅' : '❌'}</span> <span>Contrato assinado</span></div>
                      <div className="flex items-center gap-1.5"><span>{wizardState.q3_7 === 'sim' ? '✅' : '⚠'}</span> <span>{wizardState.q3_7 === 'sim' ? 'Financeiro foi informado' : 'Financeiro ainda não informado'}</span></div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => saveWizardStateUpdate({ q3_7: 'sim' })} className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-[10px] font-black text-emerald-800">Informar Financeiro</button>
                      <button type="button" onClick={() => handleReopenStep(3)} className="px-2.5 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg text-[10px] font-black text-gray-700">Reabrir Etapa</button>
                    </div>
                  </div>

                  {/* 6.4 — RESUMO DA ETAPA 4 — DOCUMENTOS MÍNIMOS */}
                  <div className="bg-white border rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.4 — Resumo Documentos Mínimos Obrigatórios ({isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'})</h4>
                    <div className="text-xs font-semibold space-y-1">
                      {!isPJ ? (
                        <>
                          <div className="flex items-center gap-1.55"><span>{wizardState.q4_rg === 'sim' ? '✅' : '❌'}</span> <span>RG recebido</span></div>
                          <div className="flex items-center gap-1.5 ml-4 text-[11px] text-gray-500">
                            <span>{wizardState.q4_solicitar_digitalizacao_rg === 'sim' ? '📲 Solicitar digitalização do RG: SIM' : '📲 Solicitar digitalização do RG: NÃO'}</span>
                          </div>
                          <div className="flex items-center gap-1.5"><span>{wizardState.q4_cpf === 'sim' ? '✅' : '❌'}</span> <span>CPF recebido</span></div>
                          <div className="flex items-center gap-1.5"><span>{wizardState.q4_residencia === 'sim' ? '✅' : '❌'}</span> <span>Comprovante de residência recebido</span></div>
                          <div className="flex items-center gap-1.5 ml-4 text-[11px] text-gray-500">
                            <span>{wizardState.q4_solicitar_digitalizacao_residencia === 'sim' ? '📲 Solicitar digitalização do Comprovante de Residência: SIM' : '📲 Solicitar digitalização do Comprovante de Residência: NÃO'}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5"><span>{wizardState.q4_cnpj === 'sim' ? '✅' : '❌'}</span> <span>Cartão CNPJ recebido</span></div>
                          <div className="flex items-center gap-1.5"><span>{wizardState.q4_contrato_social === 'sim' ? '✅' : '❌'}</span> <span>Contrato social recebido</span></div>
                          <div className="flex items-center gap-1.5"><span>{wizardState.q4_rg_socio === 'sim' ? '✅' : '❌'}</span> <span>RG sócio recebido</span></div>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => handleReopenStep(4)} className="px-2.5 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg text-[10px] font-black text-gray-700">Reabrir Etapa</button>
                    </div>
                  </div>

                  {/* 6.5 — RESUMO DA ETAPA 5 — PROVAS COMPLEMENTARES */}
                  <div className="bg-white border rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.5 — Resumo Provas Complementares ({customRequests.length})</h4>
                    <div className="text-xs font-semibold space-y-1">
                      {customRequests.length === 0 ? (
                        <span className="text-gray-400 italic">Nenhuma prova complementar adicional cadastrada.</span>
                      ) : (
                        customRequests.map(r => {
                          const subState = wizardState.q5_provas?.[r.id] || { received: 'nao' };
                          return (
                            <div key={r.id} className="flex items-center justify-between text-[11px] py-0.5 border-b border-gray-100/55">
                              <span className="font-extrabold text-gray-805">{r.title}</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${subState.received === 'sim' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {subState.received === 'sim' ? 'Recebido' : 'Pendente'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <button type="button" onClick={() => handleReopenStep(5)} className="px-2.5 py-1.5 bg-gray-50 border hover:bg-gray-100 rounded-lg text-[10px] font-black text-gray-700">Reabrir Etapa 5</button>
                    </div>
                  </div>

                  {/* 6.6 — RELATÓRIO DE INTEGRIDADE DOCUMENTAL */}
                  <div className="bg-indigo-900 text-indigo-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <span className="text-[9px] text-indigo-200 block uppercase font-mono font-bold">Integridade</span>
                      <strong className="text-xl font-black text-white">{integrityPercent}%</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-indigo-200 block uppercase font-mono font-bold">Documentos Esperados</span>
                      <strong className="text-xl font-black text-white">{totalExpectedItems}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-indigo-200 block uppercase font-mono font-bold">Recebidos</span>
                      <strong className="text-xl font-black text-white">{receivedCount}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-indigo-200 block uppercase font-mono font-bold">Pendentes</span>
                      <strong className="text-xl font-black text-red-300">{totalExpectedItems - receivedCount}</strong>
                    </div>
                  </div>

                  {/* 6.7 — VALIDAÇÃO FINAL OPERACIONAL */}
                  <div className="bg-white border rounded-xl p-4 space-y-4">
                    <span className="text-[10px] font-black uppercase text-indigo-700 block tracking-wider font-mono border-b pb-1.5">6.7 — Validação Final Operacional</span>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800">6.7.1 Todas as pendências foram resolvidas?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q6_7_1 === o} onChange={() => saveWizardStateUpdate({ q6_7_1: o })} />
                              <span>{o}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800">6.7.2 O caso está apto para seguir ao próximo setor?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q6_7_2 === o} onChange={() => saveWizardStateUpdate({ q6_7_2: o })} />
                              <span>{o}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800">6.7.3 Deseja bloquear avanço até resolução das pendências?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q6_7_3 === o} onChange={() => saveWizardStateUpdate({ q6_7_3: o })} />
                              <span>{o}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800">6.7.4 Deseja gerar relatório consolidado da coleta?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                              <input type="radio" checked={wizardState.q6_7_4 === o} onChange={() => saveWizardStateUpdate({ q6_7_4: o })} />
                              <span>{o}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q6_7_4 === 'sim' && (
                          <div className="p-4 bg-gray-50 border rounded-xl space-y-2 animate-in fade-in transition duration-300 text-[11px] leading-relaxed">
                            <h5 className="font-extrabold uppercase font-mono text-gray-450 border-b">Relatório Operacional Consolidado</h5>
                            <div><strong>Cliente:</strong> {clientName}</div>
                            <div><strong>Tipo:</strong> {isPJ ? 'PJ' : 'PF'}</div>
                            <div><strong>Integridade:</strong> {integrityPercent}%</div>
                            <div><strong>Último Update:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
                            <div><strong>Apto p/ Próximo Setor:</strong> <span className={wizardState.q6_7_2 === 'sim' ? 'text-emerald-700 font-extrabold' : 'text-rose-600 font-extrabold'}>{wizardState.q6_7_2 === 'sim' ? 'SIM' : 'NÃO / PENDENTE'}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 6.8 — SOLICITAÇÕES AUTOMÁTICAS DE PENDÊNCIAS */}
                  {totalExpectedItems > receivedCount && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500 shrink-0" size={16} />
                        <span className="text-[10px] font-black uppercase text-amber-850 tracking-wider font-mono">6.8 — Disparos de cobranças automáticas</span>
                      </div>
                      
                      <div className="flex gap-3 text-xs font-semibold">
                        {['portal_cliente', 'whatsapp', 'email'].map(c => (
                          <label key={c} className="flex items-center gap-1 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={wizardState.q6_8_channels?.includes(c)}
                              onChange={() => handleCheckboxToggle('q6_8_channels', c)}
                            />
                            <span className="capitalize">{c === 'portal_cliente' ? 'Portal' : c}</span>
                          </label>
                        ))}
                      </div>

                      <div className="bg-white border rounded-lg p-2.5 font-mono text-[10px] text-gray-700 block select-all">
                        {"Olá, identificamos pendências documentais no seu caso. Favor enviar:\n" +
                          (wizardState.q1_3 !== 'sim' ? "* Procuração Ad Judicia devidamente assinada\n" : "") +
                          (wizardState.q2_1 === 'sim' && wizardState.q2_4 !== 'sim' ? "* Declaração de Hipossuficiência assinada\n" : "") +
                          (wizardState.q3_4 !== 'sim' ? "* Contrato de Honorários assinado\n" : "") +
                          customRequests.filter(req => wizardState.q5_provas?.[req.id]?.received !== 'sim').map(r => `* ${r.title}\n`).join('')
                        }
                      </div>

                      <button 
                        type="button" 
                        onClick={() => { setSuccess('Notificação de cobrança enviada com sucesso!'); setTimeout(() => setSuccess(null), 2500); }} 
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition"
                      >
                        Enviar Cobrança de Pendências
                      </button>
                    </div>
                  )}

                  {/* 6.9 — FINALIZAÇÃO DA AUDITORIA */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold space-y-3">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-tight">
                      <CheckCircle className="text-emerald-500 animate-pulse" size={15} />
                      <span>Auditoria da coleta documental validada de forma integral</span>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleFinalizeAll}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-xs cursor-pointer shadow-md transition"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <><span>Finalizar Auditoria & Avançar Fluxo</span><ArrowRight size={14} /></>}
                    </button>
                  </div>

                </div>
              )}
            </div>

          </div>
        )}

        {/* BOTTOM CONTROLS STAGE BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.tipoServico(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-6 py-3 rounded-xl font-bold text-xs cursor-pointer"
          >
            <ArrowLeft size={14} />
            Voltar para Tipo de Serviço
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-blue-950 text-gray-900 px-6 py-3 rounded-xl font-bold text-xs hover:bg-gray-150 cursor-pointer"
            >
              <Save size={14} />
              Fechar e Sair
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleFinalizeAll}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold text-xs cursor-pointer shadow-md transition"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <span>Finalizar Coleta de Provas</span>}
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
