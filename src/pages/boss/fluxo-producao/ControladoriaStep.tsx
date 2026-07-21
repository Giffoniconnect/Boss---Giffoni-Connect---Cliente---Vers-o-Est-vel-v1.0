import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ShieldCheck, AlertCircle, RefreshCw, ChevronRight, Check } from 'lucide-react';

interface ControladoriaStepProps {
  caseId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function ControladoriaStep({ caseId, onNext, onSetLoading, onAlert }: ControladoriaStepProps) {
  const [control, setControl] = useState({
    controlStatus: 'em_conferencia', // nao_enviado, enviado_controladoria, em_conferencia, concluido
    auditGrade: 'apto', // apto, apto_com_ressalvas, inapto_devolvido_pendencia
    auditNotes: '',
    concurredAt: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadControl() {
      onSetLoading(true);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setControl({
            controlStatus: data.controlStatus || 'em_conferencia',
            auditGrade: data.auditGrade || 'apto',
            auditNotes: data.auditNotes || '',
            concurredAt: data.concurredAt || ''
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadControl();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setControl(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        ...control,
        productionStage: 'relatorio_integridade',
        updatedAt: serverTimestamp()
      });
      onAlert('Conferência da Controladoria registrada!');
      onNext();
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível registrar a conferência da controladoria.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToStep = async (stepToReset: 'estruturacao' | 'delegacao' | 'revisao' | 'protocolo') => {
    if (!confirm(`Deseja realmente DEVOLVER este caso para a etapa de: ${stepToReset.toUpperCase()}?`)) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        productionStage: stepToReset,
        controlStatus: 'nao_enviado',
        auditGrade: 'inapto_devolvido_pendencia',
        updatedAt: serverTimestamp()
      });
      onAlert(`O caso foi devolvido com pendências para a etapa de: ${stepToReset.toUpperCase()}`);
      // Redirect to that step dynamically
      window.location.search = `?caseId=${caseId}&step=${stepToReset}`;
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 border-b border-gray-50 pb-3">
          <ShieldCheck size={18} className="text-purple-600" /> CONECTOR DE CONTROLADORIA: Conferência de Protocolos e Ativos
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Estado Conferência Auditiva</label>
            <select
              name="controlStatus"
              value={control.controlStatus}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            >
              <option value="nao_enviado">Não Enviado à Controladoria</option>
              <option value="enviado_controladoria">Enviado à Controladoria</option>
              <option value="em_conferencia">Em Período de Conferência</option>
              <option value="concluido">Auditoria Finalizada / Concluída</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest font-sans">Resultado da Parecerista Técnico</label>
            <select
              name="auditGrade"
              value={control.auditGrade}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            >
              <option value="apto">Apto p/ Deploy e Acompanhamento</option>
              <option value="apto_com_ressalvas">Apto com pequenas Ressalvas procedimentais</option>
              <option value="inapto_devolvido_pendencia">Inapto - Devolve p/ Correção Operacional</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Observações de Conferência da Controladoria</label>
            <textarea
              name="auditNotes"
              rows={4}
              value={control.auditNotes}
              onChange={handleChange}
              placeholder="Escreva anotações referentes à conferência fática e integridade do protocolo..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* RE-STAGE RETROACTION PANEL */}
      <div className="bg-red-50 border border-red-100 rounded-3xl p-6 space-y-4">
        <h4 className="text-xs font-black text-red-900 uppercase tracking-widest flex items-center gap-2">
          <RefreshCw size={16} className="text-red-500 animate-spin" /> Devolução e Retomada de Etapas
        </h4>
        <p className="text-xs text-red-700 leading-relaxed font-semibold">
          Se a controladoria encontrar inconsistências graves, erros técnicos ou falta de assinaturas nas guias fiscais/comprovantes, devolva o caso para readequação usando os atalhos abaixo:
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => resetToStep('estruturacao')}
            className="px-4 py-2.5 bg-white border border-red-200 text-red-800 hover:bg-red-100 rounded-xl text-[10px] font-extrabold uppercase transition-all"
          >
            Devolver à Estruturação
          </button>
          <button
            type="button"
            onClick={() => resetToStep('delegacao')}
            className="px-4 py-2.5 bg-white border border-red-200 text-red-800 hover:bg-red-100 rounded-xl text-[10px] font-extrabold uppercase transition-all"
          >
            Devolver à Delegação
          </button>
          <button
            type="button"
            onClick={() => resetToStep('revisao')}
            className="px-4 py-2.5 bg-white border border-red-200 text-red-800 hover:bg-red-100 rounded-xl text-[10px] font-extrabold uppercase transition-all"
          >
            Devolver à Revisão
          </button>
          <button
            type="button"
            onClick={() => resetToStep('protocolo')}
            className="px-4 py-2.5 bg-white border border-red-200 text-red-800 hover:bg-red-100 rounded-xl text-[10px] font-extrabold uppercase transition-all"
          >
            Devolver ao Protocolo
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-50"
        >
          {isSaving ? 'Salvando...' : 'Confirmar e Ir p/ Relatório de Integridade'}
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
}
