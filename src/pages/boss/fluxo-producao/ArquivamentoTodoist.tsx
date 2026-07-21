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
  Calendar,
  Info,
  Terminal,
  FileText,
  CheckSquare,
  Sparkles
} from 'lucide-react';

export default function ArquivamentoTodoist() {
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
    casoArquivadoNoTodoist: '', // 'sim' | 'nao'
    todoistAtualizado: false,
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

        // Fetch client if available
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Initialize sub-step form data
        const archTod = cData.arquivamento?.todoist || {};
        setFormData({
          casoArquivadoNoTodoist: archTod.casoArquivadoNoTodoist || '',
          todoistAtualizado: archTod.todoistAtualizado || false,
          observacoes: archTod.observacoes || ''
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de arquivamento Todoist: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'casoArquivadoNoTodoist') {
        updated.todoistAtualizado = value === 'sim';
      }
      return updated;
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();
      const todoistAtualizado = formData.casoArquivadoNoTodoist === 'sim';

      const existingArquivamento = caseObj?.arquivamento || {};
      const updatedArquivamento = {
        ...existingArquivamento,
        todoist: {
          ...formData,
          todoistAtualizado
        },
        auditoria: {
          ...(existingArquivamento.auditoria || {}),
          todoistArquivado: todoistAtualizado,
          todoistAtualizado: true
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 02 — Arquivamento Todoist',
        action: 'Salvar Conferência Todoist',
        details: `Caso arquivado no Todoist: ${formData.casoArquivadoNoTodoist === 'sim' ? 'Sim ✅' : 'Não ❌'}. Atualizado: ${todoistAtualizado ? 'Sim ✅' : 'Não ❌'}`
      };

      const updatedLogs = [
        ...(caseObj?.arquivamentoSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        arquivamento: updatedArquivamento,
        arquivamentoSubetapaLogs: updatedLogs,
        updatedAt: now
      });

      // Update local state
      setCaseObj((prev: any) => ({
        ...prev,
        arquivamento: updatedArquivamento,
        arquivamentoSubetapaLogs: updatedLogs
      }));

      setSuccess('Dados de arquivamento Todoist salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.Gmail`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de arquivamento Todoist: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Arquivamento" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Arquivamento Todoist...
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
      stepName="Arquivamento"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em arquivamento'}
    >
      <div className="space-y-8 font-sans">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 02 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <CheckSquare className="text-indigo-600" size={24} />
              Arquivamento Todoist
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Assegure que todas as tarefas, subtarefas e prazos atrelados ao cliente foram concluídos ou devidamente arquivados na plataforma de gerenciamento.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer self-start"
          >
            <ArrowLeft size={14} />
            Voltar para o Hub
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-950 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* CLIENT QUICK INFO */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">CLIENTE ATRELADO</span>
            <span className="text-sm font-bold text-slate-900">{resolvedClientName}</span>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">STATUS INTEGRADO TODOIST</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                formData.casoArquivadoNoTodoist === 'sim'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-red-650 bg-red-50 border-red-100'
              }`}>
                {formData.casoArquivadoNoTodoist === 'sim' ? 'Arquivado no Todoist ✅' : 'Pendente de arquivamento ❌'}
              </span>
            </div>
          </div>
        </div>

        {/* INTEGRATION NOTIFICATION */}
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-950 text-xs flex gap-3 items-start">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Conexão Manual Necessária</span>
            <p className="text-amber-900 font-medium">
              Integração real com Todoist ainda não configurada. Atualização manual necessária.
            </p>
          </div>
        </div>

        {/* FORM PANEL */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Caso foi arquivado no Todoist? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.casoArquivadoNoTodoist === 'sim'
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Sim ✅</span>
                    <input
                      type="radio"
                      name="casoArquivadoNoTodoist"
                      value="sim"
                      checked={formData.casoArquivadoNoTodoist === 'sim'}
                      onChange={handleChange}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                    />
                  </label>

                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.casoArquivadoNoTodoist === 'nao'
                      ? 'border-red-500 bg-red-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Não ❌</span>
                    <input
                      type="radio"
                      name="casoArquivadoNoTodoist"
                      value="nao"
                      checked={formData.casoArquivadoNoTodoist === 'nao'}
                      onChange={handleChange}
                      className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                  </label>
                </div>
              </div>

              {/* CHECKLIST */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Checklist Interno
                </span>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="todoistAtualizado"
                    checked={formData.todoistAtualizado}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs font-semibold text-gray-800">
                    Todoist atualizado? {formData.todoistAtualizado ? 'Sim ✅' : 'Não ❌'}
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <FileText size={14} className="text-gray-400" />
                  Observações sobre o Arquivamento no Todoist
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Registre códigos das tarefas concluídas ou observações de pendências de prazos no Todoist..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-150"
                />
              </div>

              {/* AUTOMATION PREPARATION CORNER */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <span className="text-[11px] font-bold text-indigo-900">Futura Automação</span>
                </div>
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md tracking-wider">
                  Pensar em automatizar
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* LOG TECNICO COMPONENTE */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Terminal size={16} />
            <span className="text-xs font-black uppercase text-slate-300 font-mono tracking-wider">
              Automação & Logs de Audit
            </span>
          </div>
          <p className="text-[11px] font-mono leading-relaxed text-slate-400">
            [TODOIST_AUTOMATION] Aguardando integração ativa da API Todoist. Status: <span className="text-amber-400">QUEUED_FOR_PREP</span>
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Hub
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving || !formData.casoArquivadoNoTodoist}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Gravando...' : 'Salvar Rascunho'}
            </button>

            <button
              type="button"
              disabled={saving || !formData.casoArquivadoNoTodoist}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span>Salvar e Avançar</span>
              <Loader2 className={saving ? 'animate-spin' : 'hidden'} size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
