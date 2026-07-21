import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { ClipboardList, Plus, Trash2, Eye, EyeOff, CheckCircle2, Circle, AlertCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PendingTask {
  id: string;
  caseId: string;
  clientId: string;
  title: string;
  description: string;
  type: 'documento' | 'confirmacao' | 'assinatura' | 'informacao' | 'prova' | 'outro';
  status: 'pendente' | 'concluido' | 'vencido';
  dueDate: string;
  visibleToClient: boolean;
  createdAt: any;
  updatedAt: any;
}

interface Props {
  caseId: string;
  clientId: string;
  isAdmin?: boolean;
}

export default function CasePendingTasksPanel({ caseId, clientId, isAdmin = false }: Props) {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'documento',
    status: 'pendente',
    dueDate: '',
    visibleToClient: true
  });

  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, 'casePendingTasks'),
      where('caseId', '==', caseId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingTask));
      setTasks(isAdmin ? docs : docs.filter(t => t.visibleToClient));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'casePendingTasks');
      setLoading(false);
    });

    return unsubscribe;
  }, [caseId, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'casePendingTasks'), {
        ...formData,
        caseId,
        clientId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        type: 'documento',
        status: 'pendente',
        dueDate: '',
        visibleToClient: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'casePendingTasks');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (task: PendingTask) => {
    // Only BOSS can toggle for now (or client if it's their own task, but prompt says portal is mostly read)
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'casePendingTasks', task.id), {
        status: task.status === 'concluido' ? 'pendente' : 'concluido',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `casePendingTasks/${task.id}`);
    }
  };

  const toggleVisibility = async (task: PendingTask) => {
    try {
      await updateDoc(doc(db, 'casePendingTasks', task.id), {
        visibleToClient: !task.visibleToClient,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `casePendingTasks/${task.id}`);
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm('Excluir esta pendência?')) return;
    try {
      await deleteDoc(doc(db, 'casePendingTasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `casePendingTasks/${id}`);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-gray-400" />
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Pendências do Cliente</h3>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-blue-600 font-bold text-xs hover:underline"
          >
            {showForm ? 'Fechar' : 'Nova Solicitação'}
            <Plus size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && isAdmin && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 bg-gray-50/30"
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">O que é necessário?</label>
                <input 
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: Cópia do RG e CPF"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="documento">Documento</option>
                    <option value="confirmacao">Confirmação</option>
                    <option value="assinatura">Assinatura</option>
                    <option value="informacao">Informação</option>
                    <option value="prova">Prova</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prazo (Opcional)</label>
                  <input 
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-600"
                    checked={formData.visibleToClient}
                    onChange={e => setFormData({ ...formData, visibleToClient: e.target.checked })}
                  />
                  <span className="text-xs font-bold text-gray-600">Notificar no Portal</span>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Enviando...' : 'Criar Pendência'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="divide-y divide-gray-50">
        {tasks.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-xs italic">Nenhuma pendência ativa.</div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="p-5 flex gap-4 transition-colors hover:bg-gray-50/50">
              <button 
                onClick={() => toggleStatus(task)}
                className={`mt-1 flex-shrink-0 transition-colors ${task.status === 'concluido' ? 'text-emerald-500' : 'text-gray-300'}`}
              >
                {task.status === 'concluido' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={`font-bold text-sm truncate ${task.status === 'concluido' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</h4>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => toggleVisibility(task)}
                        className={`p-1.5 rounded-lg transition-all ${task.visibleToClient ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-200'}`}
                      >
                        {task.visibleToClient ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <span className={`px-2 py-0.5 rounded ${
                    task.type === 'documento' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {task.type}
                  </span>
                  {task.dueDate && (
                    <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== 'concluido' ? 'text-red-500' : 'text-gray-400'}`}>
                      <Calendar size={12} />
                      <span>Prazo: {new Date(task.dueDate + 'T12:00:00').toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
