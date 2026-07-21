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
  Instagram,
  Info,
  CheckSquare,
  ArrowRight
} from 'lucide-react';

export default function OnboardingAddInstagram() {
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
    clienteAdicionadoInstagram: '', // 'sim' | 'nao'
    naoAplicavel: false,
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

        let clientData = null;
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            clientData = clientSnap.data();
            setClient(clientData);
          }
        }

        // Initialize sub-step form data
        const onbInst = cData.onboarding?.instagram || {};
        
        // Extract Instagram username from client record to see if it's missing or marked "Não possuo"
        const getInstagramFromClient = (c: any) => {
          if (!c) return '';
          if (c.type === 'PJ' || c.tipoPessoa === 'PJ' || c.isCompany === true) {
            return c.pjDadosEmpresa?.pj_instagramEmpresa || c.pjData?.pj_instagramEmpresa || c.pj_instagramEmpresa || '';
          }
          return c.pfDadosPessoais?.pf_instagram || c.pfData?.pf_instagram || c.pf_instagram || '';
        };

        const clientInst = getInstagramFromClient(clientData);
        const isEmptyOrNoPossuo = !clientInst || clientInst === 'Não possuo' || clientInst.trim() === '';

        setFormData({
          clienteAdicionadoInstagram: onbInst.clienteAdicionadoInstagram || (isEmptyOrNoPossuo ? 'nao' : ''),
          naoAplicavel: onbInst.naoAplicavel !== undefined ? onbInst.naoAplicavel : isEmptyOrNoPossuo,
          observacoes: onbInst.observacoes || ''
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados do Instagram: ${err.message || err}`);
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: checked };
      if (name === 'naoAplicavel' && checked) {
        updated.clienteAdicionadoInstagram = 'nao';
      }
      return updated;
    });
  };

  const getClientInstagram = () => {
    if (!client) return '';
    if (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true) {
      return client.pjDadosEmpresa?.pj_instagramEmpresa || client.pjData?.pj_instagramEmpresa || client.pj_instagramEmpresa || '';
    }
    return client.pfDadosPessoais?.pf_instagram || client.pfData?.pf_instagram || client.pf_instagram || '';
  };

  const instagramInformed = getClientInstagram();

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
        instagram: {
          ...formData,
          nomeCompletoCliente: resolvedClientName,
          instagramInformed: instagramInformed
        },
        auditoria: {
          ...(existingOnboarding.auditoria || {}),
          clienteAdicionadoInstagram: formData.naoAplicavel ? false : formData.clienteAdicionadoInstagram === 'sim'
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 02 — Instagram',
        action: 'Salvar Conexão Instagram',
        details: formData.naoAplicavel 
          ? 'Instagram marcado como Não se aplica (Não informado ou não possui).' 
          : `Instagram Adicionado: ${formData.clienteAdicionadoInstagram === 'sim' ? 'Sim ✅' : 'Não ❌'}`
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

      setSuccess('Dados de Instagram salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/add.cliente.no.facebook`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de Instagram: ${err.message || err}`);
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
            Carregando Instagram de Onboarding...
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

  const hasInstagram = instagramInformed && instagramInformed !== 'Não possuo' && instagramInformed.trim() !== '';

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
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 02 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Instagram className="text-indigo-600" size={24} />
              Adicionar Cliente no Instagram
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Conecte-se com o perfil do cliente no Instagram do escritório para fortalecer o relacionamento.
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
              <span className="text-[10px] font-black uppercase text-gray-400 block">Instagram Cadastrado</span>
              <span className="text-xs font-mono font-bold text-gray-800 block mt-1">
                {hasInstagram ? (
                  <a
                    href={`https://instagram.com/${instagramInformed.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-1.5"
                  >
                    <span>{instagramInformed}</span>
                  </a>
                ) : (
                  <span className="text-gray-400 italic">Não Informado (Não bloqueante)</span>
                )}
              </span>
            </div>
          </div>

          {!hasInstagram && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 text-xs flex gap-2.5 items-start">
              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block uppercase tracking-wider text-[10px] text-amber-800 mb-1">Nota de Flexibilidade</span>
                <p className="font-medium leading-relaxed">
                  Este cliente não possui um nome de usuário do Instagram cadastrado ou informou não possuir. O sistema ativou a opção "Não se aplica" para que esta etapa seja ignorada de forma segura na auditoria final, evitando bloqueios desnecessários.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* COMPLIANCE FORM SHEET */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <CheckSquare size={16} className="text-indigo-600" />
              Checklist de Execução
            </h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2.5 bg-slate-50 p-4 rounded-xl border border-gray-100 max-w-md">
              <input
                type="checkbox"
                id="naoAplicavel"
                name="naoAplicavel"
                checked={formData.naoAplicavel}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="naoAplicavel" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                Não se aplica (Cliente não possui ou não informou Instagram)
              </label>
            </div>

            {!formData.naoAplicavel && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  O cliente foi adicionado e seguido no Instagram oficial do escritório?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.clienteAdicionadoInstagram === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="clienteAdicionadoInstagram"
                      value="sim"
                      checked={formData.clienteAdicionadoInstagram === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, adicionado ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">Cliente seguido e registrado</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.clienteAdicionadoInstagram === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="clienteAdicionadoInstagram"
                      value="nao"
                      checked={formData.clienteAdicionadoInstagram === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não adicionado ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Conexão social pendente</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

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

      </div>
    </FluxoStepLayout>
  );
}
