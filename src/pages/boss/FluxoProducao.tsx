// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BossLayout } from '../../components/Layout';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Settings, 
  HelpCircle, 
  FileText, 
  DollarSign, 
  Scale, 
  Users, 
  UserCheck, 
  Clipboard, 
  ShieldCheck, 
  FileBadge,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  Info
} from 'lucide-react';

// Steps imports
import { FlowStep } from './fluxo-producao/types';
import InicioStep from './fluxo-producao/InicioStep';
import ClienteStep from './fluxo-producao/ClienteStep';
import ServicoStep from './fluxo-producao/ServicoStep';
import DadosCasoStep from './fluxo-producao/DadosCasoStep';
import ColetaInfoStep from './fluxo-producao/ColetaInfoStep';
import ColetaProvasStep from './fluxo-producao/ColetaProvasStep';
import FinanceiroStep from './fluxo-producao/FinanceiroStep';
import EstruturacaoStep from './fluxo-producao/EstruturacaoStep';
import DelegacaoStep from './fluxo-producao/DelegacaoStep';
import RevisaoStep from './fluxo-producao/RevisaoStep';
import ProtocoloStep from './fluxo-producao/ProtocoloStep';
import ControladoriaStep from './fluxo-producao/ControladoriaStep';
import IntegridadeStep from './fluxo-producao/IntegridadeStep';

// Define the sequenced order of step indices for progression mapping
const FLOW_SEQUENCE: FlowStep[] = [
  'inicio',
  'cadastro_cliente',
  'tipo_producao',
  'dados_caso',
  'coleta_informacoes',
  'coleta_provas',
  'financeiro',
  'estruturacao',
  'delegacao',
  'revisao',
  'protocolo',
  'controladoria',
  'relatorio_integridade'
];

const LIFECYCLE_STEPS = [
  { id: 'inicio', label: 'Início', icon: Sparkles },
  { id: 'cadastro_cliente', label: 'Cliente', icon: User },
  { id: 'tipo_producao', label: 'Serviço', icon: Settings },
  { id: 'dados_caso', label: 'Caso', icon: Info },
  { id: 'coleta_informacoes', label: 'Informações', icon: HelpCircle },
  { id: 'coleta_provas', label: 'Provas', icon: FileText },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { id: 'estruturacao', label: 'Estruturação', icon: Scale },
  { id: 'delegacao', label: 'Delegação', icon: Users },
  { id: 'revisao', label: 'Revisão', icon: UserCheck },
  { id: 'protocolo', label: 'Protocolo', icon: Clipboard },
  { id: 'controladoria', label: 'Controladoria', icon: ShieldCheck },
  { id: 'relatorio_integridade', label: 'Conclusão', icon: FileBadge }
];

export default function FluxoProducao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search parameters parsing for state recovery
  const currentStep = (searchParams.get('step') as FlowStep) || 'inicio';
  const caseId = searchParams.get('caseId');
  const clientId = searchParams.get('clientId');
  const slug = searchParams.get('slug') || '';

  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'info' | 'success'; text: string } | null>(null);

  // Helper trigger alerts
  const triggerAlert = (msg: string) => {
    setAlertMessage({ type: 'info', text: msg });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // Safe search parameters state update
  const navigateToStep = (nextStep: FlowStep, params: Record<string, string | null> = {}) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', nextStep);
    
    Object.entries(params).forEach(([key, val]) => {
      if (val === null) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });

    setSearchParams(nextParams);
  };

  const curIdx = FLOW_SEQUENCE.indexOf(currentStep);

  const handleBack = () => {
    if (curIdx > 0) {
      navigateToStep(FLOW_SEQUENCE[curIdx - 1]);
    }
  };

  const handleForward = () => {
    if (curIdx < FLOW_SEQUENCE.length - 1) {
      navigateToStep(FLOW_SEQUENCE[curIdx + 1]);
    }
  };

  return (
    <BossLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Fluxo Operacional de Produção</h2>
          <p className="text-sm text-gray-500">Pipeline de instrução produtiva orientada, salvamento automático e retomada de andamentos.</p>
        </div>
        {currentStep !== 'inicio' && (
          <div className="text-xs bg-gray-50 p-2.5 px-4 rounded-xl border border-gray-150 font-medium font-mono text-gray-650 shrink-0">
            {caseId ? (
              <>ID do Caso: <span className="text-gray-900 font-bold">{caseId}</span></>
            ) : (
              'Novo Caso em Instrução'
            )}
          </div>
        )}
      </div>

      {/* HORIZONTAL GRAPH TIMELINE PANEL */}
      {currentStep !== 'inicio' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-x-auto mb-8">
          <div className="flex items-center justify-between min-w-[900px] relative">
            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-gray-100 -z-10" />
            <div className={`absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 -z-15 transition-all duration-300`} style={{ width: `${(curIdx / (FLOW_SEQUENCE.length - 1)) * 95}%` }} />

            {LIFECYCLE_STEPS.map((stepItem, idx) => {
              const StepIcon = stepItem.icon;
              const isActive = currentStep === stepItem.id;
              const isPassed = curIdx > idx;

              return (
                <div 
                  key={stepItem.id} 
                  onClick={() => {
                    // Restrict navigation to steps already processed or selectable based on context
                    if (idx === 0 || (caseId && idx <= curIdx) || (clientId && idx <= 2)) {
                      navigateToStep(stepItem.id as FlowStep);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 cursor-pointer relative"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-105' 
                      : isPassed 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-white border-2 border-gray-150 text-gray-400 hover:border-gray-450'
                  }`}>
                    <StepIcon size={16} />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-blue-600' : isPassed ? 'text-gray-700' : 'text-gray-400'}`}>
                    {stepItem.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FEEDBACK PROMPTER */}
      {alertMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-900 font-semibold text-xs mb-6 flex items-center gap-2"
        >
          <Sparkles size={16} className="text-blue-600 shrink-0" />
          {alertMessage.text}
        </motion.div>
      )}

      {/* CENTRAL RENDERED SPACE */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 min-h-[480px]">
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 font-sans">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Sincronizando com Firestore...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 'inicio' && (
                <InicioStep
                  onSetLoading={setLoading}
                  onSelectAction={(action, extra) => {
                    if (action === 'new_client') {
                      navigateToStep('cadastro_cliente', { clientId: null, caseId: null, slug: null });
                    } else if (action === 'new_case') {
                      navigateToStep('tipo_producao', { clientId: extra.clientId, slug: extra.slug, caseId: null });
                    } else if (action === 'resume') {
                      setLoading(true);
                      import('firebase/firestore').then(async ({ getDoc, doc }) => {
                        const snapDoc = await getDoc(doc(db, 'cases', extra.caseId));
                        if (snapDoc.exists()) {
                          const data = snapDoc.data();
                          navigateToStep(
                            (data.productionStage as FlowStep) || 'dados_caso', 
                            { caseId: extra.caseId, clientId: data.clientId || null, slug: data.clientSlug || null }
                          );
                        }
                        setLoading(false);
                      });
                    }
                  }}
                />
              )}

              {currentStep === 'cadastro_cliente' && (
                <ClienteStep
                  initialClientId={clientId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={(retId, retSlug) => {
                    navigateToStep('tipo_producao', { clientId: retId, slug: retSlug });
                  }}
                />
              )}

              {currentStep === 'tipo_producao' && clientId && (
                <ServicoStep
                  clientId={clientId}
                  slug={slug}
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={(retCaseId) => {
                    navigateToStep('dados_caso', { caseId: retCaseId });
                  }}
                />
              )}

              {currentStep === 'dados_caso' && caseId && (
                <DadosCasoStep
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('coleta_informacoes');
                  }}
                />
              )}

              {currentStep === 'coleta_informacoes' && caseId && clientId && (
                <ColetaInfoStep
                  caseId={caseId}
                  clientId={clientId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('coleta_provas');
                  }}
                />
              )}

              {currentStep === 'coleta_provas' && caseId && clientId && (
                <ColetaProvasStep
                  caseId={caseId}
                  clientId={clientId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('financeiro');
                  }}
                />
              )}

              {currentStep === 'financeiro' && caseId && clientId && (
                <FinanceiroStep
                  caseId={caseId}
                  clientId={clientId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('estruturacao');
                  }}
                />
              )}

              {currentStep === 'estruturacao' && caseId && (
                <EstruturacaoStep
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('delegacao');
                  }}
                />
              )}

              {currentStep === 'delegacao' && caseId && (
                <DelegacaoStep
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('revisao');
                  }}
                />
              )}

              {currentStep === 'revisao' && caseId && (
                <RevisaoStep
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('protocolo');
                  }}
                />
              )}

              {currentStep === 'protocolo' && caseId && (
                <ProtocoloStep
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('controladoria');
                  }}
                />
              )}

              {currentStep === 'controladoria' && caseId && (
                <ControladoriaStep
                  caseId={caseId}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                  onNext={() => {
                    navigateToStep('relatorio_integridade');
                  }}
                />
              )}

              {currentStep === 'relatorio_integridade' && caseId && clientId && (
                <IntegridadeStep
                  caseId={caseId}
                  clientId={clientId}
                  slug={slug}
                  onSetLoading={setLoading}
                  onAlert={triggerAlert}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* GLOBAL TRANSITIONAL ACTION BUTTON CONTROLS */}
      {currentStep !== 'inicio' && !loading && (
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={handleBack}
            disabled={curIdx <= 1}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-950 disabled:opacity-30 uppercase tracking-widest cursor-pointer transition-all"
          >
            <ArrowLeft size={16} /> Voltar Etapa
          </button>

          <button
            onClick={handleForward}
            disabled={curIdx >= FLOW_SEQUENCE.length - 1 || (idxOfStep('tipo_producao') >= curIdx && !clientId) || (idxOfStep('dados_caso') >= curIdx && !caseId)}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-950 disabled:opacity-30 uppercase tracking-widest cursor-pointer transition-all"
          >
            Avançar Passo <ChevronRight size={16} />
          </button>
        </div>
      )}
    </BossLayout>
  );

  function idxOfStep(s: FlowStep) {
    return FLOW_SEQUENCE.indexOf(s);
  }
}
