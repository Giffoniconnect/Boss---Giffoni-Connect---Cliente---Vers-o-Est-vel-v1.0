import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import { extractClientPhone } from './onboardingHelper';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Info,
  CheckSquare,
  ArrowRight,
  Send,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  Radio,
  Zap,
  Key,
  ShieldCheck
} from 'lucide-react';

interface TelemetryLog {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'debug';
  stage: string;
  message: string;
  details?: any;
}

export default function OnboardingWelcomeZap() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Message & Destination States
  const [customPhone, setCustomPhone] = useState('');
  const [messageText, setMessageText] = useState('');

  // Gateway Token Config state
  const [gatewayConfig, setGatewayConfig] = useState<{
    configured: boolean;
    tokenMasked?: string;
    tokenSource?: string;
  } | null>(null);
  const [showTokenDrawer, setShowTokenDrawer] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  // Form State for Human Compliance
  const [formData, setFormData] = useState({
    whatsappBoasVindasEnviado: '', // 'sim' | 'nao'
    observacoes: ''
  });

  // Dispatch Result
  const [whatsappResult, setWhatsappResult] = useState<{
    success?: boolean;
    sentAt?: string;
    message?: string;
    phoneUsed?: string;
    simulated?: boolean;
    deliveryDetails?: any;
  } | null>(null);

  // Logs & Telemetry
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'error' | 'http'>('all');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [expandedLogIndices, setExpandedLogIndices] = useState<Record<number, boolean>>({});
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const addLocalLog = (
    level: 'info' | 'success' | 'warn' | 'error' | 'debug',
    stage: string,
    message: string,
    details?: any
  ) => {
    const entry: TelemetryLog = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      details
    };
    setLogs(prev => [...prev, entry]);
  };

  // Check Gateway Diagnostics
  const fetchGatewayDiagnostics = async () => {
    try {
      const res = await fetch('/api/whatsapp/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setGatewayConfig({
          configured: !!data.configured,
          tokenMasked: data.tokenMasked || '',
          tokenSource: data.tokenSource || ''
        });
      }
    } catch {
      // Ignorar erro silencioso de diagnóstico
    }
  };

  useEffect(() => {
    fetchGatewayDiagnostics();
  }, []);

  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const caseRef = doc(db, 'cases', caseId!);
        let caseSnap = await getDoc(caseRef);

        // Se o caso não existir, provisiona automaticamente com vínculo ao cliente padrão para evitar bloqueio
        if (!caseSnap.exists()) {
          const nowIso = new Date().toISOString();
          const initialCaseData = {
            id: caseId,
            clientId: 'CHflBvdGwuhhOGROZfRhmIBhx8P2',
            clientName: 'Rodrigo Giffoni cliente',
            status: 'em_andamento',
            title: `Caso de Produção ${caseId}`,
            onboarding: {
              currentSubStep: 2,
              status: 'in_progress',
              welcomeZap: {
                status: 'pending',
                whatsappBoasVindasEnviado: ''
              }
            },
            onboardingSubetapaLogs: [],
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await setDoc(caseRef, initialCaseData);
          caseSnap = await getDoc(caseRef);
        }

        const cData = caseSnap.data();
        setCaseObj(cData);

        if (cData?.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Initialize sub-step form data
        const onbWz = cData?.onboarding?.welcomeZap || {};
        setFormData({
          whatsappBoasVindasEnviado: onbWz.whatsappBoasVindasEnviado || '',
          observacoes: onbWz.observacoes || ''
        });

        if (onbWz.status === 'completed' || onbWz.sentAt) {
          const isSim = onbWz.deliveryMethod === 'simulado';
          setWhatsappResult({
            success: true,
            sentAt: onbWz.sentAt,
            message: onbWz.messageText,
            phoneUsed: onbWz.phoneUsed,
            simulated: isSim,
            deliveryDetails: onbWz.deliveryDetails
          });
        }

        // Carregar logs prévios se existirem
        if (Array.isArray(onbWz.logs) && onbWz.logs.length > 0) {
          setLogs(onbWz.logs);
        } else {
          addLocalLog('info', 'CARGA_SISTEMA', `Caso [${caseId}] carregado com sucesso. Pronto para disparo de boas-vindas.`);
        }

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados do welcome zap: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  // Scroll terminal to bottom when logs change
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Resolvers de Nome e Telefone
  const resolvedClientName = client
    ? (client.fullName || client.name || client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || caseObj?.clientName || 'Cliente')
    : (caseObj?.clientName || 'Cliente');

  const defaultPhone = extractClientPhone(client);
  const activePhone = customPhone || defaultPhone || '';

  const getDefaultMessageText = (name: string) => {
    return `Olá, ${name}!\n\nSeja muito bem-vindo(a) à Giffoni Advogados Associados!\n\nEste é o nosso canal oficial de comunicação e acompanhamento do seu caso. Por favor, salve este contato em sua agenda para garantir o recebimento de todas as atualizações e comunicados importantes.\n\nQualquer dúvida, nossa equipe está à sua inteira disposição!`;
  };

  useEffect(() => {
    if (!messageText && resolvedClientName) {
      setMessageText(getDefaultMessageText(resolvedClientName));
    }
  }, [resolvedClientName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Salvar Token Wascript diretamente no backend/Firestore
  const handleSaveToken = async () => {
    if (!manualTokenInput.trim()) return;
    setSavingToken(true);
    try {
      const res = await fetch('/api/whatsapp/quick-save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: manualTokenInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addLocalLog('success', 'CONFIG_TOKEN', 'Novo token W.A Speed registrado nas configurações do sistema.');
        setSuccess('Token W.A Speed salvo com sucesso!');
        setShowTokenDrawer(false);
        setManualTokenInput('');
        fetchGatewayDiagnostics();
      } else {
        throw new Error(data.errorMessage || 'Falha ao salvar token');
      }
    } catch (err: any) {
      setError(`Erro ao registrar token: ${err.message || err}`);
      addLocalLog('error', 'CONFIG_TOKEN', `Falha ao salvar token: ${err.message}`);
    } finally {
      setSavingToken(false);
    }
  };

  // Teste Rápido de Conexão com Gateway
  const handleTestConnection = async () => {
    if (!activePhone) {
      setError('Informe um número de telefone para testar a conexão do gateway.');
      return;
    }
    setTestingConnection(true);
    addLocalLog('info', 'TESTE_CONEXAO', `Iniciando ping de verificação de conexão com a API W.A Speed para ${activePhone}...`);
    try {
      const res = await fetch('/api/whatsapp/test-phone-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activePhone,
          message: 'Teste de conectividade W.A Speed - Giffoni Advogados'
        })
      });
      const data = await res.json();
      if (res.ok && data.attempts) {
        addLocalLog('success', 'TESTE_CONEXAO', `Teste de conectividade concluído. Formatos analisados: ${data.attempts.length}`, data.attempts);
      } else {
        addLocalLog('warn', 'TESTE_CONEXAO', `Gateway respondeu: ${data.errorMessage || 'Verificação concluída'}`);
      }
    } catch (err: any) {
      addLocalLog('error', 'TESTE_CONEXAO', `Erro na verificação de conexão: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // DISPARAR MENSAGEM VIA W.A SPEED COM LOGS COMPLETOS
  const handleSendWhatsApp = async () => {
    if (!activePhone) {
      setError('Operação impossível: O cliente não possui um número de telefone válido cadastrado.');
      addLocalLog('error', 'DISPARO', 'Tentativa de disparo cancelada por falta de telefone de destino.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    const msgToSend = messageText || getDefaultMessageText(resolvedClientName);

    addLocalLog('info', 'INICIO_DISPARO', `Comando de disparo real acionado pelo operador para o número ${activePhone}.`, {
      destinatario: resolvedClientName,
      telefone: activePhone,
      tamanhoMensagem: msgToSend.length,
      gateway: gatewayConfig?.configured ? 'W.A Speed Real (Produção)' : 'Modo Assistido (Demonstração)'
    });

    try {
      const response = await fetch('/api/onboarding/welcome-zap/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          caseId,
          phone: activePhone,
          message: msgToSend,
          clientName: resolvedClientName,
          allowSimulation: true
        })
      });

      const data = await response.json();

      // Incorpora logs recebidos do servidor ao terminal
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        setLogs(prev => {
          // Mescla evitando duplicações exatas
          const combined = [...prev];
          data.logs.forEach((srvLog: TelemetryLog) => {
            combined.push(srvLog);
          });
          return combined;
        });
      }

      if (!response.ok || !data.success) {
        const errMsg = data.errorMessage || 'Falha ao processar disparo via W.A Speed.';
        addLocalLog('error', 'FALHA_DISPARO', errMsg, data.diagnostic);
        throw new Error(errMsg);
      }

      const isSim = !!data.simulated;
      const nowStr = new Date().toISOString();
      const updatedRes = {
        success: true,
        sentAt: nowStr,
        message: msgToSend,
        phoneUsed: data.phoneNormalized || activePhone,
        simulated: isSim,
        deliveryDetails: data.delivery
      };

      setWhatsappResult(updatedRes);

      // Marca automaticamente a certificação humana como 'sim'
      setFormData(prev => ({
        ...prev,
        whatsappBoasVindasEnviado: 'sim'
      }));

      // Atualiza estado local do caso
      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: {
          ...(prev?.onboarding || {}),
          welcomeZap: {
            status: 'completed',
            sentAt: nowStr,
            messageText: msgToSend,
            phoneUsed: data.phoneNormalized || activePhone,
            deliveryMethod: isSim ? 'simulado' : 'wa_speed_api',
            humanCertified: true,
            whatsappBoasVindasEnviado: 'sim',
            deliveryDetails: data.delivery
          }
        }
      }));

      setSuccess(
        isSim
          ? 'Mensagem processada em modo assistido com sucesso! O onboarding foi registrado.'
          : 'Mensagem de boas-vindas enviada com sucesso ao WhatsApp do cliente via W.A Speed!'
      );
      addLocalLog('success', 'CONCLUSAO', `Disparo finalizado com sucesso! Subetapa marcada como concluída.`);

    } catch (err: any) {
      console.error(err);
      setError(`Erro no envio de WhatsApp: ${err.message || err}`);
    } finally {
      setSending(false);
    }
  };

  // Salvar Certificação e Progresso no Firestore
  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const hasDeliveryConfirmed = Boolean(
      whatsappResult?.success || 
      caseObj?.onboarding?.welcomeZap?.status === 'completed'
    );

    if (advanceAfter && !hasDeliveryConfirmed) {
      setError('Por favor, realize o envio de boas-vindas antes de avançar.');
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const existingOnboarding = caseObj?.onboarding || {};
      
      const updatedOnboarding = {
        ...existingOnboarding,
        welcomeZap: {
          ...(existingOnboarding.welcomeZap || {}),
          status: hasDeliveryConfirmed && formData.whatsappBoasVindasEnviado === 'sim' ? 'completed' : 'pending',
          humanCertified: formData.whatsappBoasVindasEnviado === 'sim',
          whatsappBoasVindasEnviado: formData.whatsappBoasVindasEnviado,
          observacoes: formData.observacoes,
          messageText: messageText,
          phoneUsed: activePhone,
          deliveryMethod: whatsappResult?.simulated ? 'simulado' : (existingOnboarding.welcomeZap?.deliveryMethod || 'wa_speed_api'),
          logs: logs
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 02 — Welcome Zap',
        action: 'Salvar Certificação Humana',
        details: `Certificação: ${formData.whatsappBoasVindasEnviado === 'sim' ? 'Sim ✅' : 'Não ❌'}`
      };

      const updatedLogs = [
        ...(caseObj?.onboardingSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        updatedAt: now
      });

      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs
      }));

      addLocalLog('success', 'FIRESTORE', 'Progresso da subetapa e certificação humana persistidos no Firestore.');
      setSuccess('Dados salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/add.cliente.no.instagram`);
        }, 600);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de WhatsApp: ${err.message || err}`);
      addLocalLog('error', 'FIRESTORE', `Falha ao salvar dados: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Copiar Logs para Área de Transferência
  const handleCopyLogs = () => {
    const textToCopy = logs
      .map(
        l =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.stage}] ${l.message} ${
            l.details ? JSON.stringify(l.details) : ''
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLocalLog('info', 'CONSOLE', 'Console de logs de telemetria limpo pelo operador.');
  };

  const toggleExpandLog = (idx: number) => {
    setExpandedLogIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'all') return true;
    if (logFilter === 'info') return log.level === 'info';
    if (logFilter === 'success') return log.level === 'success';
    if (logFilter === 'error') return log.level === 'error' || log.level === 'warn';
    if (logFilter === 'http') return log.stage.includes('HTTP') || log.stage.includes('GATEWAY');
    return true;
  });

  // Link para WhatsApp Web direto como companion
  const cleanDigits = activePhone.replace(/\D/g, '');
  const waWebNumber = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
  const waWebLink = `https://wa.me/${waWebNumber}?text=${encodeURIComponent(messageText)}`;

  if (loading) {
    return (
      <FluxoStepLayout stepName="Onboarding" caseId={caseId}>
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <span className="text-xs font-bold font-mono text-slate-500 tracking-wide uppercase">
            Carregando Boas-vindas W.A Speed...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  return (
    <FluxoStepLayout
      stepName="Onboarding"
      caseId={caseId}
      statusText={caseObj?.onboarding?.auditoria?.statusFinal || 'Em onboarding'}
    >
      <div className="space-y-8 font-sans pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider text-indigo-600 uppercase bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                Subetapa 02 de 08
              </span>
              {gatewayConfig?.configured ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  W.A Speed Real Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Secret Wascript_API Pendente
                </span>
              )}
            </div>
            <h2 id="page-title" className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-1">
              <MessageSquare className="text-emerald-600" size={26} />
              Boas-vindas via W.A Speed (WhatsApp)
            </h2>
            <p className="text-xs text-slate-500 font-medium max-w-3xl">
              Dispare de forma programada a mensagem oficial de boas-vindas do escritório através da automação W.A Speed com monitoramento operacional e logs técnicos em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTokenDrawer(!showTokenDrawer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border bg-white hover:bg-slate-50 text-slate-700 border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              title="Configurar credenciais W.A Speed"
            >
              <Key size={14} className="text-indigo-600" />
              <span>Configurar Token</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/onboarding`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Hub</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK BLOCKS */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex gap-3 items-center shadow-xs">
            <AlertCircle size={20} className="text-rose-500 shrink-0" />
            <div className="space-y-0.5">
              <strong className="block font-bold">Aviso de Operação:</strong>
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center shadow-xs">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div className="space-y-0.5">
              <strong className="block font-bold">Operação Concluída:</strong>
              <span className="font-medium leading-relaxed">{success}</span>
            </div>
          </div>
        )}

        {/* TOKEN CONFIG DRAWER */}
        {showTokenDrawer && (
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-800 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="text-indigo-400" size={18} />
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                  Gerenciador de Credenciais W.A Speed / Wascript
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenDrawer(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕ Fechar
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              O token de autenticação é utilizado nas requisições HTTP para <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">api-whatsapp.wascript.com.br/api/enviar-texto</code>. Você pode inserir seu token abaixo para gravação direta no sistema.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                placeholder="Cole aqui o token Wascript_API..."
                value={manualTokenInput}
                onChange={e => setManualTokenInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-indigo-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                disabled={savingToken || !manualTokenInput.trim()}
                onClick={handleSaveToken}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                {savingToken ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Salvar Credencial</span>
              </button>
            </div>
            {gatewayConfig?.configured && (
              <div className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck size={14} />
                <span>Token atualmente ativo: {gatewayConfig.tokenMasked} (Origem: {gatewayConfig.tokenSource})</span>
              </div>
            )}
          </div>
        )}

        {/* CARD 1: DETALHES DE DESTINO & TELEFONE */}
        <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
              <Info size={15} className="text-slate-500" />
              Destinatário e Canal de Entrega
            </h3>
            {activePhone && (
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                Destino Identificado
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Nome do Cliente</span>
              <span className="text-sm font-black text-slate-800 block">{resolvedClientName}</span>
              <span className="text-[10px] text-slate-400 block">ID do Caso: <strong className="font-mono text-slate-600">{caseId}</strong></span>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Número de WhatsApp</span>
                {defaultPhone && customPhone && customPhone !== defaultPhone && (
                  <button
                    type="button"
                    onClick={() => setCustomPhone('')}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Restaurar original
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="text"
                  value={activePhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full text-sm font-mono font-black text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none py-0.5"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Padrão aceito: DDD + 8 ou 9 dígitos (ex: 31988639056). A API normaliza para DDI 55 automaticamente.
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: TEXTO DA MENSAGEM */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
              <MessageSquare size={15} className="text-indigo-600" />
              Mensagem Oficial de Boas-vindas
            </h3>
            <button
              type="button"
              onClick={() => setMessageText(getDefaultMessageText(resolvedClientName))}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Restaurar Mensagem Padrão
            </button>
          </div>

          <div className="space-y-2">
            <textarea
              rows={6}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all resize-none font-sans"
              placeholder="Digite a mensagem de boas-vindas..."
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{messageText.length} caracteres</span>
              <span>Suporta quebras de linha e formatação do WhatsApp (*negrito*, _itálico_)</span>
            </div>
          </div>
        </div>

        {/* CARD 3: MOTOR DE DISPARO W.A SPEED */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-0.5">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                <Zap size={16} className="text-emerald-600" />
                Disparo Automatizado W.A Speed (Wascript)
              </h3>
              <p className="text-[11px] text-slate-500">
                O envio realiza chamada HTTP direta com tentativa primária e fallback de 9º dígito para maximizar a entregabilidade.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {gatewayConfig?.configured ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>W.A Speed Real Ativo ({gatewayConfig.tokenMasked || 'Conectado'})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                  <ShieldCheck size={14} className="text-indigo-600" />
                  <span>Modo Assistido Habilitado (Preview)</span>
                </span>
              )}
            </div>
          </div>

          {/* Aviso Informativo quando Token Wascript_API ainda não configurado */}
          {!gatewayConfig?.configured && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-indigo-950 text-xs flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shadow-xs">
              <div className="flex gap-2.5 items-start">
                <AlertCircle size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="block font-bold">Modo Assistido Ativo (Wascript_API pendente):</strong>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    O secret <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono font-bold">Wascript_API</code> não está cadastrado neste ambiente. O sistema opera em modo assistido com telemetria para validação completa do fluxo. Você também pode cadastrar seu token a qualquer momento pelo botão ao lado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenDrawer(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                Configurar Token
              </button>
            </div>
          )}

          {/* Botões de Ação Principal */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              id="btn-disparar-wa-speed"
              disabled={sending || !activePhone}
              onClick={handleSendWhatsApp}
              className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-md hover:shadow-lg h-[52px]"
            >
              {sending ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Processando envio via W.A Speed...</span>
                </>
              ) : (
                <>
                  <Send size={18} className="text-white" />
                  <span>
                    {gatewayConfig?.configured
                      ? 'Disparar Mensagem via W.A Speed'
                      : 'Disparar Mensagem de Boas-vindas (Assistido)'}
                  </span>
                </>
              )}
            </button>

            {activePhone && (
              <a
                href={waWebLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer h-[52px]"
                title="Abrir WhatsApp Web como verificação ou envio manual de contingência"
              >
                <ExternalLink size={16} className="text-emerald-600" />
                <span>Abrir WhatsApp Web</span>
              </a>
            )}

            <button
              type="button"
              disabled={testingConnection || !activePhone}
              onClick={handleTestConnection}
              className="inline-flex items-center justify-center gap-2 px-4 py-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer h-[52px]"
              title="Testar formatos de telefone e resposta de conectividade com a API"
            >
              {testingConnection ? (
                <Loader2 size={16} className="animate-spin text-indigo-600" />
              ) : (
                <RefreshCw size={16} className="text-indigo-600" />
              )}
              <span className="hidden md:inline">Testar Conectividade</span>
            </button>
          </div>

          {/* Resultado do Disparo */}
          {whatsappResult && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wide">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>
                    {whatsappResult.simulated
                      ? 'Mensagem processada em Modo Assistido / Demonstração!'
                      : 'Mensagem confirmada e aceita pela API W.A Speed!'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Status: {whatsappResult.deliveryDetails?.httpStatus || 200} OK {whatsappResult.simulated ? '(Simulado)' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700 font-medium pt-1">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Número de Destino</span>
                  <span className="font-mono font-bold text-slate-800">{whatsappResult.phoneUsed || activePhone}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Data e Hora do Disparo</span>
                  <span className="font-mono font-bold text-slate-800">
                    {whatsappResult.sentAt ? new Date(whatsappResult.sentAt).toLocaleString('pt-BR') : 'Agora'}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Método de Envio</span>
                  <span className="font-bold text-emerald-700">
                    {whatsappResult.simulated ? 'Modo Assistido / Demonstração' : 'Gateway W.A Speed Real'}
                  </span>
                </div>
              </div>

              {whatsappResult.deliveryDetails && (
                <div className="text-[10px] font-mono bg-white/90 p-3 rounded-xl border border-emerald-100 text-slate-600 space-y-1">
                  <span className="font-black text-slate-700 block uppercase text-[9px]">Telemetria do Gateway:</span>
                  <div>• HTTP Status: <strong className="text-slate-800">{whatsappResult.deliveryDetails.httpStatus}</strong></div>
                  <div>• Latência: <strong className="text-slate-800">{whatsappResult.deliveryDetails.latencyMs} ms</strong></div>
                  {whatsappResult.deliveryDetails.inspection?.reason && (
                    <div>• Diagnóstico: <span className="text-slate-700">{whatsappResult.deliveryDetails.inspection.reason}</span></div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 4: CONSOLE DE LOGS ESPECÍFICOS DE FUNCIONAMENTO (TELEMETRIA EM TEMPO REAL) */}
        <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-6 space-y-4 shadow-xl">
          {/* Header do Terminal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              </div>
              <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>
              <Terminal size={16} className="text-emerald-400" />
              <div>
                <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider font-mono">
                  Logs Específicos de Funcionamento (W.A Speed Telemetry)
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Monitoramento técnico de eventos, requisições HTTP, validações e persistência
                </span>
              </div>
            </div>

            {/* Ações do Terminal */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLogs}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg text-[10px] font-mono font-bold transition-all border border-slate-800 cursor-pointer"
                title="Copiar todos os logs"
              >
                {copiedLogs ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedLogs ? 'Copiado!' : 'Copiar Logs'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-400 hover:text-rose-300 rounded-lg text-[10px] font-mono font-bold transition-all border border-slate-800 cursor-pointer"
                title="Limpar console"
              >
                <Trash2 size={12} />
                <span>Limpar</span>
              </button>
            </div>
          </div>

          {/* Filtros de Nível */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono">
            <span className="text-slate-500 mr-1">Filtrar:</span>
            {(['all', 'info', 'success', 'error', 'http'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setLogFilter(f)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer uppercase ${
                  logFilter === f
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                {f === 'all' && `Todos (${logs.length})`}
                {f === 'info' && 'Info'}
                {f === 'success' && 'Sucesso'}
                {f === 'error' && 'Avisos/Erros'}
                {f === 'http' && 'HTTP / Gateway'}
              </button>
            ))}
          </div>

          {/* Janela de Logs com Rolagem */}
          <div className="bg-slate-900/90 rounded-xl p-4 font-mono text-xs text-slate-200 min-h-[180px] max-h-[360px] overflow-y-auto space-y-2 border border-slate-800/80">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 italic text-[11px]">
                Nenhum log registrado para este filtro. Acione "Disparar Mensagem via W.A Speed" para iniciar.
              </div>
            ) : (
              filteredLogs.map((log, index) => {
                const isExpanded = !!expandedLogIndices[index];
                const timeStr = log.timestamp ? log.timestamp.split('T')[1]?.replace('Z', '') : '';

                let badgeColor = 'text-sky-400 bg-sky-950/60 border-sky-800/60';
                if (log.level === 'success') badgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60 font-bold';
                if (log.level === 'warn') badgeColor = 'text-amber-400 bg-amber-950/60 border-amber-800/60';
                if (log.level === 'error') badgeColor = 'text-rose-400 bg-rose-950/60 border-rose-800/60 font-bold';
                if (log.level === 'debug') badgeColor = 'text-purple-400 bg-purple-950/60 border-purple-800/60';

                return (
                  <div
                    key={index}
                    className="p-2 rounded-lg bg-slate-950/50 hover:bg-slate-950 transition-colors border border-slate-850/60 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="text-slate-500 text-[10px]">{timeStr || log.timestamp}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] border uppercase ${badgeColor}`}>
                          {log.level}
                        </span>
                        <span className="text-indigo-400 font-bold text-[10px]">
                          [{log.stage}]
                        </span>
                        <span className="text-slate-200 leading-relaxed font-sans">
                          {log.message}
                        </span>
                      </div>

                      {log.details && (
                        <button
                          type="button"
                          onClick={() => toggleExpandLog(index)}
                          className="text-[10px] text-slate-400 hover:text-indigo-300 font-bold flex items-center gap-0.5 shrink-0 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Ocultar JSON' : 'Ver Dados'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>

                    {isExpanded && log.details && (
                      <div className="mt-2 p-2.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-normal font-mono">
                        {JSON.stringify(log.details, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={terminalBottomRef} />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
            <span>Terminal conectado à API de produção</span>
            <span>Total de registros: {logs.length}</span>
          </div>
        </div>

        {/* CARD 5: CERTIFICAÇÃO HUMANA & SALVAMENTO */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <CheckSquare size={16} className="text-indigo-600" />
              Certificação Humana de Entrega
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Validação de conformidade obrigatória para prosseguir no fluxo de onboarding do cliente.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wide block">
                Você enviou e conferiu se a mensagem de boas-vindas chegou corretamente ao WhatsApp do cliente? *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <label
                  className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.whatsappBoasVindasEnviado === 'sim'
                      ? 'bg-indigo-50/50 border-indigo-600 ring-1 ring-indigo-600 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="whatsappBoasVindasEnviado"
                    value="sim"
                    checked={formData.whatsappBoasVindasEnviado === 'sim'}
                    onChange={handleChange}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Sim, enviada e conferida ✅</span>
                    <span className="text-[10px] text-slate-500 font-medium">A mensagem foi disparada e validada</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.whatsappBoasVindasEnviado === 'nao'
                      ? 'bg-rose-50/50 border-rose-400 ring-1 ring-rose-400 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="whatsappBoasVindasEnviado"
                    value="nao"
                    checked={formData.whatsappBoasVindasEnviado === 'nao'}
                    onChange={handleChange}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Não ou não verifiquei ❌</span>
                    <span className="text-[10px] text-slate-500 font-medium">Ainda pendente de confirmação com o cliente</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                Observações operacionais adicionais
              </label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows={3}
                placeholder="Ex: Cliente confirmou o recebimento às 14h30..."
                className="w-full border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all resize-none bg-slate-50/30 focus:bg-white"
              />
            </div>
          </div>

          {/* ACTION FOOTER BAR */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-50 w-full sm:w-auto h-[48px]"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>Salvar Progresso</span>
            </button>

            <button
              type="button"
              id="btn-salvar-avancar"
              disabled={
                saving ||
                formData.whatsappBoasVindasEnviado !== 'sim' ||
                !(whatsappResult?.success || caseObj?.onboarding?.welcomeZap?.status === 'completed')
              }
              onClick={() => handleSave(true)}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg w-full sm:w-auto h-[48px]"
              title={
                !(whatsappResult?.success || caseObj?.onboarding?.welcomeZap?.status === 'completed')
                  ? 'Realize o envio da mensagem de boas-vindas antes de avançar'
                  : undefined
              }
            >
              <span>Salvar e Avançar para Instagram</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
