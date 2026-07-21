import { FlowRouteKey } from './flowRoutes';

export interface FlowStep {
  id: string;
  label: string;
  routeKey: FlowRouteKey;
  requiresCaseId: boolean;
  order: number;
  matchPaths?: string[];
}

export const flowSteps: FlowStep[] = [
  { id: 'cadastro', label: '1.1/1.2 Cadastro (PF/PJ)', routeKey: 'cadastro', requiresCaseId: false, order: 1 },
  { id: 'onboarding', label: 'Onboarding ✈️', routeKey: 'onboarding', requiresCaseId: true, order: 2, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/onboarding'] },
  { id: 'dados-caso', label: '1.3/1.3.1 Entrevista (5W2H)', routeKey: 'dadosCaso', requiresCaseId: true, order: 3 },
  { id: 'tipo-producao', label: '1.3.2 Tipo de Serviço', routeKey: 'tipoServico', requiresCaseId: true, order: 4, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/tipo-producao'] },
  { id: 'financeiro', label: 'Financeiro (Faturamento)', routeKey: 'financeiro', requiresCaseId: true, order: 5, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/financeiro'] },
  { 
    id: 'solicitacoes-provas', 
    label: '1.4 Coletar Provas', 
    routeKey: 'solicitacoesProvas', 
    requiresCaseId: true, 
    order: 6,
    matchPaths: [
      '/boss-giffoni-clientes/fluxo-producao/:caseId/card-iniciar-coleta-obrigatoria',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-procuracao-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-procuracao-PJ',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-declaracao-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-declaracao-PJ',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-contrato-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-contrato-PJ',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-minimos-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-minimos-PJ',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-necessidade-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-necessidade-PJ',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-auditoria-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-auditoria-PJ',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-consolidado-PF',
      '/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacao-documentos-consolidado-PJ'
    ]
  },
  { id: 'digitalizacao-upload', label: '1.5 Digitalização & Upload', routeKey: 'digitalizacaoUpload', requiresCaseId: true, order: 7, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/digitalizacao-upload'] },
  { id: 'edrp', label: '1.6 Estruturação (EDRP)', routeKey: 'edrp', requiresCaseId: true, order: 8, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/edrp'] },
  { id: 'pre-peticionamento-ia', label: '1.7 Pré-Peticionamento com IA', routeKey: 'prePeticionamentoIa', requiresCaseId: true, order: 9, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/pre-peticionamento-ia'] },
  { id: 'delegacao', label: 'Delegação', routeKey: 'delegacao', requiresCaseId: true, order: 10 },
  { id: 'revisao', label: 'Revisão', routeKey: 'revisao', requiresCaseId: true, order: 11, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/revisao', '/boss-giffoni-clientes/fluxo-producao/:caseId/agendamento.de.revisao', '/boss-giffoni-clientes/fluxo-producao/:caseId/pre.revisao.com.IA', '/boss-giffoni-clientes/fluxo-producao/:caseId/decisao.sobre.revisao'] },
  { id: 'solicitacoes-informacoes', label: 'Solicitar ➕ informações', routeKey: 'solicitacoesInformacoes', requiresCaseId: true, order: 12 },
  { id: 'solicitacoes-provas-adicionais', label: 'Solicitar ➕ Provas', routeKey: 'solicitacoesProvasAdicionais', requiresCaseId: true, order: 13, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/solicitacoes-provas'] },
  { id: 'compliance', label: 'Compliance', routeKey: 'compliance', requiresCaseId: true, order: 14 },
  { id: 'protocolo', label: '15. Protocolo / Distribuição', routeKey: 'protocolo', requiresCaseId: true, order: 15 },
  { id: 'controladoria', label: '16. Controladoria', routeKey: 'controladoria', requiresCaseId: true, order: 16 },
  { id: 'prazos', label: '17. Prazos', routeKey: 'prazos', requiresCaseId: true, order: 17 },
  { id: 'agendar-audiencias', label: '18. Audiências', routeKey: 'agendarAudiencias', requiresCaseId: true, order: 18 },
  { id: 'agendar-pericia', label: '19. Perícias', routeKey: 'agendarPericia', requiresCaseId: true, order: 19 },
  { id: 'relatorio-integridade', label: '20. Relatório de Integridade e Auditoria', routeKey: 'relatorioIntegridade', requiresCaseId: true, order: 20 },
  { id: 'arquivamento', label: '21. Arquivamento', routeKey: 'arquivamento', requiresCaseId: true, order: 21, matchPaths: ['/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento', '/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento.financeiro', '/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento.todoist', '/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento.Gmail', '/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento.CRM.Cliente', '/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento.Google.Sheets', '/boss-giffoni-clientes/fluxo-producao/:caseId/arquivamento.auditoria'] },
];
