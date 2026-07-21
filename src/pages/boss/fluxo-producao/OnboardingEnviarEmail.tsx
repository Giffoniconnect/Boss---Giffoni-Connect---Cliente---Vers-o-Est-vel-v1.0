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
  Mail,
  Info,
  CheckSquare,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function OnboardingEnviarEmail() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    emailBoasVindasEnviadoCliente: '', // 'sim' | 'nao'
    desejaEnviarAcessoPortalCliente: '', // 'sim' | 'nao'
    acessoPortalClienteAnalisado: '', // 'sim' | 'nao'
    observacoes: ''
  });

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
        const onbEm = cData.onboarding?.email || {};
        setFormData({
          emailBoasVindasEnviadoCliente: onbEm.emailBoasVindasEnviadoCliente || '',
          desejaEnviarAcessoPortalCliente: onbEm.desejaEnviarAcessoPortalCliente || '',
          acessoPortalClienteAnalisado: onbEm.acessoPortalClienteAnalisado || '',
          observacoes: onbEm.observacoes || ''
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados do e-mail de onboarding: ${err.message || err}`);
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

  const getClientEmail = () => {
    if (!client) return '';
    if (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true) {
      return client.pjDadosEmpresa?.pj_emailEmpresa || client.pjData?.pj_emailEmpresa || client.email || '';
    }
    return client.pfDadosPessoais?.pf_email || client.pfData?.pf_email || client.email || '';
  };

  const emailInformed = getClientEmail();

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Block onboarding if email is missing
    if (!emailInformed) {
      setError('Ação bloqueada: Não é possível concluir esta subetapa sem um e-mail cadastrado para o cliente.');
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const existingOnboarding = caseObj?.onboarding || {};
      
      const updatedOnboarding = {
        ...existingOnboarding,
        email: {
          ...formData,
          nomeCompletoCliente: resolvedClientName,
          emailInformed: emailInformed
        },
        auditoria: {
          ...(existingOnboarding.auditoria || {}),
          emailBoasVindasEnviadoCliente: formData.emailBoasVindasEnviadoCliente === 'sim',
          acessoPortalClienteAnalisado: formData.acessoPortalClienteAnalisado === 'sim'
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 05 — Enviar E-mail',
        action: 'Salvar Conferência E-mail',
        details: `E-mail Boas-vindas: ${formData.emailBoasVindasEnviadoCliente === 'sim' ? 'Sim ✅' : 'Não ❌'}. Análise de Acesso Portal: ${formData.acessoPortalClienteAnalisado === 'sim' ? 'Sim ✅' : 'Não ❌'}`
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

      // Update local state
      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs
      }));

      setSuccess('Dados de e-mail salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/avaliacard`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de e-mail: ${err.message || err}`);
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
            Carregando E-mail de Onboarding...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome'))
    : 'Buscando Cliente...';

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
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 05 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Mail className="text-indigo-600" size={24} />
              Enviar E-mail de Boas-vindas ao Cliente
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Envie e valide as orientações de integração do cliente por e-mail corporativo.
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
            Informações do Cadastro
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">Nome do Cliente</span>
              <span className="text-xs font-bold text-gray-800 block mt-1">{resolvedClientName}</span>
            </div>

            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">E-mail Cadastrado</span>
              <span className="text-xs font-mono font-bold text-gray-800 block mt-1">
                {emailInformed ? emailInformed : <span className="text-red-500 font-extrabold">NENHUM E-MAIL CADASTRADO (BLOQUEANTE ❌)</span>}
              </span>
            </div>
          </div>

          {!emailInformed && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-900 text-xs flex gap-2.5 items-start">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block uppercase tracking-wider text-[10px] text-red-800 mb-1">Atenção Operacional</span>
                <p className="font-medium leading-relaxed">
                  Não foi detectado um endereço de e-mail no cadastro deste cliente. Volte na Etapa 01 — Cadastro clicando no botão abaixo para adicionar antes de continuar.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const slugStr = client?.slug;
                    if (!slugStr) {
                      alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                      return;
                    }
                    navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-Painel-Geral-do-Cliente`);
                  }}
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <ExternalLink size={10} />
                  <span>Atualizar Cadastro do Cliente</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COMPLIANCE FORM SHEET */}
        {emailInformed && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckSquare size={16} className="text-indigo-600" />
                Checklist de Execução
              </h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  1. O e-mail oficial de acolhimento e boas-vindas foi disparado para o endereço do cliente?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.emailBoasVindasEnviadoCliente === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="emailBoasVindasEnviadoCliente"
                      value="sim"
                      checked={formData.emailBoasVindasEnviadoCliente === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, enviado ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">E-mail de boas-vindas disparado</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.emailBoasVindasEnviadoCliente === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="emailBoasVindasEnviadoCliente"
                      value="nao"
                      checked={formData.emailBoasVindasEnviadoCliente === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não enviado ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Envio do e-mail pendente</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  2. O cliente solicitou ou deseja receber as credenciais de acesso ao Portal do Cliente?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.desejaEnviarAcessoPortalCliente === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="desejaEnviarAcessoPortalCliente"
                      value="sim"
                      checked={formData.desejaEnviarAcessoPortalCliente === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, solicitou ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">Deseja receber convite do portal</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.desejaEnviarAcessoPortalCliente === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="desejaEnviarAcessoPortalCliente"
                      value="nao"
                      checked={formData.desejaEnviarAcessoPortalCliente === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não deseja / Não solicitado ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Não enviar ou login já configurado</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  3. A liberação e os termos de acesso do portal foram devidamente analisados e configurados?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.acessoPortalClienteAnalisado === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="acessoPortalClienteAnalisado"
                      value="sim"
                      checked={formData.acessoPortalClienteAnalisado === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, analisado ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">Acesso e visualizações conferidos</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.acessoPortalClienteAnalisado === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="acessoPortalClienteAnalisado"
                      value="nao"
                      checked={formData.acessoPortalClienteAnalisado === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não analisado ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Prazos e termos ainda pendentes</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                  Observações ou Notas de Acompanhamento
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Se houver alguma particularidade, registre aqui..."
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
                disabled={saving}
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
