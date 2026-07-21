import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  extractClientOnboardingFields,
  buildOnboardingExecutionPlan,
  OnboardingStepPlan
} from './onboardingHelper';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Instagram,
  Facebook,
  Video,
  Mail,
  Info,
  CheckSquare,
  Sparkles,
  MessageSquare,
  Star,
  HelpCircle
} from 'lucide-react';

export default function OnboardingAuditoria() {
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
    statusFinal: '', // 'Onboarding completo ✅' | 'Onboarding bloqueado ❌' | 'Onboarding pendente ⚠️'
    aprovadoLiberacaoProducao: '', // 'sim' | 'nao'
    observacoesAuditoria: '',
    auditorResponsavel: ''
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
        const aud = cData.onboarding?.auditoria || {};
        setFormData({
          statusFinal: aud.statusFinal || 'Onboarding pendente ⚠️',
          aprovadoLiberacaoProducao: aud.aprovadoLiberacaoProducao || '',
          observacoesAuditoria: aud.observacoesAuditoria || '',
          auditorResponsavel: aud.auditorResponsavel || cData.operatorName || ''
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar auditoria de onboarding: ${err.message || err}`);
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

  // Build the dynamic execution plan to check for prior compliance
  const clientFields = extractClientOnboardingFields(client);
  const executionPlan = buildOnboardingExecutionPlan(clientFields, caseObj?.onboarding);

  // Filter out step 8 (this audit step itself) and check if all other 7 steps are compliant (either completed or dispensed)
  const priorSteps = executionPlan.filter(step => step.id < 8);
  const priorStepsApproved = priorSteps.every(
    step => step.status === 'completed' || step.status === 'dispensed_not_owned' || step.status === 'dispensed_no_channel'
  );

  const getStepIcon = (id: number) => {
    switch (id) {
      case 1: return <Smartphone size={16} />;
      case 2: return <MessageSquare size={16} />;
      case 3: return <Instagram size={16} />;
      case 4: return <Facebook size={16} />;
      case 5: return <Video size={16} />;
      case 6: return <Mail size={16} />;
      case 7: return <Star size={16} />;
      default: return <HelpCircle size={16} />;
    }
  };

  const getStepStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Em Conformidade ✅', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
      case 'dispensed_not_owned':
      case 'dispensed_no_channel':
        return { label: 'Dispensado ⚪', class: 'bg-gray-100 text-gray-500 border-gray-200' };
      case 'blocked_missing_data':
        return { label: 'Dados Incompletos ❌', class: 'bg-red-50 text-red-700 border-red-150' };
      case 'awaiting_human_confirmation':
        return { label: 'Pendente Homologação ⏳', class: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' };
      case 'available':
      default:
        return { label: 'Não Iniciado ⏳', class: 'bg-indigo-50/50 text-indigo-700 border-indigo-100' };
    }
  };

  const handleSave = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Strict validation: cannot complete onboarding if essential checks failed
    if (formData.statusFinal === 'Onboarding completo ✅' && !priorStepsApproved) {
      setError('Bloqueio de Auditoria: Não é possível definir o status como "Completo" pois existem subetapas pendentes ou não homologadas na esteira de onboarding.');
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const existingOnboarding = caseObj?.onboarding || {};
      
      const updatedOnboarding = {
        ...existingOnboarding,
        auditoria: {
          ...existingOnboarding.auditoria,
          ...formData,
          auditedAt: now
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 08 — Auditoria Final',
        action: 'Salvar Parecer de Auditoria',
        details: `Decisão: ${formData.statusFinal}. Liberado Produção: ${formData.aprovadoLiberacaoProducao === 'sim' ? 'Sim ✅' : 'Não ❌'}. Auditor: ${formData.auditorResponsavel || 'Não Definido'}`
      };

      const updatedLogs = [
        ...(caseObj?.onboardingSubetapaLogs || []),
        logEntry
      ];

      // Update case and move step forward if appropriate
      const updatePayload: any = {
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        updatedAt: now
      };

      // If approved, update standard field for step tracking
      if (formData.statusFinal === 'Onboarding completo ✅' && formData.aprovadoLiberacaoProducao === 'sim') {
        updatePayload.onboardingCompleted = true;
      }

      await updateDoc(doc(db, 'cases', caseId!), updatePayload);

      // Update local state
      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        onboardingCompleted: updatePayload.onboardingCompleted || prev.onboardingCompleted
      }));

      setSuccess('Auditoria de onboarding atualizada e homologada com absoluto sucesso!');
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de auditoria: ${err.message || err}`);
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
            Carregando Auditoria de Onboarding...
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
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 08 de 08</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-indigo-600 animate-pulse" size={24} />
              Auditoria de Integração do Onboarding
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Avalie e homologue a conclusão de todas as subetapas da esteira produtiva de onboarding antes de liberar o caso.
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

        {/* COMPLIANCE CHECKPOINT REPORT */}
        <div className="bg-slate-50 border border-gray-150 rounded-[2rem] p-6 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-500" />
            Relatório de Conformidade das Subetapas Anteriores
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {priorSteps.map((step) => {
              const statusStyle = getStepStatusStyle(step.status);
              const isOK = step.status === 'completed' || step.status === 'dispensed_not_owned' || step.status === 'dispensed_no_channel';

              return (
                <div key={step.id} className="bg-white p-4 border border-gray-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={isOK ? 'text-emerald-500' : 'text-amber-500'}>
                      {getStepIcon(step.id)}
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-gray-400 block">Subetapa 0{step.id}</span>
                      <span className="text-xs font-bold text-gray-800 line-clamp-1">{step.name.split(' — ')[1] || step.name}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${statusStyle.class}`}>
                    {statusStyle.label}
                  </span>
                </div>
              );
            })}
          </div>

          {!priorStepsApproved && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-900 text-xs flex gap-2.5 items-start">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block uppercase tracking-wider text-[10px] text-red-800 mb-1">Bloqueios de Conformidade Detectados</span>
                <p className="font-medium leading-relaxed">
                  Para homologar a aprovação definitiva do Onboarding, todas as subetapas precedentes na esteira de produção devem estar **Em Conformidade** ou marcadas como **Dispensadas**. Volte ao hub e conclua os checklist em falta.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* DECISION SHEET FORM */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <CheckSquare size={16} className="text-indigo-600" />
              Parecer Final de Homologação
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">
                Status Final do Onboarding
              </label>
              <select
                name="statusFinal"
                value={formData.statusFinal}
                onChange={handleChange}
                className="w-full h-11 border border-gray-150 rounded-xl px-3 text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all bg-white"
              >
                <option value="Onboarding pendente ⚠️">Onboarding pendente ⚠️</option>
                <option value="Onboarding completo ✅">Onboarding completo ✅</option>
                <option value="Onboarding bloqueado ❌">Onboarding bloqueado ❌</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">
                Auditor Responsável
              </label>
              <input
                type="text"
                name="auditorResponsavel"
                value={formData.auditorResponsavel}
                onChange={handleChange}
                placeholder="Nome do Auditor"
                className="w-full h-11 border border-gray-150 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
              Aprovar liberação definitiva do caso para a próxima etapa produtiva?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.aprovadoLiberacaoProducao === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="aprovadoLiberacaoProducao"
                  value="sim"
                  checked={formData.aprovadoLiberacaoProducao === 'sim'}
                  onChange={handleChange}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">Sim, liberado para produção ✅</span>
                  <span className="text-[10px] text-gray-400 font-medium">Pronto para início produtivo</span>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.aprovadoLiberacaoProducao === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="aprovadoLiberacaoProducao"
                  value="nao"
                  checked={formData.aprovadoLiberacaoProducao === 'nao'}
                  onChange={handleChange}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">Não, reter ou reavaliar ❌</span>
                  <span className="text-[10px] text-gray-400 font-medium">Bloqueado para análise</span>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
              Observações ou Justificativa da Auditoria
            </label>
            <textarea
              name="observacoesAuditoria"
              value={formData.observacoesAuditoria}
              onChange={handleChange}
              rows={4}
              placeholder="Descreva as razões da aprovação, ressalvas ou detalhe os bloqueios constatados..."
              className="w-full border border-gray-150 rounded-xl p-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          {/* ACTION BUTTON FOOTER */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 hover:bg-indigo-950 text-white font-black text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-50 h-[48px]"
            >
              {saving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Salvando Parecer...</span>
                </>
              ) : (
                <>
                  <Save size={12} />
                  <span>Registrar Parecer Auditoria</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
