import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { TodoistLeadAutomationConfig, TodoistAutomationData, TodoistTechLog } from './todoistLeadAutomationTypes';

export const DEFAULT_TODOIST_LEAD_CONFIG: TodoistLeadAutomationConfig = {
  projectId: '',
  projectName: 'LEADS 3',
  sectionId: '',
  sectionName: '',
  titleTemplate: '{{lead.nomeCompleto}} - {{lead.tipoAtendimentoMarketing}}',
  tipoAtendimentoPadrao: '1º Atendimento',
  origemTipoAtendimento: 'fixed',
  assigneeId: '',
  assigneeName: 'giffonisecretaria',
  priority: 'p1',
  recurrence: 'todo dia útil',
  recurrenceLanguage: 'pt',
  labels: [],
  descriptionTemplate: `LEAD: {{lead.nomeCompleto}}

Tipo de atendimento:
{{lead.tipoAtendimentoMarketing}}

Área jurídica:
{{lead.areaJuridica}}

Assunto:
{{lead.assunto}}

Telefone:
{{lead.telefone}}

E-mail:
{{lead.email}}

Origem:
{{lead.origem}}`,
  includeName: true,
  includeAreaJuridica: true,
  includeAssunto: true,
  includeTelefone: true,
  includeEmail: true,
  includeOrigem: true,
  includeReferralName: true,
  orderOfElements: ['name', 'marketing', 'area', 'assunto', 'telefone', 'email', 'origem', 'referral'],
  separators: ' - ',
  behaviorOnMissingData: 'show_placeholder',
  behaviorOnExistingTask: 'warn',
  autoOpenCreatedTask: false,
  allowUpdatingExistingTask: false,
  isAutomationEnabled: true,
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  lastValidatedAt: '',
  validationStatus: 'not_validated'
};

// 1. Load Configurations from Firestore settings/todoistLeadAutomation
export async function loadTodoistLeadConfig(): Promise<TodoistLeadAutomationConfig> {
  try {
    const docRef = doc(db, 'settings', 'todoistLeadAutomation');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return {
        ...DEFAULT_TODOIST_LEAD_CONFIG,
        ...snap.data()
      } as TodoistLeadAutomationConfig;
    }
  } catch (err) {
    console.error('[Todoist Service] Error loading configuration from Firestore:', err);
  }
  return DEFAULT_TODOIST_LEAD_CONFIG;
}

// 2. Save Configurations to Firestore settings/todoistLeadAutomation
export async function saveTodoistLeadConfig(config: TodoistLeadAutomationConfig): Promise<boolean> {
  try {
    const docRef = doc(db, 'settings', 'todoistLeadAutomation');
    await setDoc(docRef, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[Todoist Service] Error saving configuration to Firestore:', err);
    return false;
  }
}

// 3. Fetch Projects
export async function fetchTodoistProjects(): Promise<any[]> {
  try {
    const res = await fetch('/api/todoist/projects');
    if (!res.ok) throw new Error('Falha ao buscar projetos do Todoist.');
    const data = await res.json();
    return data.success && Array.isArray(data.projects) ? data.projects : [];
  } catch (err) {
    console.error('[Todoist Service] Error fetching projects:', err);
    return [];
  }
}

// 4. Fetch Sections
export async function fetchTodoistSections(projectId: string): Promise<any[]> {
  if (!projectId) return [];
  try {
    const res = await fetch(`/api/todoist/sections?projectId=${projectId}`);
    if (!res.ok) throw new Error('Falha ao buscar seções do Todoist.');
    const data = await res.json();
    return data.success && Array.isArray(data.sections) ? data.sections : [];
  } catch (err) {
    console.error('[Todoist Service] Error fetching sections:', err);
    return [];
  }
}

// 5. Fetch Collaborators (Assignees)
export async function fetchTodoistCollaborators(projectId: string): Promise<any[]> {
  if (!projectId) return [];
  try {
    const res = await fetch(`/api/todoist/collaborators?projectId=${projectId}`);
    if (!res.ok) throw new Error('Falha ao buscar colaboradores do Todoist.');
    const data = await res.json();
    return data.success && Array.isArray(data.collaborators) ? data.collaborators : [];
  } catch (err) {
    console.error('[Todoist Service] Error fetching collaborators:', err);
    return [];
  }
}

// Helper to resolve lead data
export function getLeadDataCarryOn(lead: any, tipoPessoa: 'PF' | 'PJ', config: TodoistLeadAutomationConfig) {
  const isPF = tipoPessoa === 'PF';
  const rawNome = isPF
    ? (lead?.pessoaFisica?.nomeCompleto)
    : (lead?.pessoaJuridica?.nomeFantasia || lead?.pessoaJuridica?.razaoSocial || lead?.pessoaJuridica?.nomeCompleto);
  const nomeCompleto = (rawNome || '').trim();

  const email = isPF ? (lead?.pessoaFisica?.email || '') : (lead?.pessoaJuridica?.email || '');
  const telefone = isPF ? (lead?.pessoaFisica?.telefone || '') : (lead?.pessoaJuridica?.telefone || '');
  const areaJuridica = lead?.areaJuridica || '';
  const assunto = lead?.assunto || '';
  const origem = lead?.origemLead || '';
  const indicadoPorNome = lead?.indicadoPorNome || '';

  // Resolve marketing type
  let tipoAtendimentoMarketing = lead?.tipoAtendimentoMarketing || '';
  if (!tipoAtendimentoMarketing) {
    if (config.origemTipoAtendimento === 'origemLead') {
      tipoAtendimentoMarketing = lead?.origemLead || '';
    } else {
      tipoAtendimentoMarketing = config.tipoAtendimentoPadrao || '1º Atendimento';
    }
  }

  return {
    nomeCompleto,
    email,
    telefone,
    areaJuridica,
    assunto,
    origem,
    indicadoPorNome,
    tipoAtendimentoMarketing
  };
}

// Helper to build the Title and Description based on templates and configurations
export function renderLeadTodoistPayload(lead: any, tipoPessoa: 'PF' | 'PJ', config: TodoistLeadAutomationConfig) {
  const resolved = getLeadDataCarryOn(lead, tipoPessoa, config);

  const formatValue = (val: string, placeholder: string) => {
    if (val) return val;
    if (config.behaviorOnMissingData === 'show_placeholder') return placeholder;
    return '';
  };

  const finalName = formatValue(resolved.nomeCompleto, '[NOME DO LEAD PENDENTE]');
  const finalMarketing = formatValue(resolved.tipoAtendimentoMarketing, '[TIPO DE ATENDIMENTO PENDENTE]');
  const finalArea = formatValue(resolved.areaJuridica, '[ÁREA JURÍDICA PENDENTE]');
  const finalAssunto = formatValue(resolved.assunto, '[ASSUNTO PENDENTE]');
  const finalTelefone = formatValue(resolved.telefone, '[TELEFONE PENDENTE]');
  const finalEmail = formatValue(resolved.email, '[E-MAIL PENDENTE]');
  const finalOrigem = formatValue(resolved.origem, '[ORIGEM PENDENTE]');
  const finalReferral = resolved.indicadoPorNome ? `Indicado por: ${resolved.indicadoPorNome}` : '';

  // Title render
  // Default template: {{lead.nomeCompleto}} - {{lead.tipoAtendimentoMarketing}}
  let title = config.titleTemplate || '{{lead.nomeCompleto}} - {{lead.tipoAtendimentoMarketing}}';
  title = title.replace(/\{\{lead\.nomeCompleto\}\}/gi, finalName);
  title = title.replace(/\{\{lead\.tipoAtendimentoMarketing\}\}/gi, finalMarketing);
  title = title.replace(/\{\{lead\.areaJuridica\}\}/gi, finalArea);
  title = title.replace(/\{\{lead\.assunto\}\}/gi, finalAssunto);
  title = title.replace(/\{\{lead\.telefone\}\}/gi, finalTelefone);

  // Description render
  let description = config.descriptionTemplate || '';
  description = description.replace(/\{\{lead\.nomeCompleto\}\}/gi, finalName);
  description = description.replace(/\{\{lead\.tipoAtendimentoMarketing\}\}/gi, finalMarketing);
  description = description.replace(/\{\{lead\.areaJuridica\}\}/gi, finalArea);
  description = description.replace(/\{\{lead\.assunto\}\}/gi, finalAssunto);
  description = description.replace(/\{\{lead\.telefone\}\}/gi, finalTelefone);
  description = description.replace(/\{\{lead\.email\}\}/gi, finalEmail);
  description = description.replace(/\{\{lead\.origem\}\}/gi, finalOrigem);

  // Sanitize description lines where data is completely missing and behavior is set to omit_line
  if (config.behaviorOnMissingData === 'omit_line') {
    const lines = description.split('\n');
    const filteredLines = lines.filter(line => {
      // If line contains colon and right side is empty/whitespace, omit
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const rightSide = line.slice(colonIndex + 1).trim();
        if (!rightSide) return false;
      }
      return true;
    });
    description = filteredLines.join('\n');
  }

  // Map priority: p1 -> 4, p2 -> 3, p3 -> 2, p4 -> 1
  const priorityMap: Record<string, number> = {
    p1: 4,
    p2: 3,
    p3: 2,
    p4: 1
  };
  const priorityValue = priorityMap[config.priority] || 1;

  // Resolve recurrence text to english for API if needed
  let dueString = config.recurrence || '';
  if (config.recurrenceLanguage === 'pt' || !config.recurrenceLanguage) {
    if (dueString.toLowerCase().trim() === 'todo dia útil') {
      dueString = 'every workday';
    }
  }

  return {
    title: title.trim(),
    description: description.trim(),
    priority: priorityValue,
    dueString,
    projectId: config.projectId,
    sectionId: config.sectionId,
    labels: config.labels || []
  };
}
