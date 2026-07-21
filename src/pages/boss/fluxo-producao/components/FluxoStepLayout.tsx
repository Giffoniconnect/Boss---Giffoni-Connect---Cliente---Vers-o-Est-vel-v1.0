import React from 'react';
import { BossLayout } from '../../../../components/Layout';
import FluxoSidebar from './FluxoSidebar';
import ColetaProvasSubetapasCard from './ColetaProvasSubetapasCard';
import TipoProducaoSubetapasCard from './TipoProducaoSubetapasCard';
import OnboardingSubetapasCard from './OnboardingSubetapasCard';

interface FluxoStepLayoutProps {
  children: React.ReactNode;
  stepName: string;
  caseId?: string;
  statusText?: string;
  coletaSubetapasStep?: 'procuracao' | 'declaracao' | 'documentos-minimos' | 'documentos-necessidade' | 'documentos-consolidado' | 'documentos-auditoria' | 'inicio';
  wizardState?: any;
  tipoPessoa?: 'PF' | 'PJ';
  tipoProducaoSubetapasStep?: 'natureza' | 'judicial' | 'extrajudicial' | 'form';
  serviceMacroType?: 'judicial' | 'extrajudicial' | null;
  serviceSubtype?: string | null;
  todoistAutomationStatus?: string;
  todoistTaskId?: string;
}

export default function FluxoStepLayout({
  children,
  stepName,
  caseId,
  statusText = 'estrutura preparada',
  coletaSubetapasStep,
  wizardState,
  tipoPessoa,
  tipoProducaoSubetapasStep,
  serviceMacroType,
  serviceSubtype,
  todoistAutomationStatus,
  todoistTaskId
}: FluxoStepLayoutProps) {
  return (
    <BossLayout>
      <div className="flex flex-col gap-6">
        {/* Fused Stepper + progress tracking in single horizontal tracker */}
        <FluxoSidebar caseId={caseId} />

        {stepName === 'Onboarding' && (
          <OnboardingSubetapasCard caseId={caseId} />
        )}

        {coletaSubetapasStep && (
          <ColetaProvasSubetapasCard
            caseId={caseId}
            tipoPessoa={tipoPessoa}
            wizardState={wizardState}
            currentStep={coletaSubetapasStep}
          />
        )}

        {tipoProducaoSubetapasStep && (
          <TipoProducaoSubetapasCard
            caseId={caseId}
            currentStep={tipoProducaoSubetapasStep}
            serviceMacroType={serviceMacroType}
            serviceSubtype={serviceSubtype}
            todoistAutomationStatus={todoistAutomationStatus}
            todoistTaskId={todoistTaskId}
          />
        )}
        
        {/* Full-width container with generous padding for spacious typing */}
        <div className="w-full min-w-0 bg-white border border-gray-150 rounded-[2.5rem] p-8 md:p-10 shadow-sm">
          {children}
        </div>
      </div>
    </BossLayout>
  );
}

