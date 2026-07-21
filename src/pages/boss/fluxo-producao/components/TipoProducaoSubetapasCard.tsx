import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { Layers, Scale, Briefcase, CheckSquare, Check } from 'lucide-react';

interface TipoProducaoSubetapasCardProps {
  caseId?: string;
  currentStep: 'natureza' | 'judicial' | 'extrajudicial' | 'form';
  serviceMacroType?: 'judicial' | 'extrajudicial' | null;
  serviceSubtype?: string | null;
  todoistAutomationStatus?: string;
  todoistTaskId?: string;
}

export default function TipoProducaoSubetapasCard({
  caseId,
  currentStep,
  serviceMacroType: propMacro,
  serviceSubtype: propSubtype,
  todoistAutomationStatus: propTodoistStatus,
  todoistTaskId: propTodoistTaskId
}: TipoProducaoSubetapasCardProps) {
  const navigate = useNavigate();
  const [macro, setMacro] = useState<'judicial' | 'extrajudicial' | null>(propMacro || null);
  const [subtype, setSubtype] = useState<string | null>(propSubtype || null);
  const [todoistStatus, setTodoistStatus] = useState<string>(propTodoistStatus || 'aguardando');
  const [todoistId, setTodoistId] = useState<string>(propTodoistTaskId || '');
  const [loading, setLoading] = useState(!propMacro && !propSubtype && !!caseId);

  useEffect(() => {
    if (propMacro !== undefined) setMacro(propMacro);
    if (propSubtype !== undefined) setSubtype(propSubtype);
    if (propTodoistStatus !== undefined) setTodoistStatus(propTodoistStatus);
    if (propTodoistTaskId !== undefined) setTodoistId(propTodoistTaskId);
  }, [propMacro, propSubtype, propTodoistStatus, propTodoistTaskId]);

  useEffect(() => {
    if (!caseId) return;
    if (propMacro && propSubtype) {
      setLoading(false);
      return;
    }

    const fetchCaseDetails = async () => {
      try {
        const caseSnap = await getDoc(doc(db, 'cases', caseId));
        if (caseSnap.exists()) {
          const caseData = caseSnap.data();
          if (!propMacro) {
            const regTypeKey = caseData.registrationTypeKey || '';
            const resolvedMacro = caseData.serviceMacroType || 
              (regTypeKey.includes('judicial') || regTypeKey.includes('peticao') ? 'judicial' : 'extrajudicial');
            setMacro(resolvedMacro);
          }
          if (!propSubtype) {
            setSubtype(caseData.serviceSubtype || caseData.registrationTypeKey || null);
          }
          if (!propTodoistStatus) {
            setTodoistStatus(caseData.todoistAutomationStatus || 'aguardando');
          }
          if (!propTodoistTaskId) {
            setTodoistId(caseData.todoistTaskId || '');
          }
        }
      } catch (err) {
        console.error("Error loading case in TipoProducaoSubetapasCard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseDetails();
  }, [caseId, propMacro, propSubtype, propTodoistStatus, propTodoistTaskId]);

  if (!caseId) return null;

  const basePath = `/boss-giffoni-clientes/fluxo-producao/${caseId}/tipo-producao`;

  // Determine dynamics
  const step2Macro = macro || 'judicial';
  const step2Label = step2Macro === 'extrajudicial' ? 'Serviço Extrajudicial' : 'Serviço Judicial';
  const step2Icon = step2Macro === 'extrajudicial' ? Briefcase : Scale;

  const step3Subtype = (subtype === 'peticao_inicial' || subtype === 'peticao-inicial') ? 'peticao-inicial' : (subtype || 'peticao-inicial');
  
  let step3Label = 'Cadastrando Petição Inicial no Todoist';
  if (step3Subtype === 'processo-judicial-em-andamento') {
    step3Label = 'Cadastrando Processo em Andamento';
  } else if (step3Subtype === 'requerimento-administrativo') {
    step3Label = 'Cadastrando Requerimento Administrativo';
  } else if (step3Subtype === 'outro-servico-administrativo') {
    step3Label = 'Cadastrando Outro Serviço no Todoist';
  }

  // 1. Segmento da Demanda
  const step1Completed = currentStep !== 'natureza';
  const step1IsCurrent = currentStep === 'natureza';

  // 2. Serviço Judicial / Extrajudicial
  const step2Completed = currentStep === 'form';
  const step2IsCurrent = currentStep === 'judicial' || currentStep === 'extrajudicial';

  // 3. Cadastrando no Todoist
  const step3Completed = todoistStatus === 'criado' || !!todoistId;
  const step3IsCurrent = currentStep === 'form';

  const steps = [
    {
      key: 'natureza',
      label: 'Selecione o Segmento da Demanda',
      path: basePath,
      icon: Layers,
      completed: step1Completed,
      isCurrent: step1IsCurrent,
      indexLabel: '01 / 03'
    },
    {
      key: 'judicial-extrajudicial',
      label: step2Label,
      path: `${basePath}/${step2Macro}`,
      icon: step2Icon,
      completed: step2Completed,
      isCurrent: step2IsCurrent,
      indexLabel: '02 / 03'
    },
    {
      key: 'form',
      label: step3Label,
      path: `${basePath}/${step3Subtype}`,
      icon: CheckSquare,
      completed: step3Completed,
      isCurrent: step3IsCurrent,
      indexLabel: '03 / 03'
    }
  ];

  return (
    <div id="tipo-producao-subetapas-card" className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
          Subetapas do Tipo de Serviço
        </h3>
        <p className="text-[12px] text-gray-400 font-semibold mt-0.5">
          Progrida pelas definições fáticas da demanda do cliente e homologação automática da fórmula de trabalho no Todoist.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => {
          const IconComponent = step.icon;
          const isCurrent = step.isCurrent;

          let btnClass = '';
          if (isCurrent) {
            btnClass = 'bg-indigo-600 border-indigo-600 text-white shadow-xs scale-[1.01] transform transition-all';
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
              className={`flex items-center justify-between p-4 border rounded-2xl text-left cursor-pointer outline-none relative overflow-hidden group ${btnClass}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl shrink-0 ${isCurrent ? 'bg-indigo-500 text-white' : step.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-150 text-gray-500'}`}>
                  <IconComponent size={16} />
                </div>
                <div className="min-w-0">
                  <span className={`text-[9px] uppercase font-black tracking-widest block font-mono ${isCurrent ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {step.indexLabel}
                  </span>
                  <span className="text-[12px] font-extrabold tracking-tight block leading-tight mt-1 truncate">
                    {step.label}
                  </span>
                </div>
              </div>

              {step.completed && !isCurrent && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 ml-2">
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
