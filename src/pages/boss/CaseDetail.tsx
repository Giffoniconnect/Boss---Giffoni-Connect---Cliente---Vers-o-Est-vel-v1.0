// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BossLayout } from '../../components/Layout';
import { 
  ChevronLeft, Calendar, FileText, DollarSign, MessageSquare, 
  AlertCircle, Info, Scale, Users, Clock, CheckCircle2, ShieldCheck, FileBadge, Sparkles
} from 'lucide-react';

import CaseEventsPanel from '../../modules/cases/components/CaseEventsPanel';
import CasePendingTasksPanel from '../../modules/cases/components/CasePendingTasksPanel';
import CaseExplanationsPanel from '../../modules/cases/components/CaseExplanationsPanel';
import CaseCommunicationsPanel from '../../modules/cases/components/CaseCommunicationsPanel';
import CaseFinancialsPanel from '../../modules/cases/components/CaseFinancialsPanel';
import CaseEDRPPanel from '../../modules/cases/components/CaseEDRPPanel';

// Step components for tab reusability
import ColetaInfoStep from './fluxo-producao/ColetaInfoStep';
import ColetaProvasStep from './fluxo-producao/ColetaProvasStep';
import ControladoriaStep from './fluxo-producao/ControladoriaStep';
import IntegridadeStep from './fluxo-producao/IntegridadeStep';

type DetailTab =
  | 'resumo'
  | 'dados_caso'
  | 'edrp'
  | 'solicitacoes_informacoes'
  | 'solicitacoes_provas'
  | 'financeiro'
  | 'audiencias_pericias'
  | 'reunioes'
  | 'andamentos_publicos'
  | 'controladoria'
  | 'relatorio_integridade';

export default function BossCaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  
  const [caseData, setCaseData] = React.useState<any>(null);
  const [client, setClient] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<DetailTab>('resumo');
  const [subLoading, setSubLoading] = React.useState(false);
  const [alertText, setAlertText] = React.useState<string | null>(null);

  const triggerAlert = (msg: string) => {
    setAlertText(msg);
    setTimeout(() => setAlertText(null), 4000);
  };

  const fetchData = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const caseDoc = await getDoc(doc(db, 'cases', caseId));
      if (caseDoc.exists()) {
        const data = caseDoc.data();
        setCaseData({ id: caseDoc.id, ...data });
        
        // Fetch client
        const clientDoc = await getDoc(doc(db, 'clients', data.clientId));
        if (clientDoc.exists()) setClient(clientDoc.data());
      }
    } catch (error) {
      console.error('Error fetching case or client info:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <BossLayout>
        <div className="animate-pulse flex flex-col gap-8">
          <div className="h-20 bg-gray-100 rounded-2xl" />
          <div className="grid grid-cols-3 gap-8">
            <div className="h-64 bg-gray-100 rounded-2xl" />
            <div className="col-span-2 h-64 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </BossLayout>
    );
  }

  if (!caseData) {
    return <BossLayout><div className="p-12 text-center text-red-600 font-bold">Caso não encontrado</div></BossLayout>;
  }

  const clientName = client?.type === 'PF' 
    ? client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem nome'
    : client?.pjDadosEmpresa?.pj_razaoSocial || client?.pjData?.pj_razaoSocial || 'Sem nome';

  return (
    <BossLayout>
      <div className="flex flex-col gap-6">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (caseData?.clientId) {
                  navigate(`/boss-giffoni-clientes/clientes/${caseData.clientId}/casos`);
                } else {
                  navigate('/boss-giffoni-clientes/casos');
                }
              }}
              className="p-3 bg-white border border-gray-150 rounded-xl text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">{caseData.title}</h1>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-105">
                  {caseData.status}
                </span>
                <button
                  onClick={async () => {
                    const newValue = !caseData.visibleToClient;
                    await updateDoc(doc(db, 'cases', caseId!), { visibleToClient: newValue, updatedAt: serverTimestamp() });
                    setCaseData({ ...caseData, visibleToClient: newValue });
                    triggerAlert(`Visibilidade alterada para: ${newValue ? 'Visível' : 'Oculto'}`);
                  }}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    caseData.visibleToClient 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : 'bg-red-50 text-red-600 border border-red-100'
                  }`}
                >
                  {caseData.visibleToClient ? 'Visível no Portal' : 'Oculto no Portal'}
                </button>
              </div>
              <p className="text-xs text-gray-400 font-semibold leading-relaxed mt-0.5">
                Cliente: <span className="text-gray-900 font-bold">{clientName}</span> | Pasta: <span className="font-mono text-gray-750 font-bold">{caseId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              navigate(`/boss-giffoni-clientes/fluxo-producao?caseId=${caseId}&clientId=${caseData.clientId}&slug=${caseData.clientSlug || ''}&step=dados_caso`);
            }}
            className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Abrir no Fluxo de Produção
          </button>
        </div>

        {alertText && (
          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs font-semibold leading-relaxed flex items-center gap-2">
            <Sparkles size={14} /> {alertText}
          </div>
        )}

        {/* TABS SELECTOR PANEL */}
        <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl w-full overflow-x-auto border border-gray-150 scrollbar-none">
          {tabButton('resumo', 'Resumo')}
          {tabButton('dados_caso', 'Dados')}
          {tabButton('edrp', 'EDRP')}
          {tabButton('solicitacoes_informacoes', 'Informações')}
          {tabButton('solicitacoes_provas', 'Provas')}
          {tabButton('financeiro', 'Financeiro')}
          {tabButton('audiencias_pericias', 'Audiências/Perícias')}
          {tabButton('reunioes', 'Reuniões')}
          {tabButton('andamentos_publicos', 'Público')}
          {tabButton('controladoria', 'Controladoria')}
          {tabButton('relatorio_integridade', 'Integridade')}
        </div>

        {/* TAB WORKSPACE */}
        <div className="min-h-[460px]">
          {subLoading && (
            <div className="h-60 flex flex-col items-center justify-center text-gray-400 italic text-xs gap-2">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Carregando dados...</span>
            </div>
          )}

          {!subLoading && (
            <>
              {activeTab === 'resumo' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column */}
                  <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Info size={16} /> Dados Centrais
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Parte Adversa</label>
                          <p className="text-xs font-extrabold text-gray-900">{caseData.adverseParty || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Tipo de Ação</label>
                          <p className="text-xs font-extrabold text-gray-900">{caseData.caseType || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Categoria</label>
                          <p className="text-xs font-black text-blue-600 uppercase italic">{caseData.actionCategory || 'N/A'}</p>
                        </div>
                        {caseData.actionCategory === 'judicial' && (
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Processo CNJ</label>
                            <p className="text-xs font-mono font-bold text-gray-900">{caseData.processNumber || 'N/A'}</p>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Tribunal</label>
                          <p className="text-xs font-extrabold text-gray-900">{caseData.tribunal || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <CaseEventsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} />
                  </div>

                  {/* Middle Column */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    <CaseCommunicationsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} />
                    <CasePendingTasksPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} />
                  </div>

                  {/* Right Column */}
                  <div className="lg:col-span-3 flex flex-col gap-6">
                    <CaseExplanationsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} />
                    <CaseFinancialsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} />
                  </div>
                </div>
              )}

              {activeTab === 'dados_caso' && (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider border-b border-gray-50 pb-3">Informações Detalhadas do Processo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Título da Pasta</p>
                      <p className="font-bold text-gray-900">{caseData.title}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Parte Adversa</p>
                      <p className="font-bold text-gray-900">{caseData.adverseParty || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vara / Comarca</p>
                      <p className="font-bold text-gray-900">{caseData.court || 'N/A'} (Comarca: {caseData.district || 'N/A'})</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tribunal Governamental</p>
                      <p className="font-bold text-gray-900">{caseData.tribunal || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Advogado Patrono</p>
                      <p className="font-bold text-gray-900">{caseData.responsibleLawyer || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Critério de Prioridade</p>
                      <p className="font-bold text-gray-900 capitalize">{caseData.priority}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 shadow-sm">Resumo dos Fatos Narrados</p>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium text-gray-700 font-sans">
                        {caseData.description || 'Nenhum resumo adicionado.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'edrp' && (
                <CaseEDRPPanel caseId={caseId!} caseData={caseData} onUpdate={(updated) => setCaseData(updated)} />
              )}

              {activeTab === 'solicitacoes_informacoes' && (
                <ColetaInfoStep 
                  caseId={caseId!} 
                  clientId={caseData.clientId} 
                  onNext={() => setActiveTab('solicitacoes_provas')} 
                  onSetLoading={setSubLoading} 
                  onAlert={triggerAlert} 
                />
              )}

              {activeTab === 'solicitacoes_provas' && (
                <ColetaProvasStep 
                  caseId={caseId!} 
                  clientId={caseData.clientId} 
                  onNext={() => setActiveTab('financeiro')} 
                  onSetLoading={setSubLoading} 
                  onAlert={triggerAlert} 
                />
              )}

              {activeTab === 'financeiro' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8">
                    <CaseFinancialsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} />
                  </div>
                  <div className="lg:col-span-4">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest">Informações de Integrações</h4>
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed">Defina chaves Stripe ou Asaas acessando o menu lateral de Configurações para habilitar a geração de links automatizados.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'audiencias_pericias' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider flex items-center gap-2"><Calendar size={18} /> Audiências, Perícias e Julgamentos programados</h3>
                  <CaseEventsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} filterType={['audiencia', 'pericia']} />
                </div>
              )}

              {activeTab === 'reunioes' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider flex items-center gap-2"><Users size={18} /> Reuniões de Alinhamento e Entrevistas</h3>
                  <CaseEventsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} filterType={['reuniao']} />
                </div>
              )}

              {activeTab === 'andamentos_publicos' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <CaseCommunicationsPanel caseId={caseId!} clientId={caseData.clientId} isAdmin={true} forcePublicOnly={true} />
                </div>
              )}

              {activeTab === 'controladoria' && (
                <ControladoriaStep 
                  caseId={caseId!} 
                  onNext={() => setActiveTab('relatorio_integridade')} 
                  onSetLoading={setSubLoading} 
                  onAlert={triggerAlert} 
                />
              )}

              {activeTab === 'relatorio_integridade' && (
                <IntegridadeStep 
                  caseId={caseId!} 
                  clientId={caseData.clientId} 
                  slug={caseData.clientSlug || ''} 
                  onSetLoading={setSubLoading} 
                  onAlert={triggerAlert} 
                />
              )}
            </>
          )}
        </div>
        
      </div>
    </BossLayout>
  );

  function tabButton(id: DetailTab, label: string) {
    const isSelected = activeTab === id;
    return (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
          isSelected 
            ? 'bg-white text-gray-900 shadow-sm border border-gray-150' 
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        {label}
      </button>
    );
  }
}
