import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Star,
  Info,
  CheckSquare,
  ArrowRight,
  Send,
  Mail,
  MessageSquare
} from 'lucide-react';

export default function OnboardingAvaliacard() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingZap, setSendingZap] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    solicitacaoConfirmada: '', // 'sim' | 'nao'
    observacoes: ''
  });

  const [zapResult, setZapResult] = useState<{ success?: boolean; sentAt?: string } | null>(null);
  const [emailResult, setEmailResult] = useState<{ success?: boolean; sentAt?: string } | null>(null);

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

        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Initialize sub-step form data
        const onbAc = cData.onboarding?.avaliacard || {};
        setFormData({
          solicitacaoConfirmada: onbAc.solicitacaoConfirmada || '',
          observacoes: onbAc.observacoes || ''
        });

        if (onbAc.zapSentAt) {
          setZapResult({ success: true, sentAt: onbAc.zapSentAt });
        }
        if (onbAc.emailSentAt) {
          setEmailResult({ success: true, sentAt: onbAc.emailSentAt });
        }

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados do AvaliaCard: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getClientPhone = () => {
    if (!client) return '';
    if (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true) {
      return client.pjDadosEmpresa?.pj_telefoneEmpresa || client.pjData?.pj_telefoneEmpresa || client.pjDadosEmpresa?.pj_telefoneRepresentante || client.pjData?.pj_telefoneRepresentante || client.phone || '';
    }
    return client.pfDadosPessoais?.pf_telefoneCelular || client.pfData?.pf_telefoneCelular || client.phone || '';
  };

  const getClientEmail = () => {
    if (!client) return '';
    if (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true) {
      return client.pjDadosEmpresa?.pj_emailEmpresa || client.pjData?.pj_emailEmpresa || client.email || '';
    }
    return client.pfDadosPessoais?.pf_email || client.pfData?.pf_email || client.email || '';
  };

  const phoneInformed = getClientPhone();
  const emailInformed = getClientEmail();

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome'))
    : 'Buscando Cliente...';

  const getGoogleReviewUrl = () => {
    return "https://g.page/giffoni-advogados/review";
  };

  const getZapMessageText = () => {
    return `Olá, ${resolvedClientName}! Ficamos extremamente felizes em lhe atender.\n\nSeu feedback é muito importante para nós. Se puder dedicar 1 minutinho, avalie nosso atendimento no Google pelo link oficial do escritório:\n\n${getGoogleReviewUrl()}\n\nMuito obrigado pela confiança!`;
  };

  const getEmailSubject = () => {
    return "Sua opinião é muito importante para nós! — Giffoni Advogados";
  };

  const getEmailBodyText = () => {
    return `Prezado(a) ${resolvedClientName},\n\nAgradecemos imensamente a confiança em nossos serviços jurídicos. Nossa maior missão é prestar um atendimento de excelência com agilidade e ética.\n\nSe puder dedicar um minutinho do seu tempo, ficaremos honrados em receber sua avaliação no Google:\n\n👉 Clique para avaliar: ${getGoogleReviewUrl()}\n\nSua opinião nos ajuda a evoluir diariamente.\n\nAtenciosamente,\nGiffoni Advogados Associados.`;
  };

  // Dispatch Google Review link via W.A Speed
  const handleSendWhatsApp = async () => {
    if (!phoneInformed) {
      setError('Operação impossível: O cliente não possui um número de telefone válido.');
      return;
    }

    setSendingZap(true);
    setError(null);
    setSuccess(null);

    const msgText = getZapMessageText();

    try {
      const response = await fetch('/api/whatsapp/test-send-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phoneInformed,
          message: msgText
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.errorMessage || 'Falha ao enviar mensagem via W.A Speed.');
      }

      const nowStr = new Date().toISOString();
      setZapResult({ success: true, sentAt: nowStr });

      // Save to Firestore
      const existingOnboarding = caseObj?.onboarding || {};
      const updatedOnboarding = {
        ...existingOnboarding,
        avaliacard: {
          ...existingOnboarding.avaliacard,
          status: 'completed',
          zapSentAt: nowStr,
          humanCertified: formData.solicitacaoConfirmada === 'sim'
        }
      };

      const logEntry = {
        timestamp: nowStr,
        subetapa: 'Subetapa 07 — AvaliaCard',
        action: 'Disparar Avaliação via WhatsApp',
        details: `Solicitação de Google Review enviada via WhatsApp (W.A Speed).`
      };

      const updatedLogs = [
        ...(caseObj?.onboardingSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        updatedAt: nowStr
      });

      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs
      }));

      setSuccess('Solicitação de avaliação enviada com sucesso ao WhatsApp do cliente!');
    } catch (err: any) {
      console.error(err);
      setError(`Erro no envio de WhatsApp: ${err.message || err}`);
    } finally {
      setSendingZap(false);
    }
  };

  // Dispatch Google Review link via Gmail
  const handleSendEmail = async () => {
    if (!emailInformed) {
      setError('Operação impossível: O cliente não possui um e-mail válido cadastrado.');
      return;
    }

    const resolvedToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    
    setSendingEmail(true);
    setError(null);
    setSuccess(null);

    const subject = getEmailSubject();
    const body = getEmailBodyText();

    try {
      const response = await fetch('/api/onboarding/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: emailInformed,
          subject,
          body,
          googleAccessToken: resolvedToken
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.errorMessage || 'Falha ao enviar e-mail via Gmail.');
      }

      const nowStr = new Date().toISOString();
      setEmailResult({ success: true, sentAt: nowStr });

      // Save to Firestore
      const existingOnboarding = caseObj?.onboarding || {};
      const updatedOnboarding = {
        ...existingOnboarding,
        avaliacard: {
          ...existingOnboarding.avaliacard,
          status: 'completed',
          emailSentAt: nowStr,
          humanCertified: formData.solicitacaoConfirmada === 'sim'
        }
      };

      const logEntry = {
        timestamp: nowStr,
        subetapa: 'Subetapa 07 — AvaliaCard',
        action: 'Disparar Avaliação via E-mail',
        details: `Solicitação de Google Review enviada via Gmail.`
      };

      const updatedLogs = [
        ...(caseObj?.onboardingSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        updatedAt: nowStr
      });

      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs
      }));

      setSuccess('E-mail de solicitação de avaliação enviado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError(`Erro no envio de E-mail: ${err.message || err}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const hasDoneAnySend = zapResult?.success || emailResult?.success;

    // Check strict transition constraints
    if (formData.solicitacaoConfirmada === 'sim' && !hasDoneAnySend) {
      setError('Bloqueio operacional: Você deve realizar o disparo técnico via pelo menos um dos canais oficiais (WhatsApp ou E-mail) antes de homologar a conclusão humana.');
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const existingOnboarding = caseObj?.onboarding || {};
      
      const updatedOnboarding = {
        ...existingOnboarding,
        avaliacard: {
          ...existingOnboarding.avaliacard,
          status: hasDoneAnySend ? 'completed' : 'pending',
          humanCertified: formData.solicitacaoConfirmada === 'sim',
          solicitacaoConfirmada: formData.solicitacaoConfirmada,
          observacoes: formData.observacoes
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 07 — AvaliaCard',
        action: 'Salvar Certificação Humana',
        details: `Certificação: ${formData.solicitacaoConfirmada === 'sim' ? 'Sim ✅' : 'Não ❌'}`
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

      setSuccess('Dados do AvaliaCard salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/auditoria.onboarding.cliente`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados do AvaliaCard: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Onboarding" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando AvaliaCard...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const hasNoChannels = !phoneInformed && !emailInformed;

  return (
    <FluxoStepLayout
      stepName="Onboarding"
      caseId={caseId}
      statusText={caseObj?.onboarding?.auditoria?.statusFinal || 'Em onboarding'}
    >
      <div className="space-y-8 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 07 de 08</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Star className="text-indigo-600 animate-pulse" size={24} />
              AvaliaCard — Solicitação de Avaliação no Google
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Aumente a relevância digital do escritório enviando a ficha de feedback e avaliação oficial do Google Review.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/onboarding`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 rounded-xl text-xs font-bold cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Hub</span>
          </button>
        </div>

        {/* FEEDBACK BLOCKS */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* CONTEXT DATA HIGHLIGHT */}
        <div className="bg-slate-50 border border-gray-150 rounded-[2rem] p-6 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
            <Info size={14} className="text-slate-500" />
            Canais de Comunicação Cadastrados
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">Número WhatsApp</span>
              <span className="text-xs font-mono font-bold text-gray-800 block mt-1">
                {phoneInformed ? phoneInformed : <span className="text-red-500">Inexistente / Não Possuo ❌</span>}
              </span>
            </div>

            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">E-mail Cadastrado</span>
              <span className="text-xs font-mono font-bold text-gray-800 block mt-1">
                {emailInformed ? emailInformed : <span className="text-red-500">Inexistente / Não Possuo ❌</span>}
              </span>
            </div>
          </div>

          {hasNoChannels && (
            <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-900 text-xs flex gap-2.5 items-start">
              <Star size={16} className="text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block uppercase tracking-wider text-[10px] text-indigo-800 mb-1">Subetapa Dispensada</span>
                <p className="font-medium leading-relaxed">
                  Este cliente não possui canais cadastrados (telefone e e-mail formalmente ausentes). Esta subetapa será dispensada no plano de execução geral.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* DISPATCH METHODS SHEET */}
        {!hasNoChannels && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
            <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <Send size={16} className="text-indigo-600" />
              Canais Disponíveis para Envio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* WhatsApp Module */}
              {phoneInformed && (
                <div className="border border-gray-150 rounded-2xl p-5 space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <MessageSquare size={10} />
                    WhatsApp
                  </span>
                  
                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-100 text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">
                    <span className="font-black uppercase text-gray-400 block text-[9px] mb-1">Pré-visualização:</span>
                    {getZapMessageText()}
                  </div>

                  <button
                    type="button"
                    disabled={sendingZap}
                    onClick={handleSendWhatsApp}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
                  >
                    {sendingZap ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        <span>Disparar via WhatsApp (W.A Speed)</span>
                      </>
                    )}
                  </button>

                  {zapResult && (
                    <div className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>Mensagem enviada em {new Date(zapResult.sentAt!).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Email Module */}
              {emailInformed && (
                <div className="border border-gray-150 rounded-2xl p-5 space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Mail size={10} />
                    E-mail
                  </span>

                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-100 text-[11px] text-gray-600 leading-relaxed">
                    <span className="font-black uppercase text-gray-400 block text-[9px] mb-1">Pré-visualização:</span>
                    <strong className="block text-gray-800 text-xs mb-1">Assunto: {getEmailSubject()}</strong>
                    <p className="whitespace-pre-line text-[11px] font-medium mt-1">{getEmailBodyText()}</p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 items-center">
                    <button
                      type="button"
                      disabled={sendingEmail}
                      onClick={handleSendEmail}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Enviando E-mail...</span>
                        </>
                      ) : (
                        <>
                          <Mail size={12} />
                          <span>Disparar via E-mail (Gmail)</span>
                        </>
                      )}
                    </button>

                    {!googleAccessToken && (
                      <button
                        type="button"
                        onClick={() => loginWithGoogle('boss_admin')}
                        className="inline-flex items-center gap-1 px-3 py-2 border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Logar Gmail
                      </button>
                    )}
                  </div>

                  {emailResult && (
                    <div className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>E-mail enviado em {new Date(emailResult.sentAt!).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMPLIANCE CERTIFICATION checklist */}
        {!hasNoChannels && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckSquare size={16} className="text-indigo-600" />
                Checklist e Liberação Humana
              </h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  Você certificou e confirmou o disparo fático da solicitação de avaliação? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.solicitacaoConfirmada === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="solicitacaoConfirmada"
                      value="sim"
                      checked={formData.solicitacaoConfirmada === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, disparado e verificado ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">Link de Google Review enviado</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.solicitacaoConfirmada === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="solicitacaoConfirmada"
                      value="nao"
                      checked={formData.solicitacaoConfirmada === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não ou pendente ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Ainda sem disparo verificado</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                  Notas operacionais
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Registre qualquer nota relevante sobre a solicitação..."
                  className="w-full border border-gray-150 rounded-xl p-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* ACTION FOOTER BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 pt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-black text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-50 w-full sm:w-auto h-[48px]"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                <span>Salvar Progresso</span>
              </button>

              <button
                type="button"
                disabled={saving || formData.solicitacaoConfirmada !== 'sim'}
                onClick={() => handleSave(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-50 shadow-3xs hover:shadow-2xs w-full sm:w-auto h-[48px]"
              >
                <span>Salvar e Avançar</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
