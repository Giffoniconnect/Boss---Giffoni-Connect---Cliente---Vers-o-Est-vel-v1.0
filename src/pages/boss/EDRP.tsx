// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, updateDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BossLayout } from '../../components/Layout';
import { 
  ClipboardList, 
  ExternalLink, 
  User,
  ChevronRight, 
  ArrowLeft, 
  ArrowRight,
  Briefcase,
  AlertTriangle,
  FileText,
  Clock
} from 'lucide-react';
import { 
  EDRP_STAGES, 
  getRegTypeLabel, 
  getStageLabel, 
  getStageColor,
  EDRPStageId
} from '../../utils/edrpHelpers';
import { motion } from 'motion/react';

export default function BossEDRP() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen for clients
    const clientsUnsubscribe = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientMap: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const displayName = data.type === 'PF' 
          ? (data.pfDadosPessoais?.pf_nomeCompleto || data.pfData?.pf_nomeCompleto)
          : (data.pjDadosEmpresa?.pj_razaoSocial || data.pjData?.pj_razaoSocial);
        clientMap[doc.id] = displayName || 'Cliente sem nome';
      });
      setClients(clientMap);
    });

    // 2. Listen for cases
    const path = 'cases';
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      clientsUnsubscribe();
      unsubscribe();
    };
  }, []);

  // Handler to progress stage quickly
  const handleMoveStage = async (caseId: string, currentStageId: string, direction: 'prev' | 'next') => {
    const currentIndex = EDRP_STAGES.findIndex(s => s.id === currentStageId);
    let targetIndex = currentIndex;

    if (direction === 'prev' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < EDRP_STAGES.length - 1) {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex !== currentIndex) {
      const targetStage = EDRP_STAGES[targetIndex].id;
      try {
        const caseRef = doc(db, 'cases', caseId);
        
        // Handle special archive logic if moving to 'arquivamento'
        const isArchiving = targetStage === 'arquivamento';
        
        await updateDoc(caseRef, {
          edrpStage: targetStage,
          ...(isArchiving ? {
            status: 'arquivado',
            archived: true,
            archivedAt: serverTimestamp(),
            archiveReason: 'Movido para etapa arquivamento na esteira EDRP.'
          } : {}),
          updatedAt: serverTimestamp(),
          lastUpdate: `Caso movido para etapa EDRP: ${getStageLabel(targetStage)}.`
        });
      } catch (err) {
        console.error('Error updating EDRP stage:', err);
        alert('Erro ao atualizar etapa do EDRP.');
      }
    }
  };

  return (
    <BossLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Esteira EDRP</h1>
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
              Esteira de Desenvolvimento e Registro Processual
            </p>
          </div>
        </div>
        <p className="text-gray-500 max-w-2xl text-sm">
          Acompanhe e faça o controle visual de seus processos ao longo dos 12 estágios da esteira operacional.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 font-sans">
          <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <span className="text-xs font-bold uppercase tracking-widest">Sincronizando esteira...</span>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-10 pt-2 select-none h-[calc(100vh-280px)] min-h-[500px]">
          {EDRP_STAGES.map((stage) => {
            // Group cases by this stage (implicitly default older cases to 'cadastro')
            const stageCases = cases.filter(c => (c.edrpStage || 'cadastro') === stage.id);

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80 bg-gray-50 border border-gray-200/60 rounded-3xl p-4 flex flex-col h-full hover:shadow-md transition-shadow"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <h3 className="font-bold text-gray-800 text-sm truncate max-w-[200px]" title={stage.label}>
                      {stage.label}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-gray-200/70 text-gray-700">
                    {stageCases.length}
                  </span>
                </div>

                {/* Stage Body - Cases List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {stageCases.map((c) => {
                    const clientName = clients[c.clientId] || 'Cliente não encontrado';
                    const hasNext = stage.id !== 'arquivamento';
                    const hasPrev = stage.id !== 'cadastro';

                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          {/* Top row */}
                          <div className="flex items-center justify-between">
                            <span className="inline-block text-[9px] font-black uppercase tracking-wider text-blue-600 truncate max-w-[150px]">
                              {clientName}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                              c.priority === 'alta' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {c.priority || 'Normal'}
                            </span>
                          </div>

                          {/* Case Title */}
                          <p className="font-bold text-gray-900 text-xs leading-snug line-clamp-2">
                            {c.title}
                          </p>

                          {/* Registration Type Label */}
                          {c.registrationType && (
                            <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">
                              <FileText size={10} />
                              <span className="truncate max-w-[190px]">{getRegTypeLabel(c.registrationType)}</span>
                            </div>
                          )}

                          {/* Responsible */}
                          <div className="text-[10px] text-gray-400 font-medium">
                            Resp: <span className="text-gray-600 font-bold">{c.responsibleLawyer || 'N/D'}</span>
                          </div>

                          {/* Next Action / Delegation */}
                          {c.delegationTask ? (
                            <div className="bg-gray-50/50 p-2 rounded-xl text-[10px] text-gray-500 border border-gray-100 line-clamp-2">
                              📬 <strong className="text-gray-700">Delegação:</strong> {c.delegationTask}
                            </div>
                          ) : (
                            <div className="text-[9px] text-gray-400 italic">
                              Nenhuma ação delegada cadastrada.
                            </div>
                          )}
                        </div>

                        {/* Card controls */}
                        <div className="flex items-center justify-between border-t border-gray-50 pt-2.5 gap-2 mt-1">
                          {/* Navigator */}
                          <div className="flex items-center gap-1">
                            <button
                              disabled={!hasPrev}
                              onClick={() => handleMoveStage(c.id, stage.id, 'prev')}
                              className="w-7 h-7 bg-gray-50 hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:hover:bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200 transition-colors cursor-pointer"
                              title="Recuar etapa"
                            >
                              <ArrowLeft size={12} />
                            </button>
                            <button
                              disabled={!hasNext}
                              onClick={() => handleMoveStage(c.id, stage.id, 'next')}
                              className="w-7 h-7 bg-gray-50 hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:hover:bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200 transition-colors cursor-pointer"
                              title="Avançar etapa"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>

                          {/* Open Button */}
                          <button
                            onClick={() => navigate(`/boss-giffoni-clientes/casos/${c.id}`)}
                            className="text-[10px] font-bold text-gray-600 hover:text-blue-600 inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors border border-gray-100 cursor-pointer ml-auto"
                          >
                            <span>Abrir</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}

                  {stageCases.length === 0 && (
                    <div className="py-12 text-center text-gray-300 border-2 border-dashed border-gray-200 rounded-2xl">
                      <Briefcase className="mx-auto text-gray-200 mb-1" size={28} />
                      <span className="text-[10px] font-bold">Sem Casos</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BossLayout>
  );
}
