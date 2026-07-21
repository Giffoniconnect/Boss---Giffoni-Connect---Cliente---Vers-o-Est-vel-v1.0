import React from 'react';
import { Sparkles } from 'lucide-react';

interface FluxoStatusBadgeProps {
  status?: string;
}

export default function FluxoStatusBadge({ status = 'estrutura preparada' }: FluxoStatusBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-105 rounded-full text-blue-750 text-xs font-bold uppercase tracking-wider">
      <Sparkles size={12} className="text-blue-500 animate-pulse" />
      <span>{status}</span>
    </div>
  );
}
