import React, { useState, useEffect } from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import EntregaDocumento from '../components/EntregaDocumento';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle, Sparkles, DollarSign, Calendar, Info, 
  ShieldAlert, FileCheck, CheckCircle2, ChevronRight, Lock, 
  HelpCircle, Sparkle, Ban, Coins, RefreshCw, ExternalLink, Copy, FileCode
} from 'lucide-react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useAuth } from '../../../../contexts/AuthContext';
import { buildContratoHonorariosPfPlaceholders } from '../../../../lib/documents/placeholderBuilders';

export default function ContratoHonorariosPF() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [isRenewingGoogle, setIsRenewingGoogle] = React.useState(false);
  const generationInFlightRef = React.useRef(false);

  const handleRenewGoogle = async () => {
    setIsRenewingGoogle(true);
    try {
      await loginWithGoogle('boss_admin');
      setSuccess("Autenticação Google renovada com sucesso! Você já pode gerar o contrato novamente.");
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
    setError,
    success,
    setSuccess,
    clientName,
    client,
    clientSlug,
    caseObj,
    wizardState,
    saveWizardStateUpdate,
    triggerSimulation,
    addWizardFile,
    removeWizardFile,
    handleCheckboxToggle,
    navigate,
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
        const data = snapshot.data();
        setLocalCaseObj(data);
        if (data.contratoHonorariosStatus === 'criada' || data.contratoHonorariosGoogleDocsUrl) {
          setGdocsConfirmed(true);
        }
      }
    });
    return () => unsubscribe();
  }, [caseId]);

  // Financial Form state (SubEtapa 1)
  const [financialDocId, setFinancialDocId] = useState<string | null>(null);
  const [financialLoading, setFinancialLoading] = useState(true);
  const [financialSaved, setFinancialSaved] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);

  const [formChargeType, setFormChargeType] = useState('Honorários fixos');
  const [customChargeType, setCustomChargeType] = useState('');
  const [formTotalAmount, setFormTotalAmount] = useState<string>('0');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Cartão de Crédito');
  const [formInstallments, setFormInstallments] = useState<number>(1);
  const [formPaymentMode, setFormPaymentMode] = useState<'avista' | 'parcelado'>('avista');
  const [formFirstDueDate, setFormFirstDueDate] = useState('');
  const [formFinancialStatus, setFormFinancialStatus] = useState<any>('pendente');
  const [formVisibleToClient, setFormVisibleToClient] = useState(true);
  const [formPublicMessage, setFormPublicMessage] = useState('');
  const [formContractLinked, setFormContractLinked] = useState(false);
  const [formPaymentProvider, setFormPaymentProvider] = useState<any>('manual_temporario');
  const [formNotes, setFormNotes] = useState('');

  // Service type state fields for SubEtapa 1
  const [contractedServiceType, setContractedServiceType] = useState('');

  // Manual configuration flag for step 2
  const [gdocsConfirmed, setGdocsConfirmed] = useState(false);

  // Active step manager
  const [activeSubStep, setActiveSubStep] = useState<1 | 2 | 3>(1);
  const [previewGenerating, setPreviewGenerating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [uploading, setUploading] = React.useState(false);

  // Sync service types from caseObj
  useEffect(() => {
    if (caseObj) {
      setContractedServiceType(caseObj.contractedServiceType || '');
    }
  }, [caseObj]);

  // Load financial record if exists
  useEffect(() => {
    if (!caseId) return;
    async function loadFinancial() {
      setFinancialLoading(true);
      try {
        const q = query(collection(db, 'caseFinancials'), where('caseId', '==', caseId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docRef = snap.docs[0];
          const fee = docRef.data();
          setFinancialDocId(docRef.id);
          
          const chargeTypeOptions = [
            'Honorários fixos',
            'Honorários de êxito',
            'Entrada + êxito',
            'Parcelado',
            'Consulta',
            'Taxa administrativa',
            'Custas'
          ];
          
          if (chargeTypeOptions.includes(fee.chargeType)) {
            setFormChargeType(fee.chargeType);
            setCustomChargeType('');
          } else {
            setFormChargeType('Outro');
            setCustomChargeType(fee.chargeType || '');
          }

          setFormTotalAmount(String(fee.totalAmount || 0));
          setFormPaymentMethod(fee.paymentMethod || 'Cartão de Crédito');
          setFormInstallments(fee.installments || 1);
          setFormPaymentMode(fee.paymentMode || (fee.installments > 1 ? 'parcelado' : 'avista'));
          setFormFirstDueDate(fee.firstDueDate || '');
          setFormFinancialStatus(fee.financialStatus || 'pendente');
          setFormVisibleToClient(fee.visibleToClient !== false);
          setFormPublicMessage(fee.publicFinancialMessage || '');
          setFormContractLinked(fee.contractLinked === true);
          setFormPaymentProvider(fee.paymentProvider || 'manual_temporario');
          setFormNotes(fee.notes || '');
          setContractedServiceType(fee.contractedServiceType || '');
          setFinancialSaved(true);
        }
      } catch (e) {
        console.error('Erro ao ler registro financeiro do caso:', e);
      } finally {
        setFinancialLoading(false);
      }
    }
    loadFinancial();
  }, [caseId]);

  // Determine active/unlocked steps when data becomes available or state changes
  useEffect(() => {
    if (!fetching && !financialLoading) {
      if (financialSaved) {
        if (wizardState.q3_1 === 'sim' || gdocsConfirmed) {
          setActiveSubStep(3);
        } else {
          setActiveSubStep(2);
        }
      } else {
        setActiveSubStep(1);
      }
    }
  }, [fetching, financialLoading, financialSaved, wizardState.q3_1, gdocsConfirmed]);

  // If already generated/answered q3_1 previously, automatically unlock and confirm SubEtapa 2
  useEffect(() => {
    if (wizardState.q3_1 === 'sim') {
      setGdocsConfirmed(true);
    }
  }, [wizardState.q3_1]);

  const handleNextPhase = () => {
    saveWizardStateUpdate({ step3_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PF`);
    });
  };

  const handleSaveFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFinancial(true);
    setError(null);
    setSuccess(null);

    const resolvedChargeType = formChargeType === 'Outro' ? customChargeType.trim() : formChargeType;
    if (!resolvedChargeType) {
      setError('Por favor preencha o Tipo de Cobrança.');
      setSavingFinancial(false);
      return;
    }

    const parsedAmount = parseFloat(formTotalAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('O valor total do faturamento deve ser um número válido superior ou igual a zero BRL.');
      setSavingFinancial(false);
      return;
    }

    const calculatedInstallments = formPaymentMode === 'avista' ? 1 : (Number(formInstallments) || 1);
    const calculatedInstallmentAmount = parseFloat((parsedAmount / calculatedInstallments).toFixed(2)) || 0;

    const nowISO = new Date().toISOString();
    try {
      const payload: any = {
        caseId: caseId!,
        clientId: client?.id || caseObj?.clientId || '',
        clientSlug: clientSlug || '',
        chargeType: resolvedChargeType,
        totalAmount: parsedAmount,
        paymentMethod: formPaymentMethod,
        paymentMode: formPaymentMode,
        installments: calculatedInstallments,
        installmentAmount: calculatedInstallmentAmount,
        firstDueDate: formFirstDueDate,
        financialStatus: formFinancialStatus,
        visibleToClient: formVisibleToClient,
        publicFinancialMessage: formPublicMessage.trim(),
        contractLinked: formContractLinked,
        contractName: 'Contrato de Prestação de Serviços Jurídicos',
        contractUrl: '',
        contractVisibleToClient: true,
        paymentProvider: formPaymentProvider,
        notes: formNotes.trim(),
        contractedServiceType: contractedServiceType.trim(),
        archived: false,
        updatedAt: nowISO,
        createdAt: nowISO
      };

      if (financialDocId) {
        const docRef = doc(db, 'caseFinancials', financialDocId);
        const existingSnap = await getDoc(docRef);
        payload.createdAt = existingSnap.exists() ? (existingSnap.data()?.createdAt || nowISO) : nowISO;
        await updateDoc(docRef, payload);
      } else {
        const docRef = await addDoc(collection(db, 'caseFinancials'), payload);
        setFinancialDocId(docRef.id);
      }

      // Automatically update cases references
      const caseUpdates: any = {
        contractedServiceType: contractedServiceType.trim(),
        updatedAt: nowISO
      };

      if (formVisibleToClient) {
        caseUpdates.financialStatus = formFinancialStatus;
        caseUpdates.hasFinancialRecord = true;
      }

      await updateDoc(doc(db, 'cases', caseId!), caseUpdates);

      // Mirror document update (e.g., casos collection)
      try {
        await setDoc(doc(db, 'casos', caseId!), {
          id: caseId!,
          caseId: caseId!,
          contractedServiceType: contractedServiceType.trim(),
          updatedAt: nowISO
        }, { merge: true });
      } catch (mirrorErr) {
        console.warn('Silent mirror save warning:', mirrorErr);
      }

      setSuccess('Faturamento agendado com sucesso.');
      setFinancialSaved(true);
      setActiveSubStep(2);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao agendar faturamento: ${err.message || err}`);
    } finally {
      setSavingFinancial(false);
    }
  };

  const handleConfirmGDocs = () => {
    setGdocsConfirmed(true);
    setSuccess('Contrato de Honorários confirmado e pronto para auditoria!');
    setActiveSubStep(3);
    setTimeout(() => setSuccess(null), 2500);
  };

  
  const buildCanonicalContratoPayload = () => {
    const resolvedChargeType = formChargeType === 'Outro' ? customChargeType.trim() : formChargeType;
    const parsedAmount = parseFloat(formTotalAmount) || 0;
    const calculatedInstallments = formPaymentMode === 'avista' ? 1 : (Number(formInstallments) || 1);
    const calculatedInstallmentAmount = parseFloat((parsedAmount / calculatedInstallments).toFixed(2)) || 0;

    let finalContractedServiceType = contractedServiceType.trim();
    if (!finalContractedServiceType) {
      finalContractedServiceType = caseObj?.contractedServiceType || caseObj?.tipoServicoContratado || caseObj?.tipoServico || caseObj?.assunto || '';
    }

    const formatCurrency = (val: number | string) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num)) return '0,00';
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    };

    const normalizedFinancialData = {
      contractedServiceType: finalContractedServiceType,
      tipoServicoContratado: finalContractedServiceType,
      tipoServico: finalContractedServiceType,
      chargeType: resolvedChargeType,
      formaPagamento: formPaymentMode === 'avista' ? 'À vista' : 'Parcelado',
      formaCobranca: resolvedChargeType,
      totalAmount: formatCurrency(parsedAmount),
      valorTotal: formatCurrency(parsedAmount),
      valorHonorarios: formatCurrency(parsedAmount),
      honorarioFixoValor: formatCurrency(parsedAmount),
      quantidadeParcelas: calculatedInstallments,
      parcelas: calculatedInstallments,
      valorParcela: formatCurrency(calculatedInstallmentAmount),
      dataPrimeiroVencimento: formatDate(formFirstDueDate),
      vencimento: formatDate(formFirstDueDate),
      notes: formNotes.trim(),
      cobrancaAutomaticaInteg: formPaymentProvider,
      paymentMethod: formPaymentMethod,
      paymentMode: formPaymentMode,
      tipoRecebimento: formPaymentMethod
    };

    let placeholders: Record<string, string> = {};
    try {
      placeholders = buildContratoHonorariosPfPlaceholders(client, { ...caseObj, ...normalizedFinancialData }, normalizedFinancialData);
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dataAssinaturaFormated = `${day}/${month}/${year}`;
      
      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;
    } catch (errPl: any) {
      throw new Error(`Erro ao construir placeholders: ${errPl.message}`);
    }

    const payloadHash = btoa(unescape(encodeURIComponent(JSON.stringify(placeholders))));

    return {
      documentType: "contrato_honorarios_pf",
      templateId: "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ",
      caseId,
      clientId: caseObj?.clientId || client?.id,
      placeholders,
      payloadHash
    };
  };

  const handleGeneratePreview = async () => {
    try {
      setPreviewGenerating(true);
      setError(null);
      setSuccess(null);
      const payload = buildCanonicalContratoPayload();
      
      const response = await fetch("/api/google-docs/contract-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const responseData = await response.json();
      if (!response.ok || !responseData.success) {
        throw new Error(responseData.errorMessage || responseData.error || "Falha ao gerar prévia");
      }
      
      setPreviewId(responseData.previewId);
      setSuccess("Prévia gerada com sucesso!");
    } catch (err: any) {
      setError(err.message || "Falha ao gerar prévia");
    } finally {
      setPreviewGenerating(false);
    }
  };

  const handleGenerateContratoGDocs = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Contrato PF ignorada.");
      return;
    }
    generationInFlightRef.current = true;

    try {
      const jobId = crypto.randomUUID();
      const jobLogs: any[] = [];
      const addClientLog = (action: string, message: string) => {
        jobLogs.push({
          action,
          timestamp: new Date().toISOString(),
          message
        });
      };

      const actionLog = intent === 'initial' ? 'DOCUMENT_SINGLE_CLICK_GENERATION_STARTED' : 'DOCUMENT_NEW_VERSION_SINGLE_CLICK_STARTED';
      addClientLog(actionLog, `Geração de Contrato PF iniciada via clique único fático (${intent === 'initial' ? 'geração inicial' : 'nova versão'}).`);

      addClientLog("CONTR_PF_BUTTON_CLICKED", "O operador solicitou a geração fática do Contrato de Honorários PF.");

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

    addClientLog("CONTR_PF_CLIENT_DATA_LOADED", "Dados cadastrais do cliente e do caso carregados com sucesso do banco.");

    
      const resolvedNomeCompleto = (client?.pfData?.pf_nomeCompleto || client?.pfDadosPessoais?.pf_nomeCompleto || client?.nomeCompleto || client?.nome || client?.name || "").trim();

    if (!resolvedNomeCompleto) {
      addClientLog("CONTR_PF_REQUIRED_PLACEHOLDER_EMPTY", "Nome completo do cliente não localizado.");
      setError("Nome completo do cliente não localizado no cadastro PF. Verifique a Etapa 1 — Cadastro do Cliente.");
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
      addClientLog("CONTR_PF_REQUIRED_PLACEHOLDER_EMPTY", "CPF do cliente não localizado.");
      setError("Não é possível gerar o Contrato porque o CPF do cliente está ausente no cadastro.");
      return;
    }

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

    if (!folderIsReal) {
      setError("Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.");
      return;
    }

    addClientLog("CONTR_PF_FOLDER_FOUND", `Pasta destino no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`);

    const officialTemplateId = "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ";
    
    let payload;
    try {
      payload = buildCanonicalContratoPayload();
    } catch (err: any) {
      setError(err.message);
      return;
    }
    const { placeholders } = payload;
    
    
    
    /* removed */
    const essentialKeys = [
      "{{OUTORGANTE_NOME}}",
      "{{OUTORGANTE_CPF}}",
      "{{OUTORGANTE_ENDERECO}}",
      "{{TIPO_SERVICO}}",
      "{{VALOR_HONORARIOS}}",
      "{{DATA_ASSINATURA}}"
    ];
    
    const fieldNamesMap: Record<string, string> = {
      "{{OUTORGANTE_NOME}}": "Nome do Outorgante",
      "{{OUTORGANTE_CPF}}": "CPF do Outorgante",
      "{{OUTORGANTE_ENDERECO}}": "Endereço do Outorgante",
      "{{TIPO_SERVICO}}": "Tipo do Serviço Contratado",
      "{{VALOR_HONORARIOS}}": "Valor dos Honorários",
      "{{DATA_ASSINATURA}}": "Data da Assinatura"
    };

    const emptyEssentials = essentialKeys.filter(k => {
      const val = placeholders[k];
      return !val || String(val).trim() === "";
    });

    if (emptyEssentials.length > 0) {
      const fieldNames = emptyEssentials.map(k => fieldNamesMap[k] || k).join(", ");
      const errorMsg = `Não é possível gerar o Contrato PF porque existem campos essenciais vazios no cadastro: ${fieldNames}.`;
      setError(errorMsg);
      return;
    }
    
    const currentGoogleAccessToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

    if (!currentGoogleAccessToken && !localOverride) {
      setError("Faça login novamente com Google para autorizar o acesso ou configure a Service Account.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const caseDocRef = doc(db, 'cases', caseId);
    await updateDoc(caseDocRef, {
      contratoHonorariosStatus: "gerando",
      contratoHonorariosLogFalha: ""
    });

    addClientLog("CONTR_PF_TEMPLATE_COPY_STARTED", "Iniciando a duplicação física da minuta oficial GDocs em Drive...");

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v1",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: "contrato_honorarios_pf",
      templateKey: "contrato_honorarios_pf",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: caseId,
      portalClientId: targetClientId,
      clientType: "PF",
      destinationFolderId: clientDriveFolderId,
      destinationFolderUrl: clientDriveFolderUrl,
      outputFileName: `Contrato de Honorários - ${resolvedNomeCompleto}`,
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
          intent,
          forceNewVersion: intent === "new_version",
          existingDocument: {
            id: localCaseObj?.contratoHonorariosGoogleDocsId || localCaseObj?.contratoHonorariosPfId || null,
            url: localCaseObj?.contratoHonorariosGoogleDocsUrl || localCaseObj?.contratoHonorariosPfUrl || null,
            version: Number(localCaseObj?.contratoHonorariosVersion || 0)
          },
          googleAccessToken: currentGoogleAccessToken,
          documentType: "contrato_honorarios_pf",
          templateKey: "contrato_honorarios_pf",
          templateId: officialTemplateId,
          caseId,
          clientId: caseObj?.clientId || client?.id,
          clientType: "PF",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `Contrato de Honorários - ${resolvedNomeCompleto}`,
          placeholders,
          metadata: {
            source: "Portal BOSS - Contrato PF",
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-contrato-PF`,
            folderSource: "Automação Google Drive — Pasta do Cliente",
            clientDataSource: "clients/{clientId}.pfData / financials"
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
          errorCode: responseData.errorCode || "CONTR_PF_TEMPLATE_COPY_FAILED"
        };
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      addClientLog("CONTR_PF_TEMPLATE_COPY_SUCCESS", `Clone GDocs em Drive bem-sucedido. ID gerado: ${googleDocsId}`);
      addClientLog("CONTR_PF_PLACEHOLDER_REPLACEMENT_STARTED", "Operação de lote para substituição dos placeholders ativada.");
      addClientLog("CONTR_PF_PLACEHOLDER_REPLACEMENT_SUCCESS", "Substituição terminada sem anomalias.");
      addClientLog("CONTR_PF_DOCUMENT_CREATED", "Homologação do arquivo fático integrada ao Drive.");
      addClientLog("CONTR_PF_CASE_UPDATED", "Caso persistido com chaves de referência adicionadas.");
      addClientLog("CONTR_PF_FLOW_COMPLETED", "Fluxo terminou com sucesso absoluto fático.");

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "criada",
        contratoHonorariosPfId: googleDocsId,
        contratoHonorariosPfUrl: googleDocsUrl,
        contratoHonorariosGoogleDocsId: googleDocsId,
        contratoHonorariosGoogleDocsUrl: googleDocsUrl,
        contratoHonorariosGeneratedAt: new Date().toISOString(),
        contratoHonorariosDestinationFolderId: clientDriveFolderId,
        contratoHonorariosDestinationFolderUrl: clientDriveFolderUrl,
        contratoHonorariosGoogleDocsJobId: jobId,
        contratoHonorariosGoogleDocsJobLogs: jobLogs,
        contratoHonorariosLogFalha: ""
      });

      // Save in generatedDocuments
      try {
        const subdocRef = doc(db, 'cases', caseId, 'generatedDocuments', 'contrato_honorarios_pf');
        await setDoc(subdocRef, {
          documentType: "contrato_honorarios_pf",
          displayName: `Contrato de Honorários PF - ${resolvedNomeCompleto}`,
          templateKey: "contrato_honorarios_pf",
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
          fileName: `Contrato de Honorários PF - ${resolvedNomeCompleto}`
        },
        logs: jobLogs
      });

      await saveWizardStateUpdate({ q3_1: 'sim' });
      setGdocsConfirmed(true);

      setSuccess("Contrato de Honorários PF gerado e associado ao caso com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 5000);
      setActiveSubStep(3);
    } catch (err: any) {
      console.error("[Contract Generator Failed]", err);
      const errorCode = err.errorCode || "CONTR_PF_PLACEHOLDER_REPLACEMENT_FAILED";
      let uiErrorMessage = err.message || "Falha na execução integrada.";
      if (errorCode === "GOOGLE_DRIVE_API_DISABLED") {
        uiErrorMessage = "A API do Google Drive está desativada no projeto do Google Cloud. Habilite-a para gerar documentos.";
      }

      addClientLog(errorCode, `Ocorreu uma falha no fluxo: ${uiErrorMessage}`);
      addClientLog("CONTR_PF_CASE_UPDATE_FAILED", "Falha ao persistir erro no BD.");

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "falha",
        contratoHonorariosLogFalha: uiErrorMessage,
        contratoHonorariosGeneratedAt: ""
      });

      try {
        await updateDoc(doc(db, 'googleDocsJobs', jobId), {
          status: "failed",
          updatedAt: new Date().toISOString(),
          errorCode,
          errorMessage: uiErrorMessage,
          logs: jobLogs
        });
      } catch (errJob) {
        console.warn("Failed to update job status", errJob);
      }

      setError(`Falha ao gerar Contrato PF no motor interno: ${uiErrorMessage}`);
    } finally {
      setSaving(false);
    }
    } finally {
      generationInFlightRef.current = false;
    }
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
            {uploading ? "Enviando para o Google Drive..." : "Anexar Contrato de Honorários Assinado (PDF/Imagem)"}
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
                const finalName = `Doc. $$$ - Contrato de Honorários - ${clientName || 'Cliente'}${extension}`;

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

                  const targetFolder = (client?.googleDriveClientFolderId || client?.gdriveFolderId || localCaseObj?.gdriveFolderId || '1YUl0Z3hbptBaXfdp0vSnvGTQv0ChsPMs').trim();

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
                  setSuccess("Contrato enviado e salvo no Google Drive: " + finalName);
                  setTimeout(() => setSuccess(null), 4000);
                } catch (err: any) {
                  setError(err.message || 'Erro ao realizar upload do contrato');
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

  const parsedTotal = parseFloat(formTotalAmount) || 0;
  const computedInstallments = formPaymentMode === 'avista' ? 1 : (formInstallments || 1);
  const computedInstallmentAmount = parseFloat((parsedTotal / computedInstallments).toFixed(2)) || 0;
  const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedTotal);
  const formattedInstallment = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedInstallmentAmount);

  let resumoTexto = '';
  if (formPaymentMode === 'avista') {
    resumoTexto = `Pagamento único à vista de ${formattedTotal}`;
    if (formFirstDueDate) {
      const parts = formFirstDueDate.split('-');
      if (parts.length === 3) {
        resumoTexto += `, com vencimento em ${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    resumoTexto += '.';
  } else {
    resumoTexto = `${computedInstallments} parcelas de ${formattedInstallment}`;
    if (formFirstDueDate) {
      const parts = formFirstDueDate.split('-');
      const day = parts[2] ? parseInt(parts[2], 10) : '';
      resumoTexto += `, vencendo todo dia ${day}`;
    }
    resumoTexto += '.';
  }

  return (
    <FluxoStepLayout stepName="Coleta de Documentos" caseId={caseId}>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {fetching || financialLoading ? (
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

            {/* SELECTION PIPELINE HEADERS */}
            <div className="grid grid-cols-3 gap-2 px-1 mb-2">
              <button 
                type="button"
                onClick={() => setActiveSubStep(1)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  activeSubStep === 1 
                    ? 'bg-indigo-600/10 border-indigo-300 text-indigo-950 shadow-2xs' 
                    : 'bg-white border-gray-150 text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="block font-sans text-[8.5px] font-black uppercase tracking-wider text-indigo-600 mb-0.5">SubEtapa 1 de 3</span>
                <span className="text-[11px] font-extrabold flex items-center gap-1 truncate">
                  💰 Tipo & Faturamento {financialSaved && <Check size={12} className="text-emerald-500 shrink-0" />}
                </span>
              </button>

              <button 
                type="button"
                disabled={!financialSaved}
                onClick={() => { if (financialSaved) setActiveSubStep(2); }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  activeSubStep === 2 
                    ? 'bg-indigo-600/10 border-indigo-300 text-indigo-950 shadow-2xs' 
                    : 'bg-white border-gray-150 text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <span className="block font-sans text-[8.5px] font-black uppercase tracking-wider text-indigo-600 mb-0.5">SubEtapa 2 de 3</span>
                <span className="text-[11px] font-extrabold flex items-center gap-1 truncate">
                  📄 Automação GDocs {gdocsConfirmed && <Check size={12} className="text-emerald-500 shrink-0" />}
                </span>
              </button>

              <button 
                type="button"
                disabled={!financialSaved || !gdocsConfirmed}
                onClick={() => { if (financialSaved && gdocsConfirmed) setActiveSubStep(3); }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  activeSubStep === 3 
                    ? 'bg-indigo-600/10 border-indigo-300 text-indigo-950 shadow-2xs' 
                    : 'bg-white border-gray-150 text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <span className="block font-sans text-[8.5px] font-black uppercase tracking-wider text-indigo-600 mb-0.5">SubEtapa 3 de 3</span>
                <span className="text-[11px] font-extrabold flex items-center gap-1 truncate">
                  ⚖️ Auditoria Contrato {wizardState.q3_1 === 'sim' && wizardState.q3_4 === 'sim' && <Check size={12} className="text-emerald-500 shrink-0" />}
                </span>
              </button>
            </div>

            {/* SUB-STEP 1 — AGENDAR NOVO FATURAMENTO */}
            {activeSubStep === 1 && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={18} className="text-indigo-600" /> SubEtapa 1 de 3 — Tipo do Serviço Contratado e Agendar Novo Faturamento
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1">Selecione o tipo do serviço contratado e configure as metas de faturamento associadas a esse caso jurídico.</p>
                </div>

                <form onSubmit={handleSaveFinancial} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* TIPO DO SERVIÇO CONTRATADO */}
                  <div className="md:col-span-2 border border-indigo-100 bg-indigo-50/20 p-4 rounded-2xl space-y-3 mb-2 animate-fade-in">
                    <h5 className="text-[10px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1">
                      <Sparkles size={14} className="text-indigo-600" /> Tipo do Serviço Contratado
                    </h5>
                    
                    <div className="space-y-1">
                      <label className="block text-[9.5px] font-black uppercase text-gray-400 tracking-wider font-mono">TIPO DO SERVIÇO CONTRATADO</label>
                      <input
                        type="text"
                        value={contractedServiceType}
                        onChange={(e) => setContractedServiceType(e.target.value)}
                        placeholder="Ex: Ação revisional bancária, execução de alimentos, defesa trabalhista, inventário, consultoria contratual..."
                        className="w-full px-3 py-2 bg-white border border-gray-150 rounded-xl text-xs font-semibold text-gray-805 outline-none focus:ring-2 focus:ring-indigo-105"
                      />
                    </div>
                  </div>
                  
                  {/* Tipo da Cobrança */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Tipo da Cobrança *</label>
                    <select
                      value={formChargeType}
                      onChange={(e) => setFormChargeType(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                      required
                    >
                      <option value="Honorários fixos">Honorários fixos</option>
                      <option value="Honorários de êxito">Honorários de êxito</option>
                      <option value="Entrada + êxito">Entrada + êxito</option>
                      <option value="Parcelado">Parcelado</option>
                      <option value="Consulta">Consulta</option>
                      <option value="Taxa administrativa">Taxa administrativa</option>
                      <option value="Custas">Custas</option>
                      <option value="Outro">Outro</option>
                    </select>

                    {formChargeType === 'Outro' && (
                      <input
                        type="text"
                        placeholder="Especifique outro tipo de cobrança"
                        value={customChargeType}
                        onChange={(e) => setCustomChargeType(e.target.value)}
                        className="w-full px-3 py-2 mt-1 bg-white border border-gray-150 rounded-xl text-xs font-semibold"
                        required
                      />
                    )}
                  </div>

                  {/* Como será a forma de pagamento? */}
                  <div className="md:col-span-2 space-y-2 border border-gray-100 bg-gray-50/50 p-4 rounded-2xl">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Como será a forma de pagamento?</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-700">
                        <input
                          type="radio"
                          name="paymentMode"
                          value="avista"
                          checked={formPaymentMode === 'avista'}
                          onChange={() => {
                            setFormPaymentMode('avista');
                            setFormInstallments(1);
                          }}
                          className="text-indigo-600 focus:ring-indigo-100 h-4 w-4"
                        />
                        À vista
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-700">
                        <input
                          type="radio"
                          name="paymentMode"
                          value="parcelado"
                          checked={formPaymentMode === 'parcelado'}
                          onChange={() => {
                            setFormPaymentMode('parcelado');
                            if (formInstallments <= 1) {
                              setFormInstallments(2);
                            }
                          }}
                          className="text-indigo-600 focus:ring-indigo-100 h-4 w-4"
                        />
                        Parcelado
                      </label>
                    </div>
                  </div>

                  {/* Valor total */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Valor total (BRL) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formTotalAmount}
                      onChange={(e) => setFormTotalAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 font-mono"
                      required
                    />
                  </div>

                  {/* Parcelas se parcelado */}
                  {formPaymentMode === 'parcelado' ? (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Número de parcelas *</label>
                      <input
                        type="number"
                        min="2"
                        value={formInstallments}
                        onChange={(e) => setFormInstallments(Number(e.target.value) || 2)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                        required
                      />
                    </div>
                  ) : (
                    <div className="hidden"></div>
                  )}

                  {/* Meio de Recebimento */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Meio de Recebimento</label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Boleto Bancário">Boleto Bancário</option>
                      <option value="PIX Direto">PIX Direto</option>
                      <option value="Transferência (TED/DOC)">Transferência (TED/DOC)</option>
                      <option value="Dinheiro físico">Dinheiro físico</option>
                      <option value="Outro meio">Outro meio</option>
                    </select>
                  </div>

                  {/* Card informativo de dinheiro fisico */}
                  {formPaymentMethod === 'Dinheiro físico' && (
                    <div className="md:col-span-2 bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-1.5 text-xs text-blue-950 animate-fade-in">
                      <div className="font-mono font-black text-[10px] uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                        <Info size={14} className="text-blue-500" /> AUTOMAÇÃO FUTURA — RECIBO EM DINHEIRO FÍSICO
                      </div>
                      <p className="font-semibold text-[11px]">
                        Espaço reservado para futura automação Google Docs de geração automática de recibo de pagamento em dinheiro físico.
                      </p>
                      <p className="text-[10px] text-blue-600/80 font-mono">
                        Observação técnica: A geração real do recibo será implementada em build próprio, com integração ao Google Docs.
                      </p>
                    </div>
                  )}

                  {/* Primeiro Vencimento */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Primeiro Vencimento</label>
                    <input
                      type="date"
                      value={formFirstDueDate}
                      onChange={(e) => setFormFirstDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  {/* Resumo do Planejamento Financeiro */}
                  <div className="md:col-span-2 bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-2 text-xs text-emerald-950">
                    <div className="font-mono font-black text-[10px] uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" /> Resumo do Planejamento Financeiro
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold"><span className="text-gray-400 font-normal">Valor total:</span> {formattedTotal}</p>
                      {formPaymentMode === 'parcelado' && (
                        <>
                          <p className="font-semibold"><span className="text-gray-400 font-normal">Número de parcelas:</span> {computedInstallments}</p>
                          <p className="font-semibold"><span className="text-gray-400 font-normal">Valor de cada parcela:</span> {formattedInstallment}</p>
                        </>
                      )}
                      {formFirstDueDate && (
                        <p className="font-semibold"><span className="text-gray-400 font-normal">Vencimento inicial:</span> {formFirstDueDate.split('-').reverse().join('/')}</p>
                      )}
                      <div className="mt-2 pt-2 border-t border-emerald-150/60 font-bold text-emerald-900 bg-emerald-100/30 p-2 rounded-xl">
                        Resumo: {resumoTexto}
                      </div>
                    </div>
                  </div>

                  {/* Status Financeiro Geral */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Status Financeiro Geral *</label>
                    <select
                      value={formFinancialStatus}
                      onChange={(e) => setFormFinancialStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                      required
                    >
                      <option value="pendente">Pendente</option>
                      <option value="aguardando_pagamento">Aguardando Pagamento</option>
                      <option value="pago">Pago</option>
                      <option value="parcialmente_pago">Parcialmente Pago</option>
                      <option value="em_atraso">Em Atraso</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="renegociado">Renegociado</option>
                      <option value="aguardando_webhook">Aguardando Validação Webhook</option>
                      <option value="erro_webhook">Erro de Sincronização Webhook</option>
                    </select>
                  </div>

                  {/* Exibir no Portal do Cliente? */}
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <input
                        type="checkbox"
                        id="visibleToClient"
                        checked={formVisibleToClient}
                        onChange={(e) => setFormVisibleToClient(e.target.checked)}
                        className="rounded text-indigo-650 h-4 w-4"
                      />
                      <label htmlFor="visibleToClient" className="text-xs font-extrabold text-gray-800 cursor-pointer select-none">
                        Exibir no Portal do Cliente?
                      </label>
                    </div>
                    {!formVisibleToClient && (
                      <p className="text-[10px] text-amber-600 font-semibold pl-1">
                        Se inativo, mostrará um aviso fático de atualização no fluxo.
                      </p>
                    )}
                  </div>

                  {/* Mensagem Auxiliar ao Cliente no Portal */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Mensagem Auxiliar ao Cliente no Portal</label>
                    <input
                      type="text"
                      placeholder="Instruções amigáveis do faturamento para o portal..."
                      value={formPublicMessage}
                      onChange={(e) => setFormPublicMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  {/* Contrato de Honorários Vinculado */}
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <input
                        type="checkbox"
                        id="contractLinked"
                        checked={formContractLinked}
                        onChange={(e) => setFormContractLinked(e.target.checked)}
                        className="rounded text-indigo-650 h-4 w-4"
                      />
                      <label htmlFor="contractLinked" className="text-xs font-extrabold text-gray-850 cursor-pointer select-none">
                        Contrato de Honorários Vinculado
                      </label>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium pl-1">
                      Mapear referência de contrato assinado ao faturamento.
                    </p>
                  </div>

                  {/* Provedor de Pagamento */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Provedor de Pagamento</label>
                    <select
                      value={formPaymentProvider}
                      onChange={(e) => setFormPaymentProvider(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="manual_temporario">Modo Manual Temporário</option>
                      <option value="stripe">Stripe Payments S.A.</option>
                      <option value="asaas">Asaas Boletos/PIX</option>
                    </select>
                    {formPaymentProvider === 'manual_temporario' && (
                      <div className="flex gap-1.5 items-start bg-amber-50 border border-amber-100 p-2 rounded-lg mt-1">
                        <Info size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-amber-700 font-medium leading-normal">
                          Modo manual temporário. Não é fonte final de verdade. Integração por webhook será necessária para produção.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Anotações Internas de Auditoria */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">Anotações Internas de Auditoria</label>
                    <textarea
                      placeholder="Observações de faturamento..."
                      value={formNotes}
                      rows={3}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingFinancial}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingFinancial ? 'Salvando...' : 'Próxima Subetapa'}
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUB-STEP 2 — AUTOMAÇÃO INTELIGENTE GOOGLE DOCS */}
            {activeSubStep === 2 && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-6 animate-fade-in">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={18} className="text-blue-600 animate-pulse" /> SubEtapa 2 de 3 — Automação Inteligente Google Docs
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-1">Gere a minuta oficial do Contrato de Honorários preenchida instantaneamente.</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                    v2.1.0-clean
                  </span>
                </div>

                {/* TEMPLATE INFO */}
                <div className="flex flex-col p-3.5 bg-gray-50 border border-gray-150 rounded-2xl text-xs gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                        <FileCode size={16} />
                      </div>
                      <div>
                        <span className="block font-extrabold text-gray-800">Modelo Oficial Contrato de Honorários PF</span>
                        <span className="text-[10px] text-gray-400 font-mono">Template ID: 1GJZ6LSW_szL...</span>
                      </div>
                    </div>
                    <a
                      href="https://docs.google.com/document/d/1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ/edit?tab=t.0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 px-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-950 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                    >
                      Abrir Template de Referência Google Docs <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-[10.5px] text-gray-500 font-medium">
                    Este é o modelo oficial do Contrato de Honorários PF. A geração final criará uma cópia deste documento, preservando integralmente logomarca, cabeçalho, rodapé, imagens, margens, fontes e estrutura.
                  </p>
                </div>

                {/* GENERATION STATE RENDERER */}
                {localCaseObj?.contratoHonorariosStatus === 'gerando' && (
                  <div className="p-8 border border-blue-150 bg-blue-50/20 rounded-2xl text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-black uppercase text-blue-900 tracking-wider font-mono">Gerando Contrato de Honorários...</p>
                    <p className="text-[11px] text-blue-600 font-semibold max-w-md mx-auto leading-relaxed">
                      O motor BOSS está gerando a cópia oficial da minuta no Google Drive do cliente e preenchendo todos os placeholders financeiros fáticos em background. Por favor, aguarde.
                    </p>
                  </div>
                )}

                {localCaseObj?.contratoHonorariosStatus === 'criada' && (
                  <div className="p-6 border border-emerald-150 bg-emerald-50/20 rounded-3xl space-y-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-2xl">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-xs font-extrabold text-emerald-950">Contrato de Honorários Individual Gerado!</h5>
                        <p className="text-[11px] text-emerald-800 font-medium">O documento foi criado faticamente na pasta do cliente no Google Drive da Giffoni Advogados.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 font-sans">
                      <a
                        href={localCaseObj?.contratoHonorariosGoogleDocsUrl || localCaseObj?.contratoHonorariosPfUrl || '#'}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <ExternalLink size={12} /> Abrir Contrato no Google Docs
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const url = localCaseObj?.contratoHonorariosGoogleDocsUrl || localCaseObj?.contratoHonorariosPfUrl || '';
                          navigator.clipboard.writeText(url);
                          setSuccess("Link do Contrato copiado para a área de transferência!");
                          setTimeout(() => setSuccess(null), 3000);
                        }}
                        className="px-4 py-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-900 text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Copy size={12} /> Copiar Link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateContratoGDocs('new_version')}
                        className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-800 text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RefreshCw size={12} /> Gerar Nova Versão
                      </button>
                    </div>
                  </div>
                )}

                {localCaseObj?.contratoHonorariosStatus === 'falha' && (
                  <div className="p-5 border border-rose-150 bg-rose-55/15 rounded-3xl space-y-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-100 text-rose-700 rounded-2xl">
                        <ShieldAlert size={18} />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-xs font-black text-rose-950 uppercase tracking-wide font-mono">Falha na Automação Google Docs</h5>
                        <p className="text-[11px] text-rose-805 font-bold leading-normal">{localCaseObj?.contratoHonorariosLogFalha || 'Ocorreu um erro inesperado no preenchimento do contrato.'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleGenerateContratoGDocs('new_version')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RefreshCw size={12} /> Tentar Gerar Novamente
                      </button>
                      <button
                        type="button"
                        onClick={handleRenewGoogle}
                        disabled={isRenewingGoogle}
                        className="px-4 py-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-900 text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isRenewingGoogle ? "animate-spin" : ""} />
                        {isRenewingGoogle ? 'Renovando...' : 'Renovar Credencial Google'}
                      </button>
                    </div>
                  </div>
                )}

                {(!localCaseObj?.contratoHonorariosStatus || localCaseObj?.contratoHonorariosStatus === 'pendente') && (
                  <div className="p-5 bg-indigo-50/30 border border-indigo-100 rounded-3xl space-y-3">
                    <p className="text-xs font-bold text-indigo-950">Pronto para Geração Eletrônica</p>
                    <p className="text-[11px] text-indigo-800 leading-normal">
                      As metas financeiras da SubEtapa 1 foram agendadas. Clique no botão abaixo para gerar a cópia oficial estruturada e automatizada do Contrato de Honorários sob a pasta GDrive deste cliente.
                    </p>
                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateContratoGDocs('initial')}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <Sparkles size={13} className="animate-pulse" /> Gerar Contrato no Google Docs
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmGDocs}
                        className="px-4 py-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-900 text-[10.5px] font-bold uppercase rounded-xl"
                      >
                        Pular Geração GDocs
                      </button>
                    </div>
                  </div>
                )}

                {/* REAL-TIME JOB LOGS PANEL */}
                {localCaseObj?.contratoHonorariosGoogleDocsJobLogs && localCaseObj?.contratoHonorariosGoogleDocsJobLogs.length > 0 && (
                  <div className="border border-gray-150 rounded-2xl overflow-hidden shadow-2xs font-mono text-[10.5px]">
                    <div className="bg-gray-900 text-gray-400 p-2.5 px-3 flex items-center justify-between">
                      <span className="font-extrabold text-[9px] uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></span>
                        LOGS DO MOTOR ELETRÔNICO GDocs (CONTR_PF_)
                      </span>
                      <span className="text-[8.5px] text-gray-500 font-bold">REAL-TIME FEEDBACK</span>
                    </div>
                    <div className="bg-gray-950 text-gray-200 p-3 max-h-40 overflow-y-auto space-y-1.5 leading-normal scrollbar-thin">
                      {localCaseObj.contratoHonorariosGoogleDocsJobLogs.map((log: any, idx: number) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 border-b border-gray-900/40 pb-1 last:border-0 last:pb-0">
                          <span className="text-indigo-400 font-bold shrink-0">{log.timestamp ? log.timestamp.split('T')[1].substring(0, 8) : '00:00:00'}</span>
                          <span className="text-blue-300 font-semibold shrink-0">[{log.action}]</span>
                          <span className="text-gray-300">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOTTOM ACTION BAR */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setActiveSubStep(1)}
                    className="p-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1 transition-all"
                  >
                    Voltar ao Faturamento
                  </button>
                  {gdocsConfirmed && (
                    <button
                      type="button"
                      onClick={() => setActiveSubStep(3)}
                      className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      Seguir para Auditoria
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SUB-STEP 3 — AUDITORIA INTELIGENTE DO CONTRATO */}
            {activeSubStep === 3 && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">
                <div className="border-b border-gray-100 pb-3">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-2">
                    <FileCheck size={18} className="text-emerald-600" /> SubEtapa 3 de 3 — Auditoria Inteligente do Contrato de Honorários
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1">Verifique as formalidades e valide a assinatura do contrato antes de liberar a fase de documentos mínimos.</p>
                </div>

                {/* Question 3.1 */}
                <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-xs font-extrabold text-gray-805">3.1 Você gerou o contrato de honorários do cliente?</p>
                  <div className="flex gap-4 mt-2">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q3_1" 
                          checked={wizardState.q3_1 === o} 
                          onChange={() => saveWizardStateUpdate({ q3_1: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {(wizardState.q3_1 === 'sim' || wizardState.q3_1 === 'nao') && (
                  <div className="space-y-4 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                    
                    {/* Question 3.2 */}
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-gray-800">3.2 Qual o modelo do contrato gerado?</p>
                      <select 
                        value={wizardState.q3_2 || ''}
                        onChange={(e) => saveWizardStateUpdate({ q3_2: e.target.value })}
                        className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white outline-none"
                      >
                        <option value="">Selecione o Modelo de Honorários...</option>
                        <option value="por_etapa">Contrato por Etapa Processual</option>
                        <option value="por_ato">Contrato por Ato Isolado/Diligência</option>
                        <option value="por_fase">Contrato por Fase/Instância</option>
                        <option value="mensal">Assessoria Mensal Recorrente</option>
                        <option value="sucesso_puro">Sucesso Puro (Ad Exitum %)</option>
                        <option value="misto">Misto (Fixo Inicial + Sucesso final)</option>
                        <option value="outro">Outro Modelo customizado da banca</option>
                      </select>

                      {wizardState.q3_2 === 'outro' && (
                        <input 
                          type="text" 
                          placeholder="Descreva o modelo contratual de honorários" 
                          value={wizardState.q3_2_outro || ''}
                          onChange={(e) => saveWizardStateUpdate({ q3_2_outro: e.target.value })}
                          className="mt-2 w-full max-w-md px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
                        />
                      )}
                    </div>

                    {/* Question 3.3 */}
                    {wizardState.q3_2 && (
                      <EntregaDocumento
                        tipoDocumento="contrato"
                        tipoPessoa="PF"
                        googleDocsUrl={caseObj?.contratoHonorariosGoogleDocsUrl || ''}
                        whatsappCliente={client?.pfDadosPessoais?.pf_whatsapp || client?.pfDadosPessoais?.pf_telefone || client?.pfData?.pf_whatsapp || client?.pfData?.pf_telefone || ''}
                        emailCliente={client?.pfDadosPessoais?.pf_email || client?.pfData?.pf_email || ''}
                        nomeCliente={clientName}
                        selectedMethods={wizardState.q3_3 || []}
                        onMethodsChange={(newMethods: string[]) => saveWizardStateUpdate({ q3_3: newMethods })}
                        outroValue={wizardState.q3_3_outro || ''}
                        onOutroChange={(val: string) => saveWizardStateUpdate({ q3_3_outro: val })}
                        questionNumber="3.3"
                      />
                    )}

                    {/* Question 3.4 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && (
                      <div className="space-y-1 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.4 Você recebeu o contrato do cliente?</p>
                        <div className="flex gap-4 mt-1.5">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_4" 
                                checked={wizardState.q3_4 === o} 
                                onChange={() => {
                                  saveWizardStateUpdate({ 
                                    q3_4: o,
                                    q3_como_c_recebida: '',
                                    q3_deseja_digitalizar_c: ''
                                  });
                                }} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question 3.5 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && wizardState.q3_4 === 'sim' && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.5 Como o Contrato de Honorários foi recebido?</p>
                        <div className="flex flex-wrap gap-4 mt-1.55">
                          {[
                            { val: 'fisico', label: 'Físico' },
                            { val: 'whatsapp', label: 'What’s App' },
                            { val: 'email', label: 'Email' },
                            { val: 'outro', label: 'Outro' }
                          ].map(opt => (
                            <label key={opt.val} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_como_c_recebida" 
                                checked={wizardState.q3_como_c_recebida === opt.val} 
                                onChange={() => {
                                  saveWizardStateUpdate({ 
                                    q3_como_c_recebida: opt.val,
                                    q3_deseja_digitalizar_c: ''
                                  });
                                }} 
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question 3.6 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && wizardState.q3_4 === 'sim' && wizardState.q3_como_c_recebida === 'fisico' && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.6 Deseja digitalizar o contrato do cliente agora?</p>
                        <div className="flex gap-4 mt-1.5">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_deseja_digitalizar_c" 
                                checked={wizardState.q3_deseja_digitalizar_c === o} 
                                onChange={() => saveWizardStateUpdate({ q3_deseja_digitalizar_c: o })} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* If yes to digitalize physically OR if received digitally */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && wizardState.q3_4 === 'sim' && (
                      (wizardState.q3_como_c_recebida === 'fisico' && wizardState.q3_deseja_digitalizar_c === 'sim') ||
                      (wizardState.q3_como_c_recebida && wizardState.q3_como_c_recebida !== 'fisico')
                    ) && (
                      <div className="space-y-2 animate-in fade-in duration-300 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-150 animate-in fade-in">
                        <p className="text-xs font-black text-indigo-950 uppercase tracking-wider block">Anexar e upload automático para Google Drive</p>
                        <FileUploadBox field="contratoFiles" />
                      </div>
                    )}

                    {/* If no to digitalize physically */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && wizardState.q3_4 === 'sim' && wizardState.q3_como_c_recebida === 'fisico' && wizardState.q3_deseja_digitalizar_c === 'nao' && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                        <span className="text-base">⚠️</span>
                        <span>Colocado automaticamente como pendência no setor de digitalização.</span>
                      </div>
                    )}

                    {/* Question 3.7 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && wizardState.q3_4 === 'sim' && (
                      <div className="space-y-1 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.7 Você informou o setor financeiro sobre o contrato?</p>
                        <div className="flex gap-4 mt-1.5 items-center">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_7" 
                                checked={wizardState.q3_7 === o} 
                                onChange={() => saveWizardStateUpdate({ q3_7: o })} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                          {wizardState.q3_7 !== 'sim' && wizardState.q3_4 === 'sim' && (
                            <button 
                              type="button" 
                              onClick={() => {
                                saveWizardStateUpdate({ q3_7: 'sim' });
                                setSuccess('Setor financeiro notificado com sucesso do contrato do cliente!');
                                setTimeout(() => setSuccess(null), 3000);
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-extrabold text-[9px] uppercase rounded-lg cursor-pointer"
                            >
                              Notificar Financeiro Agora
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* BOTTOM ACTION BAR */}
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button 
                      type="button" 
                      onClick={() => triggerSimulation('Contrato de Honorários', 'criada')} 
                      className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase cursor-pointer"
                    >
                      Gerar via Google Workspace
                    </button>
                    <button 
                      type="button" 
                      onClick={() => triggerSimulation('Contrato de Honorários', 'falha')} 
                      className="bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase cursor-pointer"
                    >
                      Simular Falha
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!wizardState.q3_1 || (wizardState.q3_1 === 'sim' && !wizardState.q3_2) || saving}
                    onClick={handleNextPhase}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>Próxima Fase</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
