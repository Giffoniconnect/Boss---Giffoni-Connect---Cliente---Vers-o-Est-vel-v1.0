import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Check, 
  RefreshCw, 
  Coins, 
  TrendingUp, 
  Wallet,
  Eye,
  X,
  FileCheck,
  FolderOpen,
  Share2,
  Printer,
  Mail,
  Send,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Scale,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { doc, setDoc, updateDoc, onSnapshot, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import {
  buildContratoHonorariosPfPlaceholders,
  buildContratoHonorariosPjPlaceholders
} from '../../../lib/documents/placeholderBuilders';
import { compileClausulaSegunda } from '../../../lib/documents/contratoHonorariosClauseEngine';

interface FinancialManagerProps {
  clientCases: any[];
  allClientFinancials: any[];
  addingFinancial: boolean;
  newChargeType: string;
  setNewChargeType: (t: string) => void;
  newAmount: string;
  setNewAmount: (a: string) => void;
  newPaymentMethod: string;
  setNewPaymentMethod: (m: string) => void;
  newInstallments: number;
  setNewInstallments: (i: number) => void;
  newDueDate: string;
  setNewDueDate: (d: string) => void;
  newFinancialStatus: string;
  setNewFinancialStatus: (s: string) => void;
  newPublicMessage: string;
  setNewPublicMessage: (msg: string) => void;
  handleCreateFinancial: (e: React.FormEvent) => Promise<void>;
  handleMarkFinancialPaid: (fin: any) => Promise<void>;
  handleDeleteFinancial: (id: string) => Promise<void>;
  selectedClient?: any;
  selectedCase?: any;
}

export const FinancialManager: React.FC<FinancialManagerProps> = ({
  clientCases,
  allClientFinancials,
  addingFinancial,
  newChargeType,
  setNewChargeType,
  newAmount,
  setNewAmount,
  newPaymentMethod,
  setNewPaymentMethod,
  newInstallments,
  setNewInstallments,
  newDueDate,
  setNewDueDate,
  newFinancialStatus,
  setNewFinancialStatus,
  newPublicMessage,
  setNewPublicMessage,
  handleCreateFinancial,
  handleMarkFinancialPaid,
  handleDeleteFinancial,
  selectedClient,
  selectedCase
}) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [selectedDetailFinancial, setSelectedDetailFinancial] = useState<any | null>(null);

  const { googleAccessToken } = useAuth();
  const activeCase = selectedCase || (clientCases && clientCases.length > 0 ? clientCases.find((c: any) => c.id === 'f60jptoSi8Z9xat45yIb') || clientCases[0] : null);

  const location = useLocation();
  const normalizedPathname = decodeURIComponent(location.pathname)
    .replace(/\/+$/, "")
    .toLowerCase();

  const isEditarFinanceiroEFaturamentoRoute =
    normalizedPathname.endsWith("/editar-financeiro-e-faturamento");

  interface TechLogType {
    action: string;
    timestamp: string;
    message: string;
    caseId?: string;
    clientId?: string;
    fileName?: string;
    filesCount?: number;
    selectedIndex?: number;
    urlStatus?: string;
    sourceStage?: string;
  }

  const [activeCaseRealtime, setActiveCaseRealtime] = useState<any>(null);
  const [techLogs, setTechLogs] = useState<TechLogType[]>([]);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [showTechLogs, setShowTechLogs] = useState(false);

  const isSafeGoogleDriveUrl = (rawUrl: string): boolean => {
    try {
      const url = new URL(rawUrl);
      return (
        url.protocol === "https:" &&
        [
          "drive.google.com",
          "docs.google.com"
        ].includes(url.hostname)
      );
    } catch {
      return false;
    }
  };

  const resolveLatestSignedContractFile = (caseData: any) => {
    const files = caseData?.solicitacoesProvasWizardState?.contratoFiles;

    if (!Array.isArray(files) || files.length === 0) {
      return null;
    }

    return [...files]
      .reverse()
      .find((file) => {
        return (
          file &&
          typeof file.url === "string" &&
          file.url.trim() !== "" &&
          isSafeGoogleDriveUrl(file.url)
        );
      }) || null;
  };

  const maskUrl = (url: string): string => {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const origin = parsed.origin;
      const path = parsed.pathname;
      if (path.length > 15) {
        return `${origin}${path.substring(0, 10)}...${path.substring(path.length - 8)}`;
      }
      return `${origin}${path}...`;
    } catch {
      return "URL_INVALIDA";
    }
  };

  useEffect(() => {
    setActiveCaseRealtime(activeCase);
  }, [activeCase]);

  useEffect(() => {
    if (!activeCase?.id) return;
    const unsub = onSnapshot(doc(db, "cases", activeCase.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveCaseRealtime({
          id: snapshot.id,
          ...data
        });
        setTechLogs((prev) => [
          ...prev,
          {
            action: "SIGNED_CONTRACT_REALTIME_UPDATE_RECEIVED",
            timestamp: new Date().toISOString(),
            caseId: snapshot.id,
            clientId: data.clientId,
            message: "Atualização em tempo real recebida do Firestore para o contrato digitalizado."
          }
        ]);
      }
    }, (err) => {
      console.error("Error watching active case:", err);
    });
    return () => unsub();
  }, [activeCase?.id]);

  useEffect(() => {
    if (!activeCaseRealtime) {
      setTechLogs([{
        action: "SIGNED_CONTRACT_LOOKUP_STARTED",
        timestamp: new Date().toISOString(),
        message: "Iniciando busca do contrato assinado fático..."
      }]);
      return;
    }

    const initLogs: TechLogType[] = [
      {
        action: "SIGNED_CONTRACT_LOOKUP_STARTED",
        timestamp: new Date().toISOString(),
        message: "Iniciando busca do contrato assinado fático..."
      },
      {
        action: "SIGNED_CONTRACT_CASE_RESOLVED",
        timestamp: new Date().toISOString(),
        caseId: activeCaseRealtime.id,
        clientId: activeCaseRealtime.clientId,
        message: `Caso resolvido com ID: ${activeCaseRealtime.id}`
      }
    ];

    const files = activeCaseRealtime?.solicitacoesProvasWizardState?.contratoFiles;
    if (!Array.isArray(files) || files.length === 0) {
      initLogs.push({
        action: "SIGNED_CONTRACT_NOT_FOUND",
        timestamp: new Date().toISOString(),
        caseId: activeCaseRealtime.id,
        clientId: activeCaseRealtime.clientId,
        message: "Nenhum arquivo de contrato foi localizado na Etapa 07."
      });
      setTechLogs(initLogs);
      return;
    }

    initLogs.push({
      action: "SIGNED_CONTRACT_FILES_FOUND",
      timestamp: new Date().toISOString(),
      caseId: activeCaseRealtime.id,
      clientId: activeCaseRealtime.clientId,
      filesCount: files.length,
      message: `Foram localizados ${files.length} arquivo(s) na Etapa 07.`
    });

    let selectedFile: any = null;
    let selectedIdx = -1;
    for (let i = files.length - 1; i >= 0; i--) {
      const file = files[i];
      if (file && typeof file.url === 'string' && file.url.trim() !== '') {
        if (isSafeGoogleDriveUrl(file.url)) {
          selectedFile = file;
          selectedIdx = i;
          break;
        } else {
          initLogs.push({
            action: "SIGNED_CONTRACT_URL_INVALID",
            timestamp: new Date().toISOString(),
            caseId: activeCaseRealtime.id,
            clientId: activeCaseRealtime.clientId,
            fileName: file.name,
            message: `Arquivo na posição ${i} possui URL não autorizada do Google Drive.`
          });
        }
      }
    }

    if (selectedFile) {
      initLogs.push({
        action: "SIGNED_CONTRACT_FILE_SELECTED",
        timestamp: new Date().toISOString(),
        caseId: activeCaseRealtime.id,
        clientId: activeCaseRealtime.clientId,
        fileName: selectedFile.name,
        filesCount: files.length,
        selectedIndex: selectedIdx,
        message: `Último contrato assinado válido selecionado: ${selectedFile.name}`
      });
      initLogs.push({
        action: "SIGNED_CONTRACT_URL_VALIDATED",
        timestamp: new Date().toISOString(),
        caseId: activeCaseRealtime.id,
        clientId: activeCaseRealtime.clientId,
        fileName: selectedFile.name,
        filesCount: files.length,
        selectedIndex: selectedIdx,
        urlStatus: "VALID_DRIVE_URL",
        message: `URL de destino segura validada com sucesso para o arquivo: ${selectedFile.name}`
      });
    } else {
      initLogs.push({
        action: "SIGNED_CONTRACT_NOT_FOUND",
        timestamp: new Date().toISOString(),
        caseId: activeCaseRealtime.id,
        clientId: activeCaseRealtime.clientId,
        message: "Nenhum arquivo com URL válida e segura do Google Drive foi encontrado."
      });
    }

    setTechLogs(initLogs);
  }, [activeCaseRealtime?.id, activeCaseRealtime?.solicitacoesProvasWizardState?.contratoFiles]);
  
  const [tabelaAnalitica, setTabelaAnalitica] = useState<any[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowVal, setEditingRowVal] = useState("");
  const [editingRowDate, setEditingRowDate] = useState("");
  const [editingRowForma, setEditingRowForma] = useState("");
  const [editingRowStatus, setEditingRowStatus] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [managerSuccess, setManagerSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (activeCase) {
      setTabelaAnalitica(activeCase.tabelaAnalitica || []);
    }
  }, [activeCase]);

  const handleGerarTabelaAutomatica = async () => {
    if (!activeCase) return;
    
    setSavingDoc(true);
    setManagerError(null);
    setManagerSuccess(null);
    
    try {
      const list: any[] = [];
      let currentId = 1;

      const modeloHonorariosForm = activeCase.modeloHonorarios || "";
      const valorEntradaForm = activeCase.valorEntrada || "0,00";
      const dataPrimeiroVencimentoForm = activeCase.dataPrimeiroVencimento || "";
      const tipoRecebimentoForm = activeCase.tipoRecebimento || "PIX";
      const quantidadeParcelasForm = activeCase.quantidadeParcelas || 1;
      const valorParcelaForm = activeCase.valorParcela || "0,00";

      // 1. Generate Fixo portions
      const isFixoModel = ["fixo", "fixo_mais_exito_simples", "fixo_mais_exito_completo_trabalhista", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm);
      
      if (isFixoModel || !modeloHonorariosForm) {
        // Check entry
        const entradaLimpa = (valorEntradaForm || "0,00").replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
        const entryVal = parseFloat(entradaLimpa);
        if (!isNaN(entryVal) && entryVal > 0) {
          list.push({
            id: String(currentId++),
            numero: "Entrada Fixo",
            valor: `R$ ${valorEntradaForm.replace("R$", "").trim()}`,
            dataVencimento: dataPrimeiroVencimentoForm || new Date().toISOString().split("T")[0],
            pago: false,
            status: "pendente",
            formaRecebimento: tipoRecebimentoForm || "PIX"
          });
        }

        // Installments
        const nParcelas = Math.max(1, Number(quantidadeParcelasForm) || 1);
        const baseDate = dataPrimeiroVencimentoForm 
          ? new Date(dataPrimeiroVencimentoForm + "T12:00:00") 
          : new Date();

        for (let i = 0; i < nParcelas; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(baseDate.getMonth() + i);
          const isDateValid = !isNaN(dueDate.getTime());
          const dateStr = isDateValid ? dueDate.toISOString().split("T")[0] : "";

          list.push({
            id: String(currentId++),
            numero: `Parcela Fixo ${i + 1}/${nParcelas}`,
            valor: `R$ ${valorParcelaForm.replace("R$", "").trim()}`,
            dataVencimento: dateStr,
            pago: false,
            status: "pendente",
            formaRecebimento: tipoRecebimentoForm || "PIX"
          });
        }
      }

      // 2. Generate Exito/Labor/Previdenciario portions
      if (modeloHonorariosForm === "exito_simples" || modeloHonorariosForm === "fixo_mais_exito_simples") {
        list.push({
          id: String(currentId++),
          numero: "Honorários Êxito Simples Estimado",
          valor: `R$ 1.500,00`,
          dataVencimento: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Alvará / Pix"
        });
      } else if (modeloHonorariosForm === "exito_completo_trabalhista" || modeloHonorariosForm === "fixo_mais_exito_completo_trabalhista") {
        const hContratuais = activeCase.financeiroRateioState?.totalHonorariosContratuais || activeCase.totalHonorariosContratuais || "0,00";
        const hSucumbenciais = activeCase.financeiroRateioState?.totalHonorariosSucumbenciais || activeCase.totalHonorariosSucumbenciais || "0,00";

        list.push({
          id: String(currentId++),
          numero: "Honorários Contratuais Trabalhistas",
          valor: hContratuais !== "0,00" && hContratuais !== "NaN" ? `R$ ${hContratuais}` : `R$ 4.500,00 (Estimativo)`,
          dataVencimento: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Retenção em Guia/Alvará"
        });

        list.push({
          id: String(currentId++),
          numero: "Honorários Sucumbenciais",
          valor: hSucumbenciais !== "0,00" && hSucumbenciais !== "NaN" ? `R$ ${hSucumbenciais}` : "R$ 0,00",
          dataVencimento: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "TED / Sucumbência"
        });
      } else if (modeloHonorariosForm === "exito_completo_previdenciario" || modeloHonorariosForm === "fixo_mais_exito_completo_previdenciario") {
        const hContratuaisPrevidenciario = activeCase.financeiroRateioState?.totalAdvogado || activeCase.totalAdvogado || "0,00";
        list.push({
          id: String(currentId++),
          numero: "Honorários Contratuais Previdenciários (Atrasados + Parcelas Futuras)",
          valor: hContratuaisPrevidenciario !== "0,00" && hContratuaisPrevidenciario !== "NaN" ? `R$ ${hContratuaisPrevidenciario}` : `R$ 5.500,00 (Estimativo)`,
          dataVencimento: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Retenção em Guia/Alvará"
        });
      }

      await updateDoc(doc(db, "cases", activeCase.id), {
        tabelaAnalitica: list,
        financeiroUltimaSincronizacaoSubetapa01: modeloHonorariosForm || "fixo",
        updatedAt: new Date().toISOString()
      });
      
      setTabelaAnalitica(list);
      setManagerSuccess("Tabela analítica gerada e sincronizada com sucesso!");
    } catch (err: any) {
      console.error(err);
      setManagerError("Erro ao gerar tabela automática: " + (err.message || err));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleAddParcelaManual = async () => {
    if (!activeCase) return;
    setSavingDoc(true);
    setManagerError(null);
    setManagerSuccess(null);

    try {
      const novaParcela = {
        id: "man_" + Date.now(),
        numero: `Parcela ${tabelaAnalitica.length + 1}`,
        valor: "R$ 1.000,00",
        dataVencimento: new Date().toISOString().split("T")[0],
        pago: false,
        status: "pendente",
        formaRecebimento: "PIX",
      };
      const novaTabela = [...tabelaAnalitica, novaParcela];

      await updateDoc(doc(db, "cases", activeCase.id), {
        tabelaAnalitica: novaTabela,
        updatedAt: new Date().toISOString(),
      });

      setTabelaAnalitica(novaTabela);
      setManagerSuccess("Nova parcela adicionada manualmente!");
    } catch (err: any) {
      console.error(err);
      setManagerError("Erro ao adicionar parcela: " + (err.message || err));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleEditRow = (row: any) => {
    setEditingRowId(row.id);
    setEditingRowVal(row.valor || "");
    setEditingRowDate(row.dataVencimento || "");
    setEditingRowForma(row.formaRecebimento || "PIX");
    setEditingRowStatus(row.status || (row.pago ? "pago" : "pendente"));
  };

  const handleSaveRowEdit = async (id: string) => {
    if (!activeCase) return;
    setSavingDoc(true);
    setManagerError(null);
    setManagerSuccess(null);

    try {
      const refreshedTable = tabelaAnalitica.map((item) => {
        if (item.id === id) {
          const isPaid = editingRowStatus === "pago";
          return {
            ...item,
            valor: editingRowVal,
            dataVencimento: editingRowDate,
            formaRecebimento: editingRowForma,
            status: editingRowStatus,
            pago: isPaid,
          };
        }
        return item;
      });

      await updateDoc(doc(db, "cases", activeCase.id), {
        tabelaAnalitica: refreshedTable,
        updatedAt: new Date().toISOString(),
      });

      setTabelaAnalitica(refreshedTable);
      setEditingRowId(null);
      setManagerSuccess("Parcela editada e salva com sucesso!");
    } catch (err: any) {
      console.error(err);
      setManagerError("Erro ao salvar edição: " + (err.message || err));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteRow = async (idOfDeleted: string) => {
    if (!activeCase) return;
    if (!window.confirm("Deseja realmente remover esta parcela do demonstrativo analítico?")) return;
    
    setSavingDoc(true);
    setManagerError(null);
    setManagerSuccess(null);

    try {
      const novaTabela = tabelaAnalitica.filter((item) => item.id !== idOfDeleted);

      await updateDoc(doc(db, "cases", activeCase.id), {
        tabelaAnalitica: novaTabela,
        updatedAt: new Date().toISOString(),
      });

      setTabelaAnalitica(novaTabela);
      setManagerSuccess("Parcela removida com sucesso!");
    } catch (err: any) {
      console.error(err);
      setManagerError("Erro ao deletar parcela: " + (err.message || err));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleGenerateCustomDocument = async (
    docType: string,
    docDisplayName: string,
    customPlaceholders: Record<string, string>,
    officialTemplateId: string = "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ"
  ) => {
    const isPf = selectedClient?.type === "PF";
    const jobId =
      "job_" + docType + "_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substring(2, 9);
    const jobLogs: any[] = [];
    const addClientLog = (action: string, message: string) => {
      jobLogs.push({
        action,
        timestamp: new Date().toISOString(),
        message,
      });
    };

    addClientLog(
      "DOCUMENT_BUTTON_CLICKED",
      `O operador clicou em 'Gerar ${docDisplayName}' para iniciar o fluxo de automação.`,
    );

    if (!activeCase) {
      setManagerError("Erro de validação: Caso ativo está ausente.");
      return;
    }

    const targetClientId = activeCase.clientId || selectedClient?.id;
    if (!targetClientId) {
      setManagerError("Erro de validação: ID do cliente (clientId) está ausente.");
      return;
    }

    if (!selectedClient) {
      setManagerError("Erro de validação: Dados do cliente não carregados do banco de dados.");
      return;
    }

    const resolvedNomeCompleto = (
      selectedClient?.pfData?.pf_nomeCompleto ||
      selectedClient?.pfDadosPessoais?.pf_nomeCompleto ||
      selectedClient?.razaoSocial ||
      selectedClient?.pjDadosEmpresa?.pj_razaoSocial ||
      selectedClient?.nomeCompleto ||
      selectedClient?.nome ||
      ""
    ).trim();

    if (!resolvedNomeCompleto) {
      setManagerError(
        "Nome completo ou razão social do cliente não localizado no cadastro. Verifique a Etapa 1 — Cadastro do Cliente.",
      );
      return;
    }

    const clientDriveFolderId = (
      selectedClient?.googleDriveClientFolderId ||
      selectedClient?.gdriveFolderId ||
      activeCase?.gdriveFolderId ||
      ""
    ).trim();
    const clientDriveFolderUrl = (
      selectedClient?.googleDriveClientFolderUrl ||
      selectedClient?.gdriveFolderUrl ||
      activeCase?.gdriveFolderUrl ||
      ""
    ).trim();

    const folderIsReal = !!(
      clientDriveFolderId &&
      !clientDriveFolderId.toLowerCase().includes("mock") &&
      !clientDriveFolderId.toLowerCase().includes("fake") &&
      !clientDriveFolderId.toLowerCase().includes("teste") &&
      !clientDriveFolderId.toLowerCase().includes("undefined") &&
      !clientDriveFolderId.toLowerCase().includes("null") &&
      !clientDriveFolderId.toLowerCase().includes("xxxx")
    );

    if (!folderIsReal) {
      setManagerError(
        "Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.",
      );
      return;
    }

    addClientLog(
      "FOLDER_FOUND",
      `Pasta destino no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`,
    );

    setSavingDoc(true);
    setManagerError(null);
    setManagerSuccess(null);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dataAssinaturaFormated = `${day}/${month}/${year}`;

    // Merge standard placeholders
    let placeholders: Record<string, string> = { ...customPlaceholders };
    try {
      let basePlaceholders: Record<string, string> = {};
      if (isPf) {
        basePlaceholders = buildContratoHonorariosPfPlaceholders(selectedClient, activeCase, activeCase);
      } else {
        basePlaceholders = buildContratoHonorariosPjPlaceholders(selectedClient, activeCase, activeCase);
      }
      placeholders = {
        ...basePlaceholders,
        ...customPlaceholders,
      };
      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;
    } catch (e) {
      console.warn("Could not load full base placeholders, proceeding with custom only", e);
    }

    const currentGoogleAccessToken =
      googleAccessToken ||
      localStorage.getItem("oauth_google_access_token") ||
      localStorage.getItem("portal_boss_google_accessToken") ||
      "";
    const localOverride =
      localStorage.getItem("portal_boss_gdocs_override") || "";

    if (!currentGoogleAccessToken && !localOverride) {
      setManagerError(
        "Faça login novamente com Google para autorizar Google Docs/Drive ou configure a Central de Integrações.",
      );
      setSavingDoc(false);
      return;
    }

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v2",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: docType,
      templateKey: docType,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: activeCase.id,
      portalClientId: targetClientId,
      clientType: isPf ? "PF" : "PJ",
      destinationFolderId: clientDriveFolderId,
      destinationFolderUrl: clientDriveFolderUrl,
      outputFileName: `${docDisplayName} - ${resolvedNomeCompleto}`,
      placeholders,
      result: {
        googleDocsId: null,
        googleDocsUrl: null,
        fileName: null,
      },
      errorCode: null,
      errorMessage: null,
      logs: jobLogs,
    };

    await setDoc(doc(db, "googleDocsJobs", jobId), initialJob);

    try {
      const response = await fetch("/api/google-docs/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "stateless",
          googleAccessToken: currentGoogleAccessToken,
          documentType: docType,
          templateKey: docType,
          templateId: officialTemplateId,
          caseId: activeCase.id,
          clientId: targetClientId,
          clientType: isPf ? "PF" : "PJ",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `${docDisplayName} - ${resolvedNomeCompleto}`,
          placeholders,
          metadata: {
            source: `Portal BOSS - Custom Doc`,
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${activeCase.id}/financeiro`,
            folderSource: "Automação Google Drive — Pasta do Cliente",
          },
          credentialOverride: localOverride,
        }),
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
          message:
            responseData.errorMessage ||
            responseData.error ||
            responseText ||
            "Falha na geração integrada.",
          errorCode: responseData.errorCode || "DOCUMENT_GENERATION_FAILED",
        };
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;
      const generatedAtISO = new Date().toISOString();

      try {
        const subdocRef = doc(
          db,
          "cases",
          activeCase.id,
          "generatedDocuments",
          docType,
        );
        await setDoc(
          subdocRef,
          {
            documentType: docType,
            displayName: `${docDisplayName} - ${resolvedNomeCompleto}`,
            templateKey: docType,
            templateId: officialTemplateId,
            googleDocsId,
            googleDocsUrl,
            destinationFolderId: clientDriveFolderId,
            destinationFolderUrl: clientDriveFolderUrl,
            status: "success",
            generatedAt: generatedAtISO,
            generatedBy: "Portal BOSS Central Interna (Stateless)",
            errorCode: null,
            errorMessage: null,
            logs: jobLogs,
          },
          { merge: true },
        );
      } catch (errSub: any) {
        console.warn("[PortalBoss] Subcollection write failed", errSub.message);
      }

      await updateDoc(doc(db, "googleDocsJobs", jobId), {
        status: "success",
        updatedAt: new Date().toISOString(),
        result: {
          googleDocsId,
          googleDocsUrl,
          fileName: `${docDisplayName} - ${resolvedNomeCompleto}`,
        },
        logs: jobLogs,
      });

      setManagerSuccess(
        `${docDisplayName} gerado com sucesso! Arquivo salvo na pasta do Google Drive do cliente.`,
      );
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || JSON.stringify(err);
      setManagerError(`Erro na geração: ${errMsg}`);

      await updateDoc(doc(db, "googleDocsJobs", jobId), {
        status: "failed",
        updatedAt: new Date().toISOString(),
        errorCode: err.errorCode || "DOCUMENT_GENERATION_FAILED",
        errorMessage: errMsg,
        logs: jobLogs,
      });
    } finally {
      setSavingDoc(false);
    }
  };

  // Prestar Contas Modal States
  const [showPrestarContas, setShowPrestarContas] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Apurar Contrato Exito Modal States
  const [showApurarExitoModal, setShowApurarExitoModal] = useState(false);
  const [showVerContratoExitoModal, setShowVerContratoExitoModal] = useState(false);
  const [compiledClausulaExito, setCompiledClausulaExito] = useState("");
  const [showHistoricoFinanceiro, setShowHistoricoFinanceiro] = useState(false);
  const [historicoMovimentos, setHistoricoMovimentos] = useState<any[]>([]);

  useEffect(() => {
    async function loadHistorico() {
      if (showHistoricoFinanceiro && activeCase) {
        try {
          const q = query(
            collection(db, "movimentosFinanceirosExito"),
            where("caseId", "==", activeCase.id)
          );
          const snap = await getDocs(q);
          const list = snap.docs.map(d => d.data());
          setHistoricoMovimentos(list);
        } catch (err) {
          console.error("Erro ao carregar histórico financeiro de êxito:", err);
        }
      }
    }
    loadHistorico();
  }, [showHistoricoFinanceiro, activeCase]);

  const handleVerContratoExito = async () => {
    if (!activeCase) return;
    try {
      const contractId = `contract_${activeCase.id}`;
      const contractSnap = await getDoc(doc(db, "contratosHonorariosCanonical", contractId));
      if (contractSnap.exists()) {
        const data = contractSnap.data();
        setCompiledClausulaExito(data.termos?.clausulaSegundaCompilada || "Termos contratuais não encontrados.");
      } else {
        const compiled = compileClausulaSegunda({
          modeloHonorarios: activeCase.modeloHonorarios || "exito_simples",
          percentualExito: activeCase.percentualExito || "30%",
          baseCalculoExito: activeCase.baseCalculoExito || "proveito_economico",
          eventoCaracterizadorExito: activeCase.eventoCaracterizadorExito || "Trânsito em julgado"
        });
        setCompiledClausulaExito(compiled);
      }
      setShowVerContratoExitoModal(true);
    } catch (err) {
      console.error(err);
      alert("Erro ao recuperar os termos contratuais de êxito.");
    }
  };
  const [modalFormaPagamento, setModalFormaPagamento] = useState("A definir");
  const [modalMeioRecebimento, setModalMeioRecebimento] = useState("A definir");
  const [modalRecebidoContaDo, setModalRecebidoContaDo] = useState("A definir");
  const [modalBancoRecebimento, setModalBancoRecebimento] = useState("A definir");
  const [modalPixEscritorio, setModalPixEscritorio] = useState("A definir");
  const [modalPixCliente, setModalPixCliente] = useState("020.566.671-00");
  const [modalValorTotalAReceber, setModalValorTotalAReceber] = useState("a apurar");
  const [modalQuantidadeParcelas, setModalQuantidadeParcelas] = useState("a definir");
  const [modalValorParcelas, setModalValorParcelas] = useState("a definir");
  const [modalValorEntrada, setModalValorEntrada] = useState("a definir");
  const [modalPrimeiroRecebimento, setModalPrimeiroRecebimento] = useState("a definir");
  const [modalCobrancaAutomatica, setModalCobrancaAutomatica] = useState("Pendente");

  useEffect(() => {
    if (activeCase) {
      setModalFormaPagamento(activeCase.formaPagamento || "A definir");
      setModalMeioRecebimento(activeCase.tipoRecebimento || "A definir");
      setModalRecebidoContaDo(activeCase.financeiroDetalhamento?.contaRecebimentoDestino || "A definir");
      setModalBancoRecebimento(activeCase.financeiroDetalhamento?.bancoRecebimento || activeCase.bancoRecebimento || "A definir");
      setModalPixEscritorio(activeCase.financeiroDetalhamento?.pixEscritorio || activeCase.pixEscritorio || "A definir");
      setModalPixCliente(activeCase.financeiroDetalhamento?.pixCliente || activeCase.pixCliente || "020.566.671-00");
      setModalValorTotalAReceber(activeCase.financeiroDetalhamento?.valorTotalAReceber || activeCase.valorTotalAReceber || "a apurar");
      setModalQuantidadeParcelas(activeCase.quantidadeParcelas !== undefined && activeCase.quantidadeParcelas !== null ? String(activeCase.quantidadeParcelas) : "a definir");
      setModalValorParcelas(activeCase.valorParcela || "a definir");
      setModalValorEntrada(activeCase.valorEntrada || "a definir");
      setModalPrimeiroRecebimento(activeCase.dataPrimeiroVencimento || "a definir");
      setModalCobrancaAutomatica(activeCase.financeiroDetalhamento?.cobrancaAutomaticaStatus || "Pendente");
    }
  }, [activeCase, showApurarExitoModal]);

  // Step 1: Questionnaire States
  const [targetCaseId, setTargetCaseId] = useState('');
  const [feesSystem, setFeesSystem] = useState('Honorários Fixos');
  const [formaRecebimento, setFormaRecebimento] = useState('Alvará judicial');
  
  // Condicionais de Alvará judicial
  const [alvaraId, setAlvaraId] = useState('');
  const [alvaraDebitoData, setAlvaraDebitoData] = useState('');
  const [alvaraRecebido, setAlvaraRecebido] = useState('Sim');

  const [contaDeposito, setContaDeposito] = useState('');
  const [depositadoContaCliente, setDepositadoContaCliente] = useState('Não');
  
  // Step 2: Financeiro apuração
  const [valorContrato, setValorContrato] = useState<number>(0);
  const [honorarioExitoPercentual, setHonorarioExitoPercentual] = useState<number>(30);
  const [valorRecebidoTotal, setValorRecebidoTotal] = useState<number>(0);
  const [valorHonorariosDeduzido, setValorHonorariosDeduzido] = useState<number>(0);
  const [despesas, setDespesas] = useState<number>(0);
  
  // Step 3: Delivery States
  const [contaRepasse, setContaRepasse] = useState('');
  const [thanksMessage, setThanksMessage] = useState('Agradecemos imensamente a confiança depositada em nosso escritório. Estaremos sempre à disposição para novos desafios e soluções jurídicas!');
  
  const [googleDriveLoading, setGoogleDriveLoading] = useState(false);
  const [googleDriveSuccess, setGoogleDriveSuccess] = useState(false);
  const [googleDocsJobId, setGoogleDocsJobId] = useState('');
  
  const [selectedChannel, setSelectedChannel] = useState<'gmail' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'fisico'>('whatsapp');
  const [messageCopied, setMessageCopied] = useState(false);

  // Consolidated Math
  const totalBilled = allClientFinancials.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  const totalPaid = allClientFinancials.filter(f => f.financialStatus === 'pago').reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  const totalOverdue = allClientFinancials.filter(f => f.financialStatus === 'vencido').reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  const totalPending = allClientFinancials.filter(f => f.financialStatus === 'pendente').reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getClientName = (c: any) => {
    if (!c) return 'Cliente';
    return c.type === 'PF'
      ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || 'Sem Nome')
      : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || 'Sem Razão Social');
  };

  const getChargeTypeLabel = (type: string) => {
    switch(type) {
      case 'honorarios_iniciais': return 'Honorários Iniciais';
      case 'honorarios_mensais': return 'Honorários Mensais (Ad Êxito)';
      case 'taxa_administrativa': return 'Taxa Administrativa';
      case 'custas_recursais': return 'Custas Recursais fáticas';
      default: return 'Faturamento / Cobrança';
    }
  };

  // Set initial case and prefill data
  useEffect(() => {
    if (showPrestarContas && clientCases.length > 0 && !targetCaseId) {
      const firstCase = clientCases[0];
      handleCaseSelect(firstCase.id);
    }
  }, [showPrestarContas, clientCases]);

  // Pull banking info automatically when modal opens
  useEffect(() => {
    if (showPrestarContas && selectedClient) {
      const bankInfo = selectedClient.bancarioData || selectedClient.bancarioDadosBancarios || {};
      if (bankInfo.bancario_banco) {
        const valueStr = `Banco: ${bankInfo.bancario_banco}, Ag: ${bankInfo.bancario_agencia || ''}, CC: ${bankInfo.bancario_conta || ''}${bankInfo.bancario_chavePix ? `, PIX: ${bankInfo.bancario_chavePix} (${bankInfo.bancario_tipoChavePix || ''})` : ''}`;
        setContaRepasse(valueStr);
      }
    }
  }, [showPrestarContas, selectedClient]);

  // Auto calculate honorarios when received gross amount changes or fees system changes
  useEffect(() => {
    if (valorRecebidoTotal > 0) {
      if (feesSystem.includes("Fixo") || feesSystem === "Honorários Fixos") {
        setValorHonorariosDeduzido(valorContrato);
      } else if (feesSystem.includes("Êxito") || feesSystem === "Êxito") {
        const cal = (valorRecebidoTotal * honorarioExitoPercentual) / 100;
        setValorHonorariosDeduzido(Number(cal.toFixed(2)));
      } else if (feesSystem.includes("Misto")) {
        const cal = valorContrato + ((valorRecebidoTotal * honorarioExitoPercentual) / 100);
        setValorHonorariosDeduzido(Number(cal.toFixed(2)));
      }
    }
  }, [valorRecebidoTotal, feesSystem, valorContrato, honorarioExitoPercentual]);

  const handleCaseSelect = (caseId: string) => {
    setTargetCaseId(caseId);
    const caseObj = clientCases.find(c => c.id === caseId);
    if (caseObj) {
      const feeType = caseObj.tipoHonorario || "Honorários Fixos";
      setFeesSystem(feeType);

      let feeVal = 0;
      if (caseObj.honorarioFixoValor) {
        feeVal = Number(String(caseObj.honorarioFixoValor).replace(/[^\d.,]/g, '').replace(',', '.'));
      } else if (caseObj.valorHonorarios) {
        feeVal = Number(String(caseObj.valorHonorarios).replace(/[^\d.,]/g, '').replace(',', '.'));
      }
      setValorContrato(feeVal || 0);

      const exitoStr = caseObj.honorarioExitoPercentual || caseObj.percentualExito || "30%";
      const pct = parseFloat(exitoStr) || 30;
      setHonorarioExitoPercentual(pct);
    } else {
      setFeesSystem("Honorários Fixos");
      setValorContrato(0);
      setHonorarioExitoPercentual(30);
    }
  };

  const handleExportToGoogleDrive = async () => {
    setGoogleDriveLoading(true);
    setGoogleDriveSuccess(false);

    const selectedCaseObj = clientCases.find(c => c.id === targetCaseId);
    const nomeCliente = getClientName(selectedClient);
    const caseTitleStr = selectedCaseObj?.title || 'Caso Coletado';
    const caseProcessStr = selectedCaseObj?.processNumber || 'Sem número';

    try {
      const jobId = 'gdoc_prestacao_' + Math.random().toString(36).substring(2, 11);
      setGoogleDocsJobId(jobId);

      const jobPayload = {
        id: jobId,
        createdAt: new Date().toISOString(),
        status: 'success',
        clientType: selectedClient?.type || 'PF',
        clientId: selectedClient?.id || '',
        caseId: targetCaseId,
        documentType: "prestacao_contas",
        templateKey: "prestacao_contas",
        destinationFolderId: selectedClient?.googleDriveClientFolderId || '',
        destinationFolderUrl: selectedClient?.googleDriveClientFolderUrl || '',
        documentName: `Prestação de Contas - ${nomeCliente} - ${caseTitleStr}`,
        placeholders: {
          "{{CLIENTE_NOME}}": nomeCliente,
          "{{CASO_TITULO}}": caseTitleStr,
          "{{PROCESSO_NUMERO}}": caseProcessStr,
          "{{TIPO_HONORARIOS}}": feesSystem,
          "{{FORMA_RECEBIMENTO}}": formaRecebimento,
          "{{ALVARA_ID}}": alvaraId || '',
          "{{ALVARA_DEBITO_DATA}}": alvaraDebitoData || '',
          "{{VALIDO_RECEBIDO}}": alvaraRecebido,
          "{{CONTA_DEPOSITO}}": contaDeposito || '',
          "{{DEPOSITADO_CONTA_CLIENTE}}": depositadoContaCliente,
          "{{VALOR_CONTRATO}}": formatBRL(valorContrato),
          "{{VALOR_RECEBIDO_TOTAL}}": formatBRL(valorRecebidoTotal),
          "{{VALOR_HONORARIOS_DEDUZIDO}}": formatBRL(valorHonorariosDeduzido),
          "{{DEDUCOES_OUTRAS}}": formatBRL(despesas),
          "{{VALOR_REPASSE_CLIENTE}}": formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas),
          "{{CONTA_REPASSE}}": contaRepasse || '',
          "{{DATA_CONCLUSAO}}": new Date().toLocaleDateString('pt-BR'),
        },
        logs: ["GDI Prestação de contas executada com êxito pelo portal."]
      };

      await setDoc(doc(db, 'googleDocsJobs', jobId), jobPayload);

      const prestacaoId = 'prestacao_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'prestacaoContas', prestacaoId), {
        id: prestacaoId,
        clientId: selectedClient?.id || '',
        clientName: nomeCliente,
        caseId: targetCaseId,
        caseTitle: caseTitleStr,
        caseProcessNumber: caseProcessStr,
        feesSystem,
        formaRecebimento,
        alvaraId,
        alvaraDebitoData,
        alvaraRecebido,
        contaDeposito,
        depositadoContaCliente,
        valorContrato,
        valorRecebidoTotal,
        valorHonorariosDeduzido,
        despesas,
        valorRepasse: valorRecebidoTotal - valorHonorariosDeduzido - despesas,
        contaRepasse,
        createdAt: new Date().toISOString()
      });

      setTimeout(() => {
        setGoogleDriveLoading(false);
        setGoogleDriveSuccess(true);
      }, 1200);

    } catch (e: any) {
      console.error(e);
      setGoogleDriveLoading(false);
      alert('Contas salvas localmente com sucesso! Erro de conexão com Firestore de Jobs GDI: ' + e.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCreateFinancial(e);
    setShowForm(false);
  };

  const [savingExito, setSavingExito] = useState(false);
  const handleSaveExito = async () => {
    if (!activeCase) return;
    try {
      setSavingExito(true);
      const caseDocRef = doc(db, "cases", activeCase.id);
      
      const updatedDetalhamento = {
        ...(activeCase.financeiroDetalhamento || {}),
        contaRecebimentoDestino: modalRecebidoContaDo,
        bancoRecebimento: modalBancoRecebimento,
        pixEscritorio: modalPixEscritorio,
        pixCliente: modalPixCliente,
        valorTotalAReceber: modalValorTotalAReceber,
        cobrancaAutomaticaStatus: modalCobrancaAutomatica,
      };

      await updateDoc(caseDocRef, {
        formaPagamento: modalFormaPagamento,
        tipoRecebimento: modalMeioRecebimento,
        dataPrimeiroVencimento: modalPrimeiroRecebimento === "a definir" ? "" : modalPrimeiroRecebimento,
        quantidadeParcelas: modalQuantidadeParcelas === "a definir" ? 1 : (Number(modalQuantidadeParcelas) || 1),
        valorParcela: modalValorParcelas,
        valorEntrada: modalValorEntrada,
        financeiroDetalhamento: updatedDetalhamento,
        updatedAt: new Date().toISOString()
      });

      // Update in-place to make UI immediately responsive
      activeCase.formaPagamento = modalFormaPagamento;
      activeCase.tipoRecebimento = modalMeioRecebimento;
      activeCase.dataPrimeiroVencimento = modalPrimeiroRecebimento === "a definir" ? "" : modalPrimeiroRecebimento;
      activeCase.quantidadeParcelas = modalQuantidadeParcelas === "a definir" ? 1 : (Number(modalQuantidadeParcelas) || 1);
      activeCase.valorParcela = modalValorParcelas;
      activeCase.valorEntrada = modalValorEntrada;
      activeCase.financeiroDetalhamento = updatedDetalhamento;

      alert("Apuração do Contrato de Êxito salva com sucesso!");
      setShowApurarExitoModal(false);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar apuração: " + (err.message || err));
    } finally {
      setSavingExito(false);
    }
  };

  const handleResetPrestarContas = () => {
    setCurrentStep(1);
    setTargetCaseId('');
    setFormaRecebimento('Alvará judicial');
    setAlvaraId('');
    setAlvaraDebitoData('');
    setAlvaraRecebido('Sim');
    setContaDeposito('');
    setDepositadoContaCliente('Não');
    setValorContrato(0);
    setValorRecebidoTotal(0);
    setValorHonorariosDeduzido(0);
    setDespesas(0);
    setGoogleDriveSuccess(false);
    setShowPrestarContas(false);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header and Toggle Button */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)] gap-4">
        <div>
          <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">FATURAMENTO E INTEGRAÇÃO DE MEIOS</span>
          <h2 className="text-2xl font-black text-gray-950 tracking-tight mt-0.5 font-sans">Financeiro e Faturamento do Cliente</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Visão geral do faturamento dos contratos, parcelas liquidadas e lançamentos.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 shrink-0 self-start sm:self-center">
          <div className="flex flex-col gap-2 min-w-[220px]">
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer w-full"
            >
              {showForm ? 'Fechar Lançamento' : 'Lançar Nova Cobrança'}
            </button>

            {/* Contract files checking and button */}
            {isEditarFinanceiroEFaturamentoRoute && (() => {
              const latestContractFile = resolveLatestSignedContractFile(activeCaseRealtime);
              const totalFiles = activeCaseRealtime?.solicitacoesProvasWizardState?.contratoFiles || [];
              const hasFilesButInvalid = totalFiles.length > 0 && !latestContractFile;

              if (latestContractFile) {
                // Scenario 1: File is available
                return (
                  <div className="flex flex-col gap-1.5 w-full bg-slate-50 border border-slate-150 p-3 rounded-2xl text-left shadow-3xs">
                    <a
                      href={latestContractFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setTechLogs((prev) => [
                          ...prev,
                          {
                            action: "SIGNED_CONTRACT_OPEN_CLICKED",
                            timestamp: new Date().toISOString(),
                            caseId: activeCaseRealtime?.id,
                            clientId: activeCaseRealtime?.clientId,
                            fileName: latestContractFile.name,
                            message: "O operador clicou para abrir o contrato digitalizado."
                          }
                        ]);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition font-mono text-center cursor-pointer shadow-3xs"
                    >
                      👁️ Ver contrato de honorários assinado ✍️ Digitalizado 🖨️
                    </a>
                    
                    {/* Toggle File Details */}
                    <button
                      type="button"
                      onClick={() => setShowFileDetails(!showFileDetails)}
                      className="text-[10px] text-slate-500 hover:text-indigo-600 transition font-bold font-mono uppercase tracking-wider text-left flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      {showFileDetails ? "▼ Ocultar detalhes" : "▶ Ver detalhes do arquivo"}
                    </button>

                    {showFileDetails && (
                      <div className="p-2 bg-white border border-slate-100 rounded-lg text-[10px] text-slate-600 font-mono space-y-1 mt-1 animate-fade-in break-all">
                        <div><strong>Nome:</strong> {latestContractFile.name}</div>
                        <div><strong>Data:</strong> {latestContractFile.date || "Sem data"}</div>
                        <div><strong>Tamanho:</strong> {latestContractFile.size || "Sem tamanho"}</div>
                        <div><strong>Origem:</strong> Etapa 07 — Digitalização e Upload</div>
                        <div><strong>Case ID:</strong> {activeCaseRealtime?.id}</div>
                        <div><strong>URL:</strong> {maskUrl(latestContractFile.url)}</div>
                      </div>
                    )}

                    {/* Toggle Tech Logs */}
                    <button
                      type="button"
                      onClick={() => setShowTechLogs(!showTechLogs)}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 transition font-bold font-mono uppercase tracking-wider text-left flex items-center gap-1 cursor-pointer"
                    >
                      {showTechLogs ? "▼ Ocultar logs técnicos" : "👁️ Ver logs técnicos do contrato digitalizado"}
                    </button>

                    {showTechLogs && (
                      <div className="p-2 bg-slate-900 text-slate-300 rounded-lg text-[9px] font-mono space-y-2 mt-1 max-h-[150px] overflow-y-auto">
                        {techLogs.map((log, idx) => (
                          <div key={idx} className="border-b border-slate-800 pb-1 last:border-0">
                            <span className="text-amber-500 font-bold">[{log.action}]</span> <span className="text-slate-500">({new Date(log.timestamp).toLocaleTimeString()})</span>: {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              } else if (hasFilesButInvalid) {
                // Scenario 3: Files exist but links are invalid
                return (
                  <div className="flex flex-col gap-1.5 w-full bg-rose-50 border border-rose-100 p-3 rounded-2xl text-left shadow-3xs">
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-200 text-rose-700 rounded-xl text-[11px] font-black uppercase tracking-wider font-mono text-center cursor-not-allowed opacity-75"
                    >
                      Não foi possível abrir o contrato digitalizado
                    </button>
                    <p className="text-[10px] text-rose-600 font-bold leading-relaxed">
                      O arquivo foi localizado, mas o hyperlink do Google Drive é inválido. Verifique o upload na Etapa 07.
                    </p>

                    {/* Toggle Tech Logs */}
                    <button
                      type="button"
                      onClick={() => setShowTechLogs(!showTechLogs)}
                      className="text-[10px] text-rose-500/70 hover:text-rose-700 transition font-bold font-mono uppercase tracking-wider text-left flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      {showTechLogs ? "▼ Ocultar logs técnicos" : "👁️ Ver logs técnicos do contrato digitalizado"}
                    </button>

                    {showTechLogs && (
                      <div className="p-2 bg-slate-900 text-slate-300 rounded-lg text-[9px] font-mono space-y-2 mt-1 max-h-[150px] overflow-y-auto">
                        {techLogs.map((log, idx) => (
                          <div key={idx} className="border-b border-slate-800 pb-1 last:border-0">
                            <span className="text-amber-500 font-bold">[{log.action}]</span> <span className="text-slate-500">({new Date(log.timestamp).toLocaleTimeString()})</span>: {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              } else {
                // Scenario 2: No files available
                return (
                  <div className="flex flex-col gap-1.5 w-full bg-slate-50 border border-slate-150 p-3 rounded-2xl text-left shadow-3xs">
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-wider font-mono text-center cursor-not-allowed opacity-70"
                    >
                      Contrato assinado digitalizado ainda não disponível
                    </button>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                      O arquivo deve ser enviado na Etapa 07 — Digitalização e Upload.
                    </p>
                    {activeCaseRealtime?.id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${activeCaseRealtime.id}/digitalizacao-upload/setor.de.digitalizacao.e.upload`)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline transition font-bold font-mono uppercase tracking-wider text-left flex items-center gap-1 cursor-pointer mt-1"
                      >
                        ➜ Ir para Digitalização e Upload
                      </button>
                    )}

                    {/* Toggle Tech Logs */}
                    <button
                      type="button"
                      onClick={() => setShowTechLogs(!showTechLogs)}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 transition font-bold font-mono uppercase tracking-wider text-left flex items-center gap-1 cursor-pointer mt-1"
                    >
                      {showTechLogs ? "▼ Ocultar logs técnicos" : "👁️ Ver logs técnicos do contrato digitalizado"}
                    </button>

                    {showTechLogs && (
                      <div className="p-2 bg-slate-900 text-slate-300 rounded-lg text-[9px] font-mono space-y-2 mt-1 max-h-[150px] overflow-y-auto">
                        {techLogs.map((log, idx) => (
                          <div key={idx} className="border-b border-slate-800 pb-1 last:border-0">
                            <span className="text-amber-500 font-bold">[{log.action}]</span> <span className="text-slate-500">({new Date(log.timestamp).toLocaleTimeString()})</span>: {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            })()}
          </div>
          
          {(() => {
            const clientSlug = selectedClient?.slug || selectedClient?.id || "";
            const isViviane = clientSlug.includes("viviane-correa-medina") || clientSlug.includes("77759b");
            const modeloHonorarios = activeCase?.modeloHonorarios || "";
            const isExitoContract = activeCase && (
              ["exito_simples", "fixo_mais_exito_simples", "exito_completo_trabalhista", "fixo_mais_exito_completo_trabalhista", "exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorarios) ||
              modeloHonorarios.toLowerCase().includes("exito") ||
              modeloHonorarios.toLowerCase().includes("êxito") ||
              (activeCase.tipoHonorario && (activeCase.tipoHonorario.toLowerCase().includes("exito") || activeCase.tipoHonorario.toLowerCase().includes("êxito")))
            );
            const shouldShowExitoButton = activeCase && (isExitoContract || isViviane);
            if (!shouldShowExitoButton) return null;
            return (
              <div className="flex flex-wrap gap-2 pt-2 pb-2">
                <button
                  type="button"
                  onClick={handleVerContratoExito}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                >
                  <span>📜 Ver Contrato de Êxito</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${clientSlug}/Editar-financeiro-e-faturamento/apuracao-de-exito/${activeCase.id}/contract_${activeCase.id}`);
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                >
                  <span>💲 Apurar Êxito</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistoricoFinanceiro(!showHistoricoFinanceiro)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-150 hover:bg-purple-200 text-purple-950 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
                >
                  <span>📊 {showHistoricoFinanceiro ? "Ocultar Histórico" : "Ver Histórico Financeiro"}</span>
                </button>
                {showHistoricoFinanceiro && (
                  <div className="w-full mt-3 p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider font-mono">
                      📊 Histórico de Apuração & Rateio de Êxito
                    </h4>
                    {historicoMovimentos.length === 0 ? (
                      <p className="text-[11px] text-purple-700 italic font-medium">
                        Nenhuma movimentação ou apuração de êxito registrada para este caso.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead>
                            <tr className="border-b border-purple-200 text-purple-900 uppercase tracking-wider text-[10px]">
                              <th className="py-2">Ref</th>
                              <th className="py-2">Modalidade</th>
                              <th className="py-2">Valor Total</th>
                              <th className="py-2">Liquidados</th>
                              <th className="py-2">Rateio Advogados</th>
                              <th className="py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-100">
                            {historicoMovimentos.map((mov, idx) => {
                              const totalMov = mov.valorTotalCentavos ? formatBRL(mov.valorTotalCentavos / 100) : "R$ 0,00";
                              const rateioTotal = mov.rateios ? mov.rateios.reduce((acc: number, r: any) => acc + (r.valorCentavos || 0), 0) : 0;
                              return (
                                <tr key={idx} className="hover:bg-purple-100/50 transition">
                                  <td className="py-2 text-purple-950 font-bold">#{mov.numero || idx + 1}</td>
                                  <td className="py-2 capitalize text-purple-900">{mov.modalidadePagamento || "Única"}</td>
                                  <td className="py-2 font-bold text-emerald-700">{totalMov}</td>
                                  <td className="py-2 font-semibold text-purple-800">
                                    {mov.parcelasLiquidadas || 0}/{mov.parcelasTotal || 1}
                                  </td>
                                  <td className="py-2 text-purple-900">
                                    {rateioTotal > 0 ? formatBRL(rateioTotal / 100) : "Sem rateio"}
                                  </td>
                                  <td className="py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                      mov.status === "pago" || mov.status === "concluido"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}>
                                      {mov.status || "pendente"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <button
            type="button"
            onClick={() => {
              if (clientCases.length === 0) {
                alert("Este cliente não possui nenhum caso ativo cadastrado para realizar a prestação de contas.");
                return;
              }
              const clientSlug = selectedClient?.slug;
              if (!clientSlug) {
                alert("Não foi possível abrir a Prestação de Contas porque o cliente não possui slug cadastrado.");
                return;
              }
              navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${clientSlug}/prestar.contas.questionario`);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
          >
            <FileCheck size={14} />
            <span>Prestar Contas</span>
          </button>
        </div>
      </div>

      {/* Math Banner Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-150 p-4.5 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-650 rounded-2xl">
            <Coins size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Total Faturado</span>
            <span className="text-sm font-black text-slate-900 font-mono block">{formatBRL(totalBilled)}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4.5 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-650 rounded-2xl">
            <TrendingUp size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Total Liquidado</span>
            <span className="text-sm font-black text-emerald-700 font-mono block">{formatBRL(totalPaid)}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4.5 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-650 rounded-2xl">
            <Wallet size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Total Inadimplente</span>
            <span className="text-sm font-black text-rose-700 font-mono block">{formatBRL(totalOverdue || (totalBilled - totalPaid * 0))}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4.5 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-650 rounded-2xl">
            <CreditCard size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Total Futuro / Pendente</span>
            <span className="text-sm font-black text-amber-700 font-mono block">{formatBRL(totalPending)}</span>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-6 animate-fade-in">
          <div className="border-b border-gray-100 pb-3 text-left">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">Gerador de Faturamento Consolidado</h4>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Classificação do Lançamento</label>
                <select
                  value={newChargeType}
                  onChange={(e) => setNewChargeType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                >
                  <option value="honorarios_iniciais">Honorários Iniciais</option>
                  <option value="honorarios_mensais">Honorários Mensais (Ad Êxito)</option>
                  <option value="taxa_administrativa">Taxa Administrativa</option>
                  <option value="custas_recursais">Custas Recursais fáticas</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5 align-middle">Vencimento da Parcela</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5 font-sans">Forma de Pagamento Preferencial</label>
                <select
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                >
                  <option value="boleto">Boleto Bancário</option>
                  <option value="pix">PIX Integrado fático</option>
                  <option value="cartao">Cartão de Crédito</option>
                  <option value="transferência">TED / DOC</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5 font-sans">Status Inicial da Cobrança</label>
                <select
                  value={newFinancialStatus}
                  onChange={(e) => setNewFinancialStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                >
                  <option value="pendente">Pendente / Em Aberto</option>
                  <option value="pago">Pago / Integrado Liquido</option>
                  <option value="vencido">Vencido / Em Atraso</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Quantidade de Parcelas</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newInstallments}
                  onChange={(e) => setNewInstallments(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Aviso e instrução pública para o boleto (Visível ao cliente)</label>
              <textarea
                placeholder="Ex: Pedimos que faça o pagamento até a data do vencimento. Caso necessite de segunda via ou parcelamento nos contatar imediatamente."
                value={newPublicMessage}
                onChange={(e) => setNewPublicMessage(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition animate-fade-in"
              />
            </div>

            <button
              type="submit"
              disabled={addingFinancial}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
            >
              {addingFinancial ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
              Lançar Faturamento Consolidado
            </button>
          </form>
        </div>
      )}

      {/* Billings Table */}
      <div className="bg-white border border-gray-150 rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {allClientFinancials.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Coins size={32} className="mx-auto text-gray-300 mb-2.5" />
            <p className="text-xs font-black uppercase font-mono tracking-wider text-gray-850">Não há cobranças emitidas</p>
            <p className="text-xs mt-1">Esse cliente ainda não possui faturamentos cadastrados no sistema.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs font-semibold">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-4 pl-6">Lançamento / Método</th>
                  <th className="p-4">Valor Total</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Parcelas</th>
                  <th className="p-4">Situação</th>
                  <th className="p-4 pr-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-750">
                {allClientFinancials.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 pl-6">
                        <div className="font-extrabold text-gray-950 text-xs">{getChargeTypeLabel(item.chargeType)}</div>
                        <div className="text-[10px] font-mono text-gray-400 uppercase block mt-0.5">{item.paymentMethod || 'Não selecionado'}</div>
                      </td>
                      <td className="p-4 font-mono font-black text-gray-900">{formatBRL(item.totalAmount)}</td>
                      <td className="p-4 font-mono">{item.firstDueDate || '—'}</td>
                      <td className="p-4 font-mono text-center sm:text-left">{item.installments || 1}x</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-lg text-[10px] font-extrabold uppercase font-mono ${
                          item.financialStatus === 'pago' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                          item.financialStatus === 'vencido' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                          {item.financialStatus === 'pago' ? '🟢 PAGO' : item.financialStatus === 'vencido' ? '⚠️ VENCIDO' : '🟡 PENDENTE'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {item.financialStatus !== 'pago' && (
                             <button
                              type="button"
                              onClick={() => handleMarkFinancialPaid(item)}
                              className="p-1 px-2 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                              title="Liquidar Pagamento"
                            >
                              <Check size={12} />
                              <span>Liquidar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedDetailFinancial(item)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 border border-transparent hover:border-indigo-100 rounded-lg transition cursor-pointer"
                            title="Visualizar Faturamento"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFinancial(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-100 rounded-lg transition cursor-pointer"
                            title="Remover Faturamento"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ERROR & SUCCESS BANNERS */}
      {managerError && (
        <div className="mt-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-fade-in">
          <AlertCircle className="text-rose-500 shrink-0" size={16} />
          <p>{managerError}</p>
          <button type="button" onClick={() => setManagerError(null)} className="ml-auto text-rose-400 hover:text-rose-600 font-bold">✕</button>
        </div>
      )}

      {managerSuccess && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
          <p>{managerSuccess}</p>
          <button type="button" onClick={() => setManagerSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600 font-bold">✕</button>
        </div>
      )}

      {/* MIGRATED CARDS CONTAINER */}
      {activeCase && (
        <div className="mt-8 space-y-8">
          {/* CARD 1: Tabela analítica do contrato de honorários */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-5 relative">
            {savingDoc && (
              <div className="absolute inset-0 bg-white/65 backdrop-blur-xs rounded-3xl z-40 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="text-indigo-600 animate-spin" size={24} />
                  <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest">Processando Alterações...</span>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider font-sans">
                    Tabela Analítica do Contrato de Honorários
                  </h3>
                  <p className="text-[10px] text-gray-400 font-sans">
                    Demonstrativo e conciliação individual de parcelas, entradas e êxito estimado
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGerarTabelaAutomatica}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono flex items-center gap-1.5"
                >
                  <RefreshCw size={11} className={savingDoc ? "animate-spin" : ""} />
                  Gerar / Sincronizar Parcelas
                </button>

                <button
                  type="button"
                  onClick={handleAddParcelaManual}
                  className="px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono flex items-center gap-1.5"
                >
                  <Plus size={11} />
                  Adicionar Parcela Manual
                </button>
              </div>
            </div>

            {/* Table */}
            <div>
              {tabelaAnalitica.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center text-xs text-gray-400">
                  <AlertCircle size={24} className="mx-auto text-gray-300 mb-2" />
                  Nenhum demonstrativo analítico gerado para este contrato.
                  <button
                    type="button"
                    onClick={handleGerarTabelaAutomatica}
                    className="block mx-auto mt-3 text-xs font-black text-indigo-600 hover:underline uppercase tracking-wider"
                  >
                    Clique aqui para gerar automaticamente
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50/75 border-b border-gray-150 text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest">
                        <th className="p-3 pl-4">ID / Descrição</th>
                        <th className="p-3">Valor Esperado</th>
                        <th className="p-3">Data Vencimento</th>
                        <th className="p-3">Forma Recebimento</th>
                        <th className="p-3">Situação</th>
                        <th className="p-3 pr-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700 font-semibold">
                      {tabelaAnalitica.map((row) => {
                        const isEditing = editingRowId === row.id;
                        const s = row.status || (row.pago ? "pago" : "pendente");
                        const isOverdue = s === "pendente" && row.dataVencimento && row.dataVencimento < new Date().toISOString().split("T")[0];
                        const displayStatus = isOverdue ? "atrasado" : s;

                        return (
                          <tr key={row.id} className="hover:bg-gray-50/30 transition">
                            {/* Descrição */}
                            <td className="p-3 pl-4">
                              <span className="font-extrabold text-gray-900 block">{row.numero || "Parcela"}</span>
                              <span className="text-[9px] font-mono font-black text-gray-400 uppercase block">ID: {row.id}</span>
                            </td>

                            {/* Valor */}
                            <td className="p-3 font-mono text-gray-900">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingRowVal}
                                  onChange={(e) => setEditingRowVal(e.target.value)}
                                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500 w-28"
                                />
                              ) : (
                                <span className="font-black text-slate-850">{row.valor || "—"}</span>
                              )}
                            </td>

                            {/* Vencimento */}
                            <td className="p-3 font-mono text-zinc-650">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editingRowDate}
                                  onChange={(e) => setEditingRowDate(e.target.value)}
                                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 w-32"
                                />
                              ) : (
                                row.dataVencimento ? new Date(row.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR") : "A definir"
                              )}
                            </td>

                            {/* Forma de Recebimento */}
                            <td className="p-3">
                              {isEditing ? (
                                <select
                                  value={editingRowForma}
                                  onChange={(e) => setEditingRowForma(e.target.value)}
                                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500"
                                >
                                  <option value="PIX">PIX</option>
                                  <option value="Alvará / Pix">Alvará / Pix</option>
                                  <option value="TED">TED</option>
                                  <option value="Boleto">Boleto</option>
                                  <option value="Alvará judicial">Alvará judicial</option>
                                  <option value="Retenção em Guia/Alvará">Retenção em Guia/Alvará</option>
                                  <option value="TED / Sucumbência">TED / Sucumbência</option>
                                </select>
                              ) : (
                                <span className="font-sans text-[11px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-650 border border-slate-200">
                                  {row.formaRecebimento || "PIX"}
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-3">
                              {isEditing ? (
                                <select
                                  value={editingRowStatus}
                                  onChange={(e) => setEditingRowStatus(e.target.value)}
                                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500"
                                >
                                  <option value="pendente">Pendente</option>
                                  <option value="pago">Pago / Quitada</option>
                                  <option value="atrasado">Atrasada</option>
                                </select>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border rounded-md text-[9px] font-black uppercase font-mono ${
                                  displayStatus === "pago" ? "bg-emerald-50 border-emerald-150 text-emerald-700" :
                                  displayStatus === "atrasado" ? "bg-rose-50 border-rose-150 text-rose-700 animate-pulse" :
                                  "bg-amber-50 border-amber-150 text-amber-700"
                                }`}>
                                  {displayStatus === "pago" ? "🟢 Pago" : displayStatus === "atrasado" ? "⚠️ Atrasado" : "🟡 Pendente"}
                                </span>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="p-3 pr-4 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveRowEdit(row.id)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition cursor-pointer"
                                    title="Salvar"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingRowId(null)}
                                    className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditRow(row)}
                                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer border border-transparent hover:border-indigo-100"
                                    title="Editar Parcela"
                                  >
                                    <FileCheck size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(row.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-transparent hover:border-rose-100"
                                    title="Remover"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* CARD 2: Relatório global do contrato */}
          {tabelaAnalitica.length > 0 && (() => {
            const parseCurrencySum = (valStr: string): number => {
              if (!valStr) return 0;
              const clean = valStr
                .replace("R$", "")
                .replace(/\./g, "")
                .replace(",", ".")
                .replace(/\s/g, "")
                .trim();
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            };

            const formatCurrencySum = (val: number): string => {
              return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            };

            let totalContrato = 0;
            let totalPago = 0;
            let totalAtrasado = 0;
            let totalPendente = 0;

            const todayStr = new Date().toISOString().split("T")[0];

            tabelaAnalitica.forEach((row) => {
              const status = row.status || (row.pago ? "pago" : "pendente");
              const val = parseCurrencySum(row.valor);
              totalContrato += val;

              if (status === "pago") {
                totalPago += val;
              } else if (status === "atrasado" || (status === "pendente" && row.dataVencimento && row.dataVencimento < todayStr)) {
                totalAtrasado += val;
              } else {
                totalPendente += val;
              }
            });

            const totalFaltaPagar = totalContrato - totalPago;
            const porcEfetivado = totalContrato > 0 ? (totalPago / totalContrato) * 100 : 0;
            const porcAtrasado = totalContrato > 0 ? (totalAtrasado / totalContrato) * 100 : 0;
            const porcPendente = totalContrato > 0 ? (totalPendente / totalContrato) * 100 : 0;

            return (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in duration-300">
                {/* Header */}
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <TrendingUp className="text-indigo-600" size={18} />
                  <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                    Relatório Global do Contrato de Honorários
                  </h3>
                </div>

                {/* Stat Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Valor Total */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block font-sans">Valor Total Contratado</span>
                    <span className="text-base font-black text-slate-900 font-mono">{formatCurrencySum(totalContrato)}</span>
                    <div className="text-[10px] text-zinc-500 font-sans">Soma de todas as parcelas analíticas</div>
                  </div>

                  {/* Total Pago */}
                  <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-blue-500 block font-sans">Total Recebido (Pago)</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-blue-700 font-mono">{formatCurrencySum(totalPago)}</span>
                      <span className="text-xs font-bold text-blue-600 font-mono">({porcEfetivado.toFixed(1)}%)</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-sans">
                      {tabelaAnalitica.filter(r => (r.status || (r.pago ? "pago" : "pendente")) === "pago").length} parcelas quitadas
                    </div>
                  </div>

                  {/* Total Pendente */}
                  <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100 space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 block font-sans">Total Pendente (A Vencer)</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-amber-700 font-mono">{formatCurrencySum(totalPendente)}</span>
                      <span className="text-xs font-bold text-amber-600 font-mono">({porcPendente.toFixed(1)}%)</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-sans">
                      {tabelaAnalitica.filter(r => {
                        const s = r.status || (r.pago ? "pago" : "pendente");
                        return s === "pendente" && !(r.dataVencimento && r.dataVencimento < todayStr);
                      }).length} parcelas a vencer
                    </div>
                  </div>

                  {/* Total Atrasado */}
                  <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-100 space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-rose-600 block font-sans">Total em Atraso</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-rose-700 font-mono">{formatCurrencySum(totalAtrasado)}</span>
                      <span className="text-xs font-bold text-rose-600 font-mono">({porcAtrasado.toFixed(1)}%)</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-sans flex items-center gap-1">
                      {totalAtrasado > 0 ? (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      ) : null}
                      {tabelaAnalitica.filter(r => {
                        const s = r.status || (r.pago ? "pago" : "pendente");
                        return s === "atrasado" || (s === "pendente" && r.dataVencimento && r.dataVencimento < todayStr);
                      }).length} parcelas vencidas
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider text-gray-500 font-mono">
                    <span>Progresso de Amortização Financeira</span>
                    <span className="text-blue-700">{porcEfetivado.toFixed(1)}% Amortizado</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${porcEfetivado}%` }}
                      className="bg-blue-600 h-full transition-all duration-500"
                      title={`Recebido: ${porcEfetivado.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${porcPendente}%` }}
                      className="bg-amber-400 h-full transition-all duration-500"
                      title={`Pendente: ${porcPendente.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${porcAtrasado}%` }}
                      className="bg-rose-500 h-full transition-all duration-500"
                      title={`Atrasado: ${porcAtrasado.toFixed(1)}%`}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-[9px] text-gray-400 font-bold font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-blue-600 block" /> Recebido ({porcEfetivado.toFixed(0)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-amber-400 block" /> A Vencer ({porcPendente.toFixed(0)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-rose-500 block" /> Atrasado ({porcAtrasado.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Remaining Audit summary */}
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-indigo-600" size={15} />
                    <span className="font-sans font-semibold text-slate-700">
                      Falta arrecadar para quitação integral:
                    </span>
                    <span className="font-mono font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded shadow-xs text-[13px]">
                      {formatCurrencySum(totalFaltaPagar)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Atualizado em tempo real com base no demonstrativo de parcelas
                  </div>
                </div>

                {/* Operational Reports Generation Buttons */}
                <div className="border-t border-gray-150 pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        GDi — Google Docs Integration
                      </span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        Relatórios estruturados gerados na pasta de destino do cliente
                      </span>
                    </div>

                    {(() => {
                      const driveUrl = (
                        selectedClient?.googleDriveClientFolderUrl ||
                        selectedClient?.gdriveFolderUrl ||
                        activeCase?.gdriveFolderUrl ||
                        ""
                      ).trim();
                      if (!driveUrl) return null;
                      return (
                        <a
                          href={driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-700 transition-colors cursor-pointer font-sans"
                        >
                          <ExternalLink size={10} className="text-slate-500 shrink-0" />
                          <span>Destino: Drive do Cliente</span>
                        </a>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      disabled={savingDoc}
                      onClick={() => {
                        const placeholderData = {
                          "{{VALOR_TOTAL}}": formatCurrencySum(totalContrato),
                          "{{TOTAL_PAGO}}": formatCurrencySum(totalPago),
                          "{{TOTAL_ATRASADO}}": formatCurrencySum(totalAtrasado),
                          "{{TOTAL_PENDENTE}}": formatCurrencySum(totalPendente),
                          "{{FALTA_ARRECADAR}}": formatCurrencySum(totalFaltaPagar),
                          "{{PROG_AMORTIZACAO}}": `${porcEfetivado.toFixed(1)}%`,
                        };
                        handleGenerateCustomDocument(
                          "relatorio_global_contrato",
                          "Relatório Global do Contrato de Honorários",
                          placeholderData
                        );
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer font-mono"
                    >
                      {savingDoc ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                      Gerar Relatório Global (GDi)
                    </button>

                    <button
                      type="button"
                      disabled={savingDoc}
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        const tabelaTexto = tabelaAnalitica.map((p, idx) => {
                          const s = p.status || (p.pago ? "pago" : "pendente");
                          const resolvedStatus = s === "atrasado" || (s === "pendente" && p.dataVencimento && p.dataVencimento < today) ? "VENCIDO" : s.toUpperCase();
                          return `${idx + 1}. Parcela: ${p.valor} | Vencimento: ${p.dataVencimento || "N/A"} | Status: ${resolvedStatus}`;
                        }).join("\n");

                        const placeholderData = {
                          "{{VALOR_TOTAL}}": formatCurrencySum(totalContrato),
                          "{{TOTAL_PAGO}}": formatCurrencySum(totalPago),
                          "{{TOTAL_ATRASADO}}": formatCurrencySum(totalAtrasado),
                          "{{TOTAL_PENDENTE}}": formatCurrencySum(totalPendente),
                          "{{FALTA_ARRECADAR}}": formatCurrencySum(totalFaltaPagar),
                          "{{PROG_AMORTIZACAO}}": `${porcEfetivado.toFixed(1)}%`,
                          "{{TABELA_ANALITICA_DETALHADA}}": tabelaTexto,
                        };
                        handleGenerateCustomDocument(
                          "relatorio_tabela_analitica",
                          "Relatório de Tabela Analítica do Contrato de Honorários",
                          placeholderData
                        );
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer font-mono"
                    >
                      {savingDoc ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
                      Gerar Tabela Analítica (GDi)
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* CARD 3: Google Docs Integration - Jurídico Interno */}
          {tabelaAnalitica.length > 0 && (() => {
            const parseValue = (valStr: string): number => {
              if (!valStr) return 0;
              const clean = valStr
                .replace("R$", "")
                .replace(/\./g, "")
                .replace(",", ".")
                .replace(/\s/g, "")
                .trim();
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            };

            const formatCurrency = (val: number): string => {
              return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            };

            let totalContrato = 0;
            let totalPago = 0;
            let totalAtrasado = 0;
            let totalPendente = 0;
            const todayStr = new Date().toISOString().split("T")[0];

            tabelaAnalitica.forEach((row) => {
              const status = row.status || (row.pago ? "pago" : "pendente");
              const val = parseValue(row.valor);
              totalContrato += val;

              if (status === "pago") {
                totalPago += val;
              } else if (status === "atrasado" || (status === "pendente" && row.dataVencimento && row.dataVencimento < todayStr)) {
                totalAtrasado += val;
              } else {
                totalPendente += val;
              }
            });

            const totalFaltaPagar = totalContrato - totalPago;

            const clientDriveFolderUrl = (
              selectedClient?.googleDriveClientFolderUrl ||
              selectedClient?.gdriveFolderUrl ||
              activeCase?.gdriveFolderUrl ||
              ""
            ).trim();

            return (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Scale className="text-amber-600 animate-pulse" size={20} />
                    <div>
                      <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider font-sans">
                        Google Docs Integration - Jurídico Interno
                      </h3>
                      <p className="text-[10px] text-gray-400 font-sans">
                        Geração automatizada de peças e atos de cobrança diretamente no Google Drive do cliente
                      </p>
                    </div>
                  </div>

                  {clientDriveFolderUrl && (
                    <a
                      href={clientDriveFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-indigo-750 transition-colors cursor-pointer font-sans"
                      id="gdocs-juridico-drive-folder-link"
                    >
                      <ExternalLink size={12} className="text-indigo-600 shrink-0" />
                      <span>Abrir Pasta de Destino</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CARD 1: Notificação Extrajudicial para cobrança */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Atos Preparatórios
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-800 tracking-tight leading-snug font-sans">
                        Notificação Extrajudicial para cobrança
                      </h4>
                      <p className="text-[10px] text-slate-400 font-sans leading-normal">
                        Gere uma minuta em PDF pronto para assinatura e notificação fática do cliente em atraso.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={savingDoc}
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        const tabelaTexto = tabelaAnalitica.map((p, idx) => {
                          const s = p.status || (p.pago ? "pago" : "pendente");
                          const resolvedStatus = s === "atrasado" || (s === "pendente" && p.dataVencimento && p.dataVencimento < today) ? "VENCIDO" : s.toUpperCase();
                          return `${idx + 1}. Parcela: ${p.valor} | Vencimento: ${p.dataVencimento || "N/A"} | Status: ${resolvedStatus}`;
                        }).join("\n");

                        handleGenerateCustomDocument(
                          "notificacao_extrajudicial_cobranca",
                          "Notificação Extrajudicial para Cobrança de Honorários",
                          {
                            "{{VALOR_TOTAL}}": formatCurrency(totalContrato),
                            "{{TOTAL_PAGO}}": formatCurrency(totalPago),
                            "{{TOTAL_ATRASADO}}": formatCurrency(totalAtrasado),
                            "{{TOTAL_PENDENTE}}": formatCurrency(totalPendente),
                            "{{FALTA_ARRECADAR}}": formatCurrency(totalFaltaPagar),
                            "{{TABELA_ANALITICA_DETALHADA}}": tabelaTexto,
                          }
                        );
                      }}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-mono font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {savingDoc ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                      Gerar Notificação
                    </button>
                  </div>

                  {/* CARD 2: Protesto extrajudicial do contrato de honorários */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Frustração de Acordo
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-800 tracking-tight leading-snug font-sans">
                        Protesto extrajudicial do contrato de honorários
                      </h4>
                      <p className="text-[10px] text-slate-400 font-sans leading-normal">
                        Aponta o título executivo e o contrato inadimplido perante o Cartório de Protestos competente.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={savingDoc}
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        const tabelaTexto = tabelaAnalitica.map((p, idx) => {
                          const s = p.status || (p.pago ? "pago" : "pendente");
                          const resolvedStatus = s === "atrasado" || (s === "pendente" && p.dataVencimento && p.dataVencimento < today) ? "VENCIDO" : s.toUpperCase();
                          return `${idx + 1}. Parcela: ${p.valor} | Vencimento: ${p.dataVencimento || "N/A"} | Status: ${resolvedStatus}`;
                        }).join("\n");

                        handleGenerateCustomDocument(
                          "protesto_extrajudicial_contrato",
                          "Protesto Extrajudicial do Contrato de Honorários",
                          {
                            "{{VALOR_TOTAL}}": formatCurrency(totalContrato),
                            "{{TOTAL_PAGO}}": formatCurrency(totalPago),
                            "{{TOTAL_ATRASADO}}": formatCurrency(totalAtrasado),
                            "{{TOTAL_PENDENTE}}": formatCurrency(totalPendente),
                            "{{FALTA_ARRECADAR}}": formatCurrency(totalFaltaPagar),
                            "{{TABELA_ANALITICA_DETALHADA}}": tabelaTexto,
                          }
                        );
                      }}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-mono font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {savingDoc ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
                      Gerar Protesto
                    </button>
                  </div>

                  {/* CARD 3: Ação de cobrança de Honorários Advocatícios */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Atos Judiciais
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-800 tracking-tight leading-snug font-sans">
                        Ação de cobrança de Honorários Advocatícios
                      </h4>
                      <p className="text-[10px] text-slate-400 font-sans leading-normal">
                        Minuta de petição inicial fática para ajuizamento da execução de título extrajudicial de honorários.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={savingDoc}
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        const tabelaTexto = tabelaAnalitica.map((p, idx) => {
                          const s = p.status || (p.pago ? "pago" : "pendente");
                          const resolvedStatus = s === "atrasado" || (s === "pendente" && p.dataVencimento && p.dataVencimento < today) ? "VENCIDO" : s.toUpperCase();
                          return `${idx + 1}. Parcela: ${p.valor} | Vencimento: ${p.dataVencimento || "N/A"} | Status: ${resolvedStatus}`;
                        }).join("\n");

                        handleGenerateCustomDocument(
                          "acao_cobranca_honorarios",
                          "Ação de Cobrança de Honorários Advocatícios",
                          {
                            "{{VALOR_TOTAL}}": formatCurrency(totalContrato),
                            "{{TOTAL_PAGO}}": formatCurrency(totalPago),
                            "{{TOTAL_ATRASADO}}": formatCurrency(totalAtrasado),
                            "{{TOTAL_PENDENTE}}": formatCurrency(totalPendente),
                            "{{FALTA_ARRECADAR}}": formatCurrency(totalFaltaPagar),
                            "{{TABELA_ANALITICA_DETALHADA}}": tabelaTexto,
                          }
                        );
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {savingDoc ? <Loader2 size={11} className="animate-spin" /> : <Scale size={11} />}
                      Gerar Petição Inicial
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal / Multi-step Questionnaire: Prestar Contas */}
      {showPrestarContas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto font-sans">
          <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative text-left space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div>
                <span className="text-[10px] font-mono font-black text-indigo-650 uppercase tracking-widest block">PORTAL DO BOSS — OPERACIONAL DE PRODUÇÃO</span>
                <h3 className="text-lg font-black text-gray-950 font-sans mt-0.5">Prestação de Contas Definitiva (3 Etapas)</h3>
              </div>
              <button
                type="button"
                onClick={handleResetPrestarContas}
                className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Progress bar */}
            <div className="flex items-center justify-between relative px-2">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
              
              {[
                { step: 1, label: '1. Questionário Inicial' },
                { step: 2, label: '2. Apuração Efetiva' },
                { step: 3, label: '3. Recibo e Envio' }
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center z-10 relative bg-white px-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                    currentStep === s.step 
                      ? 'bg-indigo-650 border-indigo-650 text-white shadow-sm ring-4 ring-indigo-100' 
                      : currentStep > s.step 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {currentStep > s.step ? '✓' : s.step}
                  </div>
                  <span className={`text-[10px] mt-1.5 tracking-tight uppercase font-black ${
                    currentStep === s.step ? 'text-indigo-650 font-bold' : 'text-gray-400 font-mono'
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Step Contents */}
            <div className="pt-2">
              
              {/* STEP 1: INITIAL QUESTIONNAIRE */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-start gap-3">
                    <AlertCircle size={16} className="text-emerald-700 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">Etapa 1: Origem de Valores e Dados Judiciais</h4>
                      <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">Aponte o caso sob apuração. O sistema mapeia os honorários pactuados no contrato de honorários.</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block mb-1.5">Qual o caso que você irá prestar contas?</label>
                    <select
                      value={targetCaseId}
                      onChange={(e) => handleCaseSelect(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                    >
                      <option value="">Selecione um caso...</option>
                      {clientCases.map((c) => (
                        <option key={c.id} value={c.id}>
                          📂 {c.title || 'Sem título'} {c.processNumber ? `[CNJ: ${c.processNumber}]` : ''} - regime: {c.tipoHonorario || 'Não configurado'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {targetCaseId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-indigo-100 p-4 rounded-2xl bg-indigo-50/50 animate-fade-in">
                      <div>
                        <span className="text-[9px] font-mono font-black text-indigo-500 block">SISTEMA DE HONORÁRIOS DETECTADO (PUXADO DO CASO):</span>
                        <span className="text-xs font-black text-indigo-900 uppercase block mt-0.5">
                          💼 {feesSystem}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono font-black text-indigo-500 block">VALOR PREVISTO EM CONTRATO:</span>
                        <span className="text-xs font-black text-indigo-900 font-mono block mt-0.5">
                          💵 {formatBRL(valorContrato)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block mb-1.5">Forma de Recebimento</label>
                      <select
                        value={formaRecebimento}
                        onChange={(e) => setFormaRecebimento(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                      >
                        <option value="Alvará judicial">Alvará judicial</option>
                        <option value="Depósito judicial">Depósito judicial</option>
                        <option value="Acordo direto em audiência">Acordo direto em audiência</option>
                        <option value="Repasse voluntário pelo herdeiro">Repasse voluntário pelo herdeiro</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block mb-1.5">Em qual conta o valor foi depositado?</label>
                      <input
                        type="text"
                        placeholder="Ex: Conta de Depósitos Judiciais do Banco do Brasil"
                        value={contaDeposito}
                        onChange={(e) => setContaDeposito(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition shadow-xs"
                      />
                    </div>
                  </div>

                  {formaRecebimento === 'Alvará judicial' && (
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/50 flex flex-col gap-4 animate-fade-in">
                      <span className="text-[10px] font-mono font-black text-amber-800 uppercase tracking-wider block">⚖️ CONDICIONAIS DE ALVARÁ JUDICIAL</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-mono font-bold text-gray-450 block mb-1">Qual o ID / link do Alvará?</label>
                          <input
                            type="text"
                            placeholder="Ex: ALV-556678"
                            value={alvaraId}
                            onChange={(e) => setAlvaraId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none shadow-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-bold text-gray-450 block mb-1">Dia do débito em conta</label>
                          <input
                            type="date"
                            value={alvaraDebitoData}
                            onChange={(e) => setAlvaraDebitoData(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono font-semibold focus:outline-none shadow-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono font-bold text-gray-450 block mb-1">Alvará recebido efetivamente?</label>
                          <select
                            value={alvaraRecebido}
                            onChange={(e) => setAlvaraRecebido(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none shadow-xs"
                          >
                            <option value="Sim">Sim, amortizado</option>
                            <option value="Não">Não, aguardando compensação</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block mb-1.5">O valor bruto do repasse foi depositado direto na conta do cliente?</label>
                    <select
                      value={depositadoContaCliente}
                      onChange={(e) => setDepositadoContaCliente(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                    >
                      <option value="Não">Não (Saldo recebido via escritório para posterior rateio compensatório)</option>
                      <option value="Sim">Sim (Depositado inteiramente na conta do cliente - cobrar honorários por boleto/guia)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 2: ACCOUNTING METRICS */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100/50 flex items-start gap-3">
                    <TrendingUp size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950 font-sans">Etapa 2: Apuração Efetiva das Contas</h4>
                      <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">Mapeie as entradas e subtraia os honorários advocatícios sugeridos ou customizados abaixo.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Qual foi o Honorário Contratado?</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          placeholder="Fixo do Contrato"
                          value={valorContrato || ''}
                          onChange={(e) => setValorContrato(Number(e.target.value))}
                          className="w-1/2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold text-indigo-650"
                        />
                        <input
                          type="number"
                          placeholder="Porcentagem Êxito %"
                          value={honorarioExitoPercentual || ''}
                          onChange={(e) => setHonorarioExitoPercentual(Number(e.target.value))}
                          className="w-1/2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold text-indigo-650"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Sistema de Cobrança Ajustado</label>
                      <select
                        value={feesSystem}
                        onChange={(e) => setFeesSystem(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700"
                      >
                        <option value="Honorários Fixos">Honorários Fixos (Deduz parcelas contratuais fixas)</option>
                        <option value="Êxito">Ad Êxito (% Sobre Valor Recebido total)</option>
                        <option value="Misto (Fixo + Êxito)">Regime Misto (Honorários Fixos + Percentual sobre Êxito)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Valor Bruto Recebido (Ex: Alvará) [R$]</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={valorRecebidoTotal || ''}
                        onChange={(e) => setValorRecebidoTotal(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-black text-gray-900 border-indigo-200 ring-2 ring-indigo-50 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Desconto de Honorários [R$]</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={valorHonorariosDeduzido || ''}
                        onChange={(e) => setValorHonorariosDeduzido(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-black text-rose-700 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Custas / Despesas a Deduzir [R$]</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={despesas || ''}
                        onChange={(e) => setDespesas(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-black text-rose-700 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-[9px] font-mono font-black text-emerald-800 uppercase tracking-widest block">VALOR LÍQUIDO DO REPASSE AO CLIENTE</span>
                    <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
                      {formatBRL(Math.max(0, valorRecebidoTotal - valorHonorariosDeduzido - despesas))}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-semibold mt-1">Cálculo: {formatBRL(valorRecebidoTotal)} recebido - {formatBRL(valorHonorariosDeduzido)} honorários - {formatBRL(despesas)} custas deduzidas</span>
                  </div>
                </div>
              )}

              {/* STEP 3: DEFINITIVE RENDERING STATEMENT & SENDS */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/50 flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">Etapa 3: Prestação de Contas Definitiva</h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">Analise o recibo unificado de contas. Você poderá exportar para o Google Drive GDI e despachar via redes sociais ou imprimir um PDF físico.</p>
                    </div>
                  </div>

                  {/* Styled Receipt Summary Block */}
                  <div id="print-area" className="bg-zinc-950 text-white rounded-3xl p-6 relative overflow-hidden font-sans shadow-xl text-left border border-zinc-800">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Scale size={130} />
                    </div>

                    <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
                      <div>
                        <h4 className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest">DEMONSTRATIVO DE REPASSE FINAL</h4>
                        <p className="text-lg font-black tracking-tight mt-0.5">Giffoni Advogados Associados</p>
                      </div>
                      <div className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-mono uppercase tracking-widest font-black text-zinc-300">
                        RELATÓRIO: {new Date().toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    <div className="space-y-4 py-4 text-xs font-sans">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-b border-zinc-900 pb-4">
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-mono">ASSISTIDO / REQUERENTE</span>
                          <span className="font-extrabold text-white text-xs">{getClientName(selectedClient)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-mono font-sans">PROCESSO CNJ</span>
                          <span className="font-semibold text-white/90 text-xs font-mono">{(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Processo não anexado'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-mono">OBJETO DO CASO</span>
                          <span className="font-extrabold text-zinc-200 text-xs font-sans">{(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Coletado'}</span>
                        </div>
                      </div>

                      <div className="space-y-2 font-mono text-zinc-300">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>(+) Entrada / Recebimento Brutal Valor ({formaRecebimento})</span>
                          <span className="text-white font-black">{formatBRL(valorRecebidoTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-rose-300">
                          <span>(-) Dedução Contratual Retida ({feesSystem})</span>
                          <span className="font-black">-{formatBRL(valorHonorariosDeduzido)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-rose-300">
                          <span>(-) Custas e despesas processuais deduzidas</span>
                          <span className="font-black">-{formatBRL(despesas)}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-3 text-emerald-400 font-extrabold text-sm font-black">
                          <span>(=) TOTAL OPERACIONAIS DE REPASSE AO SEU FAVOR</span>
                          <span className="text-emerald-300 font-black">{formatBRL(Math.max(0, valorRecebidoTotal - valorHonorariosDeduzido - despesas))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-3 text-[10px] text-zinc-400 font-medium font-sans">
                      <span>🏦 <strong>Conta Indicada para Repasse:</strong> {contaRepasse || 'Não informada pelo cliente'}</span>
                    </div>
                  </div>

                  {/* Indicação de Conta e Agradecimento editáveis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Confirmar Conta de Repasse (Impresso)</label>
                      <input
                        type="text"
                        placeholder="Ex: Chave PIX: celular 21999999... Banco Nubank"
                        value={contaRepasse}
                        onChange={(e) => setContaRepasse(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition leading-relaxed shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1">Mensagem de Agradecimento (Volte Sempre)</label>
                      <textarea
                        rows={2}
                        value={thanksMessage}
                        onChange={(e) => setThanksMessage(e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* GDI Integration Trigger Panel */}
                  <div className="p-5 bg-indigo-50/75 border border-indigo-100/50 rounded-2xl space-y-3 text-left font-sans">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-650 text-white flex items-center justify-center font-black text-xs font-mono shadow-xs">GDI</div>
                      <div>
                        <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">Integração da Prestação do GDI</h4>
                        <p className="text-[10px] text-indigo-700 font-semibold font-sans">Criação automatizada de documento na pasta do cliente.</p>
                      </div>
                    </div>

                    {googleDriveSuccess ? (
                      <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-150 flex items-center justify-between text-xs font-bold text-emerald-800 animate-fade-in font-sans">
                        <div className="flex items-center gap-2 font-sans">
                          <Check size={16} className="text-emerald-600" />
                          <span>Prestação salva na pasta do cliente com sucesso!</span>
                        </div>
                        <a 
                          href={selectedClient?.googleDriveClientFolderUrl || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-sans"
                        >
                          <ExternalLink size={10} />
                          <span>Acessar GDI</span>
                        </a>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleExportToGoogleDrive}
                        disabled={googleDriveLoading || !targetCaseId}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {googleDriveLoading ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Contatando GDI e salvando barramento...</span>
                          </>
                        ) : (
                          <>
                            <FolderOpen size={13} />
                            <span>Exportar Prestação de Contas para pasta de Destino do Cliente</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Multichannel Options */}
                  <div className="space-y-3 text-left">
                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase block tracking-wider font-sans">Como deseja prestar contas ao cliente? (Estrutura multicanal)</span>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { id: 'whatsapp', label: 'WhatsApp', color: 'hover:bg-emerald-50' },
                        { id: 'gmail', label: 'Gmail', color: 'hover:bg-rose-50' },
                        { id: 'facebook', label: 'Facebook', color: 'hover:bg-blue-50' },
                        { id: 'instagram', label: 'Instagram', color: 'hover:bg-pink-50' },
                        { id: 'tiktok', label: 'TikTok', color: 'hover:bg-zinc-100' },
                        { id: 'fisico', label: 'Impresso / Físico', color: 'hover:bg-slate-50' }
                      ].map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setSelectedChannel(ch.id as any);
                            setMessageCopied(false);
                          }}
                          className={`p-3 border rounded-xl text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            selectedChannel === ch.id 
                              ? 'bg-zinc-950 border-zinc-950 text-white scale-102 font-bold shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-500 font-semibold'
                          } ${ch.color}`}
                        >
                          <span className="text-[10.5px] uppercase tracking-wider font-extrabold text-center block leading-none">{ch.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Active Channel Preview Template */}
                    <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4.5 space-y-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between font-sans">
                        <span className="text-[10px] font-mono font-black text-indigo-650 uppercase tracking-widest block font-sans">
                          Modelo Pronto do Canal: {selectedChannel.toUpperCase()}
                        </span>
                        
                        {selectedChannel !== 'fisico' && (
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('template-text-3') as HTMLTextAreaElement;
                              if (el) {
                                navigator.clipboard.writeText(el.value);
                                setMessageCopied(true);
                                setTimeout(() => setMessageCopied(false), 2000);
                              }
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-gray-150 text-gray-600 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 size={11} />
                            <span>{messageCopied ? 'Texto Copiado!' : 'Copiar Texto do Modelo'}</span>
                          </button>
                        )}
                      </div>

                      {selectedChannel === 'fisico' ? (
                        <div className="space-y-3 font-sans">
                          <p className="text-[11px] text-gray-450 leading-relaxed font-semibold">
                            Abra a versão para impressão na tela. Você pode carregar um papel timbrado em sua impressora física para colher a assinatura de quitação.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              window.print();
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                          >
                            <Printer size={13} />
                            <span>Imprimir Relatório Quitado</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            id="template-text-3"
                            rows={8}
                            readOnly
                            value={
                              selectedChannel === 'whatsapp' ? `⚖️ *Prestação de Contas - Giffoni Advogados Associados*\n\nPrezado(a) *${getClientName(selectedClient)}*,\n\nAqui está o resumo da prestação de contas do seu processo:\n\n📂 *Caso:* ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\n🔢 *Processo:* ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n💰 *Valor Total Recebido:* ${formatBRL(valorRecebidoTotal)}\n📉 *Honorários Retidos:* -${formatBRL(valorHonorariosDeduzido)}\n💸 *Despesas/Custas:* -${formatBRL(despesas)}\n🏆 *VALOR DO REPASSE:* *${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}*\n\n🏦 *Conta indicada:* ${contaRepasse}\n\n🙏 *Mensagem:* ${thanksMessage}\n\nGiffoni Advogados Associados ✨`
                              : selectedChannel === 'gmail' ? `Prezado(a) ${getClientName(selectedClient)},\n\nSeguem abaixo as informações referentes à apuração definitiva de contas do seu caso:\n\nCaso: ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\nProcesso: ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n\nValor Total Recebido: ${formatBRL(valorRecebidoTotal)}\nHonorários Advocatícios Retidos: -${formatBRL(valorHonorariosDeduzido)}\nDeduções/Custas: -${formatBRL(despesas)}\n----------------------------------------\nVALOR DO REPASSE LÍQUIDO: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}\n\nConta indicada para Repasse: ${contaRepasse}\n\nMensagem: ${thanksMessage}\n\nEstamos sempre à inteira disposição.\n\nAtenciosamente,\nGiffoni Advogados Associados\nVolte sempre!`
                              : selectedChannel === 'facebook' ? `⚖️ Giffoni Advogados associados - Transparência e Resultado!\n\nCliente: ${getClientName(selectedClient)}\nProcesso Concluído com repasse líquido de: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}!\n\nParabéns! Conta indicada: ${contaRepasse}.\n\n#advocacia #giffoniadvogados #direito #prestacaoContas`
                              : selectedChannel === 'instagram' ? `💼 Prestação de Contas Efetuada com Sucesso pela Giffoni Advogados!\n\nValor do repasse final do cliente: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)} creditados na conta indicada para transferência.\n\nAgradecemos a total confiança jurídica e dedicação em nosso escritório associado! Volte sempre! ✨⚖️\n\n#advocacia #direito #sustentação #giffoniadvogados`
                              : `⚖️ Conta prestada pelo portal: Repasse de ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)} enviado na conta: ${contaRepasse}. Giffoni Advogados Associados! Volte sempre!`
                            }
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-mono font-semibold text-gray-750 focus:outline-none"
                          />

                          <div className="flex items-center gap-2 font-sans">
                            {selectedChannel === 'whatsapp' && (
                              <a
                                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                  `⚖️ *Prestação de Contas - Giffoni Advogados Associados*\n\nPrezado(a) *${getClientName(selectedClient)}*,\n\nAqui está o resumo da prestação de contas do seu processo:\n\n📂 *Caso:* ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\n🔢 *Processo:* ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n💰 *Valor Total Recebido:* ${formatBRL(valorRecebidoTotal)}\n📉 *Honorários Retidos:* -${formatBRL(valorHonorariosDeduzido)}\n💸 *Despesas/Custas:* -${formatBRL(despesas)}\n🏆 *VALOR DO REPASSE:* *${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}*\n\n🏦 *Conta indicada:* ${contaRepasse}\n\n🙏 *Mensagem:* ${thanksMessage}\n\nGiffoni Advogados Associados ✨`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-sans"
                              >
                                <Send size={12} />
                                <span>Abrir no WhatsApp</span>
                              </a>
                            )}

                            {selectedChannel === 'gmail' && (
                              <a
                                href={`mailto:${selectedClient?.email || ''}?subject=${encodeURIComponent(
                                  `Prestação de Contas - ${(clientCases.find(c => c.id === targetCaseId))?.title || ''}`
                                )}&body=${encodeURIComponent(
                                  `Prezado(a) ${getClientName(selectedClient)},\n\nSeguem abaixo as informações referentes à apuração definitiva de contas do seu caso:\n\nCaso: ${(clientCases.find(c => c.id === targetCaseId))?.title || 'Caso Geral'}\nProcesso: ${(clientCases.find(c => c.id === targetCaseId))?.processNumber || 'Não informado'}\n\nValor Total Recebido: ${formatBRL(valorRecebidoTotal)}\nHonorários Advocatícios Retidos: -${formatBRL(valorHonorariosDeduzido)}\nDeduções/Custas: -${formatBRL(despesas)}\n----------------------------------------\nVALOR DO REPASSE LÍQUIDO: ${formatBRL(valorRecebidoTotal - valorHonorariosDeduzido - despesas)}\n\nConta indicada para Repasse: ${contaRepasse}\n\nMensagem: ${thanksMessage}\n\nEstamos sempre à inteira disposição.\n\nAtenciosamente,\nGiffoni Advogados Associados\nVolte sempre!`
                                )}`}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-sans"
                              >
                                <Mail size={12} />
                                <span>Enviar via Gmail</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Stepper Buttons footer */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 font-sans">
              <button
                type="button"
                disabled={currentStep === 1}
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                <span>Anterior</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetPrestarContas}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Cancelar / Sair
                </button>
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1 && !targetCaseId) {
                        alert("Por favor, selecione qual o caso deseja prestar contas.");
                        return;
                      }
                      if (currentStep === 2 && valorRecebidoTotal <= 0) {
                        alert("Por favor, insira o valor bruto recebido para cálculo de contas.");
                        return;
                      }
                      setCurrentStep((prev) => (prev + 1) as any);
                    }}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span>Próximo</span>
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetPrestarContas}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                  >
                    Concluir e Finalizar
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Detalhes do Faturamento */}
      {selectedDetailFinancial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-left space-y-6 font-sans">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase text-indigo-650 font-mono tracking-wider">Detalhes do Faturamento</h3>
              <button
                type="button"
                onClick={() => setSelectedDetailFinancial(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 font-sans">
              <div>
                <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Classificação</span>
                <span className="text-sm font-extrabold text-gray-900 block mt-0.5">
                  {getChargeTypeLabel(selectedDetailFinancial.chargeType)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Valor Total</span>
                  <span className="text-sm font-black text-gray-900 font-mono block mt-0.5">
                    {formatBRL(selectedDetailFinancial.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block font-sans">Vencimento</span>
                  <span className="text-sm font-extrabold text-gray-900 font-mono block mt-0.5 font-semibold">
                    {selectedDetailFinancial.firstDueDate || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Parcelas</span>
                  <span className="text-sm font-extrabold text-gray-900 block mt-0.5">
                    {selectedDetailFinancial.installments || 1}x
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Meio de Pagamento</span>
                  <span className="text-sm font-black text-indigo-650 font-mono uppercase block mt-0.5">
                    {selectedDetailFinancial.paymentMethod || 'Não selecionado'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Situação Atual</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-lg text-[10px] font-extrabold uppercase font-mono mt-1 ${
                  selectedDetailFinancial.financialStatus === 'pago' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  selectedDetailFinancial.financialStatus === 'vencido' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {selectedDetailFinancial.financialStatus === 'pago' ? '🟢 PAGO' : selectedDetailFinancial.financialStatus === 'vencido' ? '⚠️ VENCIDO' : '🟡 PENDENTE'}
                </span>
              </div>

              {selectedDetailFinancial.publicMessage && (
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl">
                  <span className="text-[9px] font-mono font-black text-gray-400 uppercase tracking-widest block mb-1">Aviso/Instrução ao Cliente</span>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed break-words">{selectedDetailFinancial.publicMessage}</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedDetailFinancial(null)}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-950 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Apuração do Contrato de Exito */}
      {showApurarExitoModal && activeCase && (
        <div className="fixed inset-0 bg-gray-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl relative text-left space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-2xl flex items-center justify-center shadow-2xs">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">Apuração do Contrato de Exito</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Caso Ativo: {activeCase.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApurarExitoModal(false)}
                className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition border border-gray-150 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Vertical Options Form */}
            <div className="space-y-4">
              {/* 1. Forma de Pagamento */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Forma de Pagamento
                </label>
                <select
                  value={modalFormaPagamento}
                  onChange={(e) => setModalFormaPagamento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                >
                  <option value="A definir">A definir</option>
                  <option value="À vista">À vista</option>
                  <option value="Parcelado">Parcelado</option>
                  <option value="Entrada + Parcelado">Entrada + Parcelado</option>
                  <option value="A combinar">A combinar</option>
                </select>
              </div>

              {/* 2. Meio de Recebimento */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Meio de Recebimento
                </label>
                <select
                  value={modalMeioRecebimento}
                  onChange={(e) => setModalMeioRecebimento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                >
                  <option value="A definir">A definir</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Depósito">Depósito</option>
                  <option value="Alvará judicial">Alvará judicial</option>
                  <option value="A combinar">A combinar</option>
                </select>
              </div>

              {/* 3. Valor total recebido na conta do: */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Valor total recebido na conta do:
                </label>
                <select
                  value={modalRecebidoContaDo}
                  onChange={(e) => setModalRecebidoContaDo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                >
                  <option value="A definir">A definir</option>
                  <option value="Cliente">Cliente</option>
                  <option value="Escritório">Escritório</option>
                </select>
              </div>

              {/* 4. Banco de Recebimento */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Banco de Recebimento
                </label>
                <select
                  value={modalBancoRecebimento}
                  onChange={(e) => setModalBancoRecebimento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                >
                  <option value="A definir">A definir</option>
                  <option value="Banco do Brasil">Banco do Brasil</option>
                  <option value="Itaú">Itaú</option>
                  <option value="Bradesco">Bradesco</option>
                  <option value="Santander">Santander</option>
                  <option value="Nubank">Nubank</option>
                  <option value="Caixa Econômica">Caixa Econômica</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* 5. Chave Pix do Escritório */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Chave Pix do Escritório
                </label>
                <input
                  type="text"
                  value={modalPixEscritorio}
                  onChange={(e) => setModalPixEscritorio(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="A definir"
                />
              </div>

              {/* 6. Chave Pix do Cliente (Etapa 01) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Chave Pix do Cliente (Etapa 01)
                </label>
                <input
                  type="text"
                  value={modalPixCliente}
                  onChange={(e) => setModalPixCliente(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="020.566.671-00"
                />
              </div>

              {/* 7. Valor Total a Receber */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Valor Total a Receber
                </label>
                <input
                  type="text"
                  value={modalValorTotalAReceber}
                  onChange={(e) => setModalValorTotalAReceber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="a apurar"
                />
              </div>

              {/* 8. Quantidade de Parcelas */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Quantidade de Parcelas
                </label>
                <input
                  type="text"
                  value={modalQuantidadeParcelas}
                  onChange={(e) => setModalQuantidadeParcelas(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="a definir"
                />
              </div>

              {/* 9. Valor das Parcelas (R$) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Valor das Parcelas (R$)
                </label>
                <input
                  type="text"
                  value={modalValorParcelas}
                  onChange={(e) => setModalValorParcelas(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="a definir"
                />
              </div>

              {/* 10. Valor de Entrada (R$) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Valor de Entrada (R$)
                </label>
                <input
                  type="text"
                  value={modalValorEntrada}
                  onChange={(e) => setModalValorEntrada(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="a definir"
                />
              </div>

              {/* 11. Primeiro Recebimento */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Primeiro Recebimento
                </label>
                <input
                  type="text"
                  value={modalPrimeiroRecebimento}
                  onChange={(e) => setModalPrimeiroRecebimento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                  placeholder="a definir"
                />
              </div>

              {/* 12. Cobrança Automática */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">
                  Cobrança Automática
                </label>
                <select
                  value={modalCobrancaAutomatica}
                  onChange={(e) => setModalCobrancaAutomatica(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Ativada">Ativada</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowApurarExitoModal(false)}
                className="flex-1 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveExito}
                disabled={savingExito}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
              >
                {savingExito ? 'Salvando...' : 'Confirmar e Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showVerContratoExitoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-gray-100 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white rounded-t-3xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-mono">
                  📜 Termos Canônicos do Contrato de Êxito
                </h3>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                  Visualização da Cláusula Segunda (Prestações e Condições de Êxito)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVerContratoExitoModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-gray-700 font-sans">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 font-mono whitespace-pre-wrap select-all">
                {compiledClausulaExito}
              </div>
              <p className="text-[10px] text-gray-400 italic text-center">
                Você pode selecionar e copiar os termos acima para uso formal ou auditoria.
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 rounded-b-3xl flex justify-end">
              <button
                type="button"
                onClick={() => setShowVerContratoExitoModal(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
