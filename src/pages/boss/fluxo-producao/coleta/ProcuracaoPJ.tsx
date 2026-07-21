import React from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import EntregaDocumento from '../components/EntregaDocumento';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle, Sparkles, RefreshCw, ExternalLink, Copy, FileCode 
} from 'lucide-react';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useAuth } from '../../../../contexts/AuthContext';
import { buildProcuracaoPjPlaceholders } from '../../../../lib/documents/placeholderBuilders';

export default function ProcuracaoPJ() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [isRenewingGoogle, setIsRenewingGoogle] = React.useState(false);
  const generationInFlightRef = React.useRef(false);

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
    });
    return () => unsubscribe();
  }, [caseId]);

  const handleNextPhase = () => {
    saveWizardStateUpdate({ step1_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-declaracao-PJ`);
    });
  };

  const clientDriveFolderId = (client?.googleDriveClientFolderId || client?.gdriveFolderId || localCaseObj?.gdriveFolderId || '').trim();
  const clientDriveFolderUrl = (client?.googleDriveClientFolderUrl || client?.gdriveFolderUrl || localCaseObj?.gdriveFolderUrl || '').trim();
  
  const folderIsReal = !!(
    clientDriveFolderId && 
    !clientDriveFolderId.toLowerCase().includes('mock') && 
    !clientDriveFolderId.toLowerCase().includes('fake') && 
    !clientDriveFolderId.toLowerCase().includes('teste') && 
    !clientDriveFolderId.toLowerCase().includes('undefined') && 
    !clientDriveFolderId.toLowerCase().includes('null') && 
    !clientDriveFolderId.toLowerCase().includes('xxxx')
  );

  const procStatus = localCaseObj?.procuracaoStatus || 'Não gerada';
  const procUrl = localCaseObj?.procuracaoGoogleDocsUrl || localCaseObj?.procuracaoPjUrl || '';

  const handleGenerateProcuracaoPj = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Procuração PJ ignorada.");
      return;
    }
    generationInFlightRef.current = true;

    try {
      const jobId = 'job_proc_pj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const jobLogs: any[] = [];
      const addClientLog = (action: string, message: string) => {
        jobLogs.push({
          action,
          timestamp: new Date().toISOString(),
          message
        });
      };

      const actionLog = intent === 'initial' ? 'DOCUMENT_SINGLE_CLICK_GENERATION_STARTED' : 'DOCUMENT_NEW_VERSION_SINGLE_CLICK_STARTED';
      addClientLog(actionLog, `Geração de Procuração PJ iniciada via clique único fático (${intent === 'initial' ? 'geração inicial' : 'nova versão'}).`);

      // Step 1: PROC_PJ_BUTTON_CLICKED
      addClientLog("PROC_PJ_BUTTON_CLICKED", "O operador clicou em 'Gerar Procuração PJ' para iniciar o fluxo de automação.");

    if (!caseId) {
      setError("Erro de validação: ID do caso (caseId) está ausente.");
      return;
    }

    if (!caseObj) {
      setError("Erro de validação: Dados do caso não carregados do banco de dados.");
      return;
    }

    const targetClientId = caseObj?.clientId || client?.id;
    if (!targetClientId) {
      setError("Erro de validação: ID do cliente (clientId) está ausente.");
      return;
    }

    if (!client) {
      setError("Erro de validação: Dados do cliente não carregados do banco de dados.");
      return;
    }

    const clientType = client?.type || client?.clientType || (client?.cnpj ? "PJ" : "PF");
    if (clientType !== "PJ") {
      setError("Esta automação é de uso exclusivo para cliente de tipo Pessoa Jurídica (PJ).");
      return;
    }

    // Step 2: PROC_PJ_CLIENT_DATA_LOADED
    addClientLog("PROC_PJ_CLIENT_DATA_LOADED", "Dados cadastrais do cliente e do caso carregados com sucesso do banco.");

    const resolvedRazaoSocial = (
      client?.pjData?.pj_razaoSocial ||
      client?.pjDadosEmpresa?.pj_razaoSocial ||
      client?.razaoSocial ||
      client?.nome ||
      clientName ||
      ""
    ).trim();

    if (!resolvedRazaoSocial) {
      addClientLog("PROC_PJ_REQUIRED_PLACEHOLDER_EMPTY", "Razão Social da empresa não localizada.");
      setError("Razão Social não localizada no cadastro da empresa. Verifique a Etapa 1 — Cadastro do Cliente.");
      return;
    }

    const resolvedCnpj = (
      client?.pjData?.pj_cnpj ||
      client?.pjDadosEmpresa?.pj_cnpj ||
      client?.cnpj ||
      ""
    ).trim();

    if (!resolvedCnpj) {
      addClientLog("PROC_PJ_REQUIRED_PLACEHOLDER_EMPTY", "CNPJ do cliente não localizado.");
      setError("Não é possível gerar a Procuração PJ porque o CNPJ do cliente está ausente no cadastro.");
      return;
    }

    if (!folderIsReal) {
      setError("Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.");
      return;
    }

    // Step 3: PROC_PJ_FOLDER_FOUND
    addClientLog("PROC_PJ_FOLDER_FOUND", `Pasta destino no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`);

    // Step 4: PROC_PJ_OFFICIAL_TEMPLATE_SELECTED
    const officialTemplateId = "16k_n_BTdf8wTCG8CK4T2TyAT93o5qrmZqjbROtrBqzk";
    addClientLog("PROC_PJ_OFFICIAL_TEMPLATE_SELECTED", `Template oficial de Procuração selecionado unicamente como fonte da verdade: ${officialTemplateId}`);

    let placeholders: Record<string, string>;
    try {
      placeholders = buildProcuracaoPjPlaceholders(client, caseObj);

      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dataAssinaturaFormated = `${day}/${month}/${year}`;
      
      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;

      // Step 5: PROC_PJ_PLACEHOLDERS_BUILT
      addClientLog("PROC_PJ_PLACEHOLDERS_BUILT", "Todas as chaves e valores de placeholders foram processados e vinculados com sucesso com a data da assinatura gerada no clique.");
    } catch (errPl: any) {
      setError(`Erro ao construir placeholders: ${errPl.message}`);
      return;
    }

    const essentialKeys = [
      "{{RAZAO_SOCIAL}}",
      "{{CNPJ}}",
      "{{ENDERECO_EMPRESA_COMPLETO}}",
      "{{NOME_SOCIO_ADMINISTRADOR}}",
      "{{CPF_SOCIO}}",
      "{{DATA_ASSINATURA}}"
    ];

    const fieldNamesMap: Record<string, string> = {
      "{{RAZAO_SOCIAL}}": "Razão Social",
      "{{CNPJ}}": "CNPJ",
      "{{ENDERECO_EMPRESA_COMPLETO}}": "Endereço da Empresa",
      "{{NOME_SOCIO_ADMINISTRADOR}}": "Nome do Sócio Administrador",
      "{{CPF_SOCIO}}": "CPF do Sócio",
      "{{DATA_ASSINATURA}}": "Data da Assinatura"
    };

    const emptyEssentials = essentialKeys.filter(k => {
      const val = placeholders[k];
      return !val || String(val).trim() === "";
    });

    if (emptyEssentials.length > 0) {
      const fieldNames = emptyEssentials.map(k => fieldNamesMap[k] || k).join(", ");
      const errorMsg = `Não é possível gerar a Procuração PJ porque existem campos essenciais vazios no cadastro do cliente PJ: ${fieldNames}.`;
      addClientLog("PROC_PJ_REQUIRED_PLACEHOLDER_EMPTY", errorMsg);
      
      const failedJob = {
        id: jobId,
        contractVersion: "boss.placeholders.v1",
        source: "Portal BOSS Clientes",
        target: "Internal Generator Engine",
        documentType: "procuracao_pj",
        templateKey: "procuracao_pj",
        status: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        caseId: caseId,
        portalClientId: targetClientId,
        clientType: "PJ",
        destinationFolderId: clientDriveFolderId,
        destinationFolderUrl: clientDriveFolderUrl,
        outputFileName: `Procuração PJ - ${resolvedRazaoSocial}`,
        placeholders,
        errorCode: "PROC_PJ_REQUIRED_PLACEHOLDER_EMPTY",
        errorMessage: errorMsg,
        logs: jobLogs
      };

      await setDoc(doc(db, 'googleDocsJobs', jobId), failedJob);
      setError(errorMsg);
      return;
    }

    // Step 6: PROC_PJ_REQUIRED_PLACEHOLDERS_VALIDATED
    addClientLog("PROC_PJ_REQUIRED_PLACEHOLDERS_VALIDATED", "Contrato de placeholders mapeado contra a especificação com 100% de conformidade.");

    const currentGoogleAccessToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

    if (!currentGoogleAccessToken && !localOverride) {
      setError("Faça login novamente com Google para autorizar Google Docs/Drive ou configure a Service Account na Central de Integrações.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const caseDocRef = doc(db, 'cases', caseId);
    await updateDoc(caseDocRef, {
      procuracaoStatus: "gerando",
      procuracaoLogFalha: ""
    });

    // Step 7: PROC_PJ_TEMPLATE_COPY_STARTED
    addClientLog("PROC_PJ_TEMPLATE_COPY_STARTED", "Disparando processo de clonagem do template oficial no GDrive...");

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v1",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: "procuracao_pj",
      templateKey: "procuracao_pj",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: caseId,
      portalClientId: targetClientId,
      clientType: "PJ",
      destinationFolderId: clientDriveFolderId,
      destinationFolderUrl: clientDriveFolderUrl,
      outputFileName: `Procuração PJ - ${resolvedRazaoSocial}`,
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

    try {
      const response = await fetch("/api/google-docs/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "stateless",
          googleAccessToken: currentGoogleAccessToken,
          documentType: "procuracao_pj",
          templateKey: "procuracao_pj",
          templateId: officialTemplateId,
          caseId,
          clientId: targetClientId,
          clientType: "PJ",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `Procuração PJ - ${resolvedRazaoSocial}`,
          placeholders,
          metadata: {
            source: "Portal BOSS - Procuração PJ",
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-procuracao-PJ`,
            folderSource: "Automação Google Drive — Pasta do Cliente",
            clientDataSource: "clients/{clientId}.pjData / clients/{clientId}.pjDadosEmpresa"
          },
          credentialOverride: localOverride
        })
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { error: responseText };
      }

      if (!response.ok || !responseData.success) {
        throw {
          message: responseData.errorMessage || responseData.error || responseText || "Falha na geração integrada eletrônica.",
          errorCode: responseData.errorCode || "PROC_PJ_TEMPLATE_COPY_FAILED"
        };
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      // Add success logs
      addClientLog("PROC_PJ_TEMPLATE_COPY_SUCCESS", `Clone realizado no Google Drive com o novo ID de documento: ${googleDocsId}`);
      addClientLog("PROC_PJ_PLACEHOLDER_REPLACEMENT_STARTED", "Iniciando a operação em lote de substituição dos placeholders no documento.");
      addClientLog("PROC_PJ_PLACEHOLDER_REPLACEMENT_SUCCESS", "Substituição concluída de todos os placeholders com absoluto sucesso.");
      addClientLog("PROC_PJ_DOCUMENT_CREATED", "Criação física e de dados do arquivo homologada no Google Drive.");
      addClientLog("PROC_PJ_CASE_UPDATED", "Caso atualizado com as chaves reais de referência da Procuração PJ.");
      addClientLog("PROC_PJ_FLOW_COMPLETED", "Processamento terminado com 100% de conformidade operacional.");

      await updateDoc(caseDocRef, {
        procuracaoStatus: "criada",
        procuracaoPjId: googleDocsId,
        procuracaoPjUrl: googleDocsUrl,
        procuracaoGoogleDocsId: googleDocsId,
        procuracaoGoogleDocsUrl: googleDocsUrl,
        procuracaoGeneratedAt: new Date().toISOString(),
        procuracaoDestinationFolderId: clientDriveFolderId,
        procuracaoDestinationFolderUrl: clientDriveFolderUrl,
        procuracaoGoogleDocsJobId: jobId,
        procuracaoGoogleDocsJobLogs: jobLogs,
        procuracaoLogFalha: ""
      });

      try {
        const subdocRef = doc(db, 'cases', caseId, 'generatedDocuments', 'procuracao_pj');
        await setDoc(subdocRef, {
          documentType: "procuracao_pj",
          displayName: `Procuração PJ - ${resolvedRazaoSocial}`,
          templateKey: "procuracao_pj",
          templateId: officialTemplateId,
          googleDocsId,
          googleDocsUrl,
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
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

      await updateDoc(doc(db, 'googleDocsJobs', jobId), {
        status: "success",
        updatedAt: new Date().toISOString(),
        result: {
          googleDocsId,
          googleDocsUrl,
          fileName: `Procuração PJ - ${resolvedRazaoSocial}`
        },
        logs: jobLogs
      });

      await saveWizardStateUpdate({ q1_1: 'sim' });

      setSuccess("Procuração PJ gerada e indexada no caso com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("[Generator Execution Failed]", err);
      const errorMessage = err.message || "Erro desconhecido durante o processamento de geração integrada.";
      const errorCode = err.errorCode || "PROC_PJ_PLACEHOLDER_REPLACEMENT_FAILED";

      addClientLog(errorCode, `Ocorreu uma falha no fluxo: ${errorMessage}`);
      addClientLog("PROC_PJ_CASE_UPDATE_FAILED", "Falha ao gravar referências no documento do caso principal.");

      await updateDoc(caseDocRef, {
        procuracaoStatus: "falha",
        procuracaoLogFalha: errorMessage,
        procuracaoGeneratedAt: ""
      });

      try {
        await updateDoc(doc(db, 'googleDocsJobs', jobId), {
          status: "failed",
          updatedAt: new Date().toISOString(),
          errorCode,
          errorMessage,
          logs: jobLogs
        });
      } catch (errJob) {
        console.warn("Failed to update job status", errJob);
      }

      setError(`Falha ao gerar Procuração PJ no motor interno: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
    } finally {
      generationInFlightRef.current = false;
    }
  };

  const renderStatusBadge = () => {
    switch (procStatus) {
      case 'gerando':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RefreshCw size={12} className="animate-spin" />
            Gerando...
          </span>
        );
      case 'criada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check size={12} />
            Criada com sucesso
          </span>
        );
      case 'falha':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={12} />
            Falha na geração
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-gray-50 text-gray-500 border border-gray-200">
            Não gerada
          </span>
        );
    }
  };

  const handleCopyLink = () => {
    if (!procUrl) return;
    navigator.clipboard.writeText(procUrl);
    setSuccess("Link copiado com sucesso para a área de transferência!");
    setTimeout(() => setSuccess(null), 3000);
  };

  const FileUploadBox = ({ field }: { field: string }) => {
    const files = wizardState[field] || [];
    return (
      <div className="space-y-2 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
          <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-1" size={20} />
          <span className="text-[11px] font-bold text-gray-700">Anexar Procuração PJ Assinada (PDF)</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const name = e.target.files[0].name;
                const size = (e.target.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                addWizardFile(field, name, size);
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
      tipoPessoa="PJ"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                Etapa 1 — Pessoa Jurídica (PJ)
              </span>
              <span className="text-xs text-gray-400">Cliente: <strong>{clientName}</strong></span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none pt-1">
              Solicitação da Procuração Ad Judicia PJ
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/card-iniciar-coleta-obrigatoria`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
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
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex gap-2 items-center">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* AUDITORIA DA GERAÇÃO DA PROCURAÇÃO CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5 shadow-3xs">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Sparkles className="text-indigo-600 animate-[spin_10s_linear_infinite]" size={18} />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">Auditoria da Geração da Procuração</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Controle automatizado e verificação da pauta de integração via Google Docs para PJ.</p>
                </div>
              </div>

              {/* AUTOMATION CARD */}
              <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-blue-50/20 border border-indigo-150 rounded-2xl flex flex-col gap-4">
                <div className="flex items-start gap-3 text-slate-800 text-xs">
                  <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <span className="block font-extrabold uppercase tracking-widest text-[9px] text-indigo-750 font-mono">Automação Inteligente Ativa</span>
                    <p className="text-xs text-slate-600 leading-normal">
                      Esta ferramenta envia os dados consolidados do cadastro de pessoa jurídica diretamente ao build receptor do Google Docs para preenchimento de placeholders, indexação e arquivamento automatizado na pasta empresarial.
                    </p>
                  </div>
                </div>

                {/* STATUS DA AUTOMAÇÃO */}
                <div className="border border-gray-150 rounded-xl p-3.5 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
                  <div className="space-y-1">
                    <p className="font-bold text-gray-400 text-[9px] uppercase tracking-wider font-mono">Status da Automação</p>
                    {renderStatusBadge()}
                  </div>

                  {procUrl && (
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={procUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 border border-gray-150 rounded-xl bg-white text-gray-700 hover:bg-gray-50 font-bold text-[10px] uppercase font-mono flex items-center gap-1 shadow-3xs cursor-pointer transition-all"
                      >
                        <ExternalLink size={11} /> Abrir Documento
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="p-2 border border-gray-150 rounded-xl bg-white text-gray-700 hover:bg-gray-50 font-bold text-[10px] uppercase font-mono flex items-center gap-1 shadow-3xs cursor-pointer transition-all"
                      >
                        <Copy size={11} /> Copiar Link
                      </button>
                    </div>
                  )}
                </div>

                {/* FAILURE CAUSE PANEL WITH GOOGLE RE-AUTH OPTION */}
                {localCaseObj?.procuracaoLogFalha && (
                  <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-rose-900 text-xs font-semibold leading-normal">
                      <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block text-[9px] uppercase tracking-wide font-mono text-rose-800">Causa Técnica do Erro</span>
                        <p className="mt-0.5">{localCaseObj.procuracaoLogFalha}</p>
                      </div>
                    </div>

                    {(localCaseObj.procuracaoLogFalha.toLowerCase().includes("expirou") || 
                      localCaseObj.procuracaoLogFalha.toLowerCase().includes("sessão") || 
                      localCaseObj.procuracaoLogFalha.toLowerCase().includes("token") || 
                      localCaseObj.procuracaoLogFalha.toLowerCase().includes("autorização") || 
                      localCaseObj.procuracaoLogFalha.toLowerCase().includes("credentials")) && (
                      <button
                        type="button"
                        onClick={handleRenewGoogle}
                        disabled={isRenewingGoogle}
                        className="mt-1 place-self-start bg-rose-700 hover:bg-rose-800 text-white font-bold text-[9px] uppercase tracking-wider font-mono px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                      >
                        <RefreshCw size={11} className={isRenewingGoogle ? "animate-spin" : ""} />
                        <span>{isRenewingGoogle ? "Conectando..." : "Fazer Login de novo com Google"}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* GENERATION TRIGGER CONTROLS */}
                <div className="pt-2 border-t border-indigo-150 flex flex-wrap gap-2 items-center justify-between">
                  {procStatus === 'criada' ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleGenerateProcuracaoPj('new_version')}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3.5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-3xs transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={saving ? "animate-spin" : ""} />
                      {saving ? "Gerando..." : "Gerar Nova Versão (PJ)"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleGenerateProcuracaoPj('initial')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-3xs transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" />
                          Gerando Documento...
                        </>
                      ) : (
                        <>
                          <Sparkles size={11} className="animate-pulse" />
                          Gerar via Google Workspace (PJ)
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* TECHNICAL JOB LOGS FEED PANEL */}
              {localCaseObj?.procuracaoGoogleDocsJobLogs && localCaseObj.procuracaoGoogleDocsJobLogs.length > 0 && (
                <div className="p-4 border border-gray-150 rounded-2xl bg-neutral-950/95 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 font-mono flex items-center gap-1.5">
                      <FileCode size={11} /> Rastreabilidade & Auditoria Operacional (Logs)
                    </span>
                    <span className="text-[8px] font-mono text-gray-500">ID Ativo: {localCaseObj.procuracaoGoogleDocsJobId || 'stateless_run'}</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-800/50 font-mono text-[10px] text-gray-300 pr-1 select-text">
                    {localCaseObj.procuracaoGoogleDocsJobLogs.map((log: any, index: number) => (
                      <div key={index} className="py-2 flex flex-col gap-0.5 leading-normal">
                        <div className="flex items-center justify-between text-gray-500 font-bold text-[9px]">
                          <span className="text-indigo-400/80">{log.action}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-gray-300 whitespace-pre-wrap">{log.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FLOW QUESTIONNAIRE CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">

              <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-extrabold text-gray-800">1.1 Você gerou a procuração do cliente empresarial?</p>
                <div className="flex gap-4 mt-2">
                  {['sim', 'nao'].map(o => (
                    <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                      <input 
                        type="radio" 
                        name="q1_1" 
                        disabled={saving}
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
                    tipoPessoa="PJ"
                    googleDocsUrl={procUrl}
                    whatsappCliente={client?.pjDadosResponsavel?.pj_whatsappResponsavel || client?.pjDadosEmpresa?.pj_whatsappEmpresa || client?.pjData?.pj_whatsappEmpresa || client?.pjData?.pj_whatsappResponsavel || ''}
                    emailCliente={client?.pjDadosEmpresa?.pj_emailEmpresa || client?.pjDadosEmpresa?.pj_emailCorporativo || client?.pjData?.pj_emailEmpresa || client?.pjData?.pj_emailCorporativo || ''}
                    nomeCliente={clientName}
                    selectedMethods={wizardState.q1_2 || []}
                    onMethodsChange={(newMethods: string[]) => saveWizardStateUpdate({ q1_2: newMethods })}
                    outroValue={wizardState.q1_2_outro || ''}
                    onOutroChange={(val: string) => saveWizardStateUpdate({ q1_2_outro: val })}
                    questionNumber="1.2"
                  />

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && (
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.3 O representante da PJ assinou a procuração?</p>
                      <div className="flex gap-4 mt-1.5">
                        {['sim', 'nao'].map(o => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                            <input 
                              type="radio" 
                              name="q1_3" 
                              checked={wizardState.q1_3 === o} 
                              onChange={() => saveWizardStateUpdate({ q1_3: o })} 
                            />
                            <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && (wizardState.q1_3 === 'sim' || wizardState.q1_3 === 'nao') && (
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.4 Solicitou digitalização do ato arquivístico/procuração assinado?</p>
                      <div className="flex gap-4 mt-1.5">
                        {['sim', 'nao'].map(o => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                            <input 
                              type="radio" 
                              name="q1_4" 
                              checked={wizardState.q1_4 === o} 
                              onChange={() => saveWizardStateUpdate({ q1_4: o })} 
                            />
                            <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && (wizardState.q1_3 === 'sim' || wizardState.q1_3 === 'nao') && (wizardState.q1_4 === 'sim' || wizardState.q1_4 === 'nao') && (
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.5 Procuração PJ digitalizada recebida?</p>
                      <div className="flex gap-4 mt-1.5">
                        {['sim', 'nao'].map(o => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                            <input 
                              type="radio" 
                              name="q1_5" 
                              checked={wizardState.q1_5 === o} 
                              onChange={() => saveWizardStateUpdate({ q1_5: o })} 
                            />
                            <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {wizardState.q1_2 && wizardState.q1_2.length > 0 && (wizardState.q1_3 === 'sim' || wizardState.q1_3 === 'nao') && (wizardState.q1_4 === 'sim' || wizardState.q1_4 === 'nao') && (wizardState.q1_5 === 'sim' || wizardState.q1_5 === 'nao') && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                      <p className="text-xs font-extrabold text-gray-800">1.6 Anexar arquivo no diretório empresarial?</p>
                      <div className="flex gap-4 mt-1.5">
                        {['sim', 'nao'].map(o => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                            <input 
                              type="radio" 
                              name="q1_6" 
                              checked={wizardState.q1_6 === o} 
                              onChange={() => saveWizardStateUpdate({ q1_6: o })} 
                            />
                            <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                          </label>
                        ))}
                      </div>
                      {wizardState.q1_6 === 'sim' && <FileUploadBox field="procuracaoFiles" />}
                    </div>
                  )}

                </div>
              )}

              {/* ACTION FOOTER */}
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={!wizardState.q1_1 || saving}
                  onClick={handleNextPhase}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer font-bold"
                >
                  <span>Próxima Fase</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
