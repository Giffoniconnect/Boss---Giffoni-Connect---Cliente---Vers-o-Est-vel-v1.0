import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Trash2, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Eye, 
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { TodoistLeadAutomationConfig } from './todoistLeadAutomationTypes';
import { 
  DEFAULT_TODOIST_LEAD_CONFIG, 
  fetchTodoistProjects, 
  fetchTodoistSections, 
  fetchTodoistCollaborators,
  renderLeadTodoistPayload
} from './todoistLeadAutomationService';

interface LeadTodoistSettingsProps {
  lead: any;
  tipoPessoa: 'PF' | 'PJ';
  config: TodoistLeadAutomationConfig;
  onSave: (newConfig: TodoistLeadAutomationConfig) => Promise<void>;
  onLog: (level: 'info' | 'success' | 'warning' | 'error', step: string, message: string, details?: any) => void;
}

export const LeadTodoistSettings: React.FC<LeadTodoistSettingsProps> = ({
  lead,
  tipoPessoa,
  config,
  onSave,
  onLog
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<TodoistLeadAutomationConfig>({ ...config });
  
  // Dynamic fetches
  const [projects, setProjects] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  
  // UI states
  const [showPayload, setShowPayload] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync with prop when it updates
  useEffect(() => {
    setLocalConfig({ ...config });
  }, [config]);

  // Load dropdown lists when panel opens
  useEffect(() => {
    if (!isOpen) return;

    const loadDropdownData = async () => {
      setLoadingDropdowns(true);
      onLog('info', 'CONFIG_PANEL_OPENED', 'Painel de configurações do Todoist aberto. Carregando dados da API.');
      try {
        const projs = await fetchTodoistProjects();
        setProjects(projs);
        
        const currentProjId = localConfig.projectId || projs[0]?.id || '';
        if (currentProjId) {
          const [sects, collabs] = await Promise.all([
            fetchTodoistSections(currentProjId),
            fetchTodoistCollaborators(currentProjId)
          ]);
          setSections(sects);
          setCollaborators(collabs);
        }
      } catch (err: any) {
        onLog('error', 'CONFIG_LOAD_FAILED', 'Falha ao carregar opções do Todoist.', { error: err.message });
      } finally {
        setLoadingDropdowns(false);
      }
    };

    loadDropdownData();
  }, [isOpen]);

  // Load sections and collaborators when project changes
  const handleProjectChange = async (projectId: string, projectName: string) => {
    setLocalConfig(prev => ({
      ...prev,
      projectId,
      projectName,
      sectionId: '',
      sectionName: '',
      assigneeId: '',
      assigneeName: ''
    }));

    if (!projectId) {
      setSections([]);
      setCollaborators([]);
      return;
    }

    try {
      const [sects, collabs] = await Promise.all([
        fetchTodoistSections(projectId),
        fetchTodoistCollaborators(projectId)
      ]);
      setSections(sects);
      setCollaborators(collabs);
      onLog('info', 'PROJECT_CHANGED_IN_CONFIG', `Projeto alterado para ${projectName}. Carregando seções e colaboradores.`, { projectId });
    } catch (err: any) {
      onLog('error', 'PROJECT_DROPDOWNS_FAILED', 'Erro ao atualizar seções ou colaboradores para o projeto.', { error: err.message });
    }
  };

  // Test current configuration
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    onLog('info', 'CONFIG_TEST_STARTED', 'Iniciando teste de configurações do Todoist.');

    try {
      const res = await fetch('/api/todoist/diagnostics');
      const data = await res.json();
      
      if (!data.success || !data.tokenConfigured) {
        throw new Error('Chave de API do Todoist (TODOIST_API_TOKEN) não configurada no ambiente.');
      }

      if (!data.canReachTodoistApi) {
        throw new Error('A API do Todoist está inacessível ou o token fornecido é inválido.');
      }

      // Check if project exists
      const projs = await fetchTodoistProjects();
      const projectExists = projs.some(p => p.id === localConfig.projectId || p.name === localConfig.projectName);
      
      if (localConfig.projectId && !projectExists) {
        throw new Error(`Projeto "${localConfig.projectName || localConfig.projectId}" não foi encontrado no Todoist.`);
      }

      setTestResult({
        success: true,
        message: 'Tudo pronto! Autenticação bem-sucedida e projeto validado com sucesso no Todoist.'
      });
      onLog('success', 'CONFIG_TEST_SUCCESS', 'Teste de configurações concluído com sucesso.');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erro durante a validação da configuração.'
      });
      onLog('error', 'CONFIG_TEST_FAILED', 'Teste de configurações falhou.', { error: err.message });
    } finally {
      setTesting(false);
    }
  };

  // Save current configurations
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    onLog('info', 'CONFIG_SAVE_STARTED', 'Iniciando persistência das configurações da automação.');

    try {
      const payload: TodoistLeadAutomationConfig = {
        ...localConfig,
        updatedAt: new Date().toISOString(),
        validationStatus: testResult ? (testResult.success ? 'valid' : 'invalid') : 'not_validated',
        lastValidatedAt: testResult ? new Date().toISOString() : localConfig.lastValidatedAt
      };
      
      await onSave(payload);
      setSaveSuccess(true);
      onLog('success', 'CONFIG_SAVE_SUCCESS', 'Configurações de automação do Todoist salvas com sucesso.');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      onLog('error', 'CONFIG_SAVE_FAILED', 'Falha ao salvar configurações.', { error: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default configurations
  const handleReset = () => {
    const confirmed = window.confirm('Tem certeza de que deseja restaurar as configurações padrão de fábrica da automação?');
    if (confirmed) {
      setLocalConfig({ ...DEFAULT_TODOIST_LEAD_CONFIG });
      onLog('warning', 'CONFIG_RESET_TO_DEFAULTS', 'Configurações restauradas para o padrão de fábrica.');
    }
  };

  const interpretedPayload = renderLeadTodoistPayload(lead, tipoPessoa, localConfig);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-250 rounded-xl text-xs font-bold tracking-tight transition cursor-pointer shadow-3xs focus:ring-2 focus:ring-emerald-400 focus:outline-hidden"
        title="Configurações da automação"
      >
        <Settings size={14} className={isOpen ? 'animate-spin' : ''} />
        <span>⚙️ Configurações da automação de LEAD no Todoist</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="bg-slate-50 border border-emerald-100 rounded-2xl p-5 space-y-6 animate-fade-in shadow-2xs">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div>
              <h4 className="text-sm font-black text-emerald-950 uppercase tracking-tight">
                Painel de Configurações — Automação de Leads
              </h4>
              <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                Customize templates, regras de atribuição e seções de destino sem tocar em código.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Restaurar padrão de fábrica"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: Essential Todoist Destinations */}
            <div className="space-y-4">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1">
                1. Destino da Tarefa no Todoist
              </span>

              {/* Project select */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Projeto do Todoist</label>
                <select
                  value={localConfig.projectId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const name = e.target.options[e.target.selectedIndex].text;
                    handleProjectChange(id, name);
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 focus:bg-white outline-none transition"
                >
                  <option value="">Caixa de Entrada (Inbox)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Section select */}
              {localConfig.projectId && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Seção de Destino</label>
                  <select
                    value={localConfig.sectionId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = e.target.options[e.target.selectedIndex].text;
                      setLocalConfig(prev => ({ ...prev, sectionId: id, sectionName: id ? name : '' }));
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                  >
                    <option value="">Nenhuma (Fundo do Projeto)</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assignee select */}
              {localConfig.projectId && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Responsável pela Tarefa</label>
                  <select
                    value={localConfig.assigneeId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = e.target.options[e.target.selectedIndex].text;
                      setLocalConfig(prev => ({ ...prev, assigneeId: id, assigneeName: id ? name : 'giffonisecretaria' }));
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                  >
                    <option value="">Nenhum (Manter giffonisecretaria)</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1 pt-2">
                2. Configurações da Demanda
              </span>

              {/* Title Template */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Template de Título</label>
                <input
                  type="text"
                  value={localConfig.titleTemplate}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, titleTemplate: e.target.value }))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                  placeholder="{{lead.nomeCompleto}} - {{lead.tipoAtendimentoMarketing}}"
                />
                <span className="text-[9px] text-gray-400 mt-1 block">Variáveis: {'{{lead.nomeCompleto}}'}, {'{{lead.tipoAtendimentoMarketing}}'}</span>
              </div>

              {/* Tipo Atendimento Padrao */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Atendimento de Marketing Padrão</label>
                <input
                  type="text"
                  value={localConfig.tipoAtendimentoPadrao}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, tipoAtendimentoPadrao: e.target.value }))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                />
              </div>

              {/* Origem do Tipo Atendimento */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Origem do Tipo de Atendimento</label>
                <select
                  value={localConfig.origemTipoAtendimento}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, origemTipoAtendimento: e.target.value as any }))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                >
                  <option value="fixed">Fixo (Valor Definido Acima)</option>
                  <option value="origemLead">Origem do Lead (WhatsApp, Indicação, etc.)</option>
                </select>
              </div>
            </div>

            {/* Right Column: Descriptions & Extra Rules */}
            <div className="space-y-4">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1">
                3. Corpo & Detalhamento da Tarefa
              </span>

              {/* Priority */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prioridade do Todoist</label>
                <select
                  value={localConfig.priority}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                >
                  <option value="p1">p1 (Muito Urgente - Vermelho)</option>
                  <option value="p2">p2 (Alta - Laranja)</option>
                  <option value="p3">p3 (Média - Azul)</option>
                  <option value="p4">p4 (Normal - Cinza)</option>
                </select>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Recorrência (Frequência)</label>
                <input
                  type="text"
                  value={localConfig.recurrence}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, recurrence: e.target.value }))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                  placeholder="todo dia útil"
                />
              </div>

              {/* Description template */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Template da Descrição</label>
                <textarea
                  rows={6}
                  value={localConfig.descriptionTemplate}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, descriptionTemplate: e.target.value }))}
                  className="w-full text-xs font-mono font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition leading-normal"
                />
              </div>

              {/* Behavior on missing data */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tratamento de Dados Ausentes</label>
                <select
                  value={localConfig.behaviorOnMissingData}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, behaviorOnMissingData: e.target.value as any }))}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:border-emerald-400 outline-none transition"
                >
                  <option value="show_placeholder">Mostrar Placeholders (ex. [TELEFONE PENDENTE])</option>
                  <option value="omit_line">Omitir a Linha Inteira</option>
                  <option value="block">Bloquear Envio & Exigir Correção</option>
                </select>
              </div>
            </div>
          </div>

          {/* accessory preview */}
          <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowPayload(!showPayload)}
              className="w-full flex items-center justify-between text-xs font-black text-slate-700 tracking-tight transition"
            >
              <span>{showPayload ? 'Esconder' : 'Ver'} campos interpretados da tarefa</span>
              {showPayload ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPayload && (
              <div className="space-y-3 pt-2 text-xs border-t border-gray-150 animate-fade-in font-medium">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Campo</div>
                  <div className="col-span-2 text-gray-400 font-bold uppercase text-[9px]">Valor Interpretado</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-50">
                  <div className="font-bold text-slate-500">Projeto</div>
                  <div className="col-span-2 text-slate-900 font-semibold">{localConfig.projectName || 'Caixa de Entrada'}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-50">
                  <div className="font-bold text-slate-500">Título</div>
                  <div className="col-span-2 text-slate-900 font-semibold">{interpretedPayload.title || '[NOME COMPLETO DO LEAD PENDENTE]'}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-50">
                  <div className="font-bold text-slate-500">Responsável</div>
                  <div className="col-span-2 text-slate-900 font-semibold">{localConfig.assigneeName || 'giffonisecretaria'}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-50">
                  <div className="font-bold text-slate-500">Prioridade</div>
                  <div className="col-span-2 text-slate-900 font-semibold">{localConfig.priority} (API: {interpretedPayload.priority})</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-50">
                  <div className="font-bold text-slate-500">Recorrência</div>
                  <div className="col-span-2 text-slate-900 font-semibold">{localConfig.recurrence} (API: {interpretedPayload.dueString})</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="font-bold text-slate-500">Descrição</div>
                  <pre className="col-span-2 text-slate-800 bg-slate-50 p-2 rounded-lg font-mono text-[10px] whitespace-pre-wrap leading-relaxed">{interpretedPayload.description}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Testing and Saving */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-emerald-100">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                disabled={testing || saving}
                onClick={handleTest}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                {testing ? <RefreshCw size={12} className="animate-spin text-emerald-600" /> : <Settings size={12} />}
                <span>Testar configurações</span>
              </button>

              <button
                type="button"
                disabled={saving || testing}
                onClick={handleSave}
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {saving ? <RefreshCw size={12} className="animate-spin text-white" /> : <Check size={12} />}
                <span>{saving ? 'Salvando...' : 'Salvar configurações'}</span>
              </button>
            </div>

            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-black animate-bounce mt-2 sm:mt-0">
                <CheckCircle size={14} />
                <span>Configurações salvas com sucesso no banco!</span>
              </div>
            )}
          </div>

          {/* Test results indicator */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed font-semibold flex items-start gap-2 ${testResult.success ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 'bg-red-50 border-red-150 text-red-800'}`}>
              {testResult.success ? <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />}
              <div>
                <span className="font-bold uppercase block tracking-wider mb-0.5">{testResult.success ? 'Diagnóstico Positivo' : 'Falha de Validação'}</span>
                {testResult.message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
