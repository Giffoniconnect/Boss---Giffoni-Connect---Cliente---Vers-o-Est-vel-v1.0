import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { Lightbulb, Plus, Trash2, Eye, EyeOff, ChevronRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CaseExplanation {
  id: string;
  caseId: string;
  clientId: string;
  title: string;
  content: string;
  category: 'andamento' | 'decisao' | 'audiencia' | 'pericia' | 'financeiro' | 'geral';
  visibleToClient: boolean;
  createdAt: any;
  updatedAt: any;
}

interface Props {
  caseId: string;
  clientId: string;
  isAdmin?: boolean;
}

export default function CaseExplanationsPanel({ caseId, clientId, isAdmin = false }: Props) {
  const [explanations, setExplanations] = useState<CaseExplanation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'andamento',
    visibleToClient: true
  });

  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, 'caseExplanations'),
      where('caseId', '==', caseId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CaseExplanation));
      setExplanations(isAdmin ? docs : docs.filter(e => e.visibleToClient));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'caseExplanations');
      setLoading(false);
    });

    return unsubscribe;
  }, [caseId, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'caseExplanations'), {
        ...formData,
        caseId,
        clientId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowForm(false);
      setFormData({
        title: '',
        content: '',
        category: 'andamento',
        visibleToClient: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'caseExplanations');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = async (expl: CaseExplanation) => {
    try {
      await updateDoc(doc(db, 'caseExplanations', expl.id), {
        visibleToClient: !expl.visibleToClient,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `caseExplanations/${expl.id}`);
    }
  };

  const deleteExplanation = async (id: string) => {
    if (!window.confirm('Excluir esta explicação?')) return;
    try {
      await deleteDoc(doc(db, 'caseExplanations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `caseExplanations/${id}`);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-blue-50/30">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-blue-600" />
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Giffoni Explica</h3>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-blue-600 font-bold text-xs hover:underline"
          >
            {showForm ? 'Fechar' : 'Nova Explicação'}
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Título da Explicação</label>
                <input 
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: O que significa 'Concluso para Despacho'?"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Conteúdo (Linguagem Amigável)</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Explique para o cliente o que está acontecendo sem juridiquês..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-600"
                    checked={formData.visibleToClient}
                    onChange={e => setFormData({ ...formData, visibleToClient: e.target.checked })}
                  />
                  <span className="text-xs font-bold text-gray-600">Disponibilizar ao Cliente</span>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Publicando...' : 'Publicar Explicação'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="divide-y divide-gray-50">
        {explanations.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-xs italic">Nenhuma explicação publicada.</div>
        ) : (
          explanations.map(expl => (
            <div key={expl.id} className="group transition-colors hover:bg-gray-50/30">
              <div 
                className="p-5 cursor-pointer flex items-center justify-between"
                onClick={() => setExpandedId(expandedId === expl.id ? null : expl.id)}
              >
                <div className="flex items-center gap-3">
                  <Lightbulb size={18} className="text-amber-500" />
                  <h4 className="font-bold text-gray-900 text-sm">{expl.title}</h4>
                </div>
                <div className="flex items-center gap-4">
                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => toggleVisibility(expl)}
                        className={`p-1.5 rounded-lg transition-all ${expl.visibleToClient ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-200'}`}
                      >
                        {expl.visibleToClient ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button 
                        onClick={() => deleteExplanation(expl.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  <ChevronRight 
                    size={18} 
                    className={`text-gray-300 transition-transform ${expandedId === expl.id ? 'rotate-90' : ''}`} 
                  />
                </div>
              </div>
              
              <AnimatePresence>
                {expandedId === expl.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-6 text-sm text-gray-600 leading-relaxed font-medium bg-gray-50/50">
                      <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        {expl.content}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
