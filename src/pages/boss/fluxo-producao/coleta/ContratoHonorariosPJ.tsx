import React, { useState, useEffect } from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import EntregaDocumento from '../components/EntregaDocumento';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle, Sparkles, DollarSign, Calendar, Info, 
  ShieldAlert, FileCheck, CheckCircle2, ChevronRight, Lock, 
  HelpCircle, Sparkle, Ban, Coins, Copy, RefreshCw, ExternalLink, FileCode
} from 'lucide-react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useAuth } from '../../../../contexts/AuthContext';
import { buildContratoHonorariosPjPlaceholders } from '../../../../lib/documents/placeholderBuilders';

export default function ContratoHonorariosPJ() {
  const {
    caseId,
    fetching,
    saving,
    setError,
    error,
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
    navigate
  } = useColetaState();

  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [isRenewingGoogle, setIsRenewingGoogle] = useState(false);
  const [localCaseObj, setLocalCaseObj] = useState<any>(null);
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

  // Real-time synchronization for GDocs engine parameters and statuses
  useEffect(() => {
    if (!caseId) return;
    const unsub = onSnapshot(doc(db, 'cases', caseId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setLocalCaseObj(data);
        if (data.contratoHonorariosStatus === 'criada' || data.contratoHonorariosGoogleDocsUrl) {
          setGdocsConfirmed(true);
        }
      }
    });
    return () => unsub();
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
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PJ`);
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
        contractName: 'Contrato de Prestação de Serviços Jurídicos Corporativos',
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
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao agendar faturamento: ${err.message || err}`);
    } finally {
      setSavingFinancial(false);
    }
  };

  const handleConfirmGDocs = () => {
    setGdocsConfirmed(true);
    setSuccess('Contrato de Honorários PJ confirmado e pronto para auditoria!');
    setActiveSubStep(3);
    setTimeout(() => setSuccess(null), 2500);
  };

  const handleGenerateContratoGDocs = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (generationInFlightRef.current) {
      console.warn("[DUPLICATE CLICK] Geração de Contrato PJ ignorada.");
      return;
    }
    generationInFlightRef.current = true;

    try {
      const jobId = 'job_contr_pj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const jobLogs: any[] = [];
      const addClientLog = (action: string, message: string) => {
        jobLogs.push({
          action,
          timestamp: new Date().toISOString(),
          message
        });
      };

      const actionLog = intent === 'initial' ? 'DOCUMENT_SINGLE_CLICK_GENERATION_STARTED' : 'DOCUMENT_NEW_VERSION_SINGLE_CLICK_STARTED';
      addClientLog(actionLog, `Geração de Contrato PJ iniciada via clique único fático (${intent === 'initial' ? 'geração inicial' : 'nova versão'}).`);

      addClientLog("CONTR_PJ_BUTTON_CLICKED", "O operador solicitou a geração fática do Contrato de Honorários PJ.");

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

    addClientLog("CONTR_PJ_CLIENT_DATA_LOADED", "Dados cadastrais corporativos do cliente PJ carregados com sucesso.");

    // Core PJ validation rules
    const resolvedRazaoSocial = (
      client?.pjDadosEmpresa?.pj_razaoSocial ||
      client?.pjData?.pj_razaoSocial ||
      client?.portalMirror?.pjDadosEmpresa?.razaoSocial ||
      client?.nomeCompleto ||
      client?.nome ||
      ""
    ).trim();

    if (!resolvedRazaoSocial) {
      addClientLog("CONTR_PJ_REQUIRED_PLACEHOLDER_EMPTY", "Razão Social da empresa não cadastrada.");
      setError("Razão Social da empresa não cadastrada. Verifique a Etapa 1 — Cadastro do Cliente.");
      return;
    }

    const resolvedCnpj = (
      client?.pjDadosEmpresa?.pj_cnpj ||
      client?.pjData?.pj_cnpj ||
      client?.portalMirror?.pjDadosEmpresa?.cnpj ||
      client?.cnpj ||
      ""
    ).trim();

    if (!resolvedCnpj) {
      addClientLog("CONTR_PJ_REQUIRED_PLACEHOLDER_EMPTY", "CNPJ do cliente PJ não localizado.");
      setError("Não é possível gerar o Contrato corporativo porque o CNPJ da empresa está ausente.");
      return;
    }

    // Google Drive check
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
      setError("Não há pasta real do Google Drive vinculada a este cliente corporativo. Acesse a Etapa 1 e crie a pasta do cliente primeiro.");
      return;
    }

    addClientLog("CONTR_PJ_FOLDER_FOUND", `Pasta destino PJ no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`);

    // Official template ID matching client size
    const officialTemplateId = "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ";
    addClientLog("CONTR_PJ_OFFICIAL_TEMPLATE_SELECTED", `Template oficial de Contrato PJ unificado selecionado: ${officialTemplateId}`);

    const resolvedChargeType = formChargeType === 'Outro' ? customChargeType.trim() : formChargeType;
    const parsedAmount = parseFloat(formTotalAmount) || 0;
    const calculatedInstallments = formPaymentMode === 'avista' ? 1 : (Number(formInstallments) || 1);
    const calculatedInstallmentAmount = parseFloat((parsedAmount / calculatedInstallments).toFixed(2)) || 0;

    const mockFinData = {
      tipoServicoContratado: contractedServiceType.trim(),
      tipoServico: contractedServiceType.trim(),
      formaPagamento: formPaymentMethod,
      formaCobranca: resolvedChargeType,
      totalAmount: parsedAmount,
      valorTotal: parsedAmount,
      valorHonorarios: parsedAmount,
      honorarioFixoValor: parsedAmount,
      quantidadeParcelas: calculatedInstallments,
      parcelas: calculatedInstallments,
      valorParcela: calculatedInstallmentAmount,
      dataPrimeiroVencimento: formFirstDueDate,
      vencimento: formFirstDueDate,
      notes: formNotes.trim(),
      cobrancaAutomaticaInteg: formPaymentProvider
    };

    let placeholders: Record<string, string>;
    try {
      placeholders = buildContratoHonorariosPjPlaceholders(client, { ...caseObj, ...mockFinData }, mockFinData);

      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dataAssinaturaFormated = `${day}/${month}/${year}`;
      
      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;

      addClientLog("CONTR_PJ_PLACEHOLDERS_BUILT", "Todas as chaves corporativas e placeholders de faturamento foram processados.");
    } catch (errPl: any) {
      setError(`Erro ao construir placeholders PJ: ${errPl.message}`);
      return;
    }

    const essentialKeys = [
      "{{OUTORGANTE_NOME}}",
      "{{OUTORGANTE_CNPJ}}",
      "{{OUTORGANTE_ENDERECO}}",
      "{{TIPO_SERVICO}}",
      "{{VALOR_HONORARIOS}}",
      "{{DATA_ASSINATURA}}"
    ];

    const fieldNamesMap: Record<string, string> = {
      "{{OUTORGANTE_NOME}}": "Razão Social",
      "{{OUTORGANTE_CNPJ}}": "CNPJ",
      "{{OUTORGANTE_ENDERECO}}": "Endereço Corporativo",
      "{{TIPO_SERVICO}}": "Tipo de Serviço Jurídico",
      "{{VALOR_HONORARIOS}}": "Honorários Combinados",
      "{{DATA_ASSINATURA}}": "Data da Assinatura"
    };

    const emptyEssentials = essentialKeys.filter(k => {
      const val = placeholders[k];
      return !val || String(val).trim() === "";
    });

    if (emptyEssentials.length > 0) {
      const fieldNames = emptyEssentials.map(k => fieldNamesMap[k] || k).join(", ");
      const errorMsg = `Não é possível gerar o Contrato PJ porque existem campos essenciais vazios no cadastro da empresa: ${fieldNames}.`;
      addClientLog("CONTR_PJ_REQUIRED_PLACEHOLDER_EMPTY", errorMsg);
      
      const failedJob = {
        id: jobId,
        contractVersion: "boss.placeholders.v1",
        source: "Portal BOSS Clientes",
        target: "Internal Generator Engine",
        documentType: "contrato_honorarios_pj",
        templateKey: "contrato_honorarios_pj",
        status: "failed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        caseId: caseId,
        portalClientId: targetClientId,
        clientType: "PJ",
        destinationFolderId: clientDriveFolderId,
        destinationFolderUrl: clientDriveFolderUrl,
        outputFileName: `Contrato PJ - ${resolvedRazaoSocial}`,
        placeholders,
        errorCode: "CONTR_PJ_REQUIRED_PLACEHOLDER_EMPTY",
        errorMessage: errorMsg,
        logs: jobLogs
      };

      await setDoc(doc(db, 'googleDocsJobs', jobId), failedJob);
      setError(errorMsg);
      return;
    }

    addClientLog("CONTR_PJ_REQUIRED_PLACEHOLDERS_VALIDATED", "Contrato verificado contra especificidades PJ fáticas.");

    const currentGoogleAccessToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

    if (!currentGoogleAccessToken && !localOverride) {
      setError("Faça login com Google para autorizar o acesso ou configure a Service Account.");
      return;
    }

    setSavingFinancial(true); // show loading state on generation
    setError(null);
    setSuccess(null);

    const caseDocRef = doc(db, 'cases', caseId);
    await updateDoc(caseDocRef, {
      contratoHonorariosStatus: "gerando",
      contratoHonorariosLogFalha: ""
    });

    addClientLog("CONTR_PJ_TEMPLATE_COPY_STARTED", "Duplicação integrada do GDocs PJ iniciada...");

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v1",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: "contrato_honorarios_pj",
      templateKey: "contrato_honorarios_pj",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: caseId,
      portalClientId: targetClientId,
      clientType: "PJ",
      destinationFolderId: clientDriveFolderId,
      destinationFolderUrl: clientDriveFolderUrl,
      outputFileName: `Contrato de Honorários PJ - ${resolvedRazaoSocial}`,
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
          documentType: "contrato_honorarios_pj",
          templateKey: "contrato_honorarios_pj",
          templateId: officialTemplateId,
          caseId,
          clientId: targetClientId,
          clientType: "PJ",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `Contrato de Honorários PJ - ${resolvedRazaoSocial}`,
          placeholders,
          metadata: {
            source: "Portal BOSS - Contrato PJ",
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-contrato-PJ`,
            clientDataSource: "clients/{clientId}.pjData / financials"
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
          message: responseData.errorMessage || responseData.error || responseText || "Falha na geração integrada eletrônica corporativa.",
          errorCode: responseData.errorCode || "CONTR_PJ_TEMPLATE_COPY_FAILED"
        };
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      addClientLog("CONTR_PJ_TEMPLATE_COPY_SUCCESS", `Clone GDocs PJ bem-sucedido. ID gerado: ${googleDocsId}`);
      addClientLog("CONTR_PJ_PLACEHOLDER_REPLACEMENT_STARTED", "Operação de lote para substituição dos placeholders PJ ativada.");
      addClientLog("CONTR_PJ_PLACEHOLDER_REPLACEMENT_SUCCESS", "Substituição corporativa terminada sem anomalias.");
      addClientLog("CONTR_PJ_DOCUMENT_CREATED", "Homologação do arquivo fático integrada ao Drive.");
      addClientLog("CONTR_PJ_CASE_UPDATED", "Caso persistido com chaves de referência adicionadas.");
      addClientLog("CONTR_PJ_FLOW_COMPLETED", "Fluxo corporativo terminou com absoluto sucesso.");

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "criada",
        contratoHonorariosPjId: googleDocsId,
        contratoHonorariosPjUrl: googleDocsUrl,
        contratoHonorariosGoogleDocsId: googleDocsId,
        contratoHonorariosGoogleDocsUrl: googleDocsUrl,
        contratoHonorariosGeneratedAt: new Date().toISOString(),
        contratoHonorariosDestinationFolderId: clientDriveFolderId,
        contratoHonorariosDestinationFolderUrl: clientDriveFolderUrl,
        contratoHonorariosGoogleDocsJobId: jobId,
        contratoHonorariosGoogleDocsJobLogs: jobLogs,
        contratoHonorariosLogFalha: ""
      });

      // Save in generatedDocuments subcollection
      try {
        const subdocRef = doc(db, 'cases', caseId, 'generatedDocuments', 'contrato_honorarios_pj');
        await setDoc(subdocRef, {
          documentType: "contrato_honorarios_pj",
          displayName: `Contrato de Honorários PJ - ${resolvedRazaoSocial}`,
          templateKey: "contrato_honorarios_pj",
          templateId: officialTemplateId,
          googleDocsId,
          googleDocsUrl,
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          status: "success",
          generatedAt: new Date().toISOString(),
          generatedBy: "Portal BOSS Central Interna (Stateless PJ)",
          errorCode: null,
          errorMessage: null,
          logs: jobLogs
        }, { merge: true });
      } catch (errSub: any) {
        console.warn("[PortalBoss] PJ Subcollection write failed", errSub.message);
      }

      await updateDoc(doc(db, 'googleDocsJobs', jobId), {
        status: "success",
        updatedAt: new Date().toISOString(),
        result: {
          googleDocsId,
          googleDocsUrl,
          fileName: `Contrato de Honorários PJ - ${resolvedRazaoSocial}`
        },
        logs: jobLogs
      });

      await saveWizardStateUpdate({ q3_1: 'sim' });
      setGdocsConfirmed(true);

      setSuccess("Contrato de Honorários PJ gerado e associado com absoluto sucesso!");
      setTimeout(() => setSuccess(null), 5000);
      setActiveSubStep(3);
    } catch (err: any) {
      console.error("[PJ Contract Generator Failed]", err);
      const errorMessage = err.message || "Falha na execução integrada.";
      const errorCode = err.errorCode || "CONTR_PJ_PLACEHOLDER_REPLACEMENT_FAILED";

      addClientLog(errorCode, `Ocorreu uma falha no fluxo corporativo: ${errorMessage}`);
      addClientLog("CONTR_PJ_CASE_UPDATE_FAILED", "Falha ao persistir erro no BD.");

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "falha",
        contratoHonorariosLogFalha: errorMessage,
        contratoHonorariosGeneratedAt: ""
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

      setError(`Falha ao gerar Contrato PJ corporativo: ${errorMessage}`);
    } finally {
      setSavingFinancial(false);
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
          <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-1" size={20} />
          <span className="text-[11px] font-bold text-gray-750">Anexar Contrato PJ Assinado (PDF)</span>
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
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                Etapa 3 — Pessoa Jurídica (PJ)
              </span>
              <span className="text-xs text-gray-400">Cliente: <strong>{clientName}</strong></span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none pt-1">
              Contrato de Honorários Corporativos (PJ)
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-declaracao-PJ`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar à Declaração
          </button>
        </div>

        {fetching || financialLoading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-650 rounded-full animate-spin"></div>
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
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-990 font-bold text-emerald-900 text-xs flex gap-2 items-center animate-in fade-in">
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
                  <p className="text-[11px] text-gray-400 mt-1">Selecione o tipo do serviço contratado e configure as metas de faturamento e fluxo financeiro associadas corporativamente.</p>
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
                        className="w-full px-3 py-2 bg-white border border-gray-150 rounded-xl text-xs font-semibold text-gray-855 outline-none focus:ring-2 focus:ring-indigo-105"
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
                        id="visibleToClientPJ"
                        checked={formVisibleToClient}
                        onChange={(e) => setFormVisibleToClient(e.target.checked)}
                        className="rounded text-indigo-650 h-4 w-4"
                      />
                      <label htmlFor="visibleToClientPJ" className="text-xs font-extrabold text-gray-800 cursor-pointer select-none">
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
                      placeholder="Instruções amigáveis do faturamento para o portal corporativo..."
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
                        id="contractLinkedPJ"
                        checked={formContractLinked}
                        onChange={(e) => setFormContractLinked(e.target.checked)}
                        className="rounded text-indigo-650 h-4 w-4"
                      />
                      <label htmlFor="contractLinkedPJ" className="text-xs font-extrabold text-gray-850 cursor-pointer select-none">
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
                      placeholder="Observações corporativas do faturamento..."
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
                    <p className="text-[11px] text-gray-400 mt-1">Gere a minuta oficial do Contrato corporativo integrada ao motor BOSS.</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                    v2.1.0-corp
                  </span>
                </div>

                {/* TEMPLATE INFO */}
                <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-150 rounded-2xl text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                      <FileCode size={16} />
                    </div>
                    <div>
                      <span className="block font-extrabold text-gray-800">Modelo Oficial Contrato de Honorários PJ</span>
                      <span className="text-[10px] text-gray-400 font-mono">Template ID: 1GJZ6LSW_szL...</span>
                    </div>
                  </div>
                  <a
                    href="https://docs.google.com/document/d/1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ/edit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 px-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-950 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                  >
                    Ver Minuta Base <ExternalLink size={10} />
                  </a>
                </div>

                {/* GENERATION STATE RENDERER */}
                {localCaseObj?.contratoHonorariosStatus === 'gerando' && (
                  <div className="p-8 border border-blue-150 bg-blue-50/20 rounded-2xl text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-black uppercase text-blue-900 tracking-wider font-mono">Gerando Contrato PJ...</p>
                    <p className="text-[11px] text-blue-600 font-semibold max-w-md mx-auto leading-relaxed">
                      O motor BOSS está gerando o Contrato de Honorários PJ em background e preenchendo todos os placeholders fáticos de sua empresa. Aguarde...
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
                        <h5 className="text-xs font-extrabold text-emerald-950">Contrato PJ Gerado com Sucesso!</h5>
                        <p className="text-[11px] text-emerald-800 font-medium">O documento foi criado e arquivado na pasta corporativa do cliente no Google Drive da Giffoni.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 font-sans">
                      <a
                        href={localCaseObj?.contratoHonorariosGoogleDocsUrl || localCaseObj?.contratoHonorariosPjUrl || '#'}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <ExternalLink size={12} /> Abrir Contrato PJ
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const url = localCaseObj?.contratoHonorariosGoogleDocsUrl || localCaseObj?.contratoHonorariosPjUrl || '';
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
                        <h5 className="text-xs font-black text-rose-950 uppercase tracking-wide font-mono">Falha na Automação GDocs PJ</h5>
                        <p className="text-[11px] text-rose-805 font-bold leading-normal">{localCaseObj?.contratoHonorariosLogFalha || 'Ocorreu um erro ao preencher o Contrato PJ no motor.'}</p>
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
                        className="px-4 py-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-950 text-[10.5px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isRenewingGoogle ? "animate-spin" : ""} />
                        {isRenewingGoogle ? 'Renovando...' : 'Renovar Credencial Google'}
                      </button>
                    </div>
                  </div>
                )}

                {(!localCaseObj?.contratoHonorariosStatus || localCaseObj?.contratoHonorariosStatus === 'pendente') && (
                  <div className="p-5 bg-indigo-50/30 border border-indigo-100 rounded-3xl space-y-3">
                    <p className="text-xs font-bold text-indigo-950">Pronto para Geração Eletrônica Corporativa</p>
                    <p className="text-[11px] text-indigo-800 leading-normal">
                      As metas financeiras corporativas da SubEtapa 1 foram agendadas. Clique no botão abaixo para gerar a cópia oficial estruturada e automatizada do Contrato corporativo PJ.
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
                        LOGS DO MOTOR ELETRÔNICO GDocs (CONTR_PJ_)
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
                  <p className="text-[11px] text-gray-400 mt-1">Valide as formalidades do contrato de honorários advocatícios corporativos.</p>
                </div>

                {/* Question 3.1 */}
                <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-xs font-extrabold text-gray-805">3.1 Você gerou o contrato de honorários corporativo?</p>
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
                      <p className="text-xs font-extrabold text-gray-800">3.2 Qual o modelo do contrato gerado para a empresa?</p>
                      <select 
                        value={wizardState.q3_2 || ''}
                        onChange={(e) => saveWizardStateUpdate({ q3_2: e.target.value })}
                        className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white outline-none"
                      >
                        <option value="">Selecione o Modelo Corporativo...</option>
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
                          placeholder="Descreva o modelo contratual corporativo" 
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
                        tipoPessoa="PJ"
                        googleDocsUrl={caseObj?.contratoHonorariosGoogleDocsUrl || ''}
                        whatsappCliente={client?.pjDadosResponsavel?.pj_whatsappResponsavel || client?.pjDadosEmpresa?.pj_whatsappEmpresa || client?.pjData?.pj_whatsappEmpresa || client?.pjData?.pj_whatsappResponsavel || ''}
                        emailCliente={client?.pjDadosEmpresa?.pj_emailEmpresa || client?.pjDadosEmpresa?.pj_emailCorporativo || client?.pjData?.pj_emailEmpresa || client?.pjData?.pj_emailCorporativo || ''}
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
                        <p className="text-xs font-extrabold text-gray-800">3.4 O contrato empresarial foi assinado eletrônica ou fisicamente?</p>
                        <div className="flex gap-4 mt-1.5">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_4" 
                                checked={wizardState.q3_4 === o} 
                                onChange={() => saveWizardStateUpdate({ q3_4: o })} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question 3.5 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && (wizardState.q3_4 === 'sim' || wizardState.q3_4 === 'nao') && (
                      <div className="space-y-1 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.5 Requisitou arquivamento no Google Drive corporativo?</p>
                        <div className="flex gap-4 mt-1.5">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_5" 
                                checked={wizardState.q3_5 === o} 
                                onChange={() => saveWizardStateUpdate({ q3_5: o })} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question 3.6 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && (wizardState.q3_4 === 'sim' || wizardState.q3_4 === 'nao') && (wizardState.q3_5 === 'sim' || wizardState.q3_5 === 'nao') && (
                      <div className="space-y-1 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.6 Recebeu o contrato corporativo assinado e rubricado?</p>
                        <div className="flex gap-4 mt-1.5">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_6" 
                                checked={wizardState.q3_6 === o} 
                                onChange={() => saveWizardStateUpdate({ q3_6: o })} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question 3.7 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && (wizardState.q3_4 === 'sim' || wizardState.q3_4 === 'nao') && (wizardState.q3_5 === 'sim' || wizardState.q3_5 === 'nao') && (wizardState.q3_6 === 'sim' || wizardState.q3_6 === 'nao') && (
                      <div className="space-y-1 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.7 Informou a controladoria financeira interna sobre faturamento?</p>
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
                                setSuccess('Controladoria financeira informada do contrato PJ com sucesso!');
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

                    {/* Question 3.8 */}
                    {wizardState.q3_2 && wizardState.q3_3 && wizardState.q3_3.length > 0 && (wizardState.q3_4 === 'sim' || wizardState.q3_4 === 'nao') && (wizardState.q3_5 === 'sim' || wizardState.q3_5 === 'nao') && (wizardState.q3_6 === 'sim' || wizardState.q3_6 === 'nao') && (wizardState.q3_7 === 'sim' || wizardState.q3_7 === 'nao') && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <p className="text-xs font-extrabold text-gray-800">3.8 Anexar as folhas do contrato PJ no drive?</p>
                        <div className="flex gap-4 mt-1.5">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-705">
                              <input 
                                type="radio" 
                                name="q3_8" 
                                checked={wizardState.q3_8 === o} 
                                onChange={() => saveWizardStateUpdate({ q3_8: o })} 
                              />
                              <span>{o === 'sim' ? 'sim ✅' : 'não ❌'}</span>
                            </label>
                          ))}
                        </div>
                        {wizardState.q3_8 === 'sim' && <FileUploadBox field="contratoFiles" />}
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
                      Gerar via Google Workspace (PJ)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => triggerSimulation('Contrato de Honorários', 'falha')} 
                      className="bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase cursor-pointer"
                    >
                      Simular Falha (PJ)
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!wizardState.q3_1 || (wizardState.q3_1 === 'sim' && !wizardState.q3_2) || saving}
                    onClick={handleNextPhase}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-610 hover:bg-indigo-700 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
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
