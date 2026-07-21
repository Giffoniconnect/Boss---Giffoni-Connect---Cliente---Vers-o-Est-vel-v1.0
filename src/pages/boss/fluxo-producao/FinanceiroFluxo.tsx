import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  buildContratoHonorariosPfPlaceholders,
  buildContratoHonorariosPjPlaceholders,
} from "../../../lib/documents/placeholderBuilders";
import FluxoStepLayout from "./components/FluxoStepLayout";
import EntregaDocumento from "./components/EntregaDocumento";
import LogList from "./components/LogList";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Info,
  Plus,
  Edit2,
  Pencil,
  Check,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
  Archive,
  RefreshCw,
  CreditCard,
  Landmark,
  Shield,
  Coins,
  ExternalLink,
  Trash2,
  Scale,
  FileCheck2,
  CheckCircle2,
  TrendingUp,
  Eye,
  EyeOff,
  ChevronRight,
  UploadCloud,
  QrCode,
  Barcode,
  Banknote,
  Settings,
  Sparkles,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { flowRoutes } from "./utils/flowRoutes";

interface CaseFinancial {
  id?: string;
  caseId: string;
  clientId: string;
  clientSlug: string;

  chargeType: string;
  totalAmount: number;
  paymentMethod: string;
  installments: number;
  firstDueDate: string;
  financialStatus:
    | "pendente"
    | "aguardando_pagamento"
    | "pago"
    | "parcialmente_pago"
    | "em_atraso"
    | "cancelado"
    | "renegociado"
    | "aguardando_webhook"
    | "erro_webhook";
  visibleToClient: boolean;
  publicFinancialMessage?: string;

  contractLinked: boolean;
  contractName: string;
  contractUrl: string;
  contractVisibleToClient: boolean;

  paymentProvider: "manual_temporario" | "stripe" | "asaas";
  paymentStatus: string;
  paymentLink: string;
  externalPaymentId: string;
  webhookStatus: string;
  lastWebhookAt: string;

  stripeCustomerId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string;

  asaasCustomerId: string;
  asaasPaymentId: string;

  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const GoogleDriveIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 87.3 78"
    width={size}
    height={size}
    className={className}
  >
    <path
      fill="#0066da"
      d="m6.6 66.85 15.4-26.65c.9-1.6 2.6-2.6 4.4-2.6h45.5l-15.4 26.65c-.9 1.6-2.6 2.6-4.4 2.6H11c-1.8 0-3.5-1-4.4-2.65Z"
    />
    <path
      fill="#00a852"
      d="m56.5 40.2 15.4 26.65c.9 1.6.9 3.6 0 5.2s-2.6 2.6-4.4 2.6H22l15.4-26.65c.9-1.6 2.6-2.6 4.4-2.6h10.3c1.8 0 3.5 1 4.4 2.6Z"
    />
    <path
      fill="#ffcc00"
      d="m1.25 15.6 15.4-26.65C17.55-12.65 19.25-13.6 21-13.6h30.8L36.4 13c-.9 1.6-2.6 2.6-4.4 2.6H5.65c-1.8 0-3.5-1-4.4-2.65c-.9-1.55-.9-3.55 0-5.15"
      transform="matrix(-1 0 0 1 54.3 54)"
    />
  </svg>
);

export function resolveTipoServicoContratado(caseObj: any) {
  if (!caseObj) {
    return { value: "", sourcePath: "empty", usedLegacyFallback: false };
  }
  if (caseObj.tipoServicoContratado && caseObj.tipoServicoContratado.trim() !== "") {
    return { value: caseObj.tipoServicoContratado.trim(), sourcePath: "caseObj.tipoServicoContratado", usedLegacyFallback: false };
  }
  if (caseObj.financeiro?.tipoServicoContratado && caseObj.financeiro.tipoServicoContratado.trim() !== "") {
    return { value: caseObj.financeiro.tipoServicoContratado.trim(), sourcePath: "caseObj.financeiro.tipoServicoContratado", usedLegacyFallback: false };
  }
  if (caseObj.contractedServiceType && caseObj.contractedServiceType.trim() !== "") {
    return { value: caseObj.contractedServiceType.trim(), sourcePath: "caseObj.contractedServiceType", usedLegacyFallback: false };
  }
  if (caseObj.financeiro?.contractedServiceType && caseObj.financeiro.contractedServiceType.trim() !== "") {
    return { value: caseObj.financeiro.contractedServiceType.trim(), sourcePath: "caseObj.financeiro.contractedServiceType", usedLegacyFallback: false };
  }
  if (caseObj.tipoServico && caseObj.tipoServico.trim() !== "") {
    return { value: caseObj.tipoServico.trim(), sourcePath: "caseObj.tipoServico", usedLegacyFallback: false };
  }
  if (caseObj.assunto && caseObj.assunto.trim() !== "") {
    return { value: caseObj.assunto.trim(), sourcePath: "caseObj.assunto", usedLegacyFallback: true };
  }
  return { value: "", sourcePath: "not_found", usedLegacyFallback: false };
}

export default function FinanceiroFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { googleAccessToken, loginWithGoogle, profile, user } = useAuth();

  const [showApprovalConfirmation, setShowApprovalConfirmation] = useState(false);

  // Screen-level loading/saving state
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isRenewingGoogle, setIsRenewingGoogle] = useState(false);
  const [showContratoIntegrationConfig, setShowContratoIntegrationConfig] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [integrationJobs, setIntegrationJobs] = useState<any[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<Record<string, 'logs' | 'payload'>>({});
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedTechText, setCopiedTechText] = useState(false);

  // States for Audit Preview of Contract
  const [previewStatus, setPreviewStatus] = useState<'preview_not_started' | 'preview_loading' | 'preview_success' | 'preview_success_with_warnings' | 'preview_failed'>('preview_not_started');
  const [previewLogs, setPreviewLogs] = useState<any[]>([]);
  const [placeholderResolutionLogs, setPlaceholderResolutionLogs] = useState<any[]>([]);
  const [previewPayloadRaw, setPreviewPayloadRaw] = useState<any>(null);
  const [previewPayloadNormalized, setPreviewPayloadNormalized] = useState<any>(null);
  const [previewContractText, setPreviewContractText] = useState<string>("");
  const [lastTechnicalError, setLastTechnicalError] = useState<string | null>(null);
  const [lastFriendlyError, setLastFriendlyError] = useState<string | null>(null);
  const [copiedPayloadBruto, setCopiedPayloadBruto] = useState<boolean>(false);
  const [copiedPayloadNorm, setCopiedPayloadNorm] = useState<boolean>(false);
  const [copiedLogsText, setCopiedLogsText] = useState<boolean>(false);

  const [isContractPreviewExpanded, setIsContractPreviewExpanded] = useState<boolean>(false);
  const [isContractPreviewLogsExpanded, setIsContractPreviewLogsExpanded] = useState<boolean>(false);
  const [previewGoogleDocsId, setPreviewGoogleDocsId] = useState<string>("");
  const [previewGoogleDocsUrl, setPreviewGoogleDocsUrl] = useState<string>("");

  const [isBattleNavalOpen, setIsBattleNavalOpen] = useState<boolean>(false);
  const [battleNavalData, setBattleNavalData] = useState<any>(null);
  const [battleNavalLoading, setBattleNavalLoading] = useState<boolean>(false);
  const [battleSearchQuery, setBattleSearchQuery] = useState<string>("");
  const [battleStatusFilter, setBattleStatusFilter] = useState<"all" | "success" | "failed">("all");

  const handleOpenBattleNaval = async () => {
    setIsBattleNavalOpen(true);
    setBattleNavalLoading(true);
    try {
      const currentFinancialForm = {
        tipoServicoContratado: tipoServicoContratadoForm,
        tipoHonorario: tipoHonorarioForm,
        honorarioExitoPercentual: honorarioExitoPercentualForm,
        honorarioFixoValor: honorarioFixoValorForm,
        formaPagamento: formaPagamentoForm,
        tipoRecebimento: tipoRecebimentoForm,
        pixBanco: pixBancoForm,
        pixChave: pixChaveForm,
        quantidadeParcelas: quantidadeParcelasForm,
        valorParcela: valorParcelaForm,
        diaVencimento: diaVencimentoForm,
        valorEntrada: valorEntradaForm,
        dataPrimeiroVencimento: dataPrimeiroVencimentoADefinir ? "a definir" : dataPrimeiroVencimentoForm,
        modeloHonorarios: modeloHonorariosForm,
        categoriaExito: categoriaExitoForm,
        classeExito: classeExitoForm,
        percentualExito: percentualExitoForm,
        percentualExitoSobreRetroativo: percentualExitoSobreRetroativoForm,
        quantidadeParcelasExitoPrevidenciario: quantidadeParcelasExitoPrevidenciarioForm,
        clausulas: caseObj?.financeiro?.clausulas || "",
        cobrancaAutomaticaInteg: cobrancaAutomaticaIntegForm
      };

      const response = await fetch("/api/google-docs/contrato-honorarios/batalha-naval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          clientId: client?.id || caseObj?.clientId || "",
          documentType: client?.type === "PF" ? "contrato_honorarios_pf" : "contrato_honorarios_pj",
          currentFinancialState: currentFinancialForm
        })
      });

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch {
        resData = { success: false, errorMessage: resText };
      }

      if (!response.ok || !resData.success) {
        throw new Error(resData.errorMessage || "Falha ao carregar diagnóstico da Batalha Naval.");
      }

      setBattleNavalData(resData);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao executar diagnóstico: " + err.message);
    } finally {
      setBattleNavalLoading(false);
    }
  };

  const maskSensitiveData = (key: string, value: string): string => {
    if (!value) return "";
    const cleaned = value.trim();
    if (key.includes("CPF")) {
      if (cleaned.length >= 11) {
        return `***.${cleaned.substring(4, 11)}-**`;
      }
      return `***.${cleaned}-**`;
    }
    if (key.includes("RG")) {
      if (cleaned.length >= 6) {
        return `**${cleaned.substring(2, cleaned.length - 2)}**`;
      }
      return `**${cleaned}**`;
    }
    if (key.includes("TELEFONE") || key.includes("WHATSAPP")) {
      if (cleaned.length >= 8) {
        return `(***) ****-${cleaned.substring(cleaned.length - 4)}`;
      }
      return `(***) ****-${cleaned}`;
    }
    if (key.includes("EMAIL")) {
      const parts = cleaned.split("@");
      if (parts.length === 2) {
        const name = parts[0];
        const domain = parts[1];
        const maskedName = name.length > 2 ? `${name[0]}*****${name[name.length - 1]}` : "*****";
        return `${maskedName}@${domain}`;
      }
      return "*****";
    }
    if (key.includes("CNPJ")) {
      if (cleaned.length >= 14) {
        return `**..***/****-**`;
      }
      return `**..**/**`;
    }
    return value;
  };

  const handleExecutePreview = async () => {
    setPreviewStatus('preview_loading');
    setPreviewGoogleDocsId("");
    setPreviewGoogleDocsUrl("");
    setPlaceholderResolutionLogs([]);
    setIsContractPreviewExpanded(false);

    try {
      if (!caseObj) {
        throw new Error("Dados do caso (caseObj) não foram carregados corretamente do banco de dados.");
      }
      if (!client) {
        throw new Error("Dados cadastrais do cliente não foram carregados do banco de dados.");
      }

      // Collect current form states of financial tab
      const currentFinancialForm = {
        tipoServicoContratado: tipoServicoContratadoForm,
        tipoHonorario: tipoHonorarioForm,
        honorarioExitoPercentual: honorarioExitoPercentualForm,
        honorarioFixoValor: honorarioFixoValorForm,
        formaPagamento: formaPagamentoForm,
        tipoRecebimento: tipoRecebimentoForm,
        pixBanco: pixBancoForm,
        pixChave: pixChaveForm,
        quantidadeParcelas: quantidadeParcelasForm,
        valorParcela: valorParcelaForm,
        diaVencimento: diaVencimentoForm,
        valorEntrada: valorEntradaForm,
        dataPrimeiroVencimento: dataPrimeiroVencimentoADefinir ? "a definir" : dataPrimeiroVencimentoForm,
        modeloHonorarios: modeloHonorariosForm,
        categoriaExito: categoriaExitoForm,
        classeExito: classeExitoForm,
        percentualExito: percentualExitoForm,
        percentualExitoSobreRetroativo: percentualExitoSobreRetroativoForm,
        quantidadeParcelasExitoPrevidenciario: quantidadeParcelasExitoPrevidenciarioForm,
        clausulas: caseObj?.financeiro?.clausulas || "",
        cobrancaAutomaticaInteg: cobrancaAutomaticaIntegForm
      };

      const response = await fetch("/api/google-docs/contrato-honorarios/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          clientId: client.id || caseObj.clientId || "",
          documentType: client.type === "PF" ? "contrato_honorarios_pf" : "contrato_honorarios_pj",
          currentFinancialState: currentFinancialForm
        })
      });

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch {
        resData = { success: false, errorMessage: resText };
      }

      if (!response.ok || !resData.success) {
        throw new Error(resData.errorMessage || "Falha ao gerar o preview do contrato.");
      }

      // Store results
      setPreviewContractText(resData.renderedContent || "");
      
      // Map placeholder resolution logs from Battle Map row results
      const auditRows = resData.placeholderAudit?.rows || [];
      const resolutionLogs = auditRows.map((row: any) => ({
        placeholder: row.placeholder,
        status: row.replacementStatus === "success" ? "success" : "warning",
        sourceField: row.sourceField,
        receivedValue: row.migratedValueMasked,
        finalValue: row.replacementStatus === "success" ? row.previewValue : `[NÃO PREENCHIDO: ${row.placeholder}]`,
        reason: row.naturalLanguageMessage
      }));

      setPlaceholderResolutionLogs(resolutionLogs);

      const hasFailures = auditRows.some((row: any) => row.replacementStatus === "failed");
      if (hasFailures) {
        setPreviewStatus('preview_success_with_warnings');
        const failedPhs = auditRows.filter((r: any) => r.replacementStatus === "failed").map((r: any) => r.placeholder);
        setLastFriendlyError(`Alguns campos de cadastro estão vazios ou não foram encontrados no documento: ${failedPhs.join(", ")}`);
      } else {
        setPreviewStatus('preview_success');
        setLastFriendlyError(null);
      }

      // Keep closed by default per permanent technical tray guidelines
      setIsContractPreviewExpanded(false);
      setLastTechnicalError(null);

    } catch (err: any) {
      console.error(err);
      setPreviewStatus('preview_failed');
      setLastTechnicalError(err.stack || err.message || "Erro desconhecido");
      setLastFriendlyError(err.message || "Falha na geração integrada do preview.");
    }
  };

  const handleClearPreviewLogs = () => {
    setPreviewStatus('preview_not_started');
    setPreviewLogs([]);
    setPlaceholderResolutionLogs([]);
    setPreviewPayloadRaw(null);
    setPreviewPayloadNormalized(null);
    setPreviewContractText("");
    setPreviewGoogleDocsId("");
    setPreviewGoogleDocsUrl("");
    setIsContractPreviewExpanded(false);
    setLastTechnicalError(null);
    setLastFriendlyError(null);
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyTechnicalDetails = () => {
    const techCode = caseObj?.contratoHonorariosStatus === 'criada'
      ? (caseObj?.contratoHonorariosLastOutcome || "SUCCESS")
      : (caseObj?.contratoHonorariosLastErrorCode || "GENERATION_FAILED");
    const techTimestamp = caseObj?.contratoHonorariosLastOperationAt || caseObj?.contratoHonorariosGeneratedAt || caseObj?.updatedAt || "";
    const techDocId = caseObj?.contratoHonorariosGoogleDocsId || caseObj?.contratoHonorariosId || "";
    const techDocVer = caseObj?.contratoHonorariosVersion || 1;
    const rawLogs = caseObj?.contratoHonorariosTechnicalLog || caseObj?.contratoHonorariosGoogleDocsJobLogs || [];
    
    const details = {
      status_tecnico: caseObj?.contratoHonorariosStatus || "N/A",
      codigo_status: techCode,
      executado_em: techTimestamp ? new Date(techTimestamp).toLocaleString() : "N/A",
      documento_id: techDocId,
      versao_documento: techDocVer,
      erro_mensagem: caseObj?.contratoHonorariosLogFalha || null,
      quantidade_eventos_ultima_tentativa: rawLogs.length,
      quantidade_tentativas_historico: integrationJobs.length,
      logs_ultima_tentativa: rawLogs
    };

    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedTechText(true);
    setTimeout(() => setCopiedTechText(false), 2000);
  };

  const handleRenewGoogle = async () => {
    setIsRenewingGoogle(true);
    try {
      await loginWithGoogle('boss_admin');
      setSuccess("Autenticação Google renovada com sucesso! Você já pode gerar o contrato de honorários novamente.");
      setRefreshToggle(prev => prev + 1);
    } catch (err: any) {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        setError("Falha ao renovar autenticação: Popups de login do Google são bloqueados pelo navegador dentro de Iframes de visualização. Por favor, clique em 'Abrir em Nova Aba' no menu do AI Studio (topo direito) para renovar seu acesso Google com sucesso!");
      } else {
        setError(`Falha ao renovar autenticação: ${err.message || err}`);
      }
    } finally {
      setIsRenewingGoogle(false);
    }
  };

  const handleApproveContrato = async () => {
    if (!caseId) return;
    try {
      setSaving(true);
      const nowISO = new Date().toISOString();
      const operatorName = profile?.name || user?.displayName || user?.email || "Operador";
      const currentHistory = caseObj?.contratoHonorariosHistory || [];
      const currentVer = caseObj?.contratoHonorariosVersion || 1;
      
      const newRecord = {
        type: "approve",
        timestamp: nowISO,
        user: operatorName,
        version: currentVer,
        description: "Contrato homologado e aprovado como definitivo"
      };

      const updatedHistory = [...currentHistory, newRecord];

      await updateDoc(doc(db, "cases", caseId), {
        contratoHonorariosAprovadoStatus: "approved",
        contratoHonorariosAprovadoBy: operatorName,
        contratoHonorariosAprovadoAt: nowISO,
        contratoHonorariosHistory: updatedHistory,
        updatedAt: nowISO
      });

      setShowApprovalConfirmation(false);
      setSuccess("Contrato aprovado e homologado como definitivo!");
      setRefreshToggle((p) => p + 1);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao aprovar contrato: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRevertApproveContrato = async () => {
    if (!caseId) return;
    try {
      setSaving(true);
      const nowISO = new Date().toISOString();
      const operatorName = profile?.name || user?.displayName || user?.email || "Operador";
      const currentHistory = caseObj?.contratoHonorariosHistory || [];
      const currentVer = caseObj?.contratoHonorariosVersion || 1;
      
      const newRecord = {
        type: "revert",
        timestamp: nowISO,
        user: operatorName,
        version: currentVer,
        description: "Homologação cancelada, contrato retornado para rascunho"
      };

      const updatedHistory = [...currentHistory, newRecord];

      await updateDoc(doc(db, "cases", caseId), {
        contratoHonorariosAprovadoStatus: "draft",
        contratoHonorariosAprovadoBy: "",
        contratoHonorariosAprovadoAt: "",
        contratoHonorariosHistory: updatedHistory,
        updatedAt: nowISO
      });

      setSuccess("Contrato retornado para rascunho com sucesso.");
      setRefreshToggle((p) => p + 1);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao reverter aprovação do contrato: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Loaded database references
  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [financials, setFinancials] = useState<CaseFinancial[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Installment Analytical Table states
  const [tabelaAnalitica, setTabelaAnalitica] = useState<any[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowVal, setEditingRowVal] = useState("");
  const [editingRowDate, setEditingRowDate] = useState("");
  const [editingRowPago, setEditingRowPago] = useState(false);
  const [editingRowStatus, setEditingRowStatus] = useState<"pago" | "pendente" | "atrasado">("pendente");
  const [editingRowForma, setEditingRowForma] = useState("");

  const handleSaveTabelaAnalitica = async (novaTabela: any[]) => {
    try {
      const caseDocRef = doc(db, "cases", caseId!);
      await updateDoc(caseDocRef, {
        tabelaAnalitica: novaTabela,
        updatedAt: new Date().toISOString(),
      });
      setTabelaAnalitica(novaTabela);
      setSuccess("Tabela analítica de honorários salva com sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar tabela analítica: ${err.message || err}`);
    }
  };

  const handleGerarTabelaAutomatica = async () => {
    const list: any[] = [];
    let currentId = 1;

    // 1. Generate Fixo portions (for fixo and combined types)
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

    // 2. Generate Exito/Labor/Previdenciario portions (for exito models)
    if (modeloHonorariosForm === "exito_simples" || modeloHonorariosForm === "fixo_mais_exito_simples") {
      list.push({
        id: String(currentId++),
        numero: "Honorários Êxito Simples Estimado",
        valor: `R$ 1.500,00`, // place holder or calculate if has baseCalculo
        dataVencimento: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split("T")[0],
        pago: false,
        status: "pendente",
        formaRecebimento: "Alvará / Pix"
      });
    } else if (modeloHonorariosForm === "exito_completo_trabalhista" || modeloHonorariosForm === "fixo_mais_exito_completo_trabalhista") {
      // Add split rows based on apuracaoTrabalhistaState or default estimates
      const hContratuais = financeiroRateioState?.totalHonorariosContratuais || "0,00";
      const hSucumbenciais = financeiroRateioState?.totalHonorariosSucumbenciais || "0,00";
      const lCliente = financeiroRateioState?.totalCliente || "0,00";

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
        formaRecebimento: "Alvará Judicial"
      });

      list.push({
        id: String(currentId++),
        numero: "Repasse Líquido ao Cliente",
        valor: lCliente !== "0,00" && lCliente !== "NaN" ? `R$ ${lCliente}` : `R$ 10.500,00 (Estimativo)`,
        dataVencimento: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split("T")[0],
        pago: false,
        status: "pendente",
        formaRecebimento: "Repasse por Pix"
      });
    } else if (modeloHonorariosForm === "exito_completo_previdenciario" || modeloHonorariosForm === "fixo_mais_exito_completo_previdenciario") {
      const hRetroativo = financeiroApuracaoPrevidenciariaState?.valorHonorariosRetroativo || "0,00";
      
      list.push({
        id: String(currentId++),
        numero: "Honorários sobre Retroativo",
        valor: hRetroativo !== "0,00" && hRetroativo !== "NaN" ? `R$ ${hRetroativo}` : "R$ 3.000,00 (Estimativo)",
        dataVencimento: new Date(Date.now() + 150 * 24 * 3600 * 1000).toISOString().split("T")[0],
        pago: false,
        status: "pendente",
        formaRecebimento: "Precatório / RPV"
      });

      const limitPrevidenciarioFuturo = Math.max(0, Number(quantidadeParcelasExitoPrevidenciarioForm) || 0);
      const prcPrevVal = financeiroApuracaoPrevidenciariaState?.valorBeneficioMensal || "0,00";
      
      for (let j = 0; j < limitPrevidenciarioFuturo; j++) {
        list.push({
          id: String(currentId++),
          numero: `Honorários Parc. Benefício ${j + 1}/${limitPrevidenciarioFuturo}`,
          valor: prcPrevVal !== "0,00" && prcPrevVal !== "NaN" ? `R$ ${prcPrevVal}` : "R$ 1.412,00 (Estimativo)",
          dataVencimento: new Date(Date.now() + (180 + j * 30) * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Boleto / Pix"
        });
      }
    }

    await handleSaveTabelaAnalitica(list);
    
    // Set sync confirmation in cases
    try {
      const caseDocRef = doc(db, "cases", caseId!);
      await updateDoc(caseDocRef, {
        financeiroUltimaSincronizacaoSubetapa01: modeloHonorariosForm || "fixo",
        updatedAt: new Date().toISOString()
      });
      setSuccess("SubEtapas sincronizadas com êxito!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error("Error saving sync timestamp:", e);
    }
  };

  const handleUpdateApuracaoTrabalhista = (field: string, val: any) => {
    setFinanceiroApuracaoTrabalhista((prev: any) => {
      const next = { ...prev, [field]: val };
      
      // Auto-compute rateio live based on the new values!
      const creditoL = parseFloat((next.creditoLiquido || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
      const pctExitoVal = parseFloat((percentualExitoForm || "30").replace("%", "").trim()) / 100 || 0.3;
      const honorariosContratuais = creditoL * pctExitoVal;
      
      const vSucumbencia = next.houveSucumbencia === "sim"
        ? (parseFloat((next.valorSucumbencia || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0)
        : 0;
        
      const totalAdv = honorariosContratuais + vSucumbencia;
      const totalCli = creditoL - honorariosContratuais;
      
      // Update our rateio preview state live!
      setFinanceiroRateio({
        totalAdvogado: totalAdv.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalHonorariosContratuais: honorariosContratuais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalHonorariosSucumbenciais: vSucumbencia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalCliente: totalCli.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      });
      
      return next;
    });
  };

  const handleUpdateApuracaoPrevidenciaria = (field: string, val: any) => {
    setFinanceiroApuracaoPrevidenciaria((prev: any) => {
      const next = { ...prev, [field]: val };
      
      // Auto-compute previdenciario rateio live!
      const rRetro = parseFloat((next.valorRetroativo || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
      const rBenef = parseFloat((next.valorBeneficioMensal || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
      const pctRetroVal = parseFloat((percentualExitoSobreRetroativoForm || "30").replace("%", "").trim()) / 100 || 0.3;
      const qtyFut = Math.max(0, Number(quantidadeParcelasExitoPrevidenciarioForm) || 0);
      
      const hRetro = rRetro * pctRetroVal;
      const hFut = rBenef * qtyFut;
      
      const totalAdv = hRetro + hFut;
      const totalCli = rRetro - hRetro;
      
      setFinanceiroRateio({
        totalAdvogado: totalAdv.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalHonorariosContratuais: hRetro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalHonorariosSucumbenciais: "0,00",
        totalCliente: totalCli.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        valorHonorariosRetroativo: hRetro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        valorHonorariosParcelasFuturas: hFut.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      });
      
      return next;
    });
  };

  const handleSaveApuracaoTrabalhistaToDb = async () => {
    try {
      setError(null);
      setSuccess(null);
      const caseDocRef = doc(db, "cases", caseId!);
      await updateDoc(caseDocRef, {
        financeiroApuracaoTrabalhista: financeiroApuracaoTrabalhistaState,
        financeiroRateio: financeiroRateioState,
        updatedAt: new Date().toISOString()
      });
      setSuccess("Apuração trabalhista gravada com sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao gravar apuração trabalhista: " + (err.message || err));
    }
  };

  const handleSaveApuracaoPrevidenciariaToDb = async () => {
    try {
      setError(null);
      setSuccess(null);
      const caseDocRef = doc(db, "cases", caseId!);
      await updateDoc(caseDocRef, {
        financeiroApuracaoPrevidenciaria: financeiroApuracaoPrevidenciariaState,
        financeiroRateio: financeiroRateioState,
        updatedAt: new Date().toISOString()
      });
      setSuccess("Apuração previdenciária gravada com sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao gravar apuração previdenciária: " + (err.message || err));
    }
  };

  const handleUpdateDetalhamento = (key: string, value: any) => {
    setFinanceiroDetalhamento((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSubStep2ToDb = async () => {
    try {
      setError(null);
      setSuccess(null);
      setSaving(true);
      const caseDocRef = doc(db, "cases", caseId!);
      await updateDoc(caseDocRef, {
        formaPagamento: formaPagamentoForm,
        tipoRecebimento: tipoRecebimentoForm,
        quantidadeParcelas: Number(quantidadeParcelasForm) || 1,
        valorParcela: valorParcelaForm,
        valorEntrada: valorEntradaForm,
        dataPrimeiroVencimento: dataPrimeiroVencimentoADefinir ? "a definir" : dataPrimeiroVencimentoForm,
        dataPrimeiroVencimentoADefinir: dataPrimeiroVencimentoADefinir,
        financeiroDetalhamento: financeiroDetalhamentoState || {},
        updatedAt: new Date().toISOString()
      });
      setSuccess("Alterações do contrato salvas com sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar alterações da SubEtapa 02: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddParcelaManual = async () => {
    const nextId = String(Date.now());
    const novaParcela = {
      id: nextId,
      numero: `Parcela ${tabelaAnalitica.length + 1}`,
      valor: valorParcelaForm !== "0,00" ? `R$ ${valorParcelaForm}` : "R$ 1.500,00",
      dataVencimento: new Date().toISOString().split("T")[0],
      pago: false,
      status: "pendente",
      formaRecebimento: tipoRecebimentoForm || "PIX"
    };
    const novaTabela = [...tabelaAnalitica, novaParcela];
    await handleSaveTabelaAnalitica(novaTabela);
  };

  const handleDeletarParcela = async (idOfDeleted: string) => {
    const novaTabela = tabelaAnalitica.filter(item => item.id !== idOfDeleted);
    await handleSaveTabelaAnalitica(novaTabela);
  };

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null); // null means "New Financial Record"
  const [formChargeType, setFormChargeType] = useState("Honorários fixos");
  const [customChargeType, setCustomChargeType] = useState("");
  const [formTotalAmount, setFormTotalAmount] = useState<string>("0");
  const [formPaymentMethod, setFormPaymentMethod] =
    useState("Cartão de Crédito");
  const [formInstallments, setFormInstallments] = useState<number>(1);
  const [formFirstDueDate, setFormFirstDueDate] = useState("");
  const [formFinancialStatus, setFormFinancialStatus] = useState<
    CaseFinancial["financialStatus"]
  >("aguardando_pagamento");
  const [formVisibleToClient, setFormVisibleToClient] = useState(true);
  const [formPublicMessage, setFormPublicMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteFinancial = async (id: string) => {
    if (!id) return;
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 4000);
      return;
    }
    setError(null);
    setSuccess(null);
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, "caseFinancials", id));
      setSuccess("Lançamento financeiro deletado permanentemente!");
      setRefreshToggle((prev) => prev + 1);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao excluir faturamento: ${err.message || err}`);
    }
  };

  // Contract referencing
  const [formContractLinked, setFormContractLinked] = useState(false);
  const [formContractName, setFormContractName] = useState(
    "Contrato de Prestação de Serviços Jurídicos",
  );
  const [formContractUrl, setFormContractUrl] = useState("");
  const [formContractVisible, setFormContractVisible] = useState(true);

  // Integrations parameterization
  const [formPaymentProvider, setFormPaymentProvider] =
    useState<CaseFinancial["paymentProvider"]>("manual_temporario");
  const [formPaymentStatus, setFormPaymentStatus] = useState("");
  const [formPaymentLink, setFormPaymentLink] = useState("");
  const [formExternalPaymentId, setFormExternalPaymentId] = useState("");
  const [formWebhookStatus, setFormWebhookStatus] = useState("");
  const [formLastWebhookAt, setFormLastWebhookAt] = useState("");

  // Stripe explicit placeholders
  const [formStripeCustomerId, setFormStripeCustomerId] = useState("");
  const [formStripeCheckoutId, setFormStripeCheckoutId] = useState("");
  const [formStripeIntentId, setFormStripeIntentId] = useState("");

  // Asaas explicit placeholders
  const [formAsaasCustomerId, setFormAsaasCustomerId] = useState("");
  const [formAsaasPaymentId, setFormAsaasPaymentId] = useState("");

  const [formNotes, setFormNotes] = useState("");

  // Sinc refresh trigger
  const [refreshToggle, setRefreshToggle] = useState(0);

  // SubEtapa active controller
  const [activeSubStep, setActiveSubStep] = useState<1 | 2 | 3>(1);

  // Sync activeSubStep with pathname routing
  useEffect(() => {
    const decodedPath = decodeURIComponent(pathname);
    if (
      decodedPath.endsWith("/financeiro/Criar Contrato de Honorários") ||
      decodedPath.endsWith("/financeiro/Criar Contrato de Honorários/")
    ) {
      setActiveSubStep(1);
    } else if (
      decodedPath.endsWith("/financeiro/ver.detalhes.do.contrato.de.honorarios") ||
      decodedPath.endsWith("/financeiro/ver.detalhes.do.contrato.de.honorarios/")
    ) {
      setActiveSubStep(2);
    } else if (
      decodedPath.endsWith("/financeiro/auditoria.do.contrato.de.honorarios") ||
      decodedPath.endsWith("/financeiro/auditoria.do.contrato.de.honorarios/")
    ) {
      setActiveSubStep(3);
    } else if (decodedPath.endsWith("/financeiro") || decodedPath.endsWith("/financeiro/")) {
      setActiveSubStep(1);
      navigate(
        `/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/Criar Contrato de Honorários`,
        { replace: true }
      );
    }
  }, [pathname, caseId, navigate]);

  // Step 3 Contract state integration
  const [wizardState, setWizardState] = useState<any>({
    currentStep: 1,
    q1_1: "nao",
    q1_2: [],
    q1_2_outro: "",
    q1_3: "nao",
    q1_4: "nao",
    q1_5: "nao",
    q1_6: "nao",
    procuracaoFiles: [],
    q2_1: "nao",
    q2_2: "nao",
    q2_3: [],
    q2_3_outro: "",
    q2_4: "nao",
    q2_5: "nao",
    q2_6: "nao",
    q2_7: "nao",
    declaracaoFiles: [],
    q3_1: "nao",
    q3_2: "",
    q3_2_outro: "",
    q3_3: [],
    q3_3_outro: "",
    q3_4: "nao",
    q3_5: "nao",
    q3_6: "nao",
    q3_7: "nao",
    q3_8: "nao",
    contratoFiles: [],
    q4_rg: "",
    q4_cpf: "",
    q4_residencia: "",
    q4_anexar_pf: "",
    rgFiles: [],
    cpfFiles: [],
    residenciaFiles: [],
    q4_cnpj: "",
    q4_contrato_social: "",
    q4_endereco_sede: "",
    q4_rg_socio: "",
    q4_cpf_socio: "",
    q4_residencia_socio: "",
    q4_anexar_pj: "",
    cnpjFiles: [],
    contratoSocialFiles: [],
    enderecoSedeFiles: [],
    rgSocioFiles: [],
    cpfSocioFiles: [],
    residenciaSocioFiles: [],
    q5_1: "",
    q5_provas: {},
    q5_y_pendentes: "",
    q5_z_solicitacao_automatica: "",
    q5_z_channels: [],
    q6_7_1: "",
    q6_7_2: "",
    q6_7_3: "",
    q6_7_4: "",
    q6_8_channels: [],
    step1_completed: false,
    step2_completed: false,
    step3_completed: false,
    step4_completed: false,
    step5_completed: false,
    step6_completed: false,
  });
  const [contractPanelOpen, setContractPanelOpen] = useState(true);

  const saveWizardStateUpdate = async (updates: any) => {
    const nextState = { ...wizardState, ...updates };
    setWizardState(nextState);
    try {
      await updateDoc(doc(db, "cases", caseId!), {
        solicitacoesProvasWizardState: nextState,
        contratoHonorariosStatus:
          nextState.q3_4 === "sim" ? "criada" : "pendente",
      });
      setSuccess("Estado do contrato atualizado com sucesso!");
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      console.error("Error saving contract wizard state in finance:", err);
    }
  };

  const addWizardFile = (field: string, name: string, size: string) => {
    const currentFiles = wizardState[field] || [];
    const updatedFiles = [
      ...currentFiles,
      { name, size, uploadedAt: new Date().toISOString() },
    ];
    saveWizardStateUpdate({ [field]: updatedFiles });
  };

  const removeWizardFile = (field: string, index: number) => {
    const currentFiles = wizardState[field] || [];
    const updatedFiles = currentFiles.filter(
      (_: any, i: number) => i !== index,
    );
    saveWizardStateUpdate({ [field]: updatedFiles });
  };

  const [tipoServicoContratado, setTipoServicoContratado] = useState("");
  const [honorariosPercentual, setHonorariosPercentual] = useState("");
  const [honorariosValorFixo, setHonorariosValorFixo] = useState("");
  const [bancoRecebimento, setBancoRecebimento] = useState("");
  const [agenciaRecebimento, setAgenciaRecebimento] = useState("");
  const [contaRecebimento, setContaRecebimento] = useState("");
  const [pixRecebimento, setPixRecebimento] = useState("");

  // 12 Unified Financial Fields
  const [tipoServicoContratadoForm, setTipoServicoContratadoForm] =
    useState("");
  const [tipoHonorarioForm, setTipoHonorarioForm] =
    useState("Honorários Fixos");
  const [honorarioExitoPercentualForm, setHonorarioExitoPercentualForm] =
    useState("30%");
  const [honorarioFixoValorForm, setHonorarioFixoValorForm] = useState("0,00");
  const [formaPagamentoForm, setFormaPagamentoForm] = useState("À vista");
  const [tipoRecebimentoForm, setTipoRecebimentoForm] = useState("PIX");
  const [pixBancoForm, setPixBancoForm] = useState("Nubank");
  const [pixChaveForm, setPixChaveForm] = useState("");
  const [quantidadeParcelasForm, setQuantidadeParcelasForm] = useState(1);
  const [valorParcelaForm, setValorParcelaForm] = useState("0,00");
  const [diaVencimentoForm, setDiaVencimentoForm] = useState("10");
  const [valorEntradaForm, setValorEntradaForm] = useState("0,00");
  const [dataPrimeiroVencimentoForm, setDataPrimeiroVencimentoForm] =
    useState("");
  const [dataPrimeiroVencimentoADefinir, setDataPrimeiroVencimentoADefinir] = useState<boolean>(false);
  const [cobrancaAutomaticaIntegForm, setCobrancaAutomaticaIntegForm] =
    useState("Não");

  // 15 Brand New Dynamic Financial Fields
  const [modeloHonorariosForm, setModeloHonorariosForm] = useState<string>("fixo");
  const [categoriaExitoForm, setCategoriaExitoForm] = useState<string>("");
  const [classeExitoForm, setClasseExitoForm] = useState<string>("");
  const [percentualExitoForm, setPercentualExitoForm] = useState<string>("30%");
  const [percentualExitoSobreRetroativoForm, setPercentualExitoSobreRetroativoForm] = useState<string>("30%");
  const [quantidadeParcelasExitoPrevidenciarioForm, setQuantidadeParcelasExitoPrevidenciarioForm] = useState<number>(0);
  const [baseCalculoExitoForm, setBaseCalculoExitoForm] = useState<string>("Proveito Econômico");

  // Dynamic conditional contract fields states
  const [dataVencimentoEntradaForm, setDataVencimentoEntradaForm] = useState<string>("");
  const [pagoNaAssinaturaForm, setPagoNaAssinaturaForm] = useState<boolean>(false);
  const [reclamanteVerbasRescisorias, setReclamanteVerbasRescisorias] = useState<boolean>(false);
  const [reclamanteFGTS, setReclamanteFGTS] = useState<boolean>(false);
  const [reclamanteFGTSIndep, setReclamanteFGTSIndep] = useState<boolean>(false);
  const [reclamanteMultaFGTS, setReclamanteMultaFGTS] = useState<boolean>(false);
  const [reclamanteMultaFGTSIndep, setReclamanteMultaFGTSIndep] = useState<boolean>(false);
  const [reclamanteSeguroDesemprego, setReclamanteSeguroDesemprego] = useState<boolean>(false);
  const [valorCausaReclamada, setValorCausaReclamada] = useState<string>("");
  const [servicosTemporariosList, setServicosTemporariosList] = useState<string[]>(["Auxílio Doença", "Auxílio reclusão", "Auxílio inclusão"]);
  const [servicosTemporariosSelected, setServicosTemporariosSelected] = useState<string>("Auxílio Doença");
  const [aposentadoriasList, setAposentadoriasList] = useState<string[]>([
    "Aposentadoria Por idade Urbana",
    "Aposentadoria por idade rural",
    "Aposentadoria Híbrida",
    "Aposentadoria por Invalidez",
    "Auxílio Acidente permanente",
    "BPC/LOAS Etário",
    "BPC/LOAS Doença",
    "Aposentadoria da Pessoa Com Deficiência"
  ]);
  const [aposentadoriasSelected, setAposentadoriasSelected] = useState<string>("Aposentadoria Por idade Urbana");
  const [customPrevidenciarioInput, setCustomPrevidenciarioInput] = useState<string>("");
  const [showCustomPrevidenciarioModal, setShowCustomPrevidenciarioModal] = useState<boolean>(false);

  // Meio de Pagamento new sub-states
  const [gerarReciboAutomaticoForm, setGerarReciboAutomaticoForm] = useState<boolean>(false);
  const [cartaoPorOndeForm, setCartaoPorOndeForm] = useState<string>("Infinitepay - Tap to pay");
  const [boletoPorOndeForm, setBoletoPorOndeForm] = useState<string>("ASAAS");
  const [comprovantesMeioPagamentoForm, setComprovantesMeioPagamentoForm] = useState<any[]>([]);

  const [financeiroDetalhamentoState, setFinanceiroDetalhamento] = useState<any>({});
  const [financeiroApuracaoTrabalhistaState, setFinanceiroApuracaoTrabalhista] = useState<any>({
    idHomologacaoCalculos: "",
    localSentencaHomologacao: "",
    creditoLiquido: "0,00",
    fgtsContaVinculada: "0,00",
    inssRecolhimento: "0,00",
    houveSucumbencia: "não",
    valorSucumbencia: "0,00",
    houveAcordo: "não",
    localAcordoProcesso: "",
    localDecisaoHomologatoriaAcordo: "",
    formaPagamentoAcordo: "Pix",
    valorTotalDepositoConta: "0,00",
    haveraAlvara: "não",
    valorAlvara: "0,00",
    quantidadeParcelasAcordo: 1,
    valorCadaParcela: "0,00",
    datasPagamentoParcelas: ""
  });
  const [financeiroApuracaoPrevidenciariaState, setFinanceiroApuracaoPrevidenciaria] = useState<any>({
    valorRetroativo: "0,00",
    valorBeneficioMensal: "0,00",
    valorHonorariosRetroativo: "0,00",
    valorHonorariosParcelasFuturas: "0,00"
  });
  const [financeiroRateioState, setFinanceiroRateio] = useState<any>({
    totalAdvogado: "0,00",
    totalHonorariosContratuais: "0,00",
    totalHonorariosSucumbenciais: "0,00",
    totalCliente: "0,00"
  });
  const [financeiroDadosBancariosClienteSnapshotState, setFinanceiroDadosBancariosClienteSnapshot] = useState<any>({});
  const [financeiroDadosBancariosAdvogadoState, setFinanceiroDadosBancariosAdvogado] = useState<any>({
    pix: "direito.rgr@gmail.com",
    banco: "Banco do Brasil",
    agencia: "0428-6",
    conta: "61.954-x",
    titular: "Rodrigo Giffoni Rodrigues"
  });
  const [financeiroTabelaAnaliticaVersionState, setFinanceiroTabelaAnaliticaVersion] = useState<string>("v1");
  const [valSImuladoExito, setValSimuladoExito] = useState<string>("50000");

  useEffect(() => {
    if (caseObj) {
      setTipoServicoContratadoForm(caseObj.assunto || "");
      setTipoHonorarioForm(caseObj.tipoHonorario || "Honorários Fixos");
      setHonorarioExitoPercentualForm(
        caseObj.honorarioExitoPercentual || "30%",
      );
      setHonorarioFixoValorForm(caseObj.honorarioFixoValor || "0,00");
      setFormaPagamentoForm(caseObj.formaPagamento || "À vista");
      setTipoRecebimentoForm(caseObj.tipoRecebimento || "PIX");
      setPixBancoForm(
        caseObj.pixBanco || client?.bancario_bancoPix || "Nubank",
      );
      setPixChaveForm(caseObj.pixChave || client?.bancario_chavePix || "");
      setQuantidadeParcelasForm(Number(caseObj.quantidadeParcelas) || 1);
      setValorParcelaForm(caseObj.valorParcela || "0,00");
      setDiaVencimentoForm(caseObj.diaVencimento || "10");
      setValorEntradaForm(caseObj.valorEntrada || "0,00");
      const rawDPV = caseObj.dataPrimeiroVencimento || "";
      setDataPrimeiroVencimentoForm(rawDPV === "a definir" ? "" : rawDPV);
      setDataPrimeiroVencimentoADefinir(caseObj.dataPrimeiroVencimentoADefinir === true || rawDPV === "a definir");
      setCobrancaAutomaticaIntegForm(caseObj.cobrancaAutomaticaInteg || "Não");

      // Load new fields
      setModeloHonorariosForm(caseObj.modeloHonorarios || "fixo");
      setCategoriaExitoForm(caseObj.categoriaExito || "");
      setClasseExitoForm(caseObj.classeExito || "");
      setPercentualExitoForm(caseObj.percentualExito || caseObj.honorarioExitoPercentual || "30%");
      setPercentualExitoSobreRetroativoForm(caseObj.percentualExitoSobreRetroativo || "30%");
      setQuantidadeParcelasExitoPrevidenciarioForm(Number(caseObj.quantidadeParcelasExitoPrevidenciario) || 0);
      setBaseCalculoExitoForm(caseObj.baseCalculoExito || "Proveito Econômico");

      // Load dynamic conditional parameters
      setDataVencimentoEntradaForm(caseObj.dataVencimentoEntrada || "");
      setPagoNaAssinaturaForm(caseObj.pagoNaAssinatura || false);
      setReclamanteVerbasRescisorias(caseObj.reclamanteVerbasRescisorias || false);
      setReclamanteFGTS(caseObj.reclamanteFGTS || false);
      setReclamanteFGTSIndep(caseObj.reclamanteFGTSIndep || false);
      setReclamanteMultaFGTS(caseObj.reclamanteMultaFGTS || false);
      setReclamanteMultaFGTSIndep(caseObj.reclamanteMultaFGTSIndep || false);
      setReclamanteSeguroDesemprego(caseObj.reclamanteSeguroDesemprego || false);
      setValorCausaReclamada(caseObj.valorCausaReclamada || "");
      setServicosTemporariosList(caseObj.servicosTemporariosList || ["Auxílio Doença", "Auxílio reclusão", "Auxílio inclusão"]);
      setServicosTemporariosSelected(caseObj.servicosTemporariosSelected || "Auxílio Doença");
      setAposentadoriasList(caseObj.aposentadoriasList || [
        "Aposentadoria Por idade Urbana",
        "Aposentadoria por idade rural",
        "Aposentadoria Híbrida",
        "Aposentadoria por Invalidez",
        "Auxílio Acidente permanente",
        "BPC/LOAS Etário",
        "BPC/LOAS Doença",
        "Aposentadoria da Pessoa Com Deficiência"
      ]);
      setAposentadoriasSelected(caseObj.aposentadoriasSelected || "Aposentadoria Por idade Urbana");

      setFinanceiroDetalhamento(caseObj.financeiroDetalhamento || {});
      setFinanceiroApuracaoTrabalhista(caseObj.financeiroApuracaoTrabalhista || {
        idHomologacaoCalculos: "",
        localSentencaHomologacao: "",
        creditoLiquido: "0,00",
        fgtsContaVinculada: "0,00",
        inssRecolhimento: "0,00",
        houveSucumbencia: "não",
        valorSucumbencia: "0,00",
        houveAcordo: "não",
        localAcordoProcesso: "",
        localDecisaoHomologatoriaAcordo: "",
        formaPagamentoAcordo: "Pix",
        valorTotalDepositoConta: "0,00",
        haveraAlvara: "não",
        valorAlvara: "0,00",
        quantidadeParcelasAcordo: 1,
        valorCadaParcela: "0,00",
        datasPagamentoParcelas: ""
      });
      setFinanceiroApuracaoPrevidenciaria(caseObj.financeiroApuracaoPrevidenciaria || {
        valorRetroativo: "0,00",
        valorBeneficioMensal: "0,00",
        valorHonorariosRetroativo: "0,00",
        valorHonorariosParcelasFuturas: "0,00"
      });
      setFinanceiroRateio(caseObj.financeiroRateio || {
        totalAdvogado: "0,00",
        totalHonorariosContratuais: "0,00",
        totalHonorariosSucumbenciais: "0,00",
        totalCliente: "0,00"
      });
      setFinanceiroDadosBancariosClienteSnapshot(caseObj.financeiroDadosBancariosClienteSnapshot || {
        pix: client?.bancario_chavePix || "",
        banco: client?.bancario_bancoPix || "",
        agencia: client?.bancario_agencia || "",
        conta: client?.bancario_conta || "",
        tipo: client?.bancario_tipoConta || "",
        titular: client?.bancario_titular || client?.nomeCompleto || ""
      });
      setFinanceiroDadosBancariosAdvogado(caseObj.financeiroDadosBancariosAdvogado || {
        pix: "direito.rgr@gmail.com",
        banco: "Banco do Brasil",
        agencia: "0428-6",
        conta: "61.954-x",
        titular: "Rodrigo Giffoni Rodrigues"
      });
      setFinanceiroTabelaAnaliticaVersion(caseObj.financeiroTabelaAnaliticaVersion || "v1");

      // Sync back legacy/backward compatibility variables
      setTipoServicoContratado(caseObj.assunto || "");
      setHonorariosPercentual(
        caseObj.honorariosPercentual ||
          caseObj.honorarioExitoPercentual ||
          "30%",
      );
      setHonorariosValorFixo(
        caseObj.honorariosValorFixo || caseObj.honorarioFixoValor || "0,00",
      );
      setBancoRecebimento(
        caseObj.bancoRecebimento ||
          caseObj.pixBanco ||
          client?.bancario_bancoPix ||
          "Nubank",
      );
      setAgenciaRecebimento(caseObj.agenciaRecebimento || "A combinar");
      setContaRecebimento(caseObj.contaRecebimento || "A combinar");
      setPixRecebimento(
        caseObj.pixRecebimento ||
          caseObj.pixChave ||
          client?.bancario_chavePix ||
          "",
      );

      // Load new payment options
      setGerarReciboAutomaticoForm(caseObj.gerarReciboAutomatico === true);
      setCartaoPorOndeForm(caseObj.cartaoPorOnde || "Infinitepay - Tap to pay");
      setBoletoPorOndeForm(caseObj.boletoPorOnde || "ASAAS");
      setComprovantesMeioPagamentoForm(caseObj.comprovantesMeioPagamento || []);
    }
  }, [caseObj, client]);

  // Automatic Parcel Calculation Logic based on fixed honoraries and installments
  useEffect(() => {
    const parseCurrency = (valStr: string) => {
      if (!valStr) return 0;
      // Remove symbols, spaces, dots, and convert commas to dots
      const clean = valStr.replace(/[R$\s\.]/g, "").replace(",", ".");
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    const totalVal = parseCurrency(honorarioFixoValorForm);
    const entradaVal =
      formaPagamentoForm === "Entrada + Parcelado"
        ? parseCurrency(valorEntradaForm)
        : 0;
    const remaining = Math.max(0, totalVal - entradaVal);
    const installments = Math.max(1, Number(quantidadeParcelasForm) || 1);

    const calculatedParcela = remaining / installments;

    // Format back to decimal string formatted like BRL
    const formatted = calculatedParcela.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setValorParcelaForm(formatted);
  }, [
    honorarioFixoValorForm,
    valorEntradaForm,
    quantidadeParcelasForm,
    formaPagamentoForm,
  ]);

  const [showUnsavedBalloon, setShowUnsavedBalloon] = useState(false);

  const checkIfSubStep1IsDirty = () => {
    if (!caseObj) return false;
    
    // Check main operational fields
    const defaultTipoServico = caseObj.assunto || "";
    if (defaultTipoServico !== tipoServicoContratadoForm) return true;
    if ((caseObj.tipoHonorario || "Honorários Fixos") !== tipoHonorarioForm) return true;
    if ((caseObj.honorarioFixoValor || "0,00") !== honorarioFixoValorForm) return true;
    if ((caseObj.formaPagamento || "À vista") !== formaPagamentoForm) return true;
    if ((caseObj.tipoRecebimento || "PIX") !== tipoRecebimentoForm) return true;
    
    const defaultPixBanco = client?.bancario_bancoPix || "Nubank";
    if ((caseObj.pixBanco || defaultPixBanco) !== pixBancoForm) return true;
    if ((caseObj.pixChave || client?.bancario_chavePix || "") !== pixChaveForm) return true;
    
    if ((Number(caseObj.quantidadeParcelas) || 1) !== Number(quantidadeParcelasForm)) return true;
    if ((caseObj.valorParcela || "0,00") !== valorParcelaForm) return true;
    if ((caseObj.diaVencimento || "10") !== diaVencimentoForm) return true;
    if ((caseObj.valorEntrada || "0,00") !== valorEntradaForm) return true;
    const currentEffectiveDPV = dataPrimeiroVencimentoADefinir ? "a definir" : dataPrimeiroVencimentoForm;
    if ((caseObj.dataPrimeiroVencimento || "") !== currentEffectiveDPV) return true;
    if ((caseObj.cobrancaAutomaticaInteg || "Não") !== cobrancaAutomaticaIntegForm) return true;
    
    if ((caseObj.modeloHonorarios || "fixo") !== modeloHonorariosForm) return true;
    
    const defaultPercentualExito = caseObj.honorarioExitoPercentual || "30%";
    if ((caseObj.percentualExito || defaultPercentualExito) !== percentualExitoForm) return true;
    if ((caseObj.percentualExitoSobreRetroativo || "30%") !== percentualExitoSobreRetroativoForm) return true;
    if ((Number(caseObj.quantidadeParcelasExitoPrevidenciario) || 0) !== Number(quantidadeParcelasExitoPrevidenciarioForm)) return true;
    if ((caseObj.baseCalculoExito || "Proveito Econômico") !== baseCalculoExitoForm) return true;
    
    if ((caseObj.dataVencimentoEntrada || "") !== dataVencimentoEntradaForm) return true;
    if ((caseObj.pagoNaAssinatura || false) !== pagoNaAssinaturaForm) return true;
    if ((caseObj.reclamanteVerbasRescisorias || false) !== reclamanteVerbasRescisorias) return true;
    if ((caseObj.reclamanteFGTS || false) !== reclamanteFGTS) return true;
    if ((caseObj.reclamanteFGTSIndep || false) !== reclamanteFGTSIndep) return true;
    if ((caseObj.reclamanteMultaFGTS || false) !== reclamanteMultaFGTS) return true;
    if ((caseObj.reclamanteMultaFGTSIndep || false) !== reclamanteMultaFGTSIndep) return true;
    if ((caseObj.reclamanteSeguroDesemprego || false) !== reclamanteSeguroDesemprego) return true;
    if ((caseObj.valorCausaReclamada || "") !== valorCausaReclamada) return true;

    // Check payment sub-states
    if ((caseObj.gerarReciboAutomatico === true) !== gerarReciboAutomaticoForm) return true;
    if ((caseObj.cartaoPorOnde || "Infinitepay - Tap to pay") !== cartaoPorOndeForm) return true;
    if ((caseObj.boletoPorOnde || "ASAAS") !== boletoPorOndeForm) return true;
    if (JSON.stringify(caseObj.comprovantesMeioPagamento || []) !== JSON.stringify(comprovantesMeioPagamentoForm)) return true;

    return false;
  };

  const renderStatusBadge = () => {
    const status = caseObj?.contratoHonorariosStatus;
    if (status === "gerando") {
      return (
        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-amber-200 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          🟡 Gerando Documento
        </span>
      );
    }
    if (status === "criada") {
      return (
        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-emerald-200 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          🟢 Documento Gerado
        </span>
      );
    }
    if (status === "aberto") {
      return (
        <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-blue-200 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          🔵 Documento Aberto
        </span>
      );
    }
    if (status === "falha") {
      return (
        <span className="flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-red-200 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          🔴 Falha GDocs
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-gray-50 text-gray-750 px-2.5 py-1 rounded-full text-[10px] font-black border border-gray-200 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
        🔴 Não Gerado
      </span>
    );
  };

  const handleGenerateContratoHonorarios = async (intent: 'initial' | 'new_version' = 'initial') => {
    if (checkIfSubStep1IsDirty()) {
      setError("Condições não foram gravadas. Isso pode afetar o gDI e a subetapa 02, grave a operação antes de prosseguir.");
      setShowUnsavedBalloon(true);
      setTimeout(() => {
        setShowUnsavedBalloon(false);
      }, 6000);
      return;
    }

    const isPf = client?.type === "PF";
    const jobId =
      "job_contr_gdocs_" +
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
      "CONTRATO_BUTTON_CLICKED",
      `O operador clicou em 'Criar Contrato de Honorários' (${isPf ? "PF" : "PJ"}) para iniciar o fluxo de automação.`,
    );

    if (!caseId) {
      setError("Erro de validação: ID do caso (caseId) está ausente.");
      return;
    }

    if (!caseObj) {
      setError(
        "Erro de validação: Dados do caso não carregados do banco de dados.",
      );
      return;
    }

    const targetClientId = caseObj?.clientId || client?.id;
    if (!targetClientId) {
      setError("Erro de validação: ID do cliente (clientId) está ausente.");
      return;
    }

    if (!client) {
      setError(
        "Erro de validação: Dados do cliente não carregados do banco de dados.",
      );
      return;
    }

    addClientLog(
      "CONTRATO_CLIENT_DATA_LOADED",
      "Dados cadastrais do cliente e do caso carregados com sucesso do banco.",
    );

    const assuntoContrato = String(caseObj?.assunto || "").trim();
    if (!assuntoContrato) {
      addClientLog(
        "CONTRATO_REQUIRED_PLACEHOLDER_EMPTY",
        isPf
          ? "Não é possível gerar o Contrato de Honorários porque o campo “Assunto” não foi preenchido no Formulário — Petição Inicial. Retorne à etapa Tipo de Produção e informe o assunto do caso."
          : "Não é possível gerar o Contrato de Honorários PJ porque o campo “Assunto” não foi preenchido no Formulário — Petição Inicial. Retorne à etapa Tipo de Produção e informe o assunto do caso."
      );
      setError(
        isPf
          ? "Não é possível gerar o Contrato de Honorários porque o campo “Assunto” não foi preenchido no Formulário — Petição Inicial. Retorne à etapa Tipo de Produção e informe o assunto do caso."
          : "Não é possível gerar o Contrato de Honorários PJ porque o campo “Assunto” não foi preenchido no Formulário — Petição Inicial. Retorne à etapa Tipo de Produção e informe o assunto do caso."
      );
      return;
    }

    if (isPf) {
      const getField = (keys: string[]): string => {
        for (const key of keys) {
          const val = client?.[key] ?? client?.pfDadosPessoais?.[key] ?? client?.pfData?.[key];
          if (val !== undefined && val !== null) {
            return String(val).trim();
          }
        }
        return "";
      };
      const cpf = getField(["pf_cpf", "cpf"]) || client?.cpf || "";
      if (!cpf) {
        addClientLog(
          "CONTRATO_REQUIRED_PLACEHOLDER_EMPTY",
          "Não é possível gerar o Contrato de Honorários porque o CPF do cliente não está preenchido no cadastro."
        );
        setError("Não é possível gerar o Contrato de Honorários porque o CPF do cliente não está preenchido no cadastro.");
        return;
      }
    } else {
      const getField = (keys: string[]): string => {
        for (const key of keys) {
          const val = client?.[key] ?? client?.pjDadosEmpresa?.[key] ?? client?.pjData?.[key];
          if (val !== undefined && val !== null) {
            return String(val).trim();
          }
        }
        return "";
      };
      const cnpj = getField(["pj_cnpj", "cnpj"]) || client?.cnpj || "";
      const razaoSocial = getField(["pj_razaoSocial", "razaoSocial", "nomeEmpresa"]) || client?.razaoSocial || "";
      const repNome = getField(["pj_nomeSocioAdministrador", "pj_socioNome", "socioNome"]) || client?.pjDadosRepresentante?.pj_representanteNomeCompleto || "";

      if (!cnpj) {
        addClientLog(
          "CONTRATO_REQUIRED_PLACEHOLDER_EMPTY",
          "Não é possível gerar o Contrato de Honorários PJ porque o CNPJ da empresa não está preenchido no cadastro do cliente."
        );
        setError("Não é possível gerar o Contrato de Honorários PJ porque o CNPJ da empresa não está preenchido no cadastro do cliente.");
        return;
      }
      if (!razaoSocial) {
        addClientLog(
          "CONTRATO_REQUIRED_PLACEHOLDER_EMPTY",
          "Não é possível gerar o Contrato de Honorários PJ porque a Razão Social da empresa não está preenchida no cadastro do cliente."
        );
        setError("Não é possível gerar o Contrato de Honorários PJ porque a Razão Social da empresa não está preenchida no cadastro do cliente.");
        return;
      }
      if (!repNome) {
        addClientLog(
          "CONTRATO_REQUIRED_PLACEHOLDER_EMPTY",
          "Não é possível gerar o Contrato de Honorários PJ porque o nome do Representante Legal / Sócio Administrador não está preenchido no cadastro do cliente."
        );
        setError("Não é possível gerar o Contrato de Honorários PJ porque o nome do Representante Legal / Sócio Administrador não está preenchido no cadastro do cliente.");
        return;
      }
    }

    addClientLog(
      "CONTRATO_ASSUNTO_RESOLVIDO",
      `Assunto do caso obtido com sucesso da Petição Inicial: "${assuntoContrato}".`
    );
    addClientLog(
      "CONTRATO_MODELO_HONORARIOS_RESOLVIDO",
      `Modelo de honorários resolvido: "${modeloHonorariosForm}".`
    );

    const resolvedNomeCompleto = (
      client?.pfData?.pf_nomeCompleto ||
      client?.pfDadosPessoais?.pf_nomeCompleto ||
      client?.razaoSocial ||
      client?.pjDadosEmpresa?.pj_razaoSocial ||
      client?.nomeCompleto ||
      client?.nome ||
      ""
    ).trim();

    if (!resolvedNomeCompleto) {
      addClientLog(
        "CONTRATO_REQUIRED_PLACEHOLDER_EMPTY",
        "Nome do cliente não localizado.",
      );
      setError(
        "Nome completo ou razão social do cliente não localizado no cadastro. Verifique a Etapa 1 — Cadastro do Cliente.",
      );
      return;
    }

    const clientDriveFolderId = (
      client?.googleDriveClientFolderId ||
      client?.gdriveFolderId ||
      caseObj?.gdriveFolderId ||
      ""
    ).trim();
    const clientDriveFolderUrl = (
      client?.googleDriveClientFolderUrl ||
      client?.gdriveFolderUrl ||
      caseObj?.gdriveFolderUrl ||
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
      setError(
        "Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.",
      );
      return;
    }

    addClientLog(
      "CONTRATO_FOLDER_FOUND",
      `Pasta destino no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`,
    );

    const officialTemplateId = "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ";
    addClientLog(
      "CONTRATO_OFFICIAL_TEMPLATE_SELECTED",
      `Template oficial de Contrato de Honorários selecionado unicamente como fonte da verdade: ${officialTemplateId}`,
    );

    setSaving(true);
    setError(null);
    setSuccess(null);

    const caseDocRef = doc(db, "cases", caseId);

    // First save the current form values in Firestore under the case document as requested!
    let compatTipoHonorario = "Honorários Fixos";
    if (modeloHonorariosForm === "fixo") {
      compatTipoHonorario = "Honorários Fixos";
    } else if (["exito_simples", "exito_completo_trabalhista", "exito_completo_previdenciario"].includes(modeloHonorariosForm)) {
      compatTipoHonorario = "Êxito";
    } else {
      compatTipoHonorario = "Misto (Fixo + Êxito)";
    }

    // Generate automatic analytical table for subetapa 02 synchronization
    const list: any[] = [];
    let currentId = 1;

    const isFixoModel = ["fixo", "fixo_mais_exito_simples", "fixo_mais_exito_completo_trabalhista", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm);
    if (isFixoModel || !modeloHonorariosForm) {
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
      const hContratuais = financeiroRateioState?.totalHonorariosContratuais || "0,00";
      const hSucumbenciais = financeiroRateioState?.totalHonorariosSucumbenciais || "0,00";
      const lCliente = financeiroRateioState?.totalCliente || "0,00";

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
        formaRecebimento: "Alvará Judicial"
      });

      list.push({
        id: String(currentId++),
        numero: "Repasse Líquido ao Cliente",
        valor: lCliente !== "0,00" && lCliente !== "NaN" ? `R$ ${lCliente}` : `R$ 10.500,00 (Estimativo)`,
        dataVencimento: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split("T")[0],
        pago: false,
        status: "pendente",
        formaRecebimento: "Repasse por Pix"
      });
    } else if (modeloHonorariosForm === "exito_completo_previdenciario" || modeloHonorariosForm === "fixo_mais_exito_completo_previdenciario") {
      const hRetroativo = financeiroApuracaoPrevidenciariaState?.valorHonorariosRetroativo || "0,00";
      
      list.push({
        id: String(currentId++),
        numero: "Honorários sobre Retroativo",
        valor: hRetroativo !== "0,00" && hRetroativo !== "NaN" ? `R$ ${hRetroativo}` : "R$ 3.000,00 (Estimativo)",
        dataVencimento: new Date(Date.now() + 150 * 24 * 3600 * 1000).toISOString().split("T")[0],
        pago: false,
        status: "pendente",
        formaRecebimento: "Precatório / RPV"
      });

      const limitPrevidenciarioFuturo = Math.max(0, Number(quantidadeParcelasExitoPrevidenciarioForm) || 0);
      const prcPrevVal = financeiroApuracaoPrevidenciariaState?.valorBeneficioMensal || "0,00";
      
      for (let j = 0; j < limitPrevidenciarioFuturo; j++) {
        list.push({
          id: String(currentId++),
          numero: `Honorários Parc. Benefício ${j + 1}/${limitPrevidenciarioFuturo}`,
          valor: prcPrevVal !== "0,00" && prcPrevVal !== "NaN" ? `R$ ${prcPrevVal}` : "R$ 1.412,00 (Estimativo)",
          dataVencimento: new Date(Date.now() + (180 + j * 30) * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Boleto / Pix"
        });
      }
    }

    setTabelaAnalitica(list);
    setShowUnsavedBalloon(false);

    const updatedFinanceData: Record<string, any> = {
      tipoServicoContratado: tipoServicoContratadoForm,
      tipoHonorario: compatTipoHonorario,
      honorarioExitoPercentual: ["exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm)
        ? percentualExitoSobreRetroativoForm
        : percentualExitoForm,
      honorarioFixoValor: honorarioFixoValorForm,
      formaPagamento: formaPagamentoForm,
      tipoRecebimento: tipoRecebimentoForm,
      pixBanco: pixBancoForm,
      pixChave: pixChaveForm,
      quantidadeParcelas: Number(quantidadeParcelasForm) || 1,
      valorParcela: valorParcelaForm,
      diaVencimento: diaVencimentoForm,
      valorEntrada: valorEntradaForm,
      dataPrimeiroVencimento: dataPrimeiroVencimentoADefinir ? "a definir" : dataPrimeiroVencimentoForm,
      dataPrimeiroVencimentoADefinir: dataPrimeiroVencimentoADefinir,
      cobrancaAutomaticaInteg: cobrancaAutomaticaIntegForm,
      
      // Brand new financial fields
      modeloHonorarios: modeloHonorariosForm,
      categoriaExito: categoriaExitoForm,
      classeExito: classeExitoForm,
      percentualExito: percentualExitoForm,
      percentualExitoSobreRetroativo: percentualExitoSobreRetroativoForm,
      quantidadeParcelasExitoPrevidenciario: Number(quantidadeParcelasExitoPrevidenciarioForm) || 0,
      baseCalculoExito: baseCalculoExitoForm,
      financeiroDetalhamento: financeiroDetalhamentoState || {},
      financeiroApuracaoTrabalhista: financeiroApuracaoTrabalhistaState || {},
      financeiroApuracaoPrevidenciaria: financeiroApuracaoPrevidenciariaState || {},
      financeiroRateio: financeiroRateioState || {},
      financeiroDadosBancariosClienteSnapshot: financeiroDadosBancariosClienteSnapshotState || {},
      financeiroDadosBancariosAdvogado: financeiroDadosBancariosAdvogadoState || {},
      financeiroTabelaAnaliticaVersion: financeiroTabelaAnaliticaVersionState || "v1",

      // New conditional contract fields
      dataVencimentoEntrada: dataVencimentoEntradaForm,
      pagoNaAssinatura: pagoNaAssinaturaForm,
      reclamanteVerbasRescisorias: reclamanteVerbasRescisorias,
      reclamanteFGTS: reclamanteFGTS,
      reclamanteFGTSIndep: reclamanteFGTSIndep,
      reclamanteMultaFGTS: reclamanteMultaFGTS,
      reclamanteMultaFGTSIndep: reclamanteMultaFGTSIndep,
      reclamanteSeguroDesemprego: reclamanteSeguroDesemprego,
      valorCausaReclamada: valorCausaReclamada,
      servicosTemporariosList: servicosTemporariosList,
      servicosTemporariosSelected: servicosTemporariosSelected,
      aposentadoriasList: aposentadoriasList,
      aposentadoriasSelected: aposentadoriasSelected,

      // Synchronized subetapa 02 details
      tabelaAnalitica: list,
      financeiroUltimaSincronizacaoSubetapa01: modeloHonorariosForm || "fixo",

      // For backwards compatibility mapping when templates expect these
      honorariosPercentual: ["exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm)
        ? percentualExitoSobreRetroativoForm
        : percentualExitoForm,
      honorariosValorFixo: honorarioFixoValorForm,
      bancoRecebimento: pixBancoForm,
      pixRecebimento: pixChaveForm,
      contratoHonorariosStatus: "gerando",
      contratoHonorariosLogFalha: "",
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(caseDocRef, updatedFinanceData);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dataAssinaturaFormated = `${day}/${month}/${year}`;

    let placeholders: Record<string, string>;
    try {
      const parentCaseObj = { ...caseObj, ...updatedFinanceData };
      if (isPf) {
        placeholders = buildContratoHonorariosPfPlaceholders(
          client,
          parentCaseObj,
          updatedFinanceData,
        );
      } else {
        placeholders = buildContratoHonorariosPjPlaceholders(
          client,
          parentCaseObj,
          updatedFinanceData,
        );
      }

      placeholders["{{DATA_ASSINATURA}}"] = dataAssinaturaFormated;
      placeholders["<<data da assinatura>>"] = dataAssinaturaFormated;

      addClientLog(
        "CONTRATO_PLACEHOLDERS_BUILT",
        "Todas as chaves e valores de placeholders foram processados e vinculados com sucesso.",
      );
    } catch (errPl: any) {
      setError(`Erro ao construir placeholders: ${errPl.message}`);
      setSaving(false);
      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "falha",
        contratoHonorariosLogFalha: `Erro placeholders: ${errPl.message}`,
      });
      return;
    }

    const initialJob = {
      id: jobId,
      contractVersion: "boss.placeholders.v2",
      source: "Portal BOSS Clientes",
      target: "Internal Generator Engine",
      documentType: isPf ? "contrato_honorarios_pf" : "contrato_honorarios_pj",
      templateKey: isPf ? "contrato_honorarios_pf" : "contrato_honorarios_pj",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId: caseId,
      portalClientId: targetClientId,
      clientType: isPf ? "PF" : "PJ",
      destinationFolderId: clientDriveFolderId,
      destinationFolderUrl: clientDriveFolderUrl,
      outputFileName: `Contrato de Honorários - ${resolvedNomeCompleto}`,
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

    const currentGoogleAccessToken =
      googleAccessToken ||
      localStorage.getItem("oauth_google_access_token") ||
      localStorage.getItem("portal_boss_google_accessToken") ||
      "";
    const localOverride =
      localStorage.getItem("portal_boss_gdocs_override") || "";

    if (!currentGoogleAccessToken && !localOverride) {
      const isIframe = window.self !== window.top;
      const errMsg = isIframe
        ? "Popups de login do Google são bloqueados pelo navegador dentro de Iframes de visualização. Por favor, clique em 'Abrir em Nova Aba' no menu do AI Studio (topo direito) para renovar seu acesso Google com sucesso!"
        : "Faça login novamente com Google para autorizar Google Docs/Drive ou configure a Central de Integrações.";

      setError(errMsg);
      setSaving(false);

      addClientLog(
        "CONTRATO_TOKEN_CHECK_FAILED",
        `Geração abortada: Falta Google Access Token no navegador. Motivo: ${isIframe ? "Ambiente em Iframe impediu popup de consentimento." : "Sessão expirada."}`
      );

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "falha",
        contratoHonorariosLogFalha: isIframe ? "Iframe bloqueou Popup Google" : "Falta Google Access Token",
      });

      await updateDoc(doc(db, "googleDocsJobs", jobId), {
        status: "failed",
        updatedAt: new Date().toISOString(),
        errorCode: "MISSING_GOOGLE_TOKEN",
        errorMessage: errMsg,
        logs: jobLogs,
      });

      setRefreshToggle((prev) => prev + 1);
      return;
    }

    try {
      const response = await fetch("/api/google-docs/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "stateless",
          intent,
          googleAccessToken: currentGoogleAccessToken,
          documentType: isPf
            ? "contrato_honorarios_pf"
            : "contrato_honorarios_pj",
          templateKey: isPf
            ? "contrato_honorarios_pf"
            : "contrato_honorarios_pj",
          templateId: officialTemplateId,
          caseId,
          clientId: targetClientId,
          clientType: isPf ? "PF" : "PJ",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `Contrato de Honorários - ${resolvedNomeCompleto}`,
          placeholders,
          metadata: {
            source: `Portal BOSS - Contrato ${isPf ? "PF" : "PJ"}`,
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro`,
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
          errorCode: responseData.errorCode || "CONTRATO_TEMPLATE_COPY_FAILED",
        };
      }

      const googleDocsId = responseData.googleDocsId;
      const googleDocsUrl = responseData.googleDocsUrl;

      addClientLog(
        "CONTRATO_TEMPLATE_COPY_SUCCESS",
        `Clone realizado no Google Drive com o novo ID de documento: ${googleDocsId}`,
      );
      addClientLog(
        "CONTRATO_PLACEHOLDER_REPLACEMENT_SUCCESS",
        "Substituição concluída de todos os placeholders com absoluto sucesso.",
      );
      addClientLog(
        "CONTRATO_FLOW_COMPLETED",
        "Processamento terminado com 100% de conformidade operacional.",
      );

      const generatedAtISO = new Date().toISOString();

      const docVer = responseData.documentVersion || 1;
      const serverTechLogs = responseData.technicalLog || [];

      const currentHistory = caseObj?.contratoHonorariosHistory || [];
      const operatorName = profile?.name || user?.displayName || user?.email || "Operador";
      const newHistoryRecord = {
        type: "generate",
        timestamp: generatedAtISO,
        user: operatorName,
        version: docVer,
        description: intent === "initial" ? "Geração inicial do Contrato de Honorários" : `Geração de nova versão do Contrato (v${docVer})`
      };
      const updatedHistory = [...currentHistory, newHistoryRecord];

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "criada",
        contratoHonorariosPfId: googleDocsId,
        contratoHonorariosPfUrl: googleDocsUrl,
        contratoHonorariosGoogleDocsId: googleDocsId,
        contratoHonorariosGoogleDocsUrl: googleDocsUrl,
        contratoHonorariosGeneratedAt: generatedAtISO,
        contratoHonorariosDestinationFolderId: clientDriveFolderId,
        contratoHonorariosDestinationFolderUrl: clientDriveFolderUrl,
        contratoHonorariosGoogleDocsJobId: jobId,
        contratoHonorariosGoogleDocsJobLogs: jobLogs,
        contratoHonorariosTechnicalLog: serverTechLogs,
        contratoHonorariosVersion: docVer,
        contratoHonorariosLastOutcome: "created",
        contratoHonorariosLastOperationAt: generatedAtISO,
        contratoHonorariosLastErrorCode: null,
        contratoHonorariosLastErrorMessage: null,
        contratoHonorariosLogFalha: "",
        contratoHonorariosAprovadoStatus: "draft",
        contratoHonorariosHistory: updatedHistory,
      });

      try {
        const subdocRef = doc(
          db,
          "cases",
          caseId,
          "generatedDocuments",
          isPf ? "contrato_honorarios_pf" : "contrato_honorarios_pj",
        );
        await setDoc(
          subdocRef,
          {
            documentType: isPf
              ? "contrato_honorarios_pf"
              : "contrato_honorarios_pj",
            displayName: `Contrato de Honorários ${isPf ? "PF" : "PJ"} - ${resolvedNomeCompleto}`,
            templateKey: isPf
              ? "contrato_honorarios_pf"
              : "contrato_honorarios_pj",
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
          fileName: `Contrato de Honorários - ${resolvedNomeCompleto}`,
        },
        logs: jobLogs,
      });

      setSuccess(
        `Contrato de Honorários ${isPf ? "PF" : "PJ"} de Geração Real gerado com sucesso!`,
      );
      setRefreshToggle((prev) => prev + 1);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || JSON.stringify(err);
      setError(`Erro na geração: ${errMsg}`);

      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "falha",
        contratoHonorariosLogFalha: errMsg,
      });

      await updateDoc(doc(db, "googleDocsJobs", jobId), {
        status: "failed",
        updatedAt: new Date().toISOString(),
        errorCode: err.errorCode || "CONTRATO_GENERATION_FAILED",
        errorMessage: errMsg,
        logs: jobLogs,
      });
      setRefreshToggle((prev) => prev + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCustomDocument = async (
    docType: string,
    docDisplayName: string,
    customPlaceholders: Record<string, string>,
    officialTemplateId: string = "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ"
  ) => {
    const isPf = client?.type === "PF";
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

    if (!caseId) {
      setError("Erro de validação: ID do caso (caseId) está ausente.");
      return;
    }

    if (!caseObj) {
      setError(
        "Erro de validação: Dados do caso não carregados do banco de dados.",
      );
      return;
    }

    const targetClientId = caseObj?.clientId || client?.id;
    if (!targetClientId) {
      setError("Erro de validação: ID do cliente (clientId) está ausente.");
      return;
    }

    if (!client) {
      setError(
        "Erro de validação: Dados do cliente não carregados do banco de dados.",
      );
      return;
    }

    const resolvedNomeCompleto = (
      client?.pfData?.pf_nomeCompleto ||
      client?.pfDadosPessoais?.pf_nomeCompleto ||
      client?.razaoSocial ||
      client?.pjDadosEmpresa?.pj_razaoSocial ||
      client?.nomeCompleto ||
      client?.nome ||
      ""
    ).trim();

    if (!resolvedNomeCompleto) {
      setError(
        "Nome completo ou razão social do cliente não localizado no cadastro. Verifique a Etapa 1 — Cadastro do Cliente.",
      );
      return;
    }

    const clientDriveFolderId = (
      client?.googleDriveClientFolderId ||
      client?.gdriveFolderId ||
      caseObj?.gdriveFolderId ||
      ""
    ).trim();
    const clientDriveFolderUrl = (
      client?.googleDriveClientFolderUrl ||
      client?.gdriveFolderUrl ||
      caseObj?.gdriveFolderUrl ||
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
      setError(
        "Não há pasta real do Google Drive vinculada ao cliente. Acesse a Etapa 1 — Cadastro do Cliente e execute primeiro a Automação Google Drive — Pasta do Cliente.",
      );
      return;
    }

    addClientLog(
      "FOLDER_FOUND",
      `Pasta destino no Google Drive localizada com sucesso ID: ${clientDriveFolderId}`,
    );

    setSaving(true);
    setError(null);
    setSuccess(null);

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
        basePlaceholders = buildContratoHonorariosPfPlaceholders(client, caseObj, caseObj);
      } else {
        basePlaceholders = buildContratoHonorariosPjPlaceholders(client, caseObj, caseObj);
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
      setError(
        "Faça login novamente com Google para autorizar Google Docs/Drive ou configure a Central de Integrações.",
      );
      setSaving(false);
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
      caseId: caseId,
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
          caseId,
          clientId: targetClientId,
          clientType: isPf ? "PF" : "PJ",
          destinationFolderId: clientDriveFolderId,
          destinationFolderUrl: clientDriveFolderUrl,
          documentName: `${docDisplayName} - ${resolvedNomeCompleto}`,
          placeholders,
          metadata: {
            source: `Portal BOSS - Custom Doc`,
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro`,
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
          caseId!,
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

      setSuccess(
        `${docDisplayName} gerado com sucesso! Arquivo salvo na pasta do Google Drive do cliente.`,
      );
      setRefreshToggle((prev) => prev + 1);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || JSON.stringify(err);
      setError(`Erro na geração: ${errMsg}`);

      await updateDoc(doc(db, "googleDocsJobs", jobId), {
        status: "failed",
        updatedAt: new Date().toISOString(),
        errorCode: err.errorCode || "DOCUMENT_GENERATION_FAILED",
        errorMessage: errMsg,
        logs: jobLogs,
      });
      setRefreshToggle((prev) => prev + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinanceiroCondicoes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const caseDocRef = doc(db, "cases", caseId!);
      
      // Determine backward compatibility mappings
      let compatTipoHonorario = "Honorários Fixos";
      if (modeloHonorariosForm === "fixo") {
        compatTipoHonorario = "Honorários Fixos";
      } else if (["exito_simples", "exito_completo_trabalhista", "exito_completo_previdenciario"].includes(modeloHonorariosForm)) {
        compatTipoHonorario = "Êxito";
      } else {
        compatTipoHonorario = "Misto (Fixo + Êxito)";
      }

      // 1. Generate automatic analytical table for subetapa 02 synchronization
      const list: any[] = [];
      let currentId = 1;

      const isFixoModel = ["fixo", "fixo_mais_exito_simples", "fixo_mais_exito_completo_trabalhista", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm);
      if (isFixoModel || !modeloHonorariosForm) {
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
        const hContratuais = financeiroRateioState?.totalHonorariosContratuais || "0,00";
        const hSucumbenciais = financeiroRateioState?.totalHonorariosSucumbenciais || "0,00";
        const lCliente = financeiroRateioState?.totalCliente || "0,00";

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
          formaRecebimento: "Alvará Judicial"
        });

        list.push({
          id: String(currentId++),
          numero: "Repasse Líquido ao Cliente",
          valor: lCliente !== "0,00" && lCliente !== "NaN" ? `R$ ${lCliente}` : `R$ 10.500,00 (Estimativo)`,
          dataVencimento: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Repasse por Pix"
        });
      } else if (modeloHonorariosForm === "exito_completo_previdenciario" || modeloHonorariosForm === "fixo_mais_exito_completo_previdenciario") {
        const hRetroativo = financeiroApuracaoPrevidenciariaState?.valorHonorariosRetroativo || "0,00";
        
        list.push({
          id: String(currentId++),
          numero: "Honorários sobre Retroativo",
          valor: hRetroativo !== "0,00" && hRetroativo !== "NaN" ? `R$ ${hRetroativo}` : "R$ 3.000,00 (Estimativo)",
          dataVencimento: new Date(Date.now() + 150 * 24 * 3600 * 1000).toISOString().split("T")[0],
          pago: false,
          status: "pendente",
          formaRecebimento: "Precatório / RPV"
        });

        const limitPrevidenciarioFuturo = Math.max(0, Number(quantidadeParcelasExitoPrevidenciarioForm) || 0);
        const prcPrevVal = financeiroApuracaoPrevidenciariaState?.valorBeneficioMensal || "0,00";
        
        for (let j = 0; j < limitPrevidenciarioFuturo; j++) {
          list.push({
            id: String(currentId++),
            numero: `Honorários Parc. Benefício ${j + 1}/${limitPrevidenciarioFuturo}`,
            valor: prcPrevVal !== "0,00" && prcPrevVal !== "NaN" ? `R$ ${prcPrevVal}` : "R$ 1.412,00 (Estimativo)",
            dataVencimento: new Date(Date.now() + (180 + j * 30) * 24 * 3600 * 1000).toISOString().split("T")[0],
            pago: false,
            status: "pendente",
            formaRecebimento: "Boleto / Pix"
          });
        }
      }

      const updatedFinanceData: Record<string, any> = {
        tipoServicoContratado: tipoServicoContratadoForm,
        tipoHonorario: compatTipoHonorario,
        honorarioExitoPercentual: ["exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm)
          ? percentualExitoSobreRetroativoForm
          : percentualExitoForm,
        honorarioFixoValor: honorarioFixoValorForm,
        formaPagamento: formaPagamentoForm,
        tipoRecebimento: tipoRecebimentoForm,
        pixBanco: pixBancoForm,
        pixChave: pixChaveForm,
        quantidadeParcelas: Number(quantidadeParcelasForm) || 1,
        valorParcela: valorParcelaForm,
        diaVencimento: diaVencimentoForm,
        valorEntrada: valorEntradaForm,
        dataPrimeiroVencimento: dataPrimeiroVencimentoADefinir ? "a definir" : dataPrimeiroVencimentoForm,
        dataPrimeiroVencimentoADefinir: dataPrimeiroVencimentoADefinir,
        cobrancaAutomaticaInteg: cobrancaAutomaticaIntegForm,
        
        // Brand new financial fields
        gerarReciboAutomatico: gerarReciboAutomaticoForm,
        cartaoPorOnde: cartaoPorOndeForm,
        boletoPorOnde: boletoPorOndeForm,
        comprovantesMeioPagamento: comprovantesMeioPagamentoForm,

        modeloHonorarios: modeloHonorariosForm,
        categoriaExito: categoriaExitoForm,
        classeExito: classeExitoForm,
        percentualExito: percentualExitoForm,
        percentualExitoSobreRetroativo: percentualExitoSobreRetroativoForm,
        quantidadeParcelasExitoPrevidenciario: Number(quantidadeParcelasExitoPrevidenciarioForm) || 0,
        baseCalculoExito: baseCalculoExitoForm,
        financeiroDetalhamento: financeiroDetalhamentoState || {},
        financeiroApuracaoTrabalhista: financeiroApuracaoTrabalhistaState || {},
        financeiroApuracaoPrevidenciaria: financeiroApuracaoPrevidenciariaState || {},
        financeiroRateio: financeiroRateioState || {},
        financeiroDadosBancariosClienteSnapshot: financeiroDadosBancariosClienteSnapshotState || {},
        financeiroDadosBancariosAdvogado: financeiroDadosBancariosAdvogadoState || {},
        financeiroTabelaAnaliticaVersion: financeiroTabelaAnaliticaVersionState || "v1",

        // New conditional contract fields
        dataVencimentoEntrada: dataVencimentoEntradaForm,
        pagoNaAssinatura: pagoNaAssinaturaForm,
        reclamanteVerbasRescisorias: reclamanteVerbasRescisorias,
        reclamanteFGTS: reclamanteFGTS,
        reclamanteFGTSIndep: reclamanteFGTSIndep,
        reclamanteMultaFGTS: reclamanteMultaFGTS,
        reclamanteMultaFGTSIndep: reclamanteMultaFGTSIndep,
        reclamanteSeguroDesemprego: reclamanteSeguroDesemprego,
        valorCausaReclamada: valorCausaReclamada,
        servicosTemporariosList: servicosTemporariosList,
        servicosTemporariosSelected: servicosTemporariosSelected,
        aposentadoriasList: aposentadoriasList,
        aposentadoriasSelected: aposentadoriasSelected,

        // Synchronized subetapa 02 details
        tabelaAnalitica: list,
        financeiroUltimaSincronizacaoSubetapa01: modeloHonorariosForm || "fixo",

        // For backwards compatibility mapping when templates expect these
        honorariosPercentual: ["exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm)
          ? percentualExitoSobreRetroativoForm
          : percentualExitoForm,
        honorariosValorFixo: honorarioFixoValorForm,
        bancoRecebimento: pixBancoForm,
        pixRecebimento: pixChaveForm,
        updatedAt: new Date().toISOString(),
      };

      // Archive historical values if configuration model changes!
      if (caseObj?.modeloHonorarios && caseObj.modeloHonorarios !== modeloHonorariosForm) {
        const historicoEntry = {
          modeloAnterior: caseObj.modeloHonorarios || "não definido",
          modeloNovo: modeloHonorariosForm,
          dataAlteracao: new Date().toISOString(),
          camposArquivados: {
            tipoHonorario: caseObj.tipoHonorario || "",
            honorarioExitoPercentual: caseObj.honorarioExitoPercentual || "",
            honorarioFixoValor: caseObj.honorarioFixoValor || "",
            percentualExito: caseObj.percentualExito || "",
            percentualExitoSobreRetroativo: caseObj.percentualExitoSobreRetroativo || "",
            quantidadeParcelasExitoPrevidenciario: caseObj.quantidadeParcelasExitoPrevidenciario || 0,
            baseCalculoExito: caseObj.baseCalculoExito || "",
            tabelaAnalitica: caseObj.tabelaAnalitica || []
          },
          operador: "Operador Portal BOSS"
        };
        const historicosAtuais = Array.isArray(caseObj.financeiroHistoricoModelos)
          ? caseObj.financeiroHistoricoModelos
          : [];
        updatedFinanceData.financeiroHistoricoModelos = [...historicosAtuais, historicoEntry];
      }

      await updateDoc(caseDocRef, updatedFinanceData);
      
      // Update local states immediately for instant UI feedback
      setCaseObj((prev: any) => ({
        ...prev,
        ...updatedFinanceData
      }));
      setTabelaAnalitica(list);
      setShowUnsavedBalloon(false);

      setSuccess("Condições financeiras gravadas e subetapa 02 sincronizada com sucesso!");
      setRefreshToggle((prev) => prev + 1);
      setTimeout(() => setSuccess(null), 3050);

      // Auto-update Preview and Battle Naval on save
      handleExecutePreview();
      if (isBattleNavalOpen) {
        handleOpenBattleNaval();
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao gravar condições financeiras: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenContrato = async (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      const caseDocRef = doc(db, "cases", caseId!);
      await updateDoc(caseDocRef, {
        contratoHonorariosStatus: "aberto",
      });
      setRefreshToggle((prev) => prev + 1);
    } catch (err) {
      console.error("Error updating status to aberto:", err);
    }
  };

  const handleCheckboxToggle = (field: string, val: string) => {
    const current = wizardState[field] || [];
    let next;
    if (current.includes(val)) {
      next = current.filter((x: string) => x !== val);
    } else {
      next = [...current, val];
    }
    saveWizardStateUpdate({ [field]: next });
  };

  const FileUploadBox = ({ field }: { field: string }) => {
    const files = wizardState[field] || [];
    return (
      <div className="space-y-2 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
          <UploadCloud
            className="text-gray-400 group-hover:text-indigo-600 mb-1"
            size={20}
          />
          <span className="text-[11px] font-bold text-gray-750 font-sans">
            Anexar Contrato de Honorários Assinado (PDF)
          </span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const originalName = file.name;
                const size =
                  (file.size / 1024 / 1024).toFixed(2) + " MB";
                const lastDotIndex = originalName.lastIndexOf('.');
                const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
                const finalName = `Doc. 03 - Contrato de Honorários - ${clientName || 'Cliente'}${extension}`;
                addWizardFile(field, finalName, size);
              }
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-xs"
              >
                <span className="truncate font-semibold text-indigo-900 flex items-center gap-1 font-mono">
                  <FileText size={12} /> {f.name}{" "}
                  <span className="text-[10px] text-indigo-400 font-normal">
                    ({f.size})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeWizardFile(field, idx)}
                  className="text-rose-600 hover:bg-rose-105 p-1 rounded-lg"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Client display format properties
  const clientName = client
    ? client.type === "PF"
      ? client.pfDadosPessoais?.pf_nomeCompleto ||
        client.pfData?.pf_nomeCompleto ||
        "Sem Nome"
      : client.pjDadosEmpresa?.pj_razaoSocial ||
        client.pjData?.pj_razaoSocial ||
        "Sem Razão Social"
    : "";
  const clientSlug = client?.slug || "";

  // Options lists
  const chargeTypeOptions = [
    "Honorários fixos",
    "Honorários de êxito",
    "Honorários Fixos + êxito",
  ];

  const financialStatusOptions: {
    value: CaseFinancial["financialStatus"];
    label: string;
  }[] = [
    { value: "aguardando_pagamento", label: "Aguardando pagamento" },
    { value: "pago", label: "Pago" },
    { value: "em_atraso", label: "Em atraso" },
    { value: "cancelado", label: "Cancelado" },
    { value: "renegociado", label: "Renegociado" },
    { value: "aguardando_webhook", label: "Aguardando validação webhook" },
    { value: "erro_webhook", label: "Erro de sincronização Webhook" },
  ];

  useEffect(() => {
    if (!caseId) {
      setError("Indexador de caso inexistente na URL técnica.");
      setFetching(false);
      return;
    }

    async function loadFinancialData() {
      try {
        setLoadingList(true);
        // 1. Fetch case record
        const caseSnap = await getDoc(doc(db, "cases", caseId!));
        if (!caseSnap.exists()) {
          setError(
            `Caso referenciado por ID [${caseId}] não existe no banco de dados.`,
          );
          setFetching(false);
          setLoadingList(false);
          return;
        }
        const cData = caseSnap.data();
        setCaseObj(cData);
        setTabelaAnalitica(cData.tabelaAnalitica || []);
        if (cData.solicitacoesProvasWizardState) {
          setWizardState((prev: any) => ({
            ...prev,
            ...cData.solicitacoesProvasWizardState,
          }));
        }

        // 2. Fetch Client record if available
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, "clients", cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // 3. Fetch Case Financial records
        const q = query(
          collection(db, "caseFinancials"),
          where("caseId", "==", caseId),
          where("archived", "==", false),
        );
        const querySnap = await getDocs(q);
        const financialList: CaseFinancial[] = [];
        querySnap.forEach((docSnap) => {
          financialList.push({
            id: docSnap.id,
            ...docSnap.data(),
          } as CaseFinancial);
        });

        // Sorted newest first
        financialList.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setFinancials(financialList);

        // 4. Fetch Google Docs integration jobs for this case (both PF and PJ contrato)
        try {
          const jobsQuery = query(
            collection(db, "googleDocsJobs"),
            where("caseId", "==", caseId),
            where("documentType", "in", ["contrato_honorarios_pf", "contrato_honorarios_pj"])
          );
          const jobsSnap = await getDocs(jobsQuery);
          const jobsList: any[] = [];
          jobsSnap.forEach((docSnap) => {
            jobsList.push({
              id: docSnap.id,
              ...docSnap.data(),
            });
          });
          // Sort newest first
          jobsList.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          setIntegrationJobs(jobsList);
        } catch (jobErr) {
          console.error("Erro ao buscar logs de integração:", jobErr);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          `Erro crítico ao buscar registros financeiros: ${err.message || err}`,
        );
      } finally {
        setFetching(false);
        setLoadingList(false);
      }
    }

    loadFinancialData();
  }, [caseId, refreshToggle]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const resolvedChargeType =
      formChargeType === "Outro" ? customChargeType.trim() : formChargeType;
    if (!resolvedChargeType) {
      setError("Por favor defina o tipo de cobrança.");
      return;
    }

    const parsedAmount = parseFloat(formTotalAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError(
        "O valor total do faturamento deve ser um número válido superior ou igual a zero BRL.",
      );
      return;
    }

    setSaving(true);
    const nowISO = new Date().toISOString();

    try {
      const payload: Omit<CaseFinancial, "id"> = {
        caseId: caseId!,
        clientId: caseObj?.clientId || "",
        clientSlug: clientSlug || "",

        chargeType: resolvedChargeType,
        totalAmount: parsedAmount,
        paymentMethod: formPaymentMethod,
        installments: Number(formInstallments) || 1,
        firstDueDate: formFirstDueDate,
        financialStatus: formFinancialStatus,
        visibleToClient: formVisibleToClient,
        publicFinancialMessage: formPublicMessage.trim(),

        contractLinked: formContractLinked,
        contractName: formContractName.trim(),
        contractUrl: formContractUrl.trim(),
        contractVisibleToClient: formContractVisible,

        paymentProvider: formPaymentProvider,
        paymentStatus: formPaymentStatus.trim(),
        paymentLink: formPaymentLink.trim(),
        externalPaymentId: formExternalPaymentId.trim(),
        webhookStatus: formWebhookStatus.trim(),
        lastWebhookAt: formLastWebhookAt.trim(),

        stripeCustomerId: formStripeCustomerId.trim(),
        stripeCheckoutSessionId: formStripeCheckoutId.trim(),
        stripePaymentIntentId: formStripeIntentId.trim(),

        asaasCustomerId: formAsaasCustomerId.trim(),
        asaasPaymentId: formAsaasPaymentId.trim(),

        notes: formNotes.trim(),
        archived: false,
        updatedAt: nowISO,
        createdAt: nowISO, // overwrite below if editing
      };

      if (editingId) {
        // Retrieve creation date first or use fallback to preserve chronology
        const existingRef = financials.find((f) => f.id === editingId);
        payload.createdAt = existingRef?.createdAt || nowISO;

        await updateDoc(doc(db, "caseFinancials", editingId), payload as any);
        setSuccess("Cobrança jurídica atualizada com sucesso!");
      } else {
        await addDoc(collection(db, "caseFinancials"), payload as any);
        setSuccess("Cobrança fática cadastrada com sucesso!");
      }

      // REGRA DE CRIAÇÃO / ATUALIZAÇÃO VISÍVEL AO CLIENTE:
      // "Ao criar registro financeiro visível ao cliente: Atualizar cases/{caseId}"
      if (formVisibleToClient) {
        await updateDoc(doc(db, "cases", caseId!), {
          financialStatus: formFinancialStatus,
          hasFinancialRecord: true,
          statusPublicoCliente:
            caseObj?.statusPublicoCliente || "Aguardando documentos",
          updatedAt: nowISO,
        });
      }

      // Auto-trigger real-time GDocs Contract Generation using current operational conditions!
      const isInitial = !caseObj?.contratoHonorariosGoogleDocsUrl;
      await handleGenerateContratoHonorarios(isInitial ? "initial" : "new_version");

      resetForm();
      setRefreshToggle((prev) => prev + 1);
      setActiveSubStep(3);
    } catch (err: any) {
      console.error(err);
      setError(`Erro fático ao persistir cobrança: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditInit = (fee: CaseFinancial) => {
    setError(null);
    setSuccess(null);
    setEditingId(fee.id || null);

    if (chargeTypeOptions.includes(fee.chargeType)) {
      setFormChargeType(fee.chargeType);
      setCustomChargeType("");
    } else {
      setFormChargeType("Outro");
      setCustomChargeType(fee.chargeType);
    }

    setFormTotalAmount(String(fee.totalAmount || 0));
    setFormPaymentMethod(fee.paymentMethod || "Cartão de Crédito");
    setFormInstallments(fee.installments || 1);
    setFormFirstDueDate(fee.firstDueDate || "");
    setFormFinancialStatus(fee.financialStatus || "pendente");
    setFormVisibleToClient(fee.visibleToClient !== false);
    setFormPublicMessage(fee.publicFinancialMessage || "");

    setFormContractLinked(fee.contractLinked === true);
    setFormContractName(
      fee.contractName || "Contrato de Prestação de Serviços Jurídicos",
    );
    setFormContractUrl(fee.contractUrl || "");
    setFormContractVisible(fee.contractVisibleToClient !== false);

    setFormPaymentProvider(fee.paymentProvider || "manual_temporario");
    setFormPaymentStatus(fee.paymentStatus || "");
    setFormPaymentLink(fee.paymentLink || "");
    setFormExternalPaymentId(fee.externalPaymentId || "");
    setFormWebhookStatus(fee.webhookStatus || "");
    setFormLastWebhookAt(fee.lastWebhookAt || "");

    setFormStripeCustomerId(fee.stripeCustomerId || "");
    setFormStripeCheckoutId(fee.stripeCheckoutSessionId || "");
    setFormStripeIntentId(fee.stripePaymentIntentId || "");

    setFormAsaasCustomerId(fee.asaasCustomerId || "");
    setFormAsaasPaymentId(fee.asaasPaymentId || "");

    setFormNotes(fee.notes || "");
    setActiveSubStep(1);
  };

  const handleArchive = async (id: string) => {
    if (
      !window.confirm(
        "Tem certeza que deseja arquivar este faturamento? O registro continuará no banco de dados com a flag correspondente.",
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);
    const nowISO = new Date().toISOString();

    try {
      await updateDoc(doc(db, "caseFinancials", id), {
        archived: true,
        updatedAt: nowISO,
      });
      setSuccess("Faturamento arquivado com êxito.");
      setRefreshToggle((p) => p + 1);
    } catch (err: any) {
      console.error(err);
      setError(`Erro na ação de arquivamento fático: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormChargeType("Honorários fixos");
    setCustomChargeType("");
    setFormTotalAmount("0");
    setFormPaymentMethod("Cartão de Crédito");
    setFormInstallments(1);
    setFormFirstDueDate("");
    setFormFinancialStatus("pendente");
    setFormVisibleToClient(true);
    setFormPublicMessage("");

    setFormContractLinked(false);
    setFormContractName("Contrato de Prestação de Serviços Jurídicos");
    setFormContractUrl("");
    setFormContractVisible(true);

    setFormPaymentProvider("manual_temporario");
    setFormPaymentStatus("");
    setFormPaymentLink("");
    setFormExternalPaymentId("");
    setFormWebhookStatus("");
    setFormLastWebhookAt("");

    setFormStripeCustomerId("");
    setFormStripeCheckoutId("");
    setFormStripeIntentId("");

    setFormAsaasCustomerId("");
    setFormAsaasPaymentId("");

    setFormNotes("");
  };

  // Helper component for automatic receipt and payment proof upload
  const ComprovanteUploadBox = () => {
    const getValorParaRenomeacao = () => {
      const entradaLimpa = (valorEntradaForm || "0,00").replace("R$", "").trim();
      if (entradaLimpa !== "0,00" && entradaLimpa !== "") {
        return `R$ ${entradaLimpa}`;
      }
      const fixoLimpo = (honorarioFixoValorForm || "0,00").replace("R$", "").trim();
      if (fixoLimpo !== "0,00" && fixoLimpo !== "") {
        return `R$ ${fixoLimpo}`;
      }
      return "A Combinar";
    };

    const getTodayFormatted = () => {
      const d = new Date();
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const expectedName = `Comprovante de pagamento de Honorários Advocatícios - Valor: ${getValorParaRenomeacao()} - Data: ${getTodayFormatted()}`;

    return (
      <div className="space-y-2 mt-2 bg-slate-50 border border-slate-200 p-3.5 rounded-xl animate-fadeIn">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider font-mono">
            Anexo de Comprovante (Renomeação Automática)
          </label>
        </div>
        <div className="text-[11px] text-gray-500 font-semibold leading-relaxed">
          O arquivo enviado será automaticamente renomeado para: <br/>
          <span className="font-mono text-indigo-700 font-bold break-all bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100 block mt-1">
            {expectedName}.[ext]
          </span>
        </div>
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-3 bg-white hover:bg-gray-50/50 transition-all cursor-pointer">
          <UploadCloud
            className="text-gray-400 group-hover:text-indigo-600 mb-1"
            size={20}
          />
          <span className="text-[11px] font-bold text-gray-700 font-sans">
            Clique para selecionar ou arraste o comprovante
          </span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const originalName = file.name;
                const size = (file.size / 1024 / 1024).toFixed(2) + " MB";
                const lastDotIndex = originalName.lastIndexOf('.');
                const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
                const finalName = `${expectedName}${extension}`;
                
                setComprovantesMeioPagamentoForm((prev) => [
                  ...prev,
                  { name: finalName, size, uploadedAt: new Date().toISOString() },
                ]);
              }
            }}
          />
        </label>
        {comprovantesMeioPagamentoForm.length > 0 && (
          <div className="space-y-1 mt-2">
            {comprovantesMeioPagamentoForm.map((f: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-[11px]"
              >
                <span className="truncate font-semibold text-indigo-900 flex items-center gap-1.5 font-mono">
                  <FileText size={12} className="text-indigo-500" /> {f.name}{" "}
                  <span className="text-[9px] text-indigo-400 font-normal">
                    ({f.size})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setComprovantesMeioPagamentoForm((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="text-rose-600 hover:bg-rose-100 p-1 rounded-lg transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ApiLinkBox = ({ link }: { link: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="space-y-1.5 bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl animate-fadeIn mt-2">
        <label className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
          Link de Pagamento Gerado Automaticamente (API)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={link}
            className="flex-1 px-3 py-1.5 bg-white border border-gray-250 rounded-lg text-[11px] font-mono font-medium text-gray-700 select-all outline-none"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-lg transition whitespace-nowrap"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-extrabold rounded-lg transition flex items-center gap-1 border border-gray-300"
          >
            Testar <ExternalLink size={11} />
          </a>
        </div>
        <p className="text-[9px] font-bold text-indigo-500/80 font-sans italic">
          *Este link foi provisionado via integração direta do portal BOSS com a plataforma de faturamento.
        </p>
      </div>
    );
  };

  const handleSaveAndAdvance = async () => {
    setSaving(true);
    setError(null);
    const nowISO = new Date().toISOString();

    if (activeSubStep === 1) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/ver.detalhes.do.contrato.de.honorarios`);
      setSaving(false);
      return;
    }

    if (activeSubStep === 2) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/auditoria.do.contrato.de.honorarios`);
      setSaving(false);
      return;
    }

    if (activeSubStep === 3) {
      const url = caseObj?.contratoHonorariosGoogleDocsUrl || "";
      const isUrlValid = 
        url.startsWith("https://docs.google.com/document/d/") &&
        !url.includes("simulated=true") &&
        !url.includes("mock") &&
        !url.includes("fake") &&
        !url.includes("demo") &&
        !url.includes("showcase") &&
        !url.includes("undefined") &&
        !url.includes("null");

      const q3_1_ok = wizardState?.q3_1 === "sim";
      const q3_2_ok = !!wizardState?.q3_2;
      const q3_3_ok = Array.isArray(wizardState?.q3_3) && wizardState?.q3_3.length > 0;
      const q3_4_ok = wizardState?.q3_4 === "sim";
      const q3_5_ok = wizardState?.q3_5 === "sim";
      const q3_6_ok = wizardState?.q3_6 === "sim";
      const q3_7_ok = wizardState?.q3_7 === "sim";
      const q3_8_ok = wizardState?.q3_8 === "sim";

      if (!q3_1_ok || !isUrlValid || !q3_2_ok || !q3_3_ok || !q3_4_ok || !q3_5_ok || !q3_6_ok || !q3_7_ok || !q3_8_ok) {
        setError("Não é possível concluir o Financeiro. Finalize a Auditoria do Contrato de Honorários, incluindo geração real, assinaturas, entrega, recebimento do documento digitalizado e informação ao Financeiro.");
        setSaving(false);
        return;
      }

      try {
        const payload = {
          financeiroStatus: "faturado",
          financialCompleted: true,
          financeiroAuditCompleted: true,
          financeiroAuditCompletedAt: nowISO,
          financeiroCompletedAt: nowISO,
          financeiroCompletionSource: "auditoria_contrato_honorarios",
          productionStage: "edrp",
          updatedAt: nowISO,
        };

        await updateDoc(doc(db, "cases", caseId!), payload);

        try {
          await setDoc(doc(db, "casos", caseId!), payload, { merge: true });
        } catch (mirrorErr) {
          console.warn('Silent mirror save warning:', mirrorErr);
        }

        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId!}/card-iniciar-coleta-obrigatoria`);
      } catch (err: any) {
        console.error(err);
        setError(`Erro ao atualizar etapa de faturamento e produção: ${err.message}`);
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      await updateDoc(doc(db, "cases", caseId!), {
        productionStage: "edrp",
        updatedAt: nowISO,
      });
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId!}/card-iniciar-coleta-obrigatoria`);
    } catch (err: any) {
      console.error(err);
      setError(
        `Erro ao atualizar etapa de produção para avanço: ${err.message}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    navigate("/boss-giffoni-clientes/fluxo-producao");
  };

  const getStatusBadgeStyles = (status: CaseFinancial["financialStatus"]) => {
    switch (status) {
      case "pago":
        return "bg-emerald-50 text-emerald-700 border-emerald-250";
      case "parcialmente_pago":
        return "bg-teal-50 text-teal-800 border-teal-200";
      case "aguardando_pagamento":
        return "bg-blue-50 text-blue-750 border-blue-200";
      case "em_atraso":
        return "bg-rose-50 text-rose-750 border-rose-250 font-bold";
      case "cancelado":
        return "bg-gray-100 text-gray-550 border-gray-250";
      case "renegociado":
        return "bg-purple-50 text-purple-750 border-purple-200";
      case "aguardando_webhook":
        return "bg-amber-50 text-amber-700 border-amber-200 animate-pulse";
      case "erro_webhook":
        return "bg-red-50 text-red-750 border-red-250";
      default:
        return "bg-gray-55/60 text-gray-700 border-gray-200";
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  if (!caseId) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 bg-white border border-red-200 rounded-3xl shadow-sm text-center">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-gray-900 uppercase">
          Acesso Bloqueado
        </h3>
        <p className="text-xs text-gray-500 mt-2">
          Não há indexador fático associado a essa rota em paralelo.
        </p>
        <button
          type="button"
          onClick={() => navigate("/boss-giffoni-clientes/fluxo-producao")}
          className="mt-6 inline-flex bg-gray-900 hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer"
        >
          Retornar ao Painel
        </button>
      </div>
    );
  }

  return (
    <FluxoStepLayout
      stepName="Financeiro"
      caseId={caseId}
      statusText={caseObj?.status === "rascunho" ? "Rascunho" : "Ativo"}
    >
      <div className="space-y-6">
        {/* FEEDBACK LABELS */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center animate-fadeIn">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center animate-fadeIn">
            <Check className="text-emerald-500 shrink-0" size={16} />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* METADATA ACCORDING TO UX REQS & REGRA 2 */}
        {!fetching && caseObj && (
          <div className="bg-gray-50/75 border border-gray-150 rounded-2xl p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="space-y-1 pb-4 sm:pb-0">
                <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">
                  Cliente Titular
                </span>
                <h4 className="text-sm font-bold text-gray-950 break-words block whitespace-normal pr-4">
                  {clientName || "Carregando..."}
                </h4>
              </div>
              <div className="space-y-1 sm:pl-4 pb-4 sm:pb-0">
                <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">
                  Modalidade
                </span>
                <h4 className="text-sm font-bold text-gray-900 break-words uppercase tracking-tight">
                  {caseObj.registrationType}
                </h4>
                <span className="inline-block text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-750 rounded-md font-mono mt-0.5">
                  {caseObj.registrationTypeKey || "Ajuizado"}
                </span>
              </div>
              <div className="space-y-1 sm:pl-4">
                <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">
                  Controle Operacional
                </span>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    Interno:{" "}
                    <span className="font-bold text-gray-700">
                      {caseObj.statusInterno || "Em produção"}
                    </span>
                  </div>
                  <div>
                    Público:{" "}
                    <span className="font-bold text-indigo-750 whitespace-normal break-all">
                      {caseObj.statusPublicoCliente || "Aguardando..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-STEP NAVIGATION SHARDS - REGRA 6 */}
        {!fetching && caseObj && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-gray-150 pb-4 mb-4">
            {[
              {
                id: 1 as const,
                title: "SubEtapa 01",
                label: `Criar Contrato de Honorários - ${clientName || "Cliente"}`,
                icon: FileText,
              },
              {
                id: 2 as const,
                title: "SubEtapa 02",
                label: `Ver detalhes do Contrato de honorários - ${clientName || "Cliente"}`,
                icon: Coins,
              },
              {
                id: 3 as const,
                title: "SubEtapa 03",
                label: "Auditoria do Contrato de honorários",
                icon: Shield,
              },
            ].map((sub) => {
              const Icon = sub.icon;
              const isSelected = activeSubStep === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    if (sub.id === 1) {
                      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/Criar Contrato de Honorários`);
                    } else if (sub.id === 2) {
                      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/ver.detalhes.do.contrato.de.honorarios`);
                    } else if (sub.id === 3) {
                      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/auditoria.do.contrato.de.honorarios`);
                    }
                    resetForm();
                  }}
                  className={`flex items-start gap-3 text-left p-4 border rounded-2xl transition duration-150 hover:bg-gray-50/50 cursor-pointer h-auto ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-500 text-indigo-950 shadow-3xs ring-1"
                      : "bg-white border-gray-200 text-gray-500"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${isSelected ? "bg-indigo-100 text-indigo-705" : "bg-gray-50 text-gray-400"}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block text-[9px] font-extrabold uppercase tracking-widest font-mono ${
                        isSelected ? "text-indigo-650" : "text-gray-400"
                      }`}
                    >
                      {sub.title}
                    </span>

                    <span className="block mt-1 text-xs font-black leading-snug whitespace-normal break-words overflow-visible">
                      {sub.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ETAPA 1 CONTRATO E CONDICOES FINANCEIRAS */}
        {!fetching && caseObj && activeSubStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* INDICADOR CENTRAL DE CONEXÃO GOOGLE */}
              <div className="bg-white border border-gray-150 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-3xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${googleAccessToken ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {googleAccessToken ? "Google Conectado" : "A conexão Google ainda não está disponível"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                      {googleAccessToken 
                        ? "Seu ambiente Google está pronto e integrado. Todas as automações herdarão esta sessão de forma centralizada."
                        : "Sua sessão Google ainda não está ativa. Por favor, conecte para que as automações herdem suas credenciais."}
                    </p>
                  </div>
                </div>
                {!googleAccessToken ? (
                  <button
                    type="button"
                    onClick={() => loginWithGoogle("boss_admin")}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-3xs cursor-pointer font-bold shrink-0"
                  >
                    Conectar Google
                  </button>
                ) : (
                  <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-150 font-mono tracking-wider font-extrabold shrink-0">
                    Sessão Ativa
                  </span>
                )}
              </div>

              {/* CARD 1: CONDIÇÕES OPERACIONAIS DO CONTRATO */}
              <form
                id="financeiro-operacional-form"
                onSubmit={handleSaveFinanceiroCondicoes}
                className="bg-white border border-gray-150 rounded-2xl p-6 space-y-4 shadow-3xs"
              >
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                    Condições Operacionais do Contrato
                  </h4>
                  <span className="inline-flex bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md text-[10px] uppercase font-black font-mono">
                    {client?.type === "PF" ? "Contrato PF" : "Contrato PJ"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                  Insira os parâmetros oficiais acordados com o cliente. Após
                  gravar, execute o assistente de Automação do Google Docs logo
                  abaixo para gerar a minuta de honorários real e dinâmica no
                  Google Docs.
                </p>

                <div className="grid grid-cols-1 gap-5">
                  {/* Extracted read-only Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-indigo-500 tracking-wide font-mono">
                          Área do Direito
                        </label>
                        <button
                          type="button"
                          onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/tipo-producao/peticao-inicial`)}
                          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-all p-1 rounded-lg flex items-center gap-1.5 text-[10px] font-bold tracking-tight font-sans cursor-pointer"
                          title="Ir para Tipo de Serviço - Petição Inicial"
                        >
                          <Pencil className="w-3 h-3 text-indigo-600" />
                          <span>Editar</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={caseObj?.areaDireito || "Não especificada"}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 cursor-not-allowed outline-none font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-indigo-500 tracking-wide font-mono">
                        Assunto
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={caseObj?.assunto || caseObj?.title || "Não especificado"}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 cursor-not-allowed outline-none font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-indigo-500 tracking-wide font-mono">
                        Sub-área
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={caseObj?.temSubArea === "sim" ? (caseObj?.subArea || "Sem sub-área") : "Não aplicável"}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 cursor-not-allowed outline-none font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-indigo-500 tracking-wide font-mono">
                        Tipo do serviço contratado
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={tipoServicoContratadoForm || "Não especificado"}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 cursor-not-allowed outline-none font-sans"
                      />
                    </div>
                  </div>

                  {/* Dynamic Area logic */}
                  {(() => {
                    const area = caseObj?.areaDireito || "";
                    const isCivilLike = area === "Direito Civil" || area === "Direito Administrativo" || area === "Direito Tributário" || area === "Direito Ambiental" || area === "Direito Bancário" || area === "Direito do Consumidor";
                    const isTrabReclamante = area === "Direito do Trabalho - Reclamante";
                    const isTrabReclamada = area === "Direito do Trabalho - Reclamada";
                    const isPrevidenciario = area === "Direito Previdenciário -  INSS - RGPS" || area === "Direito Previdenciário - RPPS - Outros Regimes";
                    const isCustomArea = !isCivilLike && !isTrabReclamante && !isTrabReclamada && !isPrevidenciario && area !== "";

                    // Allowed fee models list
                    let feeOptions: { value: string; label: string }[] = [];
                    if (isCivilLike || isCustomArea) {
                      // Custom area allowed fees
                      const allowed = caseObj?.customAreaFeesMap?.[area] || ["fixo", "exito_simples", "misto"];
                      if (allowed.includes("fixo")) feeOptions.push({ value: "fixo", label: "1. Honorários Fixos" });
                      if (allowed.includes("exito_simples")) feeOptions.push({ value: "exito_simples", label: "2. Honorários de êxito simples (sobre o proveito econômico)" });
                      if (allowed.includes("misto")) feeOptions.push({ value: "misto", label: "3. Honorários Misto (Honorários Fixos + Honorários de êxito)" });
                    } else if (isTrabReclamante) {
                      feeOptions = [
                        { value: "exito_trabalhista_reclamante", label: "1. Honorários de êxito Trabalhista - Reclamante" },
                        { value: "fixo", label: "2. Honorários Fixos" }
                      ];
                    } else if (isTrabReclamada) {
                      feeOptions = [
                        { value: "fixo", label: "1. Honorários Fixos" },
                        { value: "exito_trabalhista_reclamada", label: "2. Honorários de êxito Trabalhista - Reclamada (Honorários negativos - % sobre o que deixar de pagar)" },
                        { value: "misto_trabalhista_reclamada", label: "3. Honorários Misto (Honorários Fixos + Honorários de êxito negativos)" }
                      ];
                    } else if (isPrevidenciario) {
                      feeOptions = [
                        { value: "exito_previdenciario_beneficio_temporario", label: "1. Honorários de êxito Previdenciário (Benefícios Temporários - Auxílios)" },
                        { value: "exito_previdenciario_aposentadoria", label: "2. Honorários de êxito Previdenciário (Aposentadorias e BPC - Percentual sobre Atrasados + Mensalidades)" },
                        { value: "fixo", label: "3. Honorários Fixos (Parecer, Planejamento, Consulta, Auditoria)" }
                      ];
                    } else {
                      feeOptions = [
                        { value: "fixo", label: "1. Honorários Fixos" },
                        { value: "exito_simples", label: "2. Honorários de êxito simples" },
                        { value: "misto", label: "3. Honorários Mistos" }
                      ];
                    }

                    // Render parameters block for Fixed Fees
                    const renderFixedParameters = (title = "Parâmetros dos honorários Fixos") => (
                      <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                          {title}
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                              Valor Fixo Total
                            </label>
                            <input
                              type="text"
                              value={honorarioFixoValorForm}
                              onChange={(e) => setHonorarioFixoValorForm(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                              placeholder="Ex: R$ 3.500,00"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-455 tracking-wide font-mono">
                              Forma de Pagamento
                            </label>
                            <select
                              value={formaPagamentoForm}
                              onChange={(e) => setFormaPagamentoForm(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-255 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                            >
                              <option value="À vista">À vista</option>
                              <option value="Parcelado">Parcelado</option>
                              <option value="Entrada + Parcelado">Entrada + Parcelado</option>
                            </select>
                          </div>

                          {formaPagamentoForm === "Entrada + Parcelado" && (
                            <>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                  Valor da Entrada
                                </label>
                                <input
                                  type="text"
                                  value={valorEntradaForm}
                                  onChange={(e) => setValorEntradaForm(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                  placeholder="Ex: R$ 1.000,00"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                  Data de Vencimento/Pagamento da Entrada
                                </label>
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="date"
                                    disabled={pagoNaAssinaturaForm}
                                    value={dataVencimentoEntradaForm}
                                    onChange={(e) => setDataVencimentoEntradaForm(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                  />
                                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={pagoNaAssinaturaForm}
                                      onChange={(e) => {
                                        setPagoNaAssinaturaForm(e.target.checked);
                                        if (e.target.checked) {
                                          setDataVencimentoEntradaForm("");
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Pago na data da assinatura do contrato
                                  </label>
                                </div>
                              </div>
                            </>
                          )}

                          {(formaPagamentoForm === "Parcelado" || formaPagamentoForm === "Entrada + Parcelado") && (
                            <>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                  Quantidade de Parcelas (Até 60x)
                                </label>
                                <select
                                  value={quantidadeParcelasForm}
                                  onChange={(e) => setQuantidadeParcelasForm(Number(e.target.value))}
                                  className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition font-sans"
                                >
                                  {Array.from({ length: 60 }, (_, idx) => idx + 1).map((n) => (
                                    <option key={n} value={n}>{n}x</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                  Valor da Parcela (Calculado)
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    readOnly
                                    disabled
                                    value={`R$ ${valorParcelaForm}`}
                                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 cursor-not-allowed outline-none font-sans"
                                  />
                                  <span className="absolute right-3 top-2.5 text-[8px] font-black uppercase tracking-wider text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
                                    Auto
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono flex items-center justify-between">
                                  <span>Data do 1 vencimento</span>
                                  <label className="flex items-center gap-1 cursor-pointer normal-case text-gray-400 font-semibold select-none hover:text-gray-600 transition">
                                    <input
                                      type="checkbox"
                                      checked={dataPrimeiroVencimentoADefinir}
                                      onChange={(e) => {
                                        setDataPrimeiroVencimentoADefinir(e.target.checked);
                                        if (e.target.checked) {
                                          setDataPrimeiroVencimentoForm("");
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                                    />
                                    <span className="text-[8px]">A definir</span>
                                  </label>
                                </label>
                                <input
                                  type="date"
                                  disabled={dataPrimeiroVencimentoADefinir}
                                  min={new Date().toISOString().split("T")[0]}
                                  value={dataPrimeiroVencimentoForm}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const todayStr = new Date().toISOString().split("T")[0];
                                    if (val && val < todayStr) {
                                      setError("A data do primeiro vencimento não pode ser inferior à data de hoje.");
                                      setDataPrimeiroVencimentoForm(todayStr);
                                      const dateObj = new Date(todayStr + "T12:00:00");
                                      if (!isNaN(dateObj.getTime())) {
                                        setDiaVencimentoForm(String(dateObj.getDate()));
                                      }
                                      return;
                                    }
                                    setError(null);
                                    setDataPrimeiroVencimentoForm(val);
                                    if (val) {
                                      const dateObj = new Date(val + "T12:00:00");
                                      if (!isNaN(dateObj.getTime())) {
                                        setDiaVencimentoForm(String(dateObj.getDate()));
                                      }
                                    }
                                  }}
                                  className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold outline-none transition font-sans ${
                                    dataPrimeiroVencimentoADefinir
                                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                      : "bg-white border-gray-250 focus:border-indigo-500 text-gray-800"
                                  }`}
                                />
                                <p className="text-[9px] text-gray-400 font-medium font-sans leading-tight mt-0.5">
                                  * este dia será automaticamente selecionado para os meses seguintes
                                </p>
                              </div>

                              <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl">
                                <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                                  📌 As parcelas serão fixas, mensais, iguais e sucessivas, com o mesmo dia de vencimento em cada mes
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );

                    // Render parameters block for Success Fees
                    const renderSuccessParameters = (title = "Parâmetros de Êxito Contratual") => (
                      <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                          {title}
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                              Percentual de Êxito
                            </label>
                            <input
                              type="text"
                              value={percentualExitoForm}
                              onChange={(e) => {
                                setPercentualExitoForm(e.target.value);
                                setHonorarioExitoPercentualForm(e.target.value);
                              }}
                              className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                              placeholder="Ex: 30%"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-455 tracking-wide font-mono">
                              Base de Cálculo dos Honorários de Êxito
                            </label>
                            <input
                              type="text"
                              value={baseCalculoExitoForm}
                              onChange={(e) => setBaseCalculoExitoForm(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                              placeholder="Ex: Proveito econômico auferido pelo cliente"
                            />
                          </div>
                        </div>
                      </div>
                    );

                    // Reclamante update helper
                    const updateBaseCalculoTrabReclamante = (vRes: boolean, fgts: boolean, fgtsInd: boolean, multa: boolean, multaInd: boolean, seg: boolean) => {
                      const parts: string[] = [];
                      if (vRes) parts.push("Verbas Rescisórias");
                      if (fgts) {
                        parts.push(fgtsInd ? "FGTS independente de saque" : "FGTS");
                      }
                      if (multa) {
                        parts.push(multaInd ? "Multa de 40% do FGTS independente de saque" : "Multa de 40% do FGTS");
                      }
                      if (seg) parts.push("Seguro Desemprego");
                      setBaseCalculoExitoForm(parts.length > 0 ? parts.join(", ") : "Proveito Econômico");
                    };

                    return (
                      <>
                        {/* 2. Tipo de Honorários Select */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-indigo-950 tracking-wide font-mono">
                            Tipo de Honorários
                          </label>
                          <select
                            value={modeloHonorariosForm}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModeloHonorariosForm(val);
                              
                              // Set compatibility values
                              let compatTipo = "Honorários Fixos";
                              let mappedQ32 = "fixo";
                              if (val === "fixo") {
                                compatTipo = "Honorários Fixos";
                                mappedQ32 = "fixo";
                              } else if (val.includes("exito")) {
                                compatTipo = "Êxito";
                                mappedQ32 = "exito";
                              } else {
                                compatTipo = "Misto (Fixo + Êxito)";
                                mappedQ32 = "exito_fixo";
                              }
                              setTipoHonorarioForm(compatTipo);
                              saveWizardStateUpdate({ q3_1: "sim", q3_2: mappedQ32 });
                            }}
                            className="w-full px-3 py-2 bg-gray-55 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                          >
                            <option value="">Selecione o tipo de honorários</option>
                            {feeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* RENDER CONDITIONS BASED ON MODEL SELECTED */}

                        {/* CIVIL / CUSTOM LIKE */}
                        {(isCivilLike || isCustomArea) && (
                          <>
                            {modeloHonorariosForm === "fixo" && renderFixedParameters()}
                            {modeloHonorariosForm === "exito_simples" && renderSuccessParameters()}
                            {modeloHonorariosForm === "misto" && (
                              <div className="space-y-4">
                                {renderFixedParameters("Parâmetros de Honorários Fixos")}
                                {renderSuccessParameters("Parâmetros de Honorários de Êxito")}
                              </div>
                            )}
                          </>
                        )}

                        {/* TRABALHISTA RECLAMANTE */}
                        {isTrabReclamante && (
                          <>
                            {modeloHonorariosForm === "fixo" && renderFixedParameters()}
                            {modeloHonorariosForm === "exito_trabalhista_reclamante" && (
                              <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                  Parâmetros de Êxito Contratual — Trabalhista Reclamante
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                      Percentual de Êxito
                                    </label>
                                    <input
                                      type="text"
                                      value={percentualExitoForm}
                                      onChange={(e) => {
                                        setPercentualExitoForm(e.target.value);
                                        setHonorarioExitoPercentualForm(e.target.value);
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                      placeholder="Ex: 30%"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-455 tracking-wide font-mono">
                                      Base de Cálculo Real (Calculada dos Checkboxes)
                                    </label>
                                    <input
                                      type="text"
                                      readOnly
                                      disabled
                                      value={baseCalculoExitoForm}
                                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 cursor-not-allowed outline-none transition"
                                    />
                                  </div>

                                  {/* Checkbox Group */}
                                  <div className="md:col-span-2 space-y-2.5 bg-white border border-gray-150 p-3 rounded-xl">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider font-mono">
                                      Selecione as Verbas Integrantes da Base de Cálculo
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                      <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                        <input
                                          type="checkbox"
                                          checked={reclamanteVerbasRescisorias}
                                          onChange={(e) => {
                                            setReclamanteVerbasRescisorias(e.target.checked);
                                            updateBaseCalculoTrabReclamante(e.target.checked, reclamanteFGTS, reclamanteFGTSIndep, reclamanteMultaFGTS, reclamanteMultaFGTSIndep, reclamanteSeguroDesemprego);
                                          }}
                                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Verbas Rescisórias
                                      </label>

                                      <div className="space-y-1">
                                        <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                          <input
                                            type="checkbox"
                                            checked={reclamanteFGTS}
                                            onChange={(e) => {
                                              setReclamanteFGTS(e.target.checked);
                                              updateBaseCalculoTrabReclamante(reclamanteVerbasRescisorias, e.target.checked, reclamanteFGTSIndep, reclamanteMultaFGTS, reclamanteMultaFGTSIndep, reclamanteSeguroDesemprego);
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                          />
                                          FGTS
                                        </label>
                                        {reclamanteFGTS && (
                                          <label className="flex items-center gap-1.5 pl-5 text-gray-500 font-semibold cursor-pointer text-2xs">
                                            <input
                                              type="checkbox"
                                              checked={reclamanteFGTSIndep}
                                              onChange={(e) => {
                                                setReclamanteFGTSIndep(e.target.checked);
                                                updateBaseCalculoTrabReclamante(reclamanteVerbasRescisorias, reclamanteFGTS, e.target.checked, reclamanteMultaFGTS, reclamanteMultaFGTSIndep, reclamanteSeguroDesemprego);
                                              }}
                                              className="rounded border-gray-300 text-indigo-550 focus:ring-indigo-550"
                                            />
                                            independente de saque
                                          </label>
                                        )}
                                      </div>

                                      <div className="space-y-1">
                                        <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                          <input
                                            type="checkbox"
                                            checked={reclamanteMultaFGTS}
                                            onChange={(e) => {
                                              setReclamanteMultaFGTS(e.target.checked);
                                              updateBaseCalculoTrabReclamante(reclamanteVerbasRescisorias, reclamanteFGTS, reclamanteFGTSIndep, e.target.checked, reclamanteMultaFGTSIndep, reclamanteSeguroDesemprego);
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                          />
                                          Multa de 40% do FGTS
                                        </label>
                                        {reclamanteMultaFGTS && (
                                          <label className="flex items-center gap-1.5 pl-5 text-gray-500 font-semibold cursor-pointer text-2xs">
                                            <input
                                              type="checkbox"
                                              checked={reclamanteMultaFGTSIndep}
                                              onChange={(e) => {
                                                setReclamanteMultaFGTSIndep(e.target.checked);
                                                updateBaseCalculoTrabReclamante(reclamanteVerbasRescisorias, reclamanteFGTS, reclamanteFGTSIndep, reclamanteMultaFGTS, e.target.checked, reclamanteSeguroDesemprego);
                                              }}
                                              className="rounded border-gray-300 text-indigo-550 focus:ring-indigo-550"
                                            />
                                            independente de saque
                                          </label>
                                        )}
                                      </div>

                                      <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer text-xs">
                                        <input
                                          type="checkbox"
                                          checked={reclamanteSeguroDesemprego}
                                          onChange={(e) => {
                                            setReclamanteSeguroDesemprego(e.target.checked);
                                            updateBaseCalculoTrabReclamante(reclamanteVerbasRescisorias, reclamanteFGTS, reclamanteFGTSIndep, reclamanteMultaFGTS, reclamanteMultaFGTSIndep, e.target.checked);
                                          }}
                                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Seguro Desemprego
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* TRABALHISTA RECLAMADA */}
                        {isTrabReclamada && (
                          <>
                            {modeloHonorariosForm === "fixo" && renderFixedParameters()}
                            {modeloHonorariosForm === "exito_trabalhista_reclamada" && (
                              <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                  Parâmetros de Êxito Negativo — Reclamada
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                      Percentual de Êxito (% sobre o que deixar de pagar)
                                    </label>
                                    <input
                                      type="text"
                                      value={percentualExitoForm}
                                      onChange={(e) => {
                                        setPercentualExitoForm(e.target.value);
                                        setHonorarioExitoPercentualForm(e.target.value);
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                      placeholder="Ex: 20%"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                      Valor da Causa (Base)
                                    </label>
                                    <input
                                      type="text"
                                      value={valorCausaReclamada}
                                      onChange={(e) => {
                                        setValorCausaReclamada(e.target.value);
                                        setBaseCalculoExitoForm(`% sobre o que deixar de pagar com base no valor da causa de R$ ${e.target.value}`);
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                      placeholder="Ex: R$ 80.000,00"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            {modeloHonorariosForm === "misto_trabalhista_reclamada" && (
                              <div className="space-y-4">
                                {renderFixedParameters("Parâmetros de Honorários Fixos")}
                                <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                    Parâmetros de Honorários de Êxito Negativos
                                  </h4>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                        Percentual de Êxito Negativo
                                      </label>
                                      <input
                                        type="text"
                                        value={percentualExitoForm}
                                        onChange={(e) => {
                                          setPercentualExitoForm(e.target.value);
                                          setHonorarioExitoPercentualForm(e.target.value);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                        placeholder="Ex: 20%"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                        Valor da Causa (Base)
                                      </label>
                                      <input
                                        type="text"
                                        value={valorCausaReclamada}
                                        onChange={(e) => {
                                          setValorCausaReclamada(e.target.value);
                                          setBaseCalculoExitoForm(`% sobre o que deixar de pagar com base no valor da causa de R$ ${e.target.value}`);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                        placeholder="Ex: R$ 80.000,00"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* PREVIDENCIARIO */}
                        {isPrevidenciario && (
                          <>
                            {modeloHonorariosForm === "fixo" && renderFixedParameters("Parâmetros de Honorários Fixos (Parecer, Planejamento, Consulta)")}
                            {modeloHonorariosForm === "exito_previdenciario_beneficio_temporario" && (
                              <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                  Parâmetros de Êxito Previdenciário — Benefícios Temporários
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                  <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                      Válido para o Contrato de:
                                    </label>
                                    <div className="flex gap-2">
                                      <select
                                        value={servicosTemporariosSelected}
                                        onChange={(e) => {
                                          setServicosTemporariosSelected(e.target.value);
                                          setBaseCalculoExitoForm(`Proveito econômico obtido sobre o benefício de ${e.target.value}`);
                                        }}
                                        className="flex-1 px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                      >
                                        {servicosTemporariosList.map((svc) => (
                                          <option key={svc} value={svc}>{svc}</option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const added = prompt("Qual o nome do novo serviço previdenciário temporário?");
                                          if (added && added.trim()) {
                                            setServicosTemporariosList(prev => [...prev, added.trim()]);
                                            setServicosTemporariosSelected(added.trim());
                                            setBaseCalculoExitoForm(`Proveito econômico obtido sobre o benefício de ${added.trim()}`);
                                          }
                                        }}
                                        className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition whitespace-nowrap"
                                      >
                                        + Add temporário
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                      Percentual de Êxito
                                    </label>
                                    <input
                                      type="text"
                                      value={percentualExitoForm}
                                      onChange={(e) => {
                                        setPercentualExitoForm(e.target.value);
                                        setHonorarioExitoPercentualForm(e.target.value);
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-gray-255 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                      placeholder="Ex: 30%"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-455 tracking-wide font-mono">
                                      Base de Cálculo
                                    </label>
                                    <input
                                      type="text"
                                      value={baseCalculoExitoForm}
                                      onChange={(e) => setBaseCalculoExitoForm(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-gray-255 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {modeloHonorariosForm === "exito_previdenciario_aposentadoria" && (
                              <div className="space-y-4">
                                <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-4 animate-fadeIn">
                                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                    Parâmetros de Êxito Previdenciário — Aposentadorias e BPC
                                  </h4>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1 md:col-span-2">
                                      <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                        Sub-área / Benefício Previdenciário:
                                      </label>
                                      <div className="flex gap-2">
                                        <select
                                          value={aposentadoriasSelected}
                                          onChange={(e) => setAposentadoriasSelected(e.target.value)}
                                          className="flex-1 px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                        >
                                          {aposentadoriasList.map((ap) => (
                                            <option key={ap} value={ap}>{ap}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const added = prompt("Qual o nome do novo benefício previdenciário?");
                                            if (added && added.trim()) {
                                              setAposentadoriasList(prev => [...prev, added.trim()]);
                                              setAposentadoriasSelected(added.trim());
                                            }
                                          }}
                                          className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition whitespace-nowrap"
                                        >
                                          + Add subárea
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                        % Incidente sobre os Atrasados
                                      </label>
                                      <input
                                        type="text"
                                        value={percentualExitoSobreRetroativoForm}
                                        onChange={(e) => {
                                          setPercentualExitoSobreRetroativoForm(e.target.value);
                                          setHonorarioExitoPercentualForm(e.target.value);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                        placeholder="Ex: 30%"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                        Quantidade de Mensalidades de Benefício Futuro
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={quantidadeParcelasExitoPrevidenciarioForm}
                                        onChange={(e) => setQuantidadeParcelasExitoPrevidenciarioForm(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white border border-gray-250 focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                        placeholder="Ex: 3"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Valor dos honorários sobre o mês-a-mês */}
                                {renderFixedParameters("Qual será o valor dos honorários sobre o mês a mês? (Parâmetros dos honorários mensais)")}
                              </div>
                            )}
                          </>
                        )}

                        {/* TIPO DE RECEBIMENTO & PIX FIELDS (HIDDEN exclusively for pure exito models) */}
                        {!["exito_simples", "exito_trabalhista_reclamante", "exito_trabalhista_reclamada", "exito_previdenciario_beneficio_temporario"].includes(modeloHonorariosForm) && (
                          <div className="bg-slate-50/50 border border-slate-150 p-5 rounded-2xl space-y-5 animate-fadeIn">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 font-mono">
                                Parâmetros de Recebimento de honorários fixos
                              </h4>
                              {/* Visual badge representing the active payment method */}
                              {(() => {
                                if (tipoRecebimentoForm === "PIX") {
                                  return (
                                    <span className="flex items-center gap-1 bg-teal-50 text-teal-700 text-[10px] font-black border border-teal-200 px-2 py-0.5 rounded-md uppercase font-mono">
                                      <QrCode size={11} /> PIX Oficial
                                    </span>
                                  );
                                }
                                if (tipoRecebimentoForm === "Boleto") {
                                  return (
                                    <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-200 px-2 py-0.5 rounded-md uppercase font-mono">
                                      <Barcode size={11} /> Boleto
                                    </span>
                                  );
                                }
                                if (tipoRecebimentoForm === "Cartão de Crédito") {
                                  return (
                                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-200 px-2 py-0.5 rounded-md uppercase font-mono">
                                      <CreditCard size={11} /> Cartão
                                    </span>
                                  );
                                }
                                if (tipoRecebimentoForm === "Dinheiro") {
                                  return (
                                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200 px-2 py-0.5 rounded-md uppercase font-mono">
                                      <Banknote size={11} /> Dinheiro
                                    </span>
                                  );
                                }
                                if (tipoRecebimentoForm === "Transferência Bancária") {
                                  return (
                                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-200 px-2 py-0.5 rounded-md uppercase font-mono">
                                      <Landmark size={11} /> Transferência
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-gray-450 tracking-wide font-mono">
                                  Meio de Pagamento
                                </label>
                                <select
                                  value={tipoRecebimentoForm}
                                  onChange={(e) => setTipoRecebimentoForm(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 outline-none transition focus:border-indigo-500"
                                >
                                  <option value="PIX">PIX</option>
                                  <option value="Boleto">Boleto</option>
                                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                                  <option value="Dinheiro">Dinheiro</option>
                                  <option value="Transferência Bancária">Transferência Bancária</option>
                                </select>
                              </div>

                              {/* CONDITIONAL LAYOUTS */}

                              {tipoRecebimentoForm === "PIX" && (
                                <div className="space-y-4 bg-teal-50/20 border border-teal-100 p-4 rounded-xl animate-fadeIn">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                    Configuração de Recebimento via PIX
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                        Banco do PIX
                                      </label>
                                      <input
                                        type="text"
                                        value={pixBancoForm}
                                        onChange={(e) => setPixBancoForm(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 focus:border-indigo-500 outline-none transition"
                                        placeholder="Ex: Banco Itaú"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                        Chave PIX
                                      </label>
                                      <input
                                        type="text"
                                        value={pixChaveForm}
                                        onChange={(e) => setPixChaveForm(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 focus:border-indigo-500 outline-none transition"
                                        placeholder="E-mail, CNPJ, CPF..."
                                      />
                                    </div>
                                  </div>

                                  <ComprovanteUploadBox />
                                </div>
                              )}

                              {tipoRecebimentoForm === "Boleto" && (
                                <div className="space-y-4 bg-amber-50/20 border border-amber-100 p-4 rounded-xl animate-fadeIn">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Configuração de Recebimento via Boleto Bancário
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                      Por onde você receberá o Boleto?
                                    </label>
                                    <select
                                      value={boletoPorOndeForm}
                                      onChange={(e) => setBoletoPorOndeForm(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 outline-none transition focus:border-indigo-500"
                                    >
                                      <option value="ASAAS">ASAAS</option>
                                      <option value="STRIPE">STRIPE</option>
                                    </select>
                                  </div>

                                  {(() => {
                                    if (boletoPorOndeForm === "ASAAS") {
                                      return (
                                        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2.5 animate-fadeIn">
                                          <p className="text-[11px] font-semibold text-emerald-800 leading-relaxed">
                                            A emissão de boletos via <strong>ASAAS</strong> está integrada de forma fática com o Giffoni Connect. O sistema irá automatizar o silenciamento de notificações, geração da cobrança e guarda imediata do arquivo PDF na pasta do Google Drive do cliente.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/boss-giffoni-clientes/configuracoes/asaas?billingContextId=${caseId}`)}
                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                          >
                                            <Landmark size={13} />
                                            <span>Iniciar Emissão ASAAS</span>
                                          </button>
                                        </div>
                                      );
                                    }
                                    const shortId = caseId ? caseId.substring(0, 6) : "GDI";
                                    const generatedBoletoLink = `https://checkout.stripe.com/pay/boleto_giffoni_${shortId}_${Date.now().toString().substring(8)}`;
                                    return <ApiLinkBox link={generatedBoletoLink} />;
                                  })()}
                                </div>
                              )}

                              {tipoRecebimentoForm === "Cartão de Crédito" && (
                                <div className="space-y-4 bg-indigo-50/20 border border-indigo-100 p-4 rounded-xl animate-fadeIn">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    Configuração de Recebimento via Cartão de Crédito
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                      Por onde você receberá o Cartão de Crédito?
                                    </label>
                                    <select
                                      value={cartaoPorOndeForm}
                                      onChange={(e) => setCartaoPorOndeForm(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 outline-none transition focus:border-indigo-500"
                                    >
                                      <option value="Infinitepay - Tap to pay">Infinitepay - Tap to pay</option>
                                      <option value="Infinitepay - Link de pagamento">Infinitepay - Link de pagamento</option>
                                      <option value="ASAAS - Link de pagamento">ASAAS - Link de pagamento</option>
                                      <option value="Stripe - Link de pagamento">Stripe - Link de pagamento</option>
                                      <option value="PagSeguro - Tap to pay">PagSeguro - Tap to pay</option>
                                      <option value="PagSeguro - Link de Pagamento">PagSeguro - Link de Pagamento</option>
                                      <option value="Pagseguro - Maquininha da Pagseguro">Pagseguro - Maquininha da Pagseguro</option>
                                    </select>
                                  </div>

                                  {["Infinitepay - Tap to pay", "PagSeguro - Tap to pay", "Pagseguro - Maquininha da Pagseguro"].includes(cartaoPorOndeForm) && (
                                    <ComprovanteUploadBox />
                                  )}

                                  {["Infinitepay - Link de pagamento", "ASAAS - Link de pagamento", "Stripe - Link de pagamento", "PagSeguro - Link de Pagamento"].includes(cartaoPorOndeForm) && (
                                    (() => {
                                      const shortId = caseId ? caseId.substring(0, 6) : "GDI";
                                      let generatedCartaoLink = "";
                                      if (cartaoPorOndeForm === "Infinitepay - Link de pagamento") {
                                        generatedCartaoLink = `https://link.infinitepay.com/giffoniadv/cartao_${shortId}_${Date.now().toString().substring(8)}`;
                                      } else if (cartaoPorOndeForm === "ASAAS - Link de pagamento") {
                                        generatedCartaoLink = `https://cobranca.asaas.com/i/cartao_giffoni_${shortId}_${Date.now().toString().substring(8)}`;
                                      } else if (cartaoPorOndeForm === "Stripe - Link de pagamento") {
                                        generatedCartaoLink = `https://checkout.stripe.com/pay/cartao_giffoni_${shortId}_${Date.now().toString().substring(8)}`;
                                      } else if (cartaoPorOndeForm === "PagSeguro - Link de Pagamento") {
                                        generatedCartaoLink = `https://pag.ae/giffoni_cartao_${shortId}_${Date.now().toString().substring(8)}`;
                                      }
                                      return <ApiLinkBox link={generatedCartaoLink} />;
                                    })()
                                  )}

                                  <div className="bg-white border border-gray-200 p-3.5 rounded-xl space-y-2 mt-2">
                                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between cursor-pointer">
                                      <span className="font-sans">Você deseja gerar o recibo automaticamente?</span>
                                      <div className="relative inline-flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={gerarReciboAutomaticoForm}
                                          onChange={(e) => setGerarReciboAutomaticoForm(e.target.checked)}
                                          className="sr-only peer"
                                          id="checkbox-recibo-automatico-cartao"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                      </div>
                                    </label>
                                    {gerarReciboAutomaticoForm && (
                                      <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50/60 p-2.5 border border-indigo-120 rounded-lg animate-fadeIn flex gap-1.5">
                                        <span className="text-sm">🤖</span>
                                        <span>
                                          Caso esta opção seja selecionada será criada uma automação GDI para a criação do Recibo Automático da Giffoni Advogados Associados
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {tipoRecebimentoForm === "Dinheiro" && (
                                <div className="space-y-4 bg-emerald-50/20 border border-emerald-100 p-4 rounded-xl animate-fadeIn">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Configuração de Recebimento em Dinheiro
                                  </div>

                                  <div className="bg-white border border-gray-200 p-3.5 rounded-xl space-y-2">
                                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between cursor-pointer">
                                      <span className="font-sans">Você deseja gerar o recibo automaticamente?</span>
                                      <div className="relative inline-flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={gerarReciboAutomaticoForm}
                                          onChange={(e) => setGerarReciboAutomaticoForm(e.target.checked)}
                                          className="sr-only peer"
                                          id="checkbox-recibo-automatico-dinheiro"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                      </div>
                                    </label>
                                    {gerarReciboAutomaticoForm && (
                                      <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50/60 p-2.5 border border-indigo-120 rounded-lg animate-fadeIn flex gap-1.5">
                                        <span className="text-sm">🤖</span>
                                        <span>
                                          Caso esta opção seja selecionada será criada uma automação GDI para a criação do Recibo Automático da Giffoni Advogados Associados
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {tipoRecebimentoForm === "Transferência Bancária" && (
                                <div className="space-y-4 bg-blue-50/20 border border-blue-100 p-4 rounded-xl animate-fadeIn">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Configuração de Recebimento via Transferência Bancária 🏦 ➡️ 🏦
                                  </div>

                                  <ComprovanteUploadBox />
                                </div>
                              )}

                              {/* GERAÇÃO EM LOTE */}
                              <div className="space-y-1 pt-2 border-t border-slate-100">
                                <label className="text-[10px] font-bold uppercase text-gray-445 tracking-wide font-mono">
                                  Geração em Lote
                                </label>
                                <select
                                  value={cobrancaAutomaticaIntegForm}
                                  onChange={(e) => setCobrancaAutomaticaIntegForm(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-gray-250 rounded-lg text-xs font-semibold text-gray-800 outline-none transition focus:border-indigo-500"
                                >
                                  <option value="Não">Não (Faturado Manualmente)</option>
                                  <option value="Sim">Sim (Sincronização Ativa Integrada)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 hover:bg-indigo-700 bg-indigo-600 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer disabled:opacity-50 font-bold"
                  >
                    {saving ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Gravar Condições Operacionais
                  </button>
                </div>
              </form>

              {/* Área estrutural reservada para o preview futuro do contrato */}
              <div id="futuro-preview-contrato-container" className="w-full space-y-5">
                {/* Balão Destacado da Prévia do Contrato de Honorários (Local Audit) */}
                {previewStatus !== 'preview_not_started' && (
                  <div className={`p-6 border rounded-3xl space-y-4 shadow-sm animate-in fade-in duration-300 ${
                    previewStatus === 'preview_success' 
                      ? 'bg-emerald-50/20 border-emerald-200' 
                      : previewStatus === 'preview_success_with_warnings'
                      ? 'bg-amber-50/20 border-amber-200'
                      : 'bg-rose-50/20 border-rose-200'
                  }`}>
                    {/* Cabeçalho do balão */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
                            Prévia do Contrato de Honorários
                          </h4>
                          {previewStatus === 'preview_success' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase rounded-full font-mono flex items-center gap-1">
                              <CheckCircle2 size={10} /> Prévia gerada com sucesso
                            </span>
                          )}
                          {previewStatus === 'preview_success_with_warnings' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase rounded-full font-mono flex items-center gap-1">
                              <AlertTriangle size={10} /> Prévia gerada com pendências
                            </span>
                          )}
                          {previewStatus === 'preview_failed' && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[9px] font-black uppercase rounded-full font-mono flex items-center gap-1">
                              <AlertCircle size={10} /> Prévia não gerada
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          Visualização gerada antes da criação definitiva do documento.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearPreviewLogs}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
                        title="Fechar Prévia"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Conteúdo da prévia */}
                    {previewStatus === 'preview_loading' ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                        <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest animate-pulse">Gerando prévia real...</span>
                      </div>
                    ) : previewStatus === 'preview_failed' ? (
                      <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-3 text-left">
                        <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="text-xs font-black uppercase text-rose-900 font-sans">
                            Falha na Geração da Prévia Real
                          </h5>
                          <p className="text-[11px] text-rose-700 leading-relaxed font-semibold">
                            {lastFriendlyError || "Ocorreu um erro técnico inesperado ao tentar gerar o documento real temporário no Google Drive."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-150 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <FileText size={15} className="text-blue-600" />
                            <span className="font-bold text-xs text-slate-700">Documento de Prévia Temporária</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsContractPreviewExpanded(!isContractPreviewExpanded)}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase rounded-lg text-[10px] transition cursor-pointer"
                            >
                              {isContractPreviewExpanded ? "Recolher Prévia" : "Visualizar Prévia"}
                            </button>
                            {previewGoogleDocsUrl && (
                              <a
                                href={previewGoogleDocsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold uppercase rounded-lg text-[10px] border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                              >
                                <ExternalLink size={10} /> Abrir em Nova Aba
                              </a>
                            )}
                          </div>
                        </div>

                        {isContractPreviewExpanded && (
                          <div className="border border-slate-200 rounded-3xl shadow-xs bg-slate-50 p-6 max-h-[600px] overflow-y-auto">
                            {previewContractText ? (
                              <div 
                                className="p-8 bg-white border border-slate-100 rounded-2xl shadow-3xs prose max-w-none text-slate-800 leading-relaxed font-serif"
                                dangerouslySetInnerHTML={{ __html: previewContractText }}
                              />
                            ) : (
                              <div className="text-center py-12 text-slate-400 text-xs font-mono">
                                Nenhum conteúdo renderizado disponível.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!caseObj?.contratoHonorariosGoogleDocsUrl ? (
                  <div className="w-full border border-dashed border-gray-200 bg-gray-50/10 rounded-3xl min-h-[140px] flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
                        Contêiner Estrutural do Contrato
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mt-1 font-medium">
                        O preview em tempo real e a Batalha Naval serão exibidos aqui automaticamente assim que você gravar as condições operacionais fáticas do faturamento.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 justify-center">
                      <button
                        type="button"
                        disabled={previewStatus === 'preview_loading'}
                        onClick={handleExecutePreview}
                        className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider text-xs rounded-xl transition-all cursor-pointer shadow-3xs disabled:opacity-50 font-bold"
                      >
                        {previewStatus === 'preview_loading' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Eye size={13} />
                        )}
                        Ver Prévia de Contrato de Honorários
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenBattleNaval}
                        className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider text-xs rounded-xl transition-all cursor-pointer shadow-3xs font-bold"
                      >
                        👁️Ver Batalha Naval 🚢
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Real Document Preview Frame */}
                    <div className="border border-gray-200 rounded-3xl overflow-hidden shadow-2xs bg-white">
                      <div className="p-4 bg-slate-50 border-b border-gray-150 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={previewStatus === 'preview_loading'}
                            onClick={handleExecutePreview}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 disabled:opacity-50 font-bold"
                          >
                            {previewStatus === 'preview_loading' ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Eye size={11} />
                            )}
                            Ver Prévia de Contrato de Honorários
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenBattleNaval}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 font-bold"
                          >
                            👁️Ver Batalha Naval 🚢
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {caseObj?.contratoHonorariosAprovadoStatus === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded-full text-[10px] font-black uppercase font-mono">
                              <CheckCircle2 size={11} className="text-emerald-600" /> Definitivo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-250 rounded-full text-[10px] font-black uppercase font-mono">
                              <Clock size={11} className="text-amber-600" /> Rascunho
                            </span>
                          )}
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-600 font-bold">
                            v{caseObj?.contratoHonorariosVersion || 1}
                          </span>
                        </div>
                      </div>
                      <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] md:h-[650px] bg-gray-50">
                        <iframe
                          src={`https://docs.google.com/document/d/${caseObj.contratoHonorariosGoogleDocsId}/preview`}
                          title="Visualização do Contrato no Google Docs"
                          className="w-full h-full border-0"
                          allow="autoplay"
                        />
                      </div>
                    </div>

                    {/* Approval Workflow Controls */}
                    <div className="p-5 border border-gray-200 rounded-3xl space-y-4 bg-white shadow-3xs">
                      {caseObj?.contratoHonorariosAprovadoStatus === "approved" ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-start gap-3">
                            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                              <CheckCircle2 size={20} />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 font-sans">
                                Contrato Homologado e Definitivo
                              </h4>
                              <p className="text-[11px] text-emerald-700 leading-relaxed font-semibold">
                                Este documento foi aprovado e congelado por <strong className="text-emerald-950 font-black">{caseObj?.contratoHonorariosAprovadoBy || "Operador"}</strong> em <strong>{caseObj?.contratoHonorariosAprovadoAt ? new Date(caseObj.contratoHonorariosAprovadoAt).toLocaleString("pt-BR") : "N/A"}</strong>.
                              </p>
                            </div>
                          </div>

                          {/* Warning for post-approval modifications */}
                          {checkIfSubStep1IsDirty() && (
                            <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-3 animate-pulse">
                              <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 font-sans">
                                  Aviso: Condições Fáticas Alteradas!
                                </h4>
                                <p className="text-[11px] text-rose-700 leading-relaxed font-bold">
                                  Você alterou as condições operacionais fáticas acima após a homologação deste contrato. Isso torna a versão atual obsoleta. Para manter a conformidade jurídica, grave as alterações (gerando um novo contrato consistente) ou clique em <strong>Gerar Novamente</strong> na automação abaixo.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleRevertApproveContrato}
                              disabled={saving}
                              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-250 text-gray-700 hover:text-gray-950 text-xs font-bold uppercase rounded-xl transition-all shadow-3xs cursor-pointer disabled:opacity-50 font-semibold"
                            >
                              Reverter para Rascunho
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Painel de Logs do Preview do Contrato de Honorários */}
                          <div className="p-5 border border-slate-200 bg-slate-50/50 rounded-3xl space-y-4 text-left">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                              <div className="flex items-center gap-2">
                                <FileText size={16} className="text-slate-600" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                                  Logs do Preview do Contrato de Honorários
                                </h4>
                              </div>
                              
                              {/* Botões do Painel de Logs */}
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                {previewStatus !== 'preview_not_started' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(previewPayloadRaw || {}, null, 2));
                                        setCopiedPayloadBruto(true);
                                        setTimeout(() => setCopiedPayloadBruto(false), 2000);
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 font-bold uppercase rounded-lg transition-all cursor-pointer font-mono"
                                    >
                                      {copiedPayloadBruto ? "Bruto Copiado!" : "Copiar Bruto"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(previewPayloadNormalized || {}, null, 2));
                                        setCopiedPayloadNorm(true);
                                        setTimeout(() => setCopiedPayloadNorm(false), 2000);
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 font-bold uppercase rounded-lg transition-all cursor-pointer font-mono"
                                    >
                                      {copiedPayloadNorm ? "Norm Copiado!" : "Copiar Norm"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fullLogsText = {
                                          statusGeral: previewStatus,
                                          dataHoraExecucao: new Date().toISOString(),
                                          casoId: caseId,
                                          clienteId: client?.id || "",
                                          tipoDocumento: "contrato_honorarios",
                                          template: "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ",
                                          logsTecnicos: previewLogs,
                                          auditoriaPlaceholders: placeholderResolutionLogs
                                        };
                                        navigator.clipboard.writeText(JSON.stringify(fullLogsText, null, 2));
                                        setCopiedLogsText(true);
                                        setTimeout(() => setCopiedLogsText(false), 2000);
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 font-bold uppercase rounded-lg transition-all cursor-pointer font-mono"
                                    >
                                      {copiedLogsText ? "Logs Copiados!" : "Copiar Logs"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsContractPreviewLogsExpanded(!isContractPreviewLogsExpanded)}
                                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-755 font-bold uppercase rounded-lg transition-all cursor-pointer"
                                    >
                                      {isContractPreviewLogsExpanded ? "Ocultar Detalhes" : "Expandir Detalhes"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleExecutePreview}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <RefreshCw size={10} /> Reexecutar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleClearPreviewLogs}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold uppercase rounded-lg transition-all cursor-pointer"
                                    >
                                      Limpar Logs
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Estado Vazio se não houver execução de preview */}
                            {previewStatus === 'preview_not_started' ? (
                              <div className="py-6 px-4 text-center space-y-1.5">
                                <p className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
                                  Nenhuma prévia executada ainda
                                </p>
                                <p className="text-[11px] text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                                  Clique em <strong className="text-blue-600">“Ver Prévia de Contrato de Honorários”</strong> acima para gerar a visualização e os logs de auditoria.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Se estiver recolhido, mostrar badge compacto */}
                                {!isContractPreviewLogsExpanded && (
                                  <div className="p-3 bg-white border border-slate-150 rounded-xl flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2.5 h-2.5 rounded-full ${
                                        previewStatus === 'preview_success' 
                                          ? 'bg-emerald-500' 
                                          : previewStatus === 'preview_success_with_warnings' 
                                          ? 'bg-amber-500' 
                                          : 'bg-rose-500'
                                      }`} />
                                      <span className="font-extrabold text-slate-700 uppercase tracking-wider font-mono text-[10px]">
                                        Status: {previewStatus === 'preview_success' ? "Sucesso Absoluto" : previewStatus === 'preview_success_with_warnings' ? "Avisos/Pendências" : "Falha na Execução"}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setIsContractPreviewLogsExpanded(true)}
                                      className="text-indigo-650 hover:text-indigo-850 font-black uppercase text-[10px] tracking-wider"
                                    >
                                      Expandir Detalhes do Diagnóstico
                                    </button>
                                  </div>
                                )}

                                {/* Card 1 — Resumo da Execução */}
                                {isContractPreviewLogsExpanded && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-2.5">
                                      <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b pb-1">
                                        Card 1 — Resumo da Execução
                                      </h5>
                                      <div className="space-y-1.5 text-[11px] font-semibold text-slate-600 font-mono">
                                        <div className="flex justify-between">
                                          <span>Status Geral:</span>
                                          <span className={`px-1.5 rounded uppercase font-black text-[9px] ${
                                            previewStatus === 'preview_success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-250'
                                          }`}>{previewStatus}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Data/Hora:</span>
                                          <span>{new Date().toLocaleString("pt-BR")}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Caso ID:</span>
                                          <span className="text-[10px] select-all truncate max-w-[150px]">{caseId}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Cliente ID:</span>
                                          <span className="text-[10px] select-all truncate max-w-[150px]">{client?.id || "N/A"}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-2.5">
                                      <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b pb-1">
                                        Mapeamento de Placeholders
                                      </h5>
                                      <div className="space-y-1.5 text-[11px] font-semibold text-slate-600 font-mono">
                                        <div className="flex justify-between">
                                          <span>Tipo Documento:</span>
                                          <span>contrato_honorarios</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Template ID:</span>
                                          <span className="text-[10px] truncate max-w-[150px]">1GJZ6LSW_szLSA...</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Resolvidos com Sucesso:</span>
                                          <span className="text-emerald-600 font-black">{placeholderResolutionLogs.filter(p => p.status === 'success').length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Pendentes / Sem Dados:</span>
                                          <span className="text-amber-600 font-black">{placeholderResolutionLogs.filter(p => p.status !== 'success').length}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Card 2 — Payload do Preview */}
                                {isContractPreviewLogsExpanded && (
                                  <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-3">
                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b pb-1 flex justify-between items-center">
                                      <span>Card 2 — Payload de Integração</span>
                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded uppercase font-bold">Estado Fático</span>
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                                      <div className="space-y-1">
                                        <span className="font-extrabold text-slate-600 block">Payload Bruto (Dados Cadastrais e Estados)</span>
                                        <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg max-h-[160px] overflow-auto select-all font-mono">
                                          {JSON.stringify(previewPayloadRaw, null, 2)}
                                        </pre>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="font-extrabold text-slate-600 block">Payload Normalizado (Placeholders Mapeados)</span>
                                        <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg max-h-[160px] overflow-auto select-all font-mono">
                                          {JSON.stringify(previewPayloadNormalized, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Card 3 — Substituição de Placeholders */}
                                {isContractPreviewLogsExpanded && (
                                  <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-3">
                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b pb-1">
                                      Card 3 — Substituição de Placeholders (Tabela de Auditoria)
                                    </h5>
                                    <div className="overflow-x-auto max-h-[300px] border border-slate-100 rounded-xl">
                                      <table className="w-full text-[10px] text-left border-collapse">
                                        <thead>
                                          <tr className="bg-slate-100 font-extrabold text-slate-700 uppercase tracking-wider font-mono border-b border-slate-200">
                                            <th className="p-2 border-r border-slate-200">Placeholder</th>
                                            <th className="p-2 border-r border-slate-200">Origem do Dado</th>
                                            <th className="p-2 border-r border-slate-200">Valor Recebido (Mascarado)</th>
                                            <th className="p-2 border-r border-slate-200">Status</th>
                                            <th className="p-2">Motivo</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                                          {placeholderResolutionLogs.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                              <td className="p-2 border-r border-slate-200 font-mono text-slate-800 select-all">{item.placeholder}</td>
                                              <td className="p-2 border-r border-slate-200 font-mono text-slate-400">{item.sourceField}</td>
                                              <td className="p-2 border-r border-slate-200 font-mono text-slate-700 select-all">{item.receivedValue || <em className="text-slate-350 font-normal">vazio</em>}</td>
                                              <td className="p-2 border-r border-slate-200">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase ${
                                                  item.status === 'success' 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                                    : item.status === 'warning'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-150'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-150'
                                                }`}>
                                                  {item.status}
                                                </span>
                                              </td>
                                              <td className="p-2 leading-relaxed text-slate-500 font-sans">{item.reason}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Card 4 — Erros e Alertas */}
                                {isContractPreviewLogsExpanded && (
                                  <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-3">
                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b pb-1">
                                      Card 4 — Erros e Alertas
                                    </h5>
                                    
                                    <div className="space-y-2">
                                      {/* Alertas sobre campos secundários vazios */}
                                      {placeholderResolutionLogs.filter(p => p.status === 'warning').length > 0 && (
                                        <div className="p-3 bg-amber-50/50 border border-amber-150 rounded-xl space-y-1">
                                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider font-mono flex items-center gap-1">
                                            ⚠️ Alerta: Campos Vazios ou com Valores Padrão ({placeholderResolutionLogs.filter(p => p.status === 'warning').length})
                                          </span>
                                          <ul className="list-disc pl-4 text-[10px] leading-relaxed text-amber-700 space-y-0.5">
                                            {placeholderResolutionLogs.filter(p => p.status === 'warning').map((p, idx) => (
                                              <li key={idx}>
                                                O placeholder <strong className="font-mono">{p.placeholder}</strong> está mapeado na origem <span className="font-mono">{p.sourceField}</span> mas foi avaliado como vazio ou com valor default provisório.
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {/* Alertas sobre campos ausentes */}
                                      {placeholderResolutionLogs.filter(p => p.status === 'failed').length > 0 && (
                                        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl space-y-1">
                                          <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider font-mono flex items-center gap-1">
                                            ❌ Crítico: Placeholders com Falha na Resolução ({placeholderResolutionLogs.filter(p => p.status === 'failed').length})
                                          </span>
                                          <ul className="list-disc pl-4 text-[10px] leading-relaxed text-rose-700 space-y-0.5">
                                            {placeholderResolutionLogs.filter(p => p.status === 'failed').map((p, idx) => (
                                              <li key={idx}>
                                                O placeholder <strong className="font-mono">{p.placeholder}</strong> falhou. Motivo: <span className="font-semibold">{p.reason}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {lastFriendlyError && (
                                        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-[10px] text-rose-750 font-semibold leading-relaxed">
                                          💡 <strong>Aviso Amigável de Diagnóstico:</strong> {lastFriendlyError}
                                        </div>
                                      )}

                                      {lastTechnicalError && (
                                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Erro Técnico Interno (Stack Trace)</span>
                                          <pre className="text-[9px] font-mono text-rose-400 select-all overflow-auto max-h-[100px] whitespace-pre-wrap">
                                            {lastTechnicalError}
                                          </pre>
                                        </div>
                                      )}

                                      {placeholderResolutionLogs.filter(p => p.status !== 'success').length === 0 && (
                                        <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] text-emerald-800 font-extrabold flex items-center gap-1.5 uppercase font-mono">
                                          ✅ Nenhum alerta ou erro reportado. Todos os placeholders foram validados com sucesso absoluto!
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Card 5 — Resultado */}
                                {isContractPreviewLogsExpanded && (
                                  <div className="p-4 bg-white border border-slate-150 rounded-xl space-y-3">
                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b pb-1">
                                      Card 5 — Resultado Final & Próxima Ação
                                    </h5>
                                    
                                    <div className="space-y-3">
                                      <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                                        previewStatus === 'preview_success' 
                                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
                                          : previewStatus === 'preview_success_with_warnings'
                                          ? 'bg-amber-50/50 border-amber-200 text-amber-800'
                                          : 'bg-rose-50/50 border-rose-200 text-rose-800'
                                      }`}>
                                        <span className="text-xl">
                                          {previewStatus === 'preview_success' ? "🏆" : previewStatus === 'preview_success_with_warnings' ? "⚠️" : "❌"}
                                        </span>
                                        <div className="space-y-1 text-xs">
                                          <p className="font-extrabold uppercase font-mono text-[10px] tracking-wider">
                                            Resultado: {previewStatus === 'preview_success' ? "Minuta Perfeita" : previewStatus === 'preview_success_with_warnings' ? "Minuta com Pendências de Preenchimento" : "Minuta não Gerada"}
                                          </p>
                                          <p className="text-[11px] leading-relaxed font-semibold">
                                            {previewStatus === 'preview_success' 
                                              ? "Todas as condições contratuais fáticas e os dados do cliente foram mapeados com sucesso. O documento está juridicamente perfeito e pronto para homologação definitiva."
                                              : previewStatus === 'preview_success_with_warnings'
                                              ? "A prévia local foi compilada, mas o cliente ou o faturamento possui placeholders pendentes de valor (em amarelo). Recomendamos revisar o formulário de faturamento e preencher os dados de cadastro antes de homologar como definitivo."
                                              : "Não foi possível montar a prévia devido a erros impeditivos de carregamento de dados."}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] leading-relaxed text-slate-600 font-medium">
                                        💡 <strong>Ação Recomendada pelo Diagnóstico:</strong>{" "}
                                        {previewStatus === 'preview_success' 
                                          ? "Clique em 'Gravar Condições Operacionais' para consolidar os dados e, em seguida, em 'Aprovar e Tornar Definitivo' no painel de rascunhos para registrar no histórico operacional."
                                          : previewStatus === 'preview_success_with_warnings'
                                          ? "Complete os campos do cadastro do cliente que geraram avisos (como RG, Profissão, Endereço completo) e atualize os campos de faturamento correspondentes para que a minuta oficial saia sem nenhuma lacuna jurídica."
                                          : "Recarregue a página, verifique se as informações de faturamento e os dados básicos do cliente na Etapa 1 estão preenchidos, e reexecute o preview."}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="p-4 bg-amber-50/40 border border-amber-150 rounded-2xl flex items-start gap-3">
                            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                              <Clock size={20} className="text-amber-600" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 font-sans">
                                Contrato em Fase de Rascunho
                              </h4>
                              <p className="text-[11px] text-amber-700 leading-relaxed font-semibold">
                                O documento está aberto para edições e regenerações. Após validar o texto real e certificar-se de que os valores, as datas e os dados estão perfeitos, homologue o contrato como definitivo.
                              </p>
                            </div>
                          </div>

                          {!showApprovalConfirmation ? (
                            <button
                              type="button"
                              onClick={() => setShowApprovalConfirmation(true)}
                              className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                            >
                              <Check size={14} />
                              Aprovar e Tornar Definitivo
                            </button>
                          ) : (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                              <h5 className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wider font-mono">
                                Confirmar Homologação de Contrato
                              </h5>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Ao aprovar, o documento será marcado como definitivo e pronto para coleta de assinatura do cliente. Esta ação é registrada no histórico.
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleApproveContrato}
                                  disabled={saving}
                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-3xs cursor-pointer disabled:opacity-50"
                                >
                                  Sim, Aprovar como Definitivo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowApprovalConfirmation(false)}
                                  className="px-3.5 py-2 bg-white hover:bg-gray-150 border border-gray-250 text-gray-700 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* History log tracking timeline */}
                      {caseObj?.contratoHonorariosHistory && caseObj.contratoHonorariosHistory.length > 0 && (
                        <div className="pt-4 border-t border-gray-150">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 font-mono flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" /> Histórico Operacional de Homologações
                          </h4>
                          <div className="relative border-l border-gray-200 ml-2.5 pl-4.5 space-y-3 pb-1">
                            {caseObj.contratoHonorariosHistory.map((item: any, idx: number) => {
                              const getIcon = () => {
                                if (item.type === "approve") return "❇️";
                                if (item.type === "revert") return "↩️";
                                return "📄";
                              };
                              return (
                                <div key={idx} className="relative text-[11px] leading-relaxed">
                                  <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-[8px] font-bold">
                                    {getIcon()}
                                  </div>
                                  <div className="text-slate-600 font-semibold">
                                    <span className="font-extrabold text-slate-800">{item.description}</span>
                                    <span className="text-slate-400 font-normal"> • por {item.user}</span>
                                  </div>
                                  <div className="text-[9.5px] text-slate-400 font-mono font-bold">
                                    {item.timestamp ? new Date(item.timestamp).toLocaleString("pt-BR") : "Sem data"}
                                    {item.version && <span className="ml-2 bg-slate-100 px-1 py-0.2 rounded">v{item.version}</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const clientDriveFolderId = (
                  client?.googleDriveClientFolderId ||
                  client?.gdriveFolderId ||
                  caseObj?.gdriveFolderId ||
                  ""
                ).trim();
                const clientDriveFolderUrl = (
                  client?.googleDriveClientFolderUrl ||
                  client?.gdriveFolderUrl ||
                  caseObj?.gdriveFolderUrl ||
                  ""
                ).trim();
                const folderIsReal = 
                  clientDriveFolderId &&
                  !clientDriveFolderId.toLowerCase().includes("mock") &&
                  !clientDriveFolderId.toLowerCase().includes("fake") &&
                  !clientDriveFolderId.toLowerCase().includes("teste") &&
                  !clientDriveFolderId.toLowerCase().includes("undefined") &&
                  !clientDriveFolderId.toLowerCase().includes("null") &&
                  !clientDriveFolderId.toLowerCase().includes("xxxx");

                const resolvedNomeCompleto = (
                  client?.pfData?.pf_nomeCompleto ||
                  client?.pfDadosPessoais?.pf_nomeCompleto ||
                  client?.razaoSocial ||
                  client?.pjDadosEmpresa?.pj_razaoSocial ||
                  client?.nomeCompleto ||
                  client?.nome ||
                  clientName ||
                  "Cliente"
                ).trim();

                const officialTemplateId = "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ";

                return (
                  <div className="bg-gradient-to-br from-blue-50/60 to-sky-50/20 border border-blue-150 rounded-3xl p-6 shadow-3xs space-y-5 animate-in fade-in">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="p-1 px-2.5 bg-blue-100 text-blue-800 rounded-full font-black text-[9px] uppercase tracking-wider font-mono">
                            Automação Ativa
                          </span>
                          <Sparkles size={16} className="text-blue-600 animate-pulse" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900">
                          Automação Google Docs — Contrato de Honorários
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                          Esta ferramenta envia os dados consolidados do faturamento e do cliente diretamente ao build receptor do Google Docs para preenchimento de placeholders, indexação e arquivamento automatizado na pasta em tempo real.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Botoes de acao de integracao empilhados verticalmente à esquerda */}
                      <div className="flex flex-col items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowContratoIntegrationConfig(!showContratoIntegrationConfig)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs border ${
                            showContratoIntegrationConfig
                              ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border-blue-150 hover:border-blue-300'
                          }`}
                        >
                          <Settings size={13} className={showContratoIntegrationConfig ? "text-white" : "text-blue-500"} />
                          Ver Configurações de integração
                        </button>

                        {folderIsReal && clientDriveFolderUrl ? (
                          <a
                            href={clientDriveFolderUrl}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-3xs font-semibold"
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

                      {showContratoIntegrationConfig && (
                        <div className="p-5 bg-white border border-gray-150 rounded-2xl space-y-4 shadow-lg animate-in slide-in-from-top-1 duration-250 max-w-xl text-left">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <Settings size={15} className="text-blue-600" />
                              <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider font-mono">
                                Informações Técnicas & Configurações GDI
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowContratoIntegrationConfig(false)}
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
                                  Pasta do Google Drive de {resolvedNomeCompleto}
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
                                        className="text-[9px] font-black uppercase text-blue-650 hover:text-blue-850 cursor-pointer shrink-0"
                                      >
                                        {copiedText ? "Copiado!" : "Copiar ID"}
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-600 truncate flex-1">URL: {clientDriveFolderUrl || 'Não definida'}</span>
                                    {clientDriveFolderUrl && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyLink(clientDriveFolderUrl)}
                                        className="text-[9px] font-black uppercase text-blue-650 hover:text-blue-850 cursor-pointer shrink-0"
                                      >
                                        {copiedText ? "Copiado!" : "Copiar URL"}
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
                                  Modelo padrão utilizado para preenchimento de placeholders do Contrato de Honorários:
                                </p>
                                <a
                                  href={`https://docs.google.com/document/d/${officialTemplateId}/edit`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50/70 hover:bg-blue-100 border border-blue-150 text-blue-750 hover:text-blue-900 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shadow-3xs"
                                >
                                  <FileText size={13} className="text-blue-500" />
                                  <span>Abrir Template de Referência Google Docs</span>
                                  <ExternalLink size={10} className="opacity-70" />
                                </a>
                                <div className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-[9px] font-mono select-all text-gray-500 flex items-center justify-between gap-2">
                                  <span className="truncate">ID: {officialTemplateId}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(officialTemplateId)}
                                    className="text-[9px] font-black uppercase text-blue-650 hover:text-blue-850 cursor-pointer shrink-0"
                                  >
                                    {copiedText ? "Copiado!" : "Copiar ID"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Log de falhas se houver */}
                      {caseObj?.contratoHonorariosLogFalha && (
                        <div className="p-3.5 border border-rose-100 bg-rose-50/50 rounded-xl text-[11px] text-rose-750 font-medium leading-relaxed space-y-3">
                          <div>
                            ⚠️ Falha na última tentativa:{" "}
                            <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded border border-rose-105 block mt-1 break-words select-all">
                              {caseObj.contratoHonorariosLogFalha}
                            </code>
                          </div>

                          {(caseObj.contratoHonorariosLogFalha.toLowerCase().includes("expirou") ||
                            caseObj.contratoHonorariosLogFalha.toLowerCase().includes("sessão") ||
                            caseObj.contratoHonorariosLogFalha.toLowerCase().includes("token") ||
                            caseObj.contratoHonorariosLogFalha.toLowerCase().includes("autorização") ||
                            caseObj.contratoHonorariosLogFalha.toLowerCase().includes("credentials")) && (
                            <div className="pt-1.5 flex flex-wrap gap-2.5 items-center">
                              <button
                                type="button"
                                disabled={isRenewingGoogle}
                                onClick={handleRenewGoogle}
                                className="inline-flex items-center gap-1.5 bg-rose-650 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:opacity-50"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M21.35 11.1H12V12.9H19.6C18.9 16.5 15.8 18.9 12 18.9C8.1 18.9 5.0 15.8 5.0 12C5.0 8.2 8.1 5.1 12 5.1C13.7 5.1 15.3 5.7 16.5 6.8L18.4 4.9C16.7 3.2 14.5 2.1 12 2.1C6.5 2.1 2 6.6 2 12.1C2 17.6 6.5 22.1 12 22.1C17.5 22.1 22 17.6 22 12.1C22 11.7 21.9 11.4 21.35 11.1H21.35Z" fill="currentColor"/>
                                </svg>
                                {isRenewingGoogle ? "Conectando..." : "Conectar / Renovar Conta Google em 1-Clique"}
                              </button>
                              <span className="text-[10px] text-rose-600 font-extrabold">
                                Renove o seu acesso seguro sem deslogar!
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contrato de honorários gerado com sucesso */}
                      {caseObj?.contratoHonorariosGoogleDocsUrl && (
                        <div className="p-5 bg-blue-50/80 border border-blue-150 rounded-2xl space-y-4 animate-in fade-in duration-300">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-blue-100 border border-blue-150 rounded-xl text-blue-600">
                              <FileCheck2 size={20} />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                                Contrato de Honorários Gerado
                              </h3>
                              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                O Contrato de Honorários real foi gerado com sucesso no Google Docs e arquivado de forma automatizada na pasta do cliente.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 border-t border-blue-100">
                            <div>
                              <span className="text-[10px] font-black uppercase text-blue-600 block font-mono">
                                Documento
                              </span>
                              <span className="font-extrabold text-blue-950">
                                Contrato de Honorários {client?.type || "PF"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase text-blue-600 block font-mono">
                                Data Geração
                              </span>
                              <span className="font-extrabold text-blue-950">
                                {caseObj.contratoHonorariosGeneratedAt
                                  ? new Date(caseObj.contratoHonorariosGeneratedAt).toLocaleDateString("pt-BR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Gerado recentemente"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            <a
                              href={caseObj.contratoHonorariosGoogleDocsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-3xs cursor-pointer font-bold"
                            >
                              <ExternalLink size={13} />
                              Abrir Contrato GDocs
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(caseObj.contratoHonorariosGoogleDocsUrl)}
                              className={`inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-black uppercase transition-all border shadow-3xs cursor-pointer font-bold ${
                                copiedText
                                  ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {copiedText ? "Copiado!" : "Copiar Link"}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleGenerateContratoHonorarios('new_version')}
                              className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-3xs font-bold"
                            >
                              {saving ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                              Gerar Novamente
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Botão de gerar se não gerado */}
                      {!caseObj?.contratoHonorariosGoogleDocsUrl && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleGenerateContratoHonorarios('initial')}
                          className="w-full md:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer font-bold"
                        >
                          {saving ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              Gerando minuta oficial no GDocs...
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              Criar Contrato de Honorários
                            </>
                          )}
                        </button>
                      )}

                      {/* DETALHES TÉCNICOS COMPLEMENTARES E LOGS DA INTEGRAÇÃO */}
                      {(() => {
                        const rawLogs = caseObj?.contratoHonorariosTechnicalLog || caseObj?.contratoHonorariosGoogleDocsJobLogs || [];
                        const normalizedLogs = rawLogs.map((log: any) => ({
                          level: log.level || (log.action && (log.action.includes("FAILED") || log.action.includes("ERROR")) ? "error" : "info"),
                          code: log.code || log.action || "EVENT",
                          timestamp: log.timestamp,
                          message: log.message
                        }));

                        const techCode = caseObj?.contratoHonorariosStatus === 'criada'
                          ? (caseObj?.contratoHonorariosLastOutcome || "SUCCESS")
                          : (caseObj?.contratoHonorariosLastErrorCode || "GENERATION_FAILED");
                        const techTimestamp = caseObj?.contratoHonorariosLastOperationAt || caseObj?.contratoHonorariosGeneratedAt || caseObj?.updatedAt || "";
                        const techDocId = caseObj?.contratoHonorariosGoogleDocsId || caseObj?.contratoHonorariosId || "";
                        const techDocVer = caseObj?.contratoHonorariosVersion || 1;

                        const hasAnyTechnicalInfo = !!caseObj?.contratoHonorariosStatus || normalizedLogs.length > 0 || integrationJobs.length > 0;
                        if (!hasAnyTechnicalInfo) return null;

                        return (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            {/* Botão de abrir/fechar detalhes técnicos */}
                            <button
                              type="button"
                              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Settings size={13} className="text-slate-500 animate-spin" style={{ animationDuration: '8s' }} />
                                <span>Ver detalhes técnicos</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[9px] font-mono">
                                  Última tentativa: {normalizedLogs.length} logs | Histórico: {integrationJobs.length} tentativas
                                </span>
                                <ChevronRight size={14} className={`text-slate-400 transition-transform ${showTechnicalDetails ? 'rotate-90 text-slate-600' : ''}`} />
                              </div>
                            </button>

                            {/* Área expansível de Detalhes Técnicos */}
                            {showTechnicalDetails && (
                              <div className="mt-3 p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 animate-in fade-in duration-200 text-left">
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                                      Informações Técnicas de Integração
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleCopyTechnicalDetails}
                                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      {copiedTechText ? "Copiado!" : "Copiar detalhes técnicos"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowTechnicalDetails(false)}
                                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      Fechar detalhes técnicos
                                    </button>
                                  </div>
                                </div>

                                {/* Grid de metadados técnicos */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] font-mono text-slate-600 bg-white p-3.5 rounded-xl border border-slate-150">
                                  <div>
                                    <span className="text-[9px] font-bold uppercase text-slate-400 font-sans block mb-0.5">Status Técnico</span>
                                    <span className="font-extrabold text-slate-800 uppercase">{caseObj?.contratoHonorariosStatus || "N/A"}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold uppercase text-slate-400 font-sans block mb-0.5">Última Operação</span>
                                    <span className="font-bold text-slate-800">{techTimestamp ? new Date(techTimestamp).toLocaleString("pt-BR") : "N/A"}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold uppercase text-slate-400 font-sans block mb-0.5">Versão / ID</span>
                                    <span className="font-bold text-slate-800 select-all">
                                      v{techDocVer} {techDocId ? `(${techDocId.slice(0, 8)}...)` : ""}
                                    </span>
                                  </div>
                                </div>

                                {/* Código e Mensagem de Erro, se houver falha */}
                                {caseObj?.contratoHonorariosLogFalha && (
                                  <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 font-sans">
                                      <AlertTriangle size={14} className="text-rose-500" />
                                      <span>Mensagem de Erro Técnica</span>
                                    </div>
                                    <p className="text-[11px] text-rose-700 font-medium">
                                      Código do erro: <code className="font-mono bg-white px-1 py-0.5 rounded border border-rose-150 font-bold">{techCode || "GENERATION_FAILED"}</code>
                                    </p>
                                    <p className="text-xs text-rose-600 font-mono bg-white p-2.5 rounded-lg border border-rose-100 max-h-24 overflow-y-auto select-all leading-normal whitespace-pre-wrap">
                                      {caseObj.contratoHonorariosLogFalha}
                                    </p>
                                  </div>
                                )}

                                {/* Logs da Última Tentativa */}
                                {normalizedLogs.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block font-sans">
                                      Logs da Última Tentativa ({normalizedLogs.length} eventos)
                                    </span>
                                    <div className="p-4 bg-slate-950 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto space-y-3 shadow-inner">
                                      <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-slate-800">
                                        {normalizedLogs.map((log: any, idx: number) => {
                                          let dotColor = "bg-blue-500";
                                          let textColor = "text-blue-300";
                                          let levelLabel = "INFO";
                                          if (log.level === "success") {
                                            dotColor = "bg-emerald-500";
                                            textColor = "text-emerald-300";
                                            levelLabel = "SUCESSO";
                                          } else if (log.level === "warning") {
                                            dotColor = "bg-amber-500";
                                            textColor = "text-amber-300";
                                            levelLabel = "ALERTA";
                                          } else if (log.level === "error") {
                                            dotColor = "bg-rose-500";
                                            textColor = "text-rose-300";
                                            levelLabel = "ERRO";
                                          }

                                          const dateFormatted = log.timestamp
                                            ? new Date(log.timestamp).toLocaleTimeString()
                                            : new Date().toLocaleTimeString();

                                          return (
                                            <div key={idx} className="flex gap-3.5 items-start relative pl-1">
                                              <span className={`w-2 h-2 rounded-full ${dotColor} mt-1 ring-4 ring-slate-950 z-10 shrink-0`} />
                                              <div className="space-y-0.5 min-w-0 flex-1 text-left">
                                                <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-500 font-sans font-bold">
                                                  <span>[{dateFormatted}]</span>
                                                  <span className={textColor}>[{levelLabel}]</span>
                                                  <span className="text-slate-400 font-mono text-[8px] bg-slate-800 px-1 py-0.5 rounded uppercase tracking-wider">{log.code || "EVENT"}</span>
                                                </div>
                                                <p className="text-slate-300 text-xs font-sans leading-normal font-medium">
                                                  {log.message}
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Histórico Completo de Integrações e Logs (via custom cached LogList component) */}
                                <div className="pt-3 border-t border-slate-200">
                                  <LogList integrationJobs={integrationJobs} caseId={caseId} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ALERTA DE VAZIO: INTEGRITY INTEGRITY ALERTS COVERS LACK OF FINANCIAL RECORDS */}
        {!fetching && financials.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-205 rounded-2xl text-amber-900 text-xs space-y-1 animate-fadeIn">
            <div className="flex gap-2 items-center">
              <AlertTriangle size={16} className="text-amber-600" />
              <h5 className="font-bold uppercase tracking-wider text-xs">
                Alerta do Relatório de Integridade
              </h5>
            </div>
            <p className="font-medium leading-relaxed">
              Nenhum registro financeiro vinculado a este caso. O relatório de
              integridade apontará atenção.
            </p>
          </div>
        )}

        {fetching ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-gray-500" size={28} />
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-gray-500">
              Sincronizando faturamento de honorários...
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* SUBETAPA 02 - VER DETALHES DO CONTRATO FINANCEIRO */}
            {activeSubStep === 2 && (
              <div className="xl:col-span-12 max-w-4xl mx-auto w-full space-y-6">
                {/* AVISO DE SINCRONIZAÇÃO */}
                {caseObj?.modeloHonorarios !== caseObj?.financeiroUltimaSincronizacaoSubetapa01 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
                        <AlertTriangle className="text-amber-600 shrink-0" size={16} />
                        Descompasso de Sincronização Detectado
                      </div>
                      <p className="text-xs text-amber-800 font-medium leading-relaxed max-w-2xl">
                        O Modelo de Honorários foi alterado na <strong>SubEtapa 01</strong> para <strong>{caseObj?.modeloHonorarios ? caseObj.modeloHonorarios.toUpperCase().replace(/_/g, " ") : "NÃO SELECIONADO"}</strong>, mas a tabela de apurações e parcelas da <strong>SubEtapa 02</strong> ainda está rodando nas premissas anteriores. Sincronize para atualizar as bases.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGerarTabelaAutomatica}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <RefreshCw size={12} className="shrink-0" />
                      Sincronizar SubEtapa 01 ⟷ SubEtapa 02
                    </button>
                  </div>
                )}

                {/* CARD: Ver detalhes do contrato */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Header */}
                  <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="text-indigo-650" size={20} />
                      <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                        Ver detalhes do contrato
                      </h3>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-50 px-2.5 py-1 border border-green-200 rounded-full font-mono">
                      SubEtapa 02 Ativa
                    </span>
                  </div>

                  {/* Body Content: Centered/Max-width column for Condições Operacionais */}
                  <div className="max-w-2xl mx-auto space-y-6">
                    {/* Column 1: Condições Operacionais */}
                    <div className="space-y-5">
                      <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                        Condições Gerais e Faturamento do Contrato
                      </h4>

                      {/* SECTION 1: Read-Only Structural Context */}
                      <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl space-y-3 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-100/50">
                          <span className="text-gray-500 font-bold">Serviço Contratado:</span>
                          <span className="font-extrabold text-gray-900 text-right">{tipoServicoContratadoForm || "—"}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-slate-100/50">
                          <span className="text-gray-500 font-bold">Tipo de Honorários:</span>
                          <span className="font-extrabold text-indigo-950 uppercase tracking-wide">{tipoHonorarioForm || "—"}</span>
                        </div>

                        {tipoHonorarioForm?.includes("Êxito") && (
                          <div className="flex justify-between items-center py-1 border-b border-slate-100/50">
                            <span className="text-gray-500 font-bold">Percentual de Êxito:</span>
                            <span className="font-extrabold text-indigo-600">{honorarioExitoPercentualForm || "—"}</span>
                          </div>
                        )}

                        {(tipoHonorarioForm?.includes("Fixo") || tipoHonorarioForm?.includes("Fixos")) && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-500 font-bold">Valor de Honorários Fixos:</span>
                            <span className="font-extrabold text-gray-950">R$ {honorarioFixoValorForm || "0,00"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD: APURAÇÃO TRABALHISTA */}
                {["exito_completo_trabalhista", "fixo_mais_exito_completo_trabalhista"].includes(modeloHonorariosForm) && (
                  <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
                    {/* Header */}
                    <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale className="text-indigo-650" size={20} />
                        <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                          Apuração de Verbas Trabalhistas (Homologação)
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 border border-indigo-200 rounded-full font-mono">
                        Liquidação Trabalhista
                      </span>
                    </div>

                    {/* Questions list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                      {/* Q1: Id. / folha / evento que HOMOLOGOU OS CALCULOS? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Qual é o Id. / folha / evento que homologou os cálculos?
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoTrabalhistaState.idHomologacaoCalculos || ""}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("idHomologacaoCalculos", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                          placeholder="Ex: Id a4c3e8, folha 412"
                        />
                      </div>

                      {/* Q2: Onde a sentença de homologação está no processo? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Onde a sentença de homologação está no processo?
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoTrabalhistaState.localSentencaHomologacao || ""}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("localSentencaHomologacao", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                          placeholder="Ex: Evento 125, pág 3"
                        />
                      </div>

                      {/* Q3: Qual é o crédito líquido ao exequente? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Qual é o crédito líquido ao exequente? (R$)
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoTrabalhistaState.creditoLiquido || ""}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("creditoLiquido", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                          placeholder="Ex: R$ 45.230,12"
                        />
                      </div>

                      {/* Q4: Quanto é o Depósito do FGTS em conta vinculada? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Quanto é o Depósito do FGTS em conta vinculada? (R$)
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoTrabalhistaState.fgtsContaVinculada || ""}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("fgtsContaVinculada", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                          placeholder="Ex: R$ 8.412,50"
                        />
                      </div>

                      {/* Q5: Qual é o recolhimento do INSS neste caso? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Qual é o recolhimento do INSS neste caso? (R$)
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoTrabalhistaState.inssRecolhimento || ""}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("inssRecolhimento", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                          placeholder="Ex: R$ 2.341,95"
                        />
                      </div>

                      {/* Q6: Houve condenação em sucumbência? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Houve condenação em sucumbência?
                        </label>
                        <select
                          value={financeiroApuracaoTrabalhistaState.houveSucumbencia || "não"}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("houveSucumbencia", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                        >
                          <option value="não">Não</option>
                          <option value="sim">Sim</option>
                        </select>
                      </div>

                      {/* Condicional Sucumbência */}
                      {financeiroApuracaoTrabalhistaState.houveSucumbencia === "sim" && (
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                            Qual o valor da sucumbência? (R$)
                          </label>
                          <input
                            type="text"
                            value={financeiroApuracaoTrabalhistaState.valorSucumbencia || ""}
                            onChange={(e) => handleUpdateApuracaoTrabalhista("valorSucumbencia", e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                            placeholder="Ex: R$ 5.000,00"
                          />
                        </div>
                      )}

                      {/* Q7: Foi celebrado Acordo no presente caso? */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Foi celebrado Acordo no presente caso?
                        </label>
                        <select
                          value={financeiroApuracaoTrabalhistaState.houveAcordo || "não"}
                          onChange={(e) => handleUpdateApuracaoTrabalhista("houveAcordo", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-800 outline-none transition"
                        >
                          <option value="não">Não</option>
                          <option value="sim">Sim</option>
                        </select>
                      </div>

                      {/* Condicional de Acordo celebrado */}
                      {financeiroApuracaoTrabalhistaState.houveAcordo === "sim" && (
                        <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-4 animate-fadeIn">
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Detalhes do Acordo Celebrado</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-550">
                                Onde o acordo foi firmado no processo?
                              </label>
                              <input
                                type="text"
                                value={financeiroApuracaoTrabalhistaState.localAcordoProcesso || ""}
                                onChange={(e) => handleUpdateApuracaoTrabalhista("localAcordoProcesso", e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                placeholder="Ex: Evento 45 ou folha 123"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-550">
                                Onde está a decisão homologatória do acordo?
                              </label>
                              <input
                                type="text"
                                value={financeiroApuracaoTrabalhistaState.localDecisaoHomologatoriaAcordo || ""}
                                onChange={(e) => handleUpdateApuracaoTrabalhista("localDecisaoHomologatoriaAcordo", e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                                placeholder="Ex: Evento 52, pág 2"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-550">
                                Como será feito o pagamento do acordo?
                              </label>
                              <select
                                value={financeiroApuracaoTrabalhistaState.formaPagamentoAcordo || "Dinheiro"}
                                onChange={(e) => handleUpdateApuracaoTrabalhista("formaPagamentoAcordo", e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-850 outline-none transition"
                              >
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Pix">Pix</option>
                                <option value="Alvará">Alvará</option>
                                <option value="Depósito em Conta">Depósito em Conta</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-550">
                                Valor total depositado em conta (R$)
                              </label>
                              <input
                                type="text"
                                value={financeiroApuracaoTrabalhistaState.valorTotalDepositoConta || ""}
                                onChange={(e) => handleUpdateApuracaoTrabalhista("valorTotalDepositoConta", e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition font-mono"
                                placeholder="Ex: R$ 35.000,00"
                              />
                            </div>

                            <div className="space-y-1 col-span-1 md:col-span-2">
                              <label className="text-[10px] font-bold uppercase text-slate-555">
                                Como o valor total será pago? (Qual o parcelamento?)
                              </label>
                              <input
                                type="text"
                                value={financeiroApuracaoTrabalhistaState.datasPagamentoParcelas || ""}
                                onChange={(e) => handleUpdateApuracaoTrabalhista("datasPagamentoParcelas", e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-850 outline-none transition"
                                placeholder="Ex: 5 parcelas de R$ 7.000,00 com vencimento no dia 10 de cada mês"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-550">
                                Haverá o pagamento por alvará judicial?
                              </label>
                              <select
                                value={financeiroApuracaoTrabalhistaState.haveraAlvara || "não"}
                                onChange={(e) => handleUpdateApuracaoTrabalhista("haveraAlvara", e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-gray-800 outline-none transition"
                              >
                                <option value="não">Não</option>
                                <option value="sim">Sim</option>
                              </select>
                            </div>

                            {financeiroApuracaoTrabalhistaState.haveraAlvara === "sim" && (
                              <div className="space-y-1 animate-fadeIn">
                                <label className="text-[10px] font-bold uppercase text-indigo-900 font-extrabold">
                                  Valor do alvará judicial (R$)
                                </label>
                                <input
                                  type="text"
                                  value={financeiroApuracaoTrabalhistaState.valorAlvara || ""}
                                  onChange={(e) => handleUpdateApuracaoTrabalhista("valorAlvara", e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-indigo-200 focus:border-indigo-505 rounded-lg text-xs font-bold text-gray-800 outline-none transition font-mono"
                                  placeholder="Ex: R$ 10.230,00"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Save Action */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-[10px] text-gray-405 leading-relaxed font-semibold">
                        ⚠️ A gravação recalcula os rateios e snapshots analíticos em tempo de persistência.
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveApuracaoTrabalhistaToDb}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <Save size={14} />
                        Gravar Apuração Trabalhista
                      </button>
                    </div>
                  </div>
                )}

                {/* RATEIO PANEL TRABALHISTA */}
                {["exito_completo_trabalhista", "fixo_mais_exito_completo_trabalhista"].includes(modeloHonorariosForm) && (
                  <div className="bg-slate-900 text-white border border-slate-950 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
                    <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="text-yellow-400 shrink-0" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-105">
                          Demonstrativo de Rateio Contratual e Repasses
                        </h3>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono">
                        Parâmetro {percentualExitoForm || "30%"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                      <div className="bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-405 block mb-1 font-sans">Crédito Líquido Base:</span>
                        <span className="text-sm font-black text-slate-200">R$ {financeiroApuracaoTrabalhistaState.creditoLiquido || "0,00"}</span>
                      </div>

                      <div className="bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-305 block mb-1 font-sans">Contratuais Escritório:</span>
                        <span className="text-sm font-black text-indigo-400">R$ {financeiroRateioState.totalHonorariosContratuais || "0,00"}</span>
                      </div>

                      <div className="bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-yellow-305 block mb-1 font-sans">Sucumbenciais Devidos:</span>
                        <span className="text-sm font-black text-yellow-400">R$ {financeiroRateioState.totalHonorariosSucumbenciais || "0,00"}</span>
                      </div>

                      <div className="bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-305 block mb-1 font-sans">Líquido do Cliente (Repasse):</span>
                        <span className="text-sm font-black text-emerald-400">R$ {financeiroRateioState.totalCliente || "0,00"}</span>
                      </div>
                    </div>

                    <div className="bg-slate-800/40 p-4 rounded-xl text-slate-300 text-[11px] leading-relaxed space-y-2">
                      <p className="font-sans font-medium text-slate-300">
                        💡 <strong>Memória de Cálculo Comercial:</strong> O crédito total homologado é o ponto de partida do rateio. Os honorários contratuais de {percentualExitoForm || "30%"} são deduzidos do crédito do cliente, acrescido de honorários de sucumbência arbitrados ({financeiroApuracaoTrabalhistaState.houveSucumbencia === "sim" ? "Sim" : "Não"}), totalizando um saldo a favor dos advogados de <strong>R$ {financeiroRateioState.totalAdvogado || "0,00"}</strong>.
                      </p>
                      {financeiroApuracaoTrabalhistaState.fgtsContaVinculada && (
                        <p className="border-t border-slate-850 pt-2 font-sans font-medium text-amber-300">
                          💰 <strong>FGTS Vinculado Adicional:</strong> O exequente receberá diretamente em sua conta vinculada o montante adicional de <strong>R$ {financeiroApuracaoTrabalhistaState.fgtsContaVinculada}</strong>.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* CARD: APURAÇÃO PREVIDENCIÁRIA */}
                {["exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm) && (
                  <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
                    {/* Header */}
                    <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="text-indigo-650" size={20} />
                        <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                          Apuração de Benefícios Previdenciários (Inss)
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 border border-emerald-200 rounded-full font-mono">
                        Liquidação de Atrasados
                      </span>
                    </div>

                    {/* Inputs list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                      {/* Q1: Valor total acumulado de atrasados (retroativo) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Valor total de acumulados atrasados (R$)
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoPrevidenciariaState.valorRetroativo || ""}
                          onChange={(e) => handleUpdateApuracaoPrevidenciaria("valorRetroativo", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                          placeholder="Ex: R$ 68.210,00"
                        />
                      </div>

                      {/* Q2: Valor do benefício mensal implantado */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Valor do Benefício Mensal Implantado (R$)
                        </label>
                        <input
                          type="text"
                          value={financeiroApuracaoPrevidenciariaState.valorBeneficioMensal || ""}
                          onChange={(e) => handleUpdateApuracaoPrevidenciaria("valorBeneficioMensal", e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                          placeholder="Ex: R$ 3.820,00"
                        />
                      </div>

                      {/* Q3: Quantidade de parcelas futuras */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Quantidade de Parcelas Futuras Contratadas (Mensalidades)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={quantidadeParcelasExitoPrevidenciarioForm}
                          onChange={(e) => {
                            setQuantidadeParcelasExitoPrevidenciarioForm(Number(e.target.value));
                            handleUpdateApuracaoPrevidenciaria("quantidadeParcelasExitoPrevidenciario", Number(e.target.value));
                          }}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition"
                          placeholder="Ex: 4"
                        />
                      </div>

                      {/* Q4: Percentual de Êxito sobre Retroativo */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                          Percentual de Êxito sobre Retroativos (%)
                        </label>
                        <input
                          type="text"
                          value={percentualExitoSobreRetroativoForm}
                          onChange={(e) => {
                            setPercentualExitoSobreRetroativoForm(e.target.value);
                            handleUpdateApuracaoPrevidenciaria("percentualExitoSobreRetroativo", e.target.value);
                          }}
                          className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold text-gray-800 outline-none transition font-mono"
                          placeholder="Ex: 35%"
                        />
                      </div>
                    </div>

                    {/* Save Action */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-[10px] text-gray-450 leading-relaxed font-semibold">
                        ⚠️ A gravação recalcula os rateios e snapshots do INSS atrasado de forma segura no BD.
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveApuracaoPrevidenciariaToDb}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <Save size={14} />
                        Gravar Apuração Previdenciária
                      </button>
                    </div>
                  </div>
                )}

                {/* RATEIO PANEL INSS PREVIDENCIARIO */}
                {["exito_completo_previdenciario", "fixo_mais_exito_completo_previdenciario"].includes(modeloHonorariosForm) && (
                  <div className="bg-zinc-950 text-white border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
                    <div className="pb-4 border-b border-zinc-805 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale className="text-yellow-405" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                          Demonstrativo de Rateio Previdenciário (Atrasados + Futuros)
                        </h3>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded font-mono">
                        Parâmetro {percentualExitoSobreRetroativoForm || "30%"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                      <div className="bg-zinc-900/65 border border-zinc-800 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1 font-sans">Honorários do Retroativo:</span>
                        <span className="text-sm font-black text-zinc-200">R$ {financeiroRateioState.valorHonorariosRetroativo || "0,00"}</span>
                      </div>

                      <div className="bg-zinc-900/65 border border-zinc-800 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 block mb-1 font-sans">Honorários sobre Tutela Futura:</span>
                        <span className="text-sm font-black text-indigo-400">R$ {financeiroRateioState.valorHonorariosParcelasFuturas || "0,00"}</span>
                      </div>

                      <div className="bg-zinc-900/65 border border-zinc-800 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-305 block mb-1 font-sans">Líquido do Cliente (Atrasados):</span>
                        <span className="text-sm font-black text-emerald-400">R$ {financeiroRateioState.totalCliente || "0,00"}</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-zinc-400 text-[11px] leading-relaxed">
                      <p className="font-sans font-medium text-zinc-300">
                        💡 <strong>Memória de Cálculo Previdenciária:</strong> O exequente receberá o total acumulado do retroativo deduzido de {percentualExitoSobreRetroativoForm || "30%"} contratados, totalizando um repasse de atrasados de <strong>R$ {financeiroRateioState.totalCliente || "0,00"}</strong>. Adicionalmente, as parcelas de tutela futuras arbitradas em contratos ({quantidadeParcelasExitoPrevidenciarioForm}x parcelas de benefício mensal de R$ {financeiroApuracaoPrevidenciariaState.valorBeneficioMensal || "0,00"}) geram um faturamento adicional de <strong>R$ {financeiroRateioState.valorHonorariosParcelasFuturas || "0,00"}</strong>, totalizando em favor do escritório <strong>R$ {financeiroRateioState.totalAdvogado || "0,00"}</strong>.
                      </p>
                    </div>
                  </div>
                )}



                {/* CARD: Tabela analítica do contrato de honorários */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Header */}
                  <div className="pb-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Coins className="text-emerald-650 animate-bounce" size={20} />
                      <h3 className="text-sm font-black uppercase text-gray-900 tracking-wider">
                        Tabela analítica do contrato de honorários
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGerarTabelaAutomatica}
                        className="inline-flex items-center gap-1.5 bg-gray-55 hover:bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                        title="Sincroniza/Gera parcelas sugeridas com base nas configurações acima"
                      >
                        <RefreshCw size={12} className="text-gray-500 shrink-0" />
                        <span>Gerar / Sincronizar Parcelas</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddParcelaManual}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-3xs"
                      >
                        <Plus size={12} />
                        <span>Adicionar Parcela</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary grid values ("Dados do contrato") */}
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 text-xs grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-0.5 font-sans">Serviço</span>
                      <span className="font-extrabold text-slate-800 break-words font-sans">{tipoServicoContratadoForm || "Não definido"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-0.5 font-sans">Tipo Honorários</span>
                      <span className="font-extrabold text-slate-800 font-sans">{tipoHonorarioForm || "Não definido"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-0.5 font-sans">Valor Fixo</span>
                      <span className="font-mono font-extrabold text-slate-900">R$ {honorarioFixoValorForm || "0,00"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-0.5 font-sans">Pagamento</span>
                      <span className="font-semibold text-slate-700 font-sans">{formaPagamentoForm || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-0.5 font-sans">Recebimento Padrão</span>
                      <span className="font-bold text-indigo-700 font-sans">{tipoRecebimentoForm || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-0.5 font-sans">Configuração</span>
                      <span className="font-bold text-slate-800 font-sans">{quantidadeParcelasForm}x + Entrada (R$ {valorEntradaForm || "0,00"})</span>
                    </div>
                  </div>

                  {/* Table area */}
                  {tabelaAnalitica.length === 0 ? (
                    <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center bg-gray-50/20 space-y-3">
                      <p className="text-gray-500 font-medium text-xs font-sans">
                        Nenhuma parcela analítica está cadastrada ainda para este contrato.
                      </p>
                      <button
                        type="button"
                        onClick={handleGerarTabelaAutomatica}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer font-sans"
                      >
                        <RefreshCw size={12} />
                        Gerar sugerido com base no Contrato
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-150 rounded-xl bg-white shadow-3xs max-w-full">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 uppercase text-[9px] tracking-wider font-extrabold border-b border-gray-150 font-mono">
                            <th className="py-3 px-4 font-black">Nº de Parcelas</th>
                            <th className="py-3 px-4 font-black">Valor Parcela</th>
                            <th className="py-3 px-4 font-black">Vencimento</th>
                            <th className="py-3 px-4 font-black">Forma de Recebimento</th>
                            <th className="py-3 px-4 font-black">Status</th>
                            <th className="py-3 px-4 text-center font-black">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-sans">
                          {tabelaAnalitica.map((row) => {
                            const isEditing = editingRowId === row.id;

                            return (
                              <tr key={row.id} className="hover:bg-gray-50/50 transition-all">
                                {/* Nº de Parcelas */}
                                <td className="py-3.5 px-4 font-bold text-gray-900 font-mono">
                                  {row.numero}
                                </td>

                                {/* Valor Parcela */}
                                <td className="py-3.5 px-4 font-extrabold text-gray-950 font-mono">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editingRowVal}
                                      onChange={(e) => setEditingRowVal(e.target.value)}
                                      className="border border-gray-300 rounded px-2 py-1 w-28 bg-white font-mono font-bold text-xs"
                                    />
                                  ) : (
                                    row.valor
                                  )}
                                </td>

                                {/* Vencimento */}
                                <td className="py-3.5 px-4 text-gray-700 font-mono">
                                  {isEditing ? (
                                    <input
                                      type="date"
                                      value={editingRowDate}
                                      onChange={(e) => setEditingRowDate(e.target.value)}
                                      className="border border-gray-300 rounded px-2 py-1 bg-white font-mono text-xs"
                                    />
                                  ) : (
                                    row.dataVencimento ? new Date(row.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"
                                  )}
                                </td>

                                {/* Forma de Recebimento */}
                                <td className="py-3.5 px-4 font-sans">
                                  {isEditing ? (
                                    <select
                                      value={editingRowForma}
                                      onChange={(e) => setEditingRowForma(e.target.value)}
                                      className="border border-gray-300 rounded px-2 py-1 bg-white text-xs font-semibold text-slate-800 font-sans"
                                    >
                                      <option value="PIX">PIX</option>
                                      <option value="Boleto">Boleto Bancário</option>
                                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                                      <option value="TED / Transferência">TED / Transferência</option>
                                      <option value="Dinheiro">Dinheiro</option>
                                      <option value="Depósito">Depósito</option>
                                    </select>
                                  ) : (
                                    <span className="font-semibold text-slate-705">{row.formaRecebimento || "—"}</span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="py-3.5 px-4 font-sans max-w-28">
                                  {isEditing ? (
                                    <select
                                      value={editingRowStatus}
                                      onChange={(e) => {
                                        const s = e.target.value as "pago" | "pendente" | "atrasado";
                                        setEditingRowStatus(s);
                                        setEditingRowPago(s === "pago");
                                      }}
                                      className={`px-2.5 py-1 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all border font-mono bg-white cursor-pointer ${
                                        editingRowStatus === "pago"
                                          ? "bg-blue-50 text-blue-700 border-blue-300"
                                          : editingRowStatus === "atrasado"
                                          ? "bg-rose-50 text-rose-700 border-rose-300"
                                          : "bg-amber-50 text-amber-700 border-amber-300"
                                      }`}
                                    >
                                      <option value="pendente">Pendente</option>
                                      <option value="pago">Pago</option>
                                      <option value="atrasado">Atrasado</option>
                                    </select>
                                  ) : (
                                    (() => {
                                      const s = row.status || (row.pago ? "pago" : "pendente");
                                      if (s === "pago") {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-[9px] uppercase font-black tracking-wider border font-mono bg-blue-50 text-blue-700 border-blue-200">
                                            Pago
                                          </span>
                                        );
                                      } else if (s === "atrasado") {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-[9px] uppercase font-black tracking-wider border font-mono bg-rose-50 text-rose-700 border-rose-200 animate-pulse">
                                            Atrasado
                                          </span>
                                        );
                                      } else {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-[9px] uppercase font-black tracking-wider border font-mono bg-amber-50 text-amber-700 border-amber-200">
                                            Pendente
                                          </span>
                                        );
                                      }
                                    })()
                                  )}
                                </td>

                                {/* Ações */}
                                <td className="py-3.5 px-4 text-center font-sans">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-2 font-sans">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const refreshedTable = tabelaAnalitica.map(item => {
                                            if (item.id === row.id) {
                                              return {
                                                ...item,
                                                valor: editingRowVal,
                                                dataVencimento: editingRowDate,
                                                pago: editingRowStatus === "pago",
                                                status: editingRowStatus,
                                                formaRecebimento: editingRowForma,
                                              };
                                            }
                                            return item;
                                          });
                                          await handleSaveTabelaAnalitica(refreshedTable);
                                          setEditingRowId(null);
                                        }}
                                        className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer shadow-3xs"
                                      >
                                        <Check size={11} />
                                        <span>Confirmar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRowId(null);
                                        }}
                                        className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold px-2 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1.5 font-sans">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRowId(row.id);
                                          setEditingRowVal(row.valor || "");
                                          setEditingRowDate(row.dataVencimento || "");
                                          setEditingRowPago(!!row.pago);
                                          setEditingRowStatus(row.status || (row.pago ? "pago" : "pendente"));
                                          setEditingRowForma(row.formaRecebimento || "PIX");
                                        }}
                                        className="inline-flex items-center gap-1 text-gray-500 hover:text-indigo-650 bg-gray-55 hover:bg-indigo-50 border border-transparent hover:border-indigo-150 px-2 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-bold"
                                        title="Editar parcela"
                                      >
                                        <Edit2 size={11} />
                                        <span>Editar</span>
                                      </button>

                                      {/* Brand social shortcut action icons */}
                                      <div className="flex items-center gap-1.5 pl-1.5 border-l border-gray-200">
                                        {/* WhatsApp Shortcut */}
                                        {(() => {
                                          const rawPhone = client?.phone || 
                                                           client?.pfDadosPessoais?.pf_telefone || 
                                                           client?.pfContato?.pf_telefone || 
                                                           client?.pfData?.pf_telefone || 
                                                           client?.pjDadosEmpresa?.pj_telefoneEmpresa || 
                                                           client?.pjContatoEmpresa?.pj_telefoneEmpresa || 
                                                           client?.pjData?.pj_telefoneEmpresa || "";
                                          const cleanPhone = rawPhone.replace(/\D/g, "");
                                          const resolvedPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "";
                                          const formattedDate = row.dataVencimento ? new Date(row.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—";
                                          const currentS = row.status || (row.pago ? "pago" : "pendente");
                                          const resolvedSLabel = currentS === "pago" ? "PAGO (Agradecemos o pagamento!)" : currentS === "atrasado" ? "ATRASADO" : "PENDENTE";
                                          const templateMsg = `Olá, somos do financeiro BOSS. Gostaríamos de conversar sobre a sua parcela do contrato de honorários: *${row.numero}*, com vencimento em *${formattedDate}*, que consta atualmente como *${resolvedSLabel}*.`;
                                          
                                          return (
                                            <a
                                              href={`https://web.whatsapp.com/send?phone=${resolvedPhone}&text=${encodeURIComponent(templateMsg)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              title="Abrir WhatsApp com lembrete pronto"
                                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
                                            >
                                              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.063 5.448 5.513 0 12.21 0c3.243.001 6.293 1.264 8.588 3.562C23.093 5.86 24.354 8.911 24.353 12.15c-.004 6.759-5.454 12.21-12.155 12.21-1.999-.001-3.959-.496-5.713-1.439L0 24zm6.59-4.846c1.6.95 3.1 1.4 4.8 1.4 5.3 0 9.7-4.4 9.7-9.7 0-2.6-1-5-2.9-6.8-1.9-1.9-4.4-2.9-6.8-2.9-5.3 0-9.7 4.4-9.7 9.7-.001 1.9.5 3.7 1.4 5.3l-.9 3.4 3.4-.9zm11.448-6.1c-.244-.122-1.445-.714-1.668-.795-.223-.081-.386-.122-.549.122-.163.244-.63.795-.772.956-.143.161-.285.181-.529.06-2.455-1.228-4.048-2.615-4.783-3.876-.194-.336-.02-.519.148-.687.151-.148.337-.393.506-.59.168-.196.223-.336.335-.559.112-.224.056-.419-.028-.581-.084-.162-.733-1.764-.997-2.427-.268-.673-.54-.58-.733-.58-.19-.001-.407-.001-.624-.001-.217 0-.57.081-.868.407-.298.326-1.138 1.112-1.138 2.71 0 1.597 1.164 3.136 1.326 3.359.163.223 2.291 3.511 5.55 4.914.776.334 1.38.533 1.85.682.78.246 1.49.213 2.05.129.626-.093 1.445-.59 1.648-1.16.203-.57.203-1.057.142-1.158-.06-.101-.223-.162-.467-.282z"/>
                                              </svg>
                                            </a>
                                          );
                                        })()}

                                        {/* Facebook Shortcut */}
                                        <a
                                          href={`https://www.facebook.com/search/top?q=${encodeURIComponent(client?.nomeCompleto || client?.razaoSocial || "")}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Buscar cliente no Facebook"
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                                        >
                                          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                          </svg>
                                        </a>

                                        {/* Instagram Shortcut */}
                                        <a
                                          href={`https://www.instagram.com/explore/tags/${encodeURIComponent((client?.nomeCompleto || client?.razaoSocial || "").replace(/\s+/g, "").toLowerCase())}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Buscar tags/cliente no Instagram"
                                          className="p-1.5 text-pink-600 hover:bg-pink-50 rounded-lg border border-transparent hover:border-pink-200 transition-all cursor-pointer"
                                        >
                                          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                          </svg>
                                        </a>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Tem certeza que gostaria de excluir a ${row.numero}?`)) {
                                            handleDeletarParcela(row.id);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-rose-100 ml-1"
                                        title="Excluir parcela"
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

                {/* CARD: Relatório global do contrato */}
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
                    <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
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
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block font-sans">Valor Total Contratado</span>
                          <span className="text-base font-black text-slate-900 font-mono">{formatCurrencySum(totalContrato)}</span>
                          <div className="text-[10px] text-zinc-500 font-sans">Soma de todas as parcelas analíticas</div>
                        </div>

                        {/* Total Pago */}
                        <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-blue-500 block font-sans font-sans">Total Recebido (Pago)</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-black text-blue-700 font-mono">{formatCurrencySum(totalPago)}</span>
                            <span className="text-xs font-bold text-blue-600 font-mono">({porcEfetivado.toFixed(1)}%)</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-sans">
                            {tabelaAnalitica.filter(r => (r.status || (r.pago ? "pago" : "pendente")) === "pago").length} parcelas quitadas
                          </div>
                        </div>

                        {/* Total Pendente */}
                        <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100 space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 block font-sans font-sans">Total Pendente (A Vencer)</span>
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
                        <div className="bg-rose-50/30 p-4 rounded-xl border border-rose-100 space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-rose-600 block font-sans font-sans">Total em Atraso</span>
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
                      <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-indigo-600" size={15} />
                          <span className="font-sans font-semibold text-slate-700">
                            Falta arrecadar para quitação integral:
                          </span>
                          <span className="font-mono font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded shadow-3xs text-[13px]">
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
                              client?.googleDriveClientFolderUrl ||
                              client?.gdriveFolderUrl ||
                              caseObj?.gdriveFolderUrl ||
                              ""
                            ).trim();
                            if (!driveUrl) return null;
                            return (
                              <a
                                href={driveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-700 transition-colors cursor-pointer font-sans"
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
                            disabled={saving}
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
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                            Gerar Relatório Global (GDi)
                          </button>

                          <button
                            type="button"
                            disabled={saving}
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
                            className="w-full sm:w-auto px-4 py-2.5 bg-slate-850 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer font-mono"
                          >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
                            Gerar Tabela Analítica (GDi)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* CARD: Google Docs Integration - Juridico Interno */}
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
                    client?.googleDriveClientFolderUrl ||
                    client?.gdriveFolderUrl ||
                    caseObj?.gdriveFolderUrl ||
                    ""
                  ).trim();

                  return (
                    <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
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
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between space-y-4">
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
                            disabled={saving}
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
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                            Gerar Notificação
                          </button>
                        </div>

                        {/* CARD 2: Protesto extrajudicial do contrato de honorários */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between space-y-4">
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
                            disabled={saving}
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
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
                            Gerar Protesto
                          </button>
                        </div>

                        {/* CARD 3: Ação de cobrança de Honorários Advocatícios */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between space-y-4">
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
                            disabled={saving}
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
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Scale size={11} />}
                            Gerar Petição Inicial
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Overdue/Late billing options panel */}
                {(() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const temCobrançasEmAtraso = tabelaAnalitica.some(row => {
                    const s = row.status || (row.pago ? "pago" : "pendente");
                    if (s === "atrasado") return true;
                    if (s === "pendente" && row.dataVencimento && row.dataVencimento < todayStr) return true;
                    return false;
                  });

                  if (!temCobrançasEmAtraso) return null;

                  const rawPhone = client?.phone || 
                                   client?.pfDadosPessoais?.pf_telefone || 
                                   client?.pfContato?.pf_telefone || 
                                   client?.pfData?.pf_telefone || 
                                   client?.pjDadosEmpresa?.pj_telefoneEmpresa || 
                                   client?.pjContatoEmpresa?.pj_telefoneEmpresa || 
                                   client?.pjData?.pj_telefoneEmpresa || "";
                  const cleanPhone = rawPhone.replace(/\D/g, "");
                  const resolvedPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "";
                  const clientName = client?.nomeCompleto || client?.razaoSocial || "Cliente";

                  const whatsappBaseUrl = `https://web.whatsapp.com/send?phone=${resolvedPhone}&text=${encodeURIComponent(
                    `Olá, ${clientName}. Constatamos parcelas em atraso referente ao seu contrato de honorários advocatícios em nosso sistema. Por favor, entre em contato para regularizarmos.`
                  )}`;

                  return (
                    <div className="bg-white border border-rose-150 rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 pb-3 border-b border-rose-100">
                        <AlertTriangle className="text-rose-600 animate-pulse" size={20} />
                        <h3 className="text-sm font-black uppercase text-rose-950 tracking-wider">
                          Como deseja fazer a cobrança dos honorários em atraso?
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* WhatsApp Option */}
                        <a
                          href={whatsappBaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative group p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 hover:border-emerald-200 rounded-xl transition-all cursor-pointer text-left block space-y-2 select-none"
                        >
                          <div className="flex items-center justify-between">
                            <div className="p-2 bg-emerald-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.063 5.448 5.513 0 12.21 0c3.243.001 6.293 1.264 8.588 3.562C23.093 5.86 24.354 8.911 24.353 12.15c-.004 6.759-5.454 12.21-12.155 12.21-1.999-.001-3.959-.496-5.713-1.439L0 24zm6.59-4.846c1.6.95 3.1 1.4 4.8 1.4 5.3 0 9.7-4.4 9.7-9.7 0-2.6-1-5-2.9-6.8-1.9-1.9-4.4-2.9-6.8-2.9-5.3 0-9.7 4.4-9.7 9.7-.001 1.9.5 3.7 1.4 5.3l-.9 3.4 3.4-.9zm11.448-6.1c-.244-.122-1.445-.714-1.668-.795-.223-.081-.386-.122-.549.122-.163.244-.63.795-.772.956-.143.161-.285.181-.529.06-2.455-1.228-4.048-2.615-4.783-3.876-.194-.336-.02-.519.148-.687.151-.148.337-.393.506-.59.168-.196.223-.336.335-.559.112-.224.056-.419-.028-.581-.084-.162-.733-1.764-.997-2.427-.268-.673-.54-.58-.733-.58-.19-.001-.407-.001-.624-.001-.217 0-.57.081-.868.407-.298.326-1.138 1.112-1.138 2.71 0 1.597 1.164 3.136 1.326 3.359.163.223 2.291 3.511 5.55 4.914.776.334 1.38.533 1.85.682.78.246 1.49.213 2.05.129.626-.093 1.445-.59 1.648-1.16.203-.57.203-1.057.142-1.158-.06-.101-.223-.162-.467-.282z"/>
                              </svg>
                            </div>
                            <span className="bg-emerald-700/10 text-emerald-850 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider font-mono">
                              W.A Speed
                            </span>
                          </div>
                          <p className="font-sans font-bold text-slate-800 text-xs">WhatsApp</p>
                          <p className="text-[10px] text-zinc-500 leading-tight">
                            Atalhos e mensagens para WhatsApp. Envio automático real depende da API oficial e backend seguro.
                          </p>
                          <div className="pt-1 text-[8.5px] font-mono font-bold text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-100 mt-1">
                            Atalhos e Mensagens para WhatsApp
                          </div>
                        </a>

                        {/* Facebook Option */}
                        <a
                          href={`https://www.facebook.com/search/top?q=${encodeURIComponent(clientName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative group p-4 bg-blue-50 hover:bg-blue-100/80 border border-blue-100 hover:border-blue-200 rounded-xl transition-all cursor-pointer text-left block space-y-2 select-none"
                        >
                          <div className="flex items-center justify-between">
                            <div className="p-2 bg-blue-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                            </div>
                            <span className="bg-blue-100 text-blue-800 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider font-mono">
                              Messenger
                            </span>
                          </div>
                          <p className="font-sans font-bold text-slate-800 text-xs">Facebook</p>
                          <p className="text-[10px] text-zinc-500 leading-tight">
                            Busque o perfil social do cliente para comunicação privada institucional.
                          </p>
                        </a>

                        {/* Instagram Option */}
                        <a
                          href={`https://www.instagram.com/explore/tags/${encodeURIComponent(clientName.replace(/\s+/g, "").toLowerCase())}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative group p-4 bg-pink-50 hover:bg-pink-100/80 border border-pink-100 hover:border-pink-200 rounded-xl transition-all cursor-pointer text-left block space-y-2 select-none"
                        >
                          <div className="flex items-center justify-between">
                            <div className="p-2 bg-gradient-to-tr from-yellow-500 via-pink-600 to-purple-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                              </svg>
                            </div>
                            <span className="bg-pink-150 text-pink-700 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider font-mono">
                              Direct
                            </span>
                          </div>
                          <p className="font-sans font-bold text-slate-800 text-xs">Instagram</p>
                          <p className="text-[10px] text-zinc-500 leading-tight">
                            Acione o cliente de forma reservada pelos canais oficiais integrados.
                          </p>
                        </a>

                        {/* Gmail Option */}
                        <a
                          href={`mailto:${client?.email || ""}?subject=${encodeURIComponent("Notificação BOSS: Parcelas de Honorários em Atraso")}&body=${encodeURIComponent(
                            `Prezado(a) ${clientName},\n\nVerificamos em nosso sistema que há pendências no pagamento de suas parcelas do contrato de honorários advocatícios.\nPor favor, entre em contato conosco para providenciarmos uma nova via do boleto ou chave PIX de pagamento.\n\nAtenciosamente,\nFinanceiro BOSS.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative group p-4 bg-red-50 hover:bg-red-100/80 border border-red-100 hover:border-red-200 rounded-xl transition-all cursor-pointer text-left block space-y-2 select-none"
                        >
                          <div className="flex items-center justify-between">
                            <div className="p-2 bg-red-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                              <svg className="h-5 w-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className="bg-red-100 text-red-800 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider font-mono">
                              Gmail
                            </span>
                          </div>
                          <p className="font-sans font-bold text-slate-800 text-xs">Gmail / E-mail</p>
                          <p className="text-[10px] text-zinc-500 leading-tight">
                            Envie uma notificação formal eletrônica detalhada das cobranças em atraso.
                          </p>
                        </a>

                        {/* Envio de Carta Option */}
                        <div
                          onClick={() => alert("Simulando geração da Carta de Cobrança GDI. Integração ativa em ambiente de homologação!")}
                          className="relative group p-4 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 hover:border-indigo-200 rounded-xl transition-all cursor-pointer text-left block space-y-2 select-none"
                        >
                          <div className="flex items-center justify-between">
                            <div className="p-2 bg-indigo-650 text-white rounded-lg group-hover:scale-110 transition-transform">
                              <svg className="h-5 w-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5" />
                              </svg>
                            </div>
                            <span className="bg-indigo-100 text-indigo-800 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider font-mono">
                              Carta GDI
                            </span>
                          </div>
                          <p className="font-sans font-bold text-slate-800 text-xs">Envio de Carta</p>
                          <p className="text-[10px] text-zinc-500 leading-tight">
                            Emissão de carta física automática registrada postal para regularização financeira.
                          </p>
                          <div className="pt-1 text-[8.5px] font-mono font-bold text-indigo-700 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-100 mt-1">
                            📨 FUTURA INTEGRAÇÃO GDI
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeSubStep === 3 && (
              <div className="xl:col-span-12 max-w-4xl mx-auto w-full space-y-6 animate-fadeIn">
                {/* CARD 3: AUDITORIA DO CONTRATO PF */}
                <div className="space-y-4 bg-white border border-gray-150 rounded-2xl p-6 shadow-xs">
                  <div className="pb-3 border-b border-gray-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    <h4 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                      Auditoria da Etapa de Contrato de Honorários da Pessoa Física.
                    </h4>
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-extrabold text-gray-850">
                      3.1 Você gerou o contrato de honorários?
                    </p>
                    <div className="flex gap-4">
                      {["sim", "nao"].map((o) => (
                        <label
                          key={o}
                          className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-750"
                        >
                          <input
                            type="radio"
                            checked={wizardState.q3_1 === o}
                            onChange={() => {
                              saveWizardStateUpdate({
                                q3_1: o,
                                q3_4: o === "nao" ? "nao" : wizardState.q3_4,
                              });
                            }}
                          />
                          <span>{o === "sim" ? "sim ✅" : "não ❌"}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {wizardState.q3_1 === "sim" && (
                    <div className="space-y-4 border-l-2 border-blue-200 pl-4 animate-in fade-in duration-200">
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-gray-855">
                          3.2 Qual o modelo de contratação?
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-gray-50/55 border border-gray-100 rounded-xl gap-2">
                          {[
                            { key: "exito", label: "Êxito" },
                            { key: "fixo", label: "Fixo" },
                            { key: "exito_fixo", label: "Êxito + Fixo" },
                          ].map((m) => (
                            <label
                              key={m.key}
                              className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-750 font-bold"
                            >
                              <input
                                type="radio"
                                name="f_q3_2"
                                checked={wizardState.q3_2 === m.key}
                                onChange={() =>
                                  saveWizardStateUpdate({ q3_2: m.key })
                                }
                              />
                              <span>{m.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <EntregaDocumento
                        tipoDocumento="contrato"
                        tipoPessoa={client?.type === "PJ" ? "PJ" : "PF"}
                        googleDocsUrl={
                          caseObj?.contratoHonorariosGoogleDocsUrl || ""
                        }
                        whatsappCliente={
                          client?.type === "PF"
                            ? client?.pfDadosPessoais?.pf_whatsapp ||
                              client?.pfDadosPessoais?.pf_telefone ||
                              client?.pfData?.pf_whatsapp ||
                              client?.pfData?.pf_telefone ||
                              ""
                            : client?.pjContatoEmpresa?.pj_whatsappEmpresa ||
                              client?.pjContatoEmpresa?.pj_telefoneEmpresa ||
                              client?.pjData?.pj_whatsappEmpresa ||
                              client?.pjData?.pj_telefoneEmpresa ||
                              ""
                        }
                        emailCliente={
                          client?.type === "PF"
                            ? client?.pfDadosPessoais?.pf_email ||
                              client?.pfData?.pf_email ||
                              ""
                            : client?.pjContatoEmpresa?.pj_emailEmpresa ||
                              client?.pjData?.pj_emailEmpresa ||
                              ""
                        }
                        nomeCliente={clientName}
                        selectedMethods={wizardState.q3_3 || []}
                        onMethodsChange={(newMethods: string[]) =>
                          saveWizardStateUpdate({ q3_3: newMethods })
                        }
                        outroValue={wizardState.q3_3_outro || ""}
                        onOutroChange={(val: string) =>
                          saveWizardStateUpdate({ q3_3_outro: val })
                        }
                        questionNumber="3.3"
                      />

                      {["q3_4", "q3_5", "q3_6", "q3_7", "q3_8"].map((f, i) => {
                        const labels = [
                          "3.4 O cliente assinou o contrato 🖋️?",
                          "3.5 O advogado assinou o contrato 🖋️?",
                          "3.6 Você recebeu o contrato digitalizado?",
                          "3.7 Você recebeu o contrato digitalizado 🖨️ ?",
                          "3.8 O financeiro foi informado?",
                        ];
                        return (
                          <div key={f} className="space-y-1">
                            <p className="text-xs font-extrabold text-gray-855">
                              {labels[i]}
                            </p>
                            <div className="flex gap-4">
                              {["sim", "nao"].map((o) => (
                                <label
                                  key={o}
                                  className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-750"
                                >
                                  <input
                                    type="radio"
                                    name={`f_${f}`}
                                    checked={wizardState[f] === o}
                                    onChange={() =>
                                      saveWizardStateUpdate({ [f]: o })
                                    }
                                  />
                                  <span>{o === "sim" ? "sim ✅" : "não ❌"}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* NEW CARD: HISTÓRICO E AUDITORIA DO CONTRATO */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-4 animate-fadeIn">
                  <div className="pb-3 border-b border-gray-100 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                      Histórico e Auditoria do Contrato
                    </h4>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                      <span className="text-gray-500 font-bold">
                        3.1 Contrato Gerado?
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          wizardState.q3_1 === "sim"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {wizardState.q3_1 || "não preenchido"}
                      </span>
                    </div>

                    {wizardState.q3_1 === "sim" && (
                      <>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.2 Modelo Contratual:
                          </span>
                          <span className="font-semibold text-gray-805">
                            {wizardState.q3_2 === "exito" && "Êxito"}
                            {wizardState.q3_2 === "fixo" && "Fixo"}
                            {wizardState.q3_2 === "exito_fixo" &&
                              "Êxito + Fixo"}
                            {!wizardState.q3_2 && "—"}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.3 Meio(s) de Entrega Utilizados:
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {Array.isArray(wizardState.q3_3) &&
                            wizardState.q3_3.length > 0 ? (
                              wizardState.q3_3.map((method: string) => {
                                let label = method;
                                if (method === "fisica")
                                  label = "Física/Impressa";
                                if (method === "whatsapp")
                                  label = "WhatsApp";
                                if (method === "email") label = "E-mail";
                                if (method === "outro")
                                  label = `Outro (${wizardState.q3_3_outro || "—"})`;
                                return (
                                  <span
                                    key={method}
                                    className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded text-[10px] font-bold"
                                  >
                                    {label}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-gray-400 italic">
                                Nenhum selecionado
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.4 Assinado pelo Cliente 🖋️?
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              wizardState.q3_4 === "sim"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {wizardState.q3_4 || "não preenchido"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.5 Assinado pelo Advogado 🖋️?
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              wizardState.q3_5 === "sim"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {wizardState.q3_5 || "não preenchido"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.6 Recebeu o Contrato Digitalizado?
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              wizardState.q3_6 === "sim"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {wizardState.q3_6 || "não preenchido"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.7 Recebeu o Contrato Digitalizado 🖨️?
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              wizardState.q3_7 === "sim"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {wizardState.q3_7 || "não preenchido"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 font-bold">
                            3.8 Financeiro Informado?
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              wizardState.q3_8 === "sim"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {wizardState.q3_8 || "não preenchido"}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Google Docs Url */}
                    {caseObj?.contratoHonorariosGoogleDocsUrl && (
                      <div className="pt-1.5">
                        <span className="text-gray-500 font-bold block mb-1.5">
                          Link do Modelo de Contrato Gerado:
                        </span>
                        <div className="space-y-2">
                          <a
                            href={caseObj.contratoHonorariosGoogleDocsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-650 hover:underline font-semibold flex items-center gap-1 select-all truncate bg-gray-55/75 p-2.5 rounded-xl border border-gray-150"
                          >
                            <FileText
                              size={14}
                              className="text-indigo-600 shrink-0"
                            />
                            <span className="truncate">
                              {caseObj.contratoHonorariosGoogleDocsUrl}
                            </span>
                            <ExternalLink size={12} className="shrink-0" />
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenContrato(
                                caseObj.contratoHonorariosGoogleDocsUrl,
                              )
                            }
                            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
                          >
                            <FileText size={14} />
                            <span>Ver contrato de honorários gerado</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Uploaded Contract Files list */}
                    {wizardState.contratoFiles &&
                      wizardState.contratoFiles.length > 0 && (
                        <div className="pt-1">
                          <span className="text-gray-500 font-bold block mb-1.5">
                            Anexo(s) do Contrato Assinado:
                          </span>
                          <div className="space-y-1.5">
                            {wizardState.contratoFiles.map(
                              (f: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-xs"
                                >
                                  <FileText
                                    size={12}
                                    className="text-indigo-605 shrink-0"
                                  />
                                  <span className="truncate font-semibold text-indigo-900 font-mono flex-11 font-bold">
                                    {f.name}{" "}
                                    <span className="text-[10px] text-indigo-400 font-normal">
                                      ({f.size})
                                    </span>
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM STEP WORKFLOW CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => {
              if (activeSubStep === 1) {
                navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/tipo-producao`);
              } else if (activeSubStep === 2) {
                navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/Criar Contrato de Honorários`);
              } else if (activeSubStep === 3) {
                navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/financeiro/ver.detalhes.do.contrato.de.honorarios`);
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer"
          >
            <ArrowLeft size={14} />
            {activeSubStep === 1
              ? "Voltar para Subetapa 03 - Cadastrando Tarefa no Todoist"
              : activeSubStep === 2
              ? "Voltar para Subetapa 01 do Financeiro"
              : "Voltar para Subetapa 02 do Financeiro"}
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 px-6 py-3 rounded-xl font-bold transition-all text-xs hover:bg-gray-50 cursor-pointer"
            >
              <Save size={14} />
              Salvar e Sair
            </button>

            <div className="relative w-full sm:w-auto">
              {showUnsavedBalloon && (
                <div className="absolute bottom-full mb-3 right-0 w-80 p-3.5 bg-amber-600 text-white rounded-xl shadow-xl text-xs font-semibold leading-snug animate-bounce z-50">
                  <div className="relative">
                    <span>⚠️ Condições não foram gravadas! Isso pode afetar o gDI e a subetapa 02. Grave a operação antes de prosseguir.</span>
                    <div className="absolute top-full right-8 w-3 h-3 bg-amber-600 rotate-45 transform translate-y-1.5"></div>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAndAdvance}
                className="w-full inline-flex items-center justify-center gap-2 bg-gray-950 hover:bg-black text-white px-8 py-3.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <span>
                      {activeSubStep === 1
                        ? "Avançar para Subetapa 02 do Financeiro"
                        : activeSubStep === 2
                        ? "Avançar para Subetapa 03 do Financeiro"
                        : "Concluir Financeiro e Avançar"}
                    </span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Batalha Naval Diagnostic Modal */}
      {isBattleNavalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 text-slate-100 w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-800 font-sans">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚢</span>
                  <h3 className="text-base font-black uppercase tracking-wider text-slate-100">
                    Batalha Naval — Auditoria de Rastreabilidade Carry-On
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Mapa de conformidade de placeholders e governança do contrato de honorários fáticos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBattleNavalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {battleNavalLoading ? (
              <div className="flex-1 py-24 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="animate-spin text-amber-500" size={32} />
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                  Carregando diagnóstico fático...
                </span>
              </div>
            ) : !battleNavalData ? (
              <div className="flex-1 p-8 text-center text-slate-400 text-xs font-mono">
                Nenhum dado fático carregado.
              </div>
            ) : (() => {
              const audit = battleNavalData.placeholderAudit || {};
              const summary = audit.summary || { total: 0, success: 0, failed: 0 };
              const rows = audit.rows || [];

              const filteredRows = rows.filter((row: any) => {
                const matchesSearch = 
                  row.placeholder.toLowerCase().includes(battleSearchQuery.toLowerCase()) ||
                  row.informationLabel.toLowerCase().includes(battleSearchQuery.toLowerCase()) ||
                  row.sourceStage.toLowerCase().includes(battleSearchQuery.toLowerCase()) ||
                  row.sourceField.toLowerCase().includes(battleSearchQuery.toLowerCase());
                
                const matchesStatus = 
                  battleStatusFilter === "all" ||
                  (battleStatusFilter === "success" && row.replacementStatus === "success") ||
                  (battleStatusFilter === "failed" && row.replacementStatus === "failed");

                return matchesSearch && matchesStatus;
              });

              return (
                <>
                  {/* Summary Banner */}
                  <div className="p-6 bg-slate-950/20 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-850">
                    <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-2xl flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Analisado</span>
                      <span className="text-2xl font-black font-mono text-slate-100">{summary.total}</span>
                    </div>
                    <div className="bg-emerald-950/10 p-4 border border-emerald-900/30 rounded-2xl flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Substituído com Sucesso</span>
                      <span className="text-2xl font-black font-mono text-emerald-400">{summary.success}</span>
                    </div>
                    <div className="bg-rose-950/10 p-4 border border-rose-900/30 rounded-2xl flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Falha / Pendente</span>
                      <span className="text-2xl font-black font-mono text-rose-400">{summary.failed}</span>
                    </div>
                    <div className="bg-blue-950/10 p-4 border border-blue-900/30 rounded-2xl flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Status do Contrato</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                        <span className="text-xs font-black uppercase text-blue-300 font-mono">
                          {summary.failed > 0 ? "REVISÃO MANUAL RECOMENDADA" : "PRONTO PARA EMISSÃO"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Filter controls */}
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBattleStatusFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          battleStatusFilter === "all" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-750"
                        }`}
                      >
                        Todos ({rows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBattleStatusFilter("success")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          battleStatusFilter === "success" ? "bg-emerald-600 text-white" : "bg-slate-800 text-emerald-400 hover:bg-slate-750"
                        }`}
                      >
                        <CheckCircle2 size={12} /> Sucesso ({rows.filter((r: any) => r.replacementStatus === "success").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBattleStatusFilter("failed")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          battleStatusFilter === "failed" ? "bg-rose-600 text-white" : "bg-slate-800 text-rose-400 hover:bg-slate-750"
                        }`}
                      >
                        <AlertCircle size={12} /> Falhas ({rows.filter((r: any) => r.replacementStatus === "failed").length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2 max-w-sm w-full">
                      <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                          type="text"
                          value={battleSearchQuery}
                          onChange={(e) => setBattleSearchQuery(e.target.value)}
                          placeholder="Buscar por placeholder, campo, etapa..."
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl py-1.5 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(battleNavalData, null, 2));
                          alert("Dados copiados para a área de transferência!");
                        }}
                        className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Copiar JSON Completo"
                      >
                        <Copy size={12} /> JSON
                      </button>
                    </div>
                  </div>

                  {/* Table area */}
                  <div className="flex-1 overflow-auto bg-slate-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-850 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="p-4 w-5/12">Info</th>
                          <th className="p-4 w-3/12">Placeholder</th>
                          <th className="p-4 w-4/12">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 text-xs">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-8 text-center text-slate-500 italic font-mono">
                              Nenhum campo localizado para os filtros ativos.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row: any) => (
                            <tr key={row.id} className="hover:bg-slate-900/40 transition border-b border-slate-900">
                              {/* Info Column */}
                              <td className="p-4 space-y-2">
                                <div className="text-[11px] font-black text-slate-200">{row.informationLabel}</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded text-slate-300 font-bold max-w-full truncate">
                                    {row.sourceStage}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400 font-medium">
                                    {row.sourceField}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                  {row.naturalLanguageMessage}
                                </p>
                              </td>

                              {/* Placeholder Column */}
                              <td className="p-4 font-mono text-indigo-400 font-black">
                                {row.placeholder}
                              </td>

                              {/* Status Column */}
                              <td className="p-4 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${row.replacementStatus === "success" ? "bg-emerald-500" : "bg-rose-500"}`} />
                                  <span className={`text-[10px] font-black uppercase font-mono ${row.replacementStatus === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                                    {row.replacementStatus === "success" ? "Sucesso" : `FALHA: ${row.failureReason}`}
                                  </span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-850/50">
                                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Valor Resolvido:</span>
                                  {row.migratedValueMasked ? (
                                    <span className="break-all whitespace-pre-wrap">{row.migratedValueMasked}</span>
                                  ) : (
                                    <span className="text-slate-600 font-bold italic">[Vazio / Sem Valor]</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </FluxoStepLayout>
  );
}
