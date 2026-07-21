import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
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
  Send
} from 'lucide-react';

export default function OnboardingWelcomeZap() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    whatsappBoasVindasEnviado: '', // 'sim' | 'nao'
    observacoes: ''
  });

  const [whatsappResult, setWhatsappResult] = useState<{
    success?: boolean;
    sentAt?: string;
    message?: string;
  } | null>(null);

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
        const onbWz = cData.onboarding?.welcomeZap || {};
        setFormData({
          whatsappBoasVindasEnviado: onbWz.whatsappBoasVindasEnviado || '',
          observacoes: onbWz.observacoes || ''
        });

        if (onbWz.status === 'completed' || onbWz.sentAt) {
          setWhatsappResult({
            success: true,
            sentAt: onbWz.sentAt,
            message: onbWz.messageText
          });
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

  const phoneInformed = getClientPhone();

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome'))
    : 'Buscando Cliente...';

  const getWelcomeMessageText = () => {
    return `Olá, ${resolvedClientName}.\n\nSeja muito bem-vindo(a) à Giffoni Advogados Associados!\n\nEste é o nosso canal oficial de comunicação. Por favor, salve este contato em sua agenda para garantir o recebimento de todas as atualizações sobre o seu caso.\n\nQualquer dúvida, estamos à inteira disposição!`;
  };

  // Real WhatsApp message dispatch via W.A Speed endpoint
  const handleSendWhatsApp = async () => {
    if (!phoneInformed) {
      setError('Operação impossível: O cliente não possui um número de telefone válido.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    const msgText = getWelcomeMessageText();

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
      const updatedRes = {
        success: true,
        sentAt: nowStr,
        message: msgText
      };

      setWhatsappResult(updatedRes);

      // Update Firestore state
      const existingOnboarding = caseObj?.onboarding || {};
      const updatedOnboarding = {
        ...existingOnboarding,
        welcomeZap: {
          status: 'completed',
          sentAt: nowStr,
          messageText: msgText,
          humanCertified: formData.whatsappBoasVindasEnviado === 'sim'
        }
      };

      const logEntry = {
        timestamp: nowStr,
        subetapa: 'Subetapa 02 — Welcome Zap',
        action: 'Enviar WhatsApp de Boas-vindas',
        details: `Mensagem enviada via W.A Speed com sucesso.`
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

      setSuccess('Mensagem de boas-vindas enviada com sucesso ao WhatsApp do cliente!');
    } catch (err: any) {
      console.error(err);
      setError(`Erro no envio de WhatsApp: ${err.message || err}`);
    } finally {
      setSending(false);
    }
  };

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();
      const existingOnboarding = caseObj?.onboarding || {};
      
      const updatedOnboarding = {
        ...existingOnboarding,
        welcomeZap: {
          ...(existingOnboarding.welcomeZap || {}),
          status: whatsappResult?.success ? 'completed' : 'pending',
          humanCertified: formData.whatsappBoasVindasEnviado === 'sim',
          whatsappBoasVindasEnviado: formData.whatsappBoasVindasEnviado,
          observacoes: formData.observacoes
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

      setSuccess('Dados de WhatsApp salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/add.cliente.no.instagram`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de WhatsApp: ${err.message || err}`);
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
            Carregando Boas-vindas WhatsApp...
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
      <div className="space-y-8 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 02 de 08</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="text-indigo-600" size={24} />
              Boas-vindas via W.A Speed (WhatsApp)
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Envie de forma programada a mensagem de boas-vindas do escritório usando a automação oficial W.A Speed.
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
            Detalhes de Envio
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">Cliente</span>
              <span className="text-xs font-bold text-gray-800 block mt-1">{resolvedClientName}</span>
            </div>

            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">WhatsApp de Destino</span>
              <span className="text-xs font-mono font-bold text-gray-800 block mt-1">
                {phoneInformed ? phoneInformed : <span className="text-red-500">Sem telefone cadastrado</span>}
              </span>
            </div>
          </div>
        </div>

        {/* W.A SPEED DISPATCH MODULE */}
        {phoneInformed && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
              <Send size={16} className="text-emerald-600" />
              Automação W.A Speed (Wascript)
            </h3>
            
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-800 block">Texto da Mensagem a ser Enviada:</span>
              <p className="text-xs text-gray-700 leading-relaxed font-semibold whitespace-pre-line bg-white p-3 border border-gray-100 rounded-lg">
                {getWelcomeMessageText()}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={sending}
                onClick={handleSendWhatsApp}
                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                {sending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Disparando Mensagem...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Disparar Mensagem via W.A Speed</span>
                  </>
                )}
              </button>
            </div>

            {whatsappResult && (
              <div className="bg-slate-50 border border-gray-150 rounded-xl p-4 space-y-2 mt-4 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 size={14} />
                  <span>Mensagem enviada e persistida no sistema!</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pt-1">
                  <div>• Status técnico: <strong className="text-gray-700 uppercase">SUCESSO</strong></div>
                  <div>• Data de envio: <strong className="text-gray-700">{new Date(whatsappResult.sentAt!).toLocaleString('pt-BR')}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPLIANCE FORM SHEET */}
        {phoneInformed && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckSquare size={16} className="text-indigo-600" />
                Certificação Humana
              </h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  Você enviou e conferiu se a mensagem de boas-vindas chegou corretamente? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.whatsappBoasVindasEnviado === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="whatsappBoasVindasEnviado"
                      value="sim"
                      checked={formData.whatsappBoasVindasEnviado === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, enviada e conferida ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">A mensagem chegou perfeitamente</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.whatsappBoasVindasEnviado === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="whatsappBoasVindasEnviado"
                      value="nao"
                      checked={formData.whatsappBoasVindasEnviado === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não ou não verifiquei ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Pendente de verificação fática</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                  Observações adicionais
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Se houver alguma observação, registre aqui..."
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
                disabled={saving || formData.whatsappBoasVindasEnviado !== 'sim'}
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
