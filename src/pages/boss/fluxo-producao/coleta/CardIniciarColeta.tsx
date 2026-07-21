import React from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import { ArrowRight, ClipboardCheck, ArrowLeft, Users, Building, ShieldAlert } from 'lucide-react';

export default function CardIniciarColeta() {
  const { 
    caseId, 
    fetching, 
    isPJ, 
    clientName, 
    wizardState,
    navigate 
  } = useColetaState();

  const handleStartColeta = () => {
    if (isPJ) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-procuracao-PJ`);
    } else {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-procuracao-PF`);
    }
  };

  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="inicio"
      tipoPessoa={isPJ ? 'PJ' : 'PF'}
      wizardState={wizardState}
    >
      <div id="card-iniciar-coleta-container" className="max-w-3xl mx-auto space-y-8 animate-fade-in py-6">
        
        {/* UPPER HEADER PANEL */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
              Fase Inicial da Coleta
            </span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Abertura de Protocolo Documental
            </h1>
            <p className="text-xs text-gray-400 font-semibold">
              Vínculo do Caso Ativo: <span className="text-gray-900">#{caseId?.slice(0, 8)}</span>
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/tipo-producao`)}
            className="p-2.5 bg-gray-50 border border-gray-150 rounded-xl text-gray-550 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer"
            title="Voltar para Tipo de Serviço"
          >
            <ArrowLeft size={14} />
          </button>
        </div>

        {fetching ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">
              Identificando cadastro do cliente...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* INFORMATIONAL PREVIEW OF VESTED CLIENT */}
            <div className="bg-indigo-50/40 border border-indigo-150/60 rounded-2.5xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shrink-0">
                {isPJ ? <Building size={22} /> : <Users size={22} />}
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-indigo-500 font-mono tracking-wider block">
                  Tipo de cliente: {isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </span>
                <h4 className="font-extrabold text-gray-950 text-sm mt-0.5">
                  {clientName || 'Cliente em Coleta'}
                </h4>
                <p className="text-[11px] font-semibold text-indigo-700 mt-1 uppercase tracking-wide">
                  {isPJ ? 'Pessoa Jurídica (PJ) — Fluxo Empresarial Especializado' : 'Pessoa Física (PF) — Fluxo Cível/Geral'}
                </p>
              </div>
            </div>

            {/* DYNAMIC CARD REQUESTED BY THE USER */}
            <div className="bg-white border-2 border-gray-150 rounded-[2.25rem] p-8 hover:border-indigo-500 hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              
              <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-50/30 rounded-bl-[10rem] -z-10 group-hover:scale-110 transition-transform"></div>

              <div className="space-y-5">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2.5xl flex items-center justify-center group-hover:scale-105 transition-transform border border-indigo-100">
                  <ClipboardCheck size={28} />
                </div>

                <div className="space-y-2">
                  <h3 id="btn-iniciar-coleta-obrigatoria" className="text-xl font-black text-gray-900 tracking-tight leading-snug group-hover:text-indigo-600 transition-colors">
                    Iniciar Coleta Obrigatória de Documentos do Escritório
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
                    Clique abaixo para iniciar um processo modular, auditável e passo a passo. O sistema compilará as procurações com Google Docs, contratos de honorários, declarações de hipossuficiência e relatórios de integridade final de forma nativa e sem retrabalho.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Pronto para Carregamento
                </div>

                <button
                  onClick={handleStartColeta}
                  className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Iniciar Fluxo Passo a Passo</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

            </div>

            {/* SAFETY NOTATION */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex gap-2.5">
              <ShieldAlert className="text-gray-400 shrink-0" size={16} />
              <p className="text-[11px] leading-relaxed text-gray-500 font-medium">
                <strong>Análise Antifraude e de Integridade:</strong> A coleta documental no BOSS é submetida a análises cruzadas de metadados em conformidade com as regras gerais de controladoria e integridade do escritório Priscilla Giffoni.
              </p>
            </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
