import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ShieldCheck, AlertTriangle, ChevronRight, UserCheck } from 'lucide-react';

interface RevisaoStepProps {
  caseId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function RevisaoStep({ caseId, onNext, onSetLoading, onAlert }: RevisaoStepProps) {
  const [review, setReview] = useState({
    revisorId: '',
    reviewStatus: 'aguardando_revisao', // aguardando_revisao, em_revisao, ajustes_solicitados, aprovado, reprovado
    reviewComments: '',
    bypassGating: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadReview() {
      onSetLoading(true);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setReview({
            revisorId: data.revisorId || '',
            reviewStatus: data.reviewStatus || 'aguardando_revisao',
            reviewComments: data.reviewComments || '',
            bypassGating: data.bypassGating || false
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadReview();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setReview(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (review.reviewStatus !== 'aprovado' && !review.bypassGating) {
      onAlert('Atenção: A peça processual precisa ser aprovada pelo advogado sênior antes do agendamento de protocolo. Habilite a caixa "Forçar avanço" para ignorar.');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        ...review,
        productionStage: 'protocolo',
        updatedAt: serverTimestamp()
      });
      onAlert('Revisão registrada com sucesso!');
      onNext();
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível gravar o parecer de revisão.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleNext} className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 border-b border-gray-50 pb-3">
          <UserCheck size={18} className="text-blue-600" /> EDRP: Controle e Homologação de Qualidade técnica
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Revisor Sênior Responsável</label>
            <input
              type="text"
              name="revisorId"
              value={review.revisorId}
              onChange={handleChange}
              placeholder="Nome ou ID do revisor..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Parecer de Conformidade Técnica</label>
            <select
              name="reviewStatus"
              value={review.reviewStatus}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            >
              <option value="aguardando_revisao">Aguardando Revisão Interna</option>
              <option value="em_revisao">Em Período de Análise</option>
              <option value="ajustes_solicitados">Solicitação de Correções / Ajustes</option>
              <option value="aprovado">Aprovado pelo Revisor (Habilita Protocolo)</option>
              <option value="reprovado">Reprovado por Erros Qualificados</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Apreciação Crítica e Feedback do Parecer</label>
            <textarea
              name="reviewComments"
              rows={4}
              value={review.reviewComments}
              onChange={handleChange}
              placeholder="Escreva correções pendentes ou comentários de aprovação..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {review.reviewStatus !== 'aprovado' && (
        <div className="p-5 bg-red-50 border border-red-100 text-red-900 rounded-3xl space-y-3">
          <div className="flex gap-2">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Bloqueio Operacional: Protocolo Impedido</p>
              <p className="text-xs font-semibold leading-relaxed mt-0.5">
                Para manter a integridade operacional e blindar o escritório contra recursos sem assinatura ou erros, o sistema impede o prosseguimento do protocolo caso a revisão não seja dada como **Aprovada**.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-red-150">
            <input
              type="checkbox"
              id="bypassGating"
              checked={review.bypassGating}
              onChange={(e) => setReview(p => ({ ...p, bypassGating: e.target.checked }))}
              className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-50"
            />
            <label htmlFor="bypassGating" className="text-xs font-bold uppercase tracking-wider cursor-pointer">
              Ativar Desvio Operacional (Forçar avanço de risco)
            </label>
          </div>
        </div>
      )}

      {review.reviewStatus === 'aprovado' && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 flex gap-3 text-emerald-950 font-semibold text-xs leading-relaxed">
          <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
          Peça validada pelo Sócio/Sênior. O fluxo do protocolo fático foi desbloqueado com segurança no sistema.
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
        >
          {isSaving ? 'Salvando...' : 'Confirmar e Prosseguir'}
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
}
