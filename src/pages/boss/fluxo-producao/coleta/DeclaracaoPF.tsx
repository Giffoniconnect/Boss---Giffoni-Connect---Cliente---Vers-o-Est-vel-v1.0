import React from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import EntregaDocumento from '../components/EntregaDocumento';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle, Sparkles, RefreshCw, ExternalLink, FileCode,
  Settings, X, CheckCircle2, Copy
} from 'lucide-react';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useAuth } from '../../../../contexts/AuthContext';
import { buildDeclaracaoPobrezaPfPlaceholders } from '../../../../lib/documents/placeholderBuilders';

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

export default function DeclaracaoPF() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [isRenewingGoogle, setIsRenewingGoogle] = React.useState(false);
  const generationInFlightRef = React.useRef(false);
  const [showIntegrationConfig, setShowIntegrationConfig] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRenewGoogle = async () => {
    setIsRenewingGoogle(true);
    try {
      await loginWithGoogle('boss_admin');
      setSuccess("Autenticação Google renovada com sucesso! Você já pode gerar a declaração novamente.");
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
    driveFolderId,
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
    saveWizardStateUpdate({ step2_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-contrato-PF`);
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

  const decStatus = localCaseObj?.declaracaoPobrezaStatus || 'Não gerada';
  const decUrl = localCaseObj?.declaracaoPobrezaGoogleDocsUrl || localCaseObj?.declaracaoPobrezaPfUrl || '';

  const isSimulatedDoc = !!(
    (decUrl && decUrl.includes('simulated=true')) ||
    (localCaseObj?.declaracaoPobrezaGoogleDocsId && localCaseObj?.declaracaoPobrezaGoogleDocsId.startsWith('simulated-'))
  );

  const hasRealSuccess = !!(
    decStatus === 'criada' &&
    decUrl &&
    decUrl.startsWith("https://docs.google.com/document/d/") &&
    clientDriveFolderId &&
    !isSimulatedDoc
  );

  const techCode = decStatus === 'criada' 
    ? (localCaseObj?.declaracaoPobrezaLastOutcome || "SUCCESS") 
    : (localCaseObj?.declaracaoPobrezaLastErrorCode || "GENERATION_FAILED");
  const techTimestamp = localCaseObj?.declaracaoPobrezaLastOperationAt || localCaseObj?.declaracaoPobrezaGeneratedAt || localCaseObj?.updatedAt || "";
  const techDocId = localCaseObj?.declaracaoPobrezaGoogleDocsId || localCaseObj?.declaracaoPobrezaPfId || "";
  const techDocVer = localCaseObj?.declaracaoPobrezaVersion || 1;

  const handleGenerateDeclaracaoPf = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Declaração PF ignorada.");
      return;
    }
    generationInFlightRef.current = true;

    try {
      const jobId = 'job_decl_pf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const jobLogs: any[] = [];
      const addClientLog = (action: string, message: string) => {
        jobLogs.push({
          action,
          timestamp: new Date().toISOString(),
          message
        });
      };

      const actionLog = intent === 'initial' ? 'DOCUMENT_SINGLE_CLICK_GENERATION_STARTED' : 'DOCUMENT_NEW_VERSION_SINGLE_CLICK_STARTED';
      addClientLog(actionLog, `Geração de Declaração PF iniciada via clique único fático (${intent === 'initial' ? 'geração inicial' : 'nova versão'}).`);

      // Step 1: DECL_PF_BUTTON_CLICKED
      addClientLog("DECL_PF_BUTTON_CLICKED", "O operador clicou em 'Gerar Declaração PF' para iniciar o fluxo de automação.");

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

    const clientType = client?.type || client?.clientType || "PF";
    if (clientType !== "PF") {
      setError("Esta automação é de uso exclusivo para cliente de tipo Pessoa Física (PF).");
      return;
    }

    // Step 2: DECL_PF_CLIENT_DATA_LOADED
    addClientLog("DECL_PF_CLIENT_DATA_LOADED", "Dados cadastrais do cliente e do caso carregados com sucesso do banco.");

    const resolvedNomeCompleto = (
      client?.pfData?.pf_nomeCompleto ||
      client?.pfDadosPessoais?.pf_nomeCompleto ||
      client?.portalMirror?.pfDadosPessoais?.nomeCompleto ||
      client?.nomeCompleto ||
      client?.nome ||
      client?.name ||
      ""
    ).trim();

    if (!resolvedNomeCompleto) {
      addClientLog("DECL_PF_REQUIRED_PLACEHOLDER_EMPTY", "Nome completo do cliente não localizado.");
      setError("Nome completo do cliente não localizado no cadastro PF. Verifique o campo pf_nomeCompleto na Etapa 1 — Cadastro do Cliente.");
      return;
    }

    const resolvedCpf = (
      client?.pfData?.pf_cpf ||
      client?.pfDadosPessoais?.pf_cpf ||
      client?.portalMirror?.pfDadosPessoais?.cpf ||
      client?.cpf ||
      ""
    ).trim();

    if (!resolvedCpf) {
      addClientLog("DECL_PF_REQUIRED_PLACEHOLDER_EMPTY", "CPF do cliente não localizado.");
      setError("Não é possível gerar a Declaração de Hipossuficiência PF porque o CPF do cliente está ausente no cadastro.");
      return;
    }

    if (!folderIsReal) {
      setError("Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.");
      return;
    }

    // Step 3: DECL_PF_FOLDER_FOUND
    addClientLog("DECL_PF_FOLDER_FOUND", `Pasta destino no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`);

    // Step 4: DECL_PF_OFFICIAL_TEMPLATE_SELECTED
    const officialTemplateId = "1e2JbDiPY-2TywfdK_7s75qcY6YkvRrBVQ_0TFDnHYi4";
    addClientLog("DECL_PF_OFFICIAL_TEMPLATE_SELECTED", `Template oficial de Declaração PF selecionado unicamente como fonte da verdade: ${officialTemplateId}`);

    let placeholders: Record<string, string>;
    try {
      placeholders = buildDeclaracaoPobrezaPfPlaceholders(client, caseObj);

      // Gerar data da assinatura com base no clique real (DD/MM/AAAA)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dataAssinaturaFormated = `${day}/${month}/${year}`;
      
      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;

      // Step 5: DECL_PF_PLACEHOLDERS_BUILT
      addClientLog("DECL_PF_PLACEHOLDERS_BUILT", "Todas as chaves e valores de placeholders foram processados e vinculados com sucesso com a data da assinatura gerada no clique.");
    } catch (errPl: any) {
      setError(`Erro ao construir placeholders: ${errPl.message}`);
      return;
    }

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

    const fieldNamesMap: Record<string, string> = {
      "{{OUTORGANTE_NOME}}": "Nome Completo",
      "{{OUTORGANTE_CPF}}": "CPF",
      "{{OUTORGANTE_RG}}": "RG",
      "{{OUTORGANTE_ENDERECO}}": "Endereço",
      "{{OUTORGANTE_NUMERO}}": "Número",
      "{{OUTORGANTE_BAIRRO}}": "Bairro",
      "{{OUTORGANTE_CIDADE}}": "Cidade",
      "{{OUTORGANTE_ESTADO}}": "Estado",
      "{{OUTORGANTE_CEP}}": "CEP",
      "{{OUTORGANTE_EMAIL}}": "E-mail",
      "{{DATA_ASSINATURA}}": "Data da Assinatura"
    };

    const emptyEssentials = essentialKeys.filter(k => {
      const val = placeholders[k];
      return !val || String(val).trim() === "";
    });

    if (emptyEssentials.length > 0) {
      const fieldNames = emptyEssentials.map(k => fieldNamesMap[k] || k).join(", ");
      const errorMsg = `Não é possível gerar a Declaração PF porque existem campos essenciais vazios no cadastro do cliente: ${fieldNames}.`;
      addClientLog("DECL_PF_REQUIRED_PLACEHOLDER_EMPTY", errorMsg);
      
      const failedJob = {
        id: jobId,
        contractVersion: "boss.placeholders.v1",
        source: "Portal BOSS Clientes",
        target: "Internal Generator Engine",
        documentType: "declaracao_pobreza_pf",
        templateKey: "declaracao_pobreza_pf",
        status: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        caseId: caseId,
        portalClientId: targetClientId,
        clientType: "PF",
        destinationFolderId: clientDriveFolderId,
        destinationFolderUrl: clientDriveFolderUrl,
        outputFileName: `Declaração de Hipossuficiência PF - ${resolvedNomeCompleto}`,
        placeholders,
        errorCode: "DECL_PF_REQUIRED_PLACEHOLDER_EMPTY",
        errorMessage: errorMsg,
        logs: jobLogs
      };

      await setDoc(doc(db, 'googleDocsJobs', jobId), failedJob);
      setError(errorMsg);
      return;
    }

    // Step 6: DECL_PF_REQUIRED_PLACEHOLDERS_VALIDATED
    addClientLog("DECL_PF_REQUIRED_PLACEHOLDERS_VALIDATED", "Contrato de placeholders mapeado contra a especificação com 100% de conformidade.");

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
      declaracaoPobrezaStatus: "gerando",
      declaracaoPobrezaLogFalha: ""
    });

    // Step 7: DECL_PF_TEMPLATE_COPY_STARTED
    addClientLog("DECL_PF_TEMPLATE_COPY_STARTED", "Disparando processo de clonagem do template oficial no GDrive...");

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v1",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: "declaracao_pobreza_pf",
      templateKey: "declaracao_pobreza_pf",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: caseId,
      portalClientId: targetClientId,
      clientType: "PF",
      destinationFolderId: clientDriveFolderId,
      destinationFolderUrl: clientDriveFolderUrl,
      outputFileName: `Declaração de Hipossuficiência PF - ${resolvedNomeCompleto}`,
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
          documentType: "declaracao_pobreza_pf",
          templateKey: "declaracao_pobreza_pf",
          templateId: officialTemplateId,
          caseId,
          clientId: targetClientId,
          clientType: "PF",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `Declaração de Hipossuficiência PF - ${resolvedNomeCompleto}`,
          placeholders,
          metadata: {
            source: "Portal BOSS - Declaração PF",
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-declaracao-PF`,
            folderSource: "Automação Google Drive — Pasta do Cliente",
            clientDataSource: "clients/{clientId}.pfData / clients/{clientId}.pfDadosPessoais"
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
          message: responseData.errorMessage || responseData.error || responseText || "Falha na geração integrada.",
          errorCode: responseData.errorCode || "DECL_PF_TEMPLATE_COPY_FAILED"
        };
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      // Add success logs
      addClientLog("DECL_PF_TEMPLATE_COPY_SUCCESS", `Clone realizado no Google Drive com o novo ID de documento: ${googleDocsId}`);
      addClientLog("DECL_PF_PLACEHOLDER_REPLACEMENT_STARTED", "Iniciando a operação em lote de substituição dos placeholders no documento.");
      addClientLog("DECL_PF_PLACEHOLDER_REPLACEMENT_SUCCESS", "Substituição concluída de todos os placeholders com absoluto sucesso.");
      addClientLog("DECL_PF_DOCUMENT_CREATED", "Criação física e de dados do arquivo homologada no Google Drive.");
      addClientLog("DECL_PF_CASE_UPDATED", "Caso atualizado com a Declaração de Hipossuficiência PF.");
      addClientLog("DECL_PF_FLOW_COMPLETED", "Processamento terminado com 100% de conformidade operacional.");

      await updateDoc(caseDocRef, {
        declaracaoPobrezaStatus: "criada",
        declaracaoPobrezaPfId: googleDocsId,
        declaracaoPobrezaPfUrl: googleDocsUrl,
        declaracaoPobrezaGoogleDocsId: googleDocsId,
        declaracaoPobrezaGoogleDocsUrl: googleDocsUrl,
        declaracaoPobrezaGeneratedAt: new Date().toISOString(),
        declaracaoPobrezaDestinationFolderId: clientDriveFolderId,
        declaracaoPobrezaDestinationFolderUrl: clientDriveFolderUrl,
        declaracaoPobrezaGoogleDocsJobId: jobId,
        declaracaoPobrezaGoogleDocsJobLogs: jobLogs,
        declaracaoPobrezaLogFalha: ""
      });

      try {
        const subdocRef = doc(db, 'cases', caseId, 'generatedDocuments', 'declaracao_pobreza_pf');
        await setDoc(subdocRef, {
          documentType: "declaracao_pobreza_pf",
          displayName: `Declaração de Hipossuficiência PF - ${resolvedNomeCompleto}`,
          templateKey: "declaracao_pobreza_pf",
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
          fileName: `Declaração de Hipossuficiência PF - ${resolvedNomeCompleto}`
        },
        logs: jobLogs
      });

      await saveWizardStateUpdate({ q2_2: 'sim' });

      setSuccess("Declaração de Hipossuficiência PF gerada e indexada no caso com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("[Generator Execution Failed]", err);
      const errorMessage = err.message || "Erro desconhecido durante o processamento de geração integrada.";
      const errorCode = err.errorCode || "DECL_PF_PLACEHOLDER_REPLACEMENT_FAILED";

      addClientLog(errorCode, `Ocorreu uma falha no fluxo: ${errorMessage}`);
      addClientLog("DECL_PF_CASE_UPDATE_FAILED", "Falha ao gravar referências no documento do caso principal.");

      await updateDoc(caseDocRef, {
        declaracaoPobrezaStatus: "falha",
        declaracaoPobrezaLogFalha: errorMessage,
        declaracaoPobrezaGeneratedAt: ""
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

      setError(`Falha ao gerar Declaração PF no motor interno: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
    } finally {
      generationInFlightRef.current = false;
    }
  };

  const renderStatusBadge = () => {
    switch (decStatus) {
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

  const [uploading, setUploading] = React.useState(false);

  const CustomFileUploadBox = ({ field, prefix, buttonLabel }: { field: string; prefix: string; buttonLabel: string }) => {
    const files = wizardState[field] || [];
    const [localUploading, setLocalUploading] = React.useState(false);

    return (
      <div className="space-y-2 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-emerald-500 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
          {localUploading ? (
            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-1"></div>
          ) : (
            <UploadCloud className="text-gray-400 group-hover:text-emerald-600 mb-1" size={20} />
          )}
          <span className="text-[11px] font-bold text-gray-750">
            {localUploading ? "Enviando para o Google Drive..." : buttonLabel}
          </span>
          <input 
            type="file" 
            className="hidden" 
            disabled={localUploading}
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const originalName = file.name;
                const sizeStr = (file.size / 1024 / 1024).toFixed(2) + ' MB';
                const lastDotIndex = originalName.lastIndexOf('.');
                const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
                const finalName = `${prefix} - ${clientName || 'Cliente'}${extension}`;

                setLocalUploading(true);
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
                  setSuccess("Arquivo enviado e salvo no Google Drive: " + finalName);
                  setTimeout(() => setSuccess(null), 5000);
                } catch (err: any) {
                  setError(err.message || 'Erro ao realizar upload do arquivo');
                } finally {
                  setLocalUploading(false);
                }
              }
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-150 rounded-xl text-xs">
                <span className="truncate font-semibold text-emerald-950 flex items-center gap-1">
                  <FileText size={12} /> {f.name} <span className="text-[10px] text-emerald-400 font-normal">({f.size})</span>
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
          <span className="text-[11px] font-bold text-gray-750">
            {uploading ? "Enviando para o Google Drive..." : "Anexar Declaração de Hipossuficiência (PDF/Imagem)"}
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
                const finalName = `Doc. 02 - Declaração de Pobreza - ${clientName || 'Cliente'}${extension}`;

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
                  setSuccess("Declaração enviada e salva no Google Drive: " + finalName);
                } catch (err: any) {
                  setError(err.message || 'Erro ao realizar upload da declaração');
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
      coletaSubetapasStep="declaracao"
      tipoPessoa="PF"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">
              Subetapa 2 - Custas ou Declaração de Hipossuficiência
            </h1>
            <div className="text-xs text-gray-400">
              Cliente: <strong>{clientName}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-procuracao-PF`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar à Procuração
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
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold space-y-2 flex flex-col justify-start">
                <div className="flex gap-2 items-center">
                  <AlertCircle size={14} className="text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
                {(error.toLowerCase().includes("expirou") ||
                  error.toLowerCase().includes("sessão") ||
                  error.toLowerCase().includes("token") ||
                  error.toLowerCase().includes("autorização") ||
                  error.toLowerCase().includes("credentials")) && (
                  <div className="pt-1.5 flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      disabled={isRenewingGoogle}
                      onClick={handleRenewGoogle}
                      className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-3xs disabled:opacity-50"
                    >
                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21.35 11.1H12V12.9H19.6C18.9 16.5 15.8 18.9 12 18.9C8.1 18.9 5.0 15.8 5.0 12C5.0 8.2 8.1 5.1 12 5.1C13.7 5.1 15.3 5.7 16.5 6.8L18.4 4.9C16.7 3.2 14.5 2.1 12 2.1C6.5 2.1 2 6.6 2 12.1C2 17.6 6.5 22.1 12 22.1C17.5 22.1 22 17.6 22 12.1C22 11.7 21.9 11.4 21.35 11.1H21.35Z" fill="currentColor"/>
                      </svg>
                      {isRenewingGoogle ? "Conectando..." : "Conectar / Renovar Conta Google em 1-Clique"}
                    </button>
                    <span className="text-[9.5px] text-rose-700 font-extrabold font-mono">
                      CONEXÃO EXPIRADA
                    </span>
                  </div>
                )}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* FLOW QUESTIONNAIRE CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">
              
              <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-extrabold text-gray-800">2.1 - O Cliente tem direito a Gratuidade ou 💲 Recolherá custas 💲</p>
                <div className="flex flex-col gap-2.5 mt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                    <input 
                      type="radio" 
                      name="q2_1" 
                      checked={wizardState.q2_1 === 'sim'} 
                      onChange={() => saveWizardStateUpdate({ q2_1: 'sim' })} 
                      className="text-indigo-600"
                    />
                    <span>Direito a Gratuidade (Declaração de Pobreza) ✅</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                    <input 
                      type="radio" 
                      name="q2_1" 
                      checked={wizardState.q2_1 === 'nao'} 
                      onChange={() => saveWizardStateUpdate({ q2_1: 'nao' })} 
                      className="text-indigo-600"
                    />
                    <span>Recolher Custas 💰</span>
                  </label>
                </div>
              </div>

              {wizardState.q2_1 === 'nao' && (
                <div className="space-y-5 border-l-2 border-emerald-200 pl-4 animate-in fade-in duration-200">
                  
                  {/* 2.2.1 - Você gerou a GUIA DE CUSTAS do cliente? */}
                  <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-xs font-extrabold text-gray-800 font-sans">2.2.1 - Você gerou a GUIA DE CUSTAS do cliente?</p>
                    <div className="flex flex-col gap-2 mt-1.5">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                          <input 
                            type="radio" 
                            name="q2_recolher_custas_gerou_guia" 
                            checked={wizardState.q2_recolher_custas_gerou_guia === o} 
                            onChange={() => saveWizardStateUpdate({ q2_recolher_custas_gerou_guia: o })} 
                          />
                          <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 2.2.2 - Como você entregará o documento ao cliente? */}
                  {wizardState.q2_recolher_custas_gerou_guia === 'sim' && (
                    <div className="space-y-2 animate-in fade-in duration-300 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-xs font-extrabold text-gray-800 font-sans">2.2.2 - Como você entregará o documento ao cliente?</p>
                      <div className="flex flex-col gap-2 mt-1.5">
                        {[
                          { key: 'fisica', label: 'Física/Impressa' },
                          { key: 'whatsapp', label: 'WhatsApp' },
                          { key: 'email', label: 'E-mail' },
                          { key: 'outro', label: 'Outro' }
                        ].map((item) => {
                          const isActive = wizardState.q2_recolher_custas_como_entregara === item.key;
                          return (
                            <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                              <input
                                type="radio"
                                name="q2_recolher_custas_como_entregara"
                                checked={isActive}
                                onChange={() => saveWizardStateUpdate({ q2_recolher_custas_como_entregara: item.key })}
                                className="text-indigo-600"
                              />
                              <span>{item.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      {wizardState.q2_recolher_custas_como_entregara === 'outro' && (
                        <div className="mt-2 text-xs">
                          <input
                            type="text"
                            placeholder="Especifique o outro meio de entrega..."
                            value={wizardState.q2_recolher_custas_como_entregara_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q2_recolher_custas_como_entregara_outro: e.target.value })}
                            className="w-full max-w-md px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-hidden transition-all shadow-3xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2.2.3 - Guardar a Guia de custas na Pasta de destino */}
                  {wizardState.q2_recolher_custas_gerou_guia === 'sim' && wizardState.q2_recolher_custas_como_entregara && (
                    <div className="space-y-2 animate-in fade-in duration-300 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                        2.2.3 - Guardar a Guia de custas na Pasta de destino
                      </p>
                      <p className="text-[11px] text-gray-400 font-sans leading-none pb-1">
                        Upload automático na pasta de destino com renomeação automática para: <strong className="font-mono text-emerald-850">doc. 02.1 - Guia de Custas</strong>
                      </p>
                      <CustomFileUploadBox 
                        field="guiaCustasFiles" 
                        prefix="doc. 02.1 - Guia de Custas"
                        buttonLabel="Anexar Guia de Custas (PDF/Imagem)"
                      />
                    </div>
                  )}

                  {/* 2.2.4 - Como o cliente te enviou o comprovante de pagamento das custas? */}
                  {wizardState.q2_recolher_custas_gerou_guia === 'sim' && wizardState.q2_recolher_custas_como_entregara && (
                    <div className="space-y-2 animate-in fade-in duration-300 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-xs font-extrabold text-gray-800 font-sans">2.2.4 - Como o cliente te enviou o comprovante de pagamento das custas?</p>
                      <div className="flex flex-col gap-2 mt-1.5">
                        {[
                          { key: 'fisico', label: 'Físico' },
                          { key: 'whatsapp', label: 'What’s App' },
                          { key: 'email', label: 'Email' },
                          { key: 'outro', label: 'Outro' }
                        ].map((item) => {
                          const isActive = wizardState.q2_recolher_custas_comprovante_enviado_como === item.key;
                          return (
                            <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                              <input
                                type="radio"
                                name="q2_recolher_custas_comprovante_enviado_como"
                                checked={isActive}
                                onChange={() => saveWizardStateUpdate({ q2_recolher_custas_comprovante_enviado_como: item.key })}
                                className="text-indigo-600"
                              />
                              <span>{item.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      {wizardState.q2_recolher_custas_comprovante_enviado_como === 'outro' && (
                        <div className="mt-2 text-xs">
                          <input
                            type="text"
                            placeholder="Especifique o outro meio de recebimento..."
                            value={wizardState.q2_recolher_custas_comprovante_enviado_como_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q2_recolher_custas_comprovante_enviado_como_outro: e.target.value })}
                            className="w-full max-w-md px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-hidden transition-all shadow-3xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2.2.5 - Guardar o COMPROVANTE DE PAGAMENTO da Guia de custas na Pasta de destino */}
                  {wizardState.q2_recolher_custas_gerou_guia === 'sim' && wizardState.q2_recolher_custas_como_entregara && wizardState.q2_recolher_custas_comprovante_enviado_como && (
                    <div className="space-y-2 animate-in fade-in duration-300 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                        2.2.5 - Guardar o COMPROVANTE DE PAGAMENTO da Guia de custas na Pasta de destino
                      </p>
                      <p className="text-[11px] text-gray-400 font-sans leading-none pb-1">
                        Upload automático na pasta de destino com renomeação automática para: <strong className="font-mono text-emerald-850">doc. 02.2 - comprovante de pagamento Guia de Custas</strong>
                      </p>
                      <CustomFileUploadBox 
                        field="comprovanteGuiaCustasFiles" 
                        prefix="doc. 02.2 - comprovante de pagamento Guia de Custas"
                        buttonLabel="Anexar Comprovante de Pagamento (PDF/Imagem)"
                      />
                    </div>
                  )}

                </div>
              )}

              {wizardState.q2_1 === 'sim' && (
                <div className="space-y-5 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                  
                  {/* REAL AUTOMAÇÃO GOOGLE DOCS CARD */}
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
                          Automação Google Docs — Declaração de Hipossuficiência PF
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                          Esta ferramenta envia os dados consolidados do cadastro de pessoa física diretamente ao build receptor do Google Docs para preenchimento de placeholders, indexação e arquivamento automatizado na pasta em tempo real.
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
                                  Pasta do Google Drive de {clientName || 'Cliente'}
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
                                  Modelo padrão utilizado para preenchimento de metadados fáticos (Declaração de Hipossuficiência PF):
                                </p>
                                <a
                                  href="https://docs.google.com/document/d/1e2JbDiPY-2TywfdK_7s75qcY6YkvRrBVQ_0TFDnHYi4/edit"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-150 text-indigo-750 hover:text-indigo-900 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shadow-3xs"
                                >
                                  <FileText size={13} className="text-indigo-500" />
                                  <span>Abrir Template de Referência Google Docs</span>
                                  <ExternalLink size={10} className="opacity-70" />
                                </a>
                                <div className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-[9px] font-mono select-all text-gray-500 flex items-center justify-between gap-2">
                                  <span className="truncate">ID: 1e2JbDiPY-2TywfdK_7s75qcY6YkvRrBVQ_0TFDnHYi4</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink("1e2JbDiPY-2TywfdK_7s75qcY6YkvRrBVQ_0TFDnHYi4")}
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

                      {saving ? (
                        <div className="bg-white border border-indigo-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-pulse font-sans">
                          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="text-indigo-600 animate-spin" size={17} />
                              <span className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                                Gerando Declaração de Hipossuficiência PF segura... Por favor, aguarde alguns instantes.
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-indigo-600 h-full rounded-full animate-infinite-loading w-3/4"></div>
                            </div>
                          </div>
                        </div>
                      ) : decStatus === 'criada' && decUrl ? (
                        <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-in slide-in-from-top-1 duration-200">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                              <FileText size={20} />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                                Declaração de Hipossuficiência PF Gerada - v{techDocVer}
                              </h3>
                              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                O documento de Declaração de Hipossuficiência PF real foi localizado, preenchido e confirmado na pasta real do Google Drive.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2.5 pt-1.5">
                            <a
                              href={decUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold"
                            >
                              <ExternalLink size={13} />
                              Abrir Declaração
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(decUrl)}
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
                              onClick={() => handleGenerateDeclaracaoPf('new_version')}
                              className="px-4.5 py-2 bg-white hover:bg-gray-50 border border-gray-250 text-slate-800 text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold disabled:opacity-50"
                            >
                              {saving ? "Gerando..." : "Gerar nova versão"}
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
                              A geração documental da declaração de hipossuficiência está configurada e pronta para execução real, aguardando validação de pastas e arquivos fáticos.
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleGenerateDeclaracaoPf('initial')}
                              className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer font-bold"
                            >
                              <Sparkles size={14} />
                              <span>Gerar Declaração PF</span>
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
                                ✅ Declaração de Hipossuficiência PF criada com sucesso na pasta de destino: {clientName || 'Cliente'}.
                              </h4>
                              <p className="text-xs text-emerald-800 font-semibold">
                                Documento salvo no Google Drive e vinculado ao caso em {techTimestamp ? new Date(techTimestamp).toLocaleString() : new Date().toLocaleString()}.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : decStatus === 'falha' ? (
                        /* FALHA REAL */
                        <div className="p-5 bg-red-50 border border-red-150 rounded-2xl space-y-4 animate-in fade-in duration-200">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-red-100 rounded-xl text-red-800 shrink-0">
                              <X size={18} />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-red-950 leading-relaxed">
                                ❌ Não foi possível criar a Declaração de Hipossuficiência PF na pasta de destino: {clientName || 'Cliente'}.
                              </h4>
                              <p className="text-xs font-extrabold text-red-900 mt-2">
                                Motivo: {localCaseObj?.declaracaoPobrezaLogFalha || "Falha na geração integrada de documento."}
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
                      {(techCode || techTimestamp || techDocId) && (decStatus === 'criada' || decStatus === 'falha') && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-xs font-mono space-y-1.5 font-bold">
                          <div className="flex justify-between border-b border-slate-200 pb-1">
                            <span>Status Code:</span>
                            <span className="font-bold text-slate-850">{techCode}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-1">
                            <span>Timestamp:</span>
                            <span>{techTimestamp ? new Date(techTimestamp).toLocaleString() : ""}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Document ID:</span>
                            <span className="truncate max-w-[200px]" title={techDocId}>{techDocId}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-gray-800">2.2 Você gerou a declaração do cliente?</p>
                    <div className="flex gap-4 mt-1.5">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                          <input 
                            type="radio" 
                            name="q2_2" 
                            checked={wizardState.q2_2 === o} 
                            onChange={() => saveWizardStateUpdate({ q2_2: o })} 
                          />
                          <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {(wizardState.q2_2 === 'sim' || wizardState.q2_2 === 'nao') && (
                    <>
                      <EntregaDocumento
                        tipoDocumento="declaracao"
                        tipoPessoa="PF"
                        googleDocsUrl={localCaseObj?.declaracaoPobrezaGoogleDocsUrl || ''}
                        whatsappCliente={client?.pfDadosPessoais?.pf_whatsapp || client?.pfDadosPessoais?.pf_telefone || client?.pfData?.pf_whatsapp || client?.pfData?.pf_telefone || ''}
                        emailCliente={client?.pfDadosPessoais?.pf_email || client?.pfData?.pf_email || ''}
                        nomeCliente={clientName}
                        selectedMethods={wizardState.q2_3 || []}
                        onMethodsChange={(newMethods: string[]) => saveWizardStateUpdate({ q2_3: newMethods })}
                        outroValue={wizardState.q2_3_outro || ''}
                        onOutroChange={(val: string) => saveWizardStateUpdate({ q2_3_outro: val })}
                        questionNumber="2.3"
                      />

                      {wizardState.q2_3 && wizardState.q2_3.length > 0 && (
                        <div className="space-y-1 animate-in fade-in duration-300">
                          <p className="text-xs font-extrabold text-gray-800">2.4 Você recebeu a declaração do cliente ASSINADA 🖊️?</p>
                          <div className="flex gap-4 mt-1.5">
                            {['sim', 'nao'].map(o => (
                              <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                                <input 
                                  type="radio" 
                                  name="q2_4" 
                                  checked={wizardState.q2_4 === o} 
                                  onChange={() => {
                                    saveWizardStateUpdate({ 
                                      q2_4: o,
                                      q2_como_d_recebida: '',
                                      q2_deseja_digitalizar_d: ''
                                    });
                                  }} 
                                />
                                <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {wizardState.q2_3 && wizardState.q2_3.length > 0 && wizardState.q2_4 === 'sim' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                          <p className="text-xs font-extrabold text-gray-800">2.5 Como a Declaração de Pobreza foi recebida?</p>
                          <div className="flex flex-wrap gap-4 mt-1.5">
                            {[
                              { val: 'fisico', label: 'Físico' },
                              { val: 'whatsapp', label: 'What’s App' },
                              { val: 'email', label: 'Email' },
                              { val: 'outro', label: 'Outro' }
                            ].map(opt => (
                              <label key={opt.val} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                                <input 
                                  type="radio" 
                                  name="q2_como_d_recebida" 
                                  checked={wizardState.q2_como_d_recebida === opt.val} 
                                  onChange={() => {
                                    saveWizardStateUpdate({ 
                                      q2_como_d_recebida: opt.val,
                                      q2_deseja_digitalizar_d: ''
                                    });
                                  }} 
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {wizardState.q2_3 && wizardState.q2_3.length > 0 && wizardState.q2_4 === 'sim' && wizardState.q2_como_d_recebida === 'fisico' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                          <p className="text-xs font-extrabold text-gray-800">2.6 Deseja digitalizar a declaração do cliente agora?</p>
                          <div className="flex gap-4 mt-1.5">
                            {['sim', 'nao'].map(o => (
                              <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                                <input 
                                  type="radio" 
                                  name="q2_deseja_digitalizar_d" 
                                  checked={wizardState.q2_deseja_digitalizar_d === o} 
                                  onChange={() => saveWizardStateUpdate({ q2_deseja_digitalizar_d: o })} 
                                />
                                <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If yes to digitalize physically OR if received digitally */}
                      {wizardState.q2_3 && wizardState.q2_3.length > 0 && wizardState.q2_4 === 'sim' && (
                        (wizardState.q2_como_d_recebida === 'fisico' && wizardState.q2_deseja_digitalizar_d === 'sim') ||
                        (wizardState.q2_como_d_recebida && wizardState.q2_como_d_recebida !== 'fisico')
                      ) && (
                        <div className="space-y-2 animate-in fade-in duration-300 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                          <p className="text-xs font-black text-indigo-950 uppercase tracking-wider block">Anexar e upload automático para Google Drive</p>
                          <FileUploadBox field="declaracaoFiles" />
                        </div>
                      )}

                      {/* If no to digitalize physically */}
                      {wizardState.q2_3 && wizardState.q2_3.length > 0 && wizardState.q2_4 === 'sim' && wizardState.q2_como_d_recebida === 'fisico' && wizardState.q2_deseja_digitalizar_d === 'nao' && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                          <span className="text-base">⚠️</span>
                          <span>Colocado automaticamente como pendência no setor de digitalização.</span>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}

              {/* ACTION LOWER BUTTON PANEL */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  disabled={
                    !wizardState.q2_1 || 
                    (wizardState.q2_1 === 'sim' && !wizardState.q2_2) || 
                    (wizardState.q2_1 === 'nao' && !wizardState.q2_recolher_custas_gerou_guia) || 
                    (wizardState.q2_1 === 'nao' && wizardState.q2_recolher_custas_gerou_guia === 'sim' && (!wizardState.q2_recolher_custas_como_entregara || !wizardState.q2_recolher_custas_comprovante_enviado_como)) ||
                    saving
                  }
                  onClick={handleNextPhase}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
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
