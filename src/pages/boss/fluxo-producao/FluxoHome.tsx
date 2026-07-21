import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  UserPlus, 
  Briefcase, 
  ArrowRight, 
  ClipboardList,
  Layers,
  FileText,
  FileQuestion,
  ShieldCheck,
  CreditCard,
  Lock,
  Eye,
  CheckSquare,
  Cpu,
  HeartPulse,
  Cloud,
  Sparkles,
  Loader2,
  AlertTriangle,
  FolderOpen,
  Clock,
  Calendar,
  Activity,
  Plane
} from 'lucide-react';
import { flowSteps } from './utils/flowSteps';
import { flowRoutes } from './utils/flowRoutes';
import { runCaseComplianceAudit } from './utils/complianceAuditor';

export default function FluxoHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const caseIdParam = searchParams.get('caseId');

  const [loadingCase, setLoadingCase] = useState(false);
  const [activeCaseObj, setActiveCaseObj] = useState<any>(null);
  const [activeClientObj, setActiveClientObj] = useState<any>(null);
  const [activeInfoRequests, setActiveInfoRequests] = useState<any[]>([]);
  const [activeEvidenceRequests, setActiveEvidenceRequests] = useState<any[]>([]);
  const [activeFinancials, setActiveFinancials] = useState<any[]>([]);

  // Load active case resources if caseIdParam is active
  useEffect(() => {
    if (!caseIdParam) {
      setActiveCaseObj(null);
      setActiveClientObj(null);
      return;
    }

    const loadActiveCase = async () => {
      try {
        setLoadingCase(true);
        const caseRef = doc(db, 'cases', caseIdParam);
        const caseSnap = await getDoc(caseRef);

        if (caseSnap.exists()) {
          const cData = caseSnap.data();
          setActiveCaseObj({ id: caseSnap.id, ...cData });

          if (cData.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
            if (clientSnap.exists()) {
              setActiveClientObj({ id: clientSnap.id, ...clientSnap.data() });
            }
          }

          // Fetch associated dependencies
          const qInfo = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseIdParam));
          const infoSnap = await getDocs(qInfo);
          setActiveInfoRequests(infoSnap.docs.map(d => d.data()));

          const qEvid = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseIdParam));
          const evidSnap = await getDocs(qEvid);
          setActiveEvidenceRequests(evidSnap.docs.map(d => d.data()));

          const qFin = query(collection(db, 'caseFinancials'), where('caseId', '==', caseIdParam));
          const finSnap = await getDocs(qFin);
          setActiveFinancials(finSnap.docs.map(d => d.data()));
        }
      } catch (err) {
        console.error("Failed to load active case on home dashboard", err);
      } finally {
        setLoadingCase(false);
      }
    };

    loadActiveCase();
  }, [caseIdParam]);

  // Define the Main Entry Cards
  const entryCards = [
    {
      title: 'Cadastrar LEAD',
      description: 'Crie um lead no sistema para iniciar a prospecção técnica e o primeiro atendimento rápido de novos contatos.',
      icon: UserPlus,
      color: 'red',
      action: () => navigate('/boss/cadastrar.leads/private'),
      actionLabel: 'Cadastrar Lead'
    },
    {
      title: '1. Novo Cliente',
      description: 'Para pessoa que nunca foi cliente do escritório, não possui cadastro e não possui caso no sistema.',
      icon: UserPlus,
      color: 'blue',
      action: () => navigate('/boss-giffoni-clientes/fluxo-producao/cadastro?path=novo-cliente'),
      actionLabel: 'Preencher Ficha Inicial'
    },
    {
      title: '2. Já Sou Cliente',
      description: 'Para cliente já cadastrado no novo sistema que deseja cadastrar novo caso, processo em andamento ou novo serviço.',
      icon: Briefcase,
      color: 'purple',
      action: () => navigate('/boss-giffoni-clientes/fluxo-producao/cadastro?path=novo-caso'),
      actionLabel: 'Criar Novo Caso'
    },
    {
      title: '3. Continuar Fluxo',
      description: 'Relatório de pendências unificadas para resolver, atualizar ou retomar etapas pendentes.',
      icon: ClipboardList,
      color: 'orange',
      action: () => navigate('/boss-giffoni-clientes/fluxo-producao-exibir-pendencias'),
      actionLabel: 'Exibir Pendências'
    },
    {
      title: '4. Recadastramento',
      description: 'Para cliente antigo do escritório, anterior à data de corte, que existe no Google Drive/Docs, mas precisa de adequação.',
      icon: Cloud,
      color: 'cyan',
      action: () => navigate('/boss-giffoni-clientes/fluxo-producao/recadastramento'),
      actionLabel: 'Cadastrar Legado'
    },
    {
      title: '5. Portal do Cliente',
      description: 'Central do Portal do Cliente. Permite visualizar dados cadastrais do cliente, casos, entrevistas, serviços, provas e financeiro.',
      icon: Eye,
      color: 'emerald',
      action: () => navigate('/boss-giffoni-clientes/fluxo-producao/portal-cliente'),
      actionLabel: 'Gerenciar Portal'
    }
  ];

  // Icon selector helper
  const getStepIcon = (id: string) => {
    switch(id) {
      case 'cadastro': return ClipboardList;
      case 'onboarding': return Plane;
      case 'tipo-producao': return Layers;
      case 'dados-caso': return FileText;
      case 'solicitacoes-informacoes': return FileQuestion;
      case 'solicitacoes-provas': return CheckSquare;
      case 'digitalizacao-upload': return Cloud;
      case 'financeiro': return CreditCard;
      case 'edrp': return Lock;
      case 'revisao': return Eye;
      case 'protocolo': return ShieldCheck;
      case 'prazos': return Clock;
      case 'agendar-audiencias': return Calendar;
      case 'agendar-pericia': return Activity;
      case 'novo-caso': return ShieldCheck;
      case 'controladoria': return Cpu;
      case 'relatorio-integridade': return HeartPulse;
      default: return Sparkles;
    }
  };

  const getStepColorBg = (id: string) => {
    switch(id) {
      case 'cadastro': return 'bg-blue-50 text-blue-600';
      case 'onboarding': return 'bg-indigo-55 text-indigo-600 border border-indigo-100';
      case 'tipo-producao': return 'bg-purple-50 text-purple-600';
      case 'dados-caso': return 'bg-amber-50 text-amber-600';
      case 'solicitacoes-informacoes': return 'bg-teal-50 text-teal-600';
      case 'solicitacoes-provas': return 'bg-emerald-50 text-emerald-600';
      case 'digitalizacao-upload': return 'bg-sky-50 text-sky-600 border border-sky-100';
      case 'financeiro': return 'bg-rose-50 text-rose-600';
      case 'edrp': return 'bg-red-50 text-red-600';
      case 'revisao': return 'bg-cyan-50 text-cyan-600';
      case 'protocolo': return 'bg-indigo-50 text-indigo-600';
      case 'prazos': return 'bg-orange-50 text-orange-600';
      case 'agendar-audiencias': return 'bg-yellow-50 text-yellow-600';
      case 'agendar-pericia': return 'bg-fuchsia-50 text-fuchsia-600';
      case 'novo-caso': return 'bg-indigo-50 text-indigo-600';
      case 'controladoria': return 'bg-violet-50 text-violet-600';
      case 'relatorio-integridade': return 'bg-pink-50 text-pink-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  // Run dynamic auditor if activeCaseObj exists
  const activeAudit = activeCaseObj 
    ? runCaseComplianceAudit(
        activeCaseObj, 
        activeClientObj, 
        activeInfoRequests, 
        activeEvidenceRequests, 
        activeFinancials
      )
    : null;

  // Navigation router selector
  const handleNavigateToStep = (stepId: string) => {
    if (!caseIdParam) return;
    switch (stepId) {
      case 'cadastro':
        navigate(flowRoutes.editarCadastroCliente(caseIdParam));
        break;
      case 'onboarding':
        navigate(flowRoutes.onboarding(caseIdParam));
        break;
      case 'dados-caso':
        navigate(flowRoutes.dadosCaso(caseIdParam));
        break;
      case 'tipo-producao':
        navigate(flowRoutes.tipoServico(caseIdParam));
        break;
      case 'solicitacoes-provas':
        navigate(flowRoutes.solicitacoesProvas(caseIdParam));
        break;
      case 'digitalizacao-upload':
        navigate(flowRoutes.digitalizacaoUpload(caseIdParam));
        break;
      case 'solicitacoes-informacoes':
        navigate(flowRoutes.solicitacoesInformacoes(caseIdParam));
        break;
      case 'financeiro':
        navigate(flowRoutes.financeiro(caseIdParam));
        break;
      case 'edrp':
        navigate(flowRoutes.edrp(caseIdParam));
        break;
      case 'delegacao':
        navigate(flowRoutes.delegacao(caseIdParam));
        break;
      case 'revisao':
        navigate(flowRoutes.revisao(caseIdParam));
        break;
      case 'protocolo':
        navigate(flowRoutes.protocolo(caseIdParam));
        break;
      case 'prazos':
        navigate(flowRoutes.prazos(caseIdParam));
        break;
      case 'agendar-audiencias':
        navigate(flowRoutes.agendarAudiencias(caseIdParam));
        break;
      case 'agendar-pericia':
        navigate(flowRoutes.agendarPericia(caseIdParam));
        break;
      case 'compliance':
        navigate(flowRoutes.compliance(caseIdParam));
        break;
      case 'relatorio-integridade':
        navigate(flowRoutes.relatorioIntegridade(caseIdParam));
        break;
      case 'controladoria':
        navigate(flowRoutes.controladoria(caseIdParam));
        break;
      case 'arquivamento':
        navigate(flowRoutes.arquivamento(caseIdParam));
        break;
      default:
        break;
    }
  };

  return (
    <BossLayout>
      <div id="fluxo-producao-home-v2" className="space-y-12 animate-fade-in max-w-7xl mx-auto px-4 md:px-0">
        
        {/* PAGE INTRO */}
        <div className="border-b border-gray-100 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Centro de Produção</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded-md text-gray-600 text-[10px] font-black uppercase tracking-wider">
                  MÓDULO ATIVO
                </span>
                {caseIdParam && (
                  <button
                    type="button"
                    onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
                    className="text-xs text-indigo-650 hover:underline font-black font-mono ml-4"
                  >
                    ⟨ Sair do Caso Ativo
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed font-semibold">
                Central de diretrizes judiciais, faturamentos, análises de integridade e auditoria estrutural do escritório ⚖️ Giffoni Advogados Associados.
              </p>
            </div>
          </div>
        </div>

        {/* LOADING CASE SPINNER */}
        {loadingCase && (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3 bg-white border rounded-3xl">
            <Loader2 className="animate-spin text-indigo-650" size={32} />
            <span className="text-xs font-black font-mono tracking-widest uppercase">Carregando dados estruturais do caso...</span>
          </div>
        )}

        {/* -------------------------------------------------------------
            CASE OVERVIEW SUMMARY HEADER (Visible when caseIdParam exists)
           ------------------------------------------------------------- */}
        {caseIdParam && !loadingCase && activeCaseObj && (
          <div className="bg-slate-900 text-white rounded-[2rem] p-7 shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-indigo-500/20 text-indigo-300 rounded-lg shrink-0">
                  <FolderOpen size={16} />
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 font-mono">Prontuário Ativo Carregado</span>
              </div>
              <h2 className="text-xl font-black tracking-tight">{activeCaseObj.title || 'Caso Clínico Judicial'}</h2>
              <p className="text-xs text-slate-300 font-medium">
                Cliente:{' '}
                <strong className="text-white">
                  {activeClientObj?.pfDadosPessoais?.pf_nomeCompleto || activeClientObj?.pjDadosEmpresa?.pj_razaoSocial || activeClientObj?.name || 'Cliente Vinculado'}
                </strong>
                {' '}| Rito: <strong className="text-white">{activeCaseObj.registrationTypeKey?.toUpperCase()}</strong>
              </p>
            </div>

            <div className="flex items-center gap-4.5 bg-white/5 border border-white/10 rounded-2xl p-4 self-start md:self-center">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 font-mono block">Integridade do Caso</span>
                <span className="text-2xl font-black font-mono text-emerald-400 block mt-0.5">{activeAudit?.overallPercent || 0}%</span>
              </div>
              <span className="h-8 w-px bg-white/10 block" />
              <div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 font-mono block">Travas Críticas</span>
                <span className="text-2xl font-black font-mono text-rose-400 block mt-0.5">{activeAudit?.totalCriticalLocksCount || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* FOUR MAIN ENTRY PATHWAY CARDS */}
        {!caseIdParam && (
          <div>
            <div className="mb-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Opções de Início Operacional</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
              {entryCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    className="group bg-white border border-gray-150 rounded-[2.25rem] p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all active:scale-[0.99] flex flex-col justify-between min-h-[225px]"
                  >
                    <div className="space-y-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        card.color === 'red' ? 'bg-red-50 text-red-600 border border-red-100/50' :
                        card.color === 'blue' ? 'bg-blue-50 text-blue-600 border border-blue-100/50' :
                        card.color === 'purple' ? 'bg-purple-50 text-purple-600 border border-purple-100/50' :
                        card.color === 'cyan' ? 'bg-cyan-50 text-cyan-600 border border-cyan-100/50' :
                        card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' :
                        'bg-orange-50 text-orange-600 border border-orange-100/50'
                      }`}>
                        <Icon size={22} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-gray-900 text-sm tracking-tight">
                          {card.title}
                        </h4>
                        <p className="text-[11.5px] leading-relaxed text-gray-500 mt-2">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={card.action}
                      className={`mt-5 py-2 px-3 rounded-xl text-center text-[10.5px] tracking-wide font-black uppercase text-white transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        card.color === 'red' ? 'bg-red-600 hover:bg-red-700' :
                        card.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
                        card.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' :
                        card.color === 'cyan' ? 'bg-cyan-600 hover:bg-cyan-700' :
                        card.color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' :
                        'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      {card.actionLabel}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LINEAR PROCESS DIRECTORY (FLOW STEPS) */}
        {!loadingCase && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  {caseIdParam ? 'Checklists e Etapas do Caso Selecionado' : 'Eixos Funcionais do Fluxo'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {caseIdParam 
                    ? 'Acompanhe em tempo real a completamento e auditoria técnica de cada eixo do prontuário.' 
                    : 'Visão holística de conformidade e integridade dos 12 eixos operacionais.'}
                </p>
              </div>
              <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold text-gray-500 font-mono">
                COMPILADO TÉCNICO
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {flowSteps.map((step) => {
                const Icon = getStepIcon(step.id);
                
                // If this is Step 12 — Compliance, and we have a loaded case, we must construct a highly stylized, detailed card!
                if (step.id === 'compliance' && caseIdParam && activeAudit) {
                  return (
                    <div
                      key={step.id}
                      className="bg-white border-2 border-indigo-650 rounded-[2rem] p-5 shadow-sm relative overflow-hidden group flex flex-col justify-between hover:shadow-md transition-all min-h-[225px]"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                              <ShieldCheck size={16} />
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-gray-400 block uppercase h-3">
                                ETAPA {String(step.order).padStart(2, '0')}
                              </span>
                              <h5 className="font-black text-gray-900 text-xs mt-0.5 tracking-tight">
                                Compliance & Requisitos
                              </h5>
                            </div>
                          </div>

                          <span className="text-xs font-black font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg shrink-0">
                            {activeAudit.overallPercent}%
                          </span>
                        </div>

                        <div className="text-[11.5px] text-gray-500 leading-relaxed font-semibold space-y-1">
                          <p>Relatório de integridade transversal.</p>
                          <div className="flex items-center gap-1.5 text-rose-600 font-extrabold text-[10.5px]">
                            <AlertTriangle size={12} />
                            <span>{activeAudit.totalCriticalLocksCount} Travas Críticas Detectadas</span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-600 font-extrabold text-[10.5px]">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full block" />
                            <span>{activeAudit.totalPendingCount} Pendências Ativas</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="text-[9px] text-gray-400 font-mono font-black uppercase">
                          Atualizado: {activeCaseObj?.complianceData?.updatedAt ? new Date(activeCaseObj.complianceData.updatedAt).toLocaleDateString('pt-BR') : 'Sem data anterior'}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleNavigateToStep('compliance')}
                          className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-center text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                        >
                          <ShieldCheck size={13} />
                          <span>Abrir Compliance</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                }

                // If this is Step 06 — Digitalização/Upload, and we have a loaded case, we must construct a highly stylized, detailed card!
                if (step.id === 'digitalizacao-upload' && caseIdParam) {
                  const isPJ = activeClientObj?.type === 'PJ';
                  const wizardState = activeCaseObj?.solicitacoesProvasWizardState || {};
                  
                  const pfDocs = [
                    { id: 'procuracao', field: 'procuracaoFiles' },
                    { id: 'declaracao', field: 'declaracaoFiles' },
                    { id: 'contrato', field: 'contratoFiles' },
                    { id: 'rg', field: 'rgFiles' },
                    { id: 'cpf', field: 'cpfFiles' },
                    { id: 'residencia', field: 'residenciaFiles' }
                  ];

                  const pjDocs = [
                    { id: 'cnpj', field: 'cnpjFiles' },
                    { id: 'contratoSocial', field: 'contratoSocialFiles' },
                    { id: 'enderecoSede', field: 'enderecoSedeFiles' },
                    { id: 'procuracaoPJ', field: 'procuracaoFiles' },
                    { id: 'declaracaoPJ', field: 'declaracaoFiles' },
                    { id: 'contratoPJ', field: 'contratoFiles' },
                    { id: 'rgSocio', field: 'rgSocioFiles' },
                    { id: 'cpfSocio', field: 'cpfSocioFiles' },
                    { id: 'residenciaSocio', field: 'residenciaSocioFiles' }
                  ];

                  const docsStep = isPJ ? pjDocs : pfDocs;
                  const calculatedStatuses = docsStep.map(item => {
                    const fileList = wizardState[item.field] || [];
                    const isUploaded = fileList.length > 0;

                    let received = 'nao';
                    let receivedChannel = '';
                    let autoDigitalize = '';

                    if (item.id === 'procuracao' || item.id === 'procuracaoPJ') {
                      received = wizardState.q1_3 || 'nao';
                      receivedChannel = wizardState.q1_como_p_recebida || '';
                      autoDigitalize = wizardState.q1_deseja_digitalizar_p || '';
                    } else if (item.id === 'declaracao' || item.id === 'declaracaoPJ') {
                      received = wizardState.q2_4 || 'nao';
                      receivedChannel = wizardState.q2_como_d_recebida || '';
                      autoDigitalize = wizardState.q2_deseja_digitalizar_d || '';
                    } else if (item.id === 'contrato' || item.id === 'contratoPJ') {
                      received = wizardState.q3_4 || 'nao';
                      receivedChannel = wizardState.q3_como_c_recebida || '';
                      autoDigitalize = wizardState.q3_deseja_digitalizar_c || '';
                    } else if (item.id === 'rg' || item.id === 'rgSocio') {
                      received = wizardState.q4_rg === 'sim' || (wizardState.rgFiles?.length > 0) ? 'sim' : 'nao';
                      receivedChannel = wizardState.rgFiles?.length > 0 ? 'whatsapp' : 'fisico';
                      autoDigitalize = wizardState.q4_rg_digitalizar_agora || '';
                    } else if (item.id === 'cpf' || item.id === 'cpfSocio') {
                      received = wizardState.q4_cpf === 'sim' || (wizardState.cpfFiles?.length > 0) ? 'sim' : 'nao';
                      receivedChannel = wizardState.cpfFiles?.length > 0 ? 'whatsapp' : 'fisico';
                      autoDigitalize = wizardState.q4_cpf_digitalizar_agora || '';
                    } else if (item.id === 'residencia' || item.id === 'residenciaSocio') {
                      received = wizardState.q4_residencia === 'sim' || (wizardState.residenciaFiles?.length > 0) ? 'sim' : 'nao';
                      receivedChannel = wizardState.residenciaFiles?.length > 0 ? 'whatsapp' : 'fisico';
                      autoDigitalize = wizardState.q4_residencia_digitalizar_agora || '';
                    } else {
                      received = fileList.length > 0 ? 'sim' : 'nao';
                      receivedChannel = 'whatsapp';
                      autoDigitalize = 'sim';
                    }

                    let tagDigitalizacao: 'digitalizado' | 'pendente' | 'n_a' = 'n_a';
                    if (isUploaded) {
                      tagDigitalizacao = 'digitalizado';
                    } else if (received === 'sim') {
                      if (receivedChannel === 'fisico' && autoDigitalize === 'nao') {
                        tagDigitalizacao = 'pendente';
                      } else {
                        tagDigitalizacao = 'digitalizado';
                      }
                    }

                    let tagUpload: 'concluido' | 'pendente' | 'aguardando' = 'aguardando';
                    if (isUploaded) {
                      tagUpload = 'concluido';
                    } else if (received === 'sim') {
                      tagUpload = 'pendente';
                    }

                    return { digitalizacao: tagDigitalizacao, upload: tagUpload };
                  });

                  const totalCount = docsStep.length;
                  const countDig = calculatedStatuses.filter(s => s.digitalizacao === 'digitalizado').length;
                  const countUp = calculatedStatuses.filter(s => s.upload === 'concluido').length;
                  const countPendingUp = calculatedStatuses.filter(s => s.upload === 'pendente').length;
                  const numFaltaDig = totalCount - countDig;

                  const colorClass = getStepColorBg(step.id);

                  return (
                    <div
                      key={step.id}
                      onClick={() => handleNavigateToStep(step.id)}
                      className="bg-white border-2 border-sky-400 rounded-[2rem] p-5 shadow-sm relative overflow-hidden group flex flex-col justify-between hover:shadow-md transition-all min-h-[225px] cursor-pointer"
                    >
                      <div className="space-y-3.5 text-left">
                        <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-gray-400 block h-3 uppercase">
                                ETAPA {String(step.order).padStart(2, '0')}
                              </span>
                              <h5 className="font-extrabold text-gray-900 text-xs mt-0.5 tracking-tight">
                                {step.label}
                              </h5>
                            </div>
                          </div>
                          
                          <span className="text-[10px] font-black font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg shrink-0">
                            {Math.round((countUp / totalCount) * 100)}%
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-500 leading-relaxed font-semibold space-y-1 font-sans">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Total de Documentos:</span>
                            <span className="font-bold text-gray-800 font-mono">{totalCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-600">✓ Já Digitalizados:</span>
                            <span className="font-bold text-emerald-700 font-mono">{countDig}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-amber-600">⚡ Falta Digitalizar:</span>
                            <span className="font-bold text-amber-700 font-mono">{numFaltaDig}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-indigo-650">⬆ Upload Concluído:</span>
                            <span className="font-bold text-indigo-700 font-mono">{countUp}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-rose-600">⚠ Pendentes de Upload:</span>
                            <span className="font-semibold text-rose-700 font-mono">{countPendingUp}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          className="w-full py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-center text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Gerenciar Digitalizações</span>
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  );
                }

                // Normal / other steps
                const colorClass = getStepColorBg(step.id);
                return (
                  <div
                    key={step.id}
                    onClick={() => {
                      if (caseIdParam) {
                        handleNavigateToStep(step.id);
                      }
                    }}
                    className={`bg-white border rounded-3xl p-5 shadow-xs relative overflow-hidden group hover:border-gray-350 transition-all hover:shadow-xs flex flex-col justify-between min-h-[175px] ${
                      caseIdParam ? 'cursor-pointer hover:-translate-y-0.5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-mono font-black text-gray-400 block h-3 uppercase">
                          ETAPA {String(step.order).padStart(2, '0')}
                        </span>
                        <h5 className="font-extrabold text-gray-900 text-xs mt-0.5 tracking-tight truncate max-w-[150px]">
                          {step.label}
                        </h5>
                      </div>
                    </div>

                    <p className="text-[11.5px] text-gray-400 leading-relaxed mt-4 font-semibold">
                      {step.requiresCaseId 
                        ? (caseIdParam ? `Abrir painel correspondente ao Caso #${caseIdParam.slice(0, 8)}.` : 'Requer identificador técnico ativo cadastrado.') 
                        : 'Executável sem dependência direta de caso ativo.'}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-50 mt-3 text-[10px]">
                      {caseIdParam && step.requiresCaseId ? (
                        <span className="text-indigo-650 font-black tracking-wide inline-flex items-center gap-1">
                          Acesssar Passo ⟨
                        </span>
                      ) : (
                        <span className="text-gray-300 font-semibold uppercase font-mono tracking-wider text-[8px]">Giffoni Boss</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </BossLayout>
  );
}
