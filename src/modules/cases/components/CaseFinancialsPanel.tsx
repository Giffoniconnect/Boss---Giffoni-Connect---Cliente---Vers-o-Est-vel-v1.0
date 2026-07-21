import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { DollarSign, Plus, Trash2, Eye, EyeOff, Wallet, Calendar, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FinancialRecord {
  id: string;
  caseId: string;
  clientId: string;
  totalAmount: number;
  status: string;
  installments: number;
  installmentsPaid: number;
  nextDueDate: string;
  visibleToClient: boolean;
  updatedAt: any;
}

interface Props {
  caseId: string;
  clientId: string;
  isAdmin?: boolean;
}

export default function CaseFinancialsPanel({ caseId, clientId, isAdmin = false }: Props) {
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    totalAmount: 0,
    status: 'Em andamento',
    installments: 1,
    installmentsPaid: 0,
    nextDueDate: '',
    visibleToClient: true
  });

  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, 'caseFinancials'),
      where('caseId', '==', caseId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialRecord));
      setFinancials(isAdmin ? docs : docs.filter(f => f.visibleToClient));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'caseFinancials');
      setLoading(false);
    });

    return unsubscribe;
  }, [caseId, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'caseFinancials'), {
        ...formData,
        caseId,
        clientId,
        updatedAt: serverTimestamp()
      });
      setShowForm(false);
      setFormData({
        totalAmount: 0,
        status: 'Em andamento',
        installments: 1,
        installmentsPaid: 0,
        nextDueDate: '',
        visibleToClient: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'caseFinancials');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = async (fin: FinancialRecord) => {
    try {
      await updateDoc(doc(db, 'caseFinancials', fin.id), {
        visibleToClient: !fin.visibleToClient,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `caseFinancials/${fin.id}`);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm('Excluir este registro financeiro?')) return;
    try {
      await deleteDoc(doc(db, 'caseFinancials', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `caseFinancials/${id}`);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-emerald-50/20">
        <div className="flex items-center gap-2">
          <DollarSign size={20} className="text-emerald-600" />
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Financeiro do Caso</h3>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs hover:underline"
          >
            {showForm ? 'Fechar' : 'Gerenciar'}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Valor Total (R$)</label>
                  <input 
                    type="number"
                    required
                    value={formData.totalAmount}
                    onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
                  <input 
                    type="text"
                    required
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex: Em andamento, Quitativo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Total Parcelas</label>
                  <input 
                    type="number"
                    value={formData.installments}
                    onChange={e => setFormData({ ...formData, installments: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pagas</label>
                  <input 
                    type="number"
                    value={formData.installmentsPaid}
                    onChange={e => setFormData({ ...formData, installmentsPaid: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded text-emerald-600"
                    checked={formData.visibleToClient}
                    onChange={e => setFormData({ ...formData, visibleToClient: e.target.checked })}
                  />
                  <span className="text-xs font-bold text-gray-600">Exibir no Portal</span>
                </label>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 text-xs"
                >
                  {isSaving ? 'Salvando...' : 'Atualizar Financeiro'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        {financials.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="text-gray-300" size={32} />
            <p className="text-xs text-gray-500 text-center">Nenhum registro financeiro vinculado.</p>
          </div>
        ) : (
          financials.map(fin => (
            <div key={fin.id} className="space-y-4">
              <div className={`p-4 rounded-2xl border ${fin.visibleToClient ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100 opacity-70'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest leading-none ${fin.visibleToClient ? 'text-emerald-600' : 'text-gray-400'}`}>Total Contratado</label>
                    {isAdmin && (
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${fin.visibleToClient ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {fin.visibleToClient ? 'Visível' : 'Privado'}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => toggleVisibility(fin)}
                        className="p-1 text-gray-400 hover:text-emerald-600 rounded"
                      >
                        {fin.visibleToClient ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button 
                        onClick={() => deleteRecord(fin.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xl font-black text-emerald-900">R$ {fin.totalAmount?.toLocaleString()}</p>
                
                <div className="mt-4 pt-4 border-t border-emerald-100/30 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Status</p>
                    <p className="text-[10px] font-bold text-gray-700">{fin.status}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Parcelas</p>
                    <p className="text-[10px] font-bold text-gray-700">{fin.installmentsPaid} / {fin.installments}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
