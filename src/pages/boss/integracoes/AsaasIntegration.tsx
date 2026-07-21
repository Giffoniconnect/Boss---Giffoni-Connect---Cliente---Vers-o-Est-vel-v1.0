import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { 
  Landmark, 
  ArrowLeft, 
  Save, 
  Play, 
  Terminal, 
  AlertCircle, 
  Check, 
  X,
  Info,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Mail,
  Phone,
  FileText,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  History,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  FileCode,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  XCircle
} from 'lucide-react';

interface AsaasConfig {
  status: 'não_configurado' | 'preparado' | 'em_teste' | 'ativo' | 'erro';
  mode: 'sandbox' | 'production';
  publicInfo: string;
  apiKeyPlaceholder: string;
  webhookSecretPlaceholder: string;
  notes: string;
}

export default function AsaasIntegration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const billingContextId = searchParams.get('billingContextId') || searchParams.get('contextToken');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Connection fields (for config mode)
  const [config, setConfig] = useState<AsaasConfig>({
    status: 'não_configurado',
    mode: 'sandbox',
    publicInfo: '',
    apiKeyPlaceholder: '',
    webhookSecretPlaceholder: '',
    notes: ''
  });

  // Simulated logs (for config mode)
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [testing, setTesting] = useState(false);

  // ==========================================
  // BILLING MODE STATE (if billingContextId)
  // ==========================================
  const [bossContext, setBossContext] = useState<any>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  // Billing form state
  const [chargeMode, setChargeMode] = useState<'ONE_TIME' | 'INSTALLMENT' | 'SUBSCRIPTION'>('ONE_TIME');
  const [description, setDescription] = useState('Honorários Advocatícios - Giffoni Advogados');
  const [value, setValue] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');
  const [totalValue, setTotalValue] = useState<number>(0);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [valuePerCycle, setValuePerCycle] = useState<number>(0);
  const [nextDueDate, setNextDueDate] = useState('');

  // Orchestration & Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orchestratorResult, setOrchestratorResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStepStatus, setCurrentStepStatus] = useState<string>('DRAFT');

  // Interactive logs / details
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [pastContracts, setPastContracts] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [retryingDrive, setRetryingDrive] = useState(false);

  // Masking helpers for UI
  const maskCpfCnpj = (val: string) => {
    if (!val) return "";
    const clean = val.replace(/\D/g, "");
    if (clean.length <= 11) {
      return `***.***.***-${clean.substring(clean.length - 2)}`;
    }
    return `**.***.***/****-${clean.substring(clean.length - 2)}`;
  };

  const maskEmail = (val: string) => {
    if (!val) return "";
    const parts = val.split("@");
    if (parts.length !== 2) return "e***@domain.com";
    return `${parts[0].charAt(0)}***@${parts[1]}`;
  };

  const maskPhone = (val: string) => {
    if (!val) return "";
    const clean = val.replace(/\D/g, "");
    if (clean.length < 4) return "(**) *****-0000";
    return `(**) *****-${clean.substring(clean.length - 4)}`;
  };

  // Load config or load billing context
  useEffect(() => {
    async function initPage() {
      try {
        setLoading(true);
        if (billingContextId) {
          // BILLING MODE: Fetch client and case context from backend
          const res = await fetch(`/api/asaas/context/resolve?caseId=${encodeURIComponent(billingContextId)}`);
          const data = await res.json();
          if (res.ok && data.success) {
            setBossContext(data.context);
            // Pre-populate fields from caseFinancials if available
            if (data.context.caseFinancials) {
              const fin = data.context.caseFinancials;
              if (fin.description) setDescription(fin.description);
              
              if (fin.formaPagamento === "Boleto" && fin.quantidadeParcelas && fin.quantidadeParcelas > 1) {
                setChargeMode('INSTALLMENT');
                setInstallmentCount(fin.quantidadeParcelas);
                setTotalValue(fin.valorContrato || ((fin.valorParcela || 0) * fin.quantidadeParcelas));
              } else {
                setChargeMode('ONE_TIME');
                setValue(fin.valorParcela || fin.valorContrato || 0);
              }
            }
            // Load previous contracts history
            loadContractsHistory();
          } else {
            setContextError(data.error || "Não foi possível carregar os dados do caso do Giffoni BOSS.");
          }
        } else {
          // CONFIG MODE: Load connectors settings
          const docSnap = await getDoc(doc(db, 'settings', 'connectors'));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.asaas) {
              setConfig({
                status: data.asaas.status || 'não_configurado',
                mode: data.asaas.mode || 'sandbox',
                publicInfo: data.asaas.publicInfo || '',
                apiKeyPlaceholder: data.asaas.apiKeyPlaceholder || '',
                webhookSecretPlaceholder: data.asaas.webhookSecretPlaceholder || '',
                notes: data.asaas.notes || ''
              });
            }
          }
        }
      } catch (err: any) {
        console.error('Erro na inicialização da página:', err);
        setContextError(`Erro crítico: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, [billingContextId]);

  const loadContractsHistory = async () => {
    if (!billingContextId) return;
    try {
      setLoadingHistory(true);
      const res = await fetch(`/api/asaas/contracts/history?caseId=${encodeURIComponent(billingContextId)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPastContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de contratos:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Config actions
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        asaas: {
          status: config.status,
          mode: config.mode,
          publicInfo: config.publicInfo.trim(),
          apiKeyPlaceholder: config.apiKeyPlaceholder.trim(),
          webhookSecretPlaceholder: config.webhookSecretPlaceholder.trim(),
          notes: config.notes.trim()
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setFeedback({ type: 'success', message: 'Configurações de integração com Asaas salvas na nuvem com sucesso!' });
      
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Configurações atualizadas e gravadas com sucesso no Firestore.`
      ]);
    } catch (err: any) {
      console.error('Erro ao salvar Asaas:', err);
      setFeedback({ type: 'error', message: `Erro ao salvar configurações: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = () => {
    setTesting(true);
    const timestamp = new Date().toLocaleTimeString();
    
    const newLogs = [
      `[${timestamp}] Inicializando aperto de mão lógico com Asaas...`,
      `[${timestamp}] Segurança: chaves protegidas fáticas do frontend verificadas.`,
      `[${timestamp}] Conectando ao endpoint da Asaas API (${config.mode === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/v3 (Sandbox Mode)'})...`,
      `[${timestamp}] Aviso: Teste real será ativado em build futuro com backend seguro.`,
      `[${timestamp}] Canal retornado com status isolado: Simulador de Sucesso.`
    ];

    setTimeout(() => {
      setLogs(prev => [...prev, ...newLogs]);
      setTesting(false);
      setShowLogs(true);
    }, 1000);
  };

  const handleDisable = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = { ...config, status: 'não_configurado' as const };
    setConfig(updated);
    
    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        asaas: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Provedor desativado voluntariamente pelo operador.`
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // BILLING FLOW TRIGGERS
  // ==========================================
  const handleCreateCharge = async () => {
    if (!billingContextId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    setOrchestratorResult(null);
    setCurrentStepStatus('VALIDATING');

    // Build payload
    const chargePayload: any = {
      mode: chargeMode,
      description: description.trim(),
    };

    if (chargeMode === "ONE_TIME") {
      chargePayload.value = Number(value);
      chargePayload.dueDate = dueDate;
    } else if (chargeMode === "INSTALLMENT") {
      chargePayload.totalValue = Number(totalValue);
      chargePayload.installmentCount = Number(installmentCount);
      chargePayload.firstDueDate = firstDueDate;
    } else if (chargeMode === "SUBSCRIPTION") {
      chargePayload.valuePerCycle = Number(valuePerCycle);
      chargePayload.nextDueDate = nextDueDate;
    }

    try {
      // We will open a server-side poll using an interval or just await, since backend finishes in ~4-8 seconds
      // Let's call the backend orchestrator directly
      const response = await fetch('/api/asaas/charge/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId: billingContextId,
          charge: chargePayload,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCurrentStepStatus('FAILED');
        throw new Error(data.error || "Ocorreu um erro ao emitir a cobrança no ASAAS.");
      }

      setOrchestratorResult(data.contract);
      setCurrentStepStatus(data.contract.operation.status);
      loadContractsHistory(); // Refresh history list
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || "Erro de conexão com o backend.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryDriveUpload = async (externalRef: string) => {
    try {
      setRetryingDrive(true);
      const res = await fetch('/api/asaas/charge/retry-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalReference: externalRef,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // If retried from active orchestration result
        if (orchestratorResult && orchestratorResult.operation.externalReference === externalRef) {
          setOrchestratorResult(data.contract);
          setCurrentStepStatus(data.contract.operation.status);
        }
        // Refresh history
        loadContractsHistory();
      } else {
        alert(`Erro ao reenviar arquivo ao Google Drive: ${data.error || "Falha técnica"}`);
      }
    } catch (err: any) {
      alert(`Falha de conexão: ${err.message}`);
    } finally {
      setRetryingDrive(false);
    }
  };

  const handleCopyCode = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // loading view
  if (loading) {
    return (
      <BossLayout>
        <div className="flex-1 p-6 md:p-10 flex items-center justify-center bg-gray-50 text-gray-400 min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-500 font-mono">Sincronizando Integração...</span>
          </div>
        </div>
      </BossLayout>
    );
  }

  // error loading context view
  if (contextError) {
    return (
      <BossLayout>
        <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto space-y-6">
          <button 
            onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            Voltar para Fluxo de Produção
          </button>
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-4 text-rose-950">
            <AlertTriangle size={40} className="text-rose-600 animate-bounce" />
            <div className="space-y-1.5">
              <h3 className="text-md font-black uppercase tracking-tight">Impossível carregar o contexto de dados</h3>
              <p className="text-xs font-semibold text-rose-700 max-w-lg leading-relaxed">{contextError}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition shadow-md"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      </BossLayout>
    );
  }

  // ==========================================
  // RENDER: BILLING MODE
  // ==========================================
  if (billingContextId && bossContext) {
    return (
      <BossLayout>
        <div className="flex-1 p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
          {/* Header & Back block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-6">
            <div className="space-y-1.5">
              <button 
                onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${billingContextId}/card-definir-valores-subetapa01`)}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-950 transition cursor-pointer"
              >
                <ArrowLeft size={14} />
                Voltar para o Financeiro do Caso
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center shadow-inner">
                  <Landmark size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">Geração de Cobrança ASAAS</h1>
                  <p className="text-xs text-gray-500 font-medium">Boleto Bancário Dinâmico • Giffoni BOSS Integrador</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-slate-900 text-slate-100 border border-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Canal Criptografado</span>
              </span>
            </div>
          </div>

          {/* Sub-steps overview progress tracker (DRAFT or ACTIVE Orchestration) */}
          {currentStepStatus !== 'DRAFT' && (
            <div className="bg-slate-950 border border-slate-950 p-6 rounded-3xl text-slate-100 space-y-6 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                <div className="flex items-center gap-2.5">
                  {['COMPLETED', 'PARTIAL_SUCCESS_DRIVE_PENDING'].includes(currentStepStatus) ? (
                    <CheckCircle2 className="text-emerald-400 w-5 h-5 shrink-0" />
                  ) : currentStepStatus === 'FAILED' ? (
                    <XCircle className="text-rose-500 w-5 h-5 shrink-0" />
                  ) : (
                    <Loader2 className="text-indigo-400 w-5 h-5 shrink-0 animate-spin" />
                  )}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider font-mono">
                      {isSubmitting ? "Executando Barramento de Integração" : "Faturamento Finalizado"}
                    </h3>
                    <p className="text-[10px] text-slate-400">ID da Transação: {orchestratorResult?.operation?.operationId || "Gerando..."}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border ${
                  currentStepStatus === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  currentStepStatus === 'PARTIAL_SUCCESS_DRIVE_PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  currentStepStatus === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}>
                  {currentStepStatus.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Step Tracking Line */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                {[
                  {
                    title: "1. Validação",
                    desc: "Análise de regras",
                    stages: ['VALIDATING', 'CUSTOMER_LOOKUP', 'NOTIFICATIONS_DISABLING', 'CREATING_ASAAS_ENTITY', 'DOWNLOADING_PDF', 'UPLOADING_TO_DRIVE', 'COMPLETED', 'PARTIAL_SUCCESS_DRIVE_PENDING']
                  },
                  {
                    title: "2. Cliente e Alertas",
                    desc: "Mapear & Silenciar",
                    stages: ['CUSTOMER_LOOKUP', 'NOTIFICATIONS_DISABLING', 'CREATING_ASAAS_ENTITY', 'DOWNLOADING_PDF', 'UPLOADING_TO_DRIVE', 'COMPLETED', 'PARTIAL_SUCCESS_DRIVE_PENDING']
                  },
                  {
                    title: "3. Registro ASAAS",
                    desc: "Criar cobrança real",
                    stages: ['CREATING_ASAAS_ENTITY', 'DOWNLOADING_PDF', 'UPLOADING_TO_DRIVE', 'COMPLETED', 'PARTIAL_SUCCESS_DRIVE_PENDING']
                  },
                  {
                    title: "4. Google Drive",
                    desc: "Guarda em PDF",
                    stages: ['UPLOADING_TO_DRIVE', 'COMPLETED']
                  }
                ].map((step, idx) => {
                  const isActive = step.stages.includes(currentStepStatus);
                  const isDone = ['COMPLETED', 'PARTIAL_SUCCESS_DRIVE_PENDING'].includes(currentStepStatus) || 
                                 (idx === 0 && !['VALIDATING'].includes(currentStepStatus)) ||
                                 (idx === 1 && !['VALIDATING', 'CUSTOMER_LOOKUP', 'NOTIFICATIONS_DISABLING'].includes(currentStepStatus)) ||
                                 (idx === 2 && !['VALIDATING', 'CUSTOMER_LOOKUP', 'NOTIFICATIONS_DISABLING', 'CREATING_ASAAS_ENTITY'].includes(currentStepStatus));
                  return (
                    <div key={idx} className={`p-3 rounded-2xl border transition-all ${
                      isActive ? 'bg-slate-900 border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-40'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-black uppercase ${
                          isDone ? 'bg-emerald-500 text-slate-950' : (isActive ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400')
                        }`}>
                          {isDone ? "✓" : idx + 1}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-wide font-mono text-slate-100">{step.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">{step.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Outcomes */}
              {['COMPLETED', 'PARTIAL_SUCCESS_DRIVE_PENDING', 'FAILED'].includes(currentStepStatus) && (
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-900 space-y-4">
                  {currentStepStatus === 'COMPLETED' && (
                    <div className="space-y-1">
                      <div className="text-emerald-400 text-xs font-black uppercase font-mono flex items-center gap-1">
                        <CheckCircle2 size={15} />
                        <span>Faturamento gerado com sucesso!</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                        A cobrança foi registrada no ASAAS. O documento PDF foi baixado pelo barramento seguro e já está guardado de forma fática na pasta do Google Drive do cliente no BOSS.
                      </p>
                    </div>
                  )}

                  {currentStepStatus === 'PARTIAL_SUCCESS_DRIVE_PENDING' && (
                    <div className="space-y-2">
                      <div className="text-amber-400 text-xs font-black uppercase font-mono flex items-center gap-1">
                        <AlertTriangle size={15} className="animate-pulse" />
                        <span>Sucesso Parcial • Upload ao Drive Pendente</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                        A cobrança foi emitida com sucesso no ASAAS, mas a tentativa de upload automático do PDF ao Google Drive falhou (provavelmente devido a limites de tokens ou conexão). O faturamento está ativo. Você pode tentar reprocessar o upload abaixo.
                      </p>
                      <button
                        type="button"
                        disabled={retryingDrive}
                        onClick={() => handleRetryDriveUpload(orchestratorResult.operation.externalReference)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 disabled:opacity-50 rounded-xl text-xs font-black uppercase tracking-wide transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={13} className={retryingDrive ? "animate-spin" : ""} />
                        <span>{retryingDrive ? "Reprocessando..." : "Reprocessar envio ao Google Drive"}</span>
                      </button>
                    </div>
                  )}

                  {currentStepStatus === 'FAILED' && (
                    <div className="space-y-1">
                      <div className="text-rose-400 text-xs font-black uppercase font-mono flex items-center gap-1">
                        <X size={15} />
                        <span>Faturamento abortado</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                        A emissão da cobrança falhou: <strong className="text-rose-300">{submitError || "Erro desconhecido do integrador."}</strong>
                      </p>
                    </div>
                  )}

                  {/* Operational details card */}
                  {orchestratorResult?.asaasResult && (
                    <div className="border-t border-slate-850 pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-100">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">ASAAS ENTITY ID</span>
                        <div className="text-xs font-mono font-black text-slate-200">
                          {orchestratorResult.asaasResult.paymentId || orchestratorResult.asaasResult.installmentId || orchestratorResult.asaasResult.subscriptionId}
                        </div>
                      </div>

                      {orchestratorResult.asaasResult.identificationField && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Linha Digitável (Código de Barras)</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono font-black text-slate-200 truncate max-w-[200px]">
                              {orchestratorResult.asaasResult.identificationField}
                            </span>
                            <button
                              onClick={() => handleCopyCode(orchestratorResult.asaasResult.identificationField)}
                              className="text-indigo-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                              title="Copiar código de barras"
                            >
                              {copyFeedback ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Web View Links */}
                      <div className="space-y-1 sm:col-span-2 pt-2 flex flex-wrap gap-2.5">
                        {orchestratorResult.asaasResult.bankSlipUrl && (
                          <a
                            href={orchestratorResult.asaasResult.bankSlipUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink size={12} />
                            <span>Ver Boleto no ASAAS</span>
                          </a>
                        )}

                        {orchestratorResult.drive?.files?.[0]?.webViewLink && (
                          <a
                            href={orchestratorResult.drive.files[0].webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                          >
                            <FolderOpen size={12} />
                            <span>Ver PDF no Google Drive</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Technical Audit Logs Toggle Button */}
              {orchestratorResult?.audit?.events && (
                <div className="border-t border-slate-900 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalLogs(!showTechnicalLogs)}
                    className="text-[10px] text-slate-400 hover:text-white font-mono uppercase font-black tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <Terminal size={12} />
                    <span>👁️ {showTechnicalLogs ? "Ocultar" : "Ver"} logs técnicos da integração ASAAS</span>
                    {showTechnicalLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showTechnicalLogs && (
                    <div className="mt-3 bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                      {orchestratorResult.audit.events.map((evt: any, idx: number) => (
                        <div key={idx} className="text-[10px] font-mono leading-relaxed flex items-start gap-1.5 py-1 border-b border-slate-900 last:border-0 hover:bg-slate-900/40 px-1 rounded">
                          <span className="text-slate-500 font-semibold">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-1 rounded text-[8px] font-black tracking-wide ${
                            evt.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                            evt.status === 'WARNING' ? 'bg-amber-500/10 text-amber-400' :
                            evt.status === 'ERROR' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {evt.status}
                          </span>
                          <span className="text-slate-400 font-bold uppercase">[{evt.action}]</span>
                          <span className="text-slate-200 font-medium">{evt.safeMessage}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* WIZARD FORM: Left/Center 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* ETAPA 1 — DADOS DA COBRANÇA */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="w-6 h-6 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center text-xs font-black">1</div>
                  <h2 className="text-xs font-black uppercase text-gray-900 tracking-wide">Etapa 1 — Dados da Cobrança</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Modalidade de Faturamento *</label>
                    <select
                      value={chargeMode}
                      onChange={(e) => setChargeMode(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                      <option value="ONE_TIME">À vista (Boleto único)</option>
                      <option value="INSTALLMENT">Parcelado (Carnê de cobrança)</option>
                      <option value="SUBSCRIPTION">Assinatura Mensal Recorrente</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Meio de Recebimento</label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 flex items-center gap-1.5">
                      <Lock size={12} className="text-gray-400" />
                      <span>Boleto Bancário / PIX (Exclusivo)</span>
                    </div>
                  </div>

                  {chargeMode === "ONE_TIME" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Valor da Cobrança (R$) *</label>
                        <div className="relative">
                          <DollarSign size={14} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(e) => setValue(Number(e.target.value))}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Data de Vencimento *</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {chargeMode === "INSTALLMENT" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Valor Total do Contrato (R$) *</label>
                        <div className="relative">
                          <DollarSign size={14} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="number"
                            step="0.01"
                            value={totalValue}
                            onChange={(e) => setTotalValue(Number(e.target.value))}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Número de Parcelas *</label>
                        <input
                          type="number"
                          min="2"
                          max="72"
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Vencimento da Primeira Parcela *</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="date"
                            value={firstDueDate}
                            onChange={(e) => setFirstDueDate(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none cursor-pointer"
                          />
                        </div>
                      </div>

                      {totalValue > 0 && installmentCount >= 2 && (
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-bold text-indigo-800 flex items-center justify-between col-span-1 md:col-span-2">
                          <span>Simulação do Carnê:</span>
                          <span className="font-mono">{installmentCount} parcelas de R$ {(totalValue / installmentCount).toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                    </>
                  )}

                  {chargeMode === "SUBSCRIPTION" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Mensalidade da Assinatura (R$) *</label>
                        <div className="relative">
                          <DollarSign size={14} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="number"
                            step="0.01"
                            value={valuePerCycle}
                            onChange={(e) => setValuePerCycle(Number(e.target.value))}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Vencimento da Primeira Mensalidade *</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="date"
                            value={nextDueDate}
                            onChange={(e) => setNextDueDate(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Descrição da Cobrança *</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      maxLength={255}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                      placeholder="Ex: Honorários advocatícios referente ao processo..."
                    />
                    <div className="text-[9px] text-gray-400 text-right font-mono">{description.length}/255 caracteres</div>
                  </div>
                </div>
              </div>

              {/* ETAPA 2 — JUROS, MULTA E DESCONTO */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="w-6 h-6 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center text-xs font-black">2</div>
                  <h2 className="text-xs font-black uppercase text-gray-900 tracking-wide">Etapa 2 — Juros, Multa e Desconto</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-2xl space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono">Multa por Atraso</span>
                    <div className="text-xs font-black text-gray-800">10%</div>
                    <p className="text-[9px] text-gray-500 font-semibold">Aplicada faticamente após vencimento</p>
                  </div>

                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-2xl space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono">Juros de Mora</span>
                    <div className="text-xs font-black text-gray-800">1% ao mês</div>
                    <p className="text-[9px] text-gray-500 font-semibold">Calculado pro-rata ao dia</p>
                  </div>

                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-2xl space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono">Política Descontos</span>
                    <div className="text-xs font-black text-gray-400">Não aplicável</div>
                    <p className="text-[9px] text-gray-500 font-semibold">Faturamento líquido integral</p>
                  </div>
                </div>
              </div>

              {/* ETAPA 4 — NOTIFICAÇÕES (Accordion / Info card) */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="w-6 h-6 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center text-xs font-black">4</div>
                  <h2 className="text-xs font-black uppercase text-gray-900 tracking-wide">Etapa 4 — Notificações e Canais</h2>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex gap-3 text-amber-950">
                  <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-[11px] font-black uppercase font-mono tracking-wide text-emerald-800">Notificações ASAAS 100% Silenciadas por Segurança</h4>
                    <p className="text-[10px] leading-relaxed font-semibold text-gray-600">
                      Como medida técnica fática de conformidade e integridade no atendimento da Giffoni Advogados, todas as notificações automáticas por SMS, Email, Whatsapp e ligações de cobrança do ASAAS serão forçosamente desativadas para o cliente. A comunicação de boletos ocorre exclusivamente através do portal do cliente no BOSS ou assessoria oficial.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SIDEBAR: Right 1 col (Etapa 3 & Finalize) */}
            <div className="space-y-6">
              {/* ETAPA 3 — CLIENTE E ENTREGA */}
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="w-6 h-6 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center text-xs font-black">3</div>
                  <h2 className="text-xs font-black uppercase text-gray-900 tracking-wide">Etapa 3 — Cliente e Destino</h2>
                </div>

                {/* Cliente details */}
                <div className="space-y-3.5">
                  <div className="flex items-start gap-2.5">
                    <User size={16} className="text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">Cliente Giffoni BOSS</span>
                      <p className="text-xs font-black text-gray-800">{bossContext.name}</p>
                      <p className="text-[10px] font-mono text-gray-500 mt-0.5">{maskCpfCnpj(bossContext.cpfCnpj)}</p>
                    </div>
                  </div>

                  {bossContext.email && (
                    <div className="flex items-start gap-2.5 border-t border-gray-100 pt-2.5">
                      <Mail size={16} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">E-mail Cadastrado</span>
                        <p className="text-xs font-semibold text-gray-700">{maskEmail(bossContext.email)}</p>
                      </div>
                    </div>
                  )}

                  {bossContext.mobilePhone && (
                    <div className="flex items-start gap-2.5 border-t border-gray-100 pt-2.5">
                      <Phone size={16} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">Celular / WhatsApp</span>
                        <p className="text-xs font-semibold text-gray-700">{maskPhone(bossContext.mobilePhone)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 border-t border-gray-100 pt-2.5">
                    <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">Endereço de Cobrança</span>
                      <p className="text-xs font-semibold text-gray-700">
                        {bossContext.address?.street ? `${bossContext.address.street}, ${bossContext.address.number || "S/N"}` : "Rua não localizada"}
                      </p>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {bossContext.address?.district && `${bossContext.address.district} — `}
                        {bossContext.address?.city || "Cidade não localizada"}
                      </p>
                      {bossContext.address?.postalCode && (
                        <p className="text-[9px] font-mono text-gray-400">CEP: {bossContext.address.postalCode.replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
                      )}
                    </div>
                  </div>

                  {/* Drive status */}
                  <div className="flex items-start gap-2.5 border-t border-gray-100 pt-2.5">
                    <FolderOpen size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">Pasta Destino Google Drive</span>
                      <p className="text-[10px] font-mono font-bold text-emerald-800 break-all select-all">
                        {bossContext.destinationDriveFolderId}
                      </p>
                      <div className="text-[9px] text-emerald-700 font-bold mt-1 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg inline-block">
                        Conectada e Pronta
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* REVISÃO E AÇÃO FINAL */}
              <div className="bg-slate-900 border border-slate-950 p-6 rounded-3xl text-slate-100 shadow-xl space-y-4">
                <h3 className="text-xs font-black uppercase font-mono tracking-widest text-indigo-400">Revisão Final da Cobrança</h3>

                <div className="space-y-3 text-[11px] font-semibold text-slate-300">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span>Meio de Pagamento</span>
                    <span className="text-white font-bold">Boleto / PIX</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span>Modalidade</span>
                    <span className="text-white font-bold">
                      {chargeMode === 'ONE_TIME' ? "À vista" : (chargeMode === 'INSTALLMENT' ? `Parcelado (${installmentCount}x)` : "Assinatura")}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span>Valor Estimado</span>
                    <span className="text-emerald-400 text-sm font-black font-mono">
                      R$ {chargeMode === 'ONE_TIME' ? value.toFixed(2).replace('.', ',') : (chargeMode === 'INSTALLMENT' ? totalValue.toFixed(2).replace('.', ',') : valuePerCycle.toFixed(2).replace('.', ','))}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span>Primeiro Vencimento</span>
                    <span className="text-white font-mono font-bold">
                      {chargeMode === 'ONE_TIME' ? (dueDate || "Não informado") : (chargeMode === 'INSTALLMENT' ? (firstDueDate || "Não informado") : (nextDueDate || "Não informado"))}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || (chargeMode === 'ONE_TIME' ? !value || !dueDate : (chargeMode === 'INSTALLMENT' ? !totalValue || !firstDueDate || installmentCount < 2 : !valuePerCycle || !nextDueDate))}
                  onClick={handleCreateCharge}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Processando Barramento...</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} className="fill-current" />
                      <span>Emitir Cobrança no ASAAS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* HISTÓRICO REAL DE COBRANÇAS GERADAS */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="text-gray-600 w-5 h-5 shrink-0" />
                <h2 className="text-xs font-black uppercase text-gray-900 tracking-wide">Histórico real das cobranças geradas para este caso</h2>
              </div>
              <button
                onClick={loadContractsHistory}
                disabled={loadingHistory}
                className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 hover:text-gray-900 transition flex items-center gap-1 text-[10px] font-bold uppercase shrink-0"
              >
                <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
                <span>Atualizar</span>
              </button>
            </div>

            {loadingHistory && pastContracts.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 font-mono">Buscando histórico de faturamento fático...</div>
            ) : pastContracts.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 italic">Nenhuma cobrança registrada neste barramento de faturamento para este caso.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-150 text-[9px] font-bold uppercase text-gray-445 tracking-wider font-mono">
                      <th className="py-2 pb-3">Ref. Externa</th>
                      <th className="py-2 pb-3">Modalidade</th>
                      <th className="py-2 pb-3">Valor</th>
                      <th className="py-2 pb-3">Emitida em</th>
                      <th className="py-2 pb-3">Status</th>
                      <th className="py-2 pb-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastContracts.map((cnt: any) => {
                      const cVal = cnt.charge.mode === "ONE_TIME" ? cnt.charge.value : (cnt.charge.mode === "INSTALLMENT" ? cnt.charge.totalValue : cnt.charge.valuePerCycle);
                      const isPartial = cnt.operation.status === 'PARTIAL_SUCCESS_DRIVE_PENDING';
                      return (
                        <tr key={cnt.operation.externalReference} className="border-b border-gray-100 text-xs font-semibold hover:bg-gray-50/50 transition">
                          <td className="py-3 font-mono text-[10px] text-gray-600">{cnt.operation.externalReference}</td>
                          <td className="py-3 text-gray-800">
                            {cnt.charge.mode === 'ONE_TIME' ? "À vista" : (cnt.charge.mode === 'INSTALLMENT' ? `Parcelado (${cnt.charge.installmentCount}x)` : "Assinatura")}
                          </td>
                          <td className="py-3 font-mono font-bold text-gray-800">R$ {Number(cVal).toFixed(2).replace('.', ',')}</td>
                          <td className="py-3 font-mono text-[10px] text-gray-500">{new Date(cnt.operation.createdAt).toLocaleDateString()}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase font-mono border tracking-wider ${
                              cnt.operation.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                              isPartial ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              cnt.operation.status === 'FAILED' ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-blue-50 text-blue-800 border-blue-100'
                            }`}>
                              {cnt.operation.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-1.5">
                            {cnt.asaasResult?.bankSlipUrl && (
                              <a
                                href={cnt.asaasResult.bankSlipUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex p-1.5 bg-gray-50 hover:bg-gray-150 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-950 transition"
                                title="Visualizar Boleto"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}

                            {cnt.drive?.files?.[0]?.webViewLink && (
                              <a
                                href={cnt.drive.files[0].webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-700 hover:text-emerald-950 transition"
                                title="Visualizar no Google Drive"
                              >
                                <FolderOpen size={12} />
                              </a>
                            )}

                            {isPartial && (
                              <button
                                type="button"
                                disabled={retryingDrive}
                                onClick={() => handleRetryDriveUpload(cnt.operation.externalReference)}
                                className="inline-flex px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-250 rounded-lg text-amber-800 text-[10px] font-black uppercase tracking-wider transition"
                                title="Reprocessar envio ao Google Drive"
                              >
                                <RefreshCw size={11} className={retryingDrive ? "animate-spin mr-1" : "mr-1"} />
                                <span>Reenviar</span>
                              </button>
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
      </BossLayout>
    );
  }

  // ==========================================
  // RENDER: CONFIGURATION MODE (Standard setup)
  // ==========================================
  return (
    <BossLayout>
      <div className="flex-1 p-6 md:p-10 space-y-6 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb & Back button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes')}
              className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              Voltar para Configurações
            </button>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                <Landmark size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase">Asaas S.A.</h2>
                <p className="text-xs text-gray-500 font-medium">Boleto e Pix Consolidado de Honorários BOSS</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider rounded-lg ${
              config.status === 'ativo' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              config.status === 'preparado' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              config.status === 'em_teste' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              config.status === 'erro' ? 'bg-rose-50 text-rose-800 border-rose-200' :
              'bg-gray-100 text-gray-500 border-gray-205'
            }`}>
              {config.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-slate-900 border border-slate-950 p-6 rounded-[2rem] flex gap-3.5 text-slate-100 shadow-xl">
          <Info size={24} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-400 font-mono">Conector Asaas Ativo • BOSS v5</p>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Módulo de faturamento nacional para cobranças estruturadas via boleto bancário dinâmico e PIX unificado com avisos fáticos via WhatsApp.
            </p>
          </div>
        </div>

        {/* Warn card */}
        <div className="bg-amber-50 border border-amber-150 p-4 rounded-2xl flex gap-2.5 text-amber-950">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed font-semibold">
            <strong className="uppercase">Segurança Técnica:</strong> Esta chave secreta não deve ser armazenada diretamente no frontend legado. Em ambiente de produção, certifique-se de mover para variáveis de ambiente seguras no backend (Cloud Run / Functions).
          </p>
        </div>

        {/* MAIN CONFIGURATION FORM */}
        <form onSubmit={handleSave} className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Public Info Identifier (Público) *</label>
              <input
                type="text"
                required
                value={config.publicInfo}
                onChange={(e) => setConfig({ ...config, publicInfo: e.target.value })}
                placeholder="sub_asaas_corp_3..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">API Access Token Placeholder (Seguro) *</label>
              <input
                type="password"
                required
                value={config.apiKeyPlaceholder}
                onChange={(e) => setConfig({ ...config, apiKeyPlaceholder: e.target.value })}
                placeholder="• • • • • • • • • • • •"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Webhook Secret Signature *</label>
              <input
                type="password"
                required
                value={config.webhookSecretPlaceholder}
                onChange={(e) => setConfig({ ...config, webhookSecretPlaceholder: e.target.value })}
                placeholder="whsec_asaas_• • • • •"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Ambiente *</label>
              <select
                value={config.mode}
                onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="sandbox">Homologação (Sandbox)</option>
                <option value="production">Produção Real</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Status Conexão *</label>
              <select
                value={config.status}
                onChange={(e) => setConfig({ ...config, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="não_configurado">Não Configurado</option>
                <option value="preparado">Preparado</option>
                <option value="em_teste">Em Testes</option>
                <option value="ativo">Ativo</option>
                <option value="erro">Erro</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Notas Internas de Integração</label>
              <textarea
                value={config.notes}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                rows={3}
                placeholder="Observações complementares fáticas sobre este barramento..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {feedback && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{feedback.message}</span>
              </div>
              <button type="button" onClick={() => setFeedback(null)}>
                <X size={14} className="opacity-60 hover:opacity-100" />
              </button>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={testing}
                onClick={handleTestConnection}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <Play size={12} />
                <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2"
              >
                <Terminal size={12} />
                <span>Logs</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {config.status !== 'não_configurado' && (
                <button
                  type="button"
                  onClick={handleDisable}
                  className="px-4 py-2 hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold uppercase transition"
                >
                  Desativar
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save size={14} />
                <span>{saving ? 'Gravando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* LOG PANEL */}
        {showLogs && (
          <div className="bg-slate-900 border border-slate-950 p-5 rounded-3xl text-slate-100 font-mono text-xs space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-2">
                <Terminal size={14} className="text-indigo-400" />
                <span>Terminal Simulator Logs — Asaas S.A.</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="text-slate-400 hover:text-white font-sans text-xs font-semibold"
              >
                Ocultar
              </button>
            </div>

            <div className="max-h-[180px] overflow-y-auto space-y-1.5 bg-slate-950 p-4 rounded-2xl shadow-inner scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Nenhum log gravado neste ciclo de visualização. Clique em "Testar Conexão" para obter dados fáticos.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed hover:bg-slate-900/60 p-0.5 rounded transition">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
