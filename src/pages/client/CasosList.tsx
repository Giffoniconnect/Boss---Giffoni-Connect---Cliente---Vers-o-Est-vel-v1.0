// LEGADO/PREPARAÇÃO — Portal do Cliente real será externo. Não usado no roteamento ativo do BOSS.
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ClientLayout } from '../../components/Layout';
import { Briefcase, ChevronRight, Clock, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function ClientCasosList() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [cases, setCases] = React.useState<any[]>([]);
  const [clientData, setClientData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchClientAndCases() {
      if (!slug) return;
      try {
        // 1. Get client by slug
        const portalPath = `clientPortals/${slug}`;
        const portalRef = doc(db, 'clientPortals', slug);
        const portalSnap = await getDoc(portalRef);
        
        if (portalSnap.exists()) {
          const { clientId } = portalSnap.data();
          const clientSnap = await getDoc(doc(db, 'clients', clientId));
          if (clientSnap.exists()) {
            setClientData(clientSnap.data());
            
            // 2. Fetch cases for this client
            const casesPath = 'cases';
            const q = query(
              collection(db, casesPath), 
              where('clientId', '==', clientId),
              where('visibleToClient', '==', true),
              orderBy('updatedAt', 'desc')
            );
            const casesSnap = await getDocs(q);
            setCases(casesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'cases');
      } finally {
        setLoading(false);
      }
    }
    fetchClientAndCases();
  }, [slug]);

  const clientName = clientData?.type === 'PF' 
    ? (clientData?.pfDadosPessoais?.pf_nomeCompleto || clientData?.pfData?.pf_nomeCompleto || '')
    : (clientData?.pjDadosEmpresa?.pj_razaoSocial || clientData?.pjData?.pj_razaoSocial || '');

  return (
    <ClientLayout slug={slug || ''} clientName={clientName}>
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Meus Casos</h1>
          <p className="text-gray-500 text-lg">Acompanhe o progresso de suas solicitações e processos jurídicos.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-40 bg-gray-50 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {cases.length === 0 ? (
              <div className="py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
                <h3 className="text-xl font-bold text-gray-900">Nenhum caso ativo</h3>
                <p className="text-gray-500">Você ainda não possui casos cadastrados em nosso sistema.</p>
              </div>
            ) : (
              cases.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => navigate(`/portal-cliente-giffoni/${slug}/casos/${c.id}`)}
                  className="group bg-white border border-gray-100 rounded-[32px] p-8 hover:shadow-2xl hover:shadow-blue-900/5 transition-all cursor-pointer flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                  
                  <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-gray-200 group-hover:bg-blue-600 transition-colors">
                    <Briefcase size={36} />
                  </div>

                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                       <h2 className="text-2xl font-bold text-gray-900 truncate tracking-tight">{c.title}</h2>
                       <span className="px-4 py-1 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full border border-blue-100">
                        {c.status}
                       </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                      <div className="flex items-center gap-3 text-gray-500">
                        <Clock size={18} className="text-blue-500/50" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Última Atualização</p>
                          <p className="text-sm font-bold text-gray-700">{c.lastUpdate || 'Pendente'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 font-mono text-xs font-bold ring-1 ring-gray-100">
                          {c.processNumber?.slice(-2) || '??'}
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Processo</p>
                          <p className="text-sm font-mono font-bold text-gray-700">{c.processNumber || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <Calendar size={18} className="text-blue-500/50" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Próximo Evento</p>
                          <p className="text-sm font-bold text-gray-700">Aguardando agenda</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <AlertCircle size={18} className="text-orange-500/50" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pendências</p>
                          <p className="text-sm font-bold text-orange-600">Nenhuma</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center w-14 h-14 bg-gray-50 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ChevronRight size={24} />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
