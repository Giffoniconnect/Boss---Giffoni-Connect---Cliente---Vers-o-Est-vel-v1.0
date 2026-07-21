import React from 'react';

interface RequestStatusBadgeProps {
  status: string;
}

export default function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  let bg = 'bg-gray-100 text-gray-700 border-gray-200';
  let label = status;

  switch (status) {
    case 'pendente':
      bg = 'bg-amber-50 text-amber-700 border-amber-200';
      label = 'Pendente';
      break;
    case 'respondido':
      bg = 'bg-blue-50 text-blue-750 border-blue-200';
      label = 'Respondido';
      break;
    case 'em_analise':
      bg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      label = 'Em Análise';
      break;
    case 'aprovado':
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      label = 'Aprovado';
      break;
    case 'rejeitado':
      bg = 'bg-rose-50 text-rose-750 border-rose-200';
      label = 'Rejeitado';
      break;
    case 'complemento_solicitado':
      bg = 'bg-purple-50 text-purple-700 border-purple-200';
      label = 'Complemento Solicitado';
      break;
    case 'arquivado':
      bg = 'bg-gray-100 text-gray-500 border-gray-200';
      label = 'Arquivado';
      break;
    default:
      bg = 'bg-gray-50 text-gray-605 border-gray-100';
      label = status;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 border text-xs font-bold uppercase rounded-md tracking-wider ${bg}`}>
      {label}
    </span>
  );
}
