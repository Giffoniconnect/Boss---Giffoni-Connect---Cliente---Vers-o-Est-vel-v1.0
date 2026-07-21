import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  Check,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
  Users,
  Loader2,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Folders,
  FileText,
  Brain,
  ExternalLink,
  Share2,
  Send,
  History,
  RotateCw,
  CheckCircle,
  FileSearch,
  BookOpen,
  Briefcase
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';
import { runCaseComplianceAudit, ComplianceAuditResult, AuditItem } from './utils/complianceAuditor';

interface ComplianceForm {
  conflitoInteresseVerificado: 'pendente' | 'sim' | 'nao';
  documentacaoCompleta: boolean;
  origemRecursosValida: 'pendente' | 'sim' | 'nao';
  parecerCompliance: string;
  responsavelCompliance: string;
  complianceApproved: boolean;
  updatedAt: string;
}

interface ActionLog {
  timestamp: string;
  user: string;
  action: string;
  details: string;
  status: 'sucesso' | 'falha';
}

export default function ComplianceFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  // Selected Accordion / Tab for detailed audit sections
  const [activeTab, setActiveTab] = useState<'geral' | 'faturas' | 'bloqueios' | 'mensagens' | 'logs'>('geral');
  const [activeSectionTab, setActiveSectionTab] = useState<string>('Cadastro');

  // Compliance fields
  const [form, setForm] = useState<ComplianceForm>({
    conflitoInteresseVerificado: 'pendente',
    documentacaoCompleta: false,
    origemRecursosValida: 'pendente',
    parecerCompliance: '',
    responsavelCompliance: '',
    complianceApproved: false,
    updatedAt: new Date().toISOString()
  });

  // Load baseline case and dependencies
  const loadAllData = async (showRecalcSpinner = false) => {
    if (!caseId) return;
    try {
      if (showRecalcSpinner) {
        setRecalculating(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // 1. Fetch Case Document
      const caseRef = doc(db, 'cases', caseId);
      const caseSnap = await getDoc(caseRef);

      if (!caseSnap.exists()) {
        setError(`O caso de ID [${caseId}] não existe no banco de dados.`);
        setLoading(false);
        setRecalculating(false);
        return;
      }

      const caseData = caseSnap.data();
      setCaseObj({ id: caseSnap.id, ...caseData });

      // Build recent logs list from DB if present
      if (caseData.complianceLogs) {
        setActionLogs(caseData.complianceLogs);
      } else {
        setActionLogs([]);
      }

      // Load form fields if present
      if (caseData.complianceData) {
        setForm({
          conflitoInteresseVerificado: caseData.complianceData.conflitoInteresseVerificado || 'pendente',
          documentacaoCompleta: caseData.complianceData.documentacaoCompleta || false,
          origemRecursosValida: caseData.complianceData.origemRecursosValida || 'pendente',
          parecerCompliance: caseData.complianceData.parecerCompliance || '',
          responsavelCompliance: caseData.complianceData.responsavelCompliance || '',
          complianceApproved: caseData.complianceApproved || caseData.complianceData.complianceApproved || false,
          updatedAt: caseData.complianceData.updatedAt || new Date().toISOString()
        });
      } else {
        setForm(prev => ({
          ...prev,
          complianceApproved: caseData.complianceApproved || false
        }));
      }

      // 2. Fetch Client Document
      if (caseData.clientId) {
        const clientSnap = await getDoc(doc(db, 'clients', caseData.clientId));
        if (clientSnap.exists()) {
          setClient({ id: clientSnap.id, ...clientSnap.data() });
        }
      }

      // 3. Fetch subcollections / associated queries
      const qInfo = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseId));
      const infoSnap = await getDocs(qInfo);
      setInfoRequests(infoSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const qEvid = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId));
      const evidSnap = await getDocs(qEvid);
      setEvidenceRequests(evidSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const qFin = query(collection(db, 'caseFinancials'), where('caseId', '==', caseId));
      const finSnap = await getDocs(qFin);
      setFinancials(finSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (showRecalcSpinner) {
        await logAction('Recalcular Compliance', 'Auditoria atualizada de forma bem-sucedida a partir de dados em tempo real.', 'sucesso');
        setSuccess('Varredura e auditoria atualizadas com sucesso em tempo real!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(`Erro ao estruturar base de conformidade: ${err.message || err}`);
    } finally {
      setLoading(false);
      setRecalculating(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [caseId]);

  // Log action with persistence to Firestore cases collection
  const logAction = async (action: string, details: string, status: 'sucesso' | 'falha') => {
    if (!caseId) return;
    const currentUser = form.responsavelCompliance || 'Auditor Central BOSS';
    const newLog: ActionLog = {
      timestamp: new Date().toISOString(),
      user: currentUser,
      action,
      details,
      status
    };

    const updatedLogs = [newLog, ...actionLogs].slice(0, 50); // Keep last 50 logs safely
    setActionLogs(updatedLogs);

    try {
      await updateDoc(doc(db, 'cases', caseId), {
        complianceLogs: updatedLogs
      });
    } catch (e) {
      console.error("Failed to persist log array", e);
    }
  };

  // Run shared compliance algorithm
  const auditResult: ComplianceAuditResult = runCaseComplianceAudit(
    caseObj,
    client,
    infoRequests,
    evidenceRequests,
    financials
  );

  // Filter items in active segment tab
  const segmentItems = auditResult.items.filter(item => item.section === activeSectionTab);

  // Save core compliance opinion and form fields
  const handleSaveCompliance = async (isApprovingToggle = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();
      const updatedForm = {
        ...form,
        updatedAt: now
      };

      const caseRef = doc(db, 'cases', caseId);
      await updateDoc(caseRef, {
        complianceData: updatedForm,
        complianceApproved: form.complianceApproved,
        complianceStatus: form.complianceApproved ? 'aprovado' : 'pendente',
        updatedAt: now
      });

      const auditAction = isApprovingToggle 
        ? `Alteração do Selo de Compliance: ${form.complianceApproved ? 'APROVADO' : 'PENDENTE'}`
        : 'Confirmação de Parecer Oficial';

      await logAction(
        auditAction,
        `Salvo parecer. Responsável: ${form.responsavelCompliance || 'Arthur Giffoni'}. Parecer: "${form.parecerCompliance || 'Nenhuma observação informada.'}"`,
        'sucesso'
      );

      setSuccess('Selo de compliance e auditoria interna salvos com sucesso no prontuário!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de compliance: ${err.message || err}`);
      await logAction('Gravação de Parecer', `Falha ao persistir: ${err.message || err}`, 'falha');
    } finally {
      setSaving(false);
    }
  };

  // Quick Action: Copy notification messages tailored to specific players
  const handleCopyAlertMessage = async (role: 'Cliente' | 'Secretaria' | 'Advogado' | 'Controladoria') => {
    try {
      const locks = auditResult.criticalLocks.filter(l => l.responsible === role);
      const normalPendencies = auditResult.pendingItems.filter(l => l.responsible === role && !l.isCriticalLock);
      
      let msg = `*ALERTA DE COMPLIANCE — BOSS GIFFONI* 🛡️\n\n`;
      msg += `Olá, identificamos pendências fáticas operacionais sob sua responsabilidade para o caso: *${caseObj?.title || 'Caso Coletado'}*\n\n`;
      
      if (locks.length > 0) {
        msg += `⚠️ *TRAVAS CRÍTICAS (Bloqueiam Distribuição Processual):*\n`;
        locks.forEach(l => {
          msg += `• *${l.label}*: ${l.details}\n  Impacto: _${l.impact || 'Bloqueia o ajuizamento seguro.'}_\n  Como Resolver: _${l.action || 'Fazer preenchimento fático.'}_\n\n`;
        });
      }

      if (normalPendencies.length > 0) {
        msg += `📝 *PENDÊNCIAS SECUNDÁRIAS (Ajustar em breve):*\n`;
        normalPendencies.forEach(p => {
          msg += `• *${p.label}*: ${p.details}\n`;
        });
      }

      msg += `Por favor, atue na resolução destas pendências para destravarmos o percentual de integridade (Atualmente em *${auditResult.overallPercent}%*).\n\n`;
      msg += `Acesse o Portal: https://ai.studio/build/boss-giffoni-clientes/fluxo-producao/${caseId}/compliance\n`;
      msg += `_Mensagem automática enviada pelo BOSS Central de Risco em ${new Date().toLocaleDateString('pt-BR')}._`;

      await navigator.clipboard.writeText(msg);
      
      await logAction(
        'Gerar Mensagem de Cobrança',
        `Texto de cobrança gerado com sucesso e copiado para a área de transferência. Destinatário: ${role}.`,
        'sucesso'
      );

      setSuccess(`Mensagem técnica de cobrança para [${role}] copiada para a área de transferência!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setSuccess(null);
      setError(`Falha ao copiar mensagem técnica: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Compliance & Auditoria" caseId={caseId}>
        <div className="p-16 text-center text-gray-500 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <span className="text-xs font-black font-mono tracking-widest uppercase text-gray-400">
            Conduzindo varredura de compliance e auditoria interna transversal...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const clientName = client
    ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || client.name || 'Cliente Sem Qualificação')
    : 'Cliente não vinculado';

  const clientTypeDisplay = client?.type === 'PF' ? 'Pessoa Física (PF)' : client?.type === 'PJ' ? 'Pessoa Jurídica (PJ)' : 'Tipo Indefinido';

  return (
    <FluxoStepLayout
      stepName="Compliance e Auditoria Interna"
      caseId={caseId}
      statusText={form.complianceApproved ? 'APROVADO PELO COMPLIANCE' : 'ANÁLISE DE SEGURANÇA REQUERIDA'}
    >
      <div className="space-y-8 font-sans max-w-7xl mx-auto pb-12 animate-fade-in">
        
        {/* NOTIFICATION TOASTS */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-950 text-xs flex gap-3 items-center shadow-xs">
            <ShieldAlert size={18} className="text-red-600 shrink-0" />
            <span className="font-extrabold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center shadow-xs">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span className="font-extrabold leading-relaxed">{success}</span>
          </div>
        )}

        {/* -------------------------------------------------------------
            SEÇÃO 1 — EXECUTIVE HEADER & METRICS
           ------------------------------------------------------------- */}
        <div className="bg-white border rounded-3xl p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -z-10" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Info Grid */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider font-mono">
                  Etapa 14 — Compliance Geral
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-1 rounded-lg font-mono">
                  Caso: #{caseId?.slice(0, 8)}
                </span>
                <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-lg ${
                  caseObj?.priority === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-50 text-slate-600'
                }`}>
                  Prioridade: {caseObj?.priority === 'high' ? 'Alta 🚨' : 'Normal'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs text-gray-600">
                <div>
                  <span className="text-gray-400 block font-bold uppercase text-[9px] font-mono tracking-wider">Cliente de Produção</span>
                  <strong className="text-gray-900 leading-tight text-sm font-black">{clientName}</strong>
                  <span className="text-gray-400 block text-[10px] font-medium leading-none">{clientTypeDisplay} | CPF/CNPJ: {client?.pfDadosPessoais?.pf_cpf || client?.pjDadosEmpresa?.pj_cnpj || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold uppercase text-[9px] font-mono tracking-wider">Descrição / Nome do Caso</span>
                  <strong className="text-gray-900 leading-tight block truncate max-w-xs">{caseObj?.title || 'Caso sem nome'}</strong>
                  <span className="text-gray-400 block text-[10px] font-medium leading-none">Rito: {caseObj?.registrationTypeKey?.toUpperCase() || 'NÃO DEFINIDO'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold uppercase text-[9px] font-mono tracking-wider">Operador Delegado</span>
                  <strong className="text-gray-900 leading-tight block">{caseObj?.responsibleName || caseObj?.operatorId || 'Sem Distribuição'}</strong>
                  <span className="text-gray-400 block text-[10px] font-medium leading-none">Entrega prevista: {caseObj?.deliveryDate || 'Sem prazo'}</span>
                </div>
              </div>
            </div>

            {/* Score & Refresh Bento */}
            <div className="flex items-center gap-5.5 self-center bg-gray-50/50 border border-gray-100 rounded-3xl p-4.5 min-w-xs justify-between">
              <div className="space-y-1">
                <span className="text-[10px] uppercase text-gray-500 font-extrabold font-mono tracking-wider block">Integridade do Caso</span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black font-mono tracking-tighter ${
                    auditResult.overallPercent >= 90 ? 'text-emerald-600' : auditResult.overallPercent >= 70 ? 'text-indigo-600' : 'text-amber-600'
                  }`}>
                    {auditResult.overallPercent}%
                  </span>
                  <span className="text-xs font-bold text-gray-450">conforme</span>
                </div>
                <div className="text-[10.5px] font-medium text-gray-500 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" />
                    <span><strong>{auditResult.totalCriticalLocksCount}</strong> travas críticas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />
                    <span><strong>{auditResult.totalPendingCount}</strong> pendências</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={recalculating}
                  onClick={() => loadAllData(true)}
                  title="Atualizar varredura"
                  className="p-3.5 bg-white border border-gray-150 rounded-2xl hover:bg-slate-50 transition-all text-slate-700 hover:text-slate-900 flex items-center justify-center cursor-pointer shadow-2xs"
                >
                  {recalculating ? (
                    <Loader2 className="animate-spin shrink-0 text-indigo-600" size={16} />
                  ) : (
                    <RotateCw className="shrink-0" size={16} />
                  )}
                </button>
                <span className="text-[8px] uppercase font-mono text-gray-400 font-black text-center block">Sincronizar</span>
              </div>
            </div>

          </div>

          <div className="mt-5 pt-4.5 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-indigo-50 text-indigo-700 rounded-md shrink-0">
                <Brain size={14} fill="currentColor" className="fill-transparent" />
              </span>
              <p className="text-gray-650 font-medium">
                <strong className="text-gray-900 font-bold">Ação recomendada imediata:</strong>{' '}
                {auditResult.criticalLocks.length > 0 
                  ? `Corrigir o item crítico "${auditResult.criticalLocks[0].label}" de atribuição da [${auditResult.criticalLocks[0].responsible}] para destravar o andamento.`
                  : 'Nenhuma trava fática de risco. O caso encontra-se elegível para avanço ou faturamento.'}
              </p>
            </div>
            <div className="text-gray-400 text-[10.5px] shrink-0 font-medium">
              Último check: {new Date(form.updatedAt).toLocaleTimeString('pt-BR')} do dia {new Date(form.updatedAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            SEÇÃO 2 — PAINEL GERAL DE ESTADO DA CONFORMIDADE (13 MODS)
           ------------------------------------------------------------- */}
        <div className="bg-gray-50 border border-gray-200/50 rounded-[2.2rem] p-6 space-y-4 shadow-3xs">
          <div>
            <h3 className="text-xs font-black uppercase text-gray-900 font-mono tracking-widest">Matriz Geral de Conformidade Transversal (13 Eixos)</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5 font-medium">Auditoria fática pormenorizada por seção operacional regulamentada do rito Giffoni.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(auditResult.sectionScores).map(([sectionName, secScore]) => {
              const countInSec = auditResult.items.filter(i => i.section === sectionName).length;
              const errorsInSec = auditResult.items.filter(i => i.section === sectionName && i.status === 'erro_critico').length;
              const hasLocks = errorsInSec > 0;
              
              return (
                <button
                  key={sectionName}
                  type="button"
                  onClick={() => {
                    setActiveTab('geral');
                    setActiveSectionTab(sectionName);
                  }}
                  className={`bg-white border rounded-2xl p-4.5 text-left transition-all hover:translate-y-[-2px] hover:shadow-xs group cursor-pointer ${
                    activeSectionTab === sectionName && activeTab === 'geral'
                      ? 'ring-2 ring-indigo-600 border-transparent shadow-xs'
                      : 'border-gray-150 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-gray-900 text-xs font-black truncate">{sectionName}</strong>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md ${
                      secScore.percent === 100 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : (secScore.percent >= 70 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700')
                    }`}>
                      {secScore.percent}%
                    </span>
                  </div>

                  <div className="mt-3.5 space-y-2">
                    {/* Tiny Progress Bar */}
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          secScore.percent === 100 ? 'bg-emerald-500' : (secScore.percent >= 70 ? 'bg-indigo-500' : 'bg-amber-500')
                        }`}
                        style={{ width: `${secScore.percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                      <span>{countInSec} regras verificadas</span>
                      {hasLocks ? (
                        <span className="text-rose-600 font-extrabold flex items-center gap-0.5 animate-pulse">
                          ⚠️ {errorsInSec} bloqueio{errorsInSec > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">✓ Seguro</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* -------------------------------------------------------------
            AUDIT TABS NAVIGATION
           ------------------------------------------------------------- */}
        <div className="flex border-b border-gray-200 gap-1 overflow-x-auto pb-px select-none">
          {[
            { id: 'geral', label: `Eixo Selecionado: ${activeSectionTab}`, icon: ClipboardList },
            { id: 'bloqueios', label: `Travas Críticas (${auditResult.totalCriticalLocksCount})`, icon: ShieldAlert },
            { id: 'mensagens', label: 'Mensagens Técnicas', icon: Send },
            { id: 'logs', label: `Logs de Atividade (${actionLogs.length})`, icon: History }
          ].map(tab => {
            const IconComp = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-5.5 font-bold text-xs select-none cursor-pointer transition-all shrink-0 border-b-2 inline-flex items-center gap-2 ${
                  isSel 
                    ? 'border-indigo-650 text-indigo-650 font-black' 
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <IconComp size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: DETAILED DYNAMIC SYSTEM REGULATION COMPLIANCE */}
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start duration-100">
            
            {/* Audit segment left panel list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-gray-150 pb-2.5">
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-900 font-mono">Regras do Eixo: {activeSectionTab}</h4>
                  <p className="text-[11.5px] text-gray-500 font-medium">Checklist executado em tempo real por varredura sob o prontuário.</p>
                </div>
                <span className="text-gray-450 text-[10.5px] font-semibold">{segmentItems.length} regras identificadas</span>
              </div>

              {segmentItems.length === 0 ? (
                <div className="p-8 bg-white border border-gray-200 rounded-3xl text-center text-gray-400 text-xs font-bold font-mono">
                  Isento ou sem regras aplicadas para o rito ativo nesta seção.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {segmentItems.map(item => {
                    const isCrit = item.status === 'erro_critico';
                    const isWarn = item.status === 'atencao';
                    const isPend = item.status === 'pendente';
                    
                    return (
                      <div 
                        key={item.id}
                        className={`bg-white border rounded-2xl p-5 transition-all shadow-3xs flex gap-4 ${
                          isCrit 
                            ? 'border-l-4 border-l-rose-500 border-gray-200' 
                            : (isWarn ? 'border-l-4 border-l-amber-500 border-gray-200' : 'border-l-4 border-l-emerald-500 border-gray-200')
                        }`}
                      >
                        <div className="pt-0.5">
                          {isCrit ? (
                            <div className="w-6 h-6 bg-rose-50 text-rose-700 rounded-full flex items-center justify-center shrink-0">
                              <AlertCircle size={14} />
                            </div>
                          ) : isWarn ? (
                            <div className="w-6 h-6 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                              <AlertTriangle size={14} />
                            </div>
                          ) : isPend ? (
                            <div className="w-6 h-6 bg-amber-50/50 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                              <AlertTriangle size={14} />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center shrink-0">
                              <CheckCircle size={14} />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <strong className="text-gray-900 text-xs font-black">{item.label}</strong>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9.5px] font-black font-mono tracking-wide px-2 py-0.5 rounded-md ${
                                isCrit 
                                  ? 'bg-rose-50 text-rose-700' 
                                  : (isWarn ? 'bg-amber-50 text-amber-800' : (isPend ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'))
                              }`}>
                                {item.statusText}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider font-mono text-gray-400 font-extrabold bg-gray-50 px-1.5 py-0.5 rounded-md">
                                Peso: {item.weight}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11.5px] text-gray-650 leading-relaxed font-semibold">
                            {item.details}
                          </p>

                          {/* Impact explanation if critical blocker */}
                          {item.isCriticalLock && (
                            <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl space-y-1 text-[11px]">
                              <div className="text-rose-950 font-extrabold flex items-center gap-1 font-mono uppercase text-[10px]">
                                <ShieldAlert size={11} /> Impacto Crítico:
                              </div>
                              <p className="text-rose-900 leading-relaxed font-semibold">
                                {item.impact}
                              </p>
                              <div className="text-slate-800 font-extrabold pt-1">
                                Solução sugerida: <span className="text-indigo-700 underline shrink-0 font-extrabold">{item.action}</span>
                              </div>
                              <span className="text-[9px] text-gray-400 block font-semibold pt-1">RESPONSÁVEL: {item.responsible.toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compliance Form Overlay on right side */}
            <div className="space-y-6.5">
              <div className="bg-white border rounded-3xl p-5.5 space-y-5.5 shadow-3xs">
                <div>
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">Selo & Homologação Ministerial</h4>
                  <p className="text-[11px] text-gray-500 font-medium">Controles em conformidade corporativa para destravamento legal.</p>
                </div>

                <div className="space-y-4">
                  {/* Conflict Check option */}
                  <div className="space-y-2">
                    <label className="text-[9.5px] font-black uppercase text-gray-400 font-mono tracking-wider block">1. Conflito de Interesses</label>
                    <div className="flex flex-col gap-1 text-[11.5px]">
                      {[
                        { val: 'pendente', label: 'Análise pendente ⏳', color: 'border-amber-400 bg-amber-50 text-amber-900' },
                        { val: 'sim', label: 'Verificado, sem conflitos ✓', color: 'border-emerald-400 bg-emerald-50 text-emerald-950' },
                        { val: 'nao', label: 'Conflito Encontrado Defensivo 🚨', color: 'border-rose-400 bg-rose-50 text-rose-950' }
                      ].map(opt => (
                        <label 
                          key={opt.val} 
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all font-semibold ${
                            form.conflitoInteresseVerificado === opt.val 
                              ? `${opt.color} font-black scale-[1.01]` 
                              : 'border-gray-150 hover:bg-gray-50 text-gray-600 bg-white'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="conflitoInteresseVerificado" 
                            value={opt.val} 
                            checked={form.conflitoInteresseVerificado === opt.val}
                            onChange={() => setForm(f => ({ ...f, conflitoInteresseVerificado: opt.val as any }))}
                            className="text-indigo-650"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Fund Check option */}
                  <div className="space-y-2">
                    <label className="text-[9.5px] font-black uppercase text-gray-400 font-mono tracking-wider block">2. Análise de Origem de Recursos</label>
                    <div className="flex flex-col gap-1 text-[11.5px]">
                      {[
                        { val: 'pendente', label: 'Aguardando validações de PLD', color: 'border-amber-400 bg-amber-50 text-amber-900' },
                        { val: 'sim', label: 'Recursos lícitos catalogados', color: 'border-emerald-400 bg-emerald-50 text-emerald-950' },
                        { val: 'nao', label: 'ALERTA: Recursos sob verificação', color: 'border-rose-400 bg-rose-50 text-rose-950' }
                      ].map(opt => (
                        <label 
                          key={opt.val} 
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all font-semibold ${
                            form.origemRecursosValida === opt.val 
                              ? `${opt.color} font-black scale-[1.01]` 
                              : 'border-gray-150 hover:bg-gray-50 text-gray-600 bg-white'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="origemRecursosValida" 
                            value={opt.val} 
                            checked={form.origemRecursosValida === opt.val}
                            onChange={() => setForm(f => ({ ...f, origemRecursosValida: opt.val as any }))}
                            className="text-indigo-650"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Documents Complete Switch */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-gray-900 block">Diligências Concluídas</span>
                      <span className="text-[10px] text-gray-400 leading-none block">Diligência arquivista de procurações</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, documentacaoCompleta: !f.documentacaoCompleta }))}
                      className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all border cursor-pointer select-none ${
                        form.documentacaoCompleta 
                          ? 'bg-emerald-500 border-transparent text-white' 
                          : 'bg-white border-gray-250 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      {form.documentacaoCompleta ? 'Conferido ✓' : 'Pendente ⏳'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-3.5 border-t border-gray-100">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-gray-400 block font-mono">Assinatura do Parecerista</label>
                    <input
                      type="text"
                      placeholder="Ex: Arthur Giffoni"
                      value={form.responsavelCompliance}
                      onChange={(e) => setForm(f => ({ ...f, responsavelCompliance: e.target.value }))}
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold font-sans outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-gray-400 block font-mono">Opinião e Notas do Parecer</label>
                    <textarea
                      placeholder="Escreva sobre riscos, ausência de litígios societários adversos ou isenções..."
                      rows={3}
                      value={form.parecerCompliance}
                      onChange={(e) => setForm(f => ({ ...f, parecerCompliance: e.target.value }))}
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none transition-colors font-semibold leading-relaxed shrink-0"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      // Toggle first
                      const next = !form.complianceApproved;
                      setForm(f => ({ ...f, complianceApproved: next }));
                      // We must persist instantly
                      setTimeout(() => handleSaveCompliance(true), 150);
                    }}
                    className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center justify-center gap-2 ${
                      form.complianceApproved 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' 
                        : 'bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-750'
                    }`}
                  >
                    {form.complianceApproved ? (
                      <>
                        <ShieldCheck size={14} className="animate-pulse" />
                        <span>CONFORME & SEGURO</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={14} />
                        <span>APROVAR CONFORMIDADE</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveCompliance(false)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {saving && <Loader2 className="animate-spin shrink-0" size={12} />}
                    <span>{saving ? 'Gravando...' : 'Salvar Parecer Oficial'}</span>
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DETAILED CRITICAL LOCKS CONSOLIDATION */}
        {activeTab === 'bloqueios' && (
          <div className="space-y-6 duration-100">
            <div className="p-5.5 bg-rose-50 border border-rose-150 rounded-3xl space-y-2">
              <h4 className="text-rose-950 font-black text-sm uppercase font-mono tracking-wider flex items-center gap-2">
                <ShieldAlert size={18} />
                Seção 17 — Consolidated Critical Locks / Travas Críticas Detectadas ({auditResult.totalCriticalLocksCount})
              </h4>
              <p className="text-rose-900 text-xs font-semibold leading-relaxed">
                As travas identificadas abaixo representam risco técnico ou ausência de dados vitais obrigatórios estabelecidos por provimento interno e regras de cálculo. Elas impedem o avanço operacional seguro e a distribuição em juízo.
              </p>
            </div>

            {auditResult.criticalLocks.length === 0 ? (
              <div className="p-16 bg-white border border-gray-150 rounded-3xl text-center space-y-2">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={20} />
                </div>
                <strong className="text-gray-950 block text-sm font-black uppercase">Excelente! Nenhuma Trava Crítica Encontrada</strong>
                <p className="text-gray-500 text-xs leading-relaxed max-w-md mx-auto">
                  O caso obedece a todas as diretrizes fundamentais do rito. Prontuário fático pronto para ajuizamento seguro.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Locks Grid lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {auditResult.criticalLocks.map((lock, idx) => (
                    <div key={lock.id} className="bg-white border border-rose-200 hover:border-rose-300 rounded-2xl p-5 space-y-4 shadow-3xs transition-all">
                      <div className="flex items-start justify-between gap-2.5 border-b border-rose-50 pb-2.5">
                        <div className="space-y-0.5">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-rose-600 font-mono bg-rose-50 px-1.5 py-0.5 rounded-md">
                            Trava #{idx + 1} • Seção {lock.section}
                          </span>
                          <h4 className="text-xs font-black text-gray-900">{lock.label}</h4>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-bold">
                          Resp: {lock.responsible}
                        </span>
                      </div>

                      <div className="text-xs space-y-3.5">
                        <div className="space-y-1">
                          <span className="text-[9.5px] uppercase font-black tracking-wider text-gray-400 block font-mono">Diligência Ausente</span>
                          <p className="text-gray-800 font-bold leading-relaxed">{lock.details}</p>
                        </div>

                        <div className="p-3 bg-rose-50/35 border border-rose-100 rounded-xl space-y-1">
                          <span className="text-[9.5px] uppercase font-black tracking-wider text-rose-800 block font-mono">Como Impacta Outros Setores (Efeito)</span>
                          <p className="text-rose-950 font-medium leading-relaxed">{lock.impact}</p>
                        </div>

                        <div className="p-3 bg-gradient-to-r from-indigo-50/50 to-slate-50/50 border border-indigo-100 rounded-xl space-y-1">
                          <span className="text-[9.5px] uppercase font-black tracking-wider text-indigo-800 block font-mono">Ação Necessária de Destravamento (Solução)</span>
                          <strong className="text-indigo-950 block">{lock.action}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Seção 19 — Ordem Lógica de Destravamento */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-gray-900 font-mono tracking-widest flex items-center gap-1.5">
                      <Folders size={15} className="text-indigo-600" />
                      Seção 19 — Ordem Lógica de Solução de Travas e Desobstrução
                    </h4>
                    <p className="text-[11.5px] text-gray-500 mt-0.5 font-medium leading-relaxed">
                      Siga a sequência hierárquica abaixo baseada em dependência estrutural de banco de dados. Sanar pendências na ordem indicada garante integridade máxima de dados sem inconsistências.
                    </p>
                  </div>

                  <ol className="divide-y divide-gray-150 border border-gray-200 rounded-2xl overflow-hidden text-xs bg-white">
                    {auditResult.unblockingOrder.map((stepDesc, idx) => (
                      <li key={idx} className="p-4 flex gap-3.5 hover:bg-gray-50/50 transition-colors">
                        <span className="w-5.5 h-5.5 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold font-mono text-[10.5px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-gray-800 font-semibold leading-relaxed pt-0.5">{stepDesc}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOM AUTOMATIC MESSAGES GENERATOR (SEÇÕES 20 - 21) */}
        {activeTab === 'mensagens' && (
          <div className="space-y-6 duration-100">
            <div className="p-5.5 bg-indigo-50 border border-indigo-150 rounded-3xl space-y-2">
              <h4 className="text-indigo-950 font-black text-sm uppercase font-mono tracking-wider flex items-center gap-2">
                <Send size={18} />
                Seção 20/21 — Central de Cobranças Gerais & Avisos Automáticos
              </h4>
              <p className="text-indigo-900 text-xs font-semibold leading-relaxed">
                Utilize o gerador dinâmico abaixo para comunicar-se de forma amigável com cada responsável. O sistema pesquisa as pendências desse player e compila um texto amigável adaptado para WhatsApp ou e-mail. Copa instantânea via área de transferência.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { role: 'Cliente', desc: 'Notifique o cliente a assinar procuração, declaração ou fornecer identidade no drive de forma simples.', icon: User, color: 'hover:border-indigo-400 bg-indigo-50/10' },
                { role: 'Secretaria', desc: 'Solicite conferência do cadastro tributária, criação de drive de faturamento ou senhas de acesso do portal.', icon: Users, color: 'hover:border-emerald-400 bg-emerald-50/10' },
                { role: 'Advogado', desc: 'Cobre qualificação de réus, formulação de comarca de comissão judiciária ou preenchimento de farsa processual.', icon: Briefcase, color: 'hover:border-amber-400 bg-amber-50/10' }
              ].map(card => {
                const IconComp = card.icon;
                const matchesCount = auditResult.items.filter(i => i.responsible === card.role && i.status !== 'ok').length;
                
                return (
                  <div key={card.role} className={`bg-white border rounded-2xl p-5 space-y-4 shadow-3xs flex flex-col justify-between transition-all ${card.color}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="w-9 h-9 bg-slate-55 border border-gray-100 text-slate-700 rounded-xl flex items-center justify-center shrink-0">
                          <IconComp size={16} />
                        </div>
                        <span className={`text-[9.5px] font-black font-mono px-2 py-1 rounded-md ${
                          matchesCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {matchesCount} Pendências
                        </span>
                      </div>

                      <div>
                        <strong className="text-gray-900 text-xs font-black">Notificação para o {card.role}</strong>
                        <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5 font-medium">
                          {card.desc}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyAlertMessage(card.role as any)}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-950 transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <Share2 size={13} />
                      <span>Gerar para WhatsApp</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: REAL ACTION LOG HISTORY */}
        {activeTab === 'logs' && (
          <div className="space-y-5 duration-100">
            <div className="flex justify-between items-center border-b pb-2.5">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-900 font-mono">Duração e Registro de Rotina Real</h4>
                <p className="text-[11.5px] text-gray-500 font-medium">Logs persistentes salvos noFirestore registrando quem executou as tomadas de decisão.</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await logAction('Limpeza de Filtros', 'Histórico de atividades reiniciado para fins de monitoramento limpo.', 'sucesso');
                    setSuccess('Histórico de monitoramento ativo reinicializado com sucesso.');
                    setTimeout(() => setSuccess(null), 2000);
                  } catch (e: any) {
                    setError('Falha ao processar redefinição: ' + e.message);
                  }
                }}
                className="text-[10px] text-gray-400 hover:text-rose-600 font-bold transition-all cursor-pointer"
              >
                Limpar Log Recente
              </button>
            </div>

            {actionLogs.length === 0 ? (
              <div className="p-12 bg-white border border-gray-150 rounded-3xl text-center text-gray-400 text-xs font-bold font-mono">
                Ainda não há lançamentos de auditoria salvos para este prontuário.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-2.5rm overflow-hidden bg-white text-xs shadow-3xs">
                {actionLogs.map((log, idx) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/40">
                    <div className="flex gap-3">
                      <div className="pt-0.5 shrink-0">
                        <span className={`w-2.5 h-2.5 rounded-full block ${
                          log.status === 'sucesso' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-gray-905 font-bold">{log.action}</strong>
                          <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded-md">
                            Usuador: {log.user}
                          </span>
                        </div>
                        <p className="text-gray-600 leading-relaxed font-semibold">{log.details}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-[10.5px] text-gray-400 font-semibold font-mono">
                      {new Date(log.timestamp).toLocaleDateString('pt-BR')} {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            BOTTOM NAV BAR
           ------------------------------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.revisao(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3.5 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white shadow-2xs"
          >
            <ArrowLeft size={14} />
            Voltar para Revisão
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate(flowRoutes.protocolo(caseId!))}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3.5 rounded-xl font-extrabold transition-all text-xs cursor-pointer shadow-xs"
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
