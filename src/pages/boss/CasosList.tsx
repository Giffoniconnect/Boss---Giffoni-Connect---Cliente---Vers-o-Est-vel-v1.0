// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { BossLayout } from '../../components/Layout';
import { Plus, Search, Filter, ChevronRight, Briefcase, X, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { EDRP_STAGES, getStageLabel, getStageColor, getRegTypeLabel } from '../../utils/edrpHelpers';

export default function BossCasosList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterClientId = searchParams.get('clientId');
  
  const [cases, setCases] = React.useState<any[]>([]);
  const [clients, setClients] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStage, setSelectedStage] = React.useState('Todos');

  React.useEffect(() => {
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

    const path = 'cases';
    let q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    
    if (filterClientId) {
      q = query(collection(db, path), where('clientId', '==', filterClientId), orderBy('updatedAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => {
      clientsUnsubscribe();
      unsubscribe();
    };
  }, [filterClientId]);

  const filteredCases = cases.filter(c => {
    const clientName = clients[c.clientId] || '';
    const search = searchTerm.toLowerCase();

    const matchesStage = selectedStage === 'Todos' || (c.edrpStage || 'cadastro') === selectedStage;

    const matchesSearch = (
      c.title?.toLowerCase().includes(search) ||
      c.processNumber?.includes(searchTerm) ||
      c.adverseParty?.toLowerCase().includes(search) ||
      clientName.toLowerCase().includes(search) ||
      c.responsibleLawyer?.toLowerCase().includes(search)
    );

    return matchesStage && matchesSearch;
  });

  return (
    <BossLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-gray-200">
              <Briefcase size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Visão Global Escritório</h1>
              <p className="text-gray-500 font-medium">Administre todos os processos jurídicos integrados.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/boss-giffoni-clientes/casos/novo')}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
          >
            <Plus size={20} />
            Novo Caso
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente, caso ou número do processo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            />
          </div>
          
          {filterClientId && (
            <button 
              onClick={() => navigate('/boss-giffoni-clientes/casos')}
              className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-100 transition-colors"
            >
              <X size={16} />
              Limpar Filtro de Cliente
            </button>
          )}

          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <Filter size={20} />
            Filtros
          </button>
        </div>

        {/* EDRP Stage filter bar */}
        <div className="bg-white border border-gray-100 p-2.5 rounded-2xl flex items-center gap-2 overflow-x-auto scrollbar-none shadow-sm">
          <button
            onClick={() => setSelectedStage('Todos')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors select-none cursor-pointer ${
              selectedStage === 'Todos'
                ? 'bg-gray-950 text-white shadow-md'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            Todos os Casos
          </button>
          {EDRP_STAGES.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors select-none cursor-pointer ${
                selectedStage === stage.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredCases.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/boss-giffoni-clientes/casos/${c.id}`)}
                className="group bg-white p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50/50 transition-all cursor-pointer flex items-center gap-6"
              >
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <Briefcase size={28} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 truncate tracking-tight">{c.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      c.status === 'ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="font-bold text-blue-600/70">{clients[c.clientId] || 'Cliente não encontrado'}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span className="font-mono">{c.actionCategory === 'judicial' ? c.processNumber : `PROC. ${c.actionCategory?.toUpperCase()}`}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>{c.adverseParty || 'N/A'}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>{c.caseType}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>{c.responsibleLawyer}</span>
                  </div>

                  {/* EDRP discrete display */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getStageColor(c.edrpStage || 'cadastro')}`}>
                      Esteira: {getStageLabel(c.edrpStage || 'cadastro')}
                    </span>
                    {c.registrationType && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 border border-gray-100 text-gray-600">
                        {getRegTypeLabel(c.registrationType)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden lg:flex flex-col items-end gap-1 px-8 border-l border-gray-100">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest leading-none">Prioridade</p>
                  <span className={`font-bold ${
                    c.priority === 'alta' ? 'text-red-500' : 'text-blue-600'
                  }`}>
                    {c.priority || 'Normal'}
                  </span>
                </div>

                <div className="text-gray-300 group-hover:text-blue-600 transition-colors">
                  <ChevronRight size={24} />
                </div>
              </motion.div>
            ))}

            {filteredCases.length === 0 && !loading && (
              <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
                <h3 className="text-lg font-bold text-gray-900">Nenhum caso encontrado</h3>
                <p className="text-gray-500">Comece criando um novo caso jurídico.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BossLayout>
  );
}
