import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { 
  UserPlus, 
  ArrowLeft, 
  Search,
  Sparkles,
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
  FileDigit,
  RefreshCw,
  AlertTriangle,
  Clock,
  Calendar,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';

export default function PendenciasFluxo() {
  const navigate = useNavigate();

  // Helper functions for localized descriptive labels without technical jargon
  const getDadosCaso = (item: any) => {
    if (item.type === 'client') {
      return item.subtitle || `Cadastro do Cliente - Slug: /${item.slug || ''}`;
    }
    if (item.type === 'client_no_case') {
      return item.subtitle || 'Cliente cadastrado sem caso ativo vinculado.';
    }
    
    const formula = item.todoistFormula || item.formulaTodoist || item.previewTodoist || item.todoistPreview;
    if (formula) return formula;
    
    let rawType = item.registrationType || item.actionCategory || item.actionType || 'Tipo de serviço não definido';
    let typeFriendly = rawType;
    if (typeof rawType === 'string') {
      const lower = rawType.toLowerCase();
      if (lower === 'judicial') typeFriendly = 'Processo Judicial em Andamento';
      else if (lower === 'inicial' || lower === 'peticao_inicial') typeFriendly = 'Petição Inicial a Ajuizar';
      else if (lower === 'administrativo' || lower === 'requerimento_administrativo') typeFriendly = 'Requerimento Administrativo';
      else if (lower === 'recorrente' || lower === 'recurso') typeFriendly = 'Recurso em Andamento';
      else if (lower === 'consultoria' || lower === 'consultivo') typeFriendly = 'Consultoria Jurídica';
    }
    return `Caso #${item.id || ''} — ${typeFriendly}`;
  };

  const getFinanceiroPendenteDesc = (item: any) => {
    if (item.financeiroStatusDescription) return item.financeiroStatusDescription;
    if (item.financialPendingReason) return item.financialPendingReason;
    if (item.financeiroMessage) return item.financeiroMessage;
    if (item.billingPendingReason) return item.billingPendingReason;

    if (item.financeiroStatus === 'pendente') {
      return 'Lançamento de faturamento ou parcelas contratuais pendentes de compensação.';
    }
    if (item.financialPending === true) {
      return 'Aguardando validação/adiantamento de guias judiciais ou custas de cartório.';
    }
    if (item.billingPending === true) {
      return 'Gateway de cobrança reportou pendência ou falta de assinatura de recorrência.';
    }

    return 'Necessário definir modelo de cobrança, faturar custas processuais ou registrar contratação de honorários.';
  };

  // Load cases and incomplete clients from firebase
  const [casesList, setCasesList] = useState<any[]>([]);
  const [incompleteClients, setIncompleteClients] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Search filter
  const [resumeSearchQuery, setResumeSearchQuery] = useState('');

  // Selected category state - defaults to the first category: cadastro_pendente
  const [selectedCategory, setSelectedCategory] = useState<string>('cadastro_pendente');

  // Delete/Confirmation states
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const handleDeletePendency = async (item: any) => {
    setDeleting(true);
    try {
      if (item.type === 'case') {
        await deleteDoc(doc(db, 'cases', item.id));
        try {
          await deleteDoc(doc(db, 'casos', item.id));
        } catch (e) {
          // ignore
        }
      } else {
        await deleteDoc(doc(db, 'clients', item.id));
        try {
          await deleteDoc(doc(db, 'clientes', item.id));
        } catch (e) {
          // ignore
        }
      }
      setRetryCount(prev => prev + 1);
      setConfirmingDeleteId(null);
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Erro ao excluir: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  };

  // Load pending/active flows
  useEffect(() => {
    async function fetchProductionFlows() {
      setLoading(true);
      try {
        const snapshots = await getDocs(collection(db, 'cases'));
        const clSnap = await getDocs(collection(db, 'clients'));
        
        const allClientsFetched: any[] = clSnap.docs.map(d => ({
          clientId: d.id,
          ...d.data()
        }));
        setAllClients(allClientsFetched);

        const list: any[] = [];
        snapshots.forEach((docSnap) => {
          const data = docSnap.data();
          const matchedCli = allClientsFetched.find(cl => cl.clientId === data.clientId);
          
          let clientName = 'Cliente não identificado';
          if (matchedCli) {
            clientName = matchedCli.type === 'PF'
              ? (matchedCli.pfDadosPessoais?.pf_nomeCompleto || matchedCli.pfData?.pf_nomeCompleto || 'Cliente PF')
              : (matchedCli.pjDadosEmpresa?.pj_razaoSocial || matchedCli.pjData?.pj_razaoSocial || 'Cliente PJ');
          }

          list.push({
            id: docSnap.id,
            clientName,
            ...data
          });
        });

        // Filter for active/incomplete cases in production
        const activeCases = list.filter((c: any) => {
          return c.status === 'rascunho' || ['em_producao', 'com_pendencias', 'pausado', 'devolvido'].includes(c.productionStatus) || !c.productionStatus;
        });

        // Filter for incomplete clients
        const incomplete: any[] = [];
        allClientsFetched.forEach((cli) => {
          const missingFields = cli.missingFields || [];
          const isIncomplete = 
            cli.cadastroIncompleto === true ||
            cli.portalStatus === 'nao_criado' ||
            (cli.active === false && missingFields.length > 0);

          if (isIncomplete) {
            incomplete.push({
              id: cli.clientId,
              name: cli.type === 'PF'
                ? (cli.pfDadosPessoais?.pf_nomeCompleto || cli.pfData?.pf_nomeCompleto || 'Cliente PF')
                : (cli.pjDadosEmpresa?.pj_razaoSocial || cli.pjData?.pj_razaoSocial || 'Cliente PJ'),
              ...cli
            });
          }
        });

        setCasesList(activeCases);
        setIncompleteClients(incomplete);
      } catch (err) {
        console.error('Error fetching production state:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProductionFlows();
  }, [retryCount]);

  // Safe Inference heuristically when productionStage is missing or empty
  const inferStage = (c: any): string => {
    const s = (c.productionStage || '').toLowerCase().trim();
    
    if (s) {
      if (s === 'cadastro' || s === 'cadastro_cliente' || s === 'cadastro-cliente') {
        return 'cadastro_pendente';
      }
      if (s === 'dados-caso' || s === 'dadoscaso' || s === 'dados_caso' || s === 'entrevista') {
        return 'entrevista_pendente';
      }
      if (s === 'tipo-producao' || s === 'tipo_producao' || s === 'tipo_servico' || s === 'tiposervico' || s === 'tipo-servico') {
        return 'tipo_servico_pendente';
      }
      if (s === 'solicitacoes-provas' || s === 'solicitacoesprovas' || s === 'coleta_provas' || s === 'provas') {
        return 'provas_pendentes';
      }
      if (s === 'solicitacoes-informacoes' || s === 'solicitacoessextra' || s === 'solicitacoesinformacoes' || s === 'coleta_informacoes') {
        return 'informacoes_pendentes';
      }
      if (s === 'estruturacao' || s === 'estruturacaostep' || s === 'estruturacao_step') {
        return 'estruturacao_pendente';
      }
      if (s === 'financeiro' || s === 'financeiro_step') {
        return 'financeiro_pendente';
      }
      if (s === 'edrp' || s === 'edrp_fluxo') {
        return 'edrp_pendente';
      }
      if (s === 'revisao' || s === 'revisaotecnica' || s === 'revisao-tecnica' || s === 'revisao_tecnica' || s === 'delegacao') {
        return 'revisao_pendente';
      }
      if (s === 'protocolo' || s === 'protocolo_step') {
        return 'protocolo_pendente';
      }
      if (s === 'controladoria' || s === 'controladoriastep') {
        return 'controladoria_pendente';
      }
      if (s === 'relatorio_integridade' || s === 'relatorio-integridade' || s === 'relatoriointegridade' || s === 'integridade') {
        return 'integridade_pendente';
      }
    }

    // Heuristic inference based on active fields
    if (c.pendingDocs || c.missingDocs) {
      return 'entrevista_pendente';
    }
    if (!c.actionType && !c.actionCategory) {
      if (c.facts || c.aboutCase || c.resumeBriefing) {
        return 'tipo_servico_pendente';
      }
      return 'entrevista_pendente';
    }
    if (c.collectProvasStatus === 'pendente' || (c.pendingProvasCount && c.pendingProvasCount > 0)) {
      return 'provas_pendentes';
    }
    if (c.financeiroStatus === 'pendente' || c.financialPending === true || c.billingPending) {
      return 'financeiro_pendente';
    }

    // Default fallback to "Integridade Pendente" on lack of sufficient info
    return 'integridade_pendente';
  };

  const handleContinueCase = (c: any) => {
    if (!c.id) return;
    const inferredKey = inferStage(c);
    let pagePath = 'dados-caso';
    
    if (inferredKey === 'entrevista_pendente') pagePath = 'dados-caso';
    else if (inferredKey === 'tipo_servico_pendente') pagePath = 'tipo-producao';
    else if (inferredKey === 'provas_pendentes') pagePath = 'solicitacoes-provas';
    else if (inferredKey === 'informacoes_pendentes') pagePath = 'solicitacoes-informacoes';
    else if (inferredKey === 'estruturacao_pendente') pagePath = 'edrp';
    else if (inferredKey === 'financeiro_pendente') pagePath = 'financeiro';
    else if (inferredKey === 'edrp_pendente') pagePath = 'edrp';
    else if (inferredKey === 'revisao_pendente') pagePath = 'revisao';
    else if (inferredKey === 'protocolo_pendente') pagePath = 'protocolo';
    else if (inferredKey === 'controladoria_pendente') pagePath = 'controladoria';
    else if (inferredKey === 'integridade_pendente') pagePath = 'relatorio-integridade';

    navigate(`/boss-giffoni-clientes/fluxo-producao/${c.id}/${pagePath}`);
  };

  const handleEditIncompleteClient = (clientId: string) => {
    navigate(`/boss-giffoni-clientes/fluxo-producao/cadastro?editClientId=${clientId}`);
  };

  // Map 12 specific categories of pendencies with strict OSM styles
  const categoriesMetadata = [
    {
      key: 'cadastro_pendente',
      label: 'Cadastro Pendente',
      description: 'Qualificação fática e cadastro do contratante pendente de preenchimento ou aprovação.',
      icon: UserPlus,
      color: 'border-blue-100 hover:border-blue-400',
      activeColor: 'bg-blue-50/70 border-blue-500 text-blue-900',
      tagColor: 'bg-blue-100 text-blue-800'
    },
    {
      key: 'entrevista_pendente',
      label: 'Entrevista Pendente',
      description: 'Preenchimento de entrevista, briefing ou dados iniciais (5W2H) do caso contratado.',
      icon: ClipboardList,
      color: 'border-sky-100 hover:border-sky-450',
      activeColor: 'bg-sky-50 border-sky-600 text-sky-950',
      tagColor: 'bg-sky-200 text-sky-850'
    },
    {
      key: 'tipo_servico_pendente',
      label: 'Tipo de Serviço Pendente',
      description: 'Definição e enquadramento das teses produtivas ou modalidade de enquadramento contratual.',
      icon: Layers,
      color: 'border-indigo-100 hover:border-indigo-400',
      activeColor: 'bg-indigo-50/70 border-indigo-600 text-indigo-950',
      tagColor: 'bg-indigo-100 text-indigo-800'
    },
    {
      key: 'provas_pendentes',
      label: 'Provas Pendentes',
      description: 'Coleta fática de relatórios, prints de contatos ou extratos obrigatórios à tese mestre.',
      icon: CheckSquare,
      color: 'border-emerald-100 hover:border-emerald-400',
      activeColor: 'bg-emerald-50/70 border-emerald-600 text-emerald-950',
      tagColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      key: 'informacoes_pendentes',
      label: 'Informações Pendentes',
      description: 'Informações extras solicitadas ao cliente em fase de entrevista refinada.',
      icon: FileQuestion,
      color: 'border-teal-100 hover:border-teal-400',
      activeColor: 'bg-teal-50/70 border-teal-600 text-teal-905',
      tagColor: 'bg-teal-100 text-teal-805'
    },
    {
      key: 'estruturacao_pendente',
      label: 'Estruturação Pendente',
      description: 'Análise estrutural, preparação de escopo e design da tese de produção.',
      icon: Cpu,
      color: 'border-purple-100 hover:border-purple-400',
      activeColor: 'bg-purple-50/70 border-purple-600 text-purple-950',
      tagColor: 'bg-purple-100 text-purple-800'
    },
    {
      key: 'financeiro_pendente',
      label: 'Financeiro Pendente',
      description: 'Vencimentos contratuais, parcelamentos pendentes ou faturamento de custas de guias.',
      icon: CreditCard,
      color: 'border-pink-100 hover:border-pink-400',
      activeColor: 'bg-pink-50/70 border-pink-500 text-pink-950',
      tagColor: 'bg-pink-100 text-pink-800'
    },
    {
      key: 'edrp_pendente',
      label: 'EDRP Pendente',
      description: 'Estudo de Defesa e Resultados Possíveis mestre do caso sob conformidade técnica.',
      icon: Sparkles,
      color: 'border-orange-100 hover:border-orange-450',
      activeColor: 'bg-orange-50/70 border-orange-500 text-orange-950',
      tagColor: 'bg-orange-100 text-orange-800'
    },
    {
      key: 'revisao_pendente',
      label: 'Revisão Pendente',
      description: 'Revisão técnica fática de textos, dados mestre e formatação técnica por mentor.',
      icon: Eye,
      color: 'border-amber-100 hover:border-amber-400',
      activeColor: 'bg-amber-50/70 border-amber-500 text-amber-955',
      tagColor: 'bg-amber-100 text-amber-850'
    },
    {
      key: 'protocolo_pendente',
      label: 'Protocolo Pendente',
      description: 'Distribuição e protocolo final com consolidação fática do número processual.',
      icon: ShieldCheck,
      color: 'border-rose-100 hover:border-rose-450',
      activeColor: 'bg-rose-50 border-rose-500 text-rose-950',
      tagColor: 'bg-rose-100 text-rose-800'
    },
    {
      key: 'controladoria_pendente',
      label: 'Controladoria Pendente',
      description: 'Triagem de prazos iniciais e controle mestre dos links processuais.',
      icon: Layers,
      color: 'border-cyan-100 hover:border-cyan-400',
      activeColor: 'bg-cyan-50 border-cyan-500 text-cyan-950',
      tagColor: 'bg-cyan-100 text-cyan-800'
    },
    {
      key: 'integridade_pendente',
      label: 'Integridade Pendente',
      description: 'Incoerência estrutural séria de dados processuais ou preechimento vital.',
      icon: AlertTriangle,
      color: 'border-slate-350 hover:border-red-400',
      activeColor: 'bg-slate-900 border-red-500 text-white',
      tagColor: 'bg-red-500 text-white font-black'
    }
  ];

  // Populate dynamic items grouped by the 12 categories
  const categoriesMap = useMemo(() => {
    const map: Record<string, any[]> = {
      cadastro_pendente: [],
      entrevista_pendente: [],
      tipo_servico_pendente: [],
      provas_pendentes: [],
      informacoes_pendentes: [],
      estruturacao_pendente: [],
      financeiro_pendente: [],
      edrp_pendente: [],
      revisao_pendente: [],
      protocolo_pendente: [],
      controladoria_pendente: [],
      integridade_pendente: []
    };

    // 1. Incomplete clients map directly to cadastro_pendente
    map.cadastro_pendente = incompleteClients.map(cli => ({
      ...cli,
      type: 'client',
      title: cli.name,
      subtitle: `Slug: /${cli.slug || ''}`,
      stageLabel: 'Cadastro do Cliente',
      badge: 'Incompleto',
      badgeStyle: 'bg-red-50 text-red-700 border-red-150',
      actionLabel: 'Retomar Cadastro',
      go: () => navigate(`/boss-giffoni-clientes/fluxo-producao/cadastro?editClientId=${cli.id}`)
    }));

    // 2. Identify clients that are NOT incomplete, but don't have any cases, map them to entrevista_pendente
    const nonIncompleteClients = allClients.filter(cli => {
      return !incompleteClients.some(ic => ic.id === cli.clientId);
    });

    nonIncompleteClients.forEach(cli => {
      const hasCase = casesList.some(c => c.clientId === cli.clientId);
      if (!hasCase) {
        const clientName = cli.type === 'PF'
          ? (cli.pfDadosPessoais?.pf_nomeCompleto || cli.pfData?.pf_nomeCompleto || 'Cliente PF')
          : (cli.pjDadosEmpresa?.pj_razaoSocial || cli.pjData?.pj_razaoSocial || 'Cliente PJ');

        map.entrevista_pendente.push({
          id: cli.clientId,
          clientId: cli.clientId,
          caseId: null,
          type: 'client_no_case',
          title: clientName,
          subtitle: `Código: #${cli.clientId} • Slug: /${cli.slug || ''}`,
          stageLabel: 'Sem caso vinculado',
          badge: 'Sem Caso',
          badgeStyle: 'bg-amber-100 text-amber-800 border-amber-305',
          sectionLabel: 'Cadastro Realizado',
          details: 'Cadastro existe, mas ainda não há caso vinculado.',
          actionLabel: 'Criar/retomar novo caso',
          isNoCase: true,
          go: () => navigate(`/boss-giffoni-clientes/fluxo-producao/cadastro?editClientId=${cli.clientId}`)
        });
      }
    });

    // 3. Map active cases into respective categories using inferStage()
    casesList.forEach(c => {
      const inferredKey = inferStage(c);
      const clientName = c.clientName || 'Contratante';
      const isRascunho = c.status === 'rascunho';

      const caseItem = {
        ...c,
        type: 'case',
        title: clientName,
        subtitle: `Caso #${c.id} • ${c.actionCategory || c.actionType || 'Sem tipo definido'}`,
        stageLabel: `Fase: ${c.productionStage || 'Início'}`,
        badge: isRascunho ? 'Rascunho' : 'Ativo',
        badgeStyle: isRascunho ? 'bg-amber-150 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-150',
        sectionLabel: 'Fluxo Retomado',
        actionLabel: 'Continuar',
        go: () => handleContinueCase(c)
      };

      if (map[inferredKey]) {
        map[inferredKey].push(caseItem);
      } else {
        map.integridade_pendente.push(caseItem);
      }
    });

    return map;
  }, [casesList, incompleteClients, allClients]);

  // Apply search query filters
  const filteredCategoriesMap = useMemo(() => {
    const query = resumeSearchQuery.toLowerCase().trim();
    if (!query) return categoriesMap;

    const filtered: Record<string, any[]> = {};
    Object.keys(categoriesMap).forEach(key => {
      filtered[key] = categoriesMap[key].filter(item => {
        const title = (item.title || item.name || '').toLowerCase();
        const subtitle = (item.subtitle || '').toLowerCase();
        const stage = (item.stageLabel || '').toLowerCase();
        return title.includes(query) || subtitle.includes(query) || stage.includes(query);
      });
    });

    return filtered;
  }, [categoriesMap, resumeSearchQuery]);

  // Handle select fallback
  useEffect(() => {
    const itemsInSelected = (filteredCategoriesMap[selectedCategory] as any[])?.length || 0;
    if (itemsInSelected === 0) {
      const found = Object.keys(filteredCategoriesMap).find(k => (filteredCategoriesMap[k] as any[]).length > 0);
      if (found) {
        setSelectedCategory(found);
      }
    }
  }, [filteredCategoriesMap, selectedCategory]);

  // Total pendencies across categories
  const totalPendenciesCount = useMemo(() => {
    return Object.values(categoriesMap).reduce((acc: number, list: any) => acc + (list?.length || 0), 0);
  }, [categoriesMap]);

  return (
    <BossLayout>
      <div id="fluxo-producao-pendencias-v2" className="space-y-6 animate-fade-in max-w-[1600px] mx-auto px-4 md:px-6 2xl:px-8">
        
        {/* TOP HEADER CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
              className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-600 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title="Voltar para Centro de Produção"
              id="back-to-production-center"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Painel de Pendências</h1>
                <span className="px-2 py-0.5 bg-orange-100 border border-orange-200 text-orange-900 rounded-md text-[10px] font-black uppercase tracking-wider">
                  {totalPendenciesCount} Pendente(s)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Retomada estratégica de fluxos com relatórios unificados para as 11 divisões produtivas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRetryCount(prev => prev + 1)}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-205 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Minerar Firebase
            </button>
          </div>
        </div>

        {/* DETAILED PENDENCIES REPORT STRUCTURE */}
        <div className="bg-white border border-gray-150 rounded-[2.5rem] p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
                Instruções de Conformidade & Retomada
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Clique nas categorias abaixo para filtrar e usar a ação de retomada fática por caso.
              </p>
            </div>

            {/* SEARCH */}
            <div className="relative min-w-[260px]">
              <input
                type="text"
                placeholder="Pesquisar pendência..."
                value={resumeSearchQuery}
                onChange={(e) => setResumeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-150 rounded-xl text-xs outline-none focus:ring-1 focus:ring-orange-400 focus:bg-white transition-all text-gray-800"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-orange-500" size={28} />
              <p className="text-xs font-mono text-gray-400">Varrendo estruturas de casos e clientes no Firestore...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: THE 11 PRIORITIZED DIVISIONS */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-3">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  Divisões do Fluxo Produtivo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  {categoriesMetadata.map((cat) => {
                    const CatIcon = cat.icon;
                    const itemsList = filteredCategoriesMap[cat.key] || [];
                    const hasItems = itemsList.length > 0;
                    const isSelected = selectedCategory === cat.key;

                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSelectedCategory(cat.key)}
                        className={`text-left border rounded-2xl p-3.5 transition-all text-xs flex items-center justify-between gap-3 cursor-pointer group hover:shadow-xs outline-none ${
                          isSelected ? cat.activeColor : 'bg-gray-50/40 hover:bg-white border-gray-150 text-gray-700'
                        }`}
                        id={`category-btn-${cat.key}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white shadow-xs text-orange-600' : 'bg-gray-100 text-gray-500 group-hover:text-gray-900 group-hover:bg-gray-200'
                          }`}>
                            <CatIcon size={15} />
                          </div>
                          <div className="min-w-0 leading-tight">
                            <h5 className="font-extrabold text-xs text-gray-900 leading-snug break-words">{cat.label}</h5>
                            <p className="text-[9.5px] text-gray-400 mt-0.5 leading-snug break-words">{cat.description}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            hasItems 
                              ? (isSelected ? 'bg-orange-600 text-white font-extrabold' : 'bg-gray-200 text-gray-700 font-extrabold')
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {itemsList.length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: PENDECIES DATA CONTAINER */}
              <div className="lg:col-span-7 xl:col-span-8 bg-gray-50/50 border border-gray-150 rounded-2xl p-5 flex flex-col justify-between min-h-[420px]">
                <div>
                  
                  {/* Selected Category Metadata */}
                  {(() => {
                    const currentMeta = categoriesMetadata.find(m => m.key === selectedCategory);
                    if (!currentMeta) return null;
                    const MetaIcon = currentMeta.icon;

                    return (
                      <div className="border-b border-gray-200 pb-3.5 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-800 shrink-0">
                            <MetaIcon size={13} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-gray-905 text-xs uppercase tracking-tight">
                              {currentMeta.label}
                            </h4>
                            <p className="text-[10px] text-gray-400 leading-tight">
                              {currentMeta.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* List of active items */}
                  {(() => {
                    const activeList = filteredCategoriesMap[selectedCategory] || [];
                    if (activeList.length === 0) {
                      return (
                        <div className="py-20 text-center space-y-2">
                          <AlertTriangle className="mx-auto text-gray-300" size={24} />
                          <p className="text-xs font-bold text-gray-500">Nenhuma pendência ativa para esta divisão.</p>
                          <p className="text-[10px] text-gray-400 max-w-xs mx-auto">
                            Tudo regularizado de acordo com o filtro. Selecione outra divisão produtiva para inspecionar.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                        {activeList.map((item, idx) => {
                          const isFinanceiroPendente = selectedCategory === 'financeiro_pendente' || item.financeiroStatus === 'pendente' || item.financialPending === true || item.billingPending === true;
                          return (
                            <div
                              key={item.id || idx}
                              className="bg-white border border-gray-150 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-gray-300 transition-all hover:shadow-xs animate-fade-in"
                            >
                              <div className="space-y-3.5">
                                {/* Linha superior */}
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-black uppercase border tracking-wider rounded px-2 py-0.5 ${item.badgeStyle}`}>
                                    {item.badge}
                                  </span>
                                  {item.sectionLabel && (
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider font-mono">
                                      • {item.sectionLabel}
                                    </span>
                                  )}
                                </div>

                                {/* Nome do Cliente */}
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block font-sans">
                                    Nome do Cliente
                                  </span>
                                  <h5 className="font-extrabold text-sm text-gray-900 whitespace-normal break-words leading-snug uppercase">
                                    {item.title || 'Incompleto'}
                                  </h5>
                                </div>

                                {/* Dados do Caso */}
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block font-sans">
                                    Dados do Caso
                                  </span>
                                  <p className="text-xs font-semibold text-gray-700 whitespace-normal break-words leading-snug">
                                    {getDadosCaso(item)}
                                  </p>
                                </div>

                                {/* Se houver pendência financeira */}
                                {isFinanceiroPendente && (
                                  <div className="space-y-1.5 p-3.5 bg-red-50/50 border border-red-150 rounded-xl">
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block font-sans">
                                      Financeiro Pendente
                                    </span>
                                    <p className="text-xs font-semibold text-red-850 whitespace-normal break-words leading-snug">
                                      {getFinanceiroPendenteDesc(item)}
                                    </p>
                                  </div>
                                )}

                                {/* Outros Detalhes (p. ex. se Sem Caso) */}
                                {item.isNoCase && item.details && (
                                  <div className="p-3 bg-amber-50/80 border border-amber-200 text-amber-850 text-xs font-semibold rounded-xl leading-normal">
                                    {item.details}
                                  </div>
                                )}
                              </div>

                              {/* Botão */}
                              <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between gap-2">
                                {/* DELETE ZONE */}
                                <div className="flex items-center gap-2">
                                  {confirmingDeleteId === item.id ? (
                                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                      <button
                                        type="button"
                                        onClick={() => setConfirmingDeleteId(null)}
                                        className="px-3 py-2 border border-gray-205 text-gray-500 hover:text-gray-805 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer bg-white transition-colors"
                                        disabled={deleting}
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePendency(item)}
                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
                                        disabled={deleting}
                                      >
                                        {deleting ? (
                                          <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                          <Trash2 size={12} />
                                        )}
                                        <span>Confirmar Excluir</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingDeleteId(item.id)}
                                      className="border border-red-200 text-red-650 hover:bg-red-50 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                                      id={`delete-btn-${item.id}`}
                                    >
                                      <Trash2 size={12} />
                                      <span>Excluir</span>
                                    </button>
                                  )}
                                </div>

                                {/* CONTINUE ZONE */}
                                <button
                                  type="button"
                                  onClick={item.go}
                                  className="bg-gray-950 hover:bg-black text-white hover:scale-[1.02] py-2 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                  id={`resume-action-${item.id}`}
                                >
                                  <span>{item.actionLabel || 'Continuar'}</span>
                                  <ChevronRight size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>

                <div className="pt-4 border-t border-gray-200 text-[10px] text-gray-400 flex items-center gap-1.5 font-mono justify-end">
                  <span>Módulo BOSS de Coerência Processual</span>
                </div>

              </div>

            </div>
          )}
        </div>

      </div>
    </BossLayout>
  );
}
