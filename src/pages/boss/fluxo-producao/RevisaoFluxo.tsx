import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  Calendar,
  Clock,
  BrainCircuit,
  FileCheck2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Terminal,
  Activity,
  History,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export default function RevisaoFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

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

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados do hub de revisão: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <FluxoStepLayout stepName="Revisão" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Hub do Setor de Revisão...
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

  // Extract variables safely
  const agenda = caseObj?.agendaSecretaria || {};
  const preRevisao = caseObj?.preRevisaoIa || {};
  const review = caseObj?.reviewFormal || {};
  const historyLogs = caseObj?.revisaoSubetapaLogs || [];

  const translateScheduleStatus = (status: string) => {
    const map: Record<string, string> = {
      pendente: 'Pendente ⏳',
      solicitado: 'Solicitado 📨',
      agendado: 'Agendado 🗓️',
      reagendado: 'Reagendado 🔁',
      concluido: 'Concluído ✅',
      cancelado: 'Cancelado ❌'
    };
    return map[status] || 'Não configurado ⏳';
  };

  const translateIaStatus = (status: string) => {
    const map: Record<string, string> = {
      nao_iniciada: 'Não iniciada 🔍',
      em_analise: 'Em análise... ⚙️',
      concluida: 'Concluída ✅',
      erro_tecnico: 'Erro técnico ⚠️'
    };
    return map[status] || 'Não acionado';
  };

  const translateReviewStatus = (status: string) => {
    const map: Record<string, string> = {
      aguardando_revisao: 'Aguardando revisão',
      revisao_agendada: 'Revisão agendada',
      pre_revisao_em_andamento: 'Pré-revisão em andamento',
      aguardando_decisao: 'Aguardando decisão',
      aprovada_sem_ressalvas: 'Aprovado para protocolo ✅',
      aprovada_com_ressalvas: 'Aprovado com ressalvas ⚠️',
      nao_aprovada: 'Reprovado ❌',
      devolvido_para_correcao: 'Devolvido para correção 🔁'
    };
    return map[status] || 'Aguardando revisão';
  };

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
              <ShieldCheck className="text-indigo-600" size={24} />
              Setor de Revisão Jurídica
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Painel Central — Monitore, audite e aprove a estruturação de teses deste caso
            </p>
          </div>
          
          <button
            type="button"
            id="back-to-dashboard-btn"
            onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer self-start"
          >
            Voltar para o Fluxo de Produção
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-950 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500" />
            <span className="font-semibold">{error}</span>
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
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">REGISTRO DE DEMANDA</span>
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
                {caseObj?.registrationType || 'Não Definido'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">STATUS DA PRODUÇÃO</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-150 px-2.5 py-1 rounded capitalize">
                {caseObj?.statusInterno || 'Em revisão'}
              </span>
            </div>
          </div>
        </div>

        {/* THREE CLICKABLE SUB-STAGE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CARD 01: AGENDAMENTO DE REVISÃO */}
          <div
            id="subetapa-agendamento-card"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/agendamento.de.revisao`)}
            className="border border-gray-150 rounded-3xl p-6 bg-white hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[190px] relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all">
                  <Calendar size={20} />
                </div>
                <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Subetapa 01</span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-950 group-hover:text-indigo-650 transition-all uppercase tracking-tight">
                  Agendamento de Revisão
                </h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  Delegue os operadores, vincule projetos e organize a agenda de pautas no Todoist.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100/70 pt-3 mt-4 flex items-center justify-between text-xs text-gray-500 font-bold">
              <span className="text-gray-400 font-medium">Status: <span className="text-slate-700 font-bold">{translateScheduleStatus(agenda.scheduleStatus)}</span></span>
              <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* CARD 02: PRÉ-REVISÃO COM AUXÍLIO DE IA */}
          <div
            id="subetapa-ia-card"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/pre.revisao.com.IA`)}
            className="border border-gray-150 rounded-3xl p-6 bg-white hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[190px] relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all">
                  <BrainCircuit size={20} />
                </div>
                <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Subetapa 02</span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-950 group-hover:text-indigo-650 transition-all uppercase tracking-tight">
                  Pré-Revisão com IA
                </h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  Acione o assistente cognitivo Gemini IA para realizar uma varredura crítica preliminar do caso.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100/70 pt-3 mt-4 flex items-center justify-between text-xs text-gray-500 font-bold">
              <span className="text-gray-400 font-medium">Status: <span className="text-slate-700 font-bold">{translateIaStatus(preRevisao.status)}</span></span>
              <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* CARD 03: DECISÃO SOBRE A REVISÃO */}
          <div
            id="subetapa-decisao-card"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/decisao.sobre.revisao`)}
            className="border border-gray-150 rounded-3xl p-6 bg-white hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[190px] relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all">
                  <FileCheck2 size={20} />
                </div>
                <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Subetapa 03</span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-950 group-hover:text-indigo-650 transition-all uppercase tracking-tight">
                  Decisão sobre a Revisão
                </h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  Analise as pendências, defina o parecer jurídico e autorize a liberação definitiva para protocolo.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100/70 pt-3 mt-4 flex items-center justify-between text-xs text-gray-500 font-bold">
              <span className="text-gray-400 font-medium">Parecer: <span className="text-slate-700 font-bold">{translateReviewStatus(review.reviewStatus)}</span></span>
              <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

        </div>

        {/* LOG TÉCNICO DO SETOR DE REVISÃO */}
        <div id="technical-log-panel" className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-2 font-mono">
              <Terminal size={16} className="text-teal-400" />
              Log Técnico do Setor de Revisão
            </h3>
            <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">REALTIME SYNCED</span>
          </div>

          {/* REALTIME SYSTEM PARAMETERS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950/80 rounded-2xl border border-slate-850 text-[11px] font-mono leading-relaxed text-slate-300">
            <div className="space-y-1">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">STATUS DO AGENDAMENTO</span>
              <p className="font-bold text-teal-400">{translateScheduleStatus(agenda.scheduleStatus)}</p>
            </div>
            <div className="space-y-1">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">STATUS PRÉ-REVISÃO IA</span>
              <p className="font-bold text-teal-400">{translateIaStatus(preRevisao.status)}</p>
            </div>
            <div className="space-y-1">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">GEMINI ACIONADO?</span>
              <p className="font-bold text-teal-400">{preRevisao.desejaAcionar === 'sim' ? 'Sim ✅' : preRevisao.desejaAcionar === 'nao' ? 'Não ❌' : 'Pendente ⏳'}</p>
            </div>
            <div className="space-y-1">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">RESULTADO DISPONÍVEL?</span>
              <p className="font-bold text-teal-400">{preRevisao.result ? 'Disponível ✅' : 'Pendente ⏳'}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">PARECER FINAL DA REVISÃO</span>
              <p className="font-bold text-teal-400">{translateReviewStatus(review.reviewStatus)}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">ÚLTIMA ATUALIZAÇÃO SÉRIA</span>
              <p className="font-bold text-teal-400">{caseObj?.updatedAt ? new Date(caseObj.updatedAt).toLocaleString('pt-BR') : 'Sem registros.'}</p>
            </div>
            <div className="space-y-1 col-span-1 sm:col-span-2 md:col-span-4 border-t border-slate-850 pt-2 mt-1">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">PENDÊNCIAS JURÍDICAS ATIVAS</span>
              <p className="text-slate-400 font-semibold">{review.requestedAdjustments || 'Nenhuma pendência material cadastrada.'}</p>
            </div>
          </div>

          {/* HISTORIC SUB-STEP TRANSACTIONS LOG */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5 pt-1">
              <Activity size={12} />
              Registro de Transações Operacionais
            </h4>
            
            {historyLogs.length === 0 ? (
              <p className="text-[11px] font-mono text-slate-500 italic pl-2">Nenhum evento operacional registrado para as subetapas.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pl-1">
                {historyLogs.slice().reverse().map((log: any, idx: number) => (
                  <div key={idx} className="text-[11px] font-mono leading-relaxed border-l-2 border-slate-800 pl-3 py-0.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="space-x-1.5 text-gray-300">
                      <span className="text-teal-500 font-bold shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-slate-400 uppercase font-black tracking-tight text-[9px] bg-slate-950 px-1.5 py-0.5 rounded">{log.subetapa}</span>
                      <strong className="text-slate-100">{log.action}:</strong>
                      <span className="text-slate-400">{log.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold">{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM STEP CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Fluxo
          </button>

          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/decisao.sobre.revisao`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
          >
            <span>Ir para Parecer de Auditoria</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </FluxoStepLayout>
  );
}
