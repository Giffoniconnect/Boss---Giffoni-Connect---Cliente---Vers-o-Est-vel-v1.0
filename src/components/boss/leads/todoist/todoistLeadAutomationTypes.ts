export interface TodoistLeadAutomationConfig {
  projectId: string;
  projectName: string;
  sectionId: string;
  sectionName: string;
  titleTemplate: string;
  tipoAtendimentoPadrao: string;
  origemTipoAtendimento: 'fixed' | 'origemLead';
  assigneeId: string;
  assigneeName: string;
  priority: string; // p1, p2, p3, p4
  recurrence: string;
  recurrenceLanguage: string;
  labels: string[];
  descriptionTemplate: string;
  includeName: boolean;
  includeAreaJuridica: boolean;
  includeAssunto: boolean;
  includeTelefone: boolean;
  includeEmail: boolean;
  includeOrigem: boolean;
  includeReferralName: boolean;
  orderOfElements: string[];
  separators: string;
  behaviorOnMissingData: 'show_placeholder' | 'omit_line' | 'block';
  behaviorOnExistingTask: 'warn' | 'overwrite' | 'create_new';
  autoOpenCreatedTask: boolean;
  allowUpdatingExistingTask: boolean;
  isAutomationEnabled: boolean;
  version: string;
  updatedAt: string;
  lastValidatedAt: string;
  validationStatus: 'not_validated' | 'valid' | 'invalid';
  validationError?: string;
}

export interface TodoistAutomationData {
  taskId: string;
  taskUrl: string;
  taskContent: string;
  projectId: string;
  projectName: string;
  sectionId: string | null;
  sectionName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: string;
  recurrence: string | null;
  labels: string[];
  syncStatus: "not_sent" | "sending" | "created" | "update_pending" | "failed";
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  configurationVersion: string | null;
}

export interface TodoistTechLog {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  step: string;
  message: string;
  details?: any;
}
