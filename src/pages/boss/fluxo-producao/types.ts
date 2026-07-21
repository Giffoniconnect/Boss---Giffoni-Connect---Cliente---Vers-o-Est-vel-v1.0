export type FlowStep =
  | 'inicio'
  | 'cadastro_cliente'
  | 'tipo_producao'
  | 'dados_caso'
  | 'coleta_informacoes'
  | 'coleta_provas'
  | 'financeiro'
  | 'estruturacao'
  | 'delegacao'
  | 'revisao'
  | 'protocolo'
  | 'controladoria'
  | 'relatorio_integridade'
  | 'recadastramento';

export type ClientSelectionMode = 'new_pf' | 'new_pj' | 'select';

export interface FlowState {
  step: FlowStep;
  caseId: string | null;
  clientId: string | null;
  slug: string;
}
