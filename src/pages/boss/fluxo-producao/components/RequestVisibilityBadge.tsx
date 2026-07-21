import React from 'react';

interface RequestVisibilityBadgeProps {
  visible: boolean;
}

export default function RequestVisibilityBadge({ visible }: RequestVisibilityBadgeProps) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 border text-xs font-bold uppercase rounded-md tracking-wider ${
      visible 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
        : 'bg-gray-50 text-gray-500 border-gray-200'
    }`}>
      {visible ? 'Visível ao Cliente' : 'Opacidade (Interno)'}
    </span>
  );
}
