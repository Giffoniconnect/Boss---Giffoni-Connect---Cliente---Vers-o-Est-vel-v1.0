import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { FileText, Trash2, Check, X, PlusCircle, AlertCircle, Cloud, ChevronRight, Download } from 'lucide-react';

interface ColetaProvasStepProps {
  caseId: string;
  clientId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function ColetaProvasStep({ caseId, clientId, onNext, onSetLoading, onAlert }: ColetaProvasStepProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchEvidenceRequests = async () => {
    onSetLoading(true);
    try {
      const q = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId));
      const snap = await getDocs(q);
      const items = snap.docs.map(docRef => ({
        id: docRef.id,
        ...docRef.data()
      }));
      setRequests(items);
    } catch (err) {
      console.error(err);
    } finally {
      onSetLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidenceRequests();
  }, [caseId]);

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'caseEvidenceRequests'), {
        caseId,
        clientId,
        title: newTitle.trim(),
        description: newDesc.trim(),
        status: 'pendente', // pendente, entregue, aprovado, rejeitado, revisao_solicitada
        files: [], // array of objects (name, url, mimeType, uploadedAt)
        // Cloud Sync parameters for future automation
        googleDriveFolderId: '',
        googleDriveFileId: '',
        googleDriveFileUrl: '',
        driveSyncStatus: 'nao_sincronizado', // nao_sincronizado, sincronizando, sincronizado, erro
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewTitle('');
      setNewDesc('');
      fetchEvidenceRequests();
      onAlert('Solicitação de prova cadastrada para o cliente!');
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível registrar a nova prova.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'caseEvidenceRequests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      fetchEvidenceRequests();
      onAlert(`Status da prova atualizado para: ${newStatus}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta solicitação de prova?')) return;
    try {
      await deleteDoc(doc(db, 'caseEvidenceRequests', id));
      fetchEvidenceRequests();
      onAlert('Prova removida com sucesso!');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <FileText size={16} className="text-blue-600" /> Solicitador de Provas e Documentos Importantes
        </h4>
        <p className="text-xs text-gray-500 font-semibold leading-relaxed">
          Especifique os documentos (como RG, Comprovante de Residência, Contratos) que o cliente deve anexar.
        </p>

        <form onSubmit={handleAddRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título do Documento (ex: RG e CPF consolidado, Holerites...)"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>
          <div>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Instruções específicas para o cliente..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="px-5 py-2.5 bg-gray-900 text-white font-bold text-xs hover:bg-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
          >
            <PlusCircle size={14} /> Solicitar Prova
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <FileText size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 italic">Nenhuma prova pendente foi solicitada para este caso.</p>
          </div>
        ) : (
          requests.map(r => (
            <div key={r.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-50 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                      r.status === 'pendente' 
                        ? 'bg-amber-50 text-amber-700 border-amber-100' 
                        : r.status === 'entregue' 
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : r.status === 'aprovado'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {r.status === 'pendente' ? 'Aguardando Envio' : r.status === 'entregue' ? 'Entregue p/ Revisão' : r.status === 'aprovado' ? 'Documento Aprovado' : 'Rejeitado / Pendente de ajuste'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1 font-mono">
                      <Cloud size={12} /> Sync: {r.driveSyncStatus || 'Não integrado'}
                    </span>
                  </div>
                  <h5 className="font-bold text-xs text-gray-800">{r.title}</h5>
                  {r.description && <p className="text-[10px] text-gray-500 font-semibold">{r.description}</p>}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {r.status === 'entregue' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'aprovado')}
                        className="p-1 px-3 bg-emerald-55 text-emerald-800 hover:bg-emerald-100 rounded-lg text-[10px] font-extrabold uppercase transition-all"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'rejeitado')}
                        className="p-1 px-3 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-extrabold uppercase transition-all"
                      >
                        Recusar
                      </button>
                    </>
                  )}
                  {r.status === 'aprovado' && (
                    <button
                      onClick={() => handleUpdateStatus(r.id, 'pendente')}
                      className="p-1 px-3 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[10px] font-extrabold uppercase transition-all"
                    >
                      Editar status
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Uploaded Files Section */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Documentos anexados:</p>
                {(!r.files || r.files.length === 0) ? (
                  <p className="text-[10px] italic text-gray-400 font-semibold">Nenhum arquivo enviado até o momento.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {r.files.map((fileRef: any, fIdx: number) => (
                      <div key={fIdx} className="p-3 bg-gray-50 rounded-xl border border-gray-150 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{fileRef.name}</p>
                          <p className="text-[9px] font-mono text-gray-400">Tipo: {fileRef.mimeType || 'Desconhecido'}</p>
                        </div>
                        <a
                          href={fileRef.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-white border border-gray-150 rounded-lg hover:border-gray-900 transition-colors shrink-0"
                          title="Fazer download"
                        >
                          <Download size={14} className="text-gray-600" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
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
