import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  UserPlus, 
  FilePlus2, 
  Play, 
  ArrowRight, 
  Briefcase, 
  Search,
  User,
  Clock,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';

interface InicioStepProps {
  onSelectAction: (action: 'new_client' | 'new_case' | 'resume', extra?: any) => void;
  onSetLoading: (loading: boolean) => void;
}

export default function InicioStep({ onSelectAction, onSetLoading }: InicioStepProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [activeCases, setActiveCases] = useState<any[]>([]);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [searchCaseQuery, setSearchCaseQuery] = useState('');
  
  // States of lists selection inside the tabs
  const [isNewCaseMode, setIsNewCaseMode] = useState(false);
  const [isResumeMode, setIsResumeMode] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      onSetLoading(true);
      try {
        // Fetch clients
        const clientsSnap = await getDocs(query(collection(db, 'clients'), orderBy('createdAt', 'desc')));
        const clientList = clientsSnap.docs.map(d => ({
          id: d.id,
          name: d.data().type === 'PF' 
            ? d.data().pfDadosPessoais?.pf_nomeCompleto || d.data().pfData?.pf_nomeCompleto || 'Sem nome'
            : d.data().pjDadosEmpresa?.pj_razaoSocial || d.data().pjData?.pj_razaoSocial || 'Sem nome',
          slug: d.data().slug || '',
          ...d.data()
        }));
        setClients(clientList);

        // Fetch cases in production
        const casesSnap = await getDocs(query(collection(db, 'cases'), orderBy('updatedAt', 'desc')));
        const casesList = casesSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setActiveCases(casesList);
      } catch (err) {
        console.error('Error loading initial lists:', err);
      } finally {
        onSetLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchClientQuery.toLowerCase())
  );

  const filteredCases = activeCases.filter(c => {
    const titleMatch = c.title?.toLowerCase().includes(searchCaseQuery.toLowerCase());
    const clientName = clients.find(cl => cl.id === c.clientId)?.name || '';
    const clientMatch = clientName.toLowerCase().includes(searchCaseQuery.toLowerCase());
    const serviceMatch = c.registrationType?.toLowerCase().includes(searchCaseQuery.toLowerCase());
    return titleMatch || clientMatch || serviceMatch;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center max-w-xl mx-auto space-y-2 mb-4">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Como deseja iniciar o Fluxo de Trabalho?</h2>
        <p className="text-sm text-gray-500">Escolha uma das diretrizes produtivas abaixo para prosseguir com segurança.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cam 1: Cadastrar Novo Cliente */}
        <motion.div 
          onClick={() => {
            setIsNewCaseMode(false);
            setIsResumeMode(false);
            onSelectAction('new_client');
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-white border-2 border-gray-150 hover:border-blue-600 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all shadow-sm group hover:shadow-md"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <UserPlus size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900">1. Cadastrar Novo Cliente</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Recomendado para novos contratos, quando o cliente ainda não tem cadastro e inicia seu primeiro caso.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-black text-blue-600 uppercase tracking-widest mt-6 pt-4 border-t border-gray-50">
            Cadastrar <ArrowRight size={14} className="ml-1 animate-pulse" />
          </div>
        </motion.div>

        {/* Cam 2: Cadastrar Novo Caso */}
        <motion.div 
          onClick={() => {
            setIsNewCaseMode(true);
            setIsResumeMode(false);
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`bg-white border-2 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all shadow-sm group ${
            isNewCaseMode ? 'border-purple-600 shadow-purple-50' : 'border-gray-150 hover:border-purple-600'
          }`}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
              <FilePlus2 size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900">2. Cadastrar Novo Caso</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Use este caminho quando o cliente já possui um cadastro e contratou uma nova demanda comercial.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-black text-purple-600 uppercase tracking-widest mt-6 pt-4 border-t border-gray-50">
            Selecionar <ArrowRight size={14} className="ml-1" />
          </div>
        </motion.div>

        {/* Cam 3: Continuar Fluxo Existente */}
        <motion.div 
          onClick={() => {
            setIsResumeMode(true);
            setIsNewCaseMode(false);
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`bg-white border-2 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all shadow-sm group ${
            isResumeMode ? 'border-emerald-600 shadow-emerald-50' : 'border-gray-150 hover:border-emerald-600'
          }`}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Play size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900">3. Retomar Fluxo Existente</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Retome o andamento de um caso existente que se encontra atualmente em pipeline de produção.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-black text-emerald-600 uppercase tracking-widest mt-6 pt-4 border-t border-gray-50">
            Retomar <ArrowRight size={14} className="ml-1" />
          </div>
        </motion.div>
      </div>

      {isNewCaseMode && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50/40 border border-purple-100 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <h4 className="font-bold text-purple-950 text-sm">Selecione o Cliente na Lista</h4>
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Pesquisar cliente..."
                value={searchClientQuery}
                onChange={(e) => setSearchClientQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-purple-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-purple-400"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-purple-400" />
            </div>
          </div>
          {filteredClients.length === 0 ? (
            <p className="text-xs text-purple-600 italic">Nenhum cliente cadastrado correspondendo aos termos.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
              {filteredClients.map(c => (
                <div 
                  key={c.id}
                  onClick={() => onSelectAction('new_case', { clientId: c.id, slug: c.slug })}
                  className="bg-white p-3 border border-purple-100 rounded-2xl hover:border-purple-600 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-extrabold text-purple-950">{c.name}</p>
                    <p className="text-xs font-mono text-purple-500">{c.slug}</p>
                  </div>
                  <UserPlus size={16} className="text-purple-400" />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {isResumeMode && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50/40 border border-emerald-100 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h4 className="font-bold text-emerald-950 text-sm font-sans">Selecione o Caso Operational para Retomada</h4>
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Buscar por caso, cliente, CNJ..."
                value={searchCaseQuery}
                onChange={(e) => setSearchCaseQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-emerald-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-emerald-400" />
            </div>
          </div>
          {filteredCases.length === 0 ? (
            <p className="text-xs text-emerald-600 italic">Sem casos em produção no momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
              {filteredCases.map(c => {
                const clientObj = clients.find(cl => cl.id === c.clientId);
                return (
                  <div 
                    key={c.id}
                    onClick={() => onSelectAction('resume', { caseId: c.id })}
                    className="bg-white p-3 border border-emerald-100 rounded-2xl hover:border-emerald-600 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-black tracking-widest text-emerald-650 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {c.productionStage || 'Início'}
                      </span>
                      <span className="text-xs font-mono text-gray-500">{c.registrationType || 'Ação'}</span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-emerald-950 uppercase">{c.title || 'Sem título'}</p>
                      <p className="text-xs text-gray-600 font-medium leading-none">Cliente: {clientObj?.name || 'Não identificado'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
