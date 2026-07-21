import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { flowSteps } from '../utils/flowSteps';
import { flowRoutes } from '../utils/flowRoutes';
import { Lock, ArrowLeft, Check, X, FolderKanban, ExternalLink } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../../lib/firebase';

interface FluxoSidebarProps {
  caseId?: string;
}

/**
 * Normaliza caminhos de forma segura em conformidade com a FASE 1
 */
export function normalizePathname(pathname: string): string {
  try {
    if (!pathname) return '';
    // 1. remover query string
    let cleaned = pathname.split('?')[0];
    // 2. remover hash
    cleaned = cleaned.split('#')[0];
    // 3. decodeURIComponent seguro
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (e) {
      // Ignorar erros de decodeURIComponent e manter o original
    }
    // 4. substituir barras duplicadas por uma única barra
    cleaned = cleaned.replace(/\/+/g, '/');
    // 5. remover barra final, exceto quando for apenas "/"
    if (cleaned.length > 1 && cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  } catch (error) {
    return pathname || '';
  }
}

/**
 * Resolve a etapa atual de forma canônica em conformidade com a FASE 5
 */
export function resolveCurrentStepIndex({
  pathname,
  activeSteps,
  caseId,
}: {
  pathname: string;
  activeSteps: any[];
  caseId?: string;
}): { index: number; matchType: 'exact' | 'hierarchical' | 'alias' | 'none'; matchedRoute?: string } {
  const normPath = normalizePathname(pathname);
  if (!normPath) return { index: -1, matchType: 'none' };

  let bestIndex = -1;
  let bestSpecificity = -1; // Comprimento normalizado da rota correspondente
  let bestMatchType: 'exact' | 'hierarchical' | 'alias' | 'none' = 'none';
  let bestMatchedRoute = '';

  activeSteps.forEach((step, idx) => {
    const isCadastro = step.id === 'cadastro';
    
    // Obter todas as rotas candidatas para esta etapa
    const candidateRoutes: { url: string; type: 'exact' | 'hierarchical' | 'alias' }[] = [];

    // 1. Rota padrão da etapa
    let stepUrl = '';
    if (isCadastro) {
      stepUrl = caseId ? flowRoutes.editarCadastroCliente(caseId) : flowRoutes.cadastro();
    } else if (caseId) {
      const routeHelper = flowRoutes[step.routeKey];
      if (typeof routeHelper === 'function') {
        stepUrl = (routeHelper as (id: string) => string)(caseId);
      }
    }

    if (stepUrl) {
      candidateRoutes.push({ url: stepUrl, type: 'exact' });
    }

    // 2. Outras rotas legadas ou fallback para cadastro
    if (!caseId && isCadastro) {
      candidateRoutes.push({ url: '/boss-giffoni-clientes/fluxo-producao/cadastro', type: 'exact' });
    }
    if (caseId && isCadastro) {
      candidateRoutes.push({ url: `/boss-giffoni-clientes/fluxo-producao/${caseId}/editar-cadastro-cliente`, type: 'exact' });
    }

    // 3. matchPaths (aliases) definidos no flowSteps
    if (step.matchPaths && Array.isArray(step.matchPaths)) {
      step.matchPaths.forEach((p: string) => {
        let routeWithCase = p;
        if (caseId) {
          routeWithCase = p.replace(/:caseId/g, caseId);
        }
        candidateRoutes.push({ url: routeWithCase, type: 'alias' });
      });
    }

    // Avaliar correspondência para cada rota candidata
    candidateRoutes.forEach((routeObj) => {
      const normRoute = normalizePathname(routeObj.url);
      if (!normRoute) return;

      let isMatch = false;
      let matchType: 'exact' | 'hierarchical' | 'alias' = routeObj.type;

      if (normPath === normRoute) {
        isMatch = true;
        matchType = 'exact';
      } else if (normPath.startsWith(normRoute + '/')) {
        isMatch = true;
        matchType = 'hierarchical';
      }

      if (isMatch) {
        // FASE 4: rota mais específica (com maior comprimento normalizado)
        const specificity = normRoute.length;
        if (specificity > bestSpecificity) {
          bestSpecificity = specificity;
          bestIndex = idx;
          bestMatchType = matchType;
          bestMatchedRoute = normRoute;
        }
      }
    });
  });

  return { index: bestIndex, matchType: bestMatchType, matchedRoute: bestMatchedRoute };
}

export default function FluxoSidebar({ caseId }: FluxoSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNovoCaso, setIsNovoCaso] = useState(false);
  const [clientType, setClientType] = useState<string | null>(null);
  const [showTechLogs, setShowTechLogs] = useState(false);

  // Loaded database objects to measure real semantic integrity
  const [caseObj, setCaseObj] = useState<any>(null);
  const [clientObj, setClientObj] = useState<any>(null);

  useEffect(() => {
    if (location.pathname.includes('/novo-caso')) {
      setIsNovoCaso(true);
      return;
    }
    if (!caseId) return;

    const fetchCaseStatus = async () => {
      try {
        const caseSnap = await getDoc(doc(db, 'cases', caseId));
        if (caseSnap.exists()) {
          const data = caseSnap.data();
          setCaseObj(data);
          if (data.isNovoCaso || data.productionStage === 'novo-caso' || data.caseLifecycle === 'novo-caso') {
            setIsNovoCaso(true);
          }
          if (data.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', data.clientId));
            if (clientSnap.exists()) {
              const cData = clientSnap.data();
              setClientObj(cData);
              setClientType(cData.type || null);
            }
          }
        }
      } catch (err) {
        console.error("Error reading case in sidebar:", err);
        handleFirestoreError(err, OperationType.GET, `cases/${caseId}`);
      }
    };

    fetchCaseStatus();
  }, [caseId, location.pathname]);

  const activeSteps = useMemo(() => {
    let cadastroLabel = 'Cadastro Cliente';
    if (caseId) {
      if (clientType === 'PF') {
        cadastroLabel = 'Cadastro PF';
      } else if (clientType === 'PJ') {
        cadastroLabel = 'Cadastro PJ';
      }
    } else {
      cadastroLabel = 'Cadastro (PF/PJ)';
    }

    return isNovoCaso 
      ? [
          { id: 'cadastro', label: cadastroLabel, routeKey: 'cadastro' as any, requiresCaseId: false, order: 1 },
          { id: 'tipo-producao', label: 'Tipo de Serviço', routeKey: 'tipoServico' as any, requiresCaseId: true, order: 2 },
          { id: 'novo-caso', label: 'Cadastro de Novo Caso', routeKey: 'novoCaso' as any, requiresCaseId: true, order: 3 },
          { id: 'controladoria', label: 'Controladoria', routeKey: 'controladoria' as any, requiresCaseId: true, order: 4 },
          { id: 'relatorio-integridade', label: 'Arquivamento', routeKey: 'relatorioIntegridade' as any, requiresCaseId: true, order: 5 },
        ]
      : flowSteps.map(s => {
          let shortLabel = s.label;
          if (s.id === 'cadastro') shortLabel = cadastroLabel;
          else if (s.id === 'onboarding') shortLabel = 'Onboarding ✈️';
          else if (s.id === 'dados-caso') shortLabel = 'Entrevista (5W2H)';
          else if (s.id === 'tipo-producao') shortLabel = 'Tipo de Serviço';
          else if (s.id === 'solicitacoes-provas') shortLabel = 'Coleta de Provas';
          else if (s.id === 'digitalizacao-upload') shortLabel = 'Digitalização & Upload';
          else if (s.id === 'solicitacoes-informacoes') shortLabel = 'Solicitar ➕ informações';
          else if (s.id === 'solicitacoes-provas-adicionais') shortLabel = 'Solicitar ➕ Provas';
          else if (s.id === 'financeiro') shortLabel = 'Financeiro';
          else if (s.id === 'edrp') shortLabel = 'Estruturação (EDRP)';
          else if (s.id === 'pre-peticionamento-ia') shortLabel = 'Pré-Peticionamento';
          else if (s.id === 'delegacao') shortLabel = 'Delegação';
          else if (s.id === 'revisao') shortLabel = 'Revisão';
          else if (s.id === 'protocolo') shortLabel = 'Protocolo';
          else if (s.id === 'prazos') shortLabel = 'Prazos';
          else if (s.id === 'agendar-audiencias') shortLabel = 'Audiências';
          else if (s.id === 'agendar-pericia') shortLabel = 'Perícias';
          else if (s.id === 'compliance') shortLabel = 'Compliance';
          else if (s.id === 'relatorio-integridade') shortLabel = 'Relatório de Integridade e Auditoria';
          else if (s.id === 'controladoria') shortLabel = 'Controladoria';
          else if (s.id === 'arquivamento') shortLabel = 'Arquivamento';

          return { ...s, label: shortLabel };
        });
  }, [isNovoCaso, caseId, clientType]);

  // Canonical step index resolution in compliance with FASE 5
  const resolution = useMemo(() => {
    return resolveCurrentStepIndex({
      pathname: location.pathname,
      activeSteps,
      caseId,
    });
  }, [activeSteps, caseId, location.pathname]);

  const currentIndex = resolution.index;

  // Measure real, functional step completeness mapping in compliance with Obstáculo 1 & 6
  const getStepStatus = (stepId: string): 'complete' | 'incomplete' | 'uninitiated' => {
    if (stepId === 'cadastro') {
      if (!clientObj) return 'uninitiated';
      const missing = clientObj.missingFields || [];
      const isIncomplete = clientObj.cadastroIncompleto === true || (missing.length > 0);
      return isIncomplete ? 'incomplete' : 'complete';
    }

    if (stepId === 'onboarding') {
      if (!caseObj) return 'uninitiated';
      const onb = caseObj.onboarding || {};
      const aud = onb.auditoria || {};
      if (aud.statusFinal === 'Onboarding completo ✅') {
        return 'complete';
      }
      if (aud.statusFinal === 'Onboarding bloqueado ❌' || aud.statusFinal === 'Onboarding pendente ⚠️') {
        return 'incomplete';
      }
      const hasSomeData = !!(
        onb.telefone?.telefoneClienteAdicionadoCelular ||
        onb.instagram?.clienteAdicionadoInstagram ||
        onb.facebook?.clienteAdicionadoFacebook ||
        onb.tiktok?.clienteAdicionadoTikTok ||
        onb.email?.emailBoasVindasEnviadoCliente
      );
      return hasSomeData ? 'incomplete' : 'uninitiated';
    }

    if (stepId === 'dados-caso') {
      if (!caseObj) return 'uninitiated';
      
      const isNewComplete = !!(
        caseObj.entrevistaPadrao?.trim() &&
        caseObj.checklist5w2h?.oQue === true &&
        caseObj.checklist5w2h?.quem === true &&
        caseObj.checklist5w2h?.onde === true &&
        caseObj.checklist5w2h?.quando === true &&
        caseObj.checklist5w2h?.como === true &&
        caseObj.checklist5w2h?.porque === true &&
        caseObj.checklist5w2h?.comoResolver === true
      );

      const isLegacyComplete = !!(
        caseObj.basesFaticas?.trim() &&
        caseObj.description?.trim() &&
        caseObj.fatosAbordagem?.trim() &&
        caseObj.oQueAconteceu?.trim() &&
        caseObj.quemParticipou?.trim() &&
        caseObj.ondeAconteceu?.trim() &&
        caseObj.quandoAconteceu?.trim() &&
        caseObj.comoAconteceu?.trim() &&
        caseObj.porQueAconteceu?.trim() &&
        caseObj.comoPretendeResolver?.trim()
      );

      const isComplete = isNewComplete || isLegacyComplete;
      if (isComplete) return 'complete';

      const isNewStarted = !!(
        caseObj.entrevistaPadrao?.trim() ||
        caseObj.checklist5w2h?.oQue === true ||
        caseObj.checklist5w2h?.quem === true ||
        caseObj.checklist5w2h?.onde === true ||
        caseObj.checklist5w2h?.quando === true ||
        caseObj.checklist5w2h?.como === true ||
        caseObj.checklist5w2h?.porque === true ||
        caseObj.checklist5w2h?.comoResolver === true
      );

      const isLegacyStarted = !!(
        caseObj.basesFaticas?.trim() ||
        caseObj.description?.trim() ||
        caseObj.fatosAbordagem?.trim() ||
        caseObj.oQueAconteceu?.trim() ||
        caseObj.quemParticipou?.trim() ||
        caseObj.ondeAconteceu?.trim() ||
        caseObj.quandoAconteceu?.trim() ||
        caseObj.comoAconteceu?.trim() ||
        caseObj.porQueAconteceu?.trim() ||
        caseObj.comoPretendeResolver?.trim()
      );

      const started = isNewStarted || isLegacyStarted;
      return started ? 'incomplete' : 'uninitiated';
    }

    if (stepId === 'tipo-producao') {
      if (!caseObj) return 'uninitiated';
      const isComplete = !!(caseObj.registrationTypeKey || caseObj.registrationType);
      return isComplete ? 'complete' : 'uninitiated';
    }

    if (stepId === 'solicitacoes-provas') {
      if (!caseObj) return 'uninitiated';
      const isOk = caseObj.evidenceStatus === 'concluido' || 
                    caseObj.evidenceCompleted || 
                    caseObj.coletaStatus === 'concluida' || 
                    caseObj.statusProvas === 'concluido' ||
                    caseObj.solicitacoesProvasWizardState?.step6_completed === true;
      return isOk ? 'complete' : 'uninitiated';
    }

    if (stepId === 'digitalizacao-upload') {
      if (!caseObj) return 'uninitiated';
      const wiz = caseObj.solicitacoesProvasWizardState || {};
      const isComplete = !!(wiz.digitalizacao_upload_completed || caseObj.digitalizacaoUploadCompleted);
      if (isComplete) return 'complete';
      const isStarted = !!(
        wiz.contratoFiles?.length ||
        wiz.procuracaoFiles?.length ||
        wiz.declaracaoFiles?.length ||
        wiz.documentosMinimosFiles?.length ||
        wiz.documentosNecessidadeFiles?.length
      );
      return isStarted ? 'incomplete' : 'uninitiated';
    }

    if (stepId === 'solicitacoes-informacoes') {
      if (!caseObj) return 'uninitiated';
      if (caseObj.solicitarInfoComp === false) {
        return 'complete';
      }
      return (caseObj.infoStatus === 'concluido' || caseObj.infoCompleted) ? 'complete' : 'uninitiated';
    }

    if (stepId === 'solicitacoes-provas-adicionais') {
      if (!caseObj) return 'uninitiated';
      return (caseObj.solicitacoesProvasAdicionaisCompleted || caseObj.evidenceStatus === 'concluido') ? 'complete' : 'uninitiated';
    }

    if (stepId === 'financeiro') {
      if (!caseObj) return 'uninitiated';
      const isComplete = (caseObj.financeiroStatus === 'faturado' || caseObj.financialCompleted);
      if (isComplete) return 'complete';
      const isStarted = !!(caseObj.financeiroStatus || caseObj.financialCompleted || caseObj.contratoHonorariosGoogleDocsUrl || caseObj.financeiroAuditStarted);
      return isStarted ? 'incomplete' : 'uninitiated';
    }

    if (stepId === 'edrp') {
      if (!caseObj) return 'uninitiated';
      return caseObj.edrp ? 'complete' : 'uninitiated';
    }

    if (stepId === 'pre-peticionamento-ia') {
      if (!caseObj) return 'uninitiated';
      return caseObj.prePeticionamentoText || caseObj.prePeticionamentoStatus === 'complete' ? 'complete' : 'uninitiated';
    }

    if (stepId === 'delegacao') {
      if (!caseObj) return 'uninitiated';
      const isComplete = !!(caseObj.operatorId || caseObj.taskDescription || caseObj.delegationCompleted);
      return isComplete ? 'complete' : 'uninitiated';
    }

    if (stepId === 'revisao') {
      if (!caseObj) return 'uninitiated';
      return (caseObj.revisionCompleted || caseObj.statusInterno === 'Aprovado para protocolo') ? 'complete' : 'uninitiated';
    }

    if (stepId === 'protocolo') {
      if (!caseObj) return 'uninitiated';
      return (caseObj.statusInterno === 'Protocolado' || caseObj.processNumber) ? 'complete' : 'uninitiated';
    }

    if (stepId === 'compliance') {
      if (!caseObj) return 'uninitiated';
      return caseObj.complianceApproved || caseObj.complianceStatus === 'complete' || caseObj.complianceStatus === 'aprovado' ? 'complete' : 'uninitiated';
    }

    if (stepId === 'relatorio-integridade') {
      if (!caseObj) return 'uninitiated';
      return (caseObj.integrityReport || caseObj.integrityStatus) ? 'complete' : 'uninitiated';
    }

    if (stepId === 'controladoria') {
      if (!caseObj) return 'uninitiated';
      return (caseObj.controladoriaCompleted || caseObj.statusInterno === 'Em controladoria') ? 'complete' : 'uninitiated';
    }

    if (stepId === 'arquivamento') {
      if (!caseObj) return 'uninitiated';
      return (caseObj.statusInterno === 'Arquivado' || caseObj.archived) ? 'complete' : 'uninitiated';
    }

    return 'uninitiated';
  };

  // Percentage calculation: math-safe avanço metric
  const progressPercent = useMemo(() => {
    if (currentIndex === -1) return null;
    if (activeSteps.length <= 1) return 0;
    const activeIdx = currentIndex;
    return Math.round((activeIdx / (activeSteps.length - 1)) * 100);
  }, [activeSteps, currentIndex]);

  return (
    <div className="w-full bg-white border border-gray-150 rounded-[2.5rem] p-6 shadow-sm space-y-5">
      
      {/* ROW 1: PROGRESS TRACKER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-900 transition-all flex items-center justify-center cursor-pointer shrink-0"
            title="Voltar ao Início"
          >
            <ArrowLeft size={14} />
          </button>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-extrabold text-gray-900 tracking-tight leading-none">Acompanhamento Produtivo</h4>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[12px] font-bold uppercase tracking-wider">
                {isNovoCaso ? 'Fluxo Simplificado' : 'Fluxo Padrão'}
              </span>
            </div>
            
            <p className="text-[12px] text-gray-400 mt-1 truncate flex items-center gap-1 font-semibold uppercase tracking-wide">
              <FolderKanban size={10} />
              {caseId ? 'Caso Ativo' : 'Rascunho de Cadastro Inicial'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-auto">
          {/* BUTTON EDIDAR PORTAL DO CLIENTE */}
          {(clientObj || caseObj?.clientId) && (
            <button
              type="button"
              onClick={() => {
                const slugStr = clientObj?.slug;
                if (!slugStr) {
                  alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                  return;
                }
                navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-Painel-Geral-do-Cliente`);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-3 border bg-orange-100/80 hover:bg-orange-200/80 text-orange-800 border-orange-200 hover:border-orange-300 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-3xs cursor-pointer h-[44px]"
              title="Editar dados ou portal do cliente"
            >
              <ExternalLink size={12} />
              <span>Editar Portal do Cliente</span>
            </button>
          )}

          {/* PROGRESS METRIC BLOCK */}
          <div className="flex flex-col gap-1 shrink-0 self-start md:self-auto">
            <div className="flex items-center gap-4 bg-gray-50/55 border border-gray-100 px-4 py-2 rounded-2xl shrink-0 h-[44px]">
              <div className="text-left">
                <span className="text-[10px] md:text-[11px] font-black uppercase text-gray-400 block tracking-widest leading-none">
                  Avanço Administrativo
                </span>
                <span className="text-[11px] md:text-xs font-black text-gray-900 block mt-1">
                  {currentIndex !== -1 ? `Etapa ${currentIndex + 1} de ${activeSteps.length}` : 'Etapa não identificada'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-orange-600 font-mono">
                  {progressPercent !== null ? `${progressPercent}%` : '--'}
                </span>
                <div className="w-16 bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-orange-600 h-full rounded-full transition-all duration-300" 
                    style={{ width: `${progressPercent !== null ? progressPercent : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTechLogs(!showTechLogs)}
              className="text-[9px] font-bold text-gray-400 hover:text-gray-600 transition-colors self-start cursor-pointer px-1"
            >
              👁️ {showTechLogs ? 'Ocultar' : 'Ver'} logs técnicos do Avanço Administrativo
            </button>

            {showTechLogs && (
              <div className="text-[10px] font-mono bg-gray-900 text-gray-100 p-3 rounded-xl space-y-1 overflow-x-auto max-w-xs md:max-w-md mt-1 shadow-md border border-gray-800">
                <div><strong>Pathname original:</strong> {location.pathname}</div>
                <div><strong>Pathname decodificado:</strong> {(() => { try { return decodeURIComponent(location.pathname); } catch (e) { return 'Erro'; } })()}</div>
                <div><strong>Pathname normalizado:</strong> {normalizePathname(location.pathname)}</div>
                <div><strong>Rota correspondente:</strong> {resolution.matchedRoute || 'Nenhuma'}</div>
                <div><strong>Tipo de correspondência:</strong> {resolution.matchType}</div>
                <div><strong>Índice encontrado:</strong> {currentIndex}</div>
                <div><strong>Número administrativo:</strong> {currentIndex !== -1 ? currentIndex + 1 : 'Indeterminado'}</div>
                <div><strong>Total de etapas:</strong> {activeSteps.length}</div>
                <div><strong>Percentual:</strong> {progressPercent !== null ? `${progressPercent}%` : 'Indisponível'}</div>
                <div><strong>Falha de correspondência:</strong> {currentIndex === -1 ? 'SIM' : 'NÃO'}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2: HORIZONTAL TIMELINE PROCESS */}
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2.5 pb-1.5 select-none">
          {activeSteps.map((step, idx) => {
            const isCadastro = step.id === 'cadastro';
            let stepUrl = '';
            let isLocked = false;

            if (isCadastro) {
              stepUrl = isNovoCaso ? '' : (caseId ? flowRoutes.editarCadastroCliente(caseId) : flowRoutes.cadastro());
              if (isNovoCaso) {
                isLocked = true;
              }
            } else if (caseId) {
              const routeHelper = flowRoutes[step.routeKey];
              if (typeof routeHelper === 'function') {
                stepUrl = (routeHelper as (id: string) => string)(caseId);
              }
            } else {
              isLocked = true;
            }

            const isCurrent = idx === currentIndex || (!caseId && isCadastro && location.pathname.endsWith('/cadastro'));
            const isClickable = !isLocked && stepUrl !== '';

            // Calculate precise status metrics
            const stepStatusValue = getStepStatus(step.id);

            // Styling based on state: current, complete, incomplete, locked
            let pillClass = '';
            if (isCurrent) {
              if (stepStatusValue === 'incomplete') {
                pillClass = 'bg-red-50 text-red-900 border-red-300 ring-1 ring-red-300 shadow-xs';
              } else {
                pillClass = 'bg-gray-950 text-white border-transparent shadow-xs';
              }
            } else if (stepStatusValue === 'complete') {
              pillClass = 'bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100/50 hover:border-emerald-200';
            } else if (stepStatusValue === 'incomplete') {
              pillClass = 'bg-red-50 border-red-150 text-red-700 hover:bg-red-100/50 hover:border-red-200';
            } else if (isLocked) {
              pillClass = 'border-transparent bg-gray-50 text-gray-300 pointer-events-none';
            } else {
              pillClass = 'border-gray-150 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900';
            }

            return (
              <button
                key={step.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isClickable && stepUrl) {
                    navigate(stepUrl);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-full text-[12px] font-bold transition-all shrink-0 cursor-pointer outline-none ${pillClass}`}
                id={`timeline-step-${step.id}`}
              >
                {/* Visual Status Indicator in compliance with Obstáculo 1 & 6 */}
                {(() => {
                  if (stepStatusValue === 'complete') {
                    return <Check size={11} className="text-emerald-600 shrink-0 stroke-[3px]" />;
                  }
                  if (stepStatusValue === 'incomplete') {
                    return (
                      <div className="relative group/tooltip flex items-center justify-center">
                        <X size={11} className="text-red-500 shrink-0 stroke-[3px]" />
                        <span className="absolute bottom-full mb-1.5 hidden group-hover/tooltip:block bg-red-800 text-white text-[12px] font-black uppercase px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-40 font-mono tracking-wider">
                          {step.id === 'dados-caso' ? 'Entrevista incompleta' : 'Cadastro incompleto'}
                        </span>
                      </div>
                    );
                  }
                  if (isCurrent) {
                    return <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shrink-0" />;
                  }
                  if (isLocked) {
                    return <Lock size={9} className="text-gray-300 shrink-0" />;
                  }
                  return null;
                })()}

                <span className="font-mono text-[12px] opacity-60">
                  {String(step.order).padStart(2, '0')}
                </span>
                
                <span className="tracking-tight max-w-[155px] truncate text-left">
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
