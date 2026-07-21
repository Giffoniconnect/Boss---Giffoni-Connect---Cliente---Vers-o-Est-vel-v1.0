import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  extractClientOnboardingFields,
  buildOnboardingExecutionPlan
} from './onboardingHelper';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function OnboardingFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;

    async function determineAndRedirect() {
      try {
        setLoading(true);
        setError(null);

        const caseDoc = await getDoc(doc(db, 'cases', caseId!));
        if (!caseDoc.exists()) {
          setError('Caso não encontrado.');
          setLoading(false);
          return;
        }

        const caseData = caseDoc.data();
        let clientData = null;

        if (caseData.clientId) {
          const clientDoc = await getDoc(doc(db, 'clients', caseData.clientId));
          if (clientDoc.exists()) {
            clientData = clientDoc.data();
          }
        }

        const clientFields = extractClientOnboardingFields(clientData);
        const executionPlan = buildOnboardingExecutionPlan(clientFields, caseData.onboarding);

        // Find the first pending/incomplete step (not completed and not dispensed)
        const nextPendingStep = executionPlan.find(
          step => step.status !== 'completed' && step.status !== 'dispensed_not_owned' && step.status !== 'dispensed_no_channel'
        );

        // Default to the final Auditoria step (step 8) if all are completed/dispensed
        const targetRoute = nextPendingStep ? nextPendingStep.route : 'auditoria.onboarding.cliente';

        // Redirect immediately and replace the entry in history
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/${targetRoute}`, { replace: true });

      } catch (err: any) {
        console.error("Error in onboarding controller redirection:", err);
        setError('Erro ao processar fluxo de onboarding: ' + (err.message || err));
        setLoading(false);
      }
    }

    determineAndRedirect();
  }, [caseId, navigate]);

  return (
    <FluxoStepLayout stepName="Onboarding" caseId={caseId}>
      <div className="flex flex-col items-center justify-center py-20 gap-4 font-sans text-center">
        {loading && (
          <>
            <Loader2 className="animate-spin text-indigo-600" size={36} />
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Direcionando Onboarding...
              </h3>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Calculando a primeira subetapa pendente de acolhimento do cliente.
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="max-w-md space-y-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center text-left">
              <AlertCircle size={20} className="text-red-500 shrink-0" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw size={12} />
              <span>Tentar Novamente</span>
            </button>
          </div>
        )}
      </div>
    </FluxoStepLayout>
  );
}
