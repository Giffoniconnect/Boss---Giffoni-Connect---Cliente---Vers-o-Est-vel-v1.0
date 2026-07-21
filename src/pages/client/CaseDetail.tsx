// LEGADO/PREPARAÇÃO — Portal do Cliente real será externo. Não usado no roteamento ativo do BOSS.
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ClientLayout } from '../../components/Layout';
import { 
  ChevronLeft, Calendar, FileText, DollarSign, MessageSquare, 
  AlertCircle, Info, Scale, Beaker, Users, Clock, CheckCircle2 
} from 'lucide-react';
import CaseEventsPanel from '../../modules/cases/components/CaseEventsPanel';
import CasePendingTasksPanel from '../../modules/cases/components/CasePendingTasksPanel';
import CaseExplanationsPanel from '../../modules/cases/components/CaseExplanationsPanel';

export default function ClientCaseDetail() {
  const { slug, caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  
  // Sub-collections
  const [communications, setCommunications] = React.useState<any[]>([]);
  const [financial, setFinancial] = React.useState<any>(null);

  React.useEffect(() => {
    async function fetchData() {
      if (!caseId) return;
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          if (!data.visibleToClient) {
            navigate(`/portal-cliente-giffoni/${slug}/casos`);
            return;
          }
          setCaseData({ id: caseDoc.id, ...data });

          const [finSnap, commsSnap] = await Promise.all([
            getDocs(query(
              collection(db, 'caseFinancials'), 
              where('caseId', '==', caseId),
              where('visibleToClient', '==', true)
            )),
            getDocs(query(
              collection(db, 'caseCommunications'), 
              where('caseId', '==', caseId), 
              where('visibleToClient', '==', true),
              orderBy('createdAt', 'desc')
            ))
          ]);

          if (!finSnap.empty) setFinancial({ id: finSnap.docs[0].id, ...finSnap.docs[0].data() });
          setCommunications(commsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (error) {
        console.error('Error fetching case info:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [caseId]);

  if (loading) return <ClientLayout slug={slug || ''}><div className="animate-pulse space-y-8"><div className="h-20 bg-gray-50 rounded-3xl" /><div className="grid grid-cols-12 gap-8"><div className="col-span-3 h-96 bg-gray-50 rounded-3xl" /><div className="col-span-6 h-96 bg-gray-50 rounded-3xl" /><div className="col-span-3 h-96 bg-gray-50 rounded-3xl" /></div></div></ClientLayout>;
  if (!caseData) return <ClientLayout slug={slug || ''}><div>Caso não encontrado.</div></ClientLayout>;

  return (
    <ClientLayout slug={slug || ''}>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button
               onClick={() => navigate(`/portal-cliente-giffoni/${slug}/casos`)}
               className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-all border border-gray-100"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">{caseData.title}</h1>
                <span className="px-4 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-100">
                  {caseData.status}
                </span>
                <span className="px-4 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                  {caseData.actionCategory}
                </span>
              </div>
              <p className="text-gray-500 font-medium">
                {caseData.actionCategory === 'judicial' ? (
                  <>Processo nº <span className="text-gray-900 font-mono font-bold tracking-tight">{caseData.processNumber || 'N/A'}</span></>
                ) : (
                  <span className="uppercase text-[10px] font-black text-gray-400">Procedimento {caseData.actionCategory}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUNA ESQUERDA - 3/12 */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Info size={16} /> Detalhes do Caso
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Parte Adversa</p>
                  <p className="text-sm font-bold text-gray-900">{caseData.adverseParty || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Ação</p>
                  <p className="text-sm font-bold text-gray-900">{caseData.caseType || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tribunal/Vara</p>
                  <p className="text-sm font-bold text-gray-900">{caseData.tribunal || 'N/A'} - {caseData.court || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Comarca</p>
                  <p className="text-sm font-bold text-gray-900">{caseData.district || 'N/A'}</p>
                </div>
              </div>
            </div>

            <CaseEventsPanel 
              caseId={caseId!} 
              clientId={caseData.clientId} 
              isAdmin={false} 
            />
          </div>

          {/* COLUNA CENTRAL - 6/12 */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm flex-1 flex flex-col min-h-[400px]">
              <h3 className="text-xl font-black text-gray-900 tracking-tight mb-8 flex items-center gap-2">
                <Clock size={24} className="text-blue-600" /> Andamento Processual
              </h3>

              <div className="flex-1 space-y-10 overflow-y-auto pr-4">
                {communications.filter(c => c.type !== 'solicitacao' && c.type !== 'explicacao').length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 italic gap-4">
                    <CheckCircle2 size={48} className="opacity-20" />
                    <p>Acompanhando novos andamentos...</p>
                  </div>
                ) : (
                  communications.filter(c => c.type !== 'solicitacao' && c.type !== 'explicacao').map((comm) => (
                    <div key={comm.id} className="relative pl-10 border-l-2 border-gray-100 last:border-0 last:pb-0">
                      <div className="absolute left-[-11px] top-0 w-5 h-5 rounded-full border-4 border-white bg-blue-600" />
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                             Andamento
                           </span>
                           <span className="text-[10px] font-bold text-gray-400">{new Date(comm.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                        </div>
                        <div className="p-6 rounded-3xl rounded-tl-none ring-1 bg-gray-50 ring-gray-100 text-gray-700">
                          <p className="text-base leading-relaxed font-medium">{comm.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <CasePendingTasksPanel 
              caseId={caseId!} 
              clientId={caseData.clientId} 
              isAdmin={false} 
            />
          </div>

          {/* COLUNA DIREITA - 3/12 */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <CaseExplanationsPanel 
              caseId={caseId!} 
              clientId={caseData.clientId} 
              isAdmin={false} 
            />

             <div className="bg-gray-900 p-8 rounded-[32px] text-white shadow-2xl shadow-gray-200">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <DollarSign size={16} className="text-blue-400" /> Financeiro Resumido
              </h3>
              {financial ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status de Pagamento</p>
                    <p className="text-2xl font-black text-white">{financial.status}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Parcelas</span>
                      <span className="text-sm font-bold">{financial.installmentsPaid} de {financial.installments}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-1000" 
                        style={{ width: `${(financial.installmentsPaid / financial.installments) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">Sem informações financeiras no momento.</p>
              )}
            </div>

             <div className="bg-blue-600 p-8 rounded-[32px] text-white shadow-xl shadow-blue-500/20">
               <h3 className="text-xs font-black text-blue-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MessageSquare size={16} /> Suporte Direto
              </h3>
              <p className="text-sm font-bold leading-relaxed mb-6">Ficou com alguma dúvida sobre o andamento do seu caso?</p>
              <button className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all shadow-lg">
                Falar com Advogado
              </button>
            </div>
          </div>

        </div>
      </div>
    </ClientLayout>
  );
}
