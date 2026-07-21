import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Check,
  Save,
  Info,
  Sparkles,
  HeartPulse,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  User,
  Activity,
  FileSearch,
  CheckSquare,
  Bookmark,
  Loader2
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';
import { buildIntegrityReport, IntegrityResult, IntegrityItem } from './utils/integrityReport';
import {
  getClientInternalPath,
  getClientExternalPortalBase,
  getClientPortalInstruction
} from './utils/clientPortalLinks';

export default function RelatorioIntegridadeFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [runningReport, setRunningReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Database objects
  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [portal, setPortal] = useState<any>(null);
  const [userAccount, setUserAccount] = useState<any>(null);
  const [inviteObj, setInviteObj] = useState<any>(null);
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [connectors, setConnectors] = useState<any>(null);
  const [portalSettings, setPortalSettings] = useState<any>(null);

  // Visual report outcome
  const [reportResult, setReportResult] = useState<IntegrityResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Copy feedbacks
  const [copySlugSuccess, setCopySlugSuccess] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);
  const [copyInstructionSuccess, setCopyInstructionSuccess] = useState(false);
  const [copyInternalPathSuccess, setCopyInternalPathSuccess] = useState(false);

  // Fetch all related entities sequentially/parallelly to perform a flawless audit
  const loadEntities = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Case
      const caseRef = doc(db, 'cases', caseId);
      const caseSnap = await getDoc(caseRef);
      if (!caseSnap.exists()) {
        setError(`Caso de ID [${caseId}] não-existente.`);
        setLoading(false);
        return;
      }
      const cData = caseSnap.data();
      setCaseObj({ id: caseSnap.id, ...cData });

      // 2. Client (if available)
      let clientData = null;
      if (cData.clientId) {
        const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
        if (clientSnap.exists()) {
          clientData = { id: clientSnap.id, ...clientSnap.data() };
          setClient(clientData);
        }
      }

      // 3. Portal (if client has slug)
      const slugToCheck = cData.clientSlug || clientData?.slug;
      if (slugToCheck) {
        const portalSnap = await getDoc(doc(db, 'clientPortals', slugToCheck));
        if (portalSnap.exists()) {
          setPortal({ id: portalSnap.id, ...portalSnap.data() });
        }
      }

      // 4. User filtered by clientId (client role)
      if (cData.clientId) {
        const usersSnap = await getDocs(
          query(collection(db, 'users'), where('clientId', '==', cData.clientId))
        );
        if (!usersSnap.empty) {
          const userDoc = usersSnap.docs[0];
          setUserAccount({ id: userDoc.id, ...userDoc.data() });
        }

        // 5. User Invite
        const inviteSnap = await getDocs(
          query(collection(db, 'users_invites'), where('clientId', '==', cData.clientId))
        );
        if (!inviteSnap.empty) {
          const inviteDoc = inviteSnap.docs[0];
          setInviteObj({ id: inviteDoc.id, ...inviteDoc.data() });
        }
      }

      // 6. Case Information Requests
      const infoSnap = await getDocs(
        query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseId))
      );
      const infoList = infoSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInfoRequests(infoList);

      // 7. Case Evidence Requests
      const evidenceSnap = await getDocs(
        query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId))
      );
      const evidenceList = evidenceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvidenceRequests(evidenceList);

      // 8. Case Financials
      let finList: any[] = [];
      if (cData.clientId) {
        // Typically either filtered by caseId or client
        const finSnap = await getDocs(
          query(collection(db, 'caseFinancials'), where('caseId', '==', caseId))
        );
        finList = finSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (finList.length === 0) {
          const finClientSnap = await getDocs(
            query(collection(db, 'caseFinancials'), where('clientId', '==', cData.clientId))
          );
          finList = finClientSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        setFinancials(finList);
      }

      // 9. Settings/Connectors
      try {
        const connectorsSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (connectorsSnap.exists()) {
          setConnectors(connectorsSnap.data());
        }
      } catch (conErr) {
        console.warn('Conectores não configurados ou erro de leitura: ', conErr);
      }

      // 9.5 Portal Settings
      try {
        const portalSettingsSnap = await getDoc(doc(db, 'settings', 'portal'));
        if (portalSettingsSnap.exists()) {
          setPortalSettings(portalSettingsSnap.data());
        }
      } catch (portErr) {
        console.warn('Configurações do Portal não localizadas: ', portErr);
      }

    } catch (err: any) {
      console.error(err);
      setError(`Erro ao auditar prontuário: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, [caseId]);

  // Handle immediate audit generation
  const handleGenerateReport = () => {
    if (!caseObj) return;
    setRunningReport(true);
    setSuccess(null);
    try {
      const generated = buildIntegrityReport(
        caseObj,
        client,
        portal,
        userAccount,
        inviteObj,
        infoRequests,
        evidenceRequests,
        financials,
        connectors
      );
      setReportResult(generated);
      setSuccess('Relatório de integridade recalculado localmente com sucesso!');
    } catch (err: any) {
      setError(`Falha ao compilar métricas: ${err.message}`);
    } finally {
      setRunningReport(false);
    }
  };

  // Automatically trigger report on first success load
  useEffect(() => {
    if (caseObj && !reportResult) {
      handleGenerateReport();
    }
  }, [caseObj]);

  const getEDRPValidationWarnings = () => {
    const list: { type: 'warning' | 'info' | 'error'; msg: string }[] = [];
    const edrp = caseObj?.edrp;
    if (!edrp) {
      list.push({
        type: 'warning',
        msg: 'A estruturação fática e jurídica do EDRP não foi localizada neste caso.'
      });
      return list;
    }

    // 1. Estruturação vazia
    const struct = edrp.structuring || {};
    const isStructuringEmpty = !(
      struct.competence?.trim() ||
      struct.parties?.trim() ||
      struct.relevantFacts?.trim() ||
      struct.legalGrounds?.trim() ||
      struct.claims?.trim() ||
      struct.evidenceSummary?.trim() ||
      struct.risks?.trim() ||
      struct.strategy?.trim()
    );
    if (isStructuringEmpty) {
      list.push({
        type: 'warning',
        msg: 'A estruturação fática e jurídica do EDRP está totalmente vazia.'
      });
    }

    // 2. Delegação sem responsável
    if (!edrp.delegation?.responsiblePerson?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum profissional responsável principal foi designado para a delegação.'
      });
    }

    // 3. Revisão sem revisor
    if (!edrp.reviewPreparation?.reviewResponsible?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum revisor interno foi definido na etapa de Revisão.'
      });
    }

    // 4. Protocolo sem responsável
    if (!edrp.protocolPreparation?.protocolResponsible?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum responsável foi designado para a preparação de protocolo.'
      });
    }

    // 5. Protocolo sem sistema
    if (!edrp.protocolPreparation?.protocolSystem?.trim()) {
      list.push({
        type: 'warning',
        msg: 'Nenhum sistema de protocolo eletrônico (ex: PJe, Projudi, e-SAJ) foi preenchido.'
      });
    }

    // 6. Revisão não aprovada
    const isApproved = edrp.reviewPreparation?.approvedForProtocol || edrp.reviewPreparation?.reviewStatus === 'aprovado';
    if (!isApproved) {
      list.push({
        type: 'warning',
        msg: 'A análise de revisão interna do EDRP não está aprovada para a liberação de protocolo.'
      });
    }

    // 7. Protocolo pronto sem revisão aprovada
    if (edrp.protocolPreparation?.protocolStatus === 'pronto_para_protocolar' && !isApproved) {
      list.push({
        type: 'error',
        msg: 'Inconsistência Grave: O protocolo está marcado como "Pronto para protocolar", mas a revisão da estruturação ainda não foi aprovada formalmente.'
      });
    }

    // 8. Service recommendations check
    const serviceKey = caseObj?.registrationTypeKey;
    const isOngoingJudicial = serviceKey === 'processo_judicial_em_andamento' || serviceKey === 'processo_judicial_ajuizado';
    if (isOngoingJudicial && !edrp.protocolPreparation?.processNumber?.trim()) {
      list.push({
        type: 'info',
        msg: 'CNJ Recomendado: O tipo de serviço selecionado exige a identificação do número de processo judicial anterior.'
      });
    }

    return list;
  };

  // Master finish action
  const handleFinalizeProduction = async () => {
    if (!caseId || !reportResult) {
      setError('Por favor, gere ou carregue o relatório antes de concluir.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();

      // Integrity calculations
      let internalStatus = 'Com pendência';
      let prodStatus = 'com_pendencias';
      let integrityState = 'critico';

      if (reportResult.result === 'Pronto para deploy') {
        internalStatus = 'Consolidado';
        prodStatus = 'concluido';
        integrityState = 'completo';
      } else if (reportResult.result === 'Pronto com ressalvas') {
        internalStatus = 'Consolidado com ressalvas';
        prodStatus = 'concluido_com_ressalvas';
        integrityState = 'com_pendencias';
      }

      const payload: any = {
        integrityReport: {
          generatedAt: reportResult.generatedAt,
          result: reportResult.result,
          items: reportResult.items,
          okCount: reportResult.okCount,
          attentionCount: reportResult.attentionCount,
          pendingCount: reportResult.pendingCount,
          criticalCount: reportResult.criticalCount
        },
        integrityStatus: integrityState,
        productionStatus: prodStatus,
        statusInterno: internalStatus,
        updatedAt: now
      };

      await updateDoc(doc(db, 'cases', caseId), payload);

      // PART 7 — Update clientPortals alignment
      if (client && client.slug) {
        const { setDoc } = await import('firebase/firestore');
        const portalRef = doc(db, 'clientPortals', client.slug);
        const portalLink = portalSettings?.link || 'https://aistudio.google.com/apps/93c62126-a17f-4c18-8bc7-d327df1ca6b5?showPreview=true&showAssistant=true';
        const portalExternalMode = portalSettings?.portalExternalMode || 'ai_studio_preview';
        
        await setDoc(portalRef, {
          clientId: client.id,
          slug: client.slug,
          active: client.active ?? true,
          portalExternalBaseLink: portalLink,
          portalInternalPath: `/portal-cliente-giffoni/${client.slug}/login`,
          portalExternalMode: portalExternalMode,
          updatedAt: new Date()
        }, { merge: true });
      }

      setCaseObj((prev: any) => ({
        ...prev,
        ...payload
      }));

      setSuccess(`Fluxo de Produção Concluído com Sucesso! Classificação final: "${reportResult.result}". Prontuário sincronizado.`);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao registrar encerramento de prontuário: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Standard safe copy action
  const copyToClipboard = async (text: string, type: 'slug' | 'link' | 'instruction' | 'internalPath') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'slug') {
        setCopySlugSuccess(true);
        setTimeout(() => setCopySlugSuccess(false), 2000);
      } else if (type === 'link') {
        setCopyLinkSuccess(true);
        setTimeout(() => setCopyLinkSuccess(false), 2000);
      } else if (type === 'instruction') {
        setCopyInstructionSuccess(true);
        setTimeout(() => setCopyInstructionSuccess(false), 2000);
      } else if (type === 'internalPath') {
        setCopyInternalPathSuccess(true);
        setTimeout(() => setCopyInternalPathSuccess(false), 2000);
      }
    } catch (err) {
      console.warn('Fallback copy');
      alert(`Conteúdo copiado de forma segura: ${text}`);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Integridade & Fechamento" caseId={caseId}>
        <div className="p-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono tracking-wide uppercase">
            Auditando infraestrutura do prontuário...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const clientNameResolved = client
    ? (client.type === 'PF'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome')
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Sem Razão Social'))
    : 'Inquilino desconhecido';

  const clientSlugResolved = client?.slug || 'sem-slug';
  const loginUrl = `${window.location.origin}/portal-cliente-giffoni/${clientSlugResolved}/login`;

  // External Portal Checker Metrics
  const hasClientSlug = !!client?.slug;
  const hasPortalDoc = !!portal;
  const hasUserAccount = !!userAccount;
  const hasPortalLink = !!portalSettings?.link;
  const hasPortalExternalMode = !!portalSettings?.portalExternalMode;
  const plannedInternalRoute = getClientInternalPath(clientSlugResolved);

  // Filter items in UI
  const filteredChecklist = reportResult?.items.filter((item) => {
    if (filterStatus === 'todos') return true;
    return item.status.toLowerCase() === filterStatus.toLowerCase();
  }) || [];

  return (
    <FluxoStepLayout
      stepName="Relatório de Integridade"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em auditoria'}
    >
      <div className="space-y-8 font-sans">
        
        {/* Errors & Toasts */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-3xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-900 text-xs flex gap-3 items-start md:items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5 md:mt-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* INTEGRITY GENERAL SUM */}
        {reportResult && (
          <div className="bg-slate-900 text-white rounded-[2rem] p-8 space-y-6 shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10 relative z-10">
              <div className="space-y-1">
                <span className="text-[10px] font-sans font-extrabold uppercase tracking-widest text-indigo-300">Auditoria Tecnológica</span>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <HeartPulse className="text-pink-400 animate-pulse" size={20} />
                  Selo de Consistência Interna
                </h3>
                <p className="text-xs text-slate-400">
                  Responsável: <strong className="text-white">{clientNameResolved}</strong> • Namespace: {clientSlugResolved}
                </p>
              </div>

              <div className="flex flex-col gap-1.5 md:items-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Resultado Consolidado</span>
                <span className={`text-[13px] font-extrabold font-sans uppercase tracking-wider px-5 py-2 rounded-2xl flex items-center gap-1.5 ${
                  reportResult.result === 'Pronto para deploy' ? 'bg-emerald-600 shadow-sm text-white' :
                  reportResult.result === 'Pronto com ressalvas' ? 'bg-amber-600 shadow-sm text-white' :
                  'bg-red-600 shadow-sm text-white'
                }`}>
                  {reportResult.result === 'Pronto para deploy' && <CheckCircle2 size={15} />}
                  {reportResult.result === 'Pronto com ressalvas' && <AlertTriangle size={15} />}
                  {reportResult.result === 'Não recomendado para deploy' && <XCircle size={15} />}
                  {reportResult.result}
                </span>
              </div>
            </div>

            {/* METRICS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">OK</span>
                <div className="text-2xl font-black text-white font-mono">{reportResult.okCount}</div>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">Atenção</span>
                <div className="text-2xl font-black text-white font-mono">{reportResult.attentionCount}</div>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wider">Pendente</span>
                <div className="text-2xl font-black text-white font-mono">{reportResult.pendingCount}</div>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-red-500 tracking-wider font-mono">Críticos</span>
                <div className="text-2xl font-black text-white font-mono">{reportResult.criticalCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* ACTION & INTEGRITY MANAGEMENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PORTAL EXTERNO DO CLIENTE SECTION */}
          <div className="lg:col-span-2 bg-white border border-gray-150 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ExternalLink size={20} />
              </div>
              <div>
                <h3 className="text-md font-bold text-gray-900">Portal Externo do Cliente</h3>
                <p className="text-xs text-gray-500">Validação da mirroring de dados para o Portal de Clientes externo.</p>
              </div>
            </div>

            {/* Verification Checklist Badges */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">Status de Conectividade do Espelho</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  {hasClientSlug ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span>Slug do Inquilino Existente: <strong className="font-mono text-indigo-600">{clientSlugResolved}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {hasPortalDoc ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span>Documento clientPortals/{clientSlugResolved}: {hasPortalDoc ? 'Sim' : 'Criar cadastro'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasUserAccount ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span>Id de Login em users/: {hasUserAccount ? 'Sim' : 'Criar usuário'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasPortalLink ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span>Base url externa configurada: {hasPortalLink ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Rota interna planejada: <strong className="font-mono text-gray-500">{plannedInternalRoute}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {hasPortalExternalMode ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span>Modo Configurado ({portalSettings?.portalExternalMode || 'padrão'}): {hasPortalExternalMode ? 'Sim' : 'Simulado'}</span>
                </div>
              </div>
            </div>

            {/* Display Values */}
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Link Base Externo</span>
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono text-gray-600 truncate">
                  {getClientExternalPortalBase(portalSettings)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Rota Interna de Validação</span>
                  <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono text-indigo-650 truncate">
                    {plannedInternalRoute}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Modo de Distribuição</span>
                  <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 capitalize">
                    {portalSettings?.portalExternalMode === 'dominio_publicado' ? 'Domínio Publicado (Produção)' : 'Modo Preview (Google AI Studio)'}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Instrução de Integração</span>
                <div className="p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-xs text-indigo-900 leading-relaxed font-semibold">
                  {getClientPortalInstruction(clientSlugResolved, portalSettings)}
                </div>
              </div>
            </div>

            {/* Copy Operations Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => copyToClipboard(clientSlugResolved, 'slug')}
                className="py-2.5 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 inline-flex items-center justify-between cursor-pointer"
              >
                <span>Copiar Slug</span>
                <span className="text-[10px] text-indigo-600 font-semibold">{copySlugSuccess ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(plannedInternalRoute, 'internalPath')}
                className="py-2.5 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 inline-flex items-center justify-between cursor-pointer"
              >
                <span>Copiar Rota Interna</span>
                <span className="text-[10px] text-indigo-600 font-semibold">{copyInternalPathSuccess ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const payloadStr = `Portal externo: ${getClientExternalPortalBase(portalSettings)}\nRota interna: ${plannedInternalRoute}\nCliente: ${clientNameResolved}\nSlug: ${clientSlugResolved}\nCaseId: ${caseId}`;
                  copyToClipboard(payloadStr, 'instruction');
                }}
                className="py-2.5 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 inline-flex items-center justify-between cursor-pointer"
              >
                <span>Copiar Instrução</span>
                <span className="text-[10px] text-indigo-600 font-semibold">{copyInstructionSuccess ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            {/* Operations Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 border-t border-gray-100 pt-5">
              <a
                href={getClientExternalPortalBase(portalSettings)}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-center"
              >
                <ExternalLink size={14} />
                <span>Abrir Portal Externo</span>
              </a>

              <button
                type="button"
                onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${client?.clientId || client?.id}`)}
                className="py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-150 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Activity size={14} />
                <span>Ver Espelho</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/boss-giffoni-clientes/clientes/${client?.id || client?.clientId}`)}
                className="py-3 px-4 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <User size={14} />
                <span>Cadastro Cliente</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/boss-giffoni-clientes/casos/${caseId}`)}
                className="py-3 px-4 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <FolderOpen size={14} />
                <span>Abrir Caso</span>
              </button>
            </div>
          </div>

          {/* SINCRONIZADOR FÁTICO */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-md font-bold text-gray-900">Sincronizador Fático</h3>
                  <p className="text-xs text-gray-500">Gestão de encerramentos e fechamento definitivo do prontuário.</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ao rodar a integridade, o sistema realiza uma auditoria em tempo real sobre os documentos, relatórios, cadastros e obrigações financeiras. Se tudo estiver correto, você pode fechar o fluxo de produção.
              </p>
            </div>

            <div className="space-y-2.5 pt-6">
              <button
                type="button"
                disabled={runningReport}
                onClick={handleGenerateReport}
                className="w-full py-3 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs px-4 rounded-xl cursor-pointer shadow-xs"
              >
                <RefreshCw size={12} className={runningReport ? 'animate-spin' : ''} />
                Gerar Relatório de Integridade
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleFinalizeProduction}
                className="w-full py-3 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 rounded-xl cursor-pointer shadow-xs"
              >
                <Check size={14} />
                Finalizar Produção
              </button>
            </div>
          </div>
        </div>


        {/* DIAGNÓSTICO PREVENTIVO DE INTEGRIDADE DO EDRP */}
        {(() => {
          const edrpValidationAlerts = getEDRPValidationWarnings();
          return (
            <div className="border border-gray-150 rounded-3xl p-6 space-y-4 bg-white shadow-xs">
              <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Activity size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Diagnóstico Preventivo de Integridade do EDRP</h3>
                  <p className="text-[10.5px] text-gray-400">Alertas fáticos e procedimentais do caso que alimentam o Relatório Final de Integridade do BOSS.</p>
                </div>
              </div>

              {edrpValidationAlerts.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center font-semibold leading-relaxed">
                  <Check className="text-emerald-500 shrink-0" size={16} />
                  <span>Excelente! Nenhum aviso ou inconsistência detectados para este rascunho de EDRP.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {edrpValidationAlerts.map((alert, idx) => {
                    const isError = alert.type === 'error';
                    const isWarning = alert.type === 'warning';
                    
                    let boxClass = 'bg-blue-50 border-blue-100 text-blue-900';
                    let Icon = Info;
                    let textStyle = 'text-blue-500';

                    if (isError) {
                      boxClass = 'bg-red-50 border-red-155 text-red-900';
                      Icon = AlertCircle;
                      textStyle = 'text-red-500';
                    } else if (isWarning) {
                      boxClass = 'bg-amber-50 border-amber-155 text-amber-900';
                      Icon = AlertTriangle;
                      textStyle = 'text-amber-500';
                    }

                    return (
                      <div key={idx} className={`p-3.5 border rounded-xl flex gap-x-3 items-start text-xs font-medium leading-relaxed ${boxClass}`}>
                        <Icon size={15} className={`${textStyle} shrink-0 mt-0.5`} />
                        <div>{alert.msg}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* AUDIT CHECKLIST PANEL */}
        <div className="border border-gray-150 rounded-3xl bg-white overflow-hidden shadow-xs">
          
          {/* Header of checklist */}
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileSearch size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Lista de Conformidade Legal</h3>
                <p className="text-[10.5px] text-gray-500 mt-0.5">Visão pormenorizada de todos os parâmetros exigidos pelo BOSS.</p>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Todos', value: 'todos' },
                { label: 'OK', value: 'ok' },
                { label: 'Atenção', value: 'atencao' },
                { label: 'Pendente', value: 'pendente' },
                { label: 'Erro Crítico', value: 'erro crítico' }
              ].map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => setFilterStatus(btn.value)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[10.5px] tracking-wide transition-all cursor-pointer ${
                    filterStatus === btn.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist content */}
          <div className="divide-y divide-gray-100">
            {filteredChecklist.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 font-medium">
                Nenhum parâmetro localizado para o filtro selecionado.
              </div>
            ) : (
              filteredChecklist.map((item, idx) => {
                const isCrit = item.status === 'Erro Crítico';
                const isAten = item.status === 'Atenção';
                const isPend = item.status === 'Pendente';

                return (
                  <div key={idx} className="p-5 hover:bg-gray-50/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {item.section}
                        </span>
                        <h4 className="text-xs font-bold text-gray-900">{item.label}</h4>
                      </div>
                      <p className="text-[11px] text-gray-550 leading-relaxed text-gray-500">{item.details}</p>
                    </div>

                    <div className="shrink-0 flex items-center">
                      <span className={`text-[10px] font-extrabold px-3 py-1 rounded-xl tracking-wide uppercase ${
                        isCrit ? 'bg-red-50 text-red-650 text-red-600' :
                        isAten ? 'bg-amber-50 text-amber-650 text-amber-600' :
                        isPend ? 'bg-purple-50 text-purple-650 text-purple-600' :
                        'bg-emerald-50 text-emerald-650 text-emerald-600'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BOTTOM NAV BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.agendarPericia(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Perícias
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={handleFinalizeProduction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-indigo-600 border border-indigo-200 hover:border-indigo-300 bg-indigo-50 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer"
            >
              <Save size={13} />
              {saving ? 'Salvando...' : 'Salvar Relatório'}
            </button>

            <button
              type="button"
              onClick={() => navigate(flowRoutes.arquivamento(caseId!))}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Salvar e Avançar</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
