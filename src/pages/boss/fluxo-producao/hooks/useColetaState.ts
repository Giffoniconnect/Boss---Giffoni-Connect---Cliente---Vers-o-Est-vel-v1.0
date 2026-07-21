import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export interface EvidenceRequest {
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

export function useColetaState() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [requests, setRequests] = useState<EvidenceRequest[]>([]);
  const [docTemplates, setDocTemplates] = useState<any[]>([]);

  const [wizardState, setWizardState] = useState<any>({
    currentStep: 1,
    q1_1: 'nao', q1_2: [], q1_2_outro: '', q1_3: 'nao', q1_4: 'nao', q1_5: 'nao', q1_6: 'nao', procuracaoFiles: [],
    q2_1: 'nao', q2_2: 'nao', q2_3: [], q2_3_outro: '', q2_4: 'nao', q2_5: 'nao', q2_6: 'nao', q2_7: 'nao', declaracaoFiles: [],
    q3_1: 'nao', q3_2: '', q3_2_outro: '', q3_3: [], q3_3_outro: '', q3_4: 'nao', q3_5: 'nao', q3_6: 'nao', q3_7: 'nao', q3_8: 'nao', contratoFiles: [],
    q4_rg: '', q4_solicitar_digitalizacao_rg: '', q4_cpf: '', q4_solicitar_digitalizacao_residencia: '', q4_residencia: '', q4_anexar_pf: '', rgFiles: [], cpfFiles: [], residenciaFiles: [],
    q4_cnpj: '', q4_contrato_social: '', q4_endereco_sede: '', q4_rg_socio: '', q4_cpf_socio: '', q4_residencia_socio: '', q4_anexar_pj: '',
    cnpjFiles: [], contratoSocialFiles: [], enderecoSedeFiles: [], rgSocioFiles: [], cpfSocioFiles: [], residenciaSocioFiles: [],
    q5_1: '', q5_provas: {}, q5_y_pendentes: '', q5_z_solicitacao_automatica: '', q5_z_channels: [],
    q6_7_1: '', q6_7_2: '', q6_7_3: '', q6_7_4: '', q6_8_channels: [],
    step1_completed: false, step2_completed: false, step3_completed: false, step4_completed: false, step5_completed: false, step6_completed: false
  });

  const tipoCliente = client?.type;
  const isPF = tipoCliente === 'PF';
  const isPJ = tipoCliente === 'PJ';
  const tipoClienteValido = isPF || isPJ;

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

        // Fetch GDocs settings templates if exists
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
  const removeUndefinedKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(removeUndefinedKeys);
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        clean[key] = removeUndefinedKeys(obj[key]);
      }
    }
    return clean;
  };

  const saveWizardStateUpdate = async (updates: Partial<typeof wizardState>) => {
    setWizardState((prev: any) => {
      const next = { ...prev, ...updates };
      const cleanedNext = removeUndefinedKeys(next);
      // Async update caseObj and firestore
      updateDoc(doc(db, 'cases', caseId!), { 
        solicitacoesProvasWizardState: cleanedNext,
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
      return next;
    });
  };

  const triggerSimulation = async (
    type: 'Procuração' | 'Declaração de Pobreza' | 'Contrato de Honorários' | 'Checklist de Provas',
    status: 'criada' | 'falha'
  ) => {
    setError(null);
    setSaving(true);
    try {
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

  const addWizardFile = (field: string, name: string, size: string, url?: string) => {
    const list = wizardState[field] || [];
    const updated = [...list, { name, size, url: url || '', date: new Date().toLocaleDateString('pt-BR') }];
    saveWizardStateUpdate({ [field]: updated });
  };

  const removeWizardFile = (field: string, idx: number) => {
    const list = wizardState[field] || [];
    const updated = list.filter((_: any, i: number) => i !== idx);
    saveWizardStateUpdate({ [field]: updated });
  };

  const handleCheckboxToggle = (field: string, val: string) => {
    const list = wizardState[field] || [];
    const updated = list.includes(val) 
      ? list.filter((item: string) => item !== val) 
      : [...list, val];
    saveWizardStateUpdate({ [field]: updated });
  };

  return {
    caseId: caseId!,
    fetching,
    saving,
    setSaving,
    error,
    setError,
    success,
    setSuccess,
    caseObj,
    client,
    requests,
    setRequests,
    docTemplates,
    isPJ,
    isPF,
    tipoCliente,
    tipoClienteValido,
    clientName,
    clientSlug,
    driveFolderId,
    driveFolderUrl,
    hasDriveFolder,
    wizardState,
    saveWizardStateUpdate,
    triggerSimulation,
    addWizardFile,
    removeWizardFile,
    handleCheckboxToggle,
    navigate
  };
}
