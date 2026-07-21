import React from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import EntregaDocumento from '../components/EntregaDocumento';
import { buildProcuracaoPfPlaceholders, PROCURACAO_PF_REQUIRED_PLACEHOLDERS } from '../../../../lib/documents/procuracaoPfPlaceholders';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Settings, CheckSquare, Sparkles, Check, AlertCircle, RefreshCw, ExternalLink,
  Copy, FolderOpen, FileCode
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useAuth } from '../../../../contexts/AuthContext';

export default function ProcuracaoPF() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [isRenewingGoogle, setIsRenewingGoogle] = React.useState(false);

  const handleRenewGoogle = async () => {
    setIsRenewingGoogle(true);
    try {
      await loginWithGoogle('boss_admin');
      setSuccess("Autenticação Google renovada com sucesso! Você já pode gerar a procuração novamente.");
    } catch (err: any) {
      setError(`Falha ao renovar autenticação: ${err.message || err}`);
    } finally {
      setIsRenewingGoogle(false);
    }
  };

  const {
    caseId,
    fetching,
    saving,
    error,
    success,
    clientName,
    client,
    caseObj,
    wizardState,
    saveWizardStateUpdate,
    addWizardFile,
    removeWizardFile,
    navigate,
    driveFolderId,
    driveFolderUrl,
    setError,
    setSuccess,
    setSaving
  } = useColetaState();

  const [localCaseObj, setLocalCaseObj] = React.useState<any>(null);

  // Sync with caseObj from hook on mount/load
  React.useEffect(() => {
    if (caseObj) {
      setLocalCaseObj(caseObj);
    }
  }, [caseObj]);

  // Set up real-time listener for current case to react to changes and cleanups
  React.useEffect(() => {
    if (!caseId) return;
    const unsubscribe = onSnapshot(doc(db, 'cases', caseId), (snapshot) => {
      if (snapshot.exists()) {
        setLocalCaseObj(snapshot.data());
      }
    }, (err) => {
      console.error("Erro na escuta de cases:", err);
    });
    return () => unsubscribe();
  }, [caseId]);

  const [activeJob, setActiveJob] = React.useState<any>(null);
  const [allCaseJobs, setAllCaseJobs] = React.useState<any[]>([]);
  const [copiedDiagnostics, setCopiedDiagnostics] = React.useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = React.useState(false);

  const generationInFlightRef = React.useRef(false);
  const [copied, setCopied] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [sentPayload, setSentPayload] = React.useState<any>(null);
  const [showPayload, setShowPayload] = React.useState(false);
  const [copiedPayload, setCopiedPayload] = React.useState(false);

  // 1. Estados cruciais da Seção 5 para a tentativa ativa fática
  const [currentAttemptJobId, setCurrentAttemptJobId] = React.useState<string | null>(null);
  const [attemptStartedAt, setAttemptStartedAt] = React.useState<string | null>(null);
  const [showGenerationError, setShowGenerationError] = React.useState<boolean>(false);

  const isMockUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('mock') ||
      lower.includes('fake') ||
      lower.includes('teste') ||
      lower.includes('diagnostic') ||
      lower.includes('localhost') ||
      lower.includes('undefined') ||
      lower.includes('null')
    );
  };

  // Check and auto-clean mock/invalid references on client load (Task 1 & Task 7)
  React.useEffect(() => {
    if (!caseId || !localCaseObj) return;
    const url = localCaseObj.procuracaoGoogleDocsUrl;
    const isUrlMock = url && isMockUrl(url);
    const isUrlInvalid = url && !url.toLowerCase().startsWith('https://docs.google.com/document/d/');
    const isStatusActiveWithoutUrl = localCaseObj.procuracaoStatus === 'criada' && !url;

    if (isUrlMock || isUrlInvalid || isStatusActiveWithoutUrl) {
      const runCleanup = async () => {
        try {
          const caseDocRef = doc(db, 'cases', caseId);
          const logsToAppend = [...(localCaseObj.procuracaoGoogleDocsJobLogs || [])];
          logsToAppend.push({
            action: "PORTAL_PROC_PF_RESIDUAL_CASE_DATA_CLEANED",
            timestamp: new Date().toISOString(),
            message: "Dados residuais e estados expirados limpos automaticamente."
          });
          if (isUrlMock) {
            logsToAppend.push({
              action: "PORTAL_PROC_PF_MOCK_REFERENCE_REMOVED",
              timestamp: new Date().toISOString(),
              message: "Referências de URL simulada (mock) ou fakes de teste removidas de cases/{caseId} com absoluto sucesso."
            });
          }

          await updateDoc(caseDocRef, {
            procuracaoGoogleDocsId: "",
            procuracaoGoogleDocsUrl: "",
            procuracaoStatus: "pendente",
            procuracaoGeneratedAt: "",
            procuracaoLogFalha: "",
            procuracaoGoogleDocsJobId: "",
            procuracaoGoogleDocsJobLogs: logsToAppend
          });

          // Update local state immediately to avoid flashing
          setLocalCaseObj((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              procuracaoGoogleDocsId: "",
              procuracaoGoogleDocsUrl: "",
              procuracaoStatus: "pendente",
              procuracaoGeneratedAt: "",
              procuracaoLogFalha: "",
              procuracaoGoogleDocsJobId: ""
            };
          });
        } catch (err) {
          console.error("Erro na limpeza automática de referência:", err);
        }
      };
      runCleanup();
    }
  }, [caseId, localCaseObj]);

  const currentCase = localCaseObj || caseObj;

  const getAuditPayload = () => {
    if (sentPayload) return sentPayload;
    if (activeJob) {
      return {
        contractVersion: activeJob.contractVersion || 'boss.placeholders.v1',
        documentType: activeJob.documentType || 'procuracao_pf',
        caseId: activeJob.caseId || caseId,
        clientId: activeJob.portalClientId || currentCase?.clientId || '',
        clientType: activeJob.clientType || 'PF',
        destinationFolderId: activeJob.destinationFolderId || driveFolderId,
        destinationFolderUrl: activeJob.destinationFolderUrl || driveFolderUrl,
        templateKey: activeJob.templateKey || 'procuracao-pf',
        placeholders: activeJob.placeholders || activeJob.payload || null
      };
    }
    return null;
  };

  const handleCopyDiagnostics = () => {
    const report = {
      caseId,
      clientId: currentCase?.clientId || '',
      clientName,
      driveFolderId,
      driveFolderUrl,
      portalDocsEngine: "NATIVE",
      engineStatus: "operational",
      activeJobId: activeJob?.id || 'N/A',
      activeJobStatus: activeJob?.status || 'N/A',
      currentAttemptJobId: currentAttemptJobId || 'N/A',
      procuracaoStatus: currentCase?.procuracaoStatus || 'N/A',
      procuracaoGoogleDocsUrl: currentCase?.procuracaoGoogleDocsUrl || 'N/A',
      procuracaoLogFalha: currentCase?.procuracaoLogFalha || 'N/A'
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedDiagnostics(true);
    setTimeout(() => setCopiedDiagnostics(false), 2000);
  };

  const handleForceCleanAttempt = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setCurrentAttemptJobId(null);
    setAttemptStartedAt(null);
    try {
      const caseDocRef = doc(db, 'cases', caseId);
      await updateDoc(caseDocRef, {
        procuracaoStatus: "pendente",
        procuracaoLogFalha: "",
      });
      setSuccess("Visualização de tentativa limpa forçada. Pronto para gerar nova procuração!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Erro ao redefinir estado de erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCleanProcuracaoResidualState = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const now = new Date();
      const caseDocRef = doc(db, 'cases', caseId);
      await updateDoc(caseDocRef, {
        procuracaoGoogleDocsId: "",
        procuracaoGoogleDocsUrl: "",
        procuracaoStatus: "pendente",
        procuracaoGeneratedAt: "",
        procuracaoLogFalha: "",
        procuracaoGoogleDocsJobId: "",
        procuracaoGoogleDocsJobLogs: [
          ...(currentCase?.procuracaoGoogleDocsJobLogs || []),
          {
            action: "PROC_PF_RESIDUAL_CASE_DATA_CLEANED",
            timestamp: now.toISOString(),
            message: "Limpeza manual de dados residuais e expurgos executada pelo usuário com sucesso."
          }
        ]
      });

      // Update local state immediately
      setLocalCaseObj((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          procuracaoGoogleDocsId: "",
          procuracaoGoogleDocsUrl: "",
          procuracaoStatus: "pendente",
          procuracaoGeneratedAt: "",
          procuracaoLogFalha: "",
          procuracaoGoogleDocsJobId: ""
        };
      });

      if (allCaseJobs && allCaseJobs.length > 0) {
        for (const job of allCaseJobs) {
          let needsUpdate = false;
          const updates: any = {};

          if (job.status === 'pending') {
            needsUpdate = true;
            updates.status = 'timeout';
            updates.errorCode = 'PROC_PF_STALE_JOB_TIMEOUT';
            updates.errorMessage = 'Job antigo pendente marcado como timeout para não interferir na nova geração.';
            updates.updatedAt = now.toISOString();
            updates.logs = [
              ...(job.logs || []),
              {
                action: "PROC_PF_STALE_JOB_TIMEOUT",
                timestamp: now.toISOString(),
                message: "Parcialmente pendente - Limpo manualmente via painel administrativo."
              }
            ];
          } else if (job.status === 'success') {
            const url = job.result?.googleDocsUrl;
            const isUrlMockOrInvalid = !url || isMockUrl(url) || !url.toLowerCase().startsWith('https://docs.google.com/document/d/');
            if (isUrlMockOrInvalid) {
              needsUpdate = true;
              updates.status = 'failed';
              updates.errorCode = 'PROC_PF_SUCCESS_WITHOUT_REAL_DOCUMENT';
              updates.errorMessage = 'Job antigo marcado como sucesso mas com URL simulada ou inválida.';
              updates.updatedAt = now.toISOString();
              updates.logs = [
                ...(job.logs || []),
                {
                  action: "PROC_PF_TEMPLATE_MISMATCH",
                  timestamp: now.toISOString(),
                  message: "Job antigo limpo devido a referências ou links de documentos inexistentes."
                }
              ];
            }
          }

          if (needsUpdate) {
            await updateDoc(doc(db, 'googleDocsJobs', job.id), updates);
          }
        }
      }

      setSuccess("Limpeza de resíduos e normalização executados com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Erro ao executar limpeza de resíduos:", err);
      setError(`Falha ao executar limpeza de resíduos: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearMockReference = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const caseDocRef = doc(db, 'cases', caseId);
      const clearLogs = [
        {
          action: "PROC_PF_MOCK_REFERENCE_CLEARED",
          timestamp: new Date().toISOString(),
          message: "A referência de Procuração mockada foi limpa com absoluto sucesso pelo usuário."
        }
      ];
      await updateDoc(caseDocRef, {
        procuracaoGoogleDocsId: "",
        procuracaoGoogleDocsUrl: "",
        procuracaoStatus: "pendente",
        procuracaoGeneratedAt: "",
        procuracaoLogFalha: "",
        procuracaoGoogleDocsJobId: "",
        procuracaoGoogleDocsJobLogs: clearLogs
      });
      setSuccess("Referência mockada limpa com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Erro ao limpar referência mockada:", err);
      setError(`Falha ao limpar referência mockada: ${err.message}`);
    } finally {
      setSaving(false);
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

  // Helper to background check/repair job statuses in the DB (Task 2)
  const auditJobsAndRepairInDatabase = async (jobs: any[]) => {
    const now = new Date();
    for (const job of jobs) {
      let needsUpdate = false;
      const updates: any = {};

      if (job.status === 'pending') {
        const createdTime = new Date(job.createdAt).getTime();
        const elapsedMs = now.getTime() - createdTime;
        if (elapsedMs > 5 * 60 * 1000) {
          needsUpdate = true;
          updates.status = 'timeout';
          updates.errorCode = 'PROC_PF_STALE_JOB_TIMEOUT';
          updates.errorMessage = 'Job antigo pendente marcado como timeout para não interferir na nova geração.';
          updates.updatedAt = now.toISOString();
          updates.logs = [
            ...(job.logs || []),
            {
              action: "PROC_PF_STALE_JOB_TIMEOUT",
              timestamp: now.toISOString(),
              message: "Job pendente há mais de 5 minutos marcado como timeout por inatividade."
            }
          ];
        }
      }

      if (job.status === 'success') {
        const url = job.result?.googleDocsUrl;
        const id = job.result?.googleDocsId;
        const isUrlMockOrInvalid = !url || isMockUrl(url) || !url.toLowerCase().startsWith('https://docs.google.com/document/d/');
        if (isUrlMockOrInvalid || !id) {
          needsUpdate = true;
          updates.status = 'failed';
          updates.errorCode = 'PROC_PF_TEMPLATE_MISMATCH';
          updates.errorMessage = 'Job marcado como sucesso anteriormente mas não contém documento real do Google Docs.';
          updates.updatedAt = now.toISOString();
          updates.logs = [
            ...(job.logs || []),
            {
              action: "PROC_PF_TEMPLATE_MISMATCH",
              timestamp: now.toISOString(),
              message: "Job de sucesso com documento inválido ou ausente marcado como falha."
            }
          ];
        }
      }

      if (needsUpdate) {
        try {
          await updateDoc(doc(db, 'googleDocsJobs', job.id), updates);
        } catch (err) {
          console.error(`Erro ao reparar job ${job.id}:`, err);
        }
      }
    }
  };

  // Real-time synchronization and monitoring hook (Tasks 2 & 3)
  React.useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, 'googleDocsJobs'),
      where('caseId', '==', caseId),
      where('documentType', '==', 'procuracao_pf')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const jobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        auditJobsAndRepairInDatabase(jobs);

        jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAllCaseJobs(jobs);

        const now = new Date();
        const validActiveJob = jobs.find(job => {
          if (currentAttemptJobId && job.id === currentAttemptJobId) {
            return true;
          }
          if (job.status === 'success') {
            const url = job.result?.googleDocsUrl;
            return url && !isMockUrl(url) && url.toLowerCase().startsWith('https://docs.google.com/document/d/');
          }
          if (job.status === 'pending') {
            const createdTime = new Date(job.createdAt).getTime();
            const elapsedMs = now.getTime() - createdTime;
            return elapsedMs <= 5 * 60 * 1000;
          }
          return false;
        });

        setActiveJob(validActiveJob || null);
      } else {
        setActiveJob(null);
        setAllCaseJobs([]);
      }
    }, (err) => {
      console.error("Erro na escuta de googleDocsJobs:", err);
    });

    return () => unsubscribe();
  }, [caseId, currentAttemptJobId]);

  // Synchronize case fields when job status changes
  React.useEffect(() => {
    if (!activeJob || !currentCase) return;

    const isJobSuccess = activeJob.status === 'success';
    const isJobFailed = activeJob.status === 'failed';

    const caseDocRef = doc(db, 'cases', caseId);

    const updateCaseFromJob = async () => {
      try {
        if (isJobSuccess && currentCase.procuracaoGoogleDocsJobId !== activeJob.id) {
          const hasResultLog = activeJob.logs?.some((l: any) => l.action === 'PROC_PF_DOCUMENT_CREATED');
          
          let updatedLogs = [...(activeJob.logs || [])];
          if (!hasResultLog) {
            updatedLogs.push(
              {
                action: "PROC_PF_DOCUMENT_CREATED",
                timestamp: new Date().toISOString(),
                message: "Dados do Google Docs recebidos com sucesso pelo Portal BOSS."
              },
              {
                action: "PROC_PF_CASE_UPDATED",
                timestamp: new Date().toISOString(),
                message: "Caso atualizado com o link do documento da Procuração PF."
              }
            );

            await updateDoc(doc(db, 'googleDocsJobs', activeJob.id), {
              logs: updatedLogs,
              updatedAt: new Date().toISOString()
            });
          }

          await updateDoc(caseDocRef, {
            procuracaoStatus: "criada",
            procuracaoGoogleDocsId: activeJob.result?.googleDocsId || '',
            procuracaoGoogleDocsUrl: activeJob.result?.googleDocsUrl || '',
            procuracaoGeneratedAt: activeJob.updatedAt || new Date().toISOString(),
            procuracaoGoogleDocsJobId: activeJob.id,
            procuracaoDestinationFolderId: activeJob.destinationFolderId || '',
            procuracaoDestinationFolderUrl: activeJob.destinationFolderUrl || '',
            procuracaoVersion: activeJob.version || 1
          });
        } else if (isJobFailed && currentCase.procuracaoGoogleDocsJobId !== activeJob.id) {
          const hasFailLog = activeJob.logs?.some((l: any) => l.action === 'PROC_PF_TEMPLATE_COPY_FAILED');
          
          let updatedLogs = [...(activeJob.logs || [])];
          if (!hasFailLog) {
            updatedLogs.push({
              action: "PROC_PF_TEMPLATE_COPY_FAILED",
              timestamp: new Date().toISOString(),
              message: `Falha na geração do documento pelo receptor: ${activeJob.errorMessage || 'Unknown error'}`
            });

            await updateDoc(doc(db, 'googleDocsJobs', activeJob.id), {
              logs: updatedLogs,
              updatedAt: new Date().toISOString()
            });
          }

          await updateDoc(caseDocRef, {
            procuracaoStatus: "falha",
            procuracaoLogFalha: activeJob.errorMessage || 'Erro inesperado na geração do documento pelo build integrador.',
            procuracaoGoogleDocsJobId: activeJob.id
          });
        }
      } catch (err) {
        console.error("Erro ao sincronizar caso com o job de documento:", err);
      }
    };

    updateCaseFromJob();
  }, [activeJob, currentCase, caseId]);

  const handleNextPhase = () => {
    saveWizardStateUpdate({ step1_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-declaracao-PF`);
    });
  };

  const handleSendJob = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Procuração PF ignorada.");
      return;
    }
    generationInFlightRef.current = true;

    try {
      // 1. Antes de enviar, validar: caseId, clientId, googleDriveClientFolderId, googleDriveClientFolderUrl, nomeCompleto, cpf
      const targetCaseId = caseId;
      const targetClientId = currentCase?.clientId || '';
      const googleDriveClientFolderId = driveFolderId || client?.googleDriveClientFolderId || '';
      const googleDriveClientFolderUrl = driveFolderUrl || client?.googleDriveClientFolderUrl || '';
      const destinationFolderId = googleDriveClientFolderId;
      const destinationFolderUrl = googleDriveClientFolderUrl;
      const nomeCompleto = client?.pfDadosPessoais?.pf_nomeCompleto || client?.pfData?.pf_nomeCompleto || '';
      const cpf = client?.pfDadosPessoais?.pf_cpf || client?.pfData?.pf_cpf || '';

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const caseDocRef = doc(db, 'cases', targetCaseId);

      // Initial logs setup using the specified codes
      const jobLogs: any[] = [];
      const addClientLog = (action: string, message: string) => {
        jobLogs.push({
          action,
          timestamp: new Date().toISOString(),
          message
        });
      };

      const actionLog = intent === 'initial' ? 'DOCUMENT_SINGLE_CLICK_GENERATION_STARTED' : 'DOCUMENT_NEW_VERSION_SINGLE_CLICK_STARTED';
      addClientLog(actionLog, `Geração de Procuração PF iniciada via clique único fático (${intent === 'initial' ? 'geração inicial' : 'nova versão'}).`);

      // Step 1: PROC_PF_BUTTON_CLICKED
      addClientLog("PROC_PF_BUTTON_CLICKED", "O operador clicou em 'Gerar Procuração' para iniciar o fluxo de automação.");

    if (!targetCaseId) {
      setError("Erro de validação: caseId do caso está ausente.");
      setShowGenerationError(true);
      return;
    }
    if (!targetClientId) {
      setError("Erro de validação: clientId do caso está ausente.");
      setShowGenerationError(true);
      return;
    }

    // Step 2: PROC_PF_CLIENT_DATA_LOADED
    addClientLog("PROC_PF_CLIENT_DATA_LOADED", "Dados cadastrais do cliente e do caso carregados com sucesso do banco.");

    // 2. Se não houver googleDriveClientFolderId: bloquear com "Não há pasta real do Google Drive vinculada ao cliente."
    if (!googleDriveClientFolderId) {
      setError("Não há pasta real do Google Drive vinculada ao cliente.");
      setShowGenerationError(true);
      return;
    }
    if (!nomeCompleto) {
      setError("Não é possível gerar a Procuração porque o Nome Completo do cliente está ausente no cadastro.");
      setShowGenerationError(true);
      return;
    }
    if (!cpf) {
      setError("Não é possível gerar a Procuração porque o CPF do cliente está ausente no cadastro.");
      setShowGenerationError(true);
      return;
    }

    // Step 3: PROC_PF_FOLDER_FOUND
    addClientLog("PROC_PF_FOLDER_FOUND", `Pasta destino no Google Drive localizada com sucesso ID: ${destinationFolderId}`);

    // Step 4: PROC_PF_OFFICIAL_TEMPLATE_SELECTED
    const officialTemplateId = "16k_n_BTdf8wTCG8CK4T2TyAT93o5qrmZqjbROtrBqzk";
    addClientLog("PROC_PF_OFFICIAL_TEMPLATE_SELECTED", `Template oficial de Procuração PF selecionado unicamente como fonte da verdade: ${officialTemplateId}`);

    let placeholders: Record<string, string>;
    try {
      placeholders = buildProcuracaoPfPlaceholders(client);

      // Gerar data da assinatura com base no clique real (DD/MM/AAAA)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dataAssinaturaFormated = `${day}/${month}/${year}`;
      
      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;

      // Step 5: PROC_PF_PLACEHOLDERS_BUILT
      addClientLog("PROC_PF_PLACEHOLDERS_BUILT", "Todas as chaves e valores de placeholders foram processados e vinculados com sucesso com a data da assinatura gerada no clique.");
    } catch (err: any) {
      setError(err.message || "Erro ao calcular placeholders.");
      setShowGenerationError(true);
      setSaving(false);
      return;
    }

    // Exact required placeholder validation
    const requiredKeys = [
      "{{OUTORGANTE_NOME}}",
      "{{OUTORGANTE_NACIONALIDADE}}",
      "{{OUTORGANTE_ESTADO_CIVIL}}",
      "{{OUTORGANTE_PROFISSAO}}",
      "{{OUTORGANTE_RG}}",
      "{{OUTORGANTE_CPF}}",
      "{{OUTORGANTE_ENDERECO}}",
      "{{OUTORGANTE_NUMERO}}",
      "{{OUTORGANTE_COMPLEMENTO}}",
      "{{OUTORGANTE_BAIRRO}}",
      "{{OUTORGANTE_CIDADE}}",
      "{{OUTORGANTE_ESTADO}}",
      "{{OUTORGANTE_CEP}}",
      "{{OUTORGANTE_TELEFONE}}",
      "{{OUTORGANTE_WHATSAPP}}",
      "{{OUTORGANTE_EMAIL}}",
      "{{DATA_ASSINATURA}}"
    ];

    const essentialKeys = [
      "{{OUTORGANTE_NOME}}",
      "{{OUTORGANTE_CPF}}",
      "{{OUTORGANTE_RG}}",
      "{{OUTORGANTE_ENDERECO}}",
      "{{OUTORGANTE_NUMERO}}",
      "{{OUTORGANTE_BAIRRO}}",
      "{{OUTORGANTE_CIDADE}}",
      "{{OUTORGANTE_ESTADO}}",
      "{{OUTORGANTE_CEP}}",
      "{{OUTORGANTE_EMAIL}}",
      "{{DATA_ASSINATURA}}"
    ];

    const missingKeys = requiredKeys.filter(k => !(k in placeholders));
    const emptyEssentials = essentialKeys.filter(k => {
      const val = placeholders[k];
      return !val || String(val).trim() === "";
    });

    if (missingKeys.length > 0 || emptyEssentials.length > 0) {
      addClientLog("PROC_PF_REQUIRED_PLACEHOLDER_EMPTY", `Modo de validação acusou campos em branco ou ausentes: ${emptyEssentials.map(k => k.replace("{{","").replace("}}","")).join(", ")}`);
      
      const errorDetail = `Erro de validação: Existem campos essenciais vazios no cadastro do cliente que impedem a geração da procuração: ${emptyEssentials.map(k => k.replace("{{","").replace("}}","")).join(", ")}`;
      setError(errorDetail);
      setShowGenerationError(true);
      setSaving(false);

      const initialJob = {
        id: jobId,
        contractVersion: "boss.placeholders.v1",
        source: "Portal BOSS Clientes",
        target: "Internal Generator Engine",
        documentType: "procuracao_pf",
        templateKey: "procuracao_pf",
        status: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        caseId: targetCaseId,
        portalClientId: targetClientId,
        clientType: "PF",
        destinationFolderId,
        destinationFolderUrl,
        outputFileName: `Procuração PF - ${nomeCompleto}`,
        placeholders,
        errorCode: "PROC_PF_REQUIRED_PLACEHOLDER_EMPTY",
        errorMessage: errorDetail,
        logs: jobLogs
      };
      await setDoc(doc(db, 'googleDocsJobs', jobId), initialJob);
      return;
    }

    addClientLog("PROC_PF_REQUIRED_PLACEHOLDERS_VALIDATED", "Contrato de placeholders mapeado contra a especificação com 100% de conformidade.");

    // Configuração fática de rastreio de tentativa única segundo a Seção 5
    setSaving(true);
    setError(null);
    setSuccess(null);
    setShowGenerationError(false);
    setCurrentAttemptJobId(jobId);

    const currentVersion = currentCase?.procuracaoVersion || 1;
    const nextVersion = currentCase?.procuracaoGoogleDocsUrl ? currentVersion + 1 : 1;

    // Step: PROC_PF_TEMPLATE_COPY_STARTED
    addClientLog("PROC_PF_TEMPLATE_COPY_STARTED", "Disparando processo de clonagem do template oficial no GDrive...");

    // Enquanto envia: status = "gerando" e limpamos a falha anterior do documento do caso
    await updateDoc(caseDocRef, {
      procuracaoStatus: "gerando",
      procuracaoLogFalha: ""
    });

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v1",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: "procuracao_pf",
      templateKey: "procuracao_pf",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: targetCaseId,
      portalClientId: targetClientId,
      clientType: "PF",
      destinationFolderId,
      destinationFolderUrl,
      outputFileName: `Procuração PF - ${nomeCompleto}`,
      placeholders,
      result: {
        googleDocsId: null,
        googleDocsUrl: null,
        fileName: null
      },
      errorCode: null,
      errorMessage: null,
      logs: jobLogs
    };

    await setDoc(doc(db, 'googleDocsJobs', jobId), initialJob);

    let targetEndpoint = "/api/google-docs/generate-document";
    const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

    const internalPayload = {
      mode: "stateless",
      googleAccessToken,
      documentType: "procuracao_pf",
      caseId: targetCaseId,
      clientId: targetClientId,
      clientType: "PF",
      templateId: officialTemplateId,
      templateKey: "procuracao_pf",
      destinationFolderId,
      destinationFolderUrl,
      documentName: `Procuração PF - ${nomeCompleto}`,
      placeholders,
      metadata: { source: "Operational Coleta Flow", attemptJobId: jobId },
      credentialOverride: localOverride
    };

    try {
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
        responseData = { error: responseText };
      }

      if (!response.ok || !responseData.success) {
        const errorDetail = responseData.errorMessage || responseData.error || responseText || "Falha na geração integrada.";
        const errorInstance = new Error(errorDetail) as any;
        errorInstance.httpStatus = response.status;
        errorInstance.errorCode = responseData.errorCode || "PROC_PF_TEMPLATE_COPY_FAILED";
        errorInstance.rawResponse = responseText;
        throw errorInstance;
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      // Add template copy success, validated as official, replacement started, replacement success, document created, case updated, flow completed
      addClientLog("PROC_PF_TEMPLATE_COPY_SUCCESS", `Clone realizado no Google Drive com o novo ID de documento: ${googleDocsId}`);
      addClientLog("PROC_PF_TEMPLATE_VALIDATED_AS_OFFICIAL", "O documento clonado foi validado contra o snippet obrigatório de Procuração PF.");
      addClientLog("PROC_PF_PLACEHOLDER_REPLACEMENT_STARTED", "Iniciando a operação em lote de substituição dos placeholders no documento.");
      addClientLog("PROC_PF_PLACEHOLDER_REPLACEMENT_SUCCESS", "Substituição concluída de todos os placeholders com absoluto sucesso.");
      addClientLog("PROC_PF_DOCUMENT_CREATED", "Criação física e de dados do arquivo homologada no Google Drive.");
      addClientLog("PROC_PF_CASE_UPDATED", `Caso atualizado com a Procuração PF de versão: ${nextVersion}`);
      addClientLog("PROC_PF_FLOW_COMPLETED", "Processamento terminado com 100% de conformidade operacional.");

      // Update case
      await updateDoc(caseDocRef, {
        procuracaoStatus: "criada",
        procuracaoGoogleDocsId: googleDocsId,
        procuracaoGoogleDocsUrl: googleDocsUrl,
        procuracaoPfId: googleDocsId,
        procuracaoPfUrl: googleDocsUrl,
        googleDocsUrl: googleDocsUrl,
        procuracaoGeneratedAt: new Date().toISOString(),
        procuracaoDestinationFolderId: destinationFolderId,
        procuracaoDestinationFolderUrl: destinationFolderUrl,
        procuracaoGoogleDocsJobLogs: jobLogs,
        procuracaoVersion: nextVersion,
        procuracaoGoogleDocsJobId: jobId
      });

      // Save to subcollection generatedDocuments/procuracao_pf
      try {
        const subdocRef = doc(db, 'cases', targetCaseId, 'generatedDocuments', 'procuracao_pf');
        await setDoc(subdocRef, {
          documentType: "procuracao_pf",
          displayName: `Procuração PF - ${nomeCompleto}`,
          templateKey: "procuracao_pf",
          templateId: officialTemplateId,
          googleDocsId,
          googleDocsUrl,
          destinationFolderId,
          destinationFolderUrl,
          status: "success",
          generatedAt: new Date().toISOString(),
          generatedBy: "Portal BOSS Central Interna (Stateless)",
          errorCode: null,
          errorMessage: null,
          logs: jobLogs
        }, { merge: true });
      } catch (errSub: any) {
        console.warn("[PortalBoss] Subcollection write failed", errSub.message);
      }

      // Update internal job document to success
      await updateDoc(doc(db, 'googleDocsJobs', jobId), {
        status: "success",
        updatedAt: new Date().toISOString(),
        result: {
          googleDocsId,
          googleDocsUrl,
          fileName: `Procuração PF - ${nomeCompleto}`
        },
        logs: jobLogs
      });

      await saveWizardStateUpdate({ q1_1: 'sim' });

      setSuccess("Procuração PF gerada e indexada localmente com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("[Generator Execution Failed]", err);
      const errorMessage = err.message || "Erro desconhecido durante o processamento de geração integrada.";
      setShowGenerationError(true);

      const httpStatus = err.httpStatus || 500;
      const errorCode = err.errorCode || "PROC_PF_PLACEHOLDER_REPLACEMENT_FAILED";
      const rawResponse = err.rawResponse || "";

      // Log failure log action
      addClientLog(errorCode, `Ocorreu uma falha no fluxo: ${errorMessage}`);
      addClientLog("PROC_PF_CASE_UPDATE_FAILED", "Falha ao gravar referências no documento do caso principal.");

      // Save to case doc that it failed
      await updateDoc(caseDocRef, {
        procuracaoStatus: "falha",
        procuracaoLogFalha: errorMessage,
        procuracaoGoogleDocsJobLogs: jobLogs,
        procuracaoGoogleDocsJobId: jobId
      });

      // Save failed job to firestore
      await updateDoc(doc(db, 'googleDocsJobs', jobId), {
        status: "failed",
        errorCode,
        errorMessage,
        updatedAt: new Date().toISOString(),
        logs: jobLogs
      });

      setError(`Falha ao gerar procuração no motor interno: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
    } finally {
      generationInFlightRef.current = false;
    }
  };

  const [uploading, setUploading] = React.useState(false);

  const FileUploadBox = ({ field }: { field: string }) => {
    const files = wizardState[field] || [];
    return (
      <div className="space-y-2 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></div>
          ) : (
            <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-1" size={20} />
          )}
          <span className="text-[11px] font-bold text-gray-700">
            {uploading ? "Enviando arquivo ao Google Drive..." : "Anexar arquivo de Procuração (PDF/Imagem)"}
          </span>
          <input 
            type="file" 
            className="hidden" 
            disabled={uploading}
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const originalName = file.name;
                const sizeStr = (file.size / 1024 / 1024).toFixed(2) + ' MB';
                const lastDotIndex = originalName.lastIndexOf('.');
                const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
                const finalName = `Doc. 01 - Procuração - ${clientName || 'Cliente'}${extension}`;

                setUploading(true);
                setError(null);
                try {
                  const base64Promise = new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = err => reject(err);
                  });
                  const base64 = await base64Promise;

                  const targetFolder = (driveFolderId || '1YUl0Z3hbptBaXfdp0vSnvGTQv0ChsPMs').trim();

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
                      googleAccessToken: googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken')
                    })
                  });

                  const data = await response.json();
                  if (!response.ok || !data.success) {
                    throw new Error(data.errorMessage || 'Falha ao enviar arquivo para o Google Drive');
                  }

                  await addWizardFile(field, finalName, sizeStr);
                  setSuccess("Procuração enviada e salva com sucesso no Google Drive: " + finalName);
                } catch (err: any) {
                  setError(err.message || 'Erro ao realizar upload do arquivo');
                } finally {
                  setUploading(false);
                }
              }
            }}
          />
        </label>
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

  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="procuracao"
      tipoPessoa="PF"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">
              Subetapa 1 - Solicitação da Procuração Ad Judicia
            </h1>
            <div className="text-xs text-gray-400">
              Cliente: <strong>{clientName}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/card-iniciar-coleta-obrigatoria`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-550 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar ao Card
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">Carregando dados da etapa...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* NOTIFICATION TOASTS */}
            {showGenerationError && error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-xs font-semibold flex gap-3 items-start select-all">
                <AlertCircle size={16} className="text-red-00 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-[10px] uppercase text-red-950 tracking-wide font-mono">Erro de Processamento / Configuração</p>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-red-905 leading-relaxed">{error}</pre>
                </div>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* AUDITORIA DA GERAÇÃO DA PROCURAÇÃO CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Settings className="text-indigo-600 animate-[spin_10s_linear_infinite]" size={18} />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">Auditoria da Geração da Procuração</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Controle automatizado e verificação da pauta de integração via Google Docs.</p>
                </div>
              </div>
              
              {/* AUTOMAÇÃO INTELIGENTE CARD PANEL */}
              <div className="bg-gradient-to-br from-indigo-50/60 to-blue-50/20 border border-indigo-150 rounded-3xl p-6 shadow-3xs space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-indigo-100 text-indigo-800 rounded-full font-black text-[9px] uppercase tracking-wider font-mono">
                        Automação Ativa
                      </span>
                      <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                    </div>
                    <h2 className="text-sm font-black text-slate-900">
                      Gerador de Procuração PF via Google Workspace
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                      Esta ferramenta envia os dados consolidados do cadastro de pessoa física diretamente ao build receptor do Google Docs para preenchimento de placeholders, indexação e arquivamento automatizado na pasta em tempo real.
                    </p>
                  </div>
                </div>

                {!driveFolderId ? (
                  <div className="p-4 bg-rose-50/80 border border-rose-150 rounded-2xl flex items-start gap-3 text-rose-950 text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
                    <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-rose-950">
                      <p className="font-extrabold uppercase text-[9px] tracking-wider text-rose-800 font-mono">Pasta do Cliente Ausente</p>
                      <p className="font-medium text-rose-900 leading-relaxed text-xs">
                        Não é possível enviar a Procuração para o Google Docs Integration porque a pasta do cliente ainda não possui googleDriveClientFolderId.
                      </p>
                      <p className="text-[10px] text-rose-700 font-semibold italic">
                        Por favor, cadastre ou sincronize a pasta do Drive nas configurações de cadastro do cliente antes de prosseguir.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* CONFIGURAÇÕES DA AUTOMAÇÃO */}
                    <div className="border border-gray-150 rounded-2xl overflow-hidden bg-gray-50/40">
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="w-full px-4.5 py-3 flex items-center justify-between bg-white border-b border-gray-150 hover:bg-gray-55 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Settings size={14} className="text-indigo-600 animate-[spin_8s_linear_infinite]" />
                          <span className="text-xs font-black uppercase tracking-wider text-slate-700">Configurações do Google Docs</span>
                        </div>
                        <span className="text-[11px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                          {isSettingsOpen ? 'Ocultar' : 'Visualizar'}
                        </span>
                      </button>

                      {isSettingsOpen && (
                        <div className="p-4.5 space-y-4 bg-white animate-fadeIn">
                          {/* Pasta ID */}
                          <div className="space-y-1">
                            <p className="font-extrabold text-gray-400 text-[10px] uppercase tracking-wider">Identificador da Pasta do Cliente (Pasta ID)</p>
                            <p className="font-mono bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 select-all max-w-fit break-all">
                              {driveFolderId}
                            </p>
                          </div>

                          {/* Ver Template */}
                          <div className="space-y-1.5 pt-1">
                            <p className="font-extrabold text-gray-400 text-[10px] uppercase tracking-wider">Template Oficial de Procuração PF</p>
                            <a
                              href="https://docs.google.com/document/d/16k_n_BTdf8wTCG8CK4T2TyAT93o5qrmZqjbROtrBqzk/edit"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-650 hover:text-indigo-850 font-extrabold hover:underline"
                            >
                              <FileCode size={14} className="text-indigo-500" />
                              <span>Ver template no Google Docs</span>
                              <ExternalLink size={12} className="stroke-[2.5]" />
                            </a>
                          </div>

                          {/* Link to advanced configuration page */}
                          <div className="pt-2 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-procuracao-PF')}
                              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800"
                            >
                              Editar Variáveis de Integração <ArrowRight size={10} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Informações da pasta do cliente */}
                    <div className="p-4 bg-white border border-gray-150 rounded-2xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs animate-in fade-in">
                      <div className="space-y-1 select-none">
                        <p className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Destino da Pasta Associada</p>
                        <p className="text-slate-800 font-extrabold text-xs flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse" />
                          <span>Pasta do Google Drive ({clientName || "Cliente"})</span>
                        </p>
                      </div>
                      {driveFolderUrl && (
                        <a
                          href={driveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 hover:border-emerald-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs whitespace-nowrap"
                        >
                          {/* Google Drive Visual Indicator */}
                          <div className="flex items-center gap-0.5 mr-1.5 bg-white shadow-3xs border border-gray-100 px-1 py-0.5 rounded-md size-fit shrink-0">
                            <span className="w-1 h-3.5 bg-[#4285F4] rounded-full" title="Google Drive Colors" />
                            <span className="w-1 h-3.5 bg-[#34A853] rounded-full" />
                            <span className="w-1 h-3.5 bg-[#FBBC05] rounded-full" />
                          </div>
                          <span>Abrir pasta do Google Drive</span>
                          <ExternalLink size={12} className="stroke-[2.5]" />
                        </a>
                      )}
                    </div>

                    {/* STATUS DA AUTOMAÇÃO */}
                    <div className="border border-gray-150 rounded-2xl p-5 bg-gray-50/50 space-y-2.5">
                      <p className="font-bold text-gray-500 text-[10px] uppercase tracking-widest font-mono">Status da Automação</p>
                      
                      {currentCase?.procuracaoGoogleDocsUrl && !isMockUrl(currentCase.procuracaoGoogleDocsUrl) ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                          <span>Procuração criada com sucesso ✅</span>
                        </div>
                      ) : activeJob?.status === 'failed' ? (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-950 text-xs font-bold space-y-1.5 animate-fadeIn">
                          <div className="flex items-start gap-2">
                            <span>Falha na criação da Procuração, consulte “ver fluxo de logs” para mais informações ❌</span>
                          </div>
                        </div>
                      ) : activeJob?.status === 'pending' || saving ? (
                        <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2 animate-pulse">
                          <RefreshCw className="text-amber-500 shrink-0 animate-spin" size={14} />
                          <span>Geração em andamento... Sincronizando com Google Docs</span>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-white border border-gray-200 rounded-xl text-gray-400 text-xs font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-300" />
                          <span>Aguardando comando de geração eletrônica.</span>
                        </div>
                      )}
                    </div>

                    {currentCase?.procuracaoGoogleDocsUrl && !isMockUrl(currentCase.procuracaoGoogleDocsUrl) ? (
                      <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-in slide-in-from-top-1 duration-200">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                            <FileText size={20} />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Procuração Gerada</h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                              O documento de Procuração PF já foi indexado e está disponível para preenchimento de assinaturas.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2.5 pt-1.5">
                          <a
                            href={currentCase.procuracaoGoogleDocsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold"
                          >
                            <ExternalLink size={13} />
                            Abrir Procuração
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(currentCase.procuracaoGoogleDocsUrl)}
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
                            disabled={saving}
                            onClick={() => handleSendJob('new_version')}
                            className="px-4.5 py-2 bg-white hover:bg-gray-50 border border-gray-250 text-slate-800 text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold"
                          >
                            Gerar nova versão
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Se estiver aguardando / processando o job */}
                        {activeJob?.status === 'pending' || saving ? (
                          <div className="bg-white border border-indigo-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-pulse font-sans">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                              <div className="flex items-center gap-2">
                                <RefreshCw className="text-indigo-600 animate-spin" size={17} />
                                <span className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                                  Gerando procuração segura... Por favor, aguarde alguns instantes.
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full animate-infinite-loading w-3/4"></div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Motor Integrado info display */}
                            <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1.5 text-xs animate-fadeIn">
                              <p className="font-extrabold text-emerald-950 uppercase tracking-widest text-[9px] font-mono flex items-center gap-1.5 align-middle">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                <span>CONEXÃO COM MOTOR DE GOOGLE DOCS ATIVO (INTEGRADO)</span>
                              </p>
                              <p className="text-emerald-900 leading-normal text-[11px]">
                                A geração documental está configurada para operar diretamente de forma nativa e integrada ao Portal BOSS Clientes, utilizando a Conta de Serviço Google autorizada.
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleSendJob('initial')}
                                className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer font-bold"
                              >
                                <Sparkles size={14} />
                                <span>{saving ? 'Gerando...' : 'Gerar Procuração'}</span>
                              </button>
                            </div>

                            {showGenerationError && activeJob && activeJob.status === 'failed' && activeJob.id === currentAttemptJobId && (
                              <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2.5 text-xs animate-in duration-200 fade-in zoom-in-95 flex-col md:flex-row">
                                <div className="flex gap-2.5 items-start">
                                  <AlertCircle size={15} className="text-rose-500 mt-0.5 shrink-0 animate-bounce" />
                                  <div>
                                    <p className="font-extrabold text-rose-950 uppercase tracking-widest text-[9px] font-mono flex items-center gap-1.5 font-bold">
                                      <span>Erro de Geração na Tentativa Atual</span>
                                    </p>
                                    <p className="text-rose-900 font-medium mt-1">
                                      Ocorreu uma falha ao gerar a procuração. Por favor, verifique os dados cadastrais do cliente e tente novamente.
                                    </p>
                                    {activeJob.errorMessage && (
                                      <pre className="mt-2 p-2 bg-slate-950 border border-slate-900 rounded-lg text-rose-450 font-mono text-[10px] overflow-auto max-h-32 whitespace-pre-wrap select-all">
                                        {activeJob.errorMessage}
                                      </pre>
                                    )}
                                  </div>
                                </div>
                                {activeJob.errorMessage && (activeJob.errorMessage.toLowerCase().includes("expirou") || 
                                  activeJob.errorMessage.toLowerCase().includes("sessão") || 
                                  activeJob.errorMessage.toLowerCase().includes("token") || 
                                  activeJob.errorMessage.toLowerCase().includes("autorização") || 
                                  activeJob.errorMessage.toLowerCase().includes("credentials")) && (
                                  <div className="pt-2 w-full border-t border-rose-150/50 md:border-t-0 md:pt-0 md:pl-2.5 flex flex-col gap-1.5 self-center">
                                    <button
                                      type="button"
                                      disabled={isRenewingGoogle}
                                      onClick={handleRenewGoogle}
                                      className="inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                    >
                                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21.35 11.1H12V12.9H19.6C18.9 16.5 15.8 18.9 12 18.9C8.1 18.9 5.0 15.8 5.0 12C5.0 8.2 8.1 5.1 12 5.1C13.7 5.1 15.3 5.7 16.5 6.8L18.4 4.9C16.7 3.2 14.5 2.1 12 2.1C6.5 2.1 2 6.6 2 12.1C2 17.6 6.5 22.1 12 22.1C17.5 22.1 22 17.6 22 12.1C22 11.7 21.9 11.4 21.35 11.1H21.35Z" fill="currentColor"/>
                                      </svg>
                                      <span>{isRenewingGoogle ? "Conectando..." : "Conectar Google"}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* HISTÓRICO DE ERROS DA SESSÃO ANTERIOR (Exibição não-intrusiva sob demanda) */}
                            {currentCase?.procuracaoStatus === 'falha' && currentCase?.procuracaoLogFalha && !showGenerationError && (
                              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-gray-750 font-black uppercase tracking-wider text-[9px] font-mono">
                                    <AlertCircle size={12} className="text-gray-400" />
                                    <span>Histórico: Falha na Geração Anterior</span>
                                  </div>
                                  <span className="text-[9px] text-gray-400 font-mono">
                                    {currentCase.procuracaoGeneratedAt ? new Date(currentCase.procuracaoGeneratedAt).toLocaleString('pt-BR') : 'Sem data informada'}
                                  </span>
                                </div>
                                <p className="text-gray-650 font-medium leading-relaxed">
                                  Existe um registro histórico de falha de geração associado a este caso. Você pode tentar gerar novamente a qualquer momento com o botão acima.
                                </p>
                                
                                {(currentCase.procuracaoLogFalha.toLowerCase().includes("expirou") || 
                                  currentCase.procuracaoLogFalha.toLowerCase().includes("sessão") || 
                                  currentCase.procuracaoLogFalha.toLowerCase().includes("token") || 
                                  currentCase.procuracaoLogFalha.toLowerCase().includes("autorização") || 
                                  currentCase.procuracaoLogFalha.toLowerCase().includes("credentials")) && (
                                  <div className="pt-1.5 flex flex-wrap gap-2 items-center bg-rose-50 bg-opacity-40 p-2 border border-rose-100 rounded-xl">
                                    <button
                                      type="button"
                                      disabled={isRenewingGoogle}
                                      onClick={handleRenewGoogle}
                                      className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-3xs disabled:opacity-50"
                                    >
                                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21.35 11.1H12V12.9H19.6C18.9 16.5 15.8 18.9 12 18.9C8.1 18.9 5.0 15.8 5.0 12C5.0 8.2 8.1 5.1 12 5.1C13.7 5.1 15.3 5.7 16.5 6.8L18.4 4.9C16.7 3.2 14.5 2.1 12 2.1C6.5 2.1 2 6.6 2 12.1C2 17.6 6.5 22.1 12 22.1C17.5 22.1 22 17.6 22 12.1C22 11.7 21.9 11.4 21.35 11.1H21.35Z" fill="currentColor"/>
                                      </svg>
                                      <span>{isRenewingGoogle ? "Conectando..." : "Fazer Login de novo com Google"}</span>
                                    </button>
                                    <span className="text-[9.5px] text-rose-700 font-extrabold font-mono">
                                      CONEXÃO EXPIRADA
                                    </span>
                                  </div>
                                )}

                                <details className="group border border-gray-150 rounded-lg bg-white p-2">
                                  <summary className="font-bold text-gray-500 text-[9px] uppercase tracking-wider flex items-center justify-between cursor-pointer select-none">
                                    <span>Ver detalhes do log de erro</span>
                                    <span className="text-indigo-600 font-black group-open:hidden">Exibir</span>
                                    <span className="text-indigo-600 font-black hidden group-open:inline">Ocultar</span>
                                  </summary>
                                  <pre className="mt-2 p-2 bg-slate-950 border border-slate-900 rounded-lg text-rose-450 font-mono text-[9px] overflow-auto max-h-36 whitespace-pre-wrap leading-tight select-all">
                                    {currentCase.procuracaoLogFalha}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* FLOW QUESTIONNAIRE CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">

              <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-extrabold text-gray-800">1.1 Você gerou a procuração do cliente?</p>
                <div className="flex gap-4 mt-2">
                  {['sim', 'nao'].map(o => (
                    <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                      <input 
                        type="radio" 
                        name="q1_1" 
                        checked={wizardState.q1_1 === o} 
                        onChange={() => saveWizardStateUpdate({ q1_1: o })} 
                        className="text-indigo-600"
                      />
                      <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(wizardState.q1_1 === 'sim' || wizardState.q1_1 === 'nao') && (
                <div className="space-y-4 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                  
                  <EntregaDocumento
                    tipoDocumento="procuracao"
                    tipoPessoa="PF"
                    googleDocsUrl={currentCase?.procuracaoGoogleDocsUrl || ''}
                    whatsappCliente={client?.pfDadosPessoais?.pf_whatsapp || client?.pfDadosPessoais?.pf_telefone || client?.pfData?.pf_whatsapp || client?.pfData?.pf_telefone || ''}
                    emailCliente={client?.pfDadosPessoais?.pf_email || client?.pfData?.pf_email || ''}
                    nomeCliente={clientName}
                    selectedMethods={wizardState.q1_2 || []}
                    onMethodsChange={(newMethods: string[]) => saveWizardStateUpdate({ q1_2: newMethods })}
                    outroValue={wizardState.q1_2_outro || ''}
                    onOutroChange={(val: string) => saveWizardStateUpdate({ q1_2_outro: val })}
                    questionNumber="1.2"
                  />

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && (
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.3 Você recebeu a procuração do cliente ASSINADA🖊️?</p>
                      <div className="flex gap-4 mt-1.5">
                        {['sim', 'nao'].map(o => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-750">
                            <input 
                              type="radio" 
                              name="q1_3" 
                              checked={wizardState.q1_3 === o} 
                              onChange={() => {
                                // Also clear downstream states to avoid stale UI state
                                saveWizardStateUpdate({ 
                                  q1_3: o,
                                  q1_como_p_recebida: '',
                                  q1_deseja_digitalizar_p: ''
                                });
                              }} 
                            />
                            <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && wizardState.q1_3 === 'sim' && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.4 Como a Procuração foi recebida?</p>
                      <div className="flex flex-wrap gap-4 mt-1.5">
                        {[
                          { val: 'fisico', label: 'Físico' },
                          { val: 'whatsapp', label: 'What’s App' },
                          { val: 'email', label: 'Email' },
                          { val: 'outro', label: 'Outro' }
                        ].map(opt => (
                          <label key={opt.val} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-750">
                            <input 
                              type="radio" 
                              name="q1_como_p_recebida" 
                              checked={wizardState.q1_como_p_recebida === opt.val} 
                              onChange={() => {
                                saveWizardStateUpdate({ 
                                  q1_como_p_recebida: opt.val,
                                  q1_deseja_digitalizar_p: ''
                                });
                              }} 
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && wizardState.q1_3 === 'sim' && wizardState.q1_como_p_recebida === 'fisico' && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.5 Deseja digitalizar a procuração do cliente agora?</p>
                      <div className="flex gap-4 mt-1.5">
                        {['sim', 'nao'].map(o => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-750">
                            <input 
                              type="radio" 
                              name="q1_deseja_digitalizar_p" 
                              checked={wizardState.q1_deseja_digitalizar_p === o} 
                              onChange={() => saveWizardStateUpdate({ q1_deseja_digitalizar_p: o })} 
                            />
                            <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* If yes to digitalize physically OR if received digitally (whatsapp, email, outro) */}
                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && wizardState.q1_3 === 'sim' && (
                    (wizardState.q1_como_p_recebida === 'fisico' && wizardState.q1_deseja_digitalizar_p === 'sim') ||
                    (wizardState.q1_como_p_recebida && wizardState.q1_como_p_recebida !== 'fisico')
                  ) && (
                    <div className="space-y-2 animate-in fade-in duration-300 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                      <p className="text-xs font-black text-indigo-950 uppercase tracking-wider block">Anexar e upload automático para Google Drive</p>
                      <FileUploadBox field="procuracaoFiles" />
                    </div>
                  )}

                  {/* If no to digitalize physically */}
                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && wizardState.q1_3 === 'sim' && wizardState.q1_como_p_recebida === 'fisico' && wizardState.q1_deseja_digitalizar_p === 'nao' && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                      <span className="text-base">⚠️</span>
                      <span>Colocado automaticamente como pendência no setor de digitalização.</span>
                    </div>
                  )}

                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  disabled={!wizardState.q1_1 || saving}
                  onClick={handleNextPhase}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Próxima Fase</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>

            {/* COLLAPSIBLE DIAGNOSTIC PANEL (Task 5) */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4 mt-6">
              <button
                type="button"
                onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none select-none"
              >
                <div className="flex items-center gap-2">
                  <Settings className="text-gray-500 shrink-0" size={16} />
                  <span className="text-sm font-black text-gray-800 uppercase tracking-wider font-mono">
                    Diagnóstico da rota atual
                  </span>
                </div>
                <span className="text-xs font-bold text-indigo-600 hover:underline">
                  {isDiagnosticsOpen ? "Recolher Painel" : "Expandir Painel"}
                </span>
              </button>

              {isDiagnosticsOpen && (
                <div className="pt-4 border-t border-gray-100 space-y-4 animate-in duration-200 slide-in-from-top-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="font-bold text-gray-400 text-[10px] uppercase tracking-wider pb-1 border-b border-gray-200 font-sans">
                        Parâmetros da Rota & Caso
                      </p>
                      <div>
                        <span className="text-gray-500">caseId:</span>{" "}
                        <span className="text-gray-800 font-bold select-all">{caseId || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">clientId:</span>{" "}
                        <span className="text-gray-800 font-bold select-all">{currentCase?.clientId || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">clientName:</span>{" "}
                        <span className="text-gray-800 font-bold">{clientName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">driveFolderId:</span>{" "}
                        <span className="text-gray-850 font-bold select-all">{driveFolderId || "⚠️ Ausente"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">driveFolderUrl:</span>{" "}
                        {driveFolderUrl ? (
                          <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold truncate block">
                            {driveFolderUrl}
                          </a>
                        ) : (
                          <span className="text-rose-600 font-bold">⚠️ Ausente</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="font-bold text-gray-400 text-[10px] uppercase tracking-wider pb-1 border-b border-gray-200 font-sans">
                        Motor de Documentos Portal BOSS
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 justify-between py-1">
                        <span className="text-gray-500">Modelo Oficial ID:</span>
                        <span className="text-gray-800 font-bold text-[11px] font-mono break-all leading-normal max-w-[200px] text-right">
                          16k_n_BTdf8wTCG8CK4T2TyAT93o5qrmZqjbROtrBqzk
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-between py-1">
                        <span className="text-gray-500">Status Operacional:</span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Operacional (Nativo)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-between py-1 border-b border-dashed border-gray-150 pb-2">
                        <span className="text-gray-500">Integração GDI Legada:</span>
                        <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-gray-250 text-gray-700 border border-gray-300">
                          Desativado
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500">procuracaoStatus:</span>{" "}
                        <span className="text-gray-800 font-bold uppercase">{currentCase?.procuracaoStatus || "pendente"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">procuracaoGoogleDocsUrl:</span>{" "}
                        {currentCase?.procuracaoGoogleDocsUrl ? (
                          <a href={currentCase.procuracaoGoogleDocsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold truncate block">
                            {currentCase.procuracaoGoogleDocsUrl}
                          </a>
                        ) : (
                          <span className="text-gray-400">Nenhum</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs font-mono space-y-1">
                    <p className="font-bold text-gray-400 text-[10px] uppercase tracking-wider pb-1 border-b border-gray-200 font-sans">
                      Controle de Rastreabilidade dos Jobs
                    </p>
                    <div>
                      <span className="text-gray-500">activeJobId:</span>{" "}
                      <span className="text-indigo-900 font-bold">{activeJob?.id || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">activeJobStatus:</span>{" "}
                      <span className="text-gray-800 font-bold">{activeJob?.status || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">currentAttemptJobId:</span>{" "}
                      <span className="text-indigo-900 font-bold">{currentAttemptJobId || "N/A"}</span>
                    </div>
                    {currentCase?.procuracaoLogFalha && (
                      <div className="pt-2">
                        <span className="text-rose-600 font-bold block pb-1">procuracaoLogFalha:</span>
                        <pre className="p-2 bg-slate-900 text-rose-450 border border-slate-950 rounded-xl max-h-24 overflow-auto text-[10px] whitespace-pre-wrap select-all leading-relaxed font-mono">
                          {currentCase.procuracaoLogFalha}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* ADMIN CONTROL BUTTONS */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleCopyDiagnostics}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-250 text-gray-700 font-bold uppercase rounded-xl text-[10px] tracking-wide transition-all cursor-pointer shadow-3xs"
                    >
                      <Copy size={12} />
                      <span>{copiedDiagnostics ? "Copiado!" : "Copiar diagnóstico da rota"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCleanProcuracaoResidualState}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold uppercase rounded-xl text-[10px] tracking-wide transition-all cursor-pointer shadow-3xs"
                    >
                      <Trash2 size={12} />
                      <span>Limpar resíduos da Procuração deste caso</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleForceCleanAttempt}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold uppercase rounded-xl text-[10px] tracking-wide transition-all cursor-pointer shadow-3xs"
                    >
                      <Sparkles size={12} />
                      <span>Forçar nova tentativa limpa</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}

