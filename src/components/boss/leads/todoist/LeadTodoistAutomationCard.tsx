import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Send, 
  AlertCircle, 
  Settings, 
  FileCode2, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  Play
} from 'lucide-react';
import { motion } from 'motion/react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { TodoistLeadAutomationConfig, TodoistAutomationData, TodoistTechLog } from './todoistLeadAutomationTypes';
import { 
  DEFAULT_TODOIST_LEAD_CONFIG, 
  loadTodoistLeadConfig, 
  saveTodoistLeadConfig, 
  renderLeadTodoistPayload,
  getLeadDataCarryOn
} from './todoistLeadAutomationService';
import { TodoistFormatPreview } from './TodoistFormatPreview';
import { TodoistTaskLinkButton } from './TodoistTaskLinkButton';
import { LeadTodoistSettings } from './LeadTodoistSettings';

interface LeadTodoistAutomationCardProps {
  leadId: string | null | undefined;
  lead: any;
  tipoPessoa: 'PF' | 'PJ';
  onLeadUpdated?: (updatedFields: any) => void;
}

export const LeadTodoistAutomationCard: React.FC<LeadTodoistAutomationCardProps> = ({
  leadId,
  lead,
  tipoPessoa,
  onLeadUpdated
}) => {
  const [config, setConfig] = useState<TodoistLeadAutomationConfig>(DEFAULT_TODOIST_LEAD_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // Automation Statuses
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<'not_sent' | 'sending' | 'created' | 'failed' | 'warning'>('not_sent');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Local Logs
  const [logs, setLogs] = useState<TodoistTechLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [forceNewTask, setForceNewTask] = useState(false);

  // Load configurations and logs on mount/leadId change
  useEffect(() => {
    const initConfig = async () => {
      setLoadingConfig(true);
      const loaded = await loadTodoistLeadConfig();
      setConfig(loaded);
      setLoadingConfig(false);
    };
    initConfig();

    // Load logs if lead has them
    if (lead?.todoistAutomationLogs) {
      setLogs(lead.todoistAutomationLogs);
    } else {
      setLogs([]);
    }

    // Set initial status based on existing todoistAutomation
    if (lead?.todoistAutomation?.taskId) {
      setStatusText('created');
    } else {
      setStatusText('not_sent');
    }
  }, [leadId, lead]);

  const addLocalLog = (level: 'info' | 'success' | 'warning' | 'error', step: string, message: string, details?: any) => {
    const newLog: TodoistTechLog = {
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined
    };
    setLogs(prev => {
      const updated = [...prev, newLog];
      // Save logs back to lead document if lead is saved
      if (leadId) {
        const leadRef = doc(db, 'marketingLeads', leadId);
        setDoc(leadRef, { todoistAutomationLogs: updated }, { merge: true }).catch(err => {
          console.warn('Could not persist logs to Firestore:', err);
        });
      }
      return updated;
    });
  };

  const handleSaveConfig = async (newConfig: TodoistLeadAutomationConfig) => {
    const success = await saveTodoistLeadConfig(newConfig);
    if (success) {
      setConfig(newConfig);
    } else {
      throw new Error('Não foi possível salvar a configuração no banco.');
    }
  };

  const handleSendToTodoist = async () => {
    if (submitting) return;

    // 1. Validate that lead exists in db
    if (!leadId) {
      const errStr = "Não é possível enviar para o Todoist. Salve os dados do LEAD no formulário primeiro para fins de consistência.";
      setErrorMessage(errStr);
      addLocalLog('error', 'VALIDATION_FAILED', errStr);
      return;
    }

    // 2. Validate essential fields
    const resolved = getLeadDataCarryOn(lead, tipoPessoa, config);
    if (!resolved.nomeCompleto) {
      const errStr = "Não foi possível criar a tarefa porque o nome completo do lead ainda não foi informado.";
      setErrorMessage(errStr);
      addLocalLog('error', 'VALIDATION_FAILED', errStr);
      return;
    }

    if (config.behaviorOnMissingData === 'block') {
      const missingFields = [];
      if (!resolved.telefone) missingFields.push('telefone');
      if (!resolved.assunto) missingFields.push('assunto');
      if (!resolved.areaJuridica) missingFields.push('área jurídica');
      if (missingFields.length > 0) {
        const errStr = `Não foi possível criar a tarefa porque os seguintes dados obrigatórios estão ausentes: ${missingFields.join(', ')}.`;
        setErrorMessage(errStr);
        addLocalLog('error', 'VALIDATION_FAILED', errStr);
        return;
      }
    }

    // Check if task is already linked
    if (lead?.todoistAutomation?.taskId && lead?.todoistAutomation?.syncStatus === 'created' && !forceNewTask) {
      const errStr = "Este LEAD já possui uma tarefa no Todoist. Para criar outra, confirme expressamente abaixo.";
      setStatusText('warning');
      setErrorMessage(errStr);
      addLocalLog('warning', 'DUPLICATE_ATTEMPT_BLOCKED', 'Tentativa de criar tarefa duplicada bloqueada.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setStatusText('sending');
    addLocalLog('info', 'SENDING_STARTED', 'Iniciando o processo de envio do LEAD para o Todoist.', { leadId, configVersion: config.version });

    try {
      // Build final payload
      const payload = renderLeadTodoistPayload(lead, tipoPessoa, config);
      addLocalLog('info', 'PAYLOAD_COMPILED', 'Dados do LEAD compilados em payload da tarefa.', { payload });

      // Call secure server API
      const res = await fetch('/api/todoist/create-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        if (resData.error === "TODOIST_SECRET_MISSING") {
          throw new Error("O token de API do Todoist (TODOIST_API_TOKEN) não foi configurado de forma segura no ambiente.");
        }
        throw new Error(resData.message || 'Erro desconhecido na criação da tarefa.');
      }

      const todoistTaskId = resData.todoistTaskId;
      const todoistTaskUrl = resData.todoistUrl || `https://app.todoist.com/app/task/${todoistTaskId}`;

      if (!todoistTaskId) {
        throw new Error("A API do Todoist não retornou um ID de tarefa válido.");
      }

      addLocalLog('success', 'TODOIST_API_SUCCESS', 'Tarefa real criada e confirmada no Todoist com sucesso.', { taskId: todoistTaskId, url: todoistTaskUrl });

      // 3. Save link to Firestore lead document
      const automationData: TodoistAutomationData = {
        taskId: todoistTaskId,
        taskUrl: todoistTaskUrl,
        taskContent: payload.title,
        projectId: payload.projectId || 'inbox',
        projectName: config.projectName || 'Caixa de Entrada',
        sectionId: payload.sectionId || null,
        sectionName: config.sectionName || null,
        assigneeId: config.assigneeId || null,
        assigneeName: config.assigneeName || null,
        priority: config.priority,
        recurrence: config.recurrence || null,
        labels: payload.labels || [],
        syncStatus: "created",
        createdAt: lead?.todoistAutomation?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastError: null,
        configurationVersion: config.version || '1.0.0'
      };

      const leadRef = doc(db, 'marketingLeads', leadId);
      await setDoc(leadRef, { todoistAutomation: automationData }, { merge: true });
      addLocalLog('success', 'FIRESTORE_LINK_SAVED', 'Vínculo permanente com o cadastro do Lead gravado com sucesso no Firestore.');

      // Update parent component state
      if (onLeadUpdated) {
        onLeadUpdated({ todoistAutomation: automationData });
      }

      setSuccessMessage(`Nova tarefa criada e vinculada na pasta com sucesso (ID: ${todoistTaskId}).`);
      setStatusText('created');
      setForceNewTask(false);
    } catch (err: any) {
      console.error('[Todoist Automation Error]:', err);
      const errMsg = err.message || 'Houve um problema ao sincronizar com o Todoist.';
      setErrorMessage(errMsg);
      setStatusText('failed');
      addLocalLog('error', 'AUTOMATION_FAILED', 'Falha crítica na criação ou vinculação da tarefa.', { error: errMsg });

      // Save failed status if lead exists
      if (leadId) {
        const leadRef = doc(db, 'marketingLeads', leadId);
        const prevAutomation = lead?.todoistAutomation || {};
        const failData = {
          ...prevAutomation,
          syncStatus: 'failed',
          lastError: errMsg,
          updatedAt: new Date().toISOString()
        };
        await setDoc(leadRef, { todoistAutomation: failData }, { merge: true }).catch(() => {});
        if (onLeadUpdated) {
          onLeadUpdated({ todoistAutomation: failData });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateExistingTask = async () => {
    // For updating existing tasks if supported
    alert('A atualização de tarefas existentes está ativa em modo de auditoria. Para alteração manual do fluxo fático, clique no botão "Ver tarefa original no Todoist".');
  };

  const hasLinkedTask = !!(lead?.todoistAutomation?.taskId && lead?.todoistAutomation?.syncStatus === 'created');
  const taskUrl = lead?.todoistAutomation?.taskUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white border border-gray-150 rounded-2xl shadow-xs overflow-hidden"
    >
      {/* 1. Header Card Title */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${hasLinkedTask ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
          <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider">
            Card - Enviar LEAD para o Todoist
          </h3>
        </div>
        
        {/* 2. Status da integração */}
        <div className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-800">
          {hasLinkedTask && 'Tarefa Vinculada'}
          {statusText === 'sending' && 'Enviando...'}
          {statusText === 'failed' && 'Falha na Criação'}
          {statusText === 'warning' && 'Aviso de Duplicidade'}
          {statusText === 'not_sent' && !hasLinkedTask && 'Pendente de Sincronia'}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <p className="text-xs text-gray-600 leading-relaxed font-semibold">
          Despache os dados de qualificação jurídica e contato comercial diretamente para a equipe administrativa via Todoist. A Lógica Carry-On preenche os campos automaticamente.
        </p>

        {/* 3. Real-time Preview */}
        <TodoistFormatPreview 
          lead={lead} 
          tipoPessoa={tipoPessoa} 
          config={config} 
          hasSaved={!!leadId} 
        />

        {/* Error / Success indicators */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-150 rounded-xl text-xs text-rose-800 font-semibold flex items-start gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{errorMessage}</p>
              {statusText === 'failed' && (
                <button 
                  onClick={() => setShowLogs(true)}
                  className="text-[10px] text-rose-700 underline font-black uppercase tracking-wider mt-1 block"
                >
                  Ver detalhes do erro
                </button>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl text-xs text-emerald-800 font-semibold flex items-start gap-2 animate-fade-in">
            <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Tarefa Despachada com Sucesso!</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {/* 4. Action Buttons block */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main button: Enviar LEAD para o Todoist */}
          <button
            type="button"
            disabled={submitting || (!leadId && !lead?.todoistAutomation?.taskId)}
            onClick={handleSendToTodoist}
            className={`px-5 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md bg-red-600 hover:bg-red-700 active:bg-red-800 ${(submitting || (!leadId && !lead?.todoistAutomation?.taskId)) ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {submitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Enviando LEAD para o Todoist...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>{hasLinkedTask ? 'Regerar Tarefa' : 'Enviar LEAD para o Todoist'}</span>
              </>
            )}
          </button>

          {/* 5. Access to original button */}
          <TodoistTaskLinkButton taskUrl={taskUrl} />

          {/* Duplicate secondary actions if warning */}
          {statusText === 'warning' && (
            <div className="w-full flex flex-col sm:flex-row items-center gap-2 p-3 bg-amber-50 border border-amber-150 rounded-xl text-xs">
              <span className="font-semibold text-amber-900">Como deseja proceder?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForceNewTask(true);
                    setTimeout(() => handleSendToTodoist(), 100);
                  }}
                  className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition"
                >
                  Criar Outra Assim Mesmo
                </button>
                <button
                  type="button"
                  onClick={handleUpdateExistingTask}
                  className="px-3 py-1 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition"
                >
                  Atualizar tarefa existente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save requirements info */}
        {!leadId && (
          <p className="text-[10px] text-amber-700 font-bold bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
            ⚠️ O cadastro do lead ainda não foi salvo. Grave os dados no formulário acima primeiro para carregar a Lógica Carry-On e habilitar o envio.
          </p>
        )}

        {/* 6. Configuration Panel component */}
        <LeadTodoistSettings 
          lead={lead} 
          tipoPessoa={tipoPessoa} 
          config={config} 
          onSave={handleSaveConfig} 
          onLog={addLocalLog} 
        />

        {/* 7. Hidden logs panel */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 text-xs font-black text-gray-500 hover:text-gray-800 transition uppercase tracking-wider"
          >
            <Terminal size={12} />
            <span>👁️ Ver logs técnicos da automação Todoist ({logs.length})</span>
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showLogs && (
            <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] space-y-2 max-h-48 overflow-y-auto leading-relaxed shadow-inner">
              {logs.length === 0 ? (
                <div className="text-gray-500 italic">Nenhum log registrado para este lead. Execute uma ação para popular os logs técnicos.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="border-b border-slate-800 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`uppercase px-1 rounded-sm text-[8px] ${
                        log.level === 'error' ? 'bg-red-900/80 text-red-100' :
                        log.level === 'success' ? 'bg-emerald-900/80 text-emerald-100' :
                        log.level === 'warning' ? 'bg-amber-900/80 text-amber-100' : 'bg-slate-700 text-slate-100'
                      }`}>{log.level}</span>
                    </div>
                    <div className="font-bold text-slate-300 mt-0.5">{log.step}: {log.message}</div>
                    {log.details && (
                      <pre className="mt-1 p-1 bg-slate-950/70 text-slate-400 rounded-md text-[9px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
