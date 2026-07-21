import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { MessageSquare, Plus, Trash2, Eye, EyeOff, Send, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Communication {
  id: string;
  caseId: string;
  clientId: string;
  senderId?: string;
  content: string;
  type: 'mensagem' | 'solicitacao' | 'aviso' | 'explicacao';
  visibleToClient: boolean;
  createdAt: any;
}

interface Props {
  caseId: string;
  clientId: string;
  isAdmin?: boolean;
  forcePublicOnly?: boolean;
}

export default function CaseCommunicationsPanel({ caseId, clientId, isAdmin = false, forcePublicOnly = false }: Props) {
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    content: '',
    type: 'mensagem' as const,
    visibleToClient: true
  });

  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, 'caseCommunications'),
      where('caseId', '==', caseId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Communication));
      if (forcePublicOnly) {
        docs = docs.filter(c => c.visibleToClient);
      }
      setComms((isAdmin && !forcePublicOnly) ? docs : docs.filter(c => c.visibleToClient));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'caseCommunications');
      setLoading(false);
    });

    return unsubscribe;
  }, [caseId, isAdmin, forcePublicOnly]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'caseCommunications'), {
        ...formData,
        caseId,
        clientId,
        createdAt: serverTimestamp()
      });
      setShowForm(false);
      setFormData({
        content: '',
        type: 'mensagem',
        visibleToClient: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'caseCommunications');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = async (comm: Communication) => {
    try {
      await updateDoc(doc(db, 'caseCommunications', comm.id), {
        visibleToClient: !comm.visibleToClient
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `caseCommunications/${comm.id}`);
    }
  };

  const deleteComm = async (id: string) => {
    if (!window.confirm('Excluir este andamento?')) return;
    try {
      await deleteDoc(doc(db, 'caseCommunications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `caseCommunications/${id}`);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-blue-600" />
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest text-sm font-black text-gray-900 uppercase tracking-widest">Andamentos & Histórico</h3>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-blue-600 font-bold text-xs hover:underline"
          >
            {showForm ? 'Fechar' : 'Novo Andamento'}
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Conteúdo do Andamento</label>
                <textarea 
                  required
                  rows={3}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Descreva o que aconteceu no processo..."
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600"
                      checked={formData.visibleToClient}
                      onChange={e => setFormData({ ...formData, visibleToClient: e.target.checked })}
                    />
                    <span className="text-xs font-bold text-gray-600">Visível no Portal</span>
                  </label>
                </div>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 text-xs flex items-center gap-2"
                >
                  {isSaving ? 'Salvando...' : 'Postar'}
                  <Send size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {comms.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Nenhum andamento registrado.</div>
        ) : (
          comms.map((comm) => (
            <div key={comm.id} className="relative pl-8 pb-6 border-l-2 border-gray-100 last:border-0 last:pb-0">
              <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                comm.visibleToClient ? 'bg-blue-500' : 'bg-gray-400'
              }`} />
              <div className={`p-4 rounded-2xl rounded-tl-none ring-1 ${comm.visibleToClient ? 'bg-gray-50 ring-gray-100' : 'bg-gray-100/50 ring-gray-100 opacity-70'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{comm.type}</span>
                    {isAdmin && (
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${comm.visibleToClient ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                        {comm.visibleToClient ? 'Visível' : 'Privado'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-bold">{new Date(comm.createdAt?.seconds * 1000).toLocaleString()}</span>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleVisibility(comm)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        >
                          {comm.visibleToClient ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button 
                          onClick={() => deleteComm(comm.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">{comm.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
