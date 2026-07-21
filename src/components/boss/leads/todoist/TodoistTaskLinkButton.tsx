import React from 'react';
import { ExternalLink } from 'lucide-react';

interface TodoistTaskLinkButtonProps {
  taskUrl: string | null | undefined;
}

export const TodoistTaskLinkButton: React.FC<TodoistTaskLinkButtonProps> = ({ taskUrl }) => {
  if (!taskUrl) return null;

  return (
    <a
      href={taskUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#de4c3a]/10 hover:bg-[#de4c3a]/15 text-[#de4c3a] border border-[#de4c3a]/25 hover:border-[#de4c3a]/45 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-3xs"
      title="Ver tarefa original no Todoist"
    >
      <span>👀 Ver tarefa original no Todoist</span>
      <ExternalLink size={13} />
    </a>
  );
};
