import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

interface LeadStepNavigationProps {
  navigating: boolean;
  onClick: () => void;
  id: string;
}

export function LeadStepNavigation({
  navigating,
  onClick,
  id
}: LeadStepNavigationProps) {
  return (
    <div className="mt-8 pt-6 border-t border-gray-150 flex justify-center">
      <button
        type="button"
        id={id}
        disabled={navigating}
        onClick={onClick}
        className="w-full max-w-lg px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white rounded-2xl text-sm font-black uppercase tracking-wider transition flex items-center justify-center gap-2.5 cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-80 disabled:cursor-not-allowed"
      >
        {navigating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Salvando e avançando para a Etapa 02...</span>
          </>
        ) : (
          <>
            <span>Ir para etapa 02</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </div>
  );
}
