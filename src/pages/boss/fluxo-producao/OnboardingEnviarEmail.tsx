import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import FluxoStepLayout from './components/FluxoStepLayout';
import OnboardingSubetapasCard from './components/OnboardingSubetapasCard';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  RefreshCw,
  Info
} from 'lucide-react';

interface TelemetryLog {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  stage: string;
  message: string;
  details?: any;
}

const DEFAULT_SUBJECT = 'Boas Vindas da Giffoni Advogados Associados';
const INTERNAL_COPY_EMAIL = 'direito.rgr@gmail.com';

const buildDefaultEmailTemplate = (clientName: string) => {
  const safeName = (clientName || '').trim() || 'Cliente';
  return `Prezado(a) ${safeName},

Seja muito bem-vindo(a) à Giffoni Advogados Associados.

É uma satisfação receber você como cliente do nosso escritório.

A partir deste momento, seu atendimento passa a integrar nosso fluxo de acompanhamento, organização e produção jurídica. Nossa equipe seguirá o seu caso com atenção, responsabilidade e cuidado, mantendo as comunicações necessárias pelos canais oficiais do escritório.

Sempre que precisar encaminhar documentos ou prestar alguma informação relacionada ao seu atendimento, utilize os canais disponibilizados por nossa equipe.

Agradecemos pela confiança depositada em nosso trabalho.

Atenciosamente,

Giffoni Advogados Associados`;
};

export default function OnboardingEnviarEmail() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Email Editor State
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [messageBody, setMessageBody] = useState('');
  const [isTemplateLoaded, setIsTemplateLoaded] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [resendConfirmed, setResendConfirmed] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Diagnostics & Logs
  const [gmailStatus, setGmailStatus] = useState<{
    checked: boolean;
    connected: boolean;
    senderEmail?: string;
  }>({ checked: false, connected: false });
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);

  // Double click protection lock ref
  const sendLockRef = useRef(false);

  const addLog = (
    level: 'info' | 'success' | 'warn' | 'error',
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
    setLogs(prev => [entry, ...prev]);
  };

  const getEffectiveGoogleToken = () => {
    return (
      googleAccessToken ||
      sessionStorage.getItem('google_access_token') ||
      localStorage.getItem('google_access_token') ||
      localStorage.getItem('oauth_google_access_token') ||
      localStorage.getItem('portal_boss_google_accessToken') ||
      ''
    );
  };

  // Check Gmail Connection Diagnostics
  const checkGmailDiagnostics = async (token?: string) => {
    const tok = token || getEffectiveGoogleToken();
    try {
      const res = await fetch(`/api/onboarding/email/status${tok ? `?googleAccessToken=${encodeURIComponent(tok)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setGmailStatus({
          checked: true,
          connected: !!data.connected,
          senderEmail: data.senderEmail || (data.connected ? INTERNAL_COPY_EMAIL : undefined)
        });
      } else {
        setGmailStatus({ checked: true, connected: false });
      }
    } catch {
      setGmailStatus({ checked: true, connected: false });
    }
  };

  useEffect(() => {
    checkGmailDiagnostics();
  }, [googleAccessToken]);

  // Load Case and Client Data
  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (!caseSnap.exists()) {
          setError(`Caso de ID [${caseId}] não encontrado.`);
          setLoading(false);
          return;
        }

        const cData = caseSnap.data();
        setCaseObj(cData);

        let clientData: any = null;
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            clientData = clientSnap.data();
            setClient(clientData);
          }
        }

        // Resolve client name for default template initialization
        const resolvedName = resolveClientName(clientData, cData);
        
        // Check existing email body or load default
        const existingEmailState = cData.onboarding?.email || {};
        const existingBody = existingEmailState.bodyFinal || cData.emailWelcome?.bodyFinal;
        const existingSubject = existingEmailState.subject || cData.emailWelcome?.subject;

        if (existingSubject) {
          setSubject(existingSubject);
        }

        if (existingBody && existingBody.trim()) {
          setMessageBody(existingBody);
        } else {
          setMessageBody(buildDefaultEmailTemplate(resolvedName));
        }
        setIsTemplateLoaded(true);

        addLog('info', 'CARGA_DADOS', 'Dados da subetapa e histórico carregados com sucesso.');
      } catch (err: any) {
        console.error('Erro ao carregar dados do onboarding:', err);
        setError(`Erro ao carregar dados do e-mail de onboarding: ${err.message || err}`);
        addLog('error', 'CARGA_DADOS', 'Falha ao buscar caso/cliente no Firestore.', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  // Client Name Resolution (Lógica Carry-On)
  const resolveClientName = (cl: any, cs: any): string => {
    if (cl) {
      if (cl.type === 'PJ' || cl.tipoPessoa === 'PJ' || cl.isCompany === true) {
        return (
          cl.pjDadosEmpresa?.pj_razaoSocial ||
          cl.pjData?.pj_razaoSocial ||
          cl.pjDadosEmpresa?.pj_nomeFantasia ||
          cl.name ||
          cl.nome ||
          cs?.clientName ||
          'Cliente'
        );
      }
      return (
        cl.pfDadosPessoais?.pf_nomeCompleto ||
        cl.pfData?.pf_nomeCompleto ||
        cl.name ||
        cl.nome ||
        cs?.clientName ||
        'Cliente'
      );
    }
    return cs?.onboarding?.email?.nomeCompletoCliente || cs?.clientName || 'Cliente';
  };

  // Client Email Resolution (Lógica Carry-On Canônica)
  const resolveClientEmail = (): string => {
    if (client) {
      if (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true) {
        const pjEmail =
          client.pjDadosEmpresa?.pj_emailEmpresa ||
          client.pjContatoEmpresa?.pj_emailEmpresa ||
          client.pjData?.pj_emailEmpresa ||
          client.email ||
          '';
        if (pjEmail && pjEmail.trim()) return pjEmail.trim();
      }
      const pfEmail =
        client.pfDadosPessoais?.pf_email ||
        client.pfContato?.pf_email ||
        client.pfData?.pf_email ||
        client.email ||
        client.acesso_emailLogin ||
        '';
      if (pfEmail && pfEmail.trim()) return pfEmail.trim();
    }
    if (caseObj?.onboarding?.email?.emailInformed) {
      return String(caseObj.onboarding.email.emailInformed).trim();
    }
    return '';
  };

  const resolvedClientName = resolveClientName(client, caseObj);
  const emailInformed = resolveClientEmail();

  // Existing Execution Check
  const emailState = caseObj?.onboarding?.email || {};
  const emailWelcomeState = caseObj?.emailWelcome || {};
  const gmailMessageId = emailState.gmailMessageId || emailWelcomeState.gmailMessageId || '';
  const isAlreadySent =
    (emailState.status === 'completed' || emailWelcomeState.status === 'sent') &&
    !!gmailMessageId &&
    emailState.emailBoasVindasEnviadoCliente === 'sim';

  const lastSentAt = emailState.sentAt || emailWelcomeState.sentAt;
  const lastSenderEmail = emailState.senderEmail || emailWelcomeState.senderEmail || INTERNAL_COPY_EMAIL;

  // Restore Template Action
  const handleRestoreTemplate = () => {
    const template = buildDefaultEmailTemplate(resolvedClientName);
    setMessageBody(template);
    setSubject(DEFAULT_SUBJECT);
    addLog('info', 'EDITOR', 'Modelo padrão de boas-vindas restaurado pelo operador.');
  };

  // Connect Google Account Action
  const handleConnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      setError(null);
      addLog('info', 'AUTH_GOOGLE', 'Iniciando autenticação Google com escopo Gmail.');
      await loginWithGoogle('boss_admin');
      const token = getEffectiveGoogleToken();
      await checkGmailDiagnostics(token);
      setSuccess('Conta Google conectada com sucesso! Você já pode realizar o disparo real.');
      addLog('success', 'AUTH_GOOGLE', 'Autenticação Google concluída com sucesso.');
    } catch (authErr: any) {
      console.error('Falha ao autenticar Google:', authErr);
      const msg = authErr.message || String(authErr);
      setError(`Falha ao autorizar conta Google: ${msg}. Verifique se pop-ups estão habilitados no navegador.`);
      addLog('error', 'AUTH_GOOGLE', `Falha na autorização: ${msg}`, authErr);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // Real Gmail Dispatch Action
  const handleSendEmail = async () => {
    if (sendLockRef.current || isSending) {
      return;
    }

    setError(null);
    setSuccess(null);
    setPersistenceWarning(null);

    // 1. Client Email Validation
    if (!emailInformed || !emailInformed.trim()) {
      setError('E-mail do cliente não cadastrado na etapa de origem. Impossível realizar o disparo.');
      return;
    }

    // 2. Body and Subject Validation
    if (!subject.trim()) {
      setError('O assunto do e-mail é obrigatório e não pode ficar em branco.');
      return;
    }

    if (!messageBody.trim()) {
      setError('O corpo da mensagem é obrigatório.');
      return;
    }

    // 3. Token check
    const token = getEffectiveGoogleToken();
    if (!token && !gmailStatus.connected) {
      setError('Conta Google não conectada. Conecte a conta do escritório (direito.rgr@gmail.com) antes de enviar.');
      return;
    }

    try {
      sendLockRef.current = true;
      setIsSending(true);

      addLog('info', 'DISPARO_INICIADO', `Iniciando envio real para ${emailInformed} com cópia para ${INTERNAL_COPY_EMAIL}.`, {
        subject,
        bodyLength: messageBody.length,
        recipient: emailInformed,
        bcc: INTERNAL_COPY_EMAIL
      });

      const response = await fetch('/api/onboarding/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          caseId,
          clientId: caseObj?.clientId || client?.id,
          clientName: resolvedClientName,
          email: emailInformed,
          subject: subject.trim(),
          body: messageBody.trim(),
          googleAccessToken: token
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.errorMessage || data.message || `Erro no servidor (HTTP ${response.status})`;
        setError(`Falha no envio real do e-mail: ${errorMsg}`);
        addLog('error', 'DISPARO_FALHA', errorMsg, data);
        sendLockRef.current = false;
        setIsSending(false);
        return;
      }

      // Gmail API returned real success and messageId
      const delivery = data.delivery || {};
      const deliveredMessageId = delivery.gmailMessageId;
      const deliveredThreadId = delivery.gmailThreadId;
      const deliveredSender = delivery.senderEmail || INTERNAL_COPY_EMAIL;
      const sentTimestamp = delivery.sentAt || new Date().toISOString();

      addLog('success', 'DISPARO_CONCLUIDO', `E-mail enviado com sucesso via Gmail! ID: ${deliveredMessageId}`, delivery);

      // Handle persistence warning if server couldn't update Firestore
      if (data.persistenceWarning) {
        setPersistenceWarning('O e-mail foi enviado com sucesso pelo Gmail, mas ocorreu instabilidade ao salvar o histórico. Utilize o botão de reconciliação.');
      } else {
        setSuccess('E-mail de boas-vindas enviado com sucesso via Gmail oficial!');
      }

      // Safe local and Firestore client-side synchronization as dual guarantee
      try {
        const caseRef = doc(db, 'cases', caseId!);
        const currentCaseSnap = await getDoc(caseRef);
        const currentCaseData = currentCaseSnap.exists() ? currentCaseSnap.data() : {};
        const currentOnboarding = currentCaseData.onboarding || {};
        const currentLogs = currentCaseData.onboardingSubetapaLogs || [];

        const updatedEmailRecord = {
          ...(currentOnboarding.email || {}),
          status: 'completed',
          humanCertified: true,
          emailBoasVindasEnviadoCliente: 'sim',
          desejaEnviarAcessoPortalCliente: currentOnboarding.email?.desejaEnviarAcessoPortalCliente || 'sim',
          acessoPortalClienteAnalisado: currentOnboarding.email?.acessoPortalClienteAnalisado || 'sim',
          nomeCompletoCliente: resolvedClientName,
          emailInformed: emailInformed,
          subject: subject.trim(),
          bodyFinal: messageBody.trim(),
          gmailMessageId: deliveredMessageId,
          gmailThreadId: deliveredThreadId || null,
          senderEmail: deliveredSender,
          internalCopyEmail: INTERNAL_COPY_EMAIL,
          sentAt: sentTimestamp,
          simulated: false
        };

        const updatedEmailWelcome = {
          status: 'sent',
          recipientEmail: emailInformed,
          internalCopyEmail: INTERNAL_COPY_EMAIL,
          subject: subject.trim(),
          bodyFinal: messageBody.trim(),
          gmailMessageId: deliveredMessageId,
          gmailThreadId: deliveredThreadId || null,
          sentAt: sentTimestamp,
          senderEmail: deliveredSender,
          simulated: false
        };

        const clientLogEntry = {
          timestamp: sentTimestamp,
          subetapa: 'Subetapa 05 — Enviar E-mail',
          action: 'Disparo Real E-mail Boas-vindas',
          details: `E-mail enviado com sucesso para ${emailInformed} com cópia BCC para ${INTERNAL_COPY_EMAIL}. Gmail ID: ${deliveredMessageId}`,
          gmailMessageId: deliveredMessageId,
          gmailThreadId: deliveredThreadId || null,
          sender: deliveredSender
        };

        await updateDoc(caseRef, {
          'onboarding.email': updatedEmailRecord,
          'emailWelcome': updatedEmailWelcome,
          'onboarding.auditoria.emailBoasVindasEnviadoCliente': true,
          'onboarding.auditoria.acessoPortalClienteAnalisado': true,
          'onboardingSubetapaLogs': [...currentLogs, clientLogEntry],
          'updatedAt': sentTimestamp
        });

        setCaseObj((prev: any) => ({
          ...prev,
          onboarding: {
            ...(prev?.onboarding || {}),
            email: updatedEmailRecord,
            auditoria: {
              ...(prev?.onboarding?.auditoria || {}),
              emailBoasVindasEnviadoCliente: true,
              acessoPortalClienteAnalisado: true
            }
          },
          emailWelcome: updatedEmailWelcome,
          onboardingSubetapaLogs: [...(prev?.onboardingSubetapaLogs || []), clientLogEntry]
        }));

        setPersistenceWarning(null);
      } catch (clientSyncErr: any) {
        console.warn('Falha na sincronização secundária de cliente:', clientSyncErr);
      }

      setShowResendConfirmation(false);
      setResendConfirmed(false);
    } catch (err: any) {
      console.error('Erro na requisição de envio de e-mail:', err);
      const msg = err.message || String(err);
      setError(`Erro inesperado ao realizar disparo de e-mail: ${msg}`);
      addLog('error', 'DISPARO_EXCECAO', msg, err);
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  };

  // Safe Reconciliation Action (Does NOT resend email)
  const handleReconcile = async () => {
    if (!caseId || !gmailMessageId) return;
    try {
      setIsReconciling(true);
      setError(null);
      addLog('info', 'RECONCILIACAO', 'Iniciando reconciliação segura no Firestore.');

      const res = await fetch('/api/onboarding/email/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          clientId: caseObj?.clientId || client?.id,
          clientName: resolvedClientName,
          email: emailInformed,
          subject: subject.trim(),
          bodyFinal: messageBody.trim(),
          gmailMessageId,
          gmailThreadId: emailState.gmailThreadId || null,
          senderEmail: lastSenderEmail,
          sentAt: lastSentAt
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPersistenceWarning(null);
        setSuccess('Histórico e auditoria reconciliados com sucesso no banco de dados!');
        addLog('success', 'RECONCILIACAO', 'Reconciliação no Firestore concluída com sucesso.');
      } else {
        setError(`Falha na reconciliação: ${data.errorMessage || 'Erro no servidor'}`);
        addLog('error', 'RECONCILIACAO', data.errorMessage || 'Falha', data);
      }
    } catch (e: any) {
      setError(`Erro na reconciliação: ${e.message}`);
      addLog('error', 'RECONCILIACAO', e.message, e);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleCopyMessageId = () => {
    if (!gmailMessageId) return;
    navigator.clipboard.writeText(gmailMessageId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Onboarding" caseId={caseId}>
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <span className="text-xs font-bold font-mono text-slate-500 tracking-wide uppercase">
            Carregando Estação de Envio de E-mail...
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
                Subetapa 05 de 06
              </span>
              {gmailStatus.connected ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Gmail Autenticado ({gmailStatus.senderEmail || INTERNAL_COPY_EMAIL})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Conexão Gmail Pendente
                </span>
              )}
            </div>

            <h2 id="page-title" className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-1">
              <Mail className="text-indigo-600" size={26} />
              Enviar E-mail de Boas-vindas ao Cliente
            </h2>
            <p className="text-xs text-slate-500 font-medium max-w-3xl">
              Dispare de forma oficial a mensagem de boas-vindas do escritório através da integração direta com o Gmail, com garantia de cópia automática de auditoria para <strong className="text-slate-700 font-mono">direito.rgr@gmail.com</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!gmailStatus.connected && (
              <button
                type="button"
                disabled={isConnectingGoogle}
                onClick={handleConnectGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs disabled:opacity-50"
              >
                {isConnectingGoogle ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldAlert size={14} className="text-indigo-600" />
                )}
                <span>Conectar Gmail</span>
              </button>
            )}

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

        {/* Progression Card across Onboarding Sub-steps */}
        <OnboardingSubetapasCard caseId={caseId} />

        {/* FEEDBACK ALERTS */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex gap-3 items-center shadow-xs">
            <AlertCircle size={20} className="text-rose-500 shrink-0" />
            <div className="space-y-0.5">
              <strong className="block font-bold">Aviso de Operação:</strong>
              <span className="font-semibold leading-relaxed block">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center shadow-xs">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div className="space-y-0.5">
              <strong className="block font-bold">Disparo Real Confirmado:</strong>
              <span className="font-semibold leading-relaxed block">{success}</span>
            </div>
          </div>
        )}

        {persistenceWarning && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 text-xs flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shadow-xs">
            <div className="flex gap-2.5 items-start">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-bold">Aviso de Reconciliação:</strong>
                <p className="text-[11px] text-amber-800 leading-relaxed">{persistenceWarning}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={isReconciling}
              onClick={handleReconcile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 shadow-xs"
            >
              {isReconciling ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              <span>Reconciliar Registro</span>
            </button>
          </div>
        )}

        {/* BLOCKING ERROR WHEN CLIENT EMAIL IS MISSING */}
        {!emailInformed && (
          <div className="bg-rose-50/70 border-2 border-rose-200 rounded-[2rem] p-6 space-y-4 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-black text-rose-900 tracking-tight">
                  E-mail do cliente não cadastrado na etapa de origem.
                </h3>
                <p className="text-xs text-rose-800 font-medium leading-relaxed">
                  Não foi identificado um endereço de e-mail registrado para o cliente <strong className="font-bold">{resolvedClientName}</strong> na etapa inicial de cadastro. Para manter a integridade dos dados e evitar redigitação, volte à etapa de cadastro para preencher o e-mail oficial antes de realizar o disparo de acolhimento.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-rose-200/60 flex items-center justify-start">
              <button
                type="button"
                onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/cadastro/editar`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>Voltar para Etapa 01 — Cadastro do Cliente</span>
              </button>
            </div>
          </div>
        )}

        {/* OPERATIONAL EMAIL STATION (RENDERED ONLY WHEN EMAIL EXISTS) */}
        {emailInformed && (
          <>
            {/* CARD 1: RECIPIENT & INTERNAL AUDIT COPY */}
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                  <Info size={15} className="text-slate-500" />
                  Destinatário e Endereçamento Oficial
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  E-mail Carregado via Carry-On
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Client Recipient (Read-Only) */}
                <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                      Destinatário Principal (To)
                    </span>
                    <span title="Origem canônica bloqueada para edição manual">
                      <Lock size={12} className="text-slate-400" />
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-800 block truncate" title={resolvedClientName}>
                    {resolvedClientName}
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-700 block truncate" title={emailInformed}>
                    {emailInformed}
                  </span>
                  <span className="text-[10px] text-slate-400 block pt-0.5">
                    Caso ID: <strong className="font-mono text-slate-600">{caseId}</strong>
                  </span>
                </div>

                {/* Mandatory Internal Copy (BCC) */}
                <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                      Cópia Interna (BCC Automática)
                    </span>
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Garantia Obrigatória
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-800 block">
                    Giffoni Advogados
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 block truncate" title={INTERNAL_COPY_EMAIL}>
                    {INTERNAL_COPY_EMAIL}
                  </span>
                  <p className="text-[10px] text-slate-400 block pt-0.5">
                    Cópia oculta enviada automaticamente via cabeçalho MIME RFC 2822.
                  </p>
                </div>

                {/* Email Subject */}
                <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                    Assunto da Mensagem
                  </span>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Assunto do e-mail..."
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all mt-1"
                  />
                  <p className="text-[10px] text-slate-400 block pt-0.5">
                    Assunto oficial padronizado do escritório para acolhimento.
                  </p>
                </div>
              </div>
            </div>

            {/* CARD 2: EDITABLE EMAIL BODY EDITOR */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <Mail size={15} className="text-indigo-600" />
                    Mensagem Oficial de Boas-vindas
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    O texto nasce preenchido com o modelo oficial e o nome do cliente. Você pode personalizar o texto antes do envio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRestoreTemplate}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100/60 px-3 py-1.5 rounded-xl border border-indigo-100 cursor-pointer transition-all"
                  title="Restaura o modelo padrão mantendo o nome do cliente"
                >
                  <RotateCcw size={13} />
                  <span>Restaurar texto padrão</span>
                </button>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={10}
                  value={messageBody}
                  onChange={e => setMessageBody(e.target.value)}
                  className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all resize-none font-sans"
                  placeholder="Digite ou edite o corpo do e-mail de boas-vindas..."
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>{messageBody.length} caracteres • {messageBody.split(/\r\n|\r|\n/).length} linhas</span>
                  <span>A versão enviada ao cliente será exatamente o conteúdo deste editor no momento do disparo</span>
                </div>
              </div>
            </div>

            {/* CARD 3: REAL DISPATCH ENGINE VIA GMAIL API */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6 shadow-xs">
              
              {/* SUCCESS STATE WHEN EMAIL IS ALREADY DELIVERED */}
              {isAlreadySent && !showResendConfirmation ? (
                <div className="space-y-5">
                  <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                        <div>
                          <h4 className="text-sm font-black text-emerald-950">
                            E-mail de boas-vindas enviado com sucesso.
                          </h4>
                          <span className="text-[11px] text-emerald-800 font-medium">
                            Disparo confirmado pela API oficial do Gmail com registro de auditoria no Firestore.
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto">
                        <ShieldCheck size={13} />
                        Envio Real Confirmado
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                      <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Destinatário Principal</span>
                        <span className="font-mono font-bold text-slate-800 truncate block" title={emailInformed}>
                          {emailInformed}
                        </span>
                      </div>

                      <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Cópia de Auditoria (BCC)</span>
                        <span className="font-mono font-bold text-emerald-700 truncate block" title={INTERNAL_COPY_EMAIL}>
                          {INTERNAL_COPY_EMAIL}
                        </span>
                      </div>

                      <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Data e Hora do Disparo</span>
                        <span className="font-semibold text-slate-800 block">
                          {lastSentAt ? new Date(lastSentAt).toLocaleString('pt-BR') : 'Data registrada'}
                        </span>
                      </div>

                      <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase text-slate-400 block">Gmail Message ID</span>
                          <button
                            type="button"
                            onClick={handleCopyMessageId}
                            className="text-[9px] text-indigo-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <Copy size={10} />
                            <span>{copiedId ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <span className="font-mono font-bold text-slate-700 truncate block" title={gmailMessageId}>
                          {gmailMessageId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Completed Sub-step */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResendConfirmation(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Opções de reenvio de e-mail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/avaliacard`)}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
                    >
                      <span>Salvar e Avançar para AvaliaCard</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                        <Send size={15} className="text-indigo-600" />
                        Disparo Real via Gmail API
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        O envio dispara uma requisição autenticada à API do Google Gmail. Simulações ou disparos fictícios são terminantemente proibidos.
                      </p>
                    </div>

                    <div className="shrink-0">
                      {gmailStatus.connected ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                          <ShieldCheck size={14} className="text-emerald-600" />
                          <span>Gmail Conectado e Autorizado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          <ShieldAlert size={14} className="text-amber-600" />
                          <span>Google OAuth Necessário</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Re-send confirmation safety lock */}
                  {showResendConfirmation && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <strong className="text-xs font-bold text-amber-950 block">
                            Proteção contra Duplicidade de E-mail
                          </strong>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Um e-mail de boas-vindas já foi confirmado para este cliente anteriormente. Para reenviar uma nova mensagem oficial, marque a confirmação abaixo.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-amber-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                          <input
                            type="checkbox"
                            checked={resendConfirmed}
                            onChange={e => setResendConfirmed(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                          />
                          <span>Confirmar expressamente o reenvio deste e-mail ao cliente</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setShowResendConfirmation(false);
                            setResendConfirmed(false);
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 underline"
                        >
                          Cancelar reenvio
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dispatch Main Button & Google Connection Prompt */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="text-xs text-slate-400">
                      {isSending ? (
                        <span className="text-indigo-600 font-bold flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          Transmitindo dados via Gmail API (MIME RFC 2822)...
                        </span>
                      ) : (
                        <span>Destinatário: <strong className="text-slate-700">{emailInformed}</strong> | Cópia: <strong className="text-slate-700">{INTERNAL_COPY_EMAIL}</strong></span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {!gmailStatus.connected && (
                        <button
                          type="button"
                          disabled={isConnectingGoogle}
                          onClick={handleConnectGoogle}
                          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-all w-full sm:w-auto"
                        >
                          {isConnectingGoogle ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          <span>Conectar Google ({INTERNAL_COPY_EMAIL})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isSending || (isAlreadySent && !resendConfirmed)}
                        onClick={handleSendEmail}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        {isSending ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Enviando pelo Gmail...</span>
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            <span>{isAlreadySent ? 'Confirmar Reenvio de E-mail' : 'Enviar e-mail de boas-vindas'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 4: CONTEXTUAL TECHNICAL LOGS (HIDDEN BY DEFAULT) */}
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <Eye size={15} className="text-slate-500" />
                    Monitoramento Operacional e Auditoria Gmail
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Detalhes técnicos e registros de telemetria da integração com o Gmail.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTechnicalLogs(!showTechnicalLogs)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                >
                  {showTechnicalLogs ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showTechnicalLogs ? 'Ocultar logs técnicos do Gmail' : '👁️ Ver logs técnicos do Gmail'}</span>
                </button>
              </div>

              {showTechnicalLogs && (
                <div className="space-y-3 pt-2">
                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-[11px] space-y-2 max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[10px] text-slate-400">
                      <span>CONSOLE DE TELEMETRIA GMAIL</span>
                      <span>Total de eventos: {logs.length}</span>
                    </div>

                    {logs.length === 0 ? (
                      <div className="py-6 text-center text-slate-500">
                        Nenhum evento registrado nesta sessão de navegação.
                      </div>
                    ) : (
                      logs.map((lg, idx) => (
                        <div key={idx} className="border-b border-slate-800/60 pb-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">{new Date(lg.timestamp).toLocaleTimeString('pt-BR')}</span>
                            <span
                              className={`font-bold uppercase px-1.5 py-0.5 rounded text-[9px] ${
                                lg.level === 'success'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : lg.level === 'error'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                              }`}
                            >
                              {lg.stage}
                            </span>
                          </div>
                          <p className="text-slate-200">{lg.message}</p>
                          {lg.details && (
                            <pre className="text-[10px] text-slate-400 bg-slate-950/80 p-2 rounded overflow-x-auto">
                              {JSON.stringify(lg.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </FluxoStepLayout>
  );
}

