export const EDRP_STAGES = [
  { id: 'cadastro', label: 'Cadastro', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'tipo_cadastro', label: 'Tipo de Cadastro', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'coleta_informacoes', label: 'Coleta de Informações', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'coleta_provas', label: 'Coleta de Provas', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'financeiro', label: 'Financeiro', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'estruturacao', label: 'Estruturação', color: 'bg-violet-50 text-violet-700 border-violet-100' },
  { id: 'delegacao', label: 'Delegação', color: 'bg-pink-50 text-pink-700 border-pink-100' },
  { id: 'agendamentos', label: 'Agendamentos', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'revisao', label: 'Revisão', color: 'bg-rose-50 text-rose-700 border-rose-100' },
  { id: 'agendamento_protocolo', label: 'Agendamento de Protocolo', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  { id: 'controladoria', label: 'Controladoria', color: 'bg-purple-50 text-purple-700 border-purple-100' },
  { id: 'arquivamento', label: 'Arquivamento', color: 'bg-gray-100 text-gray-700 border-gray-200' },
] as const;

export type EDRPStageId = typeof EDRP_STAGES[number]['id'];

export const REGISTRATION_TYPES = [
  { id: 'peticao_inicial', label: 'Petição Inicial' },
  { id: 'requerimento_administrativo', label: 'Requerimento Administrativo' },
  { id: 'extrajudicial', label: 'Extrajudicial' },
  { id: 'processo_judicial_em_andamento', label: 'Processo Judicial em Andamento' },
  { id: 'processo_judicial_ajuizado', label: 'Processo Judicial Ajuizado' }
] as const;

export type RegistrationTypeId = typeof REGISTRATION_TYPES[number]['id'];

export const REVIEW_STATUSES = [
  { id: 'aguardando_revisao', label: 'Aguardando Revisão' },
  { id: 'em_revisao', label: 'Em Revisão' },
  { id: 'ajustes_solicitados', label: 'Ajustes Solicitados' },
  { id: 'aprovado', label: 'Aprovado' },
  { id: 'reprovado', label: 'Reprovado' }
] as const;

export type ReviewStatusId = typeof REVIEW_STATUSES[number]['id'];

export const PROTOCOL_STATUSES = [
  { id: 'nao_aplicavel', label: 'Não Aplicável' },
  { id: 'aguardando', label: 'Aguardando' },
  { id: 'agendado', label: 'Agendado' },
  { id: 'protocolado', label: 'Protocolado' },
  { id: 'pendente', label: 'Pendente' },
  { id: 'cancelado', label: 'Cancelado' }
] as const;

export type ProtocolStatusId = typeof PROTOCOL_STATUSES[number]['id'];

export const CONTROLADORIA_STATUSES = [
  { id: 'nao_enviado', label: 'Não Enviado' },
  { id: 'enviado_controladoria', label: 'Enviado à Controladoria' },
  { id: 'em_conferencia', label: 'Em Conferência' },
  { id: 'concluido', label: 'Concluído' }
] as const;

export type ControladoriaStatusId = typeof CONTROLADORIA_STATUSES[number]['id'];

export function getStageLabel(id: string): string {
  const stage = EDRP_STAGES.find(s => s.id === id);
  return stage ? stage.label : 'Indefinido';
}

export function getStageColor(id: string): string {
  const stage = EDRP_STAGES.find(s => s.id === id);
  return stage ? stage.color : 'bg-gray-50 text-gray-500 border-gray-100';
}

export function getRegTypeLabel(id: string): string {
  const type = REGISTRATION_TYPES.find(t => t.id === id);
  return type ? type.label : 'Não Definido';
}

export function mapRegTypeToActionCategory(regType: string): 'judicial' | 'administrativo' | 'extrajudicial' {
  if (
    regType === 'peticao_inicial' ||
    regType === 'processo_judicial_em_andamento' ||
    regType === 'processo_judicial_ajuizado'
  ) {
    return 'judicial';
  }
  if (regType === 'requerimento_administrativo') {
    return 'administrativo';
  }
  return 'extrajudicial';
}
