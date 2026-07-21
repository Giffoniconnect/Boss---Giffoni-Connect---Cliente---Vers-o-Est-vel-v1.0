import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Sparkles,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Loader2,
  FileCheck2,
  BrainCircuit,
  FileText,
  History,
  AlertTriangle,
  FileCode,
  ShieldCheck
} from 'lucide-react';

interface PreRevisaoIaData {
  desejaAcionar: 'sim' | 'nao' | '';
  input: string;
  status: 'nao_iniciada' | 'em_analise' | 'concluida' | 'erro_tecnico';
  errorMsg: string;
  result: {
    acertos: string[];
    erros: string[];
    sugestoes: string[];
  } | null;
}

const DEFAULT_PRE_REVISAO: PreRevisaoIaData = {
  desejaAcionar: '',
  input: '',
  status: 'nao_iniciada',
  errorMsg: '',
  result: null
};

export default function PreRevisaoIA() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [runningIa, setRunningIa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [preRevisao, setPreRevisao] = useState<PreRevisaoIaData>(DEFAULT_PRE_REVISAO);

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

        // Retrieve preRevisaoIa from case document
        const rawPreRevisao = cData.preRevisaoIa || {};
        setPreRevisao({
          desejaAcionar: rawPreRevisao.desejaAcionar || '',
          input: rawPreRevisao.input || '',
          status: rawPreRevisao.status || 'nao_iniciada',
          errorMsg: rawPreRevisao.errorMsg || '',
          result: rawPreRevisao.result || null
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de pré-revisão: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleAcionarChange = async (option: 'sim' | 'nao') => {
    const updated = {
      ...preRevisao,
      desejaAcionar: option
    };
    setPreRevisao(updated);
    await savePreRevisaoState(updated, true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPreRevisao(prev => ({
      ...prev,
      input: e.target.value
    }));
  };

  const savePreRevisaoState = async (data: PreRevisaoIaData, silent = false) => {
    if (!caseId) return;
    if (!silent) setSaving(true);
    if (!silent) setSuccess(null);
    setError(null);

    try {
      const now = new Date().toISOString();
      const payload = {
        preRevisaoIa: data,
        updatedAt: now,
        revisaoSubetapaLogs: [
          ...(caseObj?.revisaoSubetapaLogs || []),
          {
            timestamp: now,
            action: 'Salvar Pré-Revisão IA',
            subetapa: 'Subetapa 02 — Pré-Revisão com auxílio de IA',
            details: `Deseja acionar: ${data.desejaAcionar}, Status: ${data.status}`
          }
        ]
      };

      await updateDoc(doc(db, 'cases', caseId!), payload);
      setCaseObj((prev: any) => ({
        ...prev,
        preRevisaoIa: data,
        revisaoSubetapaLogs: payload.revisaoSubetapaLogs
      }));

      if (!silent) {
        setSuccess('Configurações de Pré-Revisão salvas com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar configurações de pré-revisão: ${err.message}`);
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleTriggerIA = async () => {
    if (!caseId) return;
    setRunningIa(true);
    setError(null);
    setSuccess(null);

    const emAnaliseState: PreRevisaoIaData = {
      ...preRevisao,
      status: 'em_analise',
      errorMsg: '',
      result: null
    };
    setPreRevisao(emAnaliseState);
    await savePreRevisaoState(emAnaliseState, true);

    try {
      const resolvedClientName = client
        ? (client.type === 'PF'
            ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome')
            : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente'))
        : 'Desconhecido';

      const caseDetails = {
        caseId,
        clientName: resolvedClientName,
        registrationType: caseObj?.registrationType || 'Não informado',
        basesFaticas: caseObj?.basesFaticas || 'Não informado',
        entrevistaPadrao: caseObj?.entrevistaPadrao || 'Não informado',
        strategy: caseObj?.edrp?.structuring?.strategy || 'Não informado',
        observacoesAdicionaisOperador: preRevisao.input
      };

      const res = await fetch('/api/gemini-revisao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ caseDetails })
      });

      const data = await res.json();

      if (!res.ok) {
        // If error is key missing or technical
        const errorMsg = data.message || "Erro de conexão ao motor cognitivo Gemini.";
        const erroState: PreRevisaoIaData = {
          ...preRevisao,
          status: 'erro_tecnico',
          errorMsg,
          result: null
        };
        setPreRevisao(erroState);
        await savePreRevisaoState(erroState, true);
        setError(errorMsg);
        return;
      }

      // Successful analysis!
      const concluidaState: PreRevisaoIaData = {
        ...preRevisao,
        status: 'concluida',
        errorMsg: '',
        result: {
          acertos: data.acertos || [],
          erros: data.erros || [],
          sugestoes: data.sugestoes || []
        }
      };
      setPreRevisao(concluidaState);
      await savePreRevisaoState(concluidaState, true);
      setSuccess("Análise com Gemini IA realizada com sucesso!");

    } catch (err: any) {
      console.error(err);
      const erroState: PreRevisaoIaData = {
        ...preRevisao,
        status: 'erro_tecnico',
        errorMsg: err.message || "Erro técnico ao tentar processar com IA.",
        result: null
      };
      setPreRevisao(erroState);
      await savePreRevisaoState(erroState, true);
      setError(err.message || "Falha técnica na pré-revisão cognitiva.");
    } finally {
      setRunningIa(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Revisão" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Pré-Revisão com IA...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PF'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome')
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente'))
    : 'Buscando Cliente...';

  // Extract documents uploaded in digitalizacao-upload for reference
  const docFiles = caseObj?.wizardState?.files || [];

  return (
    <FluxoStepLayout
      stepName="Revisão"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Aguardando revisão'}
    >
      <div className="space-y-8 font-sans">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <BrainCircuit className="text-indigo-600" size={24} />
              Pré-Revisão com auxílio de IA
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Subetapa 02 — Análise preliminar com Gemini IA
            </p>
          </div>
          <button
            type="button"
            id="back-to-hub-btn"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/revisao`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer self-start"
          >
            <ArrowLeft size={14} />
            Voltar para Painel de Revisão
          </button>
        </div>

        {/* Info banners */}
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

        {/* CARD 01 — ACIONAMENTO DA PRÉ-REVISÃO COM IA */}
        <div id="decision-ia-card" className="border border-gray-150 rounded-3xl p-6 bg-white space-y-4 shadow-xs">
          <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight flex items-center gap-2">
            <HelpCircle size={18} className="text-indigo-500" />
            Deseja acionar o sistema de Pré-Revisão com Gemini IA?
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-medium">
            O assistente cognitivo analisará as bases fáticas, a entrevista padrão do cliente e as estratégias jurídicas lançadas para prever pontos fortes, preclusões ou ausências materiais.
          </p>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              id="ia-yes-btn"
              onClick={() => handleAcionarChange('sim')}
              className={`flex-1 py-3.5 px-5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                preRevisao.desejaAcionar === 'sim'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <CheckCircle2 size={16} />
              Sim
            </button>
            <button
              type="button"
              id="ia-no-btn"
              onClick={() => handleAcionarChange('nao')}
              className={`flex-1 py-3.5 px-5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                preRevisao.desejaAcionar === 'nao'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <XCircle size={16} />
              Não
            </button>
          </div>

          {preRevisao.desejaAcionar === 'nao' && (
            <div className="p-4 bg-slate-50 border border-gray-150 rounded-2xl text-xs text-gray-500 text-center font-semibold mt-3 animate-fade-in">
              Pré-Revisão com IA não acionada para este caso.
            </div>
          )}
        </div>

        {/* CARD 02 — SISTEMA DE PRÉ-REVISÃO COM IA */}
        {preRevisao.desejaAcionar === 'sim' && (
          <div id="trigger-ia-card" className="border border-gray-150 rounded-3xl p-6 bg-slate-50/50 space-y-6 animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-gray-150 pb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <BrainCircuit size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-950 uppercase tracking-tight">Sistema de Pré-Revisão com IA</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Configure e acione o motor de auditoria preliminar.</p>
              </div>
            </div>

            {/* STATUS ROW */}
            <div className="flex items-center justify-between p-4 bg-white border border-gray-150 rounded-2xl">
              <span className="text-xs font-bold text-gray-700">Status da Análise:</span>
              <div className="flex items-center gap-2">
                {preRevisao.status === 'em_analise' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">
                    <Loader2 className="animate-spin" size={14} />
                    Em análise...
                  </span>
                )}
                {preRevisao.status === 'concluida' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">
                    <CheckCircle2 size={14} />
                    Concluída
                  </span>
                )}
                {preRevisao.status === 'erro_tecnico' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-xl">
                    <AlertTriangle size={14} />
                    Erro técnico
                  </span>
                )}
                {preRevisao.status === 'nao_iniciada' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-gray-600 bg-gray-100 px-3 py-1 rounded-xl">
                    Não iniciada
                  </span>
                )}
              </div>
            </div>

            {/* ERROR HANDLING PANEL */}
            {preRevisao.status === 'erro_tecnico' && preRevisao.errorMsg.includes("não configurada") && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex gap-3.5 items-start">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold uppercase tracking-wide text-amber-950 block text-[10px]">Integração Pendente</span>
                  <p className="font-semibold leading-relaxed">
                    Integração real com Gemini IA ainda não configurada.
                  </p>
                </div>
              </div>
            )}

            {preRevisao.status === 'erro_tecnico' && !preRevisao.errorMsg.includes("não configurada") && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-900 text-xs flex gap-3.5 items-start">
                <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold uppercase tracking-wide text-rose-950 block text-[10px]">Erro Técnico Gemini</span>
                  <p className="font-semibold leading-relaxed">
                    {preRevisao.errorMsg}
                  </p>
                </div>
              </div>
            )}

            {/* CASE DETAILS TO REVIEW */}
            <div className="space-y-2.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Dados Básicos que serão fornecidos ao Gemini</label>
              <div className="bg-white p-4 rounded-2xl border border-gray-150 text-xs text-gray-600 space-y-2 max-h-40 overflow-y-auto">
                <p><strong>• Cliente:</strong> {resolvedClientName}</p>
                <p><strong>• Tipo de Demanda:</strong> {caseObj?.registrationType || 'Não Definido'}</p>
                <p><strong>• Bases Fáticas:</strong> {caseObj?.basesFaticas || 'Nenhuma base fática lançada.'}</p>
                <p><strong>• Entrevista Padrão:</strong> {caseObj?.entrevistaPadrao || 'Nenhuma entrevista preenchida.'}</p>
                <p><strong>• Estratégia EDRP:</strong> {caseObj?.edrp?.structuring?.strategy || 'Nenhuma estratégia cadastrada.'}</p>
              </div>
            </div>

            {/* INPUT AREA FOR SPECIFIC DETAILS */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Fatos ou Detalhes adicionais para análise (Opcional)</label>
              <textarea
                value={preRevisao.input}
                onChange={handleInputChange}
                placeholder="Insira observações adicionais que deseja que o assistente cognitivo considere no momento da auditoria técnica..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-gray-800 transition-all font-medium min-h-[80px]"
              />
            </div>

            {/* ATTACHED DOCUMENTS FOR REFERENCE */}
            <div className="space-y-2">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Documentos em Juntada para Referência</label>
              {docFiles.length === 0 ? (
                <div className="p-4 bg-white border border-gray-150 rounded-2xl text-center text-xs text-gray-400 font-medium">
                  Nenhum documento digitalizado atrelado ao caso.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {docFiles.map((f: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white border border-gray-150 rounded-xl flex items-center gap-2 text-xs">
                      <FileText size={16} className="text-indigo-500 shrink-0" />
                      <div className="truncate text-gray-700 font-semibold" title={f.name}>
                        {f.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTION TRIGGER BUTTON */}
            <button
              type="button"
              id="trigger-ia-btn"
              disabled={runningIa}
              onClick={handleTriggerIA}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-extrabold text-xs py-3 px-5 rounded-xl shadow-sm transition-all cursor-pointer uppercase tracking-wide"
            >
              {runningIa ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Analisando Caso com Gemini...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Acionar Inteligência Artificial (Gemini)
                </>
              )}
            </button>
          </div>
        )}

        {/* CARD 03 — RESULTADO DA ANÁLISE DA PRÉ-REVISÃO COM IA */}
        {preRevisao.desejaAcionar === 'sim' && (
          <div id="result-ia-card" className="border border-gray-150 rounded-3xl p-6 bg-white space-y-6 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-gray-150 pb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileCheck2 size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-950 uppercase tracking-tight">Resultado da Análise da Pré-Revisão com IA</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Visualização detalhada das constatações da IA cognitiva.</p>
              </div>
            </div>

            {!preRevisao.result ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-xs flex flex-col items-center justify-center gap-2 font-medium">
                <HelpCircle className="text-gray-300" size={24} />
                <p>Nenhum resultado de Pré-Revisão com IA disponível.</p>
                <p className="text-[11px] text-gray-400 font-normal">Acione o botão cognitivo acima para iniciar a varredura automatizada.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* ACERTOS IDENTIFICADOS */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-black uppercase text-emerald-800 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                    Acertos identificados ✅
                  </h4>
                  {preRevisao.result.acertos.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-3">Nenhum acerto listado de forma expressa.</p>
                  ) : (
                    <ul className="list-disc pl-6 text-xs text-gray-600 space-y-1.5 font-semibold">
                      {preRevisao.result.acertos.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ERROS IDENTIFICADOS */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-black uppercase text-rose-800 bg-rose-50/50 px-3 py-1.5 rounded-lg border border-rose-100 flex items-center gap-1.5">
                    Erros identificados ❌
                  </h4>
                  {preRevisao.result.erros.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-3">Nenhuma inconsistência relevante detectada.</p>
                  ) : (
                    <ul className="list-disc pl-6 text-xs text-gray-600 space-y-1.5 font-semibold">
                      {preRevisao.result.erros.map((item, idx) => (
                        <li key={idx} className="text-rose-900">{item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* SUGESTÕES DE MELHORIA */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-black uppercase text-amber-800 bg-amber-50/50 px-3 py-1.5 rounded-lg border border-amber-100 flex items-center gap-1.5">
                    Sugestões de melhoria ⚠️
                  </h4>
                  {preRevisao.result.sugestoes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic pl-3">Nenhuma sugestão material pendente.</p>
                  ) : (
                    <ul className="list-disc pl-6 text-xs text-gray-600 space-y-1.5 font-semibold">
                      {preRevisao.result.sugestoes.map((item, idx) => (
                        <li key={idx} className="text-amber-900">{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/revisao`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Painel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => savePreRevisaoState(preRevisao, false)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar Resposta'}
          </button>
        </div>
      </div>
    </FluxoStepLayout>
  );
}
