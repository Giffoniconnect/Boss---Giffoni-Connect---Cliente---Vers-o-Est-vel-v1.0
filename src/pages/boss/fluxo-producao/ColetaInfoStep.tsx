import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { HelpCircle, Trash2, Check, X, PlusCircle, AlertCircle, ChevronRight } from 'lucide-react';

interface ColetaInfoStepProps {
  caseId: string;
  clientId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function ColetaInfoStep({ caseId, clientId, onNext, onSetLoading, onAlert }: ColetaInfoStepProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchQuestions = async () => {
    onSetLoading(true);
    try {
      const q = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseId));
      const snap = await getDocs(q);
      const items = snap.docs.map(docRef => ({
        id: docRef.id,
        ...docRef.data()
      }));
      setQuestions(items);
    } catch (err) {
      console.error(err);
    } finally {
      onSetLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [caseId]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'caseInformationRequests'), {
        caseId,
        clientId,
        question: newQuestion.trim(),
        answer: '',
        status: 'pendente', // pendente, respondido, revisado
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewQuestion('');
      fetchQuestions();
      onAlert('Solicitação de esclarecimento cadastrada com sucesso!');
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível registrar a nova pergunta.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'revisado' | 'pendente') => {
    try {
      await updateDoc(doc(db, 'caseInformationRequests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      fetchQuestions();
      onAlert(`Status atualizado para: ${newStatus}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta pergunta?')) return;
    try {
      await deleteDoc(doc(db, 'caseInformationRequests', id));
      fetchQuestions();
      onAlert('Pergunta removida com sucesso!');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <HelpCircle size={16} className="text-blue-600" /> Coleta de Informações (Perguntas Fatuais ao Cliente)
        </h4>

        <p className="text-xs text-gray-500 font-semibold leading-relaxed">
          Estas perguntas estarão disponíveis no portal de seu cliente para preenchimento. Uma vez enviadas por ele, as respostas tornam-se imutáveis e auditáveis por seu escritório.
        </p>

        <form onSubmit={handleAddQuestion} className="flex gap-2">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Digite os fatos ou esclarecimentos que precisa coletar..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={isAdding}
            className="px-5 py-2.5 bg-gray-900 text-white font-bold text-xs hover:bg-black rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <PlusCircle size={14} /> Solicitar
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <HelpCircle size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 italic">Nenhuma pergunta foi cadastrada para este caso ainda.</p>
          </div>
        ) : (
          questions.map(q => (
            <div key={q.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                    q.status === 'pendente' 
                      ? 'bg-amber-50 text-amber-700 border-amber-100' 
                      : q.status === 'respondido' 
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                    {q.status === 'pendente' ? 'Pendente de Resposta' : q.status === 'respondido' ? 'Pronta p/ Revisão' : 'Aprovada'}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-800">Q: {q.question}</p>
                {q.answer ? (
                  <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl text-xs font-medium text-gray-700">
                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">Resposta do Cliente:</p>
                    {q.answer}
                  </div>
                ) : (
                  <p className="text-[10px] italic text-gray-400 font-semibold">Aguardando preenchimento no portal...</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {q.status === 'respondido' && (
                  <button
                    onClick={() => handleUpdateStatus(q.id, 'revisado')}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg hover:shadow-sm transition-all"
                    title="Aprovar Resposta"
                  >
                    <Check size={16} />
                  </button>
                )}
                {q.status === 'revisado' && (
                  <button
                    onClick={() => handleUpdateStatus(q.id, 'pendente')}
                    className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg hover:shadow-sm transition-all"
                    title="Devolver para pendência"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg hover:shadow-sm transition-all"
                  title="Excluir Pergunta"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
        >
          Confirmar e Prosseguir
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
