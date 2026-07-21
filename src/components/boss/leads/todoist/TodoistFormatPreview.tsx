import React from 'react';
import { TodoistLeadAutomationConfig } from './todoistLeadAutomationTypes';
import { renderLeadTodoistPayload } from './todoistLeadAutomationService';

interface TodoistFormatPreviewProps {
  lead: any;
  tipoPessoa: 'PF' | 'PJ';
  config: TodoistLeadAutomationConfig;
  hasSaved: boolean;
}

export const TodoistFormatPreview: React.FC<TodoistFormatPreviewProps> = ({
  lead,
  tipoPessoa,
  config,
  hasSaved
}) => {
  const payload = renderLeadTodoistPayload(lead, tipoPessoa, config);
  
  const projectName = config.projectName || 'Caixa de Entrada';
  const title = payload.title || '[NOME COMPLETO DO LEAD PENDENTE]';
  const assigneeName = config.assigneeName || 'sem_responsavel';
  const priority = config.priority || 'p1';
  const recurrence = config.recurrence || 'todo dia útil';

  // Build the preview string
  const previewText = `#${projectName} ${title} +${assigneeName} ${priority} ${recurrence}`;

  return (
    <div className="p-4 bg-red-50/40 border border-red-100 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-black text-[#de4c3a] uppercase tracking-widest">
          {hasSaved ? '● Alimentado & Confirmado (Salvo)' : '○ Alimentando em Tempo Real'}
        </span>
        <span className="text-[10px] font-mono font-bold text-gray-400">Todoist Format</span>
      </div>
      <div 
        id="todoist-preview-text" 
        className="text-xs font-mono font-black text-slate-800 break-words bg-white p-3.5 rounded-xl border border-red-100/60 shadow-3xs leading-relaxed flex flex-wrap items-center gap-1.5"
      >
        <span className="text-[#de4c3a] font-bold">#{projectName}</span>
        <span className="text-gray-900 font-sans font-semibold">{title}</span>
        <span className="text-blue-600 font-bold">+{assigneeName}</span>
        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{priority}</span>
        <span className="text-emerald-700 font-medium italic">{recurrence}</span>
      </div>
    </div>
  );
};
