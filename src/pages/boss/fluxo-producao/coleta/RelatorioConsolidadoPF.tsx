import React, { useState } from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import ColetaProvasSubetapasCard from '../components/ColetaProvasSubetapasCard';
import { 
  ArrowLeft, FileText, Check, AlertCircle, Sparkles, 
  Send, ShieldCheck, Printer, Download, Clock,
  ExternalLink, Copy, FileCode, ArrowRight, RefreshCw, Settings, CheckCircle2
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export default function RelatorioConsolidadoPF() {
  const {
    caseId,
    fetching,
    saving,
    setSaving,
    error,
    setError,
    success,
    setSuccess,
    client,
    requests,
    wizardState,
    saveWizardStateUpdate,
    navigate,
    caseObj,
    driveFolderId,
    driveFolderUrl,
    clientName,
  } = useColetaState();

  const basicDocs = [
    {
      name: 'Procuração Ad Judicia',
      files: wizardState?.procuracaoFiles || [],
      sent: wizardState?.q1_1 === 'sim',
      methods: wizardState?.q1_2 || [],
      required: true
    },
    {
      name: 'Declaração de Hipossuficiência',
      files: wizardState?.declaracaoFiles || [],
      sent: wizardState?.q2_2 === 'sim',
      methods: wizardState?.q2_3 || [],
      required: wizardState?.q2_1 === 'sim'
    },
    {
      name: 'Contrato de Prestação de Serviços',
      files: wizardState?.contratoFiles || [],
      sent: wizardState?.q3_1 === 'sim',
      methods: wizardState?.q3_3 || [],
      required: true
    }
  ];

  const totalMinimosFiles = (wizardState?.rgFiles || []).length + 
                           (wizardState?.cpfFiles || []).length + 
                           (wizardState?.comprovanteFiles || []).length;

  const customProvas = (requests || []).filter(req => {
    const t = (req.title || '').toLowerCase();
    return !t.includes('procuração') && !t.includes('declaração') && !t.includes('contrato');
  });

  const missingDocs = basicDocs.filter(d => d.required && d.files.length === 0);

  const basicCount = 
    ((wizardState?.procuracaoFiles || []).length > 0 ? 1 : 0) +
    ((wizardState?.q2_1 === 'nao' 
      ? ((wizardState?.guiaCustasFiles || []).length > 0 || (wizardState?.comprovanteGuiaCustasFiles || []).length > 0)
      : (wizardState?.declaracaoFiles || []).length > 0) ? 1 : 0) +
    ((wizardState?.contratoFiles || []).length > 0 ? 1 : 0);

  const completedObrigatorios = 
    ((wizardState?.rgFiles || []).length > 0 ? 1 : 0) +
    ((wizardState?.cpfFiles || []).length > 0 ? 1 : 0) +
    (((wizardState?.comprovanteFiles || []).length > 0 || (wizardState?.residenciaFiles || []).length > 0) ? 1 : 0);

  const completedOutrasProvas = customProvas.filter(req => {
    const proofState = wizardState?.q5_provas?.[req.id] || { received: 'nao' };
    return proofState.received === 'sim' || (wizardState[`custom_${req.id}`] || []).length > 0;
  }).length;

  const totalOutrasProvas = customProvas.length;
  const totalAllRequested = 3 + 3 + totalOutrasProvas;
  const totalAllReceived = basicCount + completedObrigatorios + completedOutrasProvas;
  const requestedPercentage = 100;
  const receivedPercentage = Math.round((totalAllReceived / (totalAllRequested || 1)) * 100);

  const [generatingRelatorio, setGeneratingRelatorio] = useState(false);
  const generationInFlightRef = React.useRef(false);
  const [copiedRelatorio, setCopiedRelatorio] = useState(false);
  const [isGdiSettingsOpen, setIsGdiSettingsOpen] = useState(false);
  const [relatorioLogs, setRelatorioLogs] = useState<any[]>([]);

  // Preview and validation GDI states
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  const [isValidatedReport, setIsValidatedReport] = useState(false);
  const [isPreviewValidated, setIsPreviewValidated] = useState(false);

  const compileReportText = () => {
    // 1. Procuração
    let procuracaoStatus = "doc. 0001 - Procuração - pendente de geração, assinatura, entrega e digitalização ❌";
    const hasProcFiles = Array.isArray(wizardState?.procuracaoFiles) && wizardState.procuracaoFiles.length > 0;
    const isProcSigned = wizardState?.q1_3 === 'sim';
    if (isProcSigned && hasProcFiles) {
      procuracaoStatus = "doc. 0001 - Procuração - assinado e com upload no Drive ✅";
    } else if (hasProcFiles || wizardState?.q1_1 === 'sim' || isProcSigned || (Array.isArray(wizardState?.q1_2) && wizardState.q1_2.length > 0)) {
      procuracaoStatus = "doc. 0001 - Procuração - parcialmente recebida ou com pendências ⚠️";
    }

    // 2. Declaração ou Guia de Custas
    let declaracaoStatus = "doc. 0002 - Declaração de Pobreza ou Guia de Custas - pendente de geração, assinatura, entrega e digitalização ❌";
    if (wizardState?.q2_1 === 'nao') {
      const hasGuiaFiles = Array.isArray(wizardState?.guiaCustasFiles) && wizardState.guiaCustasFiles.length > 0;
      const hasComprovanteFiles = Array.isArray(wizardState?.comprovanteGuiaCustasFiles) && wizardState.comprovanteGuiaCustasFiles.length > 0;
      if (hasGuiaFiles && hasComprovanteFiles) {
        declaracaoStatus = "doc. 0002 - Declaração de Pobreza ou Guia de Custas - assinado e com upload no Drive ✅";
      } else if (hasGuiaFiles || hasComprovanteFiles) {
        declaracaoStatus = "doc. 0002 - Declaração de Pobreza ou Guia de Custas - parcialmente recebida ou com pendências ⚠️";
      }
    } else {
      const hasDeclFiles = Array.isArray(wizardState?.declaracaoFiles) && wizardState.declaracaoFiles.length > 0;
      const isDeclSigned = wizardState?.q2_4 === 'sim';
      if (isDeclSigned && hasDeclFiles) {
        declaracaoStatus = "doc. 0002 - Declaração de Pobreza ou Guia de Custas - assinado e com upload no Drive ✅";
      } else if (hasDeclFiles || wizardState?.q2_2 === 'sim' || isDeclSigned || (Array.isArray(wizardState?.q2_3) && wizardState.q2_3.length > 0)) {
        declaracaoStatus = "doc. 0002 - Declaração de Pobreza ou Guia de Custas - parcialmente recebida ou com pendências ⚠️";
      }
    }

    // 3. Contrato
    let contratoStatus = "doc. $$$$ - Contrato de Honorários - pendente de geração, assinatura, entrega e digitalização ❌";
    const hasContratoFiles = Array.isArray(wizardState?.contratoFiles) && wizardState.contratoFiles.length > 0;
    const isContratoSigned = wizardState?.q3_4 === 'sim' && wizardState?.q3_5 === 'sim';
    const isContratoDone = wizardState?.q3_7 === 'sim' || isContratoSigned;
    if (isContratoDone && hasContratoFiles) {
      contratoStatus = "doc. $$$$ - Contrato de Honorários - assinado e com upload no Drive ✅";
    } else if (hasContratoFiles || wizardState?.q3_1 === 'sim' || wizardState?.q3_4 === 'sim' || wizardState?.q3_5 === 'sim' || (Array.isArray(wizardState?.q3_3) && wizardState.q3_3.length > 0)) {
      contratoStatus = "doc. $$$$ - Contrato de Honorários - parcialmente recebido ou com pendências ⚠️";
    }

    // Certificação de Provas Mínimas Obrigatórias
    const rgFiles = wizardState?.rgFiles || [];
    const rgCount = rgFiles.length;
    const rgPresence = rgCount > 0 ? "Presente ✅" : "Ausente ❌";

    const cpfFiles = wizardState?.cpfFiles || [];
    const cpfCount = cpfFiles.length;
    const cpfPresence = cpfCount > 0 ? "Presente ✅" : "Ausente ❌";

    const addressFiles = wizardState?.comprovanteFiles || wizardState?.residenciaFiles || [];
    const addressCount = addressFiles.length;
    const addressPresence = addressCount > 0 ? "Presente ✅" : "Ausente ❌";

    // Outras Provas Solicitadas
    let outrasProvasText = "";
    if (customProvas.length > 0) {
      const customLines = customProvas.map((req, rIdx) => {
        const proofState = wizardState?.q5_provas?.[req.id] || { received: 'nao' };
        const docNumber = req.documentNumber || `doc. 000${rIdx + 6}`;
        const evidenceType = req.evidenceType || "Prova documental";
        
        const customFiles = wizardState[`custom_${req.id}`] || [];
        const filesCount = customFiles.length;
        const isPresent = filesCount > 0 || proofState.received === 'sim';
        const statusText = isPresent ? "Presente ✅" : "Ausente ❌";
        
        return `${docNumber}\n${req.title}\n${evidenceType}\n${filesCount} arquivo(s)\n${statusText}`;
      });
      outrasProvasText = customLines.join("\n\n");
    } else {
      outrasProvasText = "Não há outras provas complementares solicitadas.";
    }

    // Assemble unified final text
    let reportText = "";
    reportText += "Relação de Documentos Básicos do Escritório\n\n";
    reportText += `${procuracaoStatus}\n\n`;
    reportText += `${declaracaoStatus}\n\n`;
    reportText += `${contratoStatus}\n\n\n`;

    reportText += "Relação de Provas Mínimas obrigatórias\n\n";
    reportText += `doc. 0003 - RG\n${rgCount} arquivo(s)\n${rgPresence}\n\n`;
    reportText += `doc. 0004 - CPF\n${cpfCount} arquivo(s)\n${cpfPresence}\n\n`;
    reportText += `doc. 0005 - Comprovante de residencia\n${addressCount} arquivo(s)\n${addressPresence}\n\n\n`;

    reportText += "Relação de outras Provas solicitadas\n\n";
    reportText += outrasProvasText;

    return reportText;
  };

  const handleValidateReport = () => {
    setError(null);
    setSuccess(null);
    try {
      const text = compileReportText();
      setReportPreview(text);
      setIsValidatedReport(true);
      setSuccess("Relatório de Provas PF compilado com absoluto sucesso para o Preview GDI!");
    } catch (err: any) {
      setError(`Falha ao compilar relatório para validação: ${err.message}`);
    }
  };

  const handleGenerateRelatorioDocs = async () => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Relatório PF ignorada.");
      return;
    }
    generationInFlightRef.current = true;

    try {
      setGeneratingRelatorio(true);
      setError(null);
      setSuccess(null);
    const trackingLogs: any[] = [];
    const addTrackLog = (step: string, details?: any) => {
      trackingLogs.push({ step, timestamp: new Date().toISOString(), details });
      setRelatorioLogs([...trackingLogs]);
    };

    addTrackLog("BUTTON_CLICKED", { documentType: "relatorio_provas", clientType: "PF" });

    if (!driveFolderId) {
      addTrackLog("DRIVE_FOLDER_ERROR", { error: "Sem ID de pasta do Drive" });
      setError("Não há pasta real do Google Drive vinculada ao cliente.");
      setGeneratingRelatorio(false);
      return;
    }

    addTrackLog("DRIVE_FOLDER_VALIDATED", { destinationFolderId: driveFolderId });

    const jobId = `job-relatorio-pf-${Date.now()}`;
    const targetCaseId = caseId;
    const targetClientId = client?.id || caseObj?.clientId || "";
    const nomeCompleto = client?.personalDados?.pf_nomeCompleto || clientName || "Cliente";

    const reportText = compileReportText();

    const placeholders: Record<string, string> = {
      "Relatório_geral_de_Provas_pessoa_fisica": reportText
    };

    const officialTemplateId = "1BPIOSWMjvLsSWzo_NcMjixrYUhmq7sKW2pRjdp1bS0s";
    addTrackLog("TEMPLATE_SELECTED", { templateKey: "relatorio_provas_pf", templateId: officialTemplateId });

    const caseDocRef = doc(db, 'cases', caseId);

    await updateDoc(caseDocRef, {
      relatorioProvasStatus: "gerando",
      relatorioProvasLogFalha: ""
    });

    const googleAccessToken = localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

    const payload = {
      mode: "stateless",
      googleAccessToken,
      documentType: "relatorio_provas_pf",
      caseId: targetCaseId,
      clientId: targetClientId,
      clientType: "PF",
      templateId: officialTemplateId,
      templateKey: "relatorio_provas_pf",
      destinationFolderId: driveFolderId,
      destinationFolderUrl: driveFolderUrl,
      documentName: `Relatório de Provas PF - ${nomeCompleto}`,
      placeholders,
      metadata: { source: "Operational Coleta Flow", attemptJobId: jobId },
      credentialOverride: localOverride
    };

    try {
      addTrackLog("TEMPLATE_COPY_STARTED", { details: "Disparando clonagem do template de Relatório..." });
      const response = await fetch("/api/google-docs/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { error: responseText };
      }

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.errorMessage || responseData.error || responseText || "Falha na geração integrada.");
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      addTrackLog("DOCUMENT_CREATED", { googleDocsId, googleDocsUrl });
      addTrackLog("FLOW_COMPLETED", { message: "Relatório de Provas PF gerado no Google Drive com sucesso!" });

      await updateDoc(caseDocRef, {
        relatorioProvasStatus: "criada",
        relatorioProvasGoogleDocsId: googleDocsId,
        relatorioProvasGoogleDocsUrl: googleDocsUrl,
        relatorioProvasGeneratedAt: new Date().toISOString(),
        relatorioProvasJobLogs: trackingLogs
      });

      setSuccess("Relatório de Provas gerado com absoluto sucesso no Google Docs!");
    } catch (err: any) {
      console.error(err);
      addTrackLog("FLOW_FAILED", { error: err.message });
      await updateDoc(caseDocRef, {
        relatorioProvasStatus: "falha",
        relatorioProvasLogFalha: err.message || "Erro inesperado na geração do documento.",
        relatorioProvasJobLogs: trackingLogs
      });
      setError(`Erro na geração integrado via Google Docs: ${err.message}`);
    } finally {
      setGeneratingRelatorio(false);
    }
    } finally {
      generationInFlightRef.current = false;
    }
  };

  const handleCopyRelatorioLink = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedRelatorio(true);
      setTimeout(() => setCopiedRelatorio(false), 2000);
    });
  };

  const handleConfirmConsolidate = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await saveWizardStateUpdate({ step5_consolidado_completed: true });
      setSuccess('Relatório de Provas Consolidado validado e fechado na custódia!');
    } catch (err: any) {
      setError(err.message || 'Falha ao consolidar o relatório.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FluxoStepLayout 
      stepName="Relatório de Provas Consolidado" 
      caseId={caseId}
      coletaSubetapasStep="documentos-consolidado"
      tipoPessoa="PF"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1.5 text-left">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">
              Subetapa 5 - Relatório de Provas Consolidado
            </h1>
            <div className="text-xs text-gray-400">
              Cliente: <strong>{client?.personalDados?.pf_nomeCompleto || 'PF'}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-necessidade-PF`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar para Necessidades
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-405 font-mono">Compilando relatório...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* NOTIFICATIONS */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex gap-2 items-center">
                <AlertCircle size={14} className="text-red-900 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-950 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-550 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* MAIN PORT BOSS VERTICAL FORM LAYOUT */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-6 text-left">
              
              {/* STAGE METRIC */}
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-120/40 p-6 rounded-2xl border border-indigo-100 flex flex-col gap-5">
                <div className="space-y-1">
                  <span className="text-[9px] bg-indigo-200/50 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">Status do Relatório de Coleta de provas</span>
                  <h3 className="text-sm font-black text-indigo-950">
                    {missingDocs.length === 0 ? 'Documentos Básicos Saneados' : 'Relação Total de Provas a Coletar'}
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 leading-normal">
                    Este relatório compila e consolida a integridade da entrega material de todas as provas do processo do cliente para a instrução.
                  </p>
                </div>
                
                {/* Vertical metric cards */}
                <div className="grid grid-cols-1 gap-3 w-full">
                  
                  {/* Card 1: básicos */}
                  <div className="px-5 py-4 bg-white rounded-2xl border border-indigo-100 flex items-center justify-between shadow-3xs hover:border-indigo-250 transition-all">
                    <span className="text-xs text-gray-550 font-black uppercase tracking-wider block">básicos</span>
                    <span className="text-sm font-black text-indigo-900 font-mono">{basicCount} / 3</span>
                  </div>

                  {/* Card 2: obrigatórios */}
                  <div className="px-5 py-4 bg-white rounded-2xl border border-indigo-100 flex items-center justify-between shadow-3xs hover:border-indigo-250 transition-all">
                    <span className="text-xs text-gray-550 font-black uppercase tracking-wider block">obrigatórios</span>
                    <span className="text-sm font-black text-indigo-900 font-mono">{completedObrigatorios} / 3</span>
                  </div>

                  {/* Card 3: outras provas */}
                  <div className="px-5 py-4 bg-white rounded-2xl border border-indigo-100 flex items-center justify-between shadow-3xs hover:border-indigo-250 transition-all">
                    <span className="text-xs text-gray-550 font-black uppercase tracking-wider block">outras provas</span>
                    <span className="text-sm font-black text-indigo-900 font-mono">{completedOutrasProvas} / {totalOutrasProvas}</span>
                  </div>

                  {/* Card 4: total de provas solicitadas % */}
                  <div className="px-5 py-4 bg-white rounded-2xl border border-indigo-100 flex items-center justify-between shadow-3xs hover:border-indigo-250 transition-all">
                    <span className="text-xs text-gray-550 font-black uppercase tracking-wider block">total de provas solicitadas %</span>
                    <span className="text-sm font-black text-indigo-900 font-mono">{totalAllRequested} / {totalAllRequested} ({requestedPercentage}%)</span>
                  </div>

                  {/* Card 5: total de provas entregues % */}
                  <div className="px-5 py-4 bg-white rounded-2xl border border-indigo-100 flex items-center justify-between shadow-3xs hover:border-indigo-250 transition-all">
                    <span className="text-indigo-650 text-xs font-black uppercase tracking-wider block">total de provas entregues %</span>
                    <span className="text-sm font-black text-indigo-900 font-mono">{totalAllReceived} / {totalAllRequested} ({receivedPercentage}%)</span>
                  </div>

                </div>
              </div>

              {/* VERTICAL SECTIONS - 1. BASIC DOCUMENTS STATUS */}
              <div id="secao-auditoria-basicos" className="space-y-4">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider border-b pb-1">
                  Relação de Documentos Básicos do Escritório
                </h3>
                
                <div className="space-y-3">
                  {/* PROCURAÇÃO STATUS */}
                  <div className="p-4.5 bg-gray-50/40 border border-gray-150 rounded-2xl text-xs font-bold leading-normal text-left">
                    {wizardState?.q1_3 === 'sim' && Array.isArray(wizardState?.procuracaoFiles) && wizardState.procuracaoFiles.length > 0 ? (
                      <span className="text-emerald-700 font-bold">doc. 0001 - Procuração - assinado e upload no drive ✅</span>
                    ) : (
                      <span className="text-rose-700 font-bold">doc. 0001 - Procuração - pendente de geração, assinatura, entrega, digitalização ❌</span>
                    )}
                  </div>

                  {/* DECLARAÇÃO OU GUIA DE CUSTAS STATUS */}
                  <div className="p-4.5 bg-gray-50/40 border border-gray-150 rounded-2xl text-xs font-bold leading-normal text-left space-y-1">
                    {wizardState?.q2_1 === 'nao' ? (
                      <>
                        <p className="text-indigo-900 bg-indigo-50/30 p-2.5 rounded-xl border border-indigo-100 font-extrabold text-[11px] leading-relaxed select-none">
                          O cliente optou pelo recolhimento de taxas. Deste modo, a Declaração de Pobreza está isenta para esta instrução.
                        </p>
                        <div>
                          {Array.isArray(wizardState?.guiaCustasFiles) && wizardState.guiaCustasFiles.length > 0 && Array.isArray(wizardState?.comprovanteGuiaCustasFiles) && wizardState.comprovanteGuiaCustasFiles.length > 0 ? (
                            <span className="text-emerald-700 font-bold">doc. 0002 - Declaração de Pobreza ou Guia de Custas - gerado e upload no drive ✅</span>
                          ) : (
                            <span className="text-rose-700 font-bold">doc. 0002 - Declaração de Pobreza ou Guia de Custas pendente de geração, assinatura, entrega, digitalização ❌</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        {wizardState?.q2_4 === 'sim' && Array.isArray(wizardState?.declaracaoFiles) && wizardState.declaracaoFiles.length > 0 ? (
                          <span className="text-emerald-700 font-bold">doc. 0002 - Declaração de Pobreza ou Guia de Custas - assinado e upload no drive ✅</span>
                        ) : (
                          <span className="text-rose-700 font-bold">doc. 0002 - Declaração de Pobreza ou Guia de Custas pendente de geração, assinatura, entrega, digitalização ❌</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONTRATO DE HONORÁRIOS STATUS */}
                  <div className="p-4.5 bg-gray-50/40 border border-gray-150 rounded-2xl text-xs font-bold leading-normal text-left">
                    {wizardState?.q3_7 === 'sim' || (wizardState?.q3_4 === 'sim' && wizardState?.q3_5 === 'sim') ? (
                      <span className="text-emerald-700 font-bold">doc. $$$$ - Contrato de Honorários - assinado e upload no drive ✅</span>
                    ) : (
                      <span className="text-rose-700 font-bold">doc. $$$$ - Contrato de Honorários pendente de geração, assinatura, entrega, digitalização ❌</span>
                    )}
                  </div>
                </div>
              </div>

              {/* VERTICAL SECTIONS - 2. MINIMUM MANDATORY DOCUMENTS */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider border-b pb-1">
                  Relação de Provas Mínimas obrigatórias
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'doc. 0003 - RG', files: wizardState?.rgFiles || [] },
                    { label: 'doc. 0004 - CPF', files: wizardState?.cpfFiles || [] },
                    { label: 'doc. 0005 - Comprovante de residencia', files: wizardState?.comprovanteFiles || [] }
                  ].map((minim, mIdx) => (
                    <div key={mIdx} className="p-3 bg-gray-50/40 border rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-850 truncate max-w-[250px]">{minim.label}</p>
                        <span className="text-[10px] text-gray-400 font-semibold">{minim.files.length} arquivo(s)</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${minim.files.length > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                        {minim.files.length > 0 ? 'Saneado' : 'Ausente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* VERTICAL SECTIONS - 3. OTHER CUSTOM CLIENT EVIDENCE */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider border-b pb-1">
                  Relação de outras Provas solicitadas
                </h3>
                {customProvas.length > 0 ? (
                  <div className="space-y-3">
                    {customProvas.map((req, rIdx) => {
                      const proofState = wizardState?.q5_provas?.[req.id] || { received: 'nao' };
                      return (
                        <div key={rIdx} className="p-3 bg-gray-50/50 border rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold block w-max uppercase mb-1">{req.documentNumber || `doc. 000${rIdx + 6}`}</span>
                            <span className="font-extrabold text-gray-800 block">{req.title}</span>
                            <span className="text-[11px] text-gray-400 font-semibold">{req.evidenceType}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${proofState.received === 'sim' ? 'bg-emerald-50 text-emerald-850' : 'bg-red-50 text-red-850'}`}>
                              {proofState.received === 'sim' ? 'Recebido' : 'Pendente'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-405 italic bg-gray-50/55 p-3 rounded-xl border border-dashed border-gray-200">
                    Nenhuma outra prova específica exigida para o caso de instrução.
                  </p>
                )}
              </div>

              {/* BUTTON VALIDAR RELATÓRIO E PREVIEW GDI */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                    Validação e Preview de Relatório (GDI)
                  </h3>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">Etapa Preparatória</span>
                </div>
                
                <button
                  type="button"
                  onClick={handleValidateReport}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
                >
                  <CheckCircle2 size={14} />
                  <span>Validar Relatório</span>
                </button>

                {reportPreview !== null && (
                  <div className="border border-blue-200 rounded-2xl p-5 bg-blue-50/20 space-y-4 animate-in fade-in duration-200 text-left">
                    <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></div>
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider font-mono">
                        Preview do Google Docs integration
                      </h4>
                    </div>

                    <p className="text-[11px] text-blue-900 font-medium leading-normal">
                      Os dados de Relação de Documentos Básicos do Escritório, Relação de Provas Mínimas obrigatórias e Relação de outras Provas solicitadas foram mapeados com sucesso.
                    </p>

                    <div className="bg-white border border-blue-100 rounded-xl p-3.5 font-mono text-[10px] text-blue-800 leading-normal max-h-56 overflow-y-auto whitespace-pre-wrap select-all">
                      <span className="font-extrabold uppercase block text-[8px] text-blue-500 tracking-wider mb-2">
                        PLACEHOLDER DE DESTINO: {"<<"}Relatório_geral_de_Provas_pessoa_fisica{">>"}
                      </span>
                      {reportPreview}
                    </div>

                    <div className="pt-1">
                      {isPreviewValidated ? (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-950 rounded-xl text-[10px] font-bold leading-normal flex items-start gap-2 animate-in fade-in duration-200">
                          <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={15} />
                          <div className="space-y-0.5">
                            <span className="block text-emerald-900 uppercase text-[9px] tracking-wider font-mono font-black">Preview do GDI Homologado</span>
                            <span className="text-emerald-800">O payload da {"<<"}Relatório_geral_de_Provas_pessoa_fisica{">>"} de Provas da Pessoa Física está 100% pronto para ser enviado! 🔵</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsPreviewValidated(true);
                            setSuccess("Preview do Google Docs validado com sucesso! Payload do placeholder está pronto para ser enviado.");
                            setTimeout(() => setSuccess(null), 3500);
                          }}
                          className="w-full py-2.5 bg-blue-700 hover:bg-blue-850 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
                        >
                          <span>Validar Preview</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* GDI AUTOMATION - STAGE 5 REPORT GENERATION */}
              <div id="gdocs-relatorio-provas-automatizado" className="space-y-4">
                <h3 className="text-xs font-black text-blue-650 uppercase tracking-wider border-b pb-1 font-mono">
                  GDI — Google Docs Integration (Azul)
                </h3>

                <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/20 border border-blue-150 rounded-3xl p-6 shadow-3xs space-y-5 text-left animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-black text-[9px] uppercase tracking-wider font-mono">
                          Automação GDI Ativa
                        </span>
                        <Sparkles size={16} className="text-blue-600 animate-pulse" />
                      </div>
                      <h2 className="text-sm font-black text-slate-900">
                        Gerador de Relatório de Provas via Google Workspace
                      </h2>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Esta ferramenta compila e envia a integridade material de todas as provas diretamente ao build receptor do Google Docs para preenchimento de placeholders, indexação e arquivamento automatizado na pasta em tempo real.
                      </p>
                    </div>
                  </div>

                  {!driveFolderId ? (
                    <div className="p-4 bg-rose-50/80 border border-rose-150 rounded-2xl flex items-start gap-3 text-rose-950 text-xs font-semibold leading-relaxed">
                      <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-rose-950">
                        <p className="font-extrabold uppercase text-[9px] tracking-wider text-rose-800 font-mono">Pasta do Cliente Ausente</p>
                        <p className="font-medium text-rose-900 leading-relaxed text-xs">
                          Não é possível gerar o Relatório de Provas para o Google Docs porque a pasta do cliente no Google Drive não está configurada.
                        </p>
                        <p className="text-[10px] text-rose-700 font-semibold italic">
                          Por favor, cadastre ou sincronize a pasta do Drive nas configurações de cadastro do cliente antes de prosseguir.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* CONFIGURAÇÕES DA AUTOMAÇÃO */}
                      <div className="border border-blue-155 rounded-2xl overflow-hidden bg-white/80">
                        <button
                          type="button"
                          onClick={() => setIsGdiSettingsOpen(!isGdiSettingsOpen)}
                          className="w-full px-4.5 py-3 flex items-center justify-between bg-white border-b border-gray-150 hover:bg-gray-55 transition-colors cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2">
                            <Settings size={14} className="text-blue-600 animate-[spin_8s_linear_infinite]" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">Configurações do Google Docs</span>
                          </div>
                          <span className="text-[11px] font-black uppercase text-blue-600 hover:text-blue-800 font-sans">
                            {isGdiSettingsOpen ? 'Ocultar' : 'Visualizar'}
                          </span>
                        </button>

                        {isGdiSettingsOpen && (
                          <div className="p-4.5 space-y-4 bg-white animate-fadeIn text-xs">
                            <div className="space-y-1">
                              <p className="font-extrabold text-gray-400 text-[10px] uppercase tracking-wider">Identificador da Pasta do Cliente (Pasta ID)</p>
                              <p className="font-mono bg-gray-55 border border-gray-150 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 select-all max-w-fit break-all">
                                {driveFolderId}
                              </p>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              <p className="font-extrabold text-gray-400 text-[10px] uppercase tracking-wider">Template Oficial de Relatório de Provas PF</p>
                              <a
                                href="https://docs.google.com/document/d/1BPIOSWMjvLsSWzo_NcMjixrYUhmq7sKW2pRjdp1bS0s/edit"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-blue-650 hover:text-blue-850 font-extrabold hover:underline"
                              >
                                <FileCode size={14} className="text-blue-500" />
                                <span>Ver template no Google Docs</span>
                                <ExternalLink size={12} className="stroke-[2.5]" />
                              </a>
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs')}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 hover:text-blue-800"
                              >
                                Configurar Google Docs <ArrowRight size={10} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Informações da pasta do cliente */}
                      <div className="p-4 bg-white border border-gray-150 rounded-2xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs">
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
                            className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-250 hover:border-blue-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs whitespace-nowrap"
                          >
                            <div className="flex items-center gap-0.5 mr-1.5 bg-white shadow-3xs border border-gray-100 px-1 py-0.5 rounded-md size-fit shrink-0">
                              <span className="w-1 h-3.5 bg-[#4285F4] rounded-full" />
                              <span className="w-1 h-3.5 bg-[#34A853] rounded-full" />
                              <span className="w-1 h-3.5 bg-[#FBBC05] rounded-full" />
                            </div>
                            <span>Abrir pasta no Drive</span>
                            <ExternalLink size={12} className="stroke-[2.5]" />
                          </a>
                        )}
                      </div>

                      {/* STATUS DA AUTOMAÇÃO */}
                      <div className="border border-blue-150 rounded-2xl p-5 bg-white space-y-2.5 bg-white/80">
                        <p className="font-bold text-blue-500 text-[10px] uppercase tracking-widest font-mono">Status da Automação</p>
                        
                        {caseObj?.relatorioProvasGoogleDocsUrl ? (
                          <div className="p-3 bg-blue-55 border border-blue-200 rounded-xl text-blue-950 text-xs font-bold leading-relaxed flex items-center gap-2 font-mono">
                            <CheckCircle2 className="text-blue-600" size={16} />
                            <span>Relatório de Provas gerado com sucesso! ✅</span>
                          </div>
                        ) : generatingRelatorio ? (
                          <div className="p-3 bg-blue-55 border border-blue-250 rounded-xl text-blue-900 text-xs font-bold flex items-center gap-2 animate-pulse font-mono">
                            <RefreshCw className="text-blue-505 shrink-0 animate-spin" size={14} />
                            <span>Sincronizando com GDI... Substituindo placeholders secundários</span>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-gray-50/40 border border-gray-200 rounded-xl text-gray-400 text-xs font-semibold flex items-center gap-2 font-mono">
                            <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
                            <span>Aguardando comando de geração do relatório integrado.</span>
                          </div>
                        )}
                      </div>

                      {caseObj?.relatorioProvasGoogleDocsUrl && (
                        <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs animate-in slide-in-from-top-1 duration-200">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-blue-50 border border-blue-150 rounded-xl text-blue-650">
                              <FileText size={20} />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Documento do Google Docs</h3>
                              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                O arquivo de Relatório de Provas de etapa 5 já foi assinalado e está pronto para consulta.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 pt-1.5">
                            <a
                              href={caseObj.relatorioProvasGoogleDocsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-4.5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold w-full"
                            >
                              <ExternalLink size={13} />
                              <span>Abrir Relatório no Google Docs</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyRelatorioLink(caseObj.relatorioProvasGoogleDocsUrl)}
                              className={`inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-black uppercase transition-all border shadow-3xs cursor-pointer font-bold w-full ${
                                copiedRelatorio 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                  : 'bg-white border-gray-250 hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              {copiedRelatorio ? <Check size={13} /> : <Copy size={13} />}
                              <span>{copiedRelatorio ? "Link Copiado!" : "Copiar Link"}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACTION REGREATE BUTTON IN COLUNA UNICA */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleGenerateRelatorioDocs}
                          disabled={generatingRelatorio}
                          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-3xs transition-all flex items-center justify-center gap-1.5 font-bold"
                        >
                          <RefreshCw size={12} className={generatingRelatorio ? "animate-spin" : ""} />
                          <span>
                            {generatingRelatorio ? "Gerando Relatório..." : caseObj?.relatorioProvasGoogleDocsUrl ? "Regerar Relatório de Provas" : "Gerar Relatório de Provas Solicitadas"}
                          </span>
                        </button>
                      </div>

                      {/* RECENT GDI LOGS ACTION LIST */}
                      {relatorioLogs.length > 0 && (
                        <div className="p-4 bg-gray-55 border border-gray-150 rounded-2xl space-y-2 text-left">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider font-mono">Histórico de Transações GDI</p>
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pl-1">
                            {relatorioLogs.map((log, lIdx) => (
                              <div key={lIdx} className="flex items-start gap-2 text-[11px] leading-tight">
                                <span className="text-gray-400 font-mono text-[9px] shrink-0 pt-0.5">{log.timestamp.split('T')[1].slice(0, 8)}</span>
                                <span className="text-blue-700 font-black font-mono shrink-0 uppercase text-[9px] bg-blue-50 px-1 py-0.5 rounded">{log.step}</span>
                                {log.details && (
                                  <span className="text-gray-600 font-medium truncate"> - {JSON.stringify(log.details)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>

              {/* ACTION PORT BOSS BUTTON */}
              <div className="pt-4 border-t border-gray-100 flex flex-col items-stretch">
                <button
                  type="button"
                  onClick={handleConfirmConsolidate}
                  disabled={saving}
                  className={`py-3.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    wizardState?.step5_consolidado_completed 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>
                    {saving ? 'Processando consolidado...' : wizardState?.step5_consolidado_completed ? 'Relatório Já Validado' : 'Validar e Consolidar Custódia de Provas'}
                  </span>
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
