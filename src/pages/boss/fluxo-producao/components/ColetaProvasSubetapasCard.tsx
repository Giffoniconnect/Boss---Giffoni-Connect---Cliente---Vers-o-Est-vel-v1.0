import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { FileText, Coins, CheckSquare, FolderOpen, ShieldCheck, Check, ClipboardCheck } from 'lucide-react';

interface ColetaProvasSubetapasCardProps {
  caseId?: string;
  tipoPessoa?: 'PF' | 'PJ';
  wizardState?: any;
  currentStep: 'procuracao' | 'declaracao' | 'documentos-minimos' | 'documentos-necessidade' | 'documentos-consolidado' | 'documentos-auditoria' | 'inicio';
}

export default function ColetaProvasSubetapasCard({
  caseId,
  tipoPessoa: propTipoPessoa,
  wizardState: propWizardState,
  currentStep
}: ColetaProvasSubetapasCardProps) {
  const navigate = useNavigate();
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>(propTipoPessoa || 'PF');
  const [wizardState, setWizardState] = useState<any>(propWizardState || null);
  const [loading, setLoading] = useState(!propTipoPessoa || !propWizardState);

  useEffect(() => {
    if (propTipoPessoa) {
      setTipoPessoa(propTipoPessoa);
    }
    if (propWizardState) {
      setWizardState(propWizardState);
    }
  }, [propTipoPessoa, propWizardState]);

  useEffect(() => {
    if (!caseId) return;
    if (propTipoPessoa && propWizardState) {
      setLoading(false);
      return;
    }

    const fetchCaseAndClient = async () => {
      try {
        const caseSnap = await getDoc(doc(db, 'cases', caseId));
        if (caseSnap.exists()) {
          const caseData = caseSnap.data();
          if (!propWizardState && caseData.solicitacoesProvasWizardState) {
            setWizardState(caseData.solicitacoesProvasWizardState);
          }
          if (!propTipoPessoa && caseData.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', caseData.clientId));
            if (clientSnap.exists()) {
              const clientData = clientSnap.data();
              if (clientData.type === 'PJ' || clientData.type === 'PF') {
                setTipoPessoa(clientData.type);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading case/client in ColetaProvasSubetapasCard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseAndClient();
  }, [caseId, propTipoPessoa, propWizardState]);

  if (!caseId) return null;

  const suffix = tipoPessoa === 'PJ' ? 'PJ' : 'PF';
  const basePath = `/boss-giffoni-clientes/fluxo-producao/${caseId}`;

  const steps = [
    {
      key: 'procuracao',
      label: 'Criar Procuração - etapa 01',
      path: `${basePath}/solicitacao-procuracao-${suffix}`,
      icon: FileText,
      completed: wizardState?.step1_completed || false,
    },
    {
      key: 'declaracao',
      label: 'Custas ou pobreza - etapa 02',
      path: `${basePath}/solicitacao-declaracao-${suffix}`,
      icon: Coins,
      completed: wizardState?.step2_completed || false,
    },
    {
      key: 'documentos-minimos',
      label: 'Provas mínimas obrigatórias - etapa 03',
      path: `${basePath}/solicitacao-documentos-minimos-${suffix}`,
      icon: CheckSquare,
      completed: wizardState?.step4_completed || false,
    },
    {
      key: 'documentos-necessidade',
      label: 'Outras provas do cliente - etapa 04',
      path: `${basePath}/solicitacao-documentos-necessidade-${suffix}`,
      icon: FolderOpen,
      completed: wizardState?.step5_completed || false,
    },
    {
      key: 'documentos-consolidado',
      label: 'Relatório de Provas Consolidado - etapa 05',
      path: `${basePath}/solicitacao-documentos-consolidado-${suffix}`,
      icon: ClipboardCheck,
      completed: wizardState?.step5_consolidado_completed || false,
    },
    {
      key: 'documentos-auditoria',
      label: 'Auditoria da coleta de Provas - etapa 06',
      path: `${basePath}/solicitacao-documentos-auditoria-${suffix}`,
      icon: ShieldCheck,
      completed: wizardState?.step6_completed || false,
    }
  ];

  return (
    <div className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
          Subetapas da Coleta de Provas
        </h3>
        <p className="text-[12px] text-gray-400 font-semibold mt-0.5">
          Acesse rapidamente cada fase da coleta obrigatória de documentos e provas do cliente ({tipoPessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {steps.map((step, index) => {
          const IconComponent = step.icon;
          const isCurrent = currentStep === step.key;

          let btnClass = '';
          if (isCurrent) {
            btnClass = 'bg-indigo-600 border-indigo-600 text-white shadow-xs scale-[1.02] transform transition-all';
          } else if (step.completed) {
            btnClass = 'bg-emerald-50/50 border-emerald-150 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-250 hover:shadow-xs transition-all';
          } else {
            btnClass = 'bg-gray-50/50 border-gray-150 text-gray-600 hover:bg-gray-50 hover:border-gray-250 hover:text-gray-900 hover:shadow-xs transition-all';
          }

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => navigate(step.path)}
              className={`flex items-center justify-between p-3.5 border rounded-2xl text-left cursor-pointer outline-none relative overflow-hidden group ${btnClass}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${isCurrent ? 'bg-indigo-500 text-white' : step.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-150 text-gray-500'}`}>
                  <IconComponent size={15} />
                </div>
                <div className="min-w-0 font-sans">
                  <span className={`text-[10px] uppercase font-black tracking-widest block font-mono ${isCurrent ? 'text-indigo-200' : 'text-gray-400'}`}>
                    0{index + 1} / 06
                  </span>
                  <span className="text-[12px] font-extrabold tracking-tight block leading-tight mt-0.5">
                    {step.label}
                  </span>
                </div>
              </div>

              {step.completed && !isCurrent && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check size={11} className="stroke-[3.5px]" />
                </div>
              )}
              {isCurrent && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-200 group-hover:scale-150 transition-all"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
