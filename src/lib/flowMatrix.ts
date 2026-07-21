export interface FlowMatrixEntry {
  leadType: 'PF' | 'PJ';
  currentStep: number;
  nextStep: number;
  currentRoute: string;
  nextRoute: string;
}

export const CANONICAL_FLOW_MATRIX: FlowMatrixEntry[] = [
  {
    leadType: 'PF',
    currentStep: 1,
    nextStep: 2,
    currentRoute: '/boss/cadastrar.leads/private/lead-pf',
    nextRoute: '/boss/cadastrar.leads/private/etapa02/:leadId'
  },
  {
    leadType: 'PJ',
    currentStep: 1,
    nextStep: 2,
    currentRoute: '/boss/cadastrar.leads/private/lead-pj',
    nextRoute: '/boss/cadastrar.leads/private/etapa02/:leadId'
  }
];

export function getNextStepRoute(leadType: 'PF' | 'PJ', currentStep: number, leadId: string): string {
  const entry = CANONICAL_FLOW_MATRIX.find(
    e => e.leadType === leadType && e.currentStep === currentStep
  );
  if (!entry) {
    throw new Error(`Rota da Etapa ${currentStep + 1} para o tipo ${leadType} inexistente na matriz canônica.`);
  }
  return entry.nextRoute.replace(':leadId', leadId);
}
