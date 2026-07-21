import React from 'react';
import { 
  Activity, 
  Briefcase, 
  CreditCard, 
  Calendar, 
  UserCheck, 
  FileBadge, 
  HelpCircle,
  Clock
} from 'lucide-react';

interface PainelGeralProps {
  selectedClient: any;
  clientCases: any[];
  allClientEvents: any[];
  allClientEvidence: any[];
  allClientInformation: any[];
  allClientFinancials: any[];
  setActiveSidebarSection: (sec: any) => void;
  handleSelectCase: (c: any) => void;
  setActiveSubTab: (tab: any) => void;
  getClientName: (c: any) => string;
}

export const PainelGeralCliente: React.FC<PainelGeralProps> = ({
  selectedClient,
  clientCases,
  allClientEvents,
  allClientEvidence,
  allClientInformation,
  allClientFinancials,
  setActiveSidebarSection,
  handleSelectCase,
  setActiveSubTab,
  getClientName
}) => {
  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Title & Breadcrumb */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div>
          <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Painel de Acompanhamento</span>
          <h2 className="text-2xl font-black text-gray-950 tracking-tight mt-0.5">Painel Geral do Cliente</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Status fático operacional, pendências de documentos e visão executiva.</p>
        </div>
        <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-2xl flex items-center justify-center">
          <Activity size={22} className="stroke-[2.5px]" />
        </div>
      </div>

      {/* BENTO GRID OF METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Processos Ativos Card */}
        <button
          onClick={() => setActiveSidebarSection('relacao_casos')}
          className="bg-white border border-gray-150 hover:border-gray-200 rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[140px] text-left transition"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Processos Ativos</span>
              <div className="text-3xl font-black text-slate-950 tracking-tight font-mono">
                {clientCases.filter(c => c.status === 'ativo').length}
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-2xl shrink-0">
              <Briefcase size={18} />
            </div>
          </div>
          <div className="text-[10.5px] text-gray-450 border-t border-gray-100/60 pt-3 mt-3 font-semibold w-full">
            Total de processos: <strong className="text-gray-700 font-bold">{clientCases.length}</strong>
          </div>
        </button>

        {/* 2. Status Financeiro Card */}
        {(() => {
          const isOverdue = allClientFinancials.some(f => f.financialStatus === 'vencido');
          const countPending = allClientFinancials.filter(f => f.financialStatus === 'pendente').length;
          const countOverdue = allClientFinancials.filter(f => f.financialStatus === 'vencido').length;
          return (
            <button
              onClick={() => setActiveSidebarSection('financeiro')}
              className={`cursor-pointer transition border rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[140px] text-left ${
                isOverdue 
                  ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300' 
                  : 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Status Financeiro</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider ${
                    isOverdue ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    {isOverdue ? '⚠️ INADIMPLENTE' : '🟢 EM DIA'}
                  </span>
                </div>
                <div className={`p-2.5 rounded-2xl shrink-0 ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="text-[10.5px] border-t border-black/5 pt-3 mt-3 font-semibold text-gray-500 w-full">
                {isOverdue 
                  ? `${countOverdue} faturamento(s) em atraso!` 
                  : `${countPending} cobrança(s) pendente(s).`}
              </div>
            </button>
          );
        })()}

        {/* 3. Audiências Card */}
        <button
          onClick={() => setActiveSidebarSection('audiencias')}
          className="cursor-pointer bg-white border border-gray-150 hover:border-gray-200 transition rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[140px] text-left"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Audiências</span>
              <div className="text-3xl font-black text-slate-950 tracking-tight font-mono">
                {allClientEvents.filter(e => e.type === 'audiencia').length}
              </div>
            </div>
            <div className="p-2.5 bg-red-50 text-red-650 rounded-2xl shrink-0">
              <Calendar size={18} />
            </div>
          </div>
          <div className="text-[10.5px] text-gray-450 border-t border-gray-100/60 pt-3 mt-3 font-semibold w-full font-mono">
            Agendadas: <strong className="text-gray-700 font-bold">{allClientEvents.filter(e => e.type === 'audiencia' && e.status === 'agendado').length}</strong>
          </div>
        </button>

        {/* 4. Perícias Card */}
        <button
          onClick={() => setActiveSidebarSection('pericias')}
          className="cursor-pointer bg-white border border-gray-150 hover:border-gray-200 transition rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[140px] text-left"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Perícias</span>
              <div className="text-3xl font-black text-slate-950 tracking-tight font-mono">
                {allClientEvents.filter(e => e.type === 'pericia').length}
              </div>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-650 rounded-2xl shrink-0">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="text-[10.5px] text-gray-450 border-t border-gray-100/60 pt-3 mt-3 font-semibold w-full font-mono">
            Agendadas: <strong className="text-gray-700 font-bold">{allClientEvents.filter(e => e.type === 'pericia' && e.status === 'agendado').length}</strong>
          </div>
        </button>

        {/* 5. Provas Solicitadas Card */}
        <button
          onClick={() => setActiveSidebarSection('relacao_casos')}
          className="cursor-pointer bg-white border border-gray-150 hover:border-gray-200 transition rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[140px] text-left"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Provas Solicitadas</span>
              <div className="text-3xl font-black text-slate-950 tracking-tight font-mono">{allClientEvidence.length}</div>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-650 rounded-2xl shrink-0">
              <FileBadge size={18} />
            </div>
          </div>
          <div className="text-[10.5px] text-gray-450 border-t border-gray-100/60 pt-3 mt-3 font-semibold w-full font-mono">
            Pendentes: <strong className="text-amber-700 font-bold">{allClientEvidence.filter(p => p.status === 'pendente').length}</strong>
          </div>
        </button>

        {/* 6. Informações Solicitadas Card */}
        <button
          onClick={() => setActiveSidebarSection('relacao_casos')}
          className="cursor-pointer bg-white border border-gray-150 hover:border-gray-200 transition rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[140px] text-left"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wider block">Info. Solicitadas</span>
              <div className="text-3xl font-black text-slate-950 tracking-tight font-mono">{allClientInformation.length}</div>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-655 rounded-2xl shrink-0">
              <HelpCircle size={18} />
            </div>
          </div>
          <div className="text-[10.5px] text-gray-450 border-t border-gray-100/60 pt-3 mt-3 font-semibold w-full font-mono">
            Respondidas: <strong className="text-emerald-700 font-bold">{allClientInformation.filter(q => q.status === 'respondido' || q.status === 'revisado').length}</strong>
          </div>
        </button>
      </div>

      {/* EXECUTIVES CHRONOGRAM & PENDING DOCUMENTS SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events Summary list */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs space-y-4">
          <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2.5">
            <Calendar size={14} className="text-indigo-600 shrink-0" />
            Agenda de Atividades e Audiências
          </h4>

          {allClientEvents.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4">Nenhum evento agendado para o cliente no cronograma.</p>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {allClientEvents.slice(0, 5).map((e) => (
                <div key={e.id} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded font-mono font-bold ${
                        e.type === 'audiencia' ? 'bg-red-50 text-red-700' :
                        e.type === 'pericia' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {e.type}
                      </span>
                      <h5 className="font-extrabold text-xs text-gray-900 truncate max-w-[170px]">{e.title}</h5>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">
                      {e.date ? new Date(e.date).toLocaleDateString('pt-BR') : '—'} às {e.time || '—'}
                    </p>
                  </div>
                  <span className="text-[9.5px] font-mono uppercase bg-white px-2 py-0.5 rounded-lg border border-gray-150 font-black text-gray-650 shrink-0">
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Items Summary checklist */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs space-y-4">
          <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2.5">
            <FileBadge size={14} className="text-emerald-650 shrink-0" />
            Dossiê Fático: Coletas Pendentes
          </h4>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 font-sans">
            {/* List pending proofs */}
            {allClientEvidence.filter(p => p.status === 'pendente').slice(0, 4).map((p) => (
              <div key={p.id} className="p-3 bg-amber-50/30 border border-amber-100/60 rounded-2xl flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <span className="text-[8px] font-black font-mono uppercase px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold">
                    Documento Solic.
                  </span>
                  <h5 className="font-extrabold text-xs text-gray-950 mt-1 truncate">{p.title}</h5>
                </div>
                <button 
                  onClick={() => {
                    const matchingCase = clientCases.find(c => c.id === p.caseId);
                    if (matchingCase) {
                      handleSelectCase(matchingCase);
                      setActiveSidebarSection('relacao_casos');
                      setActiveSubTab('provas');
                    }
                  }}
                  className="text-[9.5px] font-bold uppercase text-amber-700 font-mono hover:underline shrink-0"
                >
                  Ir p/ Caso
                </button>
              </div>
            ))}

            {/* List pending questions */}
            {allClientInformation.filter(q => q.status === 'pendente' || !q.answer).slice(0, 4).map((q) => (
              <div key={q.id} className="p-3 bg-blue-50/20 border border-blue-100/60 rounded-2xl flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <span className="text-[8px] font-black font-mono uppercase px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-bold">
                    Fato Pendente
                  </span>
                  <h5 className="font-extrabold text-xs text-gray-950 mt-1 truncate">{q.question}</h5>
                </div>
                <button 
                  onClick={() => {
                    const matchingCase = clientCases.find(c => c.id === q.caseId);
                    if (matchingCase) {
                      handleSelectCase(matchingCase);
                      setActiveSidebarSection('relacao_casos');
                      setActiveSubTab('informacoes');
                    }
                  }}
                  className="text-[9.5px] font-bold uppercase text-blue-700 font-mono hover:underline shrink-0"
                >
                  Ir p/ Caso
                </button>
              </div>
            ))}

            {allClientEvidence.filter(b => b.status === 'pendente').length === 0 && 
             allClientInformation.filter(w => w.status === 'pendente' || !w.answer).length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-8">Tudo em ordem! Nenhuma coleta fática registrada pendente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
