import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import {
  Smartphone,
  MessageSquare,
  Instagram,
  Facebook,
  Video,
  Mail,
  Star,
  ShieldCheck,
  Lock,
  Check,
  AlertCircle
} from 'lucide-react';
import {
  extractClientOnboardingFields,
  buildOnboardingExecutionPlan,
  OnboardingStepPlan
} from '../onboardingHelper';

interface OnboardingSubetapasCardProps {
  caseId?: string;
}

const getOnboardingStepIdFromPath = (pathname: string): number => {
  if (pathname.includes('add.telefone.do.cliente')) return 1;
  if (pathname.includes('welcome.zap')) return 2;
  if (pathname.includes('add.cliente.no.instagram')) return 3;
  if (pathname.includes('add.cliente.no.facebook')) return 4;
  if (pathname.includes('add.cliente.no.tiktok')) return 5;
  if (pathname.includes('enviar.email.cliente')) return 6;
  if (pathname.includes('avaliacard')) return 7;
  if (pathname.includes('auditoria.onboarding.cliente')) return 8;
  return 0;
};

export default function OnboardingSubetapasCard({ caseId }: OnboardingSubetapasCardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeStepId = getOnboardingStepIdFromPath(location.pathname);

  useEffect(() => {
    if (!caseId) return;

    const fetchOnboardingData = async () => {
      try {
        setLoading(true);
        const caseRef = doc(db, 'cases', caseId);
        const caseSnap = await getDoc(caseRef);
        if (caseSnap.exists()) {
          const cData = caseSnap.data();
          setCaseObj(cData);

          if (cData.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
            if (clientSnap.exists()) {
              setClient(clientSnap.data());
            }
          }
        }
      } catch (err) {
        console.error("Error fetching onboarding progress in card:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOnboardingData();
  }, [caseId, location.pathname]);

  if (!caseId || activeStepId === 0) return null;

  if (loading) {
    return (
      <div className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-xs animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const clientFields = extractClientOnboardingFields(client);
  const executionPlan = buildOnboardingExecutionPlan(clientFields, caseObj?.onboarding);

  // Find the index of the first incomplete step in the actual plan
  const firstIncompleteIndex = executionPlan.findIndex(
    step => step.status !== 'completed' && step.status !== 'dispensed_not_owned' && step.status !== 'dispensed_no_channel'
  );

  const getStepIcon = (id: number) => {
    switch (id) {
      case 1: return Smartphone;
      case 2: return MessageSquare;
      case 3: return Instagram;
      case 4: return Facebook;
      case 5: return Video;
      case 6: return Mail;
      case 7: return Star;
      case 8: return ShieldCheck;
      default: return Smartphone;
    }
  };

  const handleStepClick = (step: OnboardingStepPlan, index: number) => {
    // Blocks future steps click
    if (index > firstIncompleteIndex && step.id !== activeStepId) {
      alert("Esta subetapa está futura e permanece bloqueada até a conclusão ou dispensa das anteriores.");
      return;
    }
    // Allow navigation to completed, dispensed, or active steps
    navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/${step.route}`);
  };

  const isCurrentMissingData = executionPlan[activeStepId - 1]?.status === 'blocked_missing_data';

  return (
    <div className="space-y-4">
      {/* CARRY-ON WARNING IF DATA IS MISSING */}
      {isCurrentMissingData && (
        <div className="p-6 bg-red-50 border-2 border-red-500 rounded-3xl text-red-900 text-sm flex flex-col sm:flex-row justify-between items-center gap-4 animate-fadeIn" id="missing-data-warning">
          <div className="flex gap-3 items-start">
            <AlertCircle size={24} className="text-red-500 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-extrabold block text-base text-red-800">Este dado está pendente na Etapa 1 — Cadastro PF.</span>
              <p className="text-xs text-red-700 font-semibold mt-1">
                Não é permitida a redigitação de campos de identificação na interface de onboarding. Corrija o cadastro original para sincronizar os dados automaticamente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/editar-cadastro-cliente`)}
            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-sm shrink-0 whitespace-nowrap"
          >
            Corrigir na Etapa 1 — Cadastro PF
          </button>
        </div>
      )}

      {/* HORIZONTAL FLOW CONTAINER */}
      <div className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
            Fluxo de Onboarding (Acolhimento)
          </h3>
          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
            Acompanhe o progresso sequencial obrigatório de 1 a 8. Cards futuros permanecem bloqueados.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
          {executionPlan.map((step, index) => {
            const IconComponent = getStepIcon(step.id);
            const isCurrent = step.id === activeStepId;
            const isCompleted = step.status === 'completed';
            const isDispensed = step.status === 'dispensed_not_owned' || step.status === 'dispensed_no_channel';
            
            // A step is future/blocked if its index is greater than the first incomplete index (unless it is current)
            const isBlocked = index > firstIncompleteIndex && !isCurrent;

            let btnClass = '';
            let iconBgClass = '';

            if (isCurrent) {
              btnClass = 'bg-indigo-600 border-indigo-600 text-white shadow-xs scale-[1.02] ring-2 ring-indigo-200 ring-offset-2';
              iconBgClass = 'bg-indigo-500 text-white';
            } else if (isCompleted) {
              btnClass = 'bg-emerald-50/50 border-emerald-150 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-250';
              iconBgClass = 'bg-emerald-100 text-emerald-700';
            } else if (isDispensed) {
              btnClass = 'bg-gray-50/70 border-gray-150 text-gray-400 hover:bg-gray-50';
              iconBgClass = 'bg-gray-100 text-gray-400';
            } else if (isBlocked) {
              btnClass = 'bg-gray-100/50 border-gray-100 text-gray-400 opacity-60 cursor-not-allowed';
              iconBgClass = 'bg-gray-100 text-gray-400';
            } else {
              // Available but pending
              btnClass = 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300';
              iconBgClass = 'bg-gray-100 text-gray-500';
            }

            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <span className="text-sm shrink-0 font-bold select-none text-gray-400 animate-fadeIn" id={`arrow-${step.id}`}>
                    ➡️
                  </span>
                )}

                <button
                  type="button"
                  disabled={isBlocked}
                  onClick={() => handleStepClick(step, index)}
                  className={`flex flex-col justify-between p-3 border rounded-2xl text-left cursor-pointer outline-none relative overflow-hidden group min-w-[120px] max-w-[160px] flex-1 h-[95px] transition-all duration-200 ${btnClass}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[9px] font-black tracking-widest font-mono ${isCurrent ? 'text-indigo-200' : 'text-gray-400'}`}>
                      0{step.id}
                    </span>
                    {isCompleted && (
                      <div className="w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check size={10} className="stroke-[3.5px]" />
                      </div>
                    )}
                    {isDispensed && (
                      <span className="text-[8px] font-extrabold uppercase px-1 py-0.5 rounded bg-gray-200 text-gray-500 scale-90">
                        Disp
                      </span>
                    )}
                    {isBlocked && (
                      <Lock size={10} className="text-gray-400 shrink-0" />
                    )}
                  </div>

                  <div className="mt-1 min-w-0">
                    <span className={`text-[10px] font-black tracking-tight block leading-tight truncate ${isDispensed ? 'line-through' : ''}`}>
                      {step.name.split(' — ')[1] || step.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 border-t border-gray-100/10 pt-1">
                    <IconComponent size={11} className={`${isCurrent ? 'text-indigo-200' : 'text-gray-400'}`} />
                    <span className="text-[8px] truncate font-medium max-w-full opacity-80">
                      {isDispensed ? 'Dispensada' : isCompleted ? 'Concluída' : isCurrent ? 'Ativa' : 'Pendente'}
                    </span>
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
