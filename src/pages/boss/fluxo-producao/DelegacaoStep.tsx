import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Users, ClipboardList, Milestone, ChevronRight, CheckSquare } from 'lucide-react';

interface DelegacaoStepProps {
  caseId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function DelegacaoStep({ caseId, onNext, onSetLoading, onAlert }: DelegacaoStepProps) {
  const [delegation, setDelegation] = useState({
    operatorId: '',
    taskDescription: '',
    dueDate: '',
    todoistProjectId: '',
    todoistTaskId: '',
    taskStatus: 'nao_iniciada' // nao_iniciada, em_desenvolvimento, concluido, revisao_pendente
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadDelegation() {
      onSetLoading(true);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setDelegation({
            operatorId: data.operatorId || '',
            taskDescription: data.taskDescription || '',
            dueDate: data.dueDate || '',
            todoistProjectId: data.todoistProjectId || '',
            todoistTaskId: data.todoistTaskId || '',
            taskStatus: data.taskStatus || 'nao_iniciada'
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadDelegation();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDelegation(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        ...delegation,
        productionStage: 'revisao',
        updatedAt: serverTimestamp()
      });
      onAlert('Delegação de tarefas operacionais enviada de maneira bem-sucedida!');
      onNext();
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível gravar as diretrizes de delegação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleNext} className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 border-b border-gray-50 pb-3">
          <Users size={18} className="text-blue-600" /> EDRP: Delegação de Tarefas e Colaboração
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Colaborador / Operador Designado</label>
            <input
              type="text"
              name="operatorId"
              value={delegation.operatorId}
              onChange={handleChange}
              placeholder="Nome do operador ou e-mail..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Prazo Limite de Entrega</label>
            <input
              type="date"
              name="dueDate"
              value={delegation.dueDate}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Instruções Técnicas e Escopo da Atividade</label>
            <textarea
              name="taskDescription"
              rows={4}
              value={delegation.taskDescription}
              onChange={handleChange}
              placeholder="Especifique detalhadamente o que deve ser elaborado pelo executor..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest font-sans">Status Interno de Desenvolvimento</label>
            <select
              name="taskStatus"
              value={delegation.taskStatus}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            >
              <option value="nao_iniciada">Não Iniciada</option>
              <option value="em_desenvolvimento">Em Desenvolvimento</option>
              <option value="revisao_pendente">Peça Pronta - Aguardando Post de Revisão</option>
              <option value="concluido">Tarefa Concluída</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <CheckSquare size={16} className="text-gray-400" /> Sincronizador de Projetos (Todoist Metadados)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Todoist Project ID</label>
            <input
              type="text"
              name="todoistProjectId"
              value={delegation.todoistProjectId}
              onChange={handleChange}
              placeholder="ex: 22819201"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Todoist Task ID Reference</label>
            <input
              type="text"
              name="todoistTaskId"
              value={delegation.todoistTaskId}
              onChange={handleChange}
              placeholder="ex: 63821038"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

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
