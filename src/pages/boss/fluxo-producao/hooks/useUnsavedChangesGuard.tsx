import React, { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle2, Save } from 'lucide-react';

export interface UseUnsavedChangesGuardProps {
  hasUnsavedChanges: boolean;
  onSave: () => Promise<boolean | void>;
  isSaving: boolean;
  saveError?: string | null;
}

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  onSave,
  isSaving,
  saveError = null
}: UseUnsavedChangesGuardProps) {
  const [internalSaveError, setInternalSaveError] = useState<string | null>(null);

  // Sync internal error
  useEffect(() => {
    if (saveError) {
      setInternalSaveError(saveError);
    } else {
      setInternalSaveError(null);
    }
  }, [saveError]);

  // Layer 2: beforeunload to prevent tab closing/refreshing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Existem dados não salvos. Tem certeza que deseja sair?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Layer 1: react-router-dom blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  const handleSaveAndProceed = async () => {
    setInternalSaveError(null);
    try {
      const result = await onSave();
      // If result is not explicitly false, we proceed
      if (result !== false) {
        if (blocker.state === 'blocked') {
          if (typeof blocker.proceed === 'function') {
            blocker.proceed();
          } else if (typeof (blocker as any).confirm === 'function') {
            (blocker as any).confirm();
          }
        }
      }
    } catch (err: any) {
      console.error('Error in onSave during navigation intercept:', err);
      setInternalSaveError(err.message || 'Erro ao realizar o salvamento antes de sair.');
    }
  };

  const handleResetBlocker = () => {
    if (blocker.state === 'blocked') {
      blocker.reset?.();
    }
  };

  const handleSairSemSalvar = () => {
    if (blocker.state === 'blocked') {
      if (typeof blocker.proceed === 'function') {
        blocker.proceed();
      } else if (typeof (blocker as any).confirm === 'function') {
        (blocker as any).confirm();
      }
    }
  };

  // Rendering components in React v19-compatible JSX directly
  const UnsavedChangesModal = () => {
    if (blocker.state !== 'blocked') return null;

    return (
      <div 
        id="unsaved-changes-modal"
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-150 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex gap-4 items-start text-amber-550">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-950 leading-tight">Existem dados ainda não salvos.</h3>
              <p className="text-xs text-gray-500 mt-1 leading-normal">
                Tem certeza que deseja sair da tela sem registrar as suas alterações?
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs text-amber-800 leading-normal">
            Você realizou edições de cadastro que serão perdidas se a navegação prosseguir sem o devido salvamento.
          </div>

          {internalSaveError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl font-semibold leading-relaxed">
              {internalSaveError}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSaveAndProceed}
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-3 rounded-xl transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Salvando cadastro...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Salvar e sair</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleResetBlocker}
                disabled={isSaving}
                className="inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors border border-gray-200 cursor-pointer disabled:opacity-50"
              >
                Continuar editando
              </button>

              <button
                type="button"
                onClick={handleSairSemSalvar}
                disabled={isSaving}
                className="inline-flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors border border-red-200 cursor-pointer disabled:opacity-50"
              >
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SaveStatusIndicator = () => {
    let text = 'Tudo salvo';
    let icon = <CheckCircle2 size={13} className="text-emerald-500" />;
    let bgStyle = 'bg-emerald-50 text-emerald-700 border-emerald-150';

    if (isSaving) {
      text = 'Salvando...';
      icon = <Loader2 size={13} className="text-blue-500 animate-spin" />;
      bgStyle = 'bg-blue-50 text-blue-700 border-blue-150';
    } else if (internalSaveError) {
      text = 'Falha ao salvar';
      icon = <AlertTriangle size={13} className="text-red-500" />;
      bgStyle = 'bg-red-50 text-red-700 border-red-150';
    } else if (hasUnsavedChanges) {
      text = 'Alterações não salvas';
      icon = <AlertTriangle size={13} className="text-amber-500" />;
      bgStyle = 'bg-amber-50 text-amber-500 border-amber-150';
    }

    return (
      <div 
        id="save-status-indicator"
        className={`inline-flex items-center gap-2 px-3 py-1 border text-[11px] font-black uppercase tracking-wider transition-all duration-300 rounded-lg ${bgStyle}`}
      >
        {icon}
        <span>{text}</span>
      </div>
    );
  };

  return {
    UnsavedChangesModal,
    SaveStatusIndicator,
    blockerState: blocker.state,
    proceed: handleSairSemSalvar,
    reset: handleResetBlocker,
    saveAndProceed: handleSaveAndProceed
  };
}
